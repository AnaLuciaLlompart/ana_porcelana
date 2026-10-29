from decimal import Decimal

from rest_framework import status

from pruebas.base import PruebaConSesion
from pedidos.models import Cobro, Pedido, ProductoDelPedido
from productos.models import Producto

from .models import Cliente
from .serializers import ClienteSerializer
from .views import clientes_con_cuentas

LISTA = '/api/clientes/'


class UsuarioDeInstagram(PruebaConSesion):
    """El usuario de Instagram es único y se guarda normalizado (CU36)."""

    def test_instagram_repetido_con_distintas_mayusculas_da_400(self):
        """CU36: ' @Sofi.Delgado' es la misma cuenta que 'sofi.delgado' y responde 400."""
        Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        respuesta = self.client.post(LISTA, {'instagram': ' @Sofi.Delgado', 'nombre': 'Sofi'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['instagram'], ['Ya tenés un cliente con ese usuario.'])
        self.assertEqual(Cliente.objects.count(), 1)

    def test_el_instagram_se_guarda_normalizado(self):
        """CU36: sin espacios, sin el @ inicial y en minúscula, como pide el modelo."""
        respuesta = self.client.post(LISTA, {'instagram': ' @Sofi.Delgado ', 'nombre': 'Sofía'})
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(respuesta.data['instagram'], 'sofi.delgado')
        self.assertEqual(Cliente.objects.get().instagram, 'sofi.delgado')


class EliminarClienteConPedidos(PruebaConSesion):
    """Un cliente con pedidos no se elimina, y no hay baja lógica que ofrecer (CU39)."""

    def test_eliminar_cliente_con_pedidos_da_400(self):
        """CU39: la FK PROTECT de Pedido se explica con un mensaje y el cliente sigue."""
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        Pedido.objects.create(cliente=cliente)

        respuesta = self.client.delete(f'{LISTA}{cliente.id}/')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede eliminar a @sofi.delgado porque tiene 1 pedido registrado. '
            'Los pedidos guardan el historial de lo que encargó, así que el cliente '
            'queda cargado.',
        )
        self.assertTrue(Cliente.objects.filter(pk=cliente.pk).exists())


class ListadoEnLaBase(PruebaConSesion):
    """El listado se filtra, se ordena y se pagina en la base (CU37, corrección D3)."""

    def setUp(self):
        super().setUp()
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00', dificultad=Producto.Dificultad.MEDIA,
        )
        # Sofía debe: un pedido en curso de $10.000 más $1.500 de envío a
        # cargo del emprendimiento, con $2.000 cobrados.
        self.sofi = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        pedido = Pedido.objects.create(
            cliente=self.sofi, forma_entrega=Pedido.FormaEntrega.MIO,
            costo_entrega=Decimal('1500.00'), fecha_pedido='2026-10-01',
        )
        ProductoDelPedido.objects.create(pedido=pedido, producto=producto, precio='5000.00', cantidad=2)
        Cobro.objects.create(pedido=pedido, monto='2000.00')
        # Mica no debe nada: su único pedido está entregado y pagado.
        self.mica = Cliente.objects.create(instagram='mica.luna', nombre='Micaela')
        pagado = Pedido.objects.create(
            cliente=self.mica, estado=Pedido.Estado.ENTREGADO, fecha_pedido='2026-09-01',
        )
        ProductoDelPedido.objects.create(pedido=pagado, producto=producto, precio='5000.00', cantidad=1)
        Cobro.objects.create(pedido=pagado, monto='5000.00')
        # Ana no tiene pedidos.
        self.ana = Cliente.objects.create(instagram='ana.ruiz', nombre='Ana')

    def ids(self, parametros):
        """Los ids de la primera página que devuelve el listado con esos parámetros."""
        respuesta = self.client.get(LISTA, {'pagina': 1, **parametros})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        return [cliente['id'] for cliente in respuesta.data['results']]

    def test_las_cuentas_de_la_base_son_las_del_serializer(self):
        """CU37: pedidos, pedidos en curso y saldo de la base dan lo mismo que el serializer."""
        clientes = clientes_con_cuentas().prefetch_related('pedidos__productos', 'pedidos__cobros')
        for cliente in clientes:
            datos = ClienteSerializer(cliente).data
            self.assertEqual(cliente.cantidad_pedidos_calculada, datos['cantidad_pedidos'])
            self.assertEqual(cliente.pedidos_en_curso_calculados, datos['pedidos_en_curso'])
            self.assertEqual(f'{cliente.saldo_calculado:.2f}', datos['saldo'])

    def test_filtra_por_los_dos_chips_y_busca_con_arroba(self):
        """CU37: con_saldo y en_curso dejan a quien corresponde; "@mica" encuentra a mica.luna."""
        self.assertEqual(self.ids({'con_saldo': 'si'}), [self.sofi.id])
        self.assertEqual(self.ids({'en_curso': 'si'}), [self.sofi.id])
        self.assertEqual(self.ids({'busqueda': '@mica'}), [self.mica.id])

    def test_ordena_por_ultimo_con_los_que_no_tienen_pedidos_al_final(self):
        """CU37: orden=-ultimo pone primero el pedido más nuevo y al final al cliente sin pedidos."""
        self.assertEqual(self.ids({'orden': '-ultimo'}), [self.sofi.id, self.mica.id, self.ana.id])

    def test_el_resumen_cuenta_sobre_todos_los_clientes(self):
        """CU37: el total de clientes y los números de los dos chips, sin mirar los filtros."""
        respuesta = self.client.get(f'{LISTA}resumen/', {'con_saldo': 'si'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data, {'clientes': 3, 'con_pedidos_en_curso': 1, 'con_saldo': 1})
