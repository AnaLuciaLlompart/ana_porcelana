from rest_framework import status

from clientes.models import Cliente
from pruebas.base import PruebaConSesion
from gastos.models import Gasto
from pedidos.models import Cobro, Pedido, ProductoDelPedido
from productos.models import Producto

URL = '/api/finanzas/'


class FinanzasDelPeriodo(PruebaConSesion):
    """Ingresos, gastos y resultado de un período (CU61, CU62)."""

    def test_desde_posterior_a_hasta_da_400(self):
        """CU61 y CU62: un período al revés responde 400 con mensaje."""
        respuesta = self.client.get(URL, {'desde': '2026-02-01', 'hasta': '2026-01-01'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'],
                         'La fecha desde no puede ser posterior a la fecha hasta.')

    def test_los_totales_del_periodo_son_correctos(self):
        """CU61 y CU62: un cobro de $4.000 y un gasto de $1.500 en marzo dan resultado $2.500;
        lo de febrero y abril queda afuera."""
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        pedido = Pedido.objects.create(cliente=cliente)
        ProductoDelPedido.objects.create(pedido=pedido, producto=producto,
                                         precio='5000.00', cantidad=2)
        Cobro.objects.create(pedido=pedido, monto='4000.00', fecha='2026-03-10')
        Cobro.objects.create(pedido=pedido, monto='1000.00', fecha='2026-04-01')   # afuera
        Gasto.objects.create(tipo=Gasto.Tipo.OTRO, monto='1500.00', fecha='2026-03-15')
        Gasto.objects.create(tipo=Gasto.Tipo.OTRO, monto='700.00', fecha='2026-02-28')  # afuera

        respuesta = self.client.get(URL, {'desde': '2026-03-01', 'hasta': '2026-03-31'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['totales'], {
            'ingresos': '4000.00',
            'gastos': '1500.00',
            'resultado': '2500.00',
            'cantidad_cobros': 1,
            'cantidad_gastos': 1,
        })
        self.assertEqual(len(respuesta.data['cobros']), 1)
        self.assertEqual(len(respuesta.data['gastos']), 1)
