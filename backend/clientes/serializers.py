from rest_framework import serializers

from .models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    """Serializer de Cliente (CU36 a CU39)."""

    class Meta:
        model = Cliente
        fields = [
            'id',
            'instagram',
            'nombre',
            'apellido',
            'email',
        ]

    # -----------------------------------------------------------------
    # Normalización del usuario ANTES de validar, asi se comparan textos ya normalizados
    # -----------------------------------------------------------------
    def to_internal_value(self, data):

        if isinstance(data, dict) and isinstance(data.get('instagram'), str):
            data = data.copy() #hago una copia para no pisar lo que mandó el cliente
            data['instagram'] = data['instagram'].strip().removeprefix('@').lower()

        return super().to_internal_value(data)
