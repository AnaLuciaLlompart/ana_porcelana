from rest_framework import serializers

from categorias.models import Categoria
from productos.models import ImagenProducto, Producto

# Los serializers del catálogo público. Lo que está en sus `fields` es
# TODO lo que un visitante sin sesión puede leer del sistema, así que cada
# lista está escrita entera y a mano: nada de '__all__'.
#
# Ninguno hereda de los serializers de gestión (ProductoListaSerializer,
# ProductoDetalleSerializer, CategoriaSerializer). Esos exponen el estado,
# los materiales, el paso a paso y las imágenes de referencia, y con una
# herencia cualquier campo que se les agregue mañana saldría también al
# público sin que nadie lo decida.
#
# Son todos de solo lectura: el catálogo no recibe datos.


class CategoriaCatalogoSerializer(serializers.ModelSerializer):
    """Una categoría como la ve el visitante (CU64).

    Sirve para dos cosas: las opciones del filtro por categoría y las
    categorías de cada producto. No lleva el estado, porque al catálogo
    solo llegan las activas, ni la descripción, que es una aclaración
    para la emprendedora.
    """

    # La etiqueta viaja al lado del código, como en todo el proyecto:
    # React no traduce 'TEMATICA' a "Temática".
    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )

    class Meta:
        model = Categoria
        fields = [
            'id',
            'nombre',
            'tipo',
            'tipo_display',
        ]


class ImagenCatalogoSerializer(serializers.ModelSerializer):
    """Una imagen de la pieza terminada (CU65).

    No lleva el tipo: al catálogo solo llegan las de resultado. Quien las
    separa de las de referencia es la consulta de la vista, no este
    serializer.
    """

    # La ruta relativa (/media/productos/x.jpg), por lo mismo que en
    # ImagenProductoSerializer: el campo por defecto armaría la URL
    # absoluta y dejaría el dominio escrito en el JSON.
    imagen = serializers.SerializerMethodField()

    class Meta:
        model = ImagenProducto
        fields = [
            'id',
            'imagen',
            'titulo',
            'orden',
        ]

    def get_imagen(self, obj):
        return obj.imagen.url


class ProductoCatalogoListaSerializer(serializers.ModelSerializer):
    """Un producto en la grilla del catálogo (CU63).

    Lo que hace falta para dibujar la tarjeta y para filtrar por
    categoría en el navegador.
    """

    dificultad_display = serializers.CharField(
        source='get_dificultad_display',
        read_only=True,
    )
    categorias = CategoriaCatalogoSerializer(many=True, read_only=True)
    imagen_principal = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'descripcion',
            'precio_actual',
            'dificultad',
            'dificultad_display',
            'categorias',
            'imagen_principal',
        ]

    def get_imagen_principal(self, obj):
        """Solo la ruta de la foto principal, o null si no tiene ninguna."""
        # Usa la propiedad del modelo, que es la única definición de
        # imagen principal del proyecto: la de orden más bajo entre las
        # de resultado.
        imagen = obj.imagen_principal
        return imagen.imagen.url if imagen else None


class ProductoCatalogoDetalleSerializer(ProductoCatalogoListaSerializer):
    """El detalle de un producto del catálogo (CU65).

    Lo mismo que la grilla más todas sus imágenes de resultado, en orden.

    Hereda del serializer público de la grilla, no del de gestión. Y
    `fields` se escribe entero en vez de sumarle a la lista del otro, para
    que lo que sale al público se lea completo acá.
    """

    imagenes = ImagenCatalogoSerializer(many=True, read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'descripcion',
            'precio_actual',
            'dificultad',
            'dificultad_display',
            'categorias',
            'imagen_principal',
            'imagenes',
        ]
