from datetime import timedelta
from decimal import Decimal

from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from materiales.models import Material
from pedidos.models import Pedido, ProductoDelPedido

from .serializers import ResumenDeHoySerializer

# Cuántos días abarca la tarjeta de entregas próximas, contando hoy: de
# hoy a hoy + 6.
DIAS_ENTREGAS_PROXIMAS = 7

# Hasta cuántos elementos muestra cada lista de la pantalla. El resto se
# ve en el listado de cada módulo, adonde lleva el enlace "Ver todos".
MAXIMO_ENTREGAS = 8
MAXIMO_EN_PRODUCCION = 8
MAXIMO_MATERIALES = 6

# El orden de la tabla EN PRODUCCIÓN: de la etapa más avanzada a la que
# recién empieza. Terminado no está porque esas piezas ya no se muestran.
ORDEN_ETAPAS = [
    ProductoDelPedido.Estado.PINTURA_BARNIZ,
    ProductoDelPedido.Estado.SECADO,
    ProductoDelPedido.Estado.MODELADO,
    ProductoDelPedido.Estado.PENDIENTE,
]


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
    pedidos = list(
        Pedido.objects
        .select_related('cliente')
        .prefetch_related('productos', 'cobros')
        .order_by(F('fecha_entrega_estimada').asc(nulls_last=True), 'id')
    )

    # Un pedido Entregado no está atrasado ni se va a entregar: queda
    # afuera de todo lo que sigue, salvo de la deuda.
    sin_entregar = [
        pedido for pedido in pedidos
        if pedido.estado != Pedido.Estado.ENTREGADO
    ]

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
    deuda = sum(
        (pedido.saldo for pedido in pedidos if pedido.saldo > 0),
        Decimal('0'),
    )

    # -----------------------------------------------------------------
    # Los productos del pedido en producción
    # -----------------------------------------------------------------
    # Las piezas que todavía no están terminadas. El segundo exclude no
    # hace falta por la API, porque PedidoViewSet no deja entregar un
    # pedido con piezas sin terminar, pero el admin de Django sí deja
    # cambiar el estado a mano, y esta consulta no depende de una regla
    # que vive en otro módulo: la condición completa está escrita acá.
    # Los pedidos Listos no se excluyen: si les quedó una pieza sin
    # terminar, esa pieza sigue en el taller.
    #
    # select_related('producto') porque el serializer lee su nombre.
    en_produccion = list(
        ProductoDelPedido.objects
        .exclude(estado=ProductoDelPedido.Estado.TERMINADO)
        .exclude(pedido__estado=Pedido.Estado.ENTREGADO)
        .select_related('producto')
    )

    # Se ordena en Python y no en la base porque el orden no es el
    # alfabético ni el de los choices: es el de ORDEN_ETAPAS, y en SQL
    # habría que escribirlo con Case/When. A igual etapa va primero la
    # pieza que más tiempo lleva en ella; el id desempata.
    en_produccion.sort(
        key=lambda linea: (
            ORDEN_ETAPAS.index(linea.estado),
            linea.fecha_cambio_estado,
            linea.id,
        )
    )

    # -----------------------------------------------------------------
    # Los materiales por reponer
    # -----------------------------------------------------------------
    # Los activos en disponibilidad Baja. Los discontinuados no se
    # reponen. Vienen por nombre por el ordering del modelo.
    por_reponer = list(
        Material.objects.filter(
            estado=Material.Estado.ACTIVO,
            disponibilidad=Material.Disponibilidad.BAJA,
        )
    )

    # -----------------------------------------------------------------
    # La respuesta
    # -----------------------------------------------------------------
    # Cada lista lleva su total, que es cuántos hay en la base, y los
    # primeros N. El total es para el enlace "Ver todos"; el recorte es
    # sobre la lista ya ordenada, así los N que viajan son los primeros.
    datos = {
        'hoy': hoy,
        'totales': {
            'pedidos_atrasados': len(atrasados),
            'entregas_proximas': len(proximos),
            'materiales_por_reponer': len(por_reponer),
            'deuda': deuda,
        },
        'proximas_entregas': {
            'total': len(sin_entregar),
            'pedidos': sin_entregar[:MAXIMO_ENTREGAS],
        },
        'en_produccion': {
            'total': len(en_produccion),
            'productos': en_produccion[:MAXIMO_EN_PRODUCCION],
        },
        'materiales_por_reponer': {
            'total': len(por_reponer),
            'materiales': por_reponer[:MAXIMO_MATERIALES],
        },
    }

    return Response(ResumenDeHoySerializer(datos).data)
