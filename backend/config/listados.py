"""Lo que comparten los listados filtrados en la base (corrección D3 del tutor).

Cada ViewSet lee sus propios filtros de la URL en un método _filtrar(),
porque cada listado filtra por cosas distintas. Lo que se repite en todos
está acá: leer un importe y una fecha de la URL, y ordenar por una columna
de una lista cerrada. Un valor que no se entiende responde 400 con un
detail que dice cuál, en vez de ignorarlo: un filtro mal escrito que no
filtra mostraría una lista que parece correcta y no lo es.

ParseError es la excepción de DRF que responde 400 con {"detail": "..."},
la misma forma que usan los demás mensajes de la API.
"""

from datetime import date
from decimal import Decimal, InvalidOperation

from django.db.models import F
from rest_framework.exceptions import ParseError


def leer_importe(parametros, nombre):
    """El importe del parámetro como Decimal, o None si no vino."""
    valor = parametros.get(nombre)
    if not valor:
        return None

    try:
        return Decimal(valor)
    except InvalidOperation:
        raise ParseError(f'{nombre} tiene que ser un número.')


def leer_fecha(parametros, nombre):
    """La fecha del parámetro (AAAA-MM-DD) como date, o None si no vino."""
    valor = parametros.get(nombre)
    if not valor:
        return None

    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ParseError(f'{nombre} tiene que ser una fecha AAAA-MM-DD.')


def ordenar(queryset, parametros, ordenes, desempate):
    """Ordena por ?orden=columna, o ?orden=-columna para al revés.

    ordenes es el diccionario de las columnas permitidas: cada clave es lo
    que viaja en la URL y su valor, la lista de campos o anotaciones por
    los que se ordena, en orden. desempate es el orden de siempre del
    listado, que va después de la columna elegida: así dos filas iguales en
    esa columna no cambian de lugar entre páginas. Sin ?orden= queda el
    orden del modelo.

    Al revés va todo al revés, también los vacíos: sin valor al final de
    menor a mayor, y al principio de mayor a menor.
    """
    orden = parametros.get('orden')
    if not orden:
        return queryset

    descendente = orden.startswith('-')
    clave = orden.lstrip('-')
    if clave not in ordenes:
        raise ParseError('No se puede ordenar por esa columna.')

    criterios = [
        F(campo).desc(nulls_first=True) if descendente else F(campo).asc(nulls_last=True)
        for campo in ordenes[clave]
    ]
    return queryset.order_by(*criterios, *desempate)
