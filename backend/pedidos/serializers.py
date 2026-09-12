from rest_framework import serializers

from .models import Cobro, Pedido, ProductoDelPedido

# Hay DOS serializers de Pedido y no uno, por lo mismo que en Productos:
# la tabla del listado trae muchos pedidos y no necesita el detalle de
# cada pieza encargada. La ficha sí.


# PRODUCTOS DEL PEDIDO ---------------------------


class ProductoDelPedidoSerializer(serializers.ModelSerializer):
    """Un producto dentro de un pedido (CU44, CU45).

    Viaja con el nombre del producto al lado del id, porque la tabla de
    la ficha lo muestra y no tiene por qué cruzar la lista de productos
    por su cuenta.

    El precio es el CONGELADO, el que se acordó con el cliente. Puede no
    coincidir con el precio_actual del catálogo, y esa es justamente la
    idea.
    """

    producto_nombre = serializers.CharField(
        source='producto.nombre',
        read_only=True,
    )
    estado_display = serializers.CharField(
        source='get_estado_display',
        read_only=True,
    )

    # Lee la propiedad del modelo, que se llama igual. Va tipado y no
    # como ReadOnlyField genérico para que quede escrito qué devuelve, y
    # para que salga con el mismo formato que precio. max_digits es 12 y
    # no 10 porque este número es un precio multiplicado por una
    # cantidad, así que puede pasarse de los dígitos de un precio suelto.
    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    producto_tiene_materiales = serializers.SerializerMethodField()

    class Meta:
        model = ProductoDelPedido
        fields = [
            'id',
            'producto',
            'producto_nombre',
            'producto_tiene_materiales',
            'precio',
            'cantidad',
            'subtotal',
            'descripcion',
            'estado',
            'estado_display',
            'fecha_cambio_estado',
        ]
        # La fecha la maneja el ViewSet, que la actualiza cuando cambia
        # la etapa. Quien llama no la manda: si pudiera, la fecha dejaría
        # de significar "desde cuándo la pieza está en esta etapa".
        extra_kwargs = {
            'fecha_cambio_estado': {'read_only': True},
        }

    def get_producto_tiene_materiales(self, obj):
        """Si el producto tiene materiales cargados.

        Es lo que el frontend mira para decidir si muestra el enlace a
        los materiales de la pieza: el enlace no aparece cuando no hay
        nada que ver.
        """
        # len() sobre la lista ya traída por el prefetch, nunca
        # .exists(): eso sería una consulta por cada línea del pedido.
        return len(obj.producto.materiales.all()) > 0


class ProductoDelPedidoModificarSerializer(serializers.ModelSerializer):
    """Modificar un producto ya cargado en el pedido (CU46).

    Solo la cantidad, el precio, la descripción y la etapa productiva.

    El producto NO está entre los campos, y eso es lo que garantiza que
    no se pueda cambiar: para encargar otra pieza se quita esta línea y
    se agrega otra, porque cambiarla sería otra cosa encargada. Es la
    misma garantía estructural que usa ImagenProductoModificarSerializer
    con el archivo de las imágenes.
    """

    class Meta:
        model = ProductoDelPedido
        fields = [
            'cantidad',
            'precio',
            'descripcion',
            'estado',
        ]


# COBROS -----------------------------------------


class CobroSerializer(serializers.ModelSerializer):
    """Un pago del pedido (CU48 a CU51).

    Viaja con las etiquetas legibles al lado de los códigos, como todo
    valor con choices del proyecto: la pantalla muestra «Seña» y
    «Transferencia», no SENA ni TRANSFERENCIA.
    """

    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True,
    )
    medio_display = serializers.CharField(
        source='get_medio_display',
        read_only=True,
    )

    class Meta:
        model = Cobro
        fields = [
            'id',
            'tipo',
            'tipo_display',
            'monto',
            'fecha',
            'medio',
            'medio_display',
        ]


# PEDIDOS ---------------------------------------


