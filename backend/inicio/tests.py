from datetime import timedelta

from django.utils import timezone
from rest_framework import status

from clientes.models import Cliente
from config.pruebas import PruebaConSesion
from materiales.models import Material
from pedidos.models import Pedido

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
        self.assertEqual(
            [m['nombre'] for m in respuesta.data['materiales_por_reponer']['materiales']],
            ['Porcelana'],
        )
        self.assertEqual(
            [p['id'] for p in respuesta.data['proximas_entregas']['pedidos']],
            [atrasado.id],
        )
