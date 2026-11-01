from decimal import Decimal

from django.db.models import Case, Count, Exists, Max, OuterRef, Q, Sum, Value, When
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.response import Response

from config.exportar import Columna, ExportarMixin, describir_rango, escribir_fecha
from config.hijos import (
    error_de_fila, es_fila_nueva, fila_guardada, ids_que_vienen, leer_lista, leer_lista_si_vino,
)
from config.listados import leer_fecha, leer_importe, ordenar
from config.paginacion import PaginacionDeListado
from materiales.models import Material

from .models import Gasto, MaterialDelGasto
from .serializers import (
    GastoSerializer,
    MaterialDelGastoModificarSerializer,
    MaterialDelGastoSerializer,
    ResumenDeGastosSerializer,
)

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


# Las columnas por las que se puede ordenar el listado (?orden=monto, o
# ?orden=-monto para al revés). TIPO va por la etiqueta que se lee en la
# tabla y no por el código: Materiales, Otro, Publicidad.
ORDENES = {
    'numero': ['id'],
    'tipo': ['orden_tipo'],
    'fecha': ['fecha'],
    'descripcion': ['descripcion'],
    'monto': ['monto'],
}


def _materiales_para_exportar(gasto):
    """"3 × Porcelana, 1 × Barniz", desde lo que ya trajo el prefetch. Un gasto
    de materiales sin filas dice "Sin materiales", como el chip del listado."""
    if gasto.tipo != Gasto.Tipo.MATERIALES:
        return ''
    filas = gasto.materiales.all()
    if not filas:
        return 'Sin materiales'
    return ', '.join(f'{fila.cantidad} × {fila.material.nombre}' for fila in filas)


# Las cuatro operaciones del CRUD no llevan docstring con su CU porque
# no están escritas acá: las hereda el ModelViewSet de DRF. La
# correspondencia es esta, para no tener que deducirla:
#
#   list      GET    /gastos/       CU53 - buscar
#   create    POST   /gastos/       CU52 - alta
#   update    PUT    /gastos/{id}/  CU54 - modificar
#   destroy   DELETE /gastos/{id}/  CU55 - borrar
#
# retrieve (GET /gastos/{id}/) no implementa un CU propio: devuelve la
# ficha que CU54 usa para cargar el formulario.

