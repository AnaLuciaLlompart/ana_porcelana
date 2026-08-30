from django.contrib import admin

from .models import Material, Usuario, Categoria

admin.site.register(Usuario)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'disponibilidad', 'estado')
    list_filter = ('disponibilidad', 'estado')
    search_fields = ('nombre', 'descripcion')



@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'estado', 'descripcion')
    list_filter = ('tipo', 'estado')
    search_fields = ('nombre', 'descripcion')