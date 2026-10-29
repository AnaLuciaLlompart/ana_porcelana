from datetime import date
from decimal import Decimal

from django.db.models import (
    Count, DecimalField, ExpressionWrapper, F, Max, OuterRef, Q, Subquery, Sum, Value,
)
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from config.listados import ordenar
from config.paginacion import PaginacionDeListado
from pedidos.models import Cobro, Pedido, ProductoDelPedido

from .models import Cliente
from .serializers import ClienteSerializer, ResumenDeClientesSerializer

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


def clientes_con_cuentas():
    """Los clientes con sus pedidos, su último pedido y su saldo calculados por la base (CU37).

    Son las mismas cuentas que hace ClienteSerializer recorriendo los
    pedidos prefetcheados, escritas para que las resuelva PostgreSQL: el
    listado filtra y ordena por ellas (corrección D3), y la base no puede
    filtrar por algo que solo existe en Python. Las dos tienen que decir lo
    mismo: si cambia una, cambia la otra. Una prueba de clientes/tests.py
    compara las dos.

    El saldo del cliente es la suma de los saldos de sus pedidos, y el
    saldo de un pedido es lo de sus productos, más el envío si está a cargo
    del emprendimiento, menos lo cobrado. Sumado sobre todos los pedidos da
    lo mismo que sumar cada parte por separado, y así cada suma va en su
    propia subconsulta: con los productos y los cobros en la misma, el
    JOIN los multiplicaría entre sí (el mismo motivo que en
    Pedido.objects.con_totales()).

    Vive acá y no en un manager de Cliente porque necesita los modelos de
    pedidos, y pedidos/models.py ya importa Cliente: importarlos desde
    clientes/models.py los haría importarse entre sí.
    """
    importe = DecimalField(max_digits=12, decimal_places=2)
    cero = Value(Decimal('0'), output_field=importe)

    def una_fila_por_cliente(queryset, campo_cliente, **cuenta):
        """La consulta de una cuenta, agrupada por el cliente de afuera, para un Subquery."""
        return (
            queryset
            .filter(**{campo_cliente: OuterRef('pk')})
            .order_by()
            .values(campo_cliente)
            .annotate(**cuenta)
            .values(*cuenta.keys())
        )

    productos = una_fila_por_cliente(
        ProductoDelPedido.objects, 'pedido__cliente',
        suma=Sum(ExpressionWrapper(F('precio') * F('cantidad'), output_field=importe)),
    )
    # El envío entra solo si está a cargo del emprendimiento y tiene costo
    # cargado: la misma regla que Pedido.costo_envio_a_cobrar.
    envios = una_fila_por_cliente(
        Pedido.objects.filter(forma_entrega=Pedido.FormaEntrega.MIO, costo_entrega__isnull=False),
        'cliente', suma=Sum('costo_entrega'),
    )
    cobros = una_fila_por_cliente(Cobro.objects, 'pedido__cliente', suma=Sum('monto'))
    cantidad = una_fila_por_cliente(Pedido.objects, 'cliente', cuenta=Count('id'))
    en_curso = una_fila_por_cliente(
        Pedido.objects.exclude(estado=Pedido.Estado.ENTREGADO), 'cliente', cuenta=Count('id'),
    )
    ultimo = una_fila_por_cliente(Pedido.objects, 'cliente', fecha=Max('fecha_pedido'))

    return Cliente.objects.annotate(
        cantidad_pedidos_calculada=Coalesce(Subquery(cantidad), 0),
        pedidos_en_curso_calculados=Coalesce(Subquery(en_curso), 0),
        # Para ordenar por ÚLTIMO: el cliente sin pedidos cuenta como el más
        # viejo, así queda primero de menor a mayor y último de mayor a menor,
        # que es el orden con que arranca la tabla.
        ultimo_para_ordenar=Coalesce(Subquery(ultimo), Value(date.min)),
        saldo_calculado=(
            Coalesce(Subquery(productos, output_field=importe), cero)
            + Coalesce(Subquery(envios, output_field=importe), cero)
            - Coalesce(Subquery(cobros, output_field=importe), cero)
        ),
    )


# Las columnas por las que se puede ordenar el listado (?orden=saldo, o
# ?orden=-saldo para al revés). NOMBRE va por nombre y después apellido,
# así dos Sofías quedan ordenadas entre sí por el apellido.
ORDENES = {
    'instagram': ['instagram'],
    'nombre': ['nombre', 'apellido'],
    'pedidos': ['cantidad_pedidos_calculada'],
    'ultimo': ['ultimo_para_ordenar'],
    'saldo': ['saldo_calculado'],
}


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

    # El prefetch es lo que hace que los campos calculados del serializer
    # no disparen una consulta por cliente del listado.
    #
    # Llega dos niveles abajo porque el saldo del cliente es la suma de
    # los saldos de sus pedidos, y el saldo de un pedido sale de sus
    # productos y sus cobros. Sin esto serían dos consultas por cada
    # pedido de cada cliente.
    queryset = Cliente.objects.prefetch_related('pedidos__productos', 'pedidos__cobros')
    serializer_class = ClienteSerializer

    # El listado se pagina con ?pagina= (corrección D3), con los filtros y
    # el orden resueltos en la base por _filtrar(). Reemplaza al
    # SearchFilter de DRF.
    pagination_class = PaginacionDeListado

    def get_queryset(self):
        """En el listado, las cuentas de la base, los filtros y el orden de la URL."""
        if self.action == 'list':
            queryset = clientes_con_cuentas().prefetch_related('pedidos__productos', 'pedidos__cobros')
            return self._filtrar(queryset)

        return super().get_queryset()

    def _filtrar(self, queryset):
        """Aplica al listado la búsqueda, los dos chips y el orden de la URL (CU37).

          busqueda=texto     usuario de Instagram (con o sin @), nombre,
                             apellido o email
          en_curso=si        solo los que tienen pedidos sin entregar
          con_saldo=si       solo los que deben algo
          orden=saldo        una clave de ORDENES; con '-', al revés

        Los dos chips se pueden marcar juntos, como en la pantalla.
        """
        parametros = self.request.query_params

        # Sin el @ de adelante, como lo guarda el modelo: si no, buscar
        # "@sofi" no encontraría a "sofi.delgado".
        texto = parametros.get('busqueda', '').strip().lstrip('@')
        if texto:
            queryset = queryset.filter(
                Q(instagram__icontains=texto)
                | Q(nombre__icontains=texto)
                | Q(apellido__icontains=texto)
                | Q(email__icontains=texto)
            )

        if parametros.get('en_curso') == 'si':
            queryset = queryset.filter(pedidos_en_curso_calculados__gt=0)

        if parametros.get('con_saldo') == 'si':
            queryset = queryset.filter(saldo_calculado__gt=0)

        # Sin orden elegido queda el del modelo, por usuario de Instagram.
        return ordenar(queryset, parametros, ORDENES, ['instagram'])

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """La línea de arriba del listado y los números de los dos chips. Es parte de CU37.

        Cuentan sobre TODOS los clientes y no sobre los filtrados: dicen
        cómo viene el trabajo, no qué se está mirando. Son tres consultas,
        siempre las mismas.
        """
        con_cuentas = clientes_con_cuentas()

        datos = {
            'clientes': Cliente.objects.count(),
            'con_pedidos_en_curso': con_cuentas.filter(pedidos_en_curso_calculados__gt=0).count(),
            'con_saldo': con_cuentas.filter(saldo_calculado__gt=0).count(),
        }

        return Response(ResumenDeClientesSerializer(datos).data)

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
