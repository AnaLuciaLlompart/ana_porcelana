from rest_framework import serializers

from .models import Gasto, MaterialDelGasto

# Hay UN solo serializer de Gasto y no dos como en Pedidos: el listado
# necesita igual los materiales de cada gasto, porque la tabla muestra
# cuántos son y el buscador local busca por el nombre del material. Y son
# pocas filas por gasto, así que mandarlas en el listado no pesa.


# MATERIALES DEL GASTO ---------------------------


class MaterialDelGastoSerializer(serializers.ModelSerializer):
    """Un material comprado en un gasto (CU56, CU57).

    Viaja con el nombre, el estado y la disponibilidad del material al
    lado del id, porque la tabla de la ficha los muestra y no tiene por
    qué cruzar la lista de materiales por su cuenta: avisa si uno quedó
    discontinuado y apaga el botón de disponibilidad Alta según la que ya
    tiene.

    Los valores con choices van acompañados de su etiqueta legible, como
    en todo el proyecto: React no traduce códigos.
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
    # Material, igual que en MaterialProductoSerializer.
    material_estado_display = serializers.CharField(
        source='material.get_estado_display',
        read_only=True,
    )
    material_disponibilidad = serializers.CharField(
        source='material.disponibilidad',
        read_only=True,
    )
    material_disponibilidad_display = serializers.CharField(
        source='material.get_disponibilidad_display',
        read_only=True,
    )

    # Lee la propiedad del modelo, que se llama igual. max_digits es 12 y
    # no 10 porque este número es un precio multiplicado por una cantidad,
    # así que puede pasarse de los dígitos de un precio suelto.
    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = MaterialDelGasto
        fields = [
            'id',
            'material',
            'material_nombre',
            'material_estado',
            'material_estado_display',
            'material_disponibilidad',
            'material_disponibilidad_display',
            'cantidad',
            'precio_unitario',
            'subtotal',
        ]


class MaterialDelGastoModificarSerializer(serializers.ModelSerializer):
    """Modificar un material ya cargado en el gasto (CU58).

    Solo la cantidad y el precio unitario.

    El material NO está entre los campos, y eso es lo que garantiza que
    no se pueda cambiar: para anotar otro material se quita esta fila y
    se agrega otra, porque cambiarlo sería otra cosa comprada. Es la
    misma garantía estructural que usa ProductoDelPedidoModificarSerializer
    con el producto.
    """

    class Meta:
        model = MaterialDelGasto
        fields = [
            'cantidad',
            'precio_unitario',
        ]


# GASTOS ---------------------------------------


class GastoSerializer(serializers.ModelSerializer):
    """Serializer de Gasto (CU52 a CU55).

    Los materiales del gasto se muestran, pero no se cargan por acá:
    tienen sus propios casos de uso.
    """

    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )

    materiales = MaterialDelGastoSerializer(many=True, read_only=True)

    class Meta:
        model = Gasto
        fields = [
            'id',
            'tipo',
            'tipo_display',
            'fecha',
            'monto',
            'descripcion',
            'materiales',
        ]

    def validate(self, datos):
        """Las dos reglas del monto, que dependen del tipo.

        Van acá y no en el ViewSet porque son reglas de una fila sola: se
        deciden mirando el tipo y el monto de este gasto, nada más.

        Si el gasto es de MATERIALES, el monto que haya venido en el cuerpo
        SE IGNORA: lo escribe el ViewSet sumando los materiales del gasto,
        que es la única puerta. DRF no sabe hacer un campo de solo lectura
        según el valor de otro, así que se saca de los datos validados. Es
        el mismo candado que estado en PedidoListaSerializer: sin esto, un
        PUT pisaría lo que calculó _recalcular_monto.

        Si es de PUBLICIDAD o de OTRO, el monto lo carga la usuaria y tiene
        que ser mayor a cero. El validator del modelo solo frena los
        negativos, porque el cero sí es válido para un gasto de materiales.

        Con un PATCH puede no venir el tipo, o no venir el monto: en ese
        caso vale el que el gasto ya tiene. self.instance es None en el
        alta y el gasto que se está modificando en el resto.
        """
        if 'tipo' in datos:
            tipo = datos['tipo']
        else:
            tipo = self.instance.tipo

        if tipo == Gasto.Tipo.MATERIALES:
            datos.pop('monto', None)
            return datos

        if 'monto' in datos:
            monto = datos['monto']
        elif self.instance is not None:
            monto = self.instance.monto
        else:
            monto = None

        if monto is None or monto <= 0:
            raise serializers.ValidationError(
                {'monto': 'El monto del gasto tiene que ser mayor a cero.'}
            )

        return datos
