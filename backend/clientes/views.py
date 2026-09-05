from rest_framework import viewsets, filters

from .models import Cliente
from .serializers import ClienteSerializer

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


class ClienteViewSet(viewsets.ModelViewSet):
    """CRUD de clientes (CU36 a CU39).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    A diferencia de materiales y categorías, acá no hay update()
    sobrescrito ni acciones propias: Cliente no tiene baja lógica, así
    que no existe ningún estado que deje al registro de solo lectura ni
    operaciones fuera del CRUD.

    destroy() se sobrescribe cuando exista la app pedidos: hay que
    contar los pedidos del cliente antes de borrar, porque la clave
    foránea va con PROTECT y el error de la base saldría como un 500.
    """

    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

    filter_backends = [filters.SearchFilter]
    search_fields = ['instagram', 'nombre', 'apellido', 'email']
