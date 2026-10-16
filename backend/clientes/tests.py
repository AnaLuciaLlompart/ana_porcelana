from rest_framework import status

from pruebas.base import PruebaConSesion
from pedidos.models import Pedido

from .models import Cliente

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
