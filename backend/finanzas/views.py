import calendar
from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from gastos.models import Gasto
from pedidos.models import Cobro

from .serializers import FinanzasDelPeriodoSerializer

# Cuántos meses tiene el gráfico de evolución si el pedido no
# lo dice, y entre qué valores se acepta. El número lo manda el frontend
# según el chip elegido (3, 6 o 12); el tope de 24 es para que nadie pida
# una serie de años por error.
MESES_POR_DEFECTO = 6
MESES_MINIMO = 1
MESES_MAXIMO = 24



def _leer_fecha(texto, nombre):
    """Devuelve (fecha, None) si el parámetro es una fecha válida, o (None, mensaje) si no.

    nombre es 'desde' o 'hasta', y solo sirve para armar el mensaje.
    date.fromisoformat lee el formato AAAA-MM-DD, que es el que manda el
    input type="date" del navegador, y falla con ValueError ante
    cualquier otra cosa, incluida una fecha que no existe como el 31 de
    febrero.
    """
    if not texto:
        return None, f'Falta la fecha {nombre}.'

    try:
        return date.fromisoformat(texto), None
    except ValueError:
        return None, f'La fecha {nombre} tiene que tener el formato AAAA-MM-DD.'


def _leer_meses(texto):
    """Devuelve (meses, None) si el parámetro sirve, o (None, mensaje) si no.

    El parámetro es opcional: si no viene, vale MESES_POR_DEFECTO.
    """
    if not texto:
        return MESES_POR_DEFECTO, None

    try:
        meses = int(texto)
    except ValueError:
        meses = None

    if meses is None or not MESES_MINIMO <= meses <= MESES_MAXIMO:
        return None, (
            f'meses tiene que ser un número entero '
            f'entre {MESES_MINIMO} y {MESES_MAXIMO}.'
        )

    return meses, None


def _primeros_dias_de_la_serie(hasta, meses):
    """Los meses del gráfico, como fechas del día 1, del más viejo al más nuevo.

    La serie termina en el mes de `hasta` y va hacia atrás `meses` meses.
    Se arma contando para atrás desde ese mes: al pasar enero se salta a
    diciembre del año anterior. Se devuelven fechas y no textos porque es
    lo mismo que devuelve TruncMonth en la consulta, y así las dos cosas
    se comparan directo.
    """
    primeros = []
    anio, mes = hasta.year, hasta.month

    for _ in range(meses):
        primeros.append(date(anio, mes, 1))
        if mes == 1:
            anio, mes = anio - 1, 12
        else:
            mes -= 1

    primeros.reverse()
    return primeros


def _totales_por_mes(queryset):
    """Suma el monto por mes EN LA BASE. Devuelve {día 1 del mes: total}.

    TruncMonth recorta cada fecha a su mes (el 16 de septiembre pasa a
    ser el 1 de septiembre) y values() más annotate() es el GROUP BY: una
    fila por mes con la suma. Sobre un DateField devuelve un date, sin
    zona horaria de por medio.

    Solo vienen los meses que tuvieron movimientos: un mes sin cobros no
    tiene filas que agrupar. Los huecos los completa la vista.
    """
    filas = (
        queryset
        .annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('monto'))
    )
    return {fila['mes']: fila['total'] for fila in filas}


