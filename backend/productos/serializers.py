from rest_framework import serializers

from categorias.serializers import CategoriaSerializer

from .models import ImagenProducto, MaterialProducto, Producto

# Hay DOS serializers de Producto y no uno: el listado en grilla trae
# muchos productos y no necesita el paso a paso, los materiales ni
# todas las fotos. La ficha sí. Mandar todo en el listado sería peso al pedo.



# MATERIALES---------------------------

class MaterialProductoSerializer(serializers.ModelSerializer):
    """Uno de los materiales de un producto (CU29, CU30).

    Qué material lleva la pieza y cuánto. Viaja con el nombre y el
    estado del material al lado del id, porque la pantalla de los
    materiales del producto tiene que poder avisar que uno quedó
    discontinuado sin cruzar la lista de materiales por su cuenta.
    """

    material_nombre = serializers.CharField(
        source='material.nombre',
        read_only=True,
    )
    material_estado = serializers.CharField(
        source='material.estado',
        read_only=True,
    )
    # source atraviesa la relación y llama al get_estado_display() del
    # Material. El valor crudo nunca viaja solo: React no traduce
    # códigos, recibe la etiqueta ya resuelta.
    material_estado_display = serializers.CharField(
        source='material.get_estado_display',
        read_only=True,
    )

    class Meta:
        model = MaterialProducto
        fields = [
            'id',
            'material',
            'material_nombre',
            'material_estado',
            'material_estado_display',
            'cantidad',
        ]



# IMAGENES ----------------------------------

class ImagenProductoSerializer(serializers.ModelSerializer):
    """Imagen de un producto (CU33).

    Las de referencia son las que manda el cliente al encargar; las de
    resultado, la pieza terminada. El orden define cuál es la principal.
    """

    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )
    # SerializerMethodField para devolver la ruta RELATIVA
    # (/media/productos/x.jpg). El campo por defecto armaría la URL
    # absoluta con host y puerto, porque DRF tiene el request en el
    # contexto, y eso dejaría el dominio escrito en el JSON.
    imagen = serializers.SerializerMethodField()

    class Meta:
        model = ImagenProducto
        fields = [
            'id',
            'imagen',
            'titulo',
            'tipo',
            'tipo_display',
            'orden',
        ]

    def get_imagen(self, obj):
        return obj.imagen.url




class ImagenProductoCrearSerializer(serializers.ModelSerializer):
    """Subir una imagen a un producto (CU32).

    Existe aparte del de arriba porque los dos hacen cosas distintas.
    En ImagenProductoSerializer el campo 'imagen' es un
    SerializerMethodField, que sirve para devolver la ruta relativa
    pero es de SOLO LECTURA: no recibe archivos, no los valida y no los
    guarda. Acá 'imagen' es el ImageField de verdad, el que Pillow
    revisa para confirmar que sea una imagen y sobre el que corre el
    validador de 15 MB.

    Uno describe lo que ya está guardado; el otro recibe lo que llega.

    'imagen' es obligatoria. 'titulo' puede ir vacío, y 'tipo' y
    'orden' tienen valor por defecto en el modelo, así que también son
    opcionales.
    """

    class Meta:
        model = ImagenProducto
        fields = [
            'imagen',
            'titulo',
            'tipo',
            'orden',
        ]



class ImagenProductoModificarSerializer(serializers.ModelSerializer):
    """Modificar los datos de una imagen ya subida (CU34).

    Solo el título, el tipo y el orden. El archivo NO está entre los
    campos, y eso es lo que garantiza que no se pueda reemplazar: para
    cambiar la foto se borra la imagen y se sube otra.
    """

    class Meta:
        model = ImagenProducto
        fields = [
            'titulo',
            'tipo',
            'orden',
        ]




# PRODUCTOS --------------------------------------------


class ProductoListaSerializer(serializers.ModelSerializer):
    """Producto en la grilla del listado (CU18).

    Trae lo justo para dibujar una tarjeta y para que la emprendedora
    entienda de un vistazo el estado de la pieza: si se ve en el
    catálogo, si la esconde una categoría de baja, y si lleva
    materiales que ya no usa.
    """

    dificultad_display = serializers.CharField(
        source='get_dificultad_display',
        read_only=True,
    )
    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )

    # Estos cuatro leen las propiedades calculadas del modelo, que se
    # llaman igual. Van tipados y no como ReadOnlyField genérico, para
    # que quede escrito qué devuelve cada uno.
    visible_en_catalogo = serializers.BooleanField(read_only=True)
    oculto_por_categoria = serializers.BooleanField(read_only=True)
    materiales_discontinuados = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )
    categorias_de_baja = CategoriaSerializer(many=True, read_only=True)

    categorias = CategoriaSerializer(many=True, read_only=True)

    imagen_principal = serializers.SerializerMethodField()
    cantidad_materiales = serializers.SerializerMethodField()
    cantidad_imagenes = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'descripcion',
            'precio_actual',
            'dificultad',
            'dificultad_display',
            'estado',
            'estado_display',
            'es_personalizado',
            'visible_en_catalogo',
            'oculto_por_categoria',
            'materiales_discontinuados',
            'categorias',
            'categorias_de_baja',
            'imagen_principal',
            'cantidad_materiales',
            'cantidad_imagenes',
        ]

    def get_imagen_principal(self, obj):
        """Solo la ruta de la foto principal, o null si no tiene ninguna."""
        # El primer 'imagen' es la fila de ImagenProducto; el segundo,
        # su campo de archivo.
        imagen = obj.imagen_principal
        return imagen.imagen.url if imagen else None

    # Los dos contadores usan len() sobre la lista ya traída, NUNCA
    # .count(). Un .count() manda un SELECT COUNT(*) por cada producto
    # del listado e ignora el prefetch_related: es el mismo N+1 que
    # evitamos en las propiedades del modelo.

    def get_cantidad_materiales(self, obj):
        """Cuántos materiales distintos lleva la pieza."""
        # Cuento sobre 'materiales' y no sobre 'materiales_usados': da
        # el mismo número, porque la restricción de unicidad impide que
        # un material se repita en un producto, y así el listado tiene
        # una relación menos que prefetchear.
        return len(obj.materiales.all())

    def get_cantidad_imagenes(self, obj):
        """Cuántas fotos tiene cargadas la pieza."""
        return len(obj.imagenes.all())



class ProductoDetalleSerializer(ProductoListaSerializer):
    """Ficha completa de un producto (CU19).

    Todo lo de la grilla más lo que solo se mira de a un producto por
    vez: cómo se hace, qué materiales lleva y con qué cantidades, y
    todas sus fotos.

    Los materiales y las imágenes se muestran, pero no se cargan por
    acá: tienen sus propios casos de uso.
    """

    materiales_usados = MaterialProductoSerializer(many=True, read_only=True)
    imagenes = ImagenProductoSerializer(many=True, read_only=True)

    # Meta hereda de la del listado, así que no se repite el model ni
    # los dieciséis campos: solo se suman los tres que faltan.
    class Meta(ProductoListaSerializer.Meta):
        fields = ProductoListaSerializer.Meta.fields + [
            'paso_a_paso',
            'materiales_usados',
            'imagenes',
        ]
