"""Lo común de recibir los hijos de un registro en el mismo cuerpo.

Corrección del tutor: las altas y los guardados de las fichas son un solo
pedido a la API, que trae el registro y sus hijos juntos y los guarda en
una transacción (ATOMIC_REQUESTS). Lo usan los create() y los update() de
pedidos, gastos y productos. Cada ViewSet sigue teniendo su propia función
por fila, con sus reglas; acá está solo lo que se repite: leer la lista,
distinguir una fila nueva de una guardada y decir qué fila falló.
"""
from rest_framework.exceptions import ParseError, ValidationError


def leer_lista_si_vino(datos, clave):
    """La lista de hijos que vino en el cuerpo bajo esa clave, o None si no vino.

    Distingue la clave ausente de la lista vacía, que para un update()
    quieren decir cosas distintas: sin la clave, los hijos no se tocan; con
    [], se quitan todos. Con un cuerpo JSON la lista llega como lista. En
    producto, que es multipart por las fotos, llega como texto JSON y la
    parsea el JSONField de su serializer, no esto. Una clave que no sea una
    lista responde 400: un cuerpo que no se entiende no se guarda a medias.
    """
    # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no tiene
    # .get(): se rechaza con 400 en vez de dejar que explote en 500.
    if not hasattr(datos, 'get'):
        raise ParseError('El cuerpo tiene que ser un objeto JSON.')

    lista = datos.get(clave)

    if lista is None:
        return None

    if not isinstance(lista, list):
        raise ParseError(f"'{clave}' tiene que ser una lista.")

    return lista


def leer_lista(datos, clave):
    """La lista de hijos que vino en el cuerpo bajo esa clave, o [] si no vino.

    Para los create(): un alta sin la lista es un alta sin hijos.
    """
    lista = leer_lista_si_vino(datos, clave)
    return [] if lista is None else lista


# Al guardar una ficha viene la lista COMPLETA de hijos tal como quedó en
# el borrador: las filas guardadas con su id y las nuevas con el provisorio
# negativo que les puso la pantalla (o sin id). El update() la compara con
# lo guardado con estas tres: lo que no viene se quita, lo nuevo se crea y
# lo guardado se modifica.

def es_fila_nueva(datos):
    """Si la fila hay que crearla: no trae id, o trae el provisorio negativo.

    Lo que no sea un objeto JSON también cuenta como nueva: la función que
    crea es la que lo rechaza con su mensaje.
    """
    fila_id = datos.get('id') if isinstance(datos, dict) else None
    return fila_id is None or (isinstance(fila_id, int) and fila_id < 0)


def fila_guardada(datos, guardadas):
    """La fila guardada a la que apunta el id de datos, o None si no es de ninguna.

    guardadas es {id: fila} con las del registro. Solo un id entero puede
    encontrar algo: cualquier otra cosa es un id que no pertenece.
    """
    fila_id = datos.get('id')
    return guardadas.get(fila_id) if isinstance(fila_id, int) else None


def ids_que_vienen(filas):
    """Los ids enteros de las filas de la lista: lo guardado que la ficha conserva.

    Lo guardado que no está acá se quita.
    """
    return {
        datos['id']
        for datos in filas
        if isinstance(datos, dict) and isinstance(datos.get('id'), int)
    }


def texto_del_error(detalle):
    """El primer mensaje de un detail de DRF, como texto.

    Un serializer lanza {campo: [mensajes]}; ParseError, un texto; una
    lista, textos. Para decir "Fila 2: <mensaje>" alcanza con el primero,
    que es lo que la pantalla muestra.
    """
    if isinstance(detalle, dict):
        detalle = next(iter(detalle.values()), '')

    if isinstance(detalle, list):
        detalle = detalle[0] if detalle else ''

    return str(detalle)


def error_de_fila(clave, numero, nombre, error):
    """La excepción que relanza create() cuando falla un hijo.

    Sale con la clave de su lista y un solo texto, como un error de campo
    de DRF ({'productos': ['Fila 2 (Aros Hedwig): …']}), así la pantalla
    sabe en qué tarjeta mostrarlo y lo lee con el mismo mensajeDeError de
    siempre. nombre puede ser '' si la fila no llegó a tener uno.
    """
    quien = f'Fila {numero} ({nombre})' if nombre else f'Fila {numero}'
    return ValidationError({clave: [f'{quien}: {texto_del_error(error.detail)}']})