class GastoViewSet(ExportarMixin, viewsets.ModelViewSet):
    """CRUD de gastos y de los materiales que los componen (CU52 a CU59).

    Hereda IsAuthenticated de la configuración global de DRF, por lo que
    todos los endpoints exigen sesión activa.

    Gasto no tiene baja lógica, así que no hay ningún estado que deje al
    registro de solo lectura, igual que Pedido y Cliente. update() está
    sobrescrito por otro motivo: un gasto de materiales no puede cambiar
    de tipo.

    Además del CRUD expone dos cosas:

    - los materiales del gasto, en /materiales/ (CU56 a CU59)
    - marcar esos materiales en disponibilidad Alta, que es parte de CU58
    """

    # El prefetch llega hasta el material de cada fila porque el
    # serializer muestra su nombre, su estado y su disponibilidad. Sin
    # esto serían dos consultas por cada gasto del listado. Va como
    # atributo y no en get_queryset() porque es el mismo para todas las
    # acciones: hay un solo serializer.
    queryset = Gasto.objects.prefetch_related('materiales__material')
    serializer_class = GastoSerializer

    # El listado se pagina con ?pagina= (corrección D3), con los filtros y
    # el orden resueltos en la base por _filtrar(). Reemplaza al
    # SearchFilter y al OrderingFilter de DRF.
    pagination_class = PaginacionDeListado

    # Lo que necesita ExportarMixin para /exportar/ (corrección E10).
    EXPORTAR_TITULO = 'Gastos'
    EXPORTAR_ARCHIVO = 'gastos'
    EXPORTAR_UNIDAD = ('gasto', 'gastos')
    COLUMNAS_PARA_EXPORTAR = [
        Columna('N.º', lambda g: g.id, 'numero', 5),
        Columna('Fecha', lambda g: g.fecha, 'fecha', 8),
        Columna('Tipo', lambda g: g.get_tipo_display(), 'texto', 9),
        Columna('Descripción', lambda g: g.descripcion, 'texto', 24),
        Columna('Materiales', _materiales_para_exportar, 'texto', 24),
        Columna('Monto', lambda g: g.monto, 'plata', 9),
    ]

    def get_queryset(self):
        """En el listado, los filtros y el orden de la URL; en lo demás, sin filtrar."""
        queryset = super().get_queryset()

        # Exportar trae lo mismo que el listado, con los mismos filtros.
        if self.action in ('list', 'exportar'):
            return self._filtrar(queryset)

        return queryset

    def _filtrar(self, queryset, con_orden=True):
        """Aplica al listado los filtros, la búsqueda y el orden de la URL (CU53).

        Son los del modal de filtros y el buscador de la pantalla:

          busqueda=texto             número, descripción, tipo o nombre de un
                                     material comprado
          tipo=PUBLICIDAD            se puede repetir: cualquiera de los elegidos
          fecha_desde, fecha_hasta   el período, AAAA-MM-DD, inclusive
          monto_desde, monto_hasta   el rango de monto, inclusive
          orden=monto                una clave de ORDENES; con '-', al revés

        El resumen usa los mismos filtros sin el orden (con_orden=False),
        porque suma lo que se está mirando.
        """
        parametros = self.request.query_params

        texto = parametros.get('busqueda', '').strip()
        if texto:
            # El tipo se busca por la etiqueta que se lee en la tabla
            # ("publi" encuentra Publicidad), no por el código.
            tipos = [valor for valor, etiqueta in Gasto.Tipo.choices if texto.lower() in etiqueta.lower()]
            # Exists y no un filtro sobre la relación: con un JOIN, un gasto
            # con dos materiales que coinciden saldría dos veces, y el
            # resumen los sumaría dos veces.
            compro_el_material = Exists(
                MaterialDelGasto.objects.filter(gasto=OuterRef('pk'), material__nombre__icontains=texto)
            )
            condicion = Q(descripcion__icontains=texto) | Q(tipo__in=tipos) | Q(compro_el_material)
            # "18" y "#18" encuentran el gasto 18.
            numero = texto.lstrip('#')
            if numero.isdigit():
                condicion |= Q(id=int(numero))
            queryset = queryset.filter(condicion)

        tipos = parametros.getlist('tipo')
        if tipos:
            if any(tipo not in Gasto.Tipo.values for tipo in tipos):
                raise ParseError('Uno de los tipos no existe.')
            queryset = queryset.filter(tipo__in=tipos)

        fecha_desde = leer_fecha(parametros, 'fecha_desde')
        if fecha_desde is not None:
            queryset = queryset.filter(fecha__gte=fecha_desde)

        fecha_hasta = leer_fecha(parametros, 'fecha_hasta')
        if fecha_hasta is not None:
            queryset = queryset.filter(fecha__lte=fecha_hasta)

        monto_desde = leer_importe(parametros, 'monto_desde')
        if monto_desde is not None:
            queryset = queryset.filter(monto__gte=monto_desde)

        monto_hasta = leer_importe(parametros, 'monto_hasta')
        if monto_hasta is not None:
            queryset = queryset.filter(monto__lte=monto_hasta)

        if not con_orden:
            return queryset

        queryset = queryset.annotate(
            orden_tipo=Case(
                When(tipo=Gasto.Tipo.MATERIALES, then=Value(0)),
                When(tipo=Gasto.Tipo.OTRO, then=Value(1)),
                default=Value(2),
            ),
        )
        # Sin orden elegido queda el del modelo: los más nuevos primero.
        return ordenar(queryset, parametros, ORDENES, ['-fecha', '-id'])

    def describir_filtros(self, parametros):
        """Los filtros de _filtrar() en palabras, para el PDF y el Excel (corrección E10).

        Con los textos de los chips de la pantalla. No valida: exportar lo
        llama después de get_queryset(), que ya rechazó lo que no se entiende.
        """
        filtros = []

        texto = parametros.get('busqueda', '').strip()
        if texto:
            filtros.append(f'Búsqueda: {texto}')

        tipos = parametros.getlist('tipo')
        if tipos:
            filtros.append('Tipo: ' + ', '.join(Gasto.Tipo(tipo).label for tipo in tipos))

        rangos = [
            describir_rango(
                'Fecha', leer_fecha(parametros, 'fecha_desde'), leer_fecha(parametros, 'fecha_hasta'),
                escribir=escribir_fecha,
            ),
            describir_rango(
                'Monto', leer_importe(parametros, 'monto_desde'), leer_importe(parametros, 'monto_hasta'),
            ),
        ]
        filtros += [rango for rango in rangos if rango]

        return filtros

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """La línea de arriba del listado y el tope del deslizador. Es parte de CU53.

        A diferencia del de Pedidos, el resumen cuenta sobre lo FILTRADO:
        dice cuánto suma lo que se está mirando, porque filtrar por período
        o por tipo es justamente la forma de preguntar cuánto se gastó. Por
        eso recibe los mismos filtros que el listado.

        monto_maximo, en cambio, es sobre TODOS los gastos: es el tope del
        deslizador de monto, que tiene que alcanzar al gasto más caro haya
        el filtro que haya.

        Son dos consultas, siempre las mismas.
        """
        filtrados = self._filtrar(Gasto.objects.all(), con_orden=False)
        cuentas = filtrados.aggregate(cantidad=Count('id'), monto_total=Sum('monto'))

        datos = {
            'cantidad': cuentas['cantidad'],
            # Sin gastos, Sum y Max devuelven None: cero.
            'monto_total': cuentas['monto_total'] or Decimal('0'),
            'monto_maximo': Gasto.objects.aggregate(maximo=Max('monto'))['maximo'] or Decimal('0'),
        }

        return Response(ResumenDeGastosSerializer(datos).data)

    # -----------------------------------------------------------------
    # La regla del monto, que es parte de CU52 y CU54
    # -----------------------------------------------------------------

    def _recalcular_monto(self, gasto):
        """Escribe el monto de un gasto de materiales: la suma de sus subtotales.

        Es la ÚNICA puerta por la que se escribe el monto de un gasto de
        materiales, con el mismo criterio que _guardar_estado en Pedidos:
        la cuenta está escrita una sola vez, y todos los caminos que
        pueden cambiarla pasan por acá. Son cinco: el alta y la
        modificación del gasto, y agregar, modificar o quitar un material
        del gasto.

        Para los gastos de publicidad y de otro no hace nada: ahí el monto
        lo cargó la usuaria, y el serializer ya revisó que sea mayor a
        cero.

        Recorre gasto.materiales.all() y suma en Python, como las
        propiedades de Pedido: cuando el gasto viene de get_object(), la
        lista ya está en memoria por el prefetch. El Decimal('0') de
        semilla es lo que hace que un gasto sin materiales quede en
        Decimal('0') y no en el entero 0.
        """
        if gasto.tipo != Gasto.Tipo.MATERIALES:
            return

        gasto.monto = sum(
            (fila.subtotal for fila in gasto.materiales.all()),
            Decimal('0'),
        )
        gasto.save(update_fields=['monto'])

    def _bloquear(self, gasto):
        """Bloquea la fila del gasto hasta que termine la transacción.

        _recalcular_monto suma las filas y escribe: dos materiales
        registrados al mismo tiempo sumarían cada uno sin la fila del otro
        y ganaría el último. Con select_for_update el segundo espera a que
        el primero confirme, y recién entonces lee. Es el mismo candado que
        _bloquear en PedidoViewSet; refresh_from_db además vacía el
        prefetch de get_object(), que se leyó antes del candado.
        """
        gasto.refresh_from_db(from_queryset=Gasto.objects.select_for_update())

    # -----------------------------------------------------------------
    # El alta: el gasto y sus materiales en un solo pedido a la API
    # -----------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        """CU52 - Registrar un gasto, con sus materiales, en un solo pedido a la API.

        Además de los datos del gasto, el cuerpo puede traer 'materiales':
        una lista con lo mismo que recibe registrar_material por fila
        ('material', 'cantidad', 'precio_unitario'). Todo se guarda en la
        misma transacción (ATOMIC_REQUESTS): si una fila falla, la
        respuesta es 400 con la clave 'materiales' y el número de la fila,
        y no queda ni el gasto. Sin 'materiales' es el alta de siempre, y
        un gasto de materiales sin filas nace en 0.

        Corrección del tutor: antes el frontend creaba el gasto y después
        mandaba una fila por pedido, y un fallo a mitad dejaba un gasto a
        medias. Las reglas de cada fila siguen en _registrar_material, la
        misma función que usa la acción de una fila; el monto lo escribe
        _recalcular_monto una sola vez, al final, con todas las filas.
        """
        filas = leer_lista(request.data, 'materiales')

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gasto = serializer.save()

        for numero, datos in enumerate(filas, start=1):
            try:
                self._registrar_material(gasto, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('materiales', numero, self._nombre_del_material(datos), error)

        self._recalcular_monto(gasto)

        return Response(self.get_serializer(gasto).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _nombre_del_material(datos):
        """El nombre del material de una fila del alta, para el mensaje de error, o ''."""
        material_id = datos.get('material') if isinstance(datos, dict) else None

        if not isinstance(material_id, int):
            return ''

        return Material.objects.filter(pk=material_id).values_list('nombre', flat=True).first() or ''

    # -----------------------------------------------------------------
    # Sobreescribo update, ya que un gasto de materiales no cambia de tipo
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        """CU54 - Modificar un gasto, con sus materiales, en un solo pedido a la API.

        Impide cambiar el tipo de un gasto de materiales: los materiales del
        gasto y el monto calculado son datos que dependen del tipo, y no hay
        forma de convertirlos en un monto cargado a mano sin inventarlo. El
        camino inverso sí se permite: un gasto de publicidad u otro puede
        pasar a materiales, porque ahí no hay nada que inventar, el monto
        pasa a 0 y se cargan los materiales.

        Además de los datos, el cuerpo puede traer 'materiales': la lista
        COMPLETA de filas tal como quedó en la ficha, cada una con lo mismo
        que recibe registrar_material, su 'id' si ya estaba guardada y
        'pasar_a_alta' si hay que marcar el material en disponibilidad Alta.
        _sincronizar_materiales la compara con lo guardado y quita, modifica
        y registra lo que haga falta, en la misma transacción que los datos
        (ATOMIC_REQUESTS): si una fila falla, 400 con la clave 'materiales' y
        el número de la fila, y el gasto queda como estaba. El monto se
        recalcula una sola vez, al final, y la respuesta es el gasto con una
        clave más, 'materiales_cambiados': los que pasaron a Alta. Sin
        'materiales' es el PUT de siempre, que no toca las filas.

        Corrección del tutor: antes la ficha mandaba el PUT de los datos y
        después un pedido por fila, y un fallo a mitad dejaba lo anterior
        guardado. Cubre PUT y PATCH: DRF resuelve el PATCH llamando a update.
        """
        # Rechaza con 400 un cuerpo que no sea un objeto JSON.
        filas = leer_lista_si_vino(request.data, 'materiales')

        gasto = self.get_object()
        self._bloquear(gasto)

        tipo_nuevo = request.data.get('tipo')

        if (
            gasto.tipo == Gasto.Tipo.MATERIALES
            and tipo_nuevo is not None
            and tipo_nuevo != Gasto.Tipo.MATERIALES
        ):
            return Response(
                {'detail': 'Un gasto de materiales no puede cambiar de tipo: su '
                           'monto sale de los materiales cargados y no hay forma '
                           'de convertirlo en un monto cargado a mano. Si el tipo '
                           'está mal, eliminá el gasto y cargalo de nuevo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(gasto, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)
        serializer.save()

        cambiados = []
        if filas is not None:
            cambiados = self._sincronizar_materiales(gasto, filas)

        # Después de las filas y una sola vez. La suma lee de la base,
        # porque _bloquear vació el prefetch. Es también lo que pone el monto
        # en 0 cuando un gasto de publicidad u otro pasa a materiales.
        self._recalcular_monto(gasto)

        datos = self.get_serializer(gasto).data
        datos['materiales_cambiados'] = cambiados

        return Response(datos)

    def _sincronizar_materiales(self, gasto, filas):
        """Deja los materiales del gasto como dice la lista completa de la ficha, y devuelve los que pasaron a Alta.

        Se compara con lo guardado, con la fila del gasto ya bloqueada: la
        guardada cuyo id no viene se quita; la que viene con el id de una
        guardada se modifica con _modificar_material, como el PATCH; la que
        no trae id, o trae el provisorio negativo del borrador, se registra
        con _registrar_material. Un id que no es de este gasto responde 400,
        como las acciones. Las quitadas van primero, así un material que se
        sacó y se volvió a cargar no cuenta como repetido. Un error en una
        fila sale con su número en la lista. Al final pasan a Alta los
        marcados con 'pasar_a_alta', con la misma regla que los dos
        endpoints de disponibilidad. Quien llama recalcula el monto después.
        """
        guardadas = {fila.pk: fila for fila in gasto.materiales.all()}
        conservadas = ids_que_vienen(filas)

        for fila_id, fila in guardadas.items():
            if fila_id not in conservadas:
                fila.delete()

        a_alta = []
        for numero, datos in enumerate(filas, start=1):
            try:
                if es_fila_nueva(datos):
                    fila = self._registrar_material(gasto, datos)
                else:
                    fila = fila_guardada(datos, guardadas)
                    if fila is None:
                        raise ParseError('Ese material no pertenece a este gasto.')
                    fila = self._modificar_material(fila, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('materiales', numero, self._nombre_del_material(datos), error)

            if datos.get('pasar_a_alta'):
                a_alta.append(fila.material)

        return self._marcar_disponibilidad_alta(a_alta)

    # -----------------------------------------------------------------
    # Los materiales del gasto (CU56 a CU59)
    # -----------------------------------------------------------------
    # Los materiales de un gasto son una colección que cuelga de él, así
    # que las cuatro operaciones son las cuatro operaciones normales
    # sobre una colección, sobre la misma URL base:
    #
    #   GET    /api/gastos/1/materiales/     lista           (CU57)
    #   POST   /api/gastos/1/materiales/     registra uno    (CU56)
    #   PATCH  /api/gastos/1/materiales/3/   lo modifica     (CU58)
    #   DELETE /api/gastos/1/materiales/3/   lo quita        (CU59)
    #
    # Es la misma forma que los productos del pedido, y el id de la ruta
    # también es el de la FILA (MaterialDelGasto), no el del material.

    def _buscar_material_del_gasto(self, gasto, material_del_gasto_id):
        """Busca una fila ENTRE LAS DE ESTE GASTO, o devuelve None.

        Recorre gasto.materiales, que get_object() ya trajo con el
        prefetch. Buscar dentro de esa lista, y no en
        MaterialDelGasto.objects, es lo que garantiza que la fila sea de
        este gasto: una fila ajena directamente no está en la lista. Sin
        eso, mandando un id cualquiera se podrían editar los materiales
        de otro gasto.

        El \\d+ del url_path ya garantizó que material_del_gasto_id sean
        dígitos, así que el int() no puede fallar.
        """
        for fila in gasto.materiales.all():
            if fila.pk == int(material_del_gasto_id):
                return fila

        return None

    @action(detail=True, methods=['get'], url_path='materiales')
    def materiales(self, request, pk=None):
        """CU57 - Listar los materiales de un gasto.

        Devuelve las filas con el nombre, el estado y la disponibilidad
        de cada material, que es lo que dibuja la tabla de materiales de
        la ficha.
        """
        gasto = self.get_object()

        return Response(
            MaterialDelGastoSerializer(
                gasto.materiales.all(), many=True
            ).data
        )

    # El mapping le dice al router: misma URL que 'materiales', pero
    # cuando el método sea POST, ejecutá esta otra función. Así cada caso
    # de uso queda en su propio método, sin un if adentro.
    def _registrar_material(self, gasto, datos):
        """Crea una fila de MaterialDelGasto con las reglas de CU56 y la devuelve.

        Es la única puerta para cargarle un material a un gasto: la usan
        registrar_material (una fila por pedido a la API) y create() (todas
        las filas del alta, en una transacción). Rechaza con ParseError y
        no con una respuesta: es lo que hace que la transacción revierta
        (ATOMIC_REQUESTS), y la respuesta es la misma, {'detail': …}.

        Solo un gasto de materiales lleva materiales del gasto. En los
        otros dos tipos el monto lo cargó la usuaria, y una fila acá no
        sumaría a nada.

        Se rechaza un material que ya figura en el gasto, por la
        restricción de unicidad: para comprar más del mismo se corrige la
        cantidad de la fila que ya está.

        No se rechaza un material discontinuado, igual que al agregarlo a
        un producto: la pantalla directamente no lo ofrece, así que el
        backend no necesita una regla para algo que no le mandan.
        """
        if gasto.tipo != Gasto.Tipo.MATERIALES:
            raise ParseError(
                'Solo un gasto de materiales lleva materiales del '
                f'gasto. Este es de {gasto.get_tipo_display()}.'
            )

        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(datos, dict):
            raise ParseError('El cuerpo tiene que ser un objeto JSON.')

        material_id = datos.get('material')

        if not material_id:
            raise ParseError('Falta el id del material.')

        try:
            material = Material.objects.get(pk=material_id)
        except (Material.DoesNotExist, ValueError, TypeError):
            raise ParseError('No existe un material con ese id.')

        # Este chequeo es el que evita el IntegrityError crudo de la
        # UniqueConstraint (gasto, material). Sin él, PostgreSQL rechaza
        # la fila, Django levanta la excepción y el frontend recibe un 500
        # en vez de un mensaje que se pueda mostrar.
        #
        # Se arma la lista en Python sobre las filas del gasto, leídas de
        # la base (en la acción, después del candado de _bloquear; en el
        # alta, el gasto es nuevo), no con un .filter(): igual que en
        # productos. En el alta, así una fila repetida en el mismo cuerpo
        # también se rechaza.
        materiales_cargados = [fila.material for fila in gasto.materiales.all()]

        if material in materiales_cargados:
            raise ParseError(
                f'El gasto ya tiene «{material.nombre}» entre sus '
                f'materiales. Si compraste más, corregí la cantidad.'
            )

        # Se guarda con el serializer y no con .objects.create() porque
        # acá hay números que validar. Sin esto, una cantidad en 0 o un
        # precio en 0 los rechaza la CheckConstraint de PostgreSQL, Django
        # levanta un IntegrityError y el frontend recibe un 500 en vez de
        # un mensaje que se pueda mostrar.
        serializer = MaterialDelGastoSerializer(data=datos)
        serializer.is_valid(raise_exception=True)

        # El gasto no viene en el cuerpo: sale de la URL, y se lo pasamos
        # acá para que nadie pueda cargarle un material a otro gasto
        # mandándolo en el formulario.
        return serializer.save(gasto=gasto)

    @materiales.mapping.post
    def registrar_material(self, request, pk=None):
        """CU56 - Registrar un material del gasto.

        En el cuerpo llegan 'material' (el id), 'cantidad' y
        'precio_unitario'. Los tres son obligatorios: el precio no se
        copia de ningún lado porque Material no tiene precio. Las reglas
        están en _registrar_material, que comparte con el alta.
        """
        gasto = self.get_object()
        self._bloquear(gasto)

        self._registrar_material(gasto, request.data)

        # La fila nueva mueve el monto. La suma lee de la base: _bloquear ya
        # vació el prefetch, así que la incluye.
        self._recalcular_monto(gasto)

        return Response(self.get_serializer(gasto).data)

    def _modificar_material(self, fila, datos):
        """Modifica una fila de MaterialDelGasto con las reglas de CU58 y la devuelve.

        Es la única puerta para modificar una fila: la usan
        modificar_material_del_gasto (el PATCH de una) y
        _sincronizar_materiales (el guardado de la ficha). El material no
        está entre los campos del serializer, así que no se puede cambiar.
        """
        # partial=True: es un PATCH, así que lo que no venga en el cuerpo
        # se deja como está. El serializer valida la cantidad y el precio
        # por lo mismo que en el alta.
        serializer = MaterialDelGastoModificarSerializer(
            fila,
            data=datos,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    @action(detail=True, methods=['patch'],
            url_path=r'materiales/(?P<material_del_gasto_id>\d+)')
    def modificar_material_del_gasto(self, request, pk=None,
                                     material_del_gasto_id=None):
        """CU58 - Modificar un material del gasto.

        Se pueden cambiar la cantidad y el precio unitario. El material
        no: para anotar otro material se quita esta fila y se agrega
        otra. Las reglas están en _modificar_material, que comparte con el
        guardado de la ficha.
        """
        gasto = self.get_object()
        self._bloquear(gasto)

        fila = self._buscar_material_del_gasto(gasto, material_del_gasto_id)

        if fila is None:
            return Response(
                {'detail': 'Ese material no pertenece a este gasto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._modificar_material(fila, request.data)

        gasto.refresh_from_db()

        # Cambiar la cantidad o el precio de una fila mueve el subtotal, y
        # con él el monto del gasto.
        self._recalcular_monto(gasto)

        return Response(self.get_serializer(gasto).data)

    @modificar_material_del_gasto.mapping.delete
    def quitar_material_del_gasto(self, request, pk=None,
                                  material_del_gasto_id=None):
        """CU59 - Quitar un material del gasto.

        Borra la fila, no el material: el material sigue existiendo y
        puede figurar en otros gastos y en productos. Es lo que protege
        el PROTECT de la clave foránea.
        """
        gasto = self.get_object()
        self._bloquear(gasto)

        fila = self._buscar_material_del_gasto(gasto, material_del_gasto_id)

        if fila is None:
            return Response(
                {'detail': 'Ese material no pertenece a este gasto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fila.delete()

        gasto.refresh_from_db()

        # Quitar una fila baja el monto lo que valía esa fila. Al quitar
        # la última, el gasto vuelve a 0.
        self._recalcular_monto(gasto)

        return Response(self.get_serializer(gasto).data)

    # -----------------------------------------------------------------
    # La disponibilidad del material, que es parte de CU58
    # -----------------------------------------------------------------
    # Comprar un material es la señal de que volvió a haber existencias,
    # así que desde la tabla de materiales del gasto se lo puede marcar en
    # disponibilidad Alta, de a uno o todos juntos. Es lo único del
    # sistema que escribe sobre otro módulo, y por eso la regla vive acá
    # y no en el navegador.
    #
    #   POST  /api/gastos/1/materiales/3/disponibilidad_alta   una fila
    #   POST  /api/gastos/1/materiales/disponibilidad_alta     todas
    #
    # Deshacer NO es un endpoint: la respuesta dice qué disponibilidad
    # tenía cada material antes, y el frontend la restaura con el PATCH
    # de materiales que ya existe.

    def _marcar_disponibilidad_alta(self, materiales):
        """Pone en Alta los materiales que corresponda y devuelve qué cambió.

        Solo se tocan los ACTIVOS con disponibilidad distinta de Alta. Los
        discontinuados se saltean porque son de solo lectura, que es la
        misma condición que impone MaterialViewSet.update; los que ya
        están en Alta, porque no hay nada que cambiar. Ninguno de los dos
        es un error: se ignoran.

        Por cada material que cambió devuelve su id, su nombre y la
        disponibilidad que tenía, con su etiqueta legible al lado. El
        valor anterior se anota ANTES de escribir, porque después del
        save() ya no está.
        """
        cambiados = []

        for material in materiales:
            if material.estado != Material.Estado.ACTIVO:
                continue

            if material.disponibilidad == Material.Disponibilidad.ALTA:
                continue

            cambiados.append({
                'id': material.id,
                'nombre': material.nombre,
                'disponibilidad_anterior': material.disponibilidad,
                'disponibilidad_anterior_display': material.get_disponibilidad_display(),
            })

            material.disponibilidad = Material.Disponibilidad.ALTA
            material.save(update_fields=['disponibilidad'])

        return cambiados

    @action(detail=True, methods=['post'],
            url_path=r'materiales/(?P<material_del_gasto_id>\d+)/disponibilidad_alta')
    def marcar_disponibilidad_alta(self, request, pk=None,
                                   material_del_gasto_id=None):
        """Parte de CU58 - Marcar el material de una fila en disponibilidad Alta.

        Si el material ya estaba en Alta o está discontinuado, no cambia
        nada y la lista de cambios vuelve vacía.
        """
        gasto = self.get_object()

        fila = self._buscar_material_del_gasto(gasto, material_del_gasto_id)

        if fila is None:
            return Response(
                {'detail': 'Ese material no pertenece a este gasto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cambiados = self._marcar_disponibilidad_alta([fila.material])

        # Las filas del gasto muestran la disponibilidad del material, así
        # que se relee de la base para devolverlas ya actualizadas.
        gasto.refresh_from_db()

        return Response({
            'materiales_cambiados': cambiados,
            'gasto': self.get_serializer(gasto).data,
        })

    @action(detail=True, methods=['post'],
            url_path='materiales/disponibilidad_alta')
    def marcar_todos_disponibilidad_alta(self, request, pk=None):
        """Parte de CU58 - Marcar todos los materiales del gasto en disponibilidad Alta.

        Recorre las filas del gasto y aplica la misma regla que la de a
        uno: los que ya estaban en Alta y los discontinuados quedan como
        estaban y no aparecen en la lista de cambios.
        """
        gasto = self.get_object()

        materiales = [fila.material for fila in gasto.materiales.all()]

        cambiados = self._marcar_disponibilidad_alta(materiales)

        gasto.refresh_from_db()

        return Response({
            'materiales_cambiados': cambiados,
            'gasto': self.get_serializer(gasto).data,
        })
