from django.contrib import admin

from .models import Material, Usuario

admin.site.register(Usuario)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'disponibilidad', 'estado')
    list_filter = ('disponibilidad', 'estado')
    search_fields = ('nombre', 'descripcion')