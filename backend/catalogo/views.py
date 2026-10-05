from django.db.models import Prefetch
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from categorias.models import Categoria
from productos.models import ImagenProducto, Producto

from .serializers import (
    CategoriaCatalogoSerializer,
    ProductoCatalogoDetalleSerializer,
    ProductoCatalogoListaSerializer,
)

# Las tres vistas del catálogo público. Son las únicas del sistema que
# atienden a un visitante sin sesión, y las tres repiten los mismos cuatro
# atributos, escritos en cada una para que se lean sin ir a buscar una
# clase base:
#
#   permission_classes   AllowAny. La configuración global exige sesión
#                        (IsAuthenticated); acá se abre a propósito.
#
#   throttle_classes     ScopedRateThrottle, que en estas vistas REEMPLAZA
#   y throttle_scope     a los dos throttles globales, no se les suma. El
#                        límite es el de 'catalogo' en
#                        DEFAULT_THROTTLE_RATES, se cuenta por IP, y lo
#                        comparten las tres porque usan el mismo scope.
#
#   http_method_names    Solo GET. Cualquier otro método responde 405,
#                        también HEAD y OPTIONS, que DRF contesta por
#                        defecto. OPTIONS le devolvería a quien lo pida el
#                        nombre de la vista y su docstring.
#
# Son vistas genéricas de DRF y no un ViewSet con router: cada clase es un
# endpoint, y las tres rutas de urls.py son todo lo que la app expone.
#
# Ninguna declara filter_backends, search_fields ni paginación, y no es un
# olvido: el frontend filtra sobre la lista completa, y al no declararlos
# los parámetros que lleguen en la URL se ignoran.


def productos_del_catalogo():
    """Los productos visibles, con lo que los serializers van a leer.

    La usan el listado y el detalle, para que los dos partan de la misma
    consulta. Qué productos son visibles no se decide acá: lo dice
    Producto.objects.visibles_en_catalogo().

    Son tres consultas, haya los productos que haya: los productos, sus
    categorías y sus imágenes de resultado.

    Las categorías van sin filtro porque un producto visible no tiene
    ninguna de baja: es parte de la regla de visibilidad.

    El Prefetch de las imágenes lleva su propia consulta para traer solo
    las de RESULTADO. Las de referencia son material de trabajo y ni
    siquiera salen de la base. Así producto.imagenes.all() ya viene
    filtrado y ordenado (por el ordering de ImagenProducto), y tanto el
    serializer como la propiedad imagen_principal lo recorren sin
    encadenarle un .filter(), que rompería el prefetch.

    OJO: en los productos que salen de acá, .imagenes.all() NO son todas
    sus imágenes. Por eso esta consulta no se usa fuera del catálogo.
    """
    return Producto.objects.visibles_en_catalogo().prefetch_related(
        'categorias',
        Prefetch(
            'imagenes',
            queryset=ImagenProducto.objects.filter(
                tipo=ImagenProducto.Tipo.RESULTADO,
            ),
        ),
    )


class ListaDeProductosView(generics.ListAPIView):
    """CU63 - Visualizar catálogo de productos.

    GET /api/catalogo/productos/ devuelve todos los productos visibles,
    ordenados por nombre, sin paginar.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogo'
    http_method_names = ['get']

    serializer_class = ProductoCatalogoListaSerializer

    def get_queryset(self):
        return productos_del_catalogo()


class DetalleDeProductoView(generics.RetrieveAPIView):
    """CU65 - Visualizar detalle de producto.

    GET /api/catalogo/productos/<id>/ devuelve un producto visible con
    todas sus imágenes de resultado.

    El producto se busca DENTRO de los visibles, así que uno que existe
    pero no se muestra (de baja, personalizado, con una categoría de baja)
    responde el mismo 404 que uno que no existe. El visitante no puede
    distinguirlos.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogo'
    http_method_names = ['get']

    serializer_class = ProductoCatalogoDetalleSerializer

    def get_queryset(self):
        return productos_del_catalogo()


class ListaDeCategoriasView(generics.ListAPIView):
    """Las categorías por las que se puede filtrar el catálogo (CU64).

    GET /api/catalogo/categorias/ devuelve las categorías activas. El
    filtrado en sí lo hace el navegador sobre la lista de productos; este
    endpoint le da las opciones.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogo'
    http_method_names = ['get']

    serializer_class = CategoriaCatalogoSerializer

    def get_queryset(self):
        # El orden coincide hoy con el ordering de Categoria, pero se
        # escribe igual: es parte de lo que este endpoint promete, y no
        # tiene que cambiar si un día cambia el del modelo por la gestión.
        return Categoria.objects.filter(
            estado=Categoria.Estado.ACTIVO,
        ).order_by('tipo', 'nombre')
