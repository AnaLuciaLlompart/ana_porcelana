from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from categorias.models import Categoria
from categorias.serializers import CategoriaSerializer
from materiales.models import Material

from .models import MaterialProducto, Producto
from .serializers import (
    ImagenProductoCrearSerializer,
    ImagenProductoModificarSerializer,
    ImagenProductoSerializer,
    MaterialProductoSerializer,
    ProductoDetalleSerializer,
    ProductoListaSerializer,
)

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


class ProductoViewSet(viewsets.ModelViewSet):
    """CRUD de productos y sus relaciones (CU17 a CU35).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    Devuelve todos los productos, activos y de baja. La separación
    visual entre ambos grupos se resuelve en el frontend.

    Además del CRUD y de los cambios de estado (CU17 a CU24), expone
    como sub-recursos las dos colecciones que cuelgan de un producto:

    - sus categorías, en /categorias/ (CU25 a CU27)
    - los materiales que necesita, en /materiales/ (CU28 a CU31)
    - sus imágenes, en /imagenes/ (CU32 a CU35)
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'descripcion']
    ordering_fields = ['nombre', 'precio_actual', 'dificultad', 'estado']

    # Los tres formatos en los que puede llegar el cuerpo de un pedido.
    # JSON es el de siempre; los otros dos hacen falta para subir
    # imágenes (CU32), porque un archivo no viaja dentro de un JSON:
    # el navegador lo manda como multipart/form-data, que es el formato
    # de los formularios con adjuntos.
    #
    # Coincide con lo que DRF trae por defecto, así que no cambia el
    # comportamiento: se escribe para dejarlo a la vista y para que
    # siga valiendo aunque mañana se toque la configuración global.
    parser_classes = [JSONParser, FormParser, MultiPartParser]

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
        - La ficha además dibuja los materiales del producto con
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
    # Casos de uso además del CRUD (CU20 a CU24)
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



    # -----------------------------------------------------------------
    # Los materiales del producto (CU28 a CU31)
    # -----------------------------------------------------------------
    # Misma forma que las categorías, con una diferencia importante: el
    # id de la ruta es el de la LÍNEA (MaterialProducto), no el del
    # material.
    #
    #   GET    /api/productos/1/materiales/     lista            (CU29)
    #   POST   /api/productos/1/materiales/     agrega una línea (CU28)
    #   PATCH  /api/productos/1/materiales/3/   cambia cantidad  (CU30)
    #   DELETE /api/productos/1/materiales/3/   quita la línea   (CU31)
    #
    # Se usa el id de la línea y no el del material porque la línea es
    # la que tiene la cantidad, que es lo único editable.

    def _buscar_linea_de_materiales(self, producto, linea_id):
        """Busca una línea ENTRE LAS DE ESTE PRODUCTO, o devuelve None.

        Recorre producto.materiales_usados, que get_object() ya trajo
        con el prefetch. Buscar dentro de esa lista, y no en
        MaterialProducto.objects, es lo que garantiza que la línea sea
        de este producto: una línea ajena directamente no está en la
        lista. Sin eso, mandando un id cualquiera se podrían editar los
        materiales de otro producto.

        El \\d+ del url_path ya garantizó que linea_id sean dígitos, así
        que el int() no puede fallar.
        """
        for linea in producto.materiales_usados.all():
            if linea.pk == int(linea_id):
                return linea

        return None



    @action(detail=True, methods=['get'], url_path='materiales')
    def materiales(self, request, pk=None):
        """CU29 - Listar los materiales de un producto.

        Devuelve las líneas con el nombre y el estado de cada material,
        para que la pantalla pueda marcar los discontinuados.

        No mira el estado del producto: consultar uno dado de baja está
        permitido.
        """
        producto = self.get_object()

        return Response(
            MaterialProductoSerializer(
                producto.materiales_usados.all(), many=True
            ).data
        )



    @materiales.mapping.post
    def asignar_material(self, request, pk=None):
        """CU28 - Agregar un material al producto.

        En el cuerpo llegan 'material' (el id) y 'cantidad' (texto
        libre, opcional: "dos gotas", "media plancha").

        Se permite agregar un material discontinuado: los materiales
        del producto son el registro de cómo se hace la pieza, y la
        propiedad materiales_discontinuados es la que después avisa.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
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
        except (Material.DoesNotExist, ValueError):
            return Response(
                {'detail': 'No existe un material con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Este chequeo es el que evita el IntegrityError crudo del
        # UniqueConstraint (producto, material). Sin él, PostgreSQL
        # rechaza la fila, Django levanta la excepción y el frontend
        # recibe un 500 en vez de un mensaje que se pueda mostrar.
        if material in producto.materiales.all():
            return Response(
                {'detail': f'El producto ya tiene «{material.nombre}» '
                           f'entre sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        MaterialProducto.objects.create(
            producto=producto,
            material=material,
            cantidad=request.data.get('cantidad') or '',
        )

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)



    @action(detail=True, methods=['patch'],
            url_path=r'materiales/(?P<linea_id>\d+)')
    def modificar_cantidad(self, request, pk=None, linea_id=None):
        """CU30 - Cambiar la cantidad de una línea de materiales.

        Solo se cambia la cantidad. El material de una línea no se
        cambia: se quita la línea y se agrega otra, porque cambiarlo
        serían otros materiales.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea = self._buscar_linea_de_materiales(producto, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Esa línea no pertenece a los materiales de este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Se exige que la clave venga, aunque su valor pueda ser vacío:
        # mandar un PATCH sin 'cantidad' es un error de quien llama, no
        # una forma de borrar la cantidad.
        if 'cantidad' not in request.data:
            return Response(
                {'detail': 'Falta la cantidad.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea.cantidad = request.data.get('cantidad') or ''
        linea.save(update_fields=['cantidad'])

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)



    @modificar_cantidad.mapping.delete
    def quitar_material(self, request, pk=None, linea_id=None):
        """CU31 - Quitar un material del producto.

        Borra la línea, no el material: el material sigue existiendo y
        puede estar entre los materiales de otros productos. Es lo
        que protege el PROTECT de la clave foránea.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea = self._buscar_linea_de_materiales(producto, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Esa línea no pertenece a los materiales de este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea.delete()

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    # -----------------------------------------------------------------
    # Las imágenes del producto (CU32 a CU35)
    # -----------------------------------------------------------------
    # Misma forma que las otras dos colecciones:
    #
    #   GET    /api/productos/1/imagenes/     lista           (CU33)
    #   POST   /api/productos/1/imagenes/     sube una        (CU32)
    #   PATCH  /api/productos/1/imagenes/3/   edita los datos (CU34)
    #   DELETE /api/productos/1/imagenes/3/   la borra        (CU35)
    #
    # El POST es el único endpoint de todo el ViewSet que no recibe
    # JSON: el archivo llega como multipart/form-data, por eso los
    # parser_classes de más arriba.

    def _buscar_imagen_del_producto(self, producto, imagen_id):
        """Busca una imagen ENTRE LAS DE ESTE PRODUCTO, o devuelve None.

        Mismo criterio que el buscador de materiales: recorre
        producto.imagenes, que get_object() ya trajo con el prefetch.
        Buscar dentro de esa lista es lo que garantiza que la imagen sea
        de este producto y no de otro.
        """
        for imagen in producto.imagenes.all():
            if imagen.pk == int(imagen_id):
                return imagen

        return None

    @action(detail=True, methods=['get'], url_path='imagenes')
    def imagenes(self, request, pk=None):
        """CU33 - Listar las imágenes de un producto.

        Vienen ordenadas por el campo orden, así que la primera de la
        lista es la principal.

        No mira el estado del producto: consultar uno dado de baja está
        permitido.
        """
        producto = self.get_object()

        return Response(
            ImagenProductoSerializer(producto.imagenes.all(), many=True).data
        )

    @imagenes.mapping.post
    def subir_imagen(self, request, pk=None):
        """CU32 - Subir una imagen a un producto.

        El archivo llega en 'imagen' y es obligatorio. 'titulo', 'tipo'
        y 'orden' son opcionales.

        Se usa ImagenProductoCrearSerializer y no el de lectura, porque
        este tiene el ImageField de verdad: valida que sea una imagen y
        que no pase de 15 MB, y guarda el archivo en media/productos/.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ImagenProductoCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # El producto no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda subirle una imagen a otro
        # producto mandándolo en el formulario.
        serializer.save(producto=producto)

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    @action(detail=True, methods=['patch'],
            url_path=r'imagenes/(?P<imagen_id>\d+)')
    def modificar_imagen(self, request, pk=None, imagen_id=None):
        """CU34 - Cambiar el título, el tipo o el orden de una imagen.

        El archivo no se cambia: para eso se borra la imagen y se sube
        otra. La garantía es estructural, porque
        ImagenProductoModificarSerializer no tiene el campo del archivo.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen = self._buscar_imagen_del_producto(producto, imagen_id)

        if imagen is None:
            return Response(
                {'detail': 'Esa imagen no pertenece a este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ImagenProductoModificarSerializer(
            imagen,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    @modificar_imagen.mapping.delete
    def borrar_imagen(self, request, pk=None, imagen_id=None):
        """CU35 - Borrar una imagen de un producto.

        Si era la principal, pasa a serlo la siguiente por orden.

        OJO: esto borra la fila, no el archivo del disco. El archivo
        queda huérfano en media/productos/. Está pendiente decidir qué
        hacer con eso.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen = self._buscar_imagen_del_producto(producto, imagen_id)

        if imagen is None:
            return Response(
                {'detail': 'Esa imagen no pertenece a este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen.delete()

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)
