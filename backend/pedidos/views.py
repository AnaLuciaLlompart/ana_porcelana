from datetime import timedelta
from decimal import Decimal

from django.db.models import Case, Exists, Max, OuterRef, Q, Value, When
from django.http import FileResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.response import Response

from clientes.models import Cliente
from config.exportar import Columna, ExportarMixin, describir_rango
from config.hijos import (
    error_de_fila, es_fila_nueva, fila_guardada, ids_que_vienen, leer_lista, leer_lista_si_vino,
)
from config.listados import leer_importe, ordenar
from config.paginacion import PaginacionDeListado
from inicio.views import DIAS_ENTREGAS_PROXIMAS
from productos.models import Producto

from .comprobante import generar_comprobante
from .models import Cobro, Pedido, ProductoDelPedido
from .presentacion import plata
from .serializers import (
    CobroSerializer,
    PedidoDetalleSerializer,
    PedidoListaSerializer,
    ProductoDelPedidoModificarSerializer,
    ProductoDelPedidoSerializer,
    ResumenDePedidosSerializer,
)

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


def _siguiente(opciones, actual):
    """El valor que sigue a actual en el orden de las opciones, o None si es el último.

    opciones es una clase TextChoices (Pedido.Estado o ProductoDelPedido.Estado):
    sus .values vienen en el orden en que están declaradas en el modelo, que es
    el orden en que avanzan.
    """
    valores = opciones.values
    posicion = valores.index(actual)

    if posicion + 1 == len(valores):
        return None

    return valores[posicion + 1]


def _revisar_estado(pedido, estado):
    """Devuelve el mensaje de error si el pedido no puede pasar a ese estado, o None.

    Son dos reglas, en este orden.

    La primera es el orden (corrección del tutor): el estado solo avanza de a
    uno, Pendiente → En producción → Listo → Entregado. No se saltea ni se
    vuelve atrás, y de Entregado no se sale.

    La segunda: un pedido no puede decir que está Listo ni Entregado
    mientras le queden piezas sin terminar. El estado del pedido y la etapa
    productiva de sus piezas son cosas independientes, pero en esta punta no
    pueden contradecirse: si falta pintar algo, el encargo no está listo
    para entregar. Pendiente y En producción no la revisan: son los estados
    de un pedido que todavía se está haciendo. Un pedido sin productos
    tampoco puede estar Listo, por el mismo motivo que no se le puede
    registrar un cobro: no hay nada que entregar.
    """
    siguiente = _siguiente(Pedido.Estado, pedido.estado)

    if estado != siguiente:
        actual = Pedido.Estado(pedido.estado).label

        if siguiente is None:
            return f'El pedido ya está {actual}: es el último estado.'

        return f'El pedido está {actual}: el próximo estado es {Pedido.Estado(siguiente).label}.'

    if estado not in (Pedido.Estado.LISTO, Pedido.Estado.ENTREGADO):
        return None

    # La etiqueta legible del estado, para que el mensaje diga "Listo" y no
    # LISTO. Es lo mismo que hace get_estado_display, pero acá el estado
    # todavía no está guardado en el pedido.
    etiqueta = Pedido.Estado(estado).label

    # list() sobre la lista que ya trajo el prefetch, no una consulta
    # nueva: es el mismo criterio de las propiedades del modelo. Se
    # materializa para poder contarla y recorrerla sin volver a la base.
    piezas = list(pedido.productos.all())

    if not piezas:
        return (
            f'No se puede marcar el pedido como {etiqueta}: '
            'todavía no tiene productos cargados.'
        )

    faltan = [
        linea
        for linea in piezas
        if linea.estado != ProductoDelPedido.Estado.TERMINADO
    ]

    if not faltan:
        return None

    # Tres redacciones porque un solo texto con números no se lee bien en
    # los tres casos: "1 de los 1 productos" no es castellano.
    if len(piezas) == 1:
        detalle = 'el producto del pedido todavía no está terminado'
    elif len(faltan) == 1:
        detalle = f'falta terminar 1 de los {len(piezas)} productos del pedido'
    else:
        detalle = (
            f'faltan terminar {len(faltan)} de los '
            f'{len(piezas)} productos del pedido'
        )

    return f'No se puede marcar el pedido como {etiqueta}: {detalle}.'


def _revisar_etapa(linea, etapa):
    """Devuelve el mensaje de error si la pieza no puede pasar a esa etapa, o None.

    La misma regla del orden que _revisar_estado (corrección del tutor): la
    etapa solo avanza de a una, Pendiente → Modelado → Secado →
    Pintura-Barniz → Terminado, sin saltear ni volver, y Terminado es la
    última. La etapa de una pieza no depende del estado del pedido.
    """
    if etapa not in ProductoDelPedido.Estado.values:
        return 'Esa no es una etapa válida para un producto del pedido.'

    siguiente = _siguiente(ProductoDelPedido.Estado, linea.estado)

    if etapa == siguiente:
        return None

    nombre = linea.producto.nombre
    actual = ProductoDelPedido.Estado(linea.estado).label

    if siguiente is None:
        return f'«{nombre}» ya está {actual}: es la última etapa.'

    return f'«{nombre}» está en {actual}: la próxima etapa es {ProductoDelPedido.Estado(siguiente).label}.'


def _revisar_productos_editables(pedido):
    """Devuelve el mensaje de error si los productos del pedido ya no se pueden cambiar, o None.

    Un pedido Listo o Entregado no admite agregar, quitar ni modificar sus
    productos (decisión de la usuaria con la corrección del tutor). Es lo
    que sostiene la regla de las piezas sin terminar sin que el sistema
    tenga que retroceder solo: antes, agregarle una pieza a un pedido Listo
    lo bajaba a En producción, y el estado ya no vuelve atrás.
    """
    if pedido.estado not in (Pedido.Estado.LISTO, Pedido.Estado.ENTREGADO):
        return None

    return (
        f'El pedido está {pedido.get_estado_display()}: sus productos ya no '
        'se pueden agregar, quitar ni modificar.'
    )


# ---------------------------------------------------------------------
# El listado filtrado, ordenado y paginado en la base (corrección D3)
# ---------------------------------------------------------------------

