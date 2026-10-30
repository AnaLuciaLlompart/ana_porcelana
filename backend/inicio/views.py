from datetime import timedelta
from decimal import Decimal

from django.db.models import Case, Count, F, Sum, Value, When
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import ParseError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from materiales.models import Material
from pedidos.models import Pedido, ProductoDelPedido

from .serializers import (
    MaterialPorReponerSerializer,
    PedidoPorEntregarSerializer,
    ProductoDelPedidoEnProduccionSerializer,
    ResumenDeHoySerializer,
)

# Cuántos días abarca la tarjeta de entregas próximas, contando hoy: de
# hoy a hoy + 6.
DIAS_ENTREGAS_PROXIMAS = 3

# Hasta cuántos elementos muestra cada lista de la pantalla. El resto se
# ve en el listado de cada módulo, adonde lleva el enlace "Ver todos".

# El orden de la tabla EN PRODUCCIÓN: de la etapa más avanzada a la que
# recién empieza. Terminado no está porque esas piezas ya no se muestran.
ORDEN_ETAPAS = [
    ProductoDelPedido.Estado.PINTURA_BARNIZ,
    ProductoDelPedido.Estado.SECADO,
    ProductoDelPedido.Estado.MODELADO,
    ProductoDelPedido.Estado.PENDIENTE,
]


# ---------------------------------------------------------------------
# Las tres listas de la pantalla
# ---------------------------------------------------------------------
# Cada una es una función que devuelve la consulta ya ordenada, sin
# ejecutarla: la usan el resumen, que solo las cuenta, y los tres
# endpoints paginados, que traen una página (corrección D3: la pantalla
# trae solo lo que muestra).


def pedidos_sin_entregar():
    """Los pedidos de la tabla de próximas entregas, del más urgente al menos.

    Con su saldo calculado por la base (con_totales()), que es el que
    muestra el chip de la fila.
    """
    # El orden es el de la tabla de próximas entregas: por fecha estimada
    # ascendente, con los pedidos sin fecha al final (nulls_last) y el id
    # para desempatar. order_by reemplaza el ordering del modelo.
    return (
        Pedido.objects.con_totales()
        .exclude(estado=Pedido.Estado.ENTREGADO)
        .select_related('cliente')
        .order_by(F('fecha_entrega_estimada').asc(nulls_last=True), 'id')
    )


def piezas_sin_terminar():
    """Los productos del pedido que siguen en el taller, sin ordenar."""
    # Las piezas que todavía no están terminadas. El segundo exclude no
    # hace falta por la API, porque PedidoViewSet no deja entregar un
    # pedido con piezas sin terminar, pero el admin de Django sí deja
    # cambiar el estado a mano, y esta consulta no depende de una regla
    # que vive en otro módulo: la condición completa está escrita acá.
    # Los pedidos Listos no se excluyen: si les quedó una pieza sin
    # terminar, esa pieza sigue en el taller.
    return (
        ProductoDelPedido.objects
        .exclude(estado=ProductoDelPedido.Estado.TERMINADO)
        .exclude(pedido__estado=Pedido.Estado.ENTREGADO)
    )


def piezas_en_produccion():
    """Las piezas de la tabla PRODUCTOS EN ELABORACIÓN, en el orden de la tabla.

    El orden es el de ORDEN_ETAPAS, de la más avanzada a la que recién
    empieza: no es el alfabético ni el de los choices, así que se escribe
    con Case/When, un número por etapa. Antes se ordenaba en Python, pero
    para traer una página la base tiene que saber el orden. A igual etapa
    va primero la pieza que más tiempo lleva en ella; el id desempata.
    """
    # select_related('producto') porque el serializer lee su nombre, y
    # prefetch de sus materiales porque mira si tiene alguno: una consulta
    # para todas las filas y no una por fila.
    return (
        piezas_sin_terminar()
        .select_related('producto')
        .prefetch_related('producto__materiales')
        .annotate(orden_etapa=Case(
            *[When(estado=etapa, then=Value(numero)) for numero, etapa in enumerate(ORDEN_ETAPAS)],
            default=Value(len(ORDEN_ETAPAS)),
        ))
        .order_by('orden_etapa', 'fecha_cambio_estado', 'id')
    )


