from django.contrib import admin

from .models import Gasto, MaterialDelGasto


# El inline es un formulario de un modelo hijo incrustado dentro del
# formulario del padre, igual que los productos del pedido. MaterialDelGasto
# no se registra con @admin.register: no aparece en el menú del admin, solo
# dentro de la ficha del gasto al que pertenece.
#
# Por acá se pueden escribir el monto y cambiar el tipo a mano, sin pasar
# por las reglas del ViewSet. Se acepta: el admin es herramienta de
# desarrollo, no interfaz de usuaria.

class MaterialDelGastoInline(admin.TabularInline):
    model = MaterialDelGasto


@admin.register(Gasto)
class GastoAdmin(admin.ModelAdmin):
    list_display = ('id', 'tipo', 'fecha', 'monto', 'descripcion')
    list_filter = ('tipo',)
    search_fields = ('descripcion',)

    inlines = [MaterialDelGastoInline]