def condicion_de_entrega(entrega, hoy):
    """La condición de 'atrasados' o 'proximos', lista para un .filter() (CU41).

    Es la misma regla que usa inicio/views.py para las dos tarjetas de
    Inicio, escrita para la base: si cambia una, cambia la otra. Un pedido
    Entregado no está atrasado ni se va a entregar. Atrasado es el que
    tiene la fecha estimada antes de hoy; próximo, el que la tiene entre
    hoy y el último día de la ventana, los dos inclusive. Uno sin fecha
    estimada no cumple ninguna de las dos: en SQL, comparar NULL con una
    fecha nunca da verdadero.
    """
    sin_entregar = ~Q(estado=Pedido.Estado.ENTREGADO)

    if entrega == 'atrasados':
        return sin_entregar & Q(fecha_entrega_estimada__lt=hoy)

    ultimo_dia = hoy + timedelta(days=DIAS_ENTREGAS_PROXIMAS - 1)
    return sin_entregar & Q(fecha_entrega_estimada__gte=hoy, fecha_entrega_estimada__lte=ultimo_dia)


# Las columnas por las que se puede ordenar el listado: ?orden=total, o
# ?orden=-total para al revés. Cada una es la lista de criterios, en orden.
# Son los nombres de las anotaciones de con_totales() y de _filtrar(), y
# repiten lo que hacía la tabla en el navegador: ENTREGA manda los
# entregados al final y, dentro de cada grupo, los que no tienen fecha;
# ESTADO va en el orden del trabajo y no en el alfabético.
ORDENES = {
    'numero': ['id'],
    'cliente': ['cliente__instagram'],
    'contenido': ['cantidad_productos_calculada'],
    'entrega': ['entregado', 'fecha_entrega_estimada'],
    'estado': ['orden_estado'],
    'total': ['total_calculado'],
    'saldo': ['saldo_calculado'],
}


def _productos_para_exportar(pedido):
    """"2 × Aros de Luna, 1 × Dije", desde lo que ya trajo el prefetch."""
    return ', '.join(
        f'{linea.cantidad} × {linea.producto.nombre}' for linea in pedido.productos.all()
    )


# Las cuatro operaciones del CRUD no llevan docstring con su CU porque
# no están escritas acá: las hereda el ModelViewSet de DRF. La
# correspondencia es esta, para no tener que deducirla:
#
#   list      GET    /pedidos/       CU41 - buscar
#   create    POST   /pedidos/       CU40 - alta
#   update    PUT    /pedidos/{id}/  CU42 - modificar
#   destroy   DELETE /pedidos/{id}/  CU43 - borrar
#
# retrieve (GET /pedidos/{id}/) no implementa un CU propio: devuelve la
# ficha que CU42 usa para cargar el formulario.

