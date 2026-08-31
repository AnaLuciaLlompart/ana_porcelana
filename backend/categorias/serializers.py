from rest_framework import serializers

from .models import Categoria

# un serializer comvierte un objeto de python a JSON para que sea entendibler para React y viceversa
#valida el camino de entrada, es decir, cuando llega un formulario de React, verifica antes de contruir el objeto de python


class CategoriaSerializer(serializers.ModelSerializer):
    """Serializer de Categoría (CU11 a CU16)."""

    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )
    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )

    class Meta:
        model = Categoria
        fields = [
            'id',
            'nombre',
            'tipo',
            'tipo_display',
            'estado',
            'estado_display',
            'descripcion',
        ]