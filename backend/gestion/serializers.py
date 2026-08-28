from rest_framework import serializers

from .models import Material


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