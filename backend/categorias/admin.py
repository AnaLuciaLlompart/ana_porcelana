from django.contrib import admin

from .models import Categoria


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'estado', 'descripcion')
    list_filter = ('tipo', 'estado')
    search_fields = ('nombre', 'descripcion')