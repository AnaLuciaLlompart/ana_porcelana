from django.contrib import admin

from .models import Cliente


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('instagram', 'nombre', 'apellido', 'email')
    search_fields = ('instagram', 'nombre', 'apellido')

    # Sin list_filter: Cliente no tiene ningún campo categórico por el
    # que filtrar. No hay estado, y filtrar por nombre o email no
    # agrupa nada.