@api_view(['GET'])
def finanzas_del_periodo(request):
    """CU61 - Visualizar gastos de un período de tiempo, y CU62 - Visualizar ingresos de un período de tiempo.

    Un solo endpoint, GET /api/finanzas/, que devuelve en un pedido todo
    lo que la pantalla Finanzas necesita: los totales del período, los
    desgloses, la evolución mensual y las dos listas. Los parámetros van
    en la URL: desde y hasta (obligatorios, AAAA-MM-DD, inclusivos los
    dos) y meses (opcional, cuántos meses tiene la evolución).

    Es una función con @api_view y no un ViewSet porque no es un CRUD
    sobre un modelo: es el mismo patrón que las vistas de usuarios.
    Hereda IsAuthenticated de la configuración global de DRF, así que
    exige sesión activa.

    Los ingresos son los COBROS con fecha dentro del período, no el total
    de los pedidos vendidos: es la plata que entró de verdad, que es lo
    que se puede comparar contra los gastos.

    Todas las sumas y los agrupados se hacen en la base con aggregate()
    y annotate(). Son ocho consultas, siempre las mismas sin importar
    cuántos cobros o gastos haya.
    """
    desde, error = _leer_fecha(request.query_params.get('desde'), 'desde')
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    hasta, error = _leer_fecha(request.query_params.get('hasta'), 'hasta')
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    if desde > hasta:
        return Response(
            {'detail': 'La fecha desde no puede ser posterior a la fecha hasta.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    meses, error = _leer_meses(request.query_params.get('meses'))
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    # -----------------------------------------------------------------
    # Los movimientos del período
    # -----------------------------------------------------------------
    # fecha__range es el BETWEEN de SQL: inclusivo en los dos
    # extremos, que es lo que significa "del 1 al 30".
    cobros = Cobro.objects.filter(fecha__range=(desde, hasta))
    gastos = Gasto.objects.filter(fecha__range=(desde, hasta))

    # Una consulta por modelo que trae la suma y la cantidad
    # juntas. Sum devuelve None cuando no hay filas, no 0: el `or` lo
    # convierte en Decimal('0') para que la resta de abajo no falle y el
    # serializer lo escriba como "0.00".
    totales_cobros = cobros.aggregate(total=Sum('monto'), cantidad=Count('id'))
    totales_gastos = gastos.aggregate(total=Sum('monto'), cantidad=Count('id'))
    ingresos = totales_cobros['total'] or Decimal('0')
    total_gastos = totales_gastos['total'] or Decimal('0')

    # -----------------------------------------------------------------
    # Los desgloses: ingresos por medio de pago y gastos por tipo
    # -----------------------------------------------------------------
    # values('medio') más annotate(Sum) es el GROUP BY: una
    # fila por medio con lo cobrado. La base devuelve solo los medios que
    # tuvieron movimiento, y la pantalla los muestra siempre, también en
    # cero. Por eso la lista final se arma recorriendo los choices del
    # modelo, que es la lista completa, y buscando cada uno en lo que
    # devolvió la consulta. choices da pares (código, etiqueta), y así el
    # _display viaja al lado del código como en todo el proyecto.
    por_medio = {
        fila['medio']: fila['total']
        for fila in cobros.values('medio').annotate(total=Sum('monto'))
    }
    ingresos_por_medio = [
        {
            'medio': codigo,
            'medio_display': etiqueta,
            'total': por_medio.get(codigo, Decimal('0')),
        }
        for codigo, etiqueta in Cobro.Medio.choices
    ]

    por_tipo = {
        fila['tipo']: fila['total']
        for fila in gastos.values('tipo').annotate(total=Sum('monto'))
    }
    gastos_por_tipo = [
        {
            'tipo': codigo,
            'tipo_display': etiqueta,
            'total': por_tipo.get(codigo, Decimal('0')),
        }
        for codigo, etiqueta in Gasto.Tipo.choices
    ]

    # -----------------------------------------------------------------
    # La evolución mensual
    # -----------------------------------------------------------------
    # El gráfico tiene su propia ventana de fechas, distinta
    # del período: con "Este mes" el período es septiembre, pero el
    # gráfico muestra los últimos seis meses. Va del día 1 del mes más
    # viejo de la serie al último día del mes de `hasta`, que lo da
    # calendar.monthrange (devuelve el día de la semana del 1 y cuántos
    # días tiene el mes; se usa el segundo).
    primeros = _primeros_dias_de_la_serie(hasta, meses)
    ultimo_dia = calendar.monthrange(hasta.year, hasta.month)[1]
    ventana = (primeros[0], date(hasta.year, hasta.month, ultimo_dia))

    ingresos_por_mes = _totales_por_mes(Cobro.objects.filter(fecha__range=ventana))
    gastos_por_mes = _totales_por_mes(Gasto.objects.filter(fecha__range=ventana))

    # Acá se completan los huecos: se recorre la serie entera
    # y cada mes busca su total en lo que devolvió la base, con cero si
    # no está. La clave viaja como AAAA-MM, que es como la pantalla nombra
    # a cada mes.
    evolucion = [
        {
            'mes': primero.strftime('%Y-%m'),
            'ingresos': ingresos_por_mes.get(primero, Decimal('0')),
            'gastos': gastos_por_mes.get(primero, Decimal('0')),
        }
        for primero in primeros
    ]

    # -----------------------------------------------------------------
    # La respuesta
    # -----------------------------------------------------------------
    # Las dos listas salen ordenadas por el Meta.ordering de
    # cada modelo, -fecha y -id: del más nuevo al más viejo. select_related
    # trae el pedido y su cliente en el mismo JOIN, porque el serializer
    # lee el instagram y el nombre de cada cobro; sin eso serían dos
    # consultas por fila.
    datos = {
        'totales': {
            'ingresos': ingresos,
            'gastos': total_gastos,
            'resultado': ingresos - total_gastos,
            'cantidad_cobros': totales_cobros['cantidad'],
            'cantidad_gastos': totales_gastos['cantidad'],
        },
        'ingresos_por_medio': ingresos_por_medio,
        'gastos_por_tipo': gastos_por_tipo,
        'evolucion': evolucion,
        'cobros': cobros.select_related('pedido__cliente'),
        'gastos': gastos,
    }

    return Response(FinanzasDelPeriodoSerializer(datos).data)
