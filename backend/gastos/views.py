from decimal import Decimal

from django.db.models import Case, Count, Exists, Max, OuterRef, Q, Sum, Value, When
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from config.exportar import Columna, ExportarMixin, describir_rango, escribir_fecha
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

    # perform_create y perform_update son los dos ganchos que DRF deja
    # para hacer algo con el objeto recién guardado. El mixin del CRUD
    # valida el cuerpo y arma la respuesta, y delega el guardado en estos
    # dos métodos, que por defecto solo hacen serializer.save().
    # Sobrescribirlos es tocar únicamente el paso de guardar: la
    # respuesta sale con el monto ya recalculado porque es el mismo
    # objeto.
    #
    # En el alta la cuenta da 0, porque el gasto todavía no tiene
    # materiales. En la modificación no es decorativa: es la que pone el
    # monto en 0 cuando un gasto de publicidad u otro pasa a materiales.

    def perform_create(self, serializer):
        gasto = serializer.save()
        self._recalcular_monto(gasto)

    def perform_update(self, serializer):
        gasto = serializer.save()
        self._recalcular_monto(gasto)

    # -----------------------------------------------------------------
    # Sobreescribo update, ya que un gasto de materiales no cambia de tipo
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        """Impide cambiar el tipo de un gasto de materiales.

        Los materiales del gasto y el monto calculado son datos que
        dependen del tipo, y no hay forma de convertirlos en un monto
        cargado a mano sin inventarlo. El camino inverso sí se permite:
        un gasto de publicidad u otro puede pasar a materiales, porque ahí
        no hay nada que inventar, el monto pasa a 0 y se cargan los
        materiales.

        Cubre PUT y PATCH: DRF resuelve el PATCH llamando a update.
        """
        gasto = self.get_object()

        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        return super().update(request, *args, **kwargs)

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
    @materiales.mapping.post
    def registrar_material(self, request, pk=None):
        """CU56 - Registrar un material del gasto.

        En el cuerpo llegan 'material' (el id), 'cantidad' y
        'precio_unitario'. Los tres son obligatorios: el precio no se
        copia de ningún lado porque Material no tiene precio.

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
        gasto = self.get_object()

        if gasto.tipo != Gasto.Tipo.MATERIALES:
            return Response(
                {'detail': 'Solo un gasto de materiales lleva materiales del '
                           f'gasto. Este es de {gasto.get_tipo_display()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material_id = request.data.get('material')

        if not material_id:
            return Response(
                {'detail': 'Falta el id del material.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            material = Material.objects.get(pk=material_id)
        except (Material.DoesNotExist, ValueError, TypeError):
            return Response(
                {'detail': 'No existe un material con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Este chequeo es el que evita el IntegrityError crudo de la
        # UniqueConstraint (gasto, material). Sin él, PostgreSQL rechaza
        # la fila, Django levanta la excepción y el frontend recibe un 500
        # en vez de un mensaje que se pueda mostrar.
        #
        # Se arma la lista en Python sobre las filas que ya trajo el
        # prefetch, no con un .filter(): igual que en productos.
        materiales_cargados = [fila.material for fila in gasto.materiales.all()]

        if material in materiales_cargados:
            return Response(
                {'detail': f'El gasto ya tiene «{material.nombre}» entre sus '
                           f'materiales. Si compraste más, corregí la cantidad.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Se guarda con el serializer y no con .objects.create() porque
        # acá hay números que validar. Sin esto, una cantidad en 0 o un
        # precio en 0 los rechaza la CheckConstraint de PostgreSQL, Django
        # levanta un IntegrityError y el frontend recibe un 500 en vez de
        # un mensaje que se pueda mostrar.
        serializer = MaterialDelGastoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # El gasto no viene en el cuerpo: sale de la URL, y se lo pasamos
        # acá para que nadie pueda cargarle un material a otro gasto
        # mandándolo en el formulario.
        serializer.save(gasto=gasto)

        # create() escribió en la base, pero los materiales que trajo el
        # prefetch siguen cacheados en memoria, sin la fila recién
        # agregada. refresh_from_db() vacía esa caché, así la suma de abajo
        # y el serializer trabajan contra la base.
        gasto.refresh_from_db()

        self._recalcular_monto(gasto)

        return Response(self.get_serializer(gasto).data)

    @action(detail=True, methods=['patch'],
            url_path=r'materiales/(?P<material_del_gasto_id>\d+)')
    def modificar_material_del_gasto(self, request, pk=None,
                                     material_del_gasto_id=None):
        """CU58 - Modificar un material del gasto.

        Se pueden cambiar la cantidad y el precio unitario. El material
        no: para anotar otro material se quita esta fila y se agrega
        otra.
        """
        gasto = self.get_object()

        fila = self._buscar_material_del_gasto(gasto, material_del_gasto_id)

        if fila is None:
            return Response(
                {'detail': 'Ese material no pertenece a este gasto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # partial=True: es un PATCH, así que lo que no venga en el cuerpo
        # se deja como está. El serializer valida la cantidad y el precio
        # por lo mismo que en el alta.
        serializer = MaterialDelGastoModificarSerializer(
            fila,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

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
