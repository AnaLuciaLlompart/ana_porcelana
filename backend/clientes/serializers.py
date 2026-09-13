from decimal import Decimal

from rest_framework import serializers

from pedidos.models import Pedido

from .models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    """Serializer de Cliente (CU36 a CU39)."""

    # Los tres salen de los pedidos del cliente, que el ViewSet trae con
    # prefetch_related. Se cuentan y se recorren en PYTHON sobre la lista
    # ya traída, nunca con .count() ni .filter() encadenados: son una fila
    # por cada cliente del listado, y una consulta por fila es el N+1 que
    # el prefetch venía a evitar.
    cantidad_pedidos = serializers.SerializerMethodField()
    pedidos_en_curso = serializers.SerializerMethodField()
    ultimo_pedido = serializers.SerializerMethodField()

    # El saldo del cliente sale de los saldos de sus pedidos, que a su vez
    # salen de sus productos y sus cobros. Por eso el prefetch del ViewSet
    # llega dos niveles más abajo que para los tres de arriba.
    #
    # max_digits es 12 porque suma varios pedidos, como en el serializer de
    # Pedido. Puede ser NEGATIVO si en algún pedido pagó de más.
    saldo = serializers.SerializerMethodField()
    esta_al_dia = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            'id',
            'instagram',
            'nombre',
            'apellido',
            'email',
            'cantidad_pedidos',
            'pedidos_en_curso',
            'ultimo_pedido',
            'saldo',
            'esta_al_dia',
        ]

    # -----------------------------------------------------------------
    # Normalización del usuario ANTES de validar, asi se comparan textos ya normalizados
    # -----------------------------------------------------------------
    def to_internal_value(self, data):

        if isinstance(data, dict) and isinstance(data.get('instagram'), str):
            data = data.copy() #hago una copia para no pisar lo que mandó el cliente
            data['instagram'] = data['instagram'].strip().removeprefix('@').lower()

        return super().to_internal_value(data)


    # -----------------------------------------------------------------
    # Lo que aportan los pedidos del cliente
    # -----------------------------------------------------------------
    def get_cantidad_pedidos(self, obj):
        """Cuántos pedidos le hizo al emprendimiento."""
        return len(obj.pedidos.all())

    def get_pedidos_en_curso(self, obj):
        """Cuántos de sus pedidos todavía no se entregaron.

        Es lo que la pantalla usa para el chip de filtro: un cliente con
        pedidos en curso es uno que espera algo.
        """
        return len([
            pedido
            for pedido in obj.pedidos.all()
            if pedido.estado != Pedido.Estado.ENTREGADO
        ])

    def get_ultimo_pedido(self, obj):
        """La fecha del último pedido que hizo, o None si no hizo ninguno.

        Es la FECHA DEL PEDIDO, no la de entrega: dice cuándo fue la
        última vez que encargó algo.

        No hace falta buscar el máximo: el ordering de Pedido es
        ['-fecha_pedido', '-id'], así que la lista ya viene del más nuevo
        al más viejo y alcanza con el primero.
        """
        pedidos = obj.pedidos.all()

        if len(pedidos) == 0:
            return None

        return pedidos[0].fecha_pedido

    def get_saldo(self, obj):
        """Cuánto le debe el cliente, sumando todos sus pedidos.

        Se apoya en la propiedad saldo de Pedido en vez de rehacer la
        cuenta: así la regla de qué es el saldo vive en un solo lugar.

        Puede dar NEGATIVO si en algún pedido pagó de más.
        """
        return sum(
            (pedido.saldo for pedido in obj.pedidos.all()),
            Decimal('0'),
        )

    def get_esta_al_dia(self, obj):
        """Si el cliente no debe nada.

        Incluye al que pagó de más: tampoco debe. Es el mismo criterio
        que usa el pedido.
        """
        return self.get_saldo(obj) <= 0
