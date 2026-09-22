from rest_framework import serializers

from gastos.models import Gasto
from pedidos.models import Cobro

# Acá está el primer serializers.Serializer del proyecto que
# no es ModelSerializer. La respuesta de /api/finanzas/ no es una fila de
# ninguna tabla: es un diccionario que arma la vista con sumas hechas en
# la base. Pasarlo por un serializer con los campos declarados hace dos
# cosas: deja escrita en un solo lugar la forma exacta de la respuesta, y
# hace que los importes salgan como texto con dos decimales ("1500.00"),
# igual que en el resto del proyecto. Un Decimal que se mete crudo en un
# Response lo convierte DRF a float.


# LAS DOS LISTAS -------------------------------


class CobroDelPeriodoSerializer(serializers.ModelSerializer):
    """Un cobro en la tabla de ingresos del período (CU62).

    Viaja con el instagram y el nombre del cliente al lado del id del
    pedido, porque la tabla los muestra. source atraviesa dos relaciones
    (el pedido y su cliente), y para que eso no sean dos consultas por
    fila la vista trae los cobros con select_related('pedido__cliente').

    No trae el medio de pago: la tabla no lo muestra, solo lo usa el
    desglose, que viene aparte.
    """

    cliente_instagram = serializers.CharField(
        source='pedido.cliente.instagram',
        read_only=True,
    )
    cliente_nombre = serializers.CharField(
        source='pedido.cliente.nombre',
        read_only=True,
    )
    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )

    class Meta:
        model = Cobro
        fields = [
            'id',
            'fecha',
            'pedido',
            'cliente_instagram',
            'cliente_nombre',
            'tipo',
            'tipo_display',
            'monto',
        ]


class GastoDelPeriodoSerializer(serializers.ModelSerializer):
    """Un gasto en la tabla de gastos del período (CU61).

    Solo lo que la tabla muestra. Los materiales del gasto no van: para
    verlos está la ficha del gasto.
    """

    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )

    class Meta:
        model = Gasto
        fields = [
            'id',
            'fecha',
            'tipo',
            'tipo_display',
            'descripcion',
            'monto',
        ]


# LAS PARTES CALCULADAS ------------------------

# Los importes van con max_digits=12 y no 10 porque son sumas
# de varias filas, el mismo criterio que subtotal y total en
# pedidos/serializers.py. Ningún campo lleva read_only porque estos
# serializers son enteros de salida: nunca reciben datos.


class TotalesSerializer(serializers.Serializer):
    """Los tres números de arriba de la pantalla y las dos cantidades (CU61 y CU62)."""

    ingresos = serializers.DecimalField(max_digits=12, decimal_places=2)
    gastos = serializers.DecimalField(max_digits=12, decimal_places=2)
    resultado = serializers.DecimalField(max_digits=12, decimal_places=2)
    cantidad_cobros = serializers.IntegerField()
    cantidad_gastos = serializers.IntegerField()


class IngresosPorMedioSerializer(serializers.Serializer):
    """Lo cobrado por un medio de pago en el período (CU62)."""

    medio = serializers.CharField()
    medio_display = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class GastosPorTipoSerializer(serializers.Serializer):
    """Lo gastado en un tipo de gasto en el período (CU61)."""

    tipo = serializers.CharField()
    tipo_display = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class MesDeLaEvolucionSerializer(serializers.Serializer):
    """Un mes del gráfico de evolución (CU61 y CU62). La clave es AAAA-MM."""

    mes = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=12, decimal_places=2)
    gastos = serializers.DecimalField(max_digits=12, decimal_places=2)


# LA RESPUESTA COMPLETA ------------------------


class FinanzasDelPeriodoSerializer(serializers.Serializer):
    """La respuesta completa de GET /api/finanzas/ (CU61 y CU62).

    Es de solo salida: nadie manda esto al servidor. La vista arma un
    diccionario con estas seis claves y el serializer lo convierte en el
    JSON que lee la pantalla.
    """

    totales = TotalesSerializer()
    ingresos_por_medio = IngresosPorMedioSerializer(many=True)
    gastos_por_tipo = GastosPorTipoSerializer(many=True)
    evolucion = MesDeLaEvolucionSerializer(many=True)
    cobros = CobroDelPeriodoSerializer(many=True)
    gastos = GastoDelPeriodoSerializer(many=True)