class PedidoViewSet(ExportarMixin, viewsets.ModelViewSet):
    """CRUD de pedidos con sus productos, cobros y comprobante (CU40 a CU51 y CU60).

    Hereda IsAuthenticated de la configuración global de DRF, por lo que
    todos los endpoints exigen sesión activa.

    A diferencia de productos y materiales, acá no hay update()
    sobrescrito: Pedido no tiene baja lógica, así que no existe ningún
    estado que deje al registro de solo lectura. Es la misma situación
    que Cliente. Un pedido entregado se sigue pudiendo corregir.

    Además del CRUD expone cinco cosas:

    - cambiar_estado, que es parte de CU42
    - los productos del pedido, en /productos/ (CU44 a CU47)
    - los cobros del pedido, en /cobros/ (CU48 a CU51)
    - el comprobante de compra, en /comprobante/ (CU60)
    - el listado filtrado en PDF o Excel, en /exportar/ (corrección E10),
      que hereda de ExportarMixin
    """

    # Lo que necesita ExportarMixin. Los importes salen de las anotaciones
    # de con_totales(), las mismas que muestra el listado.
    EXPORTAR_TITULO = 'Pedidos'
    EXPORTAR_ARCHIVO = 'pedidos'
    EXPORTAR_UNIDAD = ('pedido', 'pedidos')
    COLUMNAS_PARA_EXPORTAR = [
        Columna('N.º', lambda p: p.id, 'numero', 5),
        Columna('Fecha', lambda p: p.fecha_pedido, 'fecha', 8),
        Columna('Cliente', lambda p: f'@{p.cliente.instagram}', 'texto', 13),
        Columna('Nombre', lambda p: f'{p.cliente.nombre} {p.cliente.apellido}'.strip(), 'texto', 11),
        Columna('Productos', _productos_para_exportar, 'texto', 20),
        Columna('Entrega estimada', lambda p: p.fecha_entrega_estimada, 'fecha', 11),
        Columna('Estado', lambda p: p.get_estado_display(), 'texto', 9),
        Columna('Total', lambda p: p.total_calculado, 'plata', 8),
        Columna('Cobrado', lambda p: p.cobrado_calculado, 'plata', 8),
        Columna('Saldo', lambda p: p.saldo_calculado, 'plata', 8),
    ]

    # El listado se pagina (corrección D3): una página por pedido, con los
    # filtros y el orden resueltos en la base por _filtrar(). Reemplaza al
    # SearchFilter y al OrderingFilter de DRF, que no sabían filtrar por
    # entrega, saldo ni total.
    pagination_class = PaginacionDeListado

    # -----------------------------------------------------------------
    # Dos serializers según la acción
    # -----------------------------------------------------------------

    def get_serializer_class(self):
        """El listado usa el serializer liviano; el resto, el completo."""
        if self.action == 'list':
            return PedidoListaSerializer

        return PedidoDetalleSerializer

    # -----------------------------------------------------------------
    # El prefetch también depende de la acción
    # -----------------------------------------------------------------

    def get_queryset(self):
        """Trae de una sola vez las relaciones que el serializer va a leer.

        select_related en las dos acciones, porque los dos serializers
        muestran el instagram y el nombre del cliente. Es select_related
        y no prefetch_related porque el cliente es una clave foránea:
        se resuelve con un JOIN en la misma consulta.

        Los productos van en las dos, y en las dos se llega hasta el
        producto de cada línea: el listado suma el total y muestra los
        nombres en la columna CONTENIDO. Los cobros también van en las
        dos: el listado los necesita para el saldo y la ficha además
        para mostrarlos.

        La ficha necesita una relación más, porque además dibuja las
        líneas una por una y para cada una mira si su producto tiene
        materiales cargados. El doble guión bajo de
        'productos__producto__materiales' es lo que le dice a Django que
        siga la relación un nivel más.
        """
        queryset = Pedido.objects.select_related('cliente')

        # Exportar trae lo mismo que el listado, con los mismos filtros.
        if self.action in ('list', 'exportar'):
            queryset = Pedido.objects.con_totales().select_related('cliente')
            return self._filtrar(queryset.prefetch_related('productos__producto', 'cobros'))

        return queryset.prefetch_related('productos__producto__materiales', 'cobros')

    def _filtrar(self, queryset):
        """Aplica al listado los filtros, la búsqueda y el orden de la URL (CU41).

        Antes el listado traía todos los pedidos y el navegador hacía todo
        esto; ahora lo hace la base y viaja solo la página que se mira
        (corrección D3). Los parámetros son los del modal de filtros y el
        buscador de la pantalla:

          busqueda=texto           número, instagram, nombre o apellido del
                                   cliente, o nombre de un producto
          cliente=id               uno solo
          estado=LISTO             se puede repetir: cualquiera de los elegidos
          entrega=atrasados        o proximos
          forma_entrega=RETIRO     se puede repetir: cualquiera de las elegidas
          saldo=pendiente          o al_dia; se puede repetir, y cada uno saca
                                   lo que no cumple, como en la pantalla
          total_desde, total_hasta los extremos del rango, inclusive
          orden=total              una clave de ORDENES; con '-', al revés

        Un valor que no se entiende responde 400 con un detail que dice
        cuál, en vez de ignorarlo en silencio: un filtro mal escrito que no
        filtra mostraría una lista que parece correcta y no lo es.
        """
        parametros = self.request.query_params

        texto = parametros.get('busqueda', '').strip()
        if texto:
            # Exists y no un filtro sobre productos__producto__nombre: con
            # un JOIN, un pedido con dos productos que coinciden saldría
            # dos veces.
            tiene_el_producto = Exists(
                ProductoDelPedido.objects.filter(
                    pedido=OuterRef('pk'),
                    producto__nombre__icontains=texto,
                )
            )
            condicion = (
                Q(cliente__instagram__icontains=texto)
                | Q(cliente__nombre__icontains=texto)
                | Q(cliente__apellido__icontains=texto)
                | Q(tiene_el_producto)
            )
            # "43" y "#43" encuentran el pedido 43.
            numero = texto.lstrip('#')
            if numero.isdigit():
                condicion |= Q(id=int(numero))
            queryset = queryset.filter(condicion)

        cliente = parametros.get('cliente')
        if cliente:
            if not cliente.isdigit():
                raise ParseError('El cliente tiene que ser un número.')
            queryset = queryset.filter(cliente_id=int(cliente))

        estados = parametros.getlist('estado')
        if estados:
            if any(estado not in Pedido.Estado.values for estado in estados):
                raise ParseError('Uno de los estados no existe.')
            queryset = queryset.filter(estado__in=estados)

        entrega = parametros.get('entrega')
        if entrega:
            if entrega not in ('atrasados', 'proximos'):
                raise ParseError('La entrega tiene que ser atrasados o proximos.')
            queryset = queryset.filter(condicion_de_entrega(entrega, timezone.localdate()))

        # La forma de entrega se puede repetir, como el estado: cualquiera de
        # las elegidas.
        formas = parametros.getlist('forma_entrega')
        if formas:
            if any(forma not in Pedido.FormaEntrega.values for forma in formas):
                raise ParseError('Una de las formas de entrega no existe.')
            queryset = queryset.filter(forma_entrega__in=formas)

        saldos = parametros.getlist('saldo')
        if any(saldo not in ('pendiente', 'al_dia') for saldo in saldos):
            raise ParseError('El saldo tiene que ser pendiente o al_dia.')
        # "Al día" incluye a los que pagaron de más, como esta_al_dia.
        if 'pendiente' in saldos:
            queryset = queryset.filter(saldo_calculado__gt=0)
        if 'al_dia' in saldos:
            queryset = queryset.filter(saldo_calculado__lte=0)

        total_desde = leer_importe(parametros, 'total_desde')
        if total_desde is not None:
            queryset = queryset.filter(total_calculado__gte=total_desde)

        total_hasta = leer_importe(parametros, 'total_hasta')
        if total_hasta is not None:
            queryset = queryset.filter(total_calculado__lte=total_hasta)

        # Las dos columnas que no son campos ni sumas: el grupo de los
        # entregados, para ENTREGA, y el número de cada estado, para ESTADO.
        queryset = queryset.annotate(
            entregado=Case(
                When(estado=Pedido.Estado.ENTREGADO, then=Value(1)),
                default=Value(0),
            ),
            orden_estado=Case(
                When(estado=Pedido.Estado.PENDIENTE, then=Value(0)),
                When(estado=Pedido.Estado.EN_PRODUCCION, then=Value(1)),
                When(estado=Pedido.Estado.LISTO, then=Value(2)),
                default=Value(3),
            ),
        )

        # Sin orden elegido queda el del modelo: los más nuevos primero.
        return ordenar(queryset, parametros, ORDENES, ['-fecha_pedido', '-id'])

    def describir_filtros(self, parametros):
        """Los filtros de _filtrar() en palabras, para el PDF y el Excel (corrección E10).

        Usa los mismos textos que los chips de la pantalla. No valida nada:
        exportar lo llama después de get_queryset(), que ya rechazó con 400
        cualquier valor que no se entienda.
        """
        filtros = []

        texto = parametros.get('busqueda', '').strip()
        if texto:
            filtros.append(f'Búsqueda: {texto}')

        cliente = parametros.get('cliente')
        if cliente:
            instagram = Cliente.objects.filter(id=cliente).values_list('instagram', flat=True).first()
            filtros.append(f'Cliente: @{instagram}' if instagram else f'Cliente: #{cliente}')

        estados = parametros.getlist('estado')
        if estados:
            filtros.append('Estado: ' + ', '.join(Pedido.Estado(estado).label for estado in estados))

        entrega = parametros.get('entrega')
        if entrega == 'atrasados':
            filtros.append('Entrega: atrasados')
        if entrega == 'proximos':
            filtros.append(f'Entrega: próximos {DIAS_ENTREGAS_PROXIMAS} días')

        formas = parametros.getlist('forma_entrega')
        if formas:
            filtros.append(
                'Forma de entrega: ' + ', '.join(Pedido.FormaEntrega(forma).label for forma in formas)
            )

        saldos = parametros.getlist('saldo')
        if 'pendiente' in saldos:
            filtros.append('Con saldo pendiente')
        if 'al_dia' in saldos:
            filtros.append('Saldo al día')

        rango = describir_rango(
            'Total', leer_importe(parametros, 'total_desde'), leer_importe(parametros, 'total_hasta'),
        )
        if rango:
            filtros.append(rango)

        return filtros

    # -----------------------------------------------------------------
    # El alta y el guardado de la ficha: el pedido y sus productos en un
    # solo pedido a la API
    # -----------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        """CU40 - Registrar un pedido, con sus productos, en un solo pedido a la API.

        Además de los datos del pedido, el cuerpo puede traer 'productos':
        una lista con lo mismo que recibe agregar_producto por fila
        ('producto', 'cantidad', 'precio', 'descripcion'). Todo se guarda en
        la misma transacción (ATOMIC_REQUESTS): si una fila falla, la
        respuesta es 400 con la clave 'productos' y el número de la fila, y
        no queda ni el pedido. Sin 'productos' es el alta de siempre.

        Corrección del tutor: antes el frontend creaba el pedido y después
        mandaba una fila por pedido, y un fallo a mitad dejaba un pedido a
        medias. Las reglas de cada fila siguen en _agregar_producto, la
        misma función que usa la acción de una fila. Las piezas nacen
        Pendientes, como el pedido: las etapas se avanzan después, de a una.
        """
        lineas = leer_lista(request.data, 'productos')

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()

        for numero, datos in enumerate(lineas, start=1):
            try:
                self._agregar_producto(pedido, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('productos', numero, self._nombre_del_producto(datos), error)

        return Response(self.get_serializer(pedido).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """CU42 - Modificar un pedido, con sus productos, en un solo pedido a la API.

        Además de los datos, el cuerpo puede traer 'productos': la lista
        COMPLETA de productos tal como quedó en la ficha, cada uno con lo
        mismo que recibe agregar_producto y, si ya estaba guardado, su 'id'.
        _sincronizar_productos la compara con lo guardado y quita, modifica
        y agrega lo que haga falta, en la misma transacción que los datos
        (ATOMIC_REQUESTS): si una fila falla, 400 con la clave 'productos' y
        el número de la fila, y el pedido queda como estaba. Sin 'productos'
        es el PUT de siempre, que no toca los productos. Cubre PUT y PATCH:
        DRF resuelve el PATCH llamando a update.

        Corrección del tutor: antes la ficha mandaba el PUT de los datos y
        después un pedido por producto quitado, modificado o agregado, y un
        fallo a mitad dejaba lo anterior guardado.

        La fila del pedido se bloquea antes, como en las acciones. Un pedido
        Listo o Entregado no acepta 'productos' (_revisar_productos_editables):
        su ficha no los manda, y el error sale con la clave 'productos' para
        que la pantalla lo muestre pegado a la tabla.
        """
        lineas = leer_lista_si_vino(request.data, 'productos')

        pedido = self.get_object()
        self._bloquear(pedido)

        if lineas is not None:
            error = _revisar_productos_editables(pedido)
            if error:
                raise ValidationError({'productos': [error]})

        serializer = self.get_serializer(pedido, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if lineas is not None:
            self._sincronizar_productos(pedido, lineas)

        return Response(self.get_serializer(pedido).data)

    def _sincronizar_productos(self, pedido, lineas):
        """Deja los productos del pedido como dice la lista completa que mandó la ficha.

        Se compara con lo guardado, con la fila del pedido ya bloqueada: la
        guardada cuyo id no viene se quita; la que viene con el id de una
        guardada se modifica con _modificar_producto, como el PATCH; la que
        no trae id, o trae el provisorio negativo del borrador, se agrega
        con _agregar_producto, y nace Pendiente. Un id que no es de este
        pedido responde 400, como las acciones. Un error en una fila sale
        con su número en la lista.

        La etapa no se cambia al guardar (corrección del tutor): se avanza de
        a una con su botón, por _avanzar_etapa. Una fila guardada que trae
        una etapa distinta de la suya responde 400, así quien la mandó se
        entera de que no se aplicó.
        """
        guardadas = {linea.pk: linea for linea in pedido.productos.all()}
        conservadas = ids_que_vienen(lineas)

        for linea_id, linea in guardadas.items():
            if linea_id not in conservadas:
                linea.delete()

        for numero, datos in enumerate(lineas, start=1):
            try:
                if es_fila_nueva(datos):
                    self._agregar_producto(pedido, datos)
                else:
                    guardada = fila_guardada(datos, guardadas)
                    if guardada is None:
                        raise ParseError('Ese producto no pertenece a este pedido.')
                    if 'estado' in datos and datos['estado'] != guardada.estado:
                        raise ParseError(
                            'La etapa no se cambia al guardar el pedido: '
                            'se avanza con su botón, de a una.'
                        )
                    self._modificar_producto(guardada, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('productos', numero, self._nombre_del_producto(datos), error)

    @staticmethod
    def _nombre_del_producto(datos):
        """El nombre del producto de una fila del alta, para el mensaje de error, o ''."""
        producto_id = datos.get('producto') if isinstance(datos, dict) else None

        if not isinstance(producto_id, int):
            return ''

        return Producto.objects.filter(pk=producto_id).values_list('nombre', flat=True).first() or ''

    # -----------------------------------------------------------------
    # Los números del encabezado del listado
    # -----------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Los números de arriba del listado de pedidos. Es parte de CU41.

        Antes la pantalla los contaba sobre la lista entera; con el
        listado paginado (corrección D3) ya no la tiene, así que los pide
        acá. Se cuentan sobre TODOS los pedidos y no sobre los filtrados:
        dicen cómo viene el trabajo, no qué se está mirando.

        - activos: los que no están Entregados
        - atrasados: con la misma regla que el filtro de entrega
        - con_saldo: los que deben algo
        - total_maximo: el total más alto, para el tope del deslizador del
          filtro por total

        Son cuatro consultas, siempre las mismas.
        """
        hoy = timezone.localdate()
        con_totales = Pedido.objects.con_totales()

        datos = {
            'activos': Pedido.objects.exclude(estado=Pedido.Estado.ENTREGADO).count(),
            'atrasados': Pedido.objects.filter(condicion_de_entrega('atrasados', hoy)).count(),
            'con_saldo': con_totales.filter(saldo_calculado__gt=0).count(),
            # Sin pedidos, Max devuelve None: el tope arranca en cero.
            'total_maximo': con_totales.aggregate(maximo=Max('total_calculado'))['maximo'] or Decimal('0'),
        }

        return Response(ResumenDePedidosSerializer(datos).data)

    # -----------------------------------------------------------------
    # El estado del pedido, que es parte de CU42
    # -----------------------------------------------------------------

    # -----------------------------------------------------------------
    # El candado de las reglas entre filas
    # -----------------------------------------------------------------

    def _bloquear(self, pedido):
        """Bloquea la fila del pedido hasta que termine la transacción.

        Las reglas de cobro y de estado miran varias filas a la vez (el
        total, lo cobrado, las piezas sin terminar) y después escriben. Dos
        pedidos al mismo tiempo las leerían las dos antes de que una
        escriba, y los dos pasarían: dos cobros que juntos superan el
        total, o un Listo y una pieza Pendiente agregada a la vez. Con
        select_for_update el segundo espera a que el primero confirme, y
        recién entonces lee.

        Se usa refresh_from_db y no una consulta aparte porque además
        vacía el prefetch que trajo get_object(): esos productos y cobros
        se leyeron ANTES del candado, y hay que volver a leerlos después.
        Pedido.objects, sin el select_related del queryset del ViewSet,
        para que el FOR UPDATE tome solo la fila del pedido y no la del
        cliente.
        """
        pedido.refresh_from_db(from_queryset=Pedido.objects.select_for_update())

    @action(detail=True, methods=['post'])
    def cambiar_estado(self, request, pk=None):
        """Cambiar el estado del pedido. Es parte de CU42 - Modificar pedido.

        No es un caso de uso propio, pero va como endpoint aparte por dos
        motivos. En la pantalla el estado se avanza solo, con efecto
        inmediato, sin pasar por el formulario ni por su botón de
        guardar. Y arrastra un efecto lateral que un PUT no tiene:
        completar la fecha de entrega real al entregar.

        El estado llega en el cuerpo, en la clave 'estado', y tiene que ser
        el siguiente del que tiene (_revisar_estado, corrección del tutor).
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        estado = request.data.get('estado')

        if not estado:
            return Response(
                {'detail': 'Falta el estado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # .values son los códigos que se guardan: 'PENDIENTE',
        # 'EN_PRODUCCION', 'LISTO', 'ENTREGADO'.
        if estado not in Pedido.Estado.values:
            return Response(
                {'detail': 'Ese no es un estado válido para un pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Las reglas de negocio van acá y no en el serializer, igual que las
        # de cobro: la de Listo mira varias filas a la vez —el pedido y todas
        # sus piezas—, que es lo que un serializer de una fila no puede ver.
        #
        # Este es el único lugar por donde se cambia el estado, porque el
        # campo es de solo lectura en el serializer. Por eso alcanza con
        # revisarlo una vez: el orden y las piezas sin terminar.
        error = _revisar_estado(pedido, estado)

        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        self._guardar_estado(pedido, estado)

        return Response(self.get_serializer(pedido).data)

    def _guardar_estado(self, pedido, estado):
        """Guarda el estado nuevo y, al entregar, la fecha de entrega real.

        La fecha no es un dato que se cargue: sale del estado, y la regla es
        que un pedido tiene fecha de entrega real si y solo si está
        Entregado. Al entrar a Entregado se escribe SIEMPRE con la fecha de
        hoy, aunque el campo ya tuviera una cargada: tocar el botón significa
        "lo entregué hoy", sin excepciones que haya que recordar.

        Antes también la borraba al salir de Entregado. Desde que el estado
        solo avanza (corrección del tutor), de Entregado no se sale, así que
        esa rama nunca cambiaba nada y se sacó.

        Guardar el estado pasa por acá y no por un save() suelto para que esa
        regla esté escrita una sola vez. Lo llaman cambiar_estado y
        cargar_datos_prueba.
        """
        pedido.estado = estado

        if estado == Pedido.Estado.ENTREGADO:
            pedido.fecha_entrega_real = timezone.localdate()

        pedido.save(update_fields=['estado', 'fecha_entrega_real'])

    # -----------------------------------------------------------------
    # Los productos del pedido (CU44 a CU47)
    # -----------------------------------------------------------------
    # Los productos de un pedido son una colección que cuelga de él, así
    # que las cuatro operaciones son las cuatro operaciones normales
    # sobre una colección, sobre la misma URL base:
    #
    #   GET    /api/pedidos/1/productos/     lista           (CU45)
    #   POST   /api/pedidos/1/productos/     agrega uno      (CU44)
    #   PATCH  /api/pedidos/1/productos/3/   lo modifica     (CU46)
    #   DELETE /api/pedidos/1/productos/3/   lo quita        (CU47)
    #
    # Es la misma forma que los materiales de un producto, y el id de la
    # ruta también es el de la LÍNEA (ProductoDelPedido), no el del
    # producto. Acá eso además es imprescindible: el mismo producto
    # puede figurar dos veces en el mismo pedido, así que su id no
    # alcanzaría para saber de cuál de las dos filas se habla.

    def _buscar_producto_del_pedido(self, pedido, linea_id):
        """Busca una línea ENTRE LAS DE ESTE PEDIDO, o devuelve None.

        Recorre pedido.productos, que get_object() ya trajo con el
        prefetch. Buscar dentro de esa lista, y no en
        ProductoDelPedido.objects, es lo que garantiza que la línea sea
        de este pedido: una línea ajena directamente no está en la
        lista. Sin eso, mandando un id cualquiera se podrían editar los
        productos de otro pedido.

        El \\d+ del url_path ya garantizó que linea_id sean dígitos, así
        que el int() no puede fallar.
        """
        for linea in pedido.productos.all():
            if linea.pk == int(linea_id):
                return linea

        return None

    @action(detail=True, methods=['get'], url_path='productos')
    def productos(self, request, pk=None):
        """CU45 - Listar los productos de un pedido.

        Devuelve las líneas con el nombre de cada producto y su etapa
        productiva, que es lo que dibuja la pestaña de productos de la
        ficha.
        """
        pedido = self.get_object()

        return Response(
            ProductoDelPedidoSerializer(
                pedido.productos.all(), many=True
            ).data
        )

    def _agregar_producto(self, pedido, datos):
        """Crea una fila de ProductoDelPedido con las reglas de CU44 y la devuelve.

        Es la única puerta para agregar una pieza a un pedido: la usan
        agregar_producto (una fila por pedido a la API) y create() (todas
        las filas del alta, en una transacción). Rechaza con ParseError y
        no con una respuesta: es lo que hace que la transacción revierta
        (ATOMIC_REQUESTS), y la respuesta es la misma, {'detail': …}.

        ACÁ SE CONGELA EL PRECIO: si datos no trae uno, se copia el
        precio_actual del producto. A partir de ese momento la línea
        conserva ese número, aunque el del catálogo cambie mañana.

        La pieza nace Pendiente: el campo es de solo lectura en el serializer
        de alta. Si datos trae otra etapa, responde 400 en vez de ignorarla
        en silencio (corrección del tutor: la etapa se avanza después, de a
        una, por _avanzar_etapa).
        """
        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(datos, dict):
            raise ParseError('El cuerpo tiene que ser un objeto JSON.')

        producto_id = datos.get('producto')

        if not producto_id:
            raise ParseError('Falta el id del producto.')

        try:
            producto = Producto.objects.get(pk=producto_id)
        except (Producto.DoesNotExist, ValueError, TypeError):
            raise ParseError('No existe un producto con ese id.')

        # Se copia el cuerpo para poder completarlo sin tocar el
        # original. request.data puede ser un QueryDict inmutable, y su
        # .copy() devuelve uno que sí se puede modificar.
        datos = datos.copy()

        # Se completa solo lo que NO vino: None o vacío. Un 0 sí vino (una
        # pieza regalada tiene precio 0, y una cantidad 0 la tiene que
        # rechazar el serializer), y `not 0` lo confundiría con ausente.
        if datos.get('precio') in (None, ''):
            datos['precio'] = producto.precio_actual

        if datos.get('cantidad') in (None, ''):
            datos['cantidad'] = 1

        if datos.get('estado') not in (None, '', ProductoDelPedido.Estado.PENDIENTE):
            raise ParseError('Una pieza nueva nace Pendiente: la etapa se avanza después, de a una.')

        # Se guarda con el serializer y no con .objects.create() porque
        # acá hay números que validar. Sin esto, una cantidad en 0 la
        # rechaza la CheckConstraint de PostgreSQL, Django levanta un
        # IntegrityError y el frontend recibe un 500 en vez de un
        # mensaje que se pueda mostrar.
        serializer = ProductoDelPedidoSerializer(data=datos)
        serializer.is_valid(raise_exception=True)

        # El pedido no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda agregarle un producto a otro
        # pedido mandándolo en el formulario.
        return serializer.save(pedido=pedido)

    # El mapping le dice al router: misma URL que 'productos', pero
    # cuando el método sea POST, ejecutá esta otra función. Así cada caso
    # de uso queda en su propio método, sin un if adentro.
    @productos.mapping.post
    def agregar_producto(self, request, pk=None):
        """CU44 - Agregar un producto al pedido.

        En el cuerpo llegan 'producto' (el id) y, opcionalmente,
        'cantidad', 'precio' y 'descripcion'. Las reglas, el precio
        congelado incluido, están en _agregar_producto, que comparte con el
        alta. Un pedido Listo o Entregado no acepta productos nuevos.

        No se rechaza un producto que ya figura en el pedido. A
        diferencia de los materiales de un producto, acá no hay
        restricción de unicidad: la misma pieza puede ir en dos filas si
        difieren en variante, precio o etapa productiva.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        error = _revisar_productos_editables(pedido)
        if error:
            raise ParseError(error)

        self._agregar_producto(pedido, request.data)

        # _bloquear vació el prefetch: la respuesta lee de la base y trae la
        # pieza recién agregada.
        return Response(self.get_serializer(pedido).data)

    def _modificar_producto(self, linea, datos):
        """Modifica una fila de ProductoDelPedido con las reglas de CU46 y la devuelve.

        Es la única puerta para modificar la cantidad, el precio o la
        descripción de una pieza: la usan modificar_producto_del_pedido (el
        PATCH de una fila) y _sincronizar_productos (el guardado de la
        ficha). La etapa no pasa por acá: ProductoDelPedidoModificarSerializer
        no la tiene entre sus campos, y se avanza por _avanzar_etapa.
        """
        # partial=True: es un PATCH, así que lo que no venga en el
        # cuerpo se deja como está. El serializer valida la cantidad y
        # el precio, por lo mismo que en el alta.
        serializer = ProductoDelPedidoModificarSerializer(
            linea,
            data=datos,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def _avanzar_etapa(self, linea, etapa):
        """Pasa la pieza a la etapa siguiente y anota desde cuándo está ahí. Es parte de CU46.

        Es la única puerta a la etapa de una pieza (corrección del tutor): la
        usan el PATCH de modificar_producto_del_pedido y cargar_datos_prueba.
        La regla del orden está en _revisar_etapa; si no se cumple, lanza
        ParseError y la transacción revierte.

        La fecha dice desde cuándo la pieza está en esta etapa: es lo que
        muestra el "desde" de Inicio y de la ficha.
        """
        error = _revisar_etapa(linea, etapa)

        if error:
            raise ParseError(error)

        linea.estado = etapa
        linea.fecha_cambio_estado = timezone.localdate()
        linea.save(update_fields=['estado', 'fecha_cambio_estado'])

        return linea

    @action(detail=True, methods=['patch'],
            url_path=r'productos/(?P<linea_id>\d+)')
    def modificar_producto_del_pedido(self, request, pk=None, linea_id=None):
        """CU46 - Modificar un producto del pedido.

        Se pueden cambiar la cantidad, el precio y la descripción, por
        _modificar_producto, que comparte con el guardado de la ficha, y
        avanzar la etapa productiva, por _avanzar_etapa: si viene 'estado',
        tiene que ser la etapa siguiente. Inicio y la ficha mandan solo la
        etapa. El producto no se cambia: para encargar otra pieza se quita
        esta línea y se agrega otra. Un pedido Listo o Entregado no acepta
        cambios en sus productos.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        error = _revisar_productos_editables(pedido)
        if error:
            raise ParseError(error)

        linea = self._buscar_producto_del_pedido(pedido, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Ese producto no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(request.data, dict):
            raise ParseError('El cuerpo tiene que ser un objeto JSON.')

        cambios = {
            campo: request.data[campo]
            for campo in ('cantidad', 'precio', 'descripcion')
            if campo in request.data
        }

        if cambios:
            self._modificar_producto(linea, cambios)

        if 'estado' in request.data:
            self._avanzar_etapa(linea, request.data['estado'])

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @modificar_producto_del_pedido.mapping.delete
    def quitar_producto_del_pedido(self, request, pk=None, linea_id=None):
        """CU47 - Quitar un producto del pedido.

        Borra la línea, no el producto: el producto sigue existiendo en
        el catálogo y puede estar en otros pedidos. Es lo que protege el
        PROTECT de la clave foránea. Un pedido Listo o Entregado no acepta
        que se le quiten productos.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        error = _revisar_productos_editables(pedido)
        if error:
            raise ParseError(error)

        linea = self._buscar_producto_del_pedido(pedido, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Ese producto no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea.delete()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)



    # -----------------------------------------------------------------
    # Los cobros del pedido (CU48 a CU51)
    # -----------------------------------------------------------------
    # Misma forma que los productos del pedido: una colección que cuelga
    # del pedido, con las cuatro operaciones sobre la misma URL base.
    #
    #   GET    /api/pedidos/1/cobros/     lista        (CU49)
    #   POST   /api/pedidos/1/cobros/     registra     (CU48)
    #   PATCH  /api/pedidos/1/cobros/3/   lo modifica  (CU50)
    #   DELETE /api/pedidos/1/cobros/3/   lo borra     (CU51)

    def _revisar_cobro(self, pedido, tipo, monto, cobro=None):
        """Devuelve el mensaje de error si el cobro no se puede hacer, o None.

        Son dos reglas.

        La primera es que no se puede cobrar más que el total del
        pedido: el saldo a favor no es un estado válido.

        La segunda es que una SEÑA no puede dejar el pedido saldado. La
        seña es un adelanto, así que por definición queda algo por
        cobrar; el cobro que termina de pagar el pedido es el pago
        restante o el pago completo. Sin esta regla, dos o tres señas
        podrían sumar el total y el pedido quedaría pagado sin que
        ningún cobro diga que fue el último.

        Cuando se está MODIFICANDO un cobro hay que sacarlo de la
        cuenta, porque su monto viejo ya está sumado en pedido.cobrado.
        Sin eso, corregir un cobro de 10.000 a 9.000 en un pedido de
        10.000 se rechazaría a sí mismo.

        Bajar el total de un pedido ya cobrado sí se permite, así que el
        saldo todavía puede quedar negativo por ese camino: la pantalla
        lo sigue mostrando con su chip. Lo que estas reglas impiden es
        llegar ahí cobrando.
        """
        # Sobre la lista que ya trajo el prefetch, como en _revisar_estado:
        # lo que no se puede cobrar es un pedido SIN productos, no uno cuyo
        # total dé cero (un envío cargado sin piezas, o piezas a precio 0).
        if not list(pedido.productos.all()):
            return (
                'El pedido todavía no tiene productos cargados, '
                'así que no hay nada que cobrar.'
            )

        disponible = pedido.total - pedido.cobrado

        if cobro is not None:
            disponible += cobro.monto

        if monto > disponible:
            if disponible <= 0:
                return 'Este pedido ya está cobrado por completo.'

            return (
                f'No se puede cobrar {plata(monto)}: el pedido es de '
                f'{plata(pedido.total)} y falta cobrar {plata(disponible)}.'
            )

        # Si el monto es exactamente lo que falta, este cobro salda el
        # pedido, y entonces no puede ser una seña.
        if tipo == Cobro.Tipo.SENA and monto == disponible:
            return (
                'Una seña no puede dejar el pedido saldado, porque es un '
                'adelanto. Si con este cobro te termina de pagar, '
                'registralo como «Pago restante».'
            )

        return None

    def _buscar_cobro(self, pedido, cobro_id):
        """Busca un cobro ENTRE LOS DE ESTE PEDIDO, o devuelve None.

        Recorre pedido.cobros, que get_object() ya trajo con el prefetch.
        Buscar dentro de esa lista, y no en Cobro.objects, es lo que
        garantiza que el cobro sea de este pedido: uno ajeno
        directamente no está en la lista. Sin eso, mandando un id
        cualquiera se podrían tocar los cobros de otro pedido.

        El patrón del url_path ya garantizó que cobro_id sean dígitos, así
        que el int() no puede fallar.
        """
        for cobro in pedido.cobros.all():
            if cobro.pk == int(cobro_id):
                return cobro

        return None

    @action(detail=True, methods=['get'], url_path='cobros')
    def cobros(self, request, pk=None):
        """CU49 - Listar los cobros de un pedido.

        Vienen del más reciente al más viejo, que es el ordering del
        modelo y el orden en que los muestra la pestaña.
        """
        pedido = self.get_object()

        return Response(
            CobroSerializer(pedido.cobros.all(), many=True).data
        )

    @cobros.mapping.post
    def registrar_cobro(self, request, pk=None):
        """CU48 - Registrar un cobro del pedido.

        En el cuerpo llegan 'monto' y, opcionalmente, 'tipo', 'fecha' y
        'medio', que tienen valor por defecto en el modelo.

        Del cobro se validan tres cosas: que el monto sea mayor a cero,
        de lo que se encarga el serializer, que no haga pasar la suma
        del total del pedido, y que una seña no lo deje saldado. Las dos
        últimas se revisan acá.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        # Se guarda con el serializer y no con .objects.create() porque
        # hay un número que validar: sin esto, un monto en cero lo
        # rechaza la CheckConstraint de PostgreSQL y el frontend recibe
        # un 500 en vez de un mensaje que se pueda mostrar.
        serializer = CobroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datos = serializer.validated_data
        # Sin 'tipo' en el cuerpo, DRF no lo pone en validated_data (el
        # campo tiene default en el modelo): la regla se revisa con ese
        # mismo default, Seña, que es lo que después guarda el serializer.
        tipo = datos.get('tipo', Cobro.Tipo.SENA)
        error = self._revisar_cobro(pedido, tipo, datos['monto'])

        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        # El pedido no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda registrarle un cobro a otro
        # pedido mandándolo en el formulario.
        serializer.save(pedido=pedido)

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @action(detail=True, methods=['patch'],
            url_path=r'cobros/(?P<cobro_id>\d+)')
    def modificar_cobro(self, request, pk=None, cobro_id=None):
        """CU50 - Modificar un cobro del pedido.

        Se pueden corregir el tipo, el monto, la fecha y el medio: un
        cobro mal anotado se arregla, no se borra y se vuelve a cargar.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        cobro = self._buscar_cobro(pedido, cobro_id)

        if cobro is None:
            return Response(
                {'detail': 'Ese cobro no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # partial=True: es un PATCH, así que lo que no venga en el cuerpo
        # se deja como está. El serializer valida el monto por lo mismo
        # que en el alta.
        serializer = CobroSerializer(cobro, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Es un PATCH: lo que no venga queda como estaba.
        datos = serializer.validated_data

        # Las reglas entre filas se revisan solo si cambia el monto o el
        # tipo: corregir la fecha o el medio no mueve el saldo. Sin esta
        # condición, un pedido con saldo a favor (el total bajó después de
        # cobrar) rechazaría hasta cambiarle la fecha a un cobro.
        if 'monto' in datos or 'tipo' in datos:
            error = self._revisar_cobro(
                pedido,
                datos.get('tipo', cobro.tipo),
                datos.get('monto', cobro.monto),
                cobro=cobro,
            )

            if error:
                return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @modificar_cobro.mapping.delete
    def borrar_cobro(self, request, pk=None, cobro_id=None):
        """CU51 - Borrar un cobro del pedido.

        Se usa cuando el cobro se anotó por error. El pedido queda con
        el saldo que tenía antes de registrarlo.
        """
        pedido = self.get_object()
        self._bloquear(pedido)

        cobro = self._buscar_cobro(pedido, cobro_id)

        if cobro is None:
            return Response(
                {'detail': 'Ese cobro no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cobro.delete()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    # -----------------------------------------------------------------
    # El comprobante de compra (CU60)
    # -----------------------------------------------------------------
    # Va con GET y no con POST, a diferencia de cambiar_estado: es una
    # lectura, no cambia nada del pedido. Es el mismo caso que las
    # acciones 'productos' y 'cobros' de más arriba.
    #
    #   GET    /api/pedidos/1/comprobante/     devuelve el PDF

    @action(detail=True, methods=['get'])
    def comprobante(self, request, pk=None):
        """CU60 - Generar comprobante de compra del pedido.

        Devuelve un PDF para que la emprendedora lo abra, lo guarde y se
        lo mande al cliente ella misma: el sistema no envía mails.

        Acá solo se revisa que el pedido tenga productos y se arma la
        respuesta. El dibujo del PDF está en comprobante.py.

        Un pedido sin productos no genera comprobante, por el mismo
        motivo por el que no se le puede registrar un cobro: todavía no
        hay nada que comprobar.
        """
        # get_object() y no Pedido.objects.get(): pasa por get_queryset,
        # que trae de una sola vez el cliente, los productos y los
        # cobros, y además respeta los permisos del ViewSet.
        pedido = self.get_object()

        # list() sobre lo que ya trajo el prefetch, igual que en
        # _revisar_estado: una lista vacía es falsa, así que el if entra
        # cuando el pedido no tiene ningún producto.
        if not list(pedido.productos.all()):
            return Response(
                {'detail': (
                    'El pedido todavía no tiene productos cargados, '
                    'así que no hay nada que poner en el comprobante.'
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # FileResponse es la respuesta de Django para mandar archivos.
        # as_attachment=False hace que escriba la cabecera
        # 'Content-Disposition: inline', que le pide al navegador que lo
        # muestre en la pestaña en vez de descargarlo. El filename es el
        # nombre que propone si la usuaria después elige guardarlo, y de
        # su extensión .pdf sale el tipo 'application/pdf'.
        #
        # No es un Response de DRF porque ese convierte los datos a JSON,
        # y acá lo que viaja ya es un archivo armado.
        return FileResponse(
            generar_comprobante(pedido),
            as_attachment=False,
            filename=f'comprobante-pedido-{pedido.id}.pdf',
        )

    #   GET    /api/pedidos/1/cobros/3/comprobante/   el PDF de ese pago

    @action(detail=True, methods=['get'],
            url_path=r'cobros/(?P<cobro_id>\d+)/comprobante')
    def comprobante_de_cobro(self, request, pk=None, cobro_id=None):
        """CU60 - Generar el comprobante de pago de un cobro.

        Es el recibo de ese pago: el pedido, este pago destacado, los
        anteriores y cómo quedó el saldo. Uno por cobro, así queda el
        historial de cada pago.

        No revisa que el pedido tenga productos: un cobro solo se puede
        registrar si los tiene (_revisar_cobro).
        """
        pedido = self.get_object()

        cobro = self._buscar_cobro(pedido, cobro_id)

        if cobro is None:
            return Response(
                {'detail': 'Ese cobro no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return FileResponse(
            generar_comprobante(pedido, cobro),
            as_attachment=False,
            filename=f'comprobante-pedido-{pedido.id}-cobro-{cobro.id}.pdf',
        )
