from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from categorias.models import Categoria
from categorias.serializers import CategoriaSerializer

from .models import Producto
from .serializers import ProductoDetalleSerializer, ProductoListaSerializer

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


class ProductoViewSet(viewsets.ModelViewSet):
    """CRUD de productos (CU17 a CU24).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    Devuelve todos los productos, activos y de baja. La separación
    visual entre ambos grupos se resuelve en el frontend.

    Los casos de uso de las relaciones anidadas (receta, categorías e
    imágenes, CU25 a CU35) tienen sus propios endpoints y no pasan por
    acá.
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'descripcion']
    ordering_fields = ['nombre', 'precio_actual', 'dificultad', 'estado']

    # -----------------------------------------------------------------
    # Dos serializers según la acción
    # -----------------------------------------------------------------

    def get_serializer_class(self):
        """El listado usa el serializer liviano; el resto, el completo.

        self.action es el nombre de la operación en curso: 'list',
        'retrieve', 'create', 'update', o el nombre de una @action.
        """
        if self.action == 'list':
            return ProductoListaSerializer

        return ProductoDetalleSerializer

    # -----------------------------------------------------------------
    # El prefetch también depende de la acción
    # -----------------------------------------------------------------

    def get_queryset(self):
        """Trae de una sola vez las relaciones que el serializer va a leer.

        La ficha pide una relación más que el listado, y el motivo es
        cuál de las dos vías a los materiales usa cada una:

        - El listado solo cuenta materiales y mira cuáles están
          discontinuados. Las dos cosas leen producto.materiales, que
          ya devuelve objetos Material.
        - La ficha además dibuja la receta con
          MaterialProductoSerializer, que por cada línea salta de la
          fila de MaterialProducto a su Material para sacarle el nombre
          y el estado. Sin prefetch ese salto es una consulta por línea.

        El doble guión bajo de 'materiales_usados__material' es lo que
        le dice a Django que siga la relación un nivel más y traiga
        también los materiales de cada línea.
        """
        queryset = Producto.objects.all()

        if self.action == 'list':
            return queryset.prefetch_related(
                'categorias',
                'materiales',
                'imagenes',
            )

        return queryset.prefetch_related(
            'categorias',
            'materiales',
            'imagenes',
            'materiales_usados__material',
        )

    # -----------------------------------------------------------------
    # Sobreescribo update, ya que no puedo modificar productos de baja
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        """Impide modificar un producto dado de baja.

        Un producto de baja queda de solo lectura. Para volver a
        editarlo hay que reactivarlo primero.

        Cubre PUT y PATCH: DRF resuelve el PATCH llamando a update.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(request, *args, **kwargs)

    # -----------------------------------------------------------------
    # Casos de uso además del CRUD
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def dar_de_baja(self, request, pk=None):
        """CU20 - Dar de baja un producto.

        Baja lógica: el registro se conserva y solo cambia su estado. Se
        retira del catálogo público y queda de solo lectura, pero sigue
        referenciado en los pedidos anteriores.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto ya está dado de baja.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.estado = Producto.Estado.BAJA
        producto.save(update_fields=['estado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        """CU21 - Reactivar un producto dado de baja.

        Se permite aunque el producto esté de baja: es la única vía para
        devolverlo a estado editable.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.ACTIVO:
            return Response(
                {'detail': 'El producto ya está activo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.estado = Producto.Estado.ACTIVO
        producto.save(update_fields=['estado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def publicar(self, request, pk=None):
        """CU23 - Dejar de tratar el producto como pedido personalizado.

        Un producto personalizado es un encargo puntual de un cliente y
        nunca se muestra en el catálogo. Publicarlo lo convierte en una
        pieza del catálogo general.

        No alcanza con esto para que se vea: la regla del catálogo pide
        además que el producto esté activo y que ninguna de sus
        categorías esté de baja. Por eso se rechaza publicar un producto
        dado de baja, que quedaría igual de invisible.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo antes de publicarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not producto.es_personalizado:
            return Response(
                {'detail': 'El producto ya no es un pedido personalizado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.es_personalizado = False
        producto.save(update_fields=['es_personalizado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def quitar_del_catalogo(self, request, pk=None):
        """CU24 - Marcar el producto como pedido personalizado.

        Lo saca del catálogo público sin darlo de baja: la pieza se
        sigue gestionando normalmente, pero deja de ofrecerse a los
        clientes.

        No mira el estado: marcarlo como personalizado es igual de
        válido esté activo o de baja.
        """
        producto = self.get_object()

        if producto.es_personalizado:
            return Response(
                {'detail': 'El producto ya es un pedido personalizado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.es_personalizado = True
        producto.save(update_fields=['es_personalizado'])

        return Response(self.get_serializer(producto).data)


    # -----------------------------------------------------------------
    # Las categorías del producto (CU25 a CU27)
    # -----------------------------------------------------------------
    # Las categorías de un producto son una colección que cuelga de él,
    # así que las tres operaciones son las tres operaciones normales
    # sobre una colección, sobre la misma URL base:
    #
    #   GET    /api/productos/1/categorias/     lista        (CU26)
    #   POST   /api/productos/1/categorias/     agrega una   (CU25)
    #   DELETE /api/productos/1/categorias/5/   borra esa    (CU27)
    #
    # El id del DELETE va en la URL y no en el cuerpo: así la ruta
    # nombra exactamente el recurso que se borra, que es para lo que
    # sirve una URL. Un DELETE con cuerpo es legal pero varios
    # intermediarios lo descartan.

    @action(detail=True, methods=['get'], url_path='categorias')
    def categorias(self, request, pk=None):
        """CU26 - Listar las categorías de un producto.

        No mira el estado del producto: consultar uno dado de baja está
        permitido, lo que no se permite es modificarlo.
        """
        producto = self.get_object()

        return Response(
            CategoriaSerializer(producto.categorias.all(), many=True).data
        )

    # El mapping le dice al router: misma URL que 'categorias', pero
    # cuando el método sea POST, ejecutá esta otra función. Así cada
    # caso de uso queda en su propio método, sin un if adentro.
    @categorias.mapping.post
    def asignar_categoria(self, request, pk=None):
        """CU25 - Asignar una categoría al producto.

        El id de la categoría llega en el cuerpo, en la clave
        'categoria'.

        Se permite asignar una categoría dada de baja: el producto
        simplemente queda fuera del catálogo mientras eso dure. La
        visibilidad se evalúa al consultar, nunca se propaga por
        escritura.
        """
        producto = self.get_object()

        # El estado va primero porque es la regla más general: si el
        # producto es de solo lectura, no importa qué id mandaron.
        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus categorías.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        categoria_id = request.data.get('categoria')

        if not categoria_id:
            return Response(
                {'detail': 'Falta el id de la categoría.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            categoria = Categoria.objects.get(pk=categoria_id)
        except (Categoria.DoesNotExist, ValueError):
            return Response(
                {'detail': 'No existe una categoría con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # En Python y no con .filter().exists(): get_object() ya trajo
        # las categorías con el prefetch, y un .filter() encima armaría
        # una consulta nueva que ignora lo ya traído.
        if categoria in producto.categorias.all():
            return Response(
                {'detail': f'El producto ya tiene asignada la categoría '
                           f'«{categoria.nombre}».'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.categorias.add(categoria)

        # add() escribió en la base, pero las categorías que trajo el
        # prefetch siguen cacheadas en memoria, sin la recién agregada.
        # refresh_from_db() vacía esa caché, así el serializer recalcula
        # visible_en_catalogo y compañía contra la base.
        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['delete'], url_path=r'categorias/(?P<categoria_id>\d+)')
    def quitar_categoria(self, request, pk=None, categoria_id=None):
        """CU27 - Quitar una categoría del producto.

        Borra solo la fila de la tabla intermedia: ni el producto ni la
        categoría se tocan. Si el producto queda sin categorías, pasa a
        depender solo de su propio estado.

        El \\d+ del url_path restringe el id a dígitos, así que una URL
        con letras no coincide con ninguna ruta y Django devuelve 404
        sin entrar acá.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus categorías.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            categoria = Categoria.objects.get(pk=categoria_id)
        except Categoria.DoesNotExist:
            return Response(
                {'detail': 'No existe una categoría con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if categoria not in producto.categorias.all():
            return Response(
                {'detail': f'El producto no tiene asignada la categoría '
                           f'«{categoria.nombre}».'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.categorias.remove(categoria)
        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)
