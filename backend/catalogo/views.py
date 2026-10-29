import unicodedata

from django.db.models import CharField, Count, Exists, Func, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce, Lower
from rest_framework import generics
from rest_framework.exceptions import ParseError
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from categorias.models import Categoria
from config.paginacion import PaginacionDeListado
from productos.models import ImagenProducto, Producto

from .serializers import (
    CategoriaConCantidadSerializer,
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


class PaginacionDelCatalogo(PaginacionDeListado):
    """De a 20 productos, y sin elegir cuántos: el "Cargar más" del listado pide la página siguiente.

    Como en la gestión, pagina solo con ?pagina=; sin ese parámetro el
    listado devuelve todos (así se piden los de "Mi selección", con ?ids=).
    """

    page_size = 20
    page_size_query_param = None


# Las letras con tilde y la ñ, y por cuál se cambian para buscar sin
# acentos: "jose" tiene que encontrar "José", como hacía el buscador del
# navegador. Las mayúsculas las resuelve Lower antes.
CON_TILDE = 'áéíóúüàèìòùñ'
SIN_TILDE = 'aeiouuaeioun'


def sin_acentos(texto):
    """El texto en minúscula y sin acentos, para comparar con sin_acentos_en_la_base()."""
    descompuesto = unicodedata.normalize('NFD', texto.lower())
    return ''.join(letra for letra in descompuesto if not unicodedata.combining(letra))


def sin_acentos_en_la_base(campo):
    """El campo en minúscula y sin acentos, calculado por PostgreSQL.

    TRANSLATE cambia cada letra de CON_TILDE por la que está en la misma
    posición de SIN_TILDE. Es una función de PostgreSQL que viene con la
    base: no hace falta instalar la extensión unaccent ni migrar nada.
    """
    return Func(
        Lower(campo), Value(CON_TILDE), Value(SIN_TILDE),
        function='TRANSLATE', output_field=CharField(),
    )


# Los cuatro órdenes del desplegable, con los mismos valores que viajan en
# la dirección del listado (?orden=precio-desc). Después del criterio va el
# nombre, para que dos piezas con el mismo precio queden siempre igual.
ORDENES = {
    'nombre-asc': ['nombre', 'id'],
    'nombre-desc': ['-nombre', '-id'],
    'precio-asc': ['precio_actual', 'nombre', 'id'],
    'precio-desc': ['-precio_actual', 'nombre', 'id'],
}


class ListaDeProductosView(generics.ListAPIView):
    """CU63 - Visualizar catálogo de productos.

    GET /api/catalogo/productos/ devuelve los productos visibles. Con
    ?pagina= devuelve de a 20, para el "Cargar más" del listado
    (corrección D3), con los filtros resueltos en la base:

      categoria=id         se puede repetir (CU64): O dentro de un grupo, Y
                           entre grupos, como hacía el navegador
      busqueda=texto       en el nombre o la descripción, sin distinguir
                           mayúsculas ni acentos
      orden=precio-desc    una clave de ORDENES; por defecto, nombre-asc
      ids=3,7,12           solo esos: los productos de "Mi selección"
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogo'
    http_method_names = ['get']

    serializer_class = ProductoCatalogoListaSerializer
    pagination_class = PaginacionDelCatalogo

    def get_queryset(self):
        queryset = productos_del_catalogo()
        parametros = self.request.query_params

        ids = parametros.get('ids')
        if ids:
            partes = ids.split(',')
            if not all(parte.isdigit() for parte in partes):
                raise ParseError('Los ids tienen que ser números separados por comas.')
            queryset = queryset.filter(id__in=[int(parte) for parte in partes])

        categorias = parametros.getlist('categoria')
        if categorias:
            if not all(categoria.isdigit() for categoria in categorias):
                raise ParseError('Las categorías tienen que ser números.')
            # Las elegidas, repartidas por su grupo (tipo de accesorio y
            # temática). Un producto pasa si en cada grupo con algo elegido
            # tiene al menos una: con Aros, Dijes y Harry Potter quedan los
            # aros y los dijes que sean de Harry Potter.
            elegidas = Categoria.objects.filter(id__in=[int(c) for c in categorias])
            for tipo in Categoria.Tipo.values:
                del_grupo = [categoria.id for categoria in elegidas if categoria.tipo == tipo]
                if del_grupo:
                    queryset = queryset.filter(Exists(
                        Producto.categorias.through.objects.filter(
                            producto=OuterRef('pk'), categoria_id__in=del_grupo,
                        )
                    ))

        texto = sin_acentos(parametros.get('busqueda', '').strip())
        if texto:
            queryset = queryset.annotate(
                nombre_sin_acentos=sin_acentos_en_la_base('nombre'),
                descripcion_sin_acentos=sin_acentos_en_la_base('descripcion'),
            ).filter(Q(nombre_sin_acentos__contains=texto) | Q(descripcion_sin_acentos__contains=texto))

        orden = parametros.get('orden') or 'nombre-asc'
        if orden not in ORDENES:
            raise ParseError('No se puede ordenar así.')

        return queryset.order_by(*ORDENES[orden])


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

    GET /api/catalogo/categorias/ devuelve las categorías activas, cada una
    con cuántos productos visibles tiene (cantidad). Es el número del árbol
    y de los filtros, contado sobre todos los visibles y no sobre los
    filtrados; antes lo contaba el navegador sobre la lista entera, que con
    el listado de a 20 (corrección D3) ya no tiene.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogo'
    http_method_names = ['get']

    serializer_class = CategoriaConCantidadSerializer

    def get_queryset(self):
        # Cuántos de los productos visibles tienen la categoría. Es una
        # subconsulta por categoría, sobre la misma regla de visibilidad que
        # el listado (visibles_en_catalogo), así los dos no se contradicen.
        # Se cuenta sobre la tabla que une productos y categorías: una fila
        # por cada producto de la categoría, agrupadas por la categoría de
        # afuera.
        visibles_de_la_categoria = (
            Producto.categorias.through.objects
            .filter(categoria=OuterRef('pk'), producto__in=Producto.objects.visibles_en_catalogo())
            .order_by()
            .values('categoria')
            .annotate(cuenta=Count('id'))
            .values('cuenta')
        )

        # El orden coincide hoy con el ordering de Categoria, pero se
        # escribe igual: es parte de lo que este endpoint promete, y no
        # tiene que cambiar si un día cambia el del modelo por la gestión.
        return Categoria.objects.filter(
            estado=Categoria.Estado.ACTIVO,
        ).annotate(
            cantidad=Coalesce(Subquery(visibles_de_la_categoria), 0),
        ).order_by('tipo', 'nombre')