def materiales_en_baja():
    """Los materiales por reponer: los activos en disponibilidad Baja, por nombre."""
    # Los activos en disponibilidad Baja. Los discontinuados no se
    # reponen. Vienen por nombre por el ordering del modelo.
    return Material.objects.filter(
        estado=Material.Estado.ACTIVO,
        disponibilidad=Material.Disponibilidad.BAJA,
    )


@api_view(['GET'])
def resumen_de_hoy(request):
    """El resumen del día para la pantalla de Inicio.

    No implementa un caso de uso de la tesis: resume datos de los
    módulos que ya existen. Un solo endpoint, GET /api/inicio/, sin
    parámetros, que devuelve en un pedido todo lo que la pantalla
    necesita: los cuatro números de arriba y las tres listas.

    Es una función con @api_view y no un ViewSet porque no es un CRUD
    sobre un modelo, igual que finanzas. Hereda IsAuthenticated de la
    configuración global de DRF, así que exige sesión activa.

    Son cinco consultas, siempre las mismas: tres para los pedidos (los
    pedidos, sus productos y sus cobros), una para los productos del
    pedido en producción y una para los materiales.
    """
    # La fecha en la zona horaria del proyecto, no la del servidor ni la
    # del navegador. Es la misma función que usan los defaults de los
    # modelos y cambiar_estado, así que "hoy" significa lo mismo en
    # todos lados. Viaja en la respuesta para que el frontend cuente los
    # días con el mismo hoy con el que se contó acá.
    hoy = timezone.localdate()

    # -----------------------------------------------------------------
    # Los pedidos
    # -----------------------------------------------------------------
    # Se traen TODOS una sola vez, con sus productos y sus cobros, y de
    # esta lista sale todo lo que la pantalla dice de pedidos.
    #
    # Es prefetch_related y no annotate(Sum) por el saldo. El saldo sale
    # de dos relaciones distintas, los productos y los cobros; si se
    # sumaran las dos en la misma consulta, el JOIN repetiría cada
    # producto una vez por cobro y al revés, y los totales saldrían
    # multiplicados. prefetch_related hace una consulta por relación
    # (WHERE pedido_id IN ...) y las une en memoria, así cada fila se
    # cuenta una sola vez. Y la cuenta la hace Pedido.saldo, que es la
    # única definición de saldo del proyecto: el número de acá es el
    # mismo que la columna SALDO del listado de Pedidos.
    #
    # No llega a 'productos__producto' como el listado: esta lista no
    # muestra nombres de productos, y el subtotal de cada línea solo usa
    # su precio y su cantidad.
    #
    # El orden es el de la tabla de próximas entregas: por fecha estimada
    # ascendente, con los pedidos sin fecha al final (nulls_last) y el id
    # para desempatar. order_by reemplaza el ordering del modelo.
    con_totales = Pedido.objects.con_totales()

    # Un pedido Entregado no está atrasado ni se va a entregar: queda
    # afuera de todo lo que sigue, salvo de la deuda.
    sin_entregar = list(pedidos_sin_entregar())

    # Los que tienen fecha estimada y ya pasó. El "is not None" va
    # explícito porque None no se puede comparar con una fecha, y un
    # pedido sin fecha no está atrasado.
    atrasados = [
        pedido for pedido in sin_entregar
        if pedido.fecha_entrega_estimada is not None
        and pedido.fecha_entrega_estimada < hoy
    ]

    # Los que se entregan entre hoy y hoy + 6, los dos inclusive.
    ultimo_dia = hoy + timedelta(days=DIAS_ENTREGAS_PROXIMAS - 1)
    proximos = [
        pedido for pedido in sin_entregar
        if pedido.fecha_entrega_estimada is not None
        and hoy <= pedido.fecha_entrega_estimada <= ultimo_dia
    ]

    # Solo los saldos positivos, sobre TODOS los pedidos: un Entregado
    # sin terminar de cobrar sigue siendo plata que le deben, y un saldo
    # a favor no compensa lo que debe otro cliente. La semilla
    # Decimal('0') es por lo mismo que en Pedido.subtotal: sin pedidos
    # con saldo, sum() devolvería el entero 0.
    deuda = (
        con_totales.filter(saldo_calculado__gt=0)
        .aggregate(suma=Sum('saldo_calculado'))['suma']
        or Decimal('0')
    )

    # -----------------------------------------------------------------
    # Las piezas en el taller, contadas por etapa
    # -----------------------------------------------------------------
    # Son los números de los chips de etapa de la tabla. Las filas las
    # trae aparte el endpoint paginado. Las etapas sin piezas no vienen
    # del GROUP BY, así que se completan con cero.
    por_etapa = {etapa: 0 for etapa in ORDEN_ETAPAS}
    for fila in piezas_sin_terminar().order_by().values('estado').annotate(cuenta=Count('id')):
        por_etapa[fila['estado']] = fila['cuenta']

    # -----------------------------------------------------------------
    # La respuesta
    # -----------------------------------------------------------------
    # Solo los números: cada lista trae sus filas por su cuenta, de a una
    # página (corrección D3). Los totales de cada lista son los del enlace
    # "Ver todos" y los de los pies de página.
    datos = {
        'hoy': hoy,
        'totales': {
            'pedidos_atrasados': len(atrasados),
            'entregas_proximas': len(proximos),
            'materiales_por_reponer': materiales_en_baja().count(),
            'deuda': deuda,
        },
        'proximas_entregas': {
            'total': len(sin_entregar),
        },
        'en_produccion': {
            'total': sum(por_etapa.values()),
            'por_etapa': por_etapa,
        },
    }

    return Response(ResumenDeHoySerializer(datos).data)