class PedidoListaSerializer(serializers.ModelSerializer):
    """Pedido en la tabla del listado (CU41).

    Trae lo justo para dibujar una fila: quién lo hizo, en qué anda, para
    cuándo es y cuánto suma.

    Los productos del pedido no viajan enteros acá, pero igual hacen falta
    para armar la respuesta: la columna TOTAL los suma y la columna
    CONTENIDO muestra sus nombres. Por eso el ViewSet los trae con
    prefetch_related también en el listado.
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
    envio_a_cargo_display = serializers.CharField(
        source='get_envio_a_cargo_display',
        read_only=True,
    )

    # Los tres leen las propiedades calculadas del modelo, que se llaman
    # igual. subtotal y total llevan max_digits=12 porque suman líneas y
    # pueden pasarse de los diez dígitos de un precio suelto;
    # costo_envio_a_cobrar se queda en 10, que es lo que tiene el campo
    # costo_entrega del que sale.
    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    costo_envio_a_cobrar = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    total = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    # Lo que aportan los cobros. cobrado y saldo llevan max_digits=12 por
    # lo mismo que subtotal y total: suman varias filas. El saldo puede
    # ser NEGATIVO cuando el cliente pagó de más, y DecimalField lo
    # admite sin más.
    cobrado = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    saldo = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    esta_al_dia = serializers.BooleanField(read_only=True)

    cantidad_productos = serializers.SerializerMethodField()
    productos_nombres = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id',
            'cliente',
            'cliente_instagram',
            'cliente_nombre',
            'estado',
            'estado_display',
            'fecha_pedido',
            'fecha_entrega_estimada',
            'fecha_entrega_real',
            'envio_a_cargo',
            'envio_a_cargo_display',
            'direccion_entrega',
            'costo_entrega',
            'subtotal',
            'costo_envio_a_cobrar',
            'total',
            'cobrado',
            'saldo',
            'esta_al_dia',
            'cantidad_productos',
            'productos_nombres',
        ]
        # El estado se lee pero no se escribe por acá: para cambiarlo está
        # cambiar_estado, que además escribe la fecha de entrega real al
        # pasar el pedido a Entregado.
        #
        # Sin esto la regla se podría saltear: un PUT con 'estado' adentro
        # lo cambiaría igual y la fecha quedaría sin completar. Que el
        # campo sea de solo lectura lo impide de raíz, en vez de confiar en
        # que nadie lo mande.
        #
        # El alta no lo necesita: un pedido nace PENDIENTE por el valor por
        # defecto del modelo.
        extra_kwargs = {
            'estado': {'read_only': True},
        }

    def get_cantidad_productos(self, obj):
        """Cuántas filas de productos tiene el pedido."""
        # len() sobre la lista prefetcheada, NUNCA .count(): un count
        # manda un SELECT por cada pedido del listado e ignora el
        # prefetch_related.
        return len(obj.productos.all())

    def get_productos_nombres(self, obj):
        """Los nombres distintos de los productos del pedido, en orden.

        La columna CONTENIDO del listado muestra el primero y un «+N» con
        los que siguen, y ese N cuenta productos DISTINTOS, no filas: el
        mismo producto puede figurar dos veces en un pedido si difiere en
        variante o en precio, y ahí sigue siendo una sola pieza para el
        que lee la tabla.

        Se arma con un for y un 'not in', no con un set: el set no
        conserva el orden, y el primero de la lista es justamente el que
        se muestra.
        """
        nombres = []

        # Sobre la lista ya traída por el prefetch, como todo lo demás.
        for linea in obj.productos.all():
            if linea.producto.nombre not in nombres:
                nombres.append(linea.producto.nombre)

        return nombres


class PedidoDetalleSerializer(PedidoListaSerializer):
    """Ficha completa de un pedido (CU40, CU42).

    Todo lo de la fila más los productos encargados, con su cantidad, su
    precio congelado y en qué etapa productiva está cada uno.

    Los productos se muestran, pero no se cargan por acá: tienen sus
    propios casos de uso.
    """

    productos = ProductoDelPedidoSerializer(many=True, read_only=True)
    cobros = CobroSerializer(many=True, read_only=True)

    # Meta hereda de la del listado, así que no se repite el model ni los
    # diecisiete campos: solo se suma el que falta.
    class Meta(PedidoListaSerializer.Meta):
        fields = PedidoListaSerializer.Meta.fields + [
            'productos',
            'cobros',
        ]
