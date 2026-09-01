from django.contrib import admin

from .models import ImagenProducto, MaterialProducto, Producto


# Los inlines son formularios de un modelo hijo incrustados dentro del
# formulario del padre. Ni MaterialProducto ni ImagenProducto se
# registran con @admin.register: no aparecen en el menú del admin,
# solo dentro de la ficha del producto al que pertenecen.

class MaterialProductoInline(admin.TabularInline):
    model = MaterialProducto


class ImagenProductoInline(admin.TabularInline):
    model = ImagenProducto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio_actual', 'dificultad', 'estado', 'es_personalizado')
    list_filter = ('dificultad', 'estado', 'es_personalizado')
    search_fields = ('nombre',)
    filter_horizontal = ('categorias',)
    inlines = [MaterialProductoInline, ImagenProductoInline]