# ---------------------------------------------------------------------
# Las tres listas, de a una página
# ---------------------------------------------------------------------

class PaginacionDeInicio(PageNumberPagination):
    """De a 8 filas, siempre, sin elegir cuántas: los paneles de Inicio no tienen el selector de filas.

    A diferencia de la de los listados, pagina aunque no venga ?pagina=:
    estos endpoints existen para traer una página. Una página que no
    existe responde 404, como en los listados.
    """

    page_size = 8
    page_query_param = 'pagina'


class PaginacionDeMateriales(PaginacionDeInicio):
    """Materiales por reponer, de a 6: el panel es más angosto y va al lado de las entregas."""

    page_size = 6


def una_pagina(request, queryset, serializer_class, paginacion_class=PaginacionDeInicio):
    """Trae la página pedida de la consulta y la devuelve como { count, next, previous, results }."""
    paginador = paginacion_class()
    filas = paginador.paginate_queryset(queryset, request)
    return paginador.get_paginated_response(serializer_class(filas, many=True).data)


@api_view(['GET'])
def en_produccion(request):
    """Una página de la tabla PRODUCTOS EN ELABORACIÓN de Inicio.

    GET /api/inicio/en_produccion/?pagina=2&etapa=SECADO. Con ?etapa= solo
    las piezas de esa etapa: es el filtro de los chips. Como el resumen, no
    implementa un caso de uso: muestra datos de Pedidos.
    """
    queryset = piezas_en_produccion()

    etapa = request.query_params.get('etapa')
    if etapa:
        if etapa not in ORDEN_ETAPAS:
            raise ParseError('Esa etapa no existe o ya está terminada.')
        queryset = queryset.filter(estado=etapa)

    return una_pagina(request, queryset, ProductoDelPedidoEnProduccionSerializer)


@api_view(['GET'])
def entregas(request):
    """Una página de la tabla PRÓXIMAS ENTREGAS de Inicio: GET /api/inicio/entregas/?pagina=2."""
    return una_pagina(request, pedidos_sin_entregar(), PedidoPorEntregarSerializer)


@api_view(['GET'])
def materiales(request):
    """Una página de MATERIALES POR REPONER de Inicio: GET /api/inicio/materiales/?pagina=2."""
    return una_pagina(request, materiales_en_baja(), MaterialPorReponerSerializer, PaginacionDeMateriales)
