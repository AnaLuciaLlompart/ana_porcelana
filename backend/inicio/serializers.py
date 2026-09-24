from rest_framework import serializers

from materiales.models import Material
from pedidos.models import Pedido, ProductoDelPedido

# Como en finanzas, la respuesta de /api/inicio/ no es una fila de
# ninguna tabla: es un diccionario que arma la vista. Pasarlo por un
# serializer con los campos declarados deja escrita en un solo lugar la
# forma exacta de la respuesta, y hace que los importes (la deuda y el
# saldo de cada pedido) salgan como texto con dos decimales, igual que en
# el resto del proyecto. Un Decimal que se mete crudo en un Response lo
# convierte DRF a float.


# LAS FILAS DE LAS TRES LISTAS -----------------


class PedidoPorEntregarSerializer(serializers.ModelSerializer):
    """Un pedido en la tabla de próximas entregas de Inicio.

    Solo lo que la fila muestra: quién lo encargó, para cuándo es, en qué
    anda y cuánto debe. No hereda de PedidoListaSerializer, que trae
    diecisiete campos para el listado: acá van siete.

    saldo lee la propiedad del modelo, que es la única definición de
    saldo del proyecto. Para que eso no sean dos consultas por pedido, la
    vista trae los pedidos con prefetch_related('productos', 'cobros').
    """

    cliente_instagram = serializers.CharField(
        source='cliente.instagram',
        read_only=True,
    )
    cliente_nombre = serializers.CharField(
        source='cliente.nombre',
        read_only=True,
    )
    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )
    saldo = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Pedido
        fields = [
            'id',
            'cliente_instagram',
            'cliente_nombre',
            'fecha_entrega_estimada',
            'estado',
            'estado_display',
            'saldo',
        ]


class ProductoDelPedidoEnProduccionSerializer(serializers.ModelSerializer):
    """Un producto del pedido en la tabla EN PRODUCCIÓN de Inicio.

    Viaja con el nombre del producto, porque la tabla lo muestra, y con
    el id del pedido, porque la fila enlaza a su ficha y porque cambiar
    la etapa desde Inicio va por el PATCH de
    /api/pedidos/<pedido>/productos/<id>/ que ya existe en Pedidos.
    """

    producto_nombre = serializers.CharField(
        source='producto.nombre',
        read_only=True,
    )
    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )

    class Meta:
        model = ProductoDelPedido
        fields = [
            'id',
            'pedido',
            'producto_nombre',
            'descripcion',
            'cantidad',
            'estado',
            'estado_display',
            'fecha_cambio_estado',
        ]


class MaterialPorReponerSerializer(serializers.ModelSerializer):
    """Un material en la lista de materiales por reponer de Inicio."""

    disponibilidad_display = serializers.CharField(
        source='get_disponibilidad_display',
        read_only=True,
    )

    class Meta:
        model = Material
        fields = [
            'id',
            'nombre',
            'disponibilidad',
            'disponibilidad_display',
        ]


# LAS PARTES CALCULADAS ------------------------

# deuda va con max_digits=12 porque suma los saldos de varios pedidos, el
# mismo criterio que saldo en PedidoListaSerializer. Ningún campo lleva
# read_only porque estos serializers son enteros de salida: nunca reciben
# datos.


class TotalesDeHoySerializer(serializers.Serializer):
    """Los cuatro números de arriba de la pantalla de Inicio."""

    pedidos_atrasados = serializers.IntegerField()
    entregas_proximas = serializers.IntegerField()
    materiales_por_reponer = serializers.IntegerField()
    deuda = serializers.DecimalField(max_digits=12, decimal_places=2)


# Cada lista viaja con su total, que es cuántos hay en la base y no
# cuántos se muestran: es el número del enlace "Ver todos".


class ProximasEntregasSerializer(serializers.Serializer):
    """La lista de próximas entregas: cuántos pedidos hay sin entregar y los primeros."""

    total = serializers.IntegerField()
    pedidos = PedidoPorEntregarSerializer(many=True)


class EnProduccionSerializer(serializers.Serializer):
    """La tabla EN PRODUCCIÓN: cuántas piezas hay sin terminar y las primeras."""

    total = serializers.IntegerField()
    productos = ProductoDelPedidoEnProduccionSerializer(many=True)


class MaterialesPorReponerSerializer(serializers.Serializer):
    """La lista de materiales por reponer: cuántos hay en Baja y los primeros."""

    total = serializers.IntegerField()
    materiales = MaterialPorReponerSerializer(many=True)


# LA RESPUESTA COMPLETA ------------------------


class ResumenDeHoySerializer(serializers.Serializer):
    """La respuesta completa de GET /api/inicio/.

    Es de solo salida: nadie manda esto al servidor. La vista arma un
    diccionario con estas cinco claves y el serializer lo convierte en el
    JSON que lee la pantalla.
    """

    hoy = serializers.DateField()
    totales = TotalesDeHoySerializer()
    proximas_entregas = ProximasEntregasSerializer()
    en_produccion = EnProduccionSerializer()
    materiales_por_reponer = MaterialesPorReponerSerializer()
