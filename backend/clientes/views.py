from rest_framework import viewsets, filters, status
from rest_framework.response import Response

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

    destroy() está sobrescrito: cuenta los pedidos del cliente antes de
    borrar, porque la clave foránea va con PROTECT y el error de la base
    saldría como un 500.
    """

    # El prefetch es lo que hace que los tres campos calculados del
    # serializer no disparen una consulta por cliente del listado.
    queryset = Cliente.objects.prefetch_related('pedidos')
    serializer_class = ClienteSerializer

    filter_backends = [filters.SearchFilter]
    search_fields = ['instagram', 'nombre', 'apellido', 'email']

    # -----------------------------------------------------------------
    # Sobreescribo destroy, para explicar por qué no se puede eliminar
    # -----------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        """Impide eliminar un cliente que tiene pedidos registrados.

        La clave foránea de Pedido es PROTECT, así que la base rechaza el
        borrado igual. Pero sin este chequeo la excepción sale como un
        500 con el traceback, y quien está del otro lado no se entera de
        por qué falló ni cuántos pedidos tiene el cliente.

        El mensaje NO ofrece darlo de baja, a diferencia del de
        materiales: Cliente no tiene baja lógica, así que esa salida no
        existe. La única es dejarlo cargado.
        """
        cliente = self.get_object()

        # Acá sí corresponde .count(): es un solo cliente y no hay ningún
        # prefetch que respetar, así que conviene una consulta que
        # devuelve un número antes que traerse las filas para contarlas
        # en Python.
        cantidad = cliente.pedidos.count()

        if cantidad > 0:
            con_pedidos = (
                '1 pedido registrado' if cantidad == 1
                else f'{cantidad} pedidos registrados'
            )

            return Response(
                {'detail': f'No se puede eliminar a @{cliente.instagram} porque '
                           f'tiene {con_pedidos}. Los pedidos guardan el '
                           f'historial de lo que encargó, así que el cliente '
                           f'queda cargado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)
