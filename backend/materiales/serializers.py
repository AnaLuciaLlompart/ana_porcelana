from rest_framework import serializers

from config.validadores import validar_tamano_archivo

from .models import Material

# un serializer comvierte un objeto de python a JSON para que sea entendibler para React y viceversa
#valida el camino de entrada, es decir, cuando llega un formulario de React, verifica antes de contruir el objeto de python


class ImagenRelativaField(serializers.ImageField):
    """ImageField que devuelve la RUTA relativa en vez de la URL completa.

    El ImageField de DRF arma la URL absoluta —con host y puerto— cuando
    encuentra el request en el contexto, y en un ViewSet siempre está. Eso
    deja el dominio del servidor escrito adentro del JSON, y la aplicación
    queda atada a en qué máquina está corriendo.

    Con la ruta relativa la resuelve el navegador contra su propio origen,
    que es lo que necesita este proyecto: el servidor de Vite hace de proxy
    y reenvía /media al backend, así que para el navegador hay un solo
    origen.

    Solo cambia la SALIDA. to_internal_value queda igual, así que el campo
    sigue recibiendo archivos y sigue siendo escribible: no hace falta
    partir el serializer en uno de lectura y otro de escritura.
    """

    def to_representation(self, value):
        if not value:
            return None

        return value.url


class MaterialSerializer(serializers.ModelSerializer):
    """Serializer interno de Material (módulo de gestión privado)."""
    

    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )
    disponibilidad_display = serializers.CharField(
        source='get_disponibilidad_display',
        read_only=True,
    )

    # Al declarar el campo a mano se pierde TODO lo que el ModelSerializer
    # le armaba solo, así que hay que reponerlo acá: que sea opcional (el
    # modelo tiene blank y null), el validador de tamaño, y el mensaje
    # corto para el archivo que no es una imagen.
    #
    # El mensaje no puede quedar en extra_kwargs: eso solo alcanza a los
    # campos que arma el ModelSerializer, no a los declarados. Si se deja
    # allá, vuelve el texto de dos oraciones de DRF.
    url_imagen = ImagenRelativaField(
        required=False,
        allow_null=True,
        validators=[validar_tamano_archivo],
        error_messages={
            'invalid_image': 'El archivo adjunto o bien no es una imagen '
                             'o bien está dañado.',
        },
    )

    class Meta:
        model = Material
        fields = [
            'id',
            'nombre',
            'estado',
            'estado_display',
            'disponibilidad',
            'disponibilidad_display',
            'descripcion',
            'url_imagen',
        ]

