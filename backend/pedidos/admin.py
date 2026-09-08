from django.contrib import admin

from .models import Pedido, ProductoDelPedido


# El inline es un formulario de un modelo hijo incrustado dentro del
# formulario del padre. Sirve para cargar un pedido con sus productos de
# una sola vez: sin él habría que guardar el pedido primero y recién
# después ir a agregarle los productos uno por uno.

class ProductoDelPedidoInline(admin.TabularInline):
    model = ProductoDelPedido


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'estado', 'fecha_pedido', 'fecha_entrega_estimada')
    list_filter = ('estado', 'envio_a_cargo')

    # El doble guion bajo salta a la tabla de al lado: el pedido no
    # tiene instagram ni nombre, los tiene el cliente al que apunta la
    # clave foránea.
    search_fields = ('cliente__instagram', 'cliente__nombre')

    inlines = [ProductoDelPedidoInline]


# ProductoDelPedido va DOS veces: como inline acá arriba y con su propio
# ModelAdmin acá abajo. Es una diferencia con MaterialProducto e
# ImagenProducto, que solo viven dentro de la ficha de su producto.
# El motivo es que los productos del pedido también se miran de corrido,
# sin importar a qué pedido pertenecen: para ver todo lo que está en
# secado, por ejemplo. Registrarlo aparte le da su propia entrada en el
# menú del admin, con el filtro por etapa productiva.

@admin.register(ProductoDelPedido)
class ProductoDelPedidoAdmin(admin.ModelAdmin):
    list_display = ('pedido', 'producto', 'cantidad', 'precio', 'estado', 'fecha_cambio_estado')
    list_filter = ('estado',)
    search_fields = ('producto__nombre', 'pedido__cliente__instagram')
