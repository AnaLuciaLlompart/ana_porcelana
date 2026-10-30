from datetime import timedelta

from django.utils import timezone
from rest_framework import status

from clientes.models import Cliente
from pruebas.base import PruebaConSesion
from materiales.models import Material
from pedidos.models import Pedido, ProductoDelPedido
from productos.models import Producto

URL = '/api/inicio/'


class ResumenDeHoy(PruebaConSesion):
    """Los números de arriba de la pantalla de Inicio."""

    def test_el_resumen_cuenta_pedidos_atrasados_y_materiales_en_baja(self):
        """Un pedido sin entregar con fecha vencida y un material activo en Baja se cuentan;
        un Entregado vencido y un discontinuado en Baja, no."""
        hoy = timezone.localdate()
        ayer = hoy - timedelta(days=1)
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        atrasado = Pedido.objects.create(cliente=cliente, fecha_entrega_estimada=ayer)
        Pedido.objects.create(cliente=cliente, fecha_entrega_estimada=ayer,
                              estado=Pedido.Estado.ENTREGADO)
        Material.objects.create(nombre='Porcelana', disponibilidad=Material.Disponibilidad.BAJA)
        Material.objects.create(nombre='Barniz viejo', disponibilidad=Material.Disponibilidad.BAJA,
                                estado=Material.Estado.DISCONTINUADO)
        Material.objects.create(nombre='Acrílico', disponibilidad=Material.Disponibilidad.MEDIA)

        respuesta = self.client.get(URL)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['hoy'], str(hoy))
        self.assertEqual(respuesta.data['totales']['pedidos_atrasados'], 1)
        self.assertEqual(respuesta.data['totales']['materiales_por_reponer'], 1)

        # Las filas vienen de los endpoints paginados (corrección D3).
        respuesta = self.client.get(f'{URL}materiales/')
        self.assertEqual([m['nombre'] for m in respuesta.data['results']], ['Porcelana'])
        respuesta = self.client.get(f'{URL}entregas/')
        self.assertEqual([p['id'] for p in respuesta.data['results']], [atrasado.id])


class ListasPaginadas(PruebaConSesion):
    """Las tres listas de Inicio se traen de a una página (corrección D3)."""

    def setUp(self):
        super().setUp()
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        self.pedido = Pedido.objects.create(cliente=cliente)
        self.producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00', dificultad=Producto.Dificultad.MEDIA,
        )

    def pieza(self, estado):
        return ProductoDelPedido.objects.create(
            pedido=self.pedido, producto=self.producto, precio='5000.00', cantidad=1, estado=estado,
        )

    def test_las_entregas_vienen_de_a_8(self):
        """Con 10 pedidos sin entregar, la primera página trae 8 y el count dice 10; la segunda, 2."""
        for _ in range(9):
            Pedido.objects.create(cliente=self.pedido.cliente)

        respuesta = self.client.get(f'{URL}entregas/')
        self.assertEqual(respuesta.data['count'], 10)
        self.assertEqual(len(respuesta.data['results']), 8)
        self.assertEqual(len(self.client.get(f'{URL}entregas/', {'pagina': 2}).data['results']), 2)

    def test_las_piezas_van_de_la_etapa_mas_avanzada_y_se_filtran_por_etapa(self):
        """El orden es Pintura-Barniz, Secado, Modelado, Pendiente; ?etapa= deja solo esa; el resumen las cuenta."""
        pendiente = self.pieza(ProductoDelPedido.Estado.PENDIENTE)
        pintura = self.pieza(ProductoDelPedido.Estado.PINTURA_BARNIZ)
        secado = self.pieza(ProductoDelPedido.Estado.SECADO)
        self.pieza(ProductoDelPedido.Estado.TERMINADO)

        respuesta = self.client.get(f'{URL}en_produccion/')
        self.assertEqual([p['id'] for p in respuesta.data['results']], [pintura.id, secado.id, pendiente.id])

        respuesta = self.client.get(f'{URL}en_produccion/', {'etapa': 'SECADO'})
        self.assertEqual([p['id'] for p in respuesta.data['results']], [secado.id])

        respuesta = self.client.get(URL)
        self.assertEqual(respuesta.data['en_produccion'], {
            'total': 3,
            'por_etapa': {'PINTURA_BARNIZ': 1, 'SECADO': 1, 'MODELADO': 0, 'PENDIENTE': 1},
        })

    def test_una_etapa_terminada_o_inexistente_da_400(self):
        """?etapa=TERMINADO responde 400 con mensaje: esas piezas no están en la tabla."""
        respuesta = self.client.get(f'{URL}en_produccion/', {'etapa': 'TERMINADO'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Esa etapa no existe o ya está terminada.')

        self.assertEqual(self.client.get(f'{URL}en_produccion/', {'etapa': 'PENDIENTE'}).status_code,
                         status.HTTP_200_OK)
