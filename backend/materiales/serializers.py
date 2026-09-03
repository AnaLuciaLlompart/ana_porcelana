from rest_framework import serializers
from .models import Material

# un serializer comvierte un objeto de python a JSON para que sea entendibler para React y viceversa
#valida el camino de entrada, es decir, cuando llega un formulario de React, verifica antes de contruir el objeto de python


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
        # DRF trae un mensaje de dos oraciones para el archivo que no es una
        # imagen: "Adjunte una imagen válida. El archivo adjunto o bien no
        # es una imagen o bien está dañado." La primera oración no aporta
        # nada, así que se deja solo la segunda. Es el mismo texto que usa
        # la subida de imágenes de productos.
        #
        # Va en extra_kwargs y no declarando el campo de nuevo, porque así
        # el campo lo sigue armando el modelo: conserva el upload_to, el
        # max_length y el validador de 15 MB.
        extra_kwargs = {
            'url_imagen': {
                'error_messages': {
                    'invalid_image': 'El archivo adjunto o bien no es una imagen '
                                     'o bien está dañado.',
                },
            },
        }

