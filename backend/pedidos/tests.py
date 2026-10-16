from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status

from clientes.models import Cliente
from pruebas.base import USUARIA, PruebaConSesion, PruebaSinSesion
from productos.models import Producto

from .models import Cobro, Pedido, ProductoDelPedido

LISTA = '/api/pedidos/'


def url(pedido, resto=''):
    return f'{LISTA}{pedido.id}/{resto}'


class PruebaDePedido(PruebaConSesion):
    """Base: una clienta, un producto de $5.000 y un pedido vacío."""

    def setUp(self):
        super().setUp()
        self.cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        self.producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        self.pedido = Pedido.objects.create(cliente=self.cliente)

    def agregar_pieza(self, cantidad=1, estado=ProductoDelPedido.Estado.PENDIENTE):
        """Una fila de ProductoDelPedido por ORM, con el precio ya congelado."""
        return ProductoDelPedido.objects.create(
            pedido=self.pedido, producto=self.producto,
            precio=self.producto.precio_actual, cantidad=cantidad, estado=estado,
        )

    def cobrar(self, monto, tipo=Cobro.Tipo.SENA):
        return self.client.post(url(self.pedido, 'cobros/'), {'monto': monto, 'tipo': tipo})

    def cambiar_estado(self, estado):
        return self.client.post(url(self.pedido, 'cambiar_estado/'), {'estado': estado})


class PrecioCongelado(PruebaDePedido):
    """El precio se copia al registrar el producto del pedido y no vuelve a cambiar (CU44)."""

    def test_cambiar_el_precio_del_producto_no_altera_los_pedidos(self):
        """CU44 y CU19: subir precio_actual del producto deja intactos el precio de la línea y el total."""
        respuesta = self.client.post(url(self.pedido, 'productos/'), {'producto': self.producto.id})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['productos'][0]['precio'], '5000.00')

        respuesta = self.client.put(
            f'/api/productos/{self.producto.id}/',
            {'nombre': 'Aros Hedwig', 'precio_actual': '8000.00',
             'dificultad': Producto.Dificultad.MEDIA},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['precio_actual'], '8000.00')

        pedido = self.client.get(url(self.pedido)).data
        self.assertEqual(pedido['productos'][0]['precio'], '5000.00')
        self.assertEqual(pedido['total'], '5000.00')


class IdDeProductoInvalido(PruebaDePedido):
    """Un id que no es un número se rechaza con 400, no con 500 (CU44)."""

    def test_un_id_de_producto_que_es_lista_u_objeto_da_400(self):
        """CU44: {"producto": [1]} y {"producto": {}} responden 400 con el mensaje de id inexistente."""
        for cuerpo in ({'producto': [1]}, {'producto': {'id': 1}}):
            with self.subTest(cuerpo=cuerpo):
                respuesta = self.client.post(url(self.pedido, 'productos/'), cuerpo, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], 'No existe un producto con ese id.')
        self.assertEqual(ProductoDelPedido.objects.count(), 0)


class CobrosDelPedido(PruebaDePedido):
    """El saldo y las dos reglas entre filas de los cobros (CU48)."""

    def setUp(self):
        super().setUp()
        self.agregar_pieza(cantidad=2)   # total $10.000

    def test_el_saldo_se_calcula_con_varios_cobros(self):
        """CU48: dos señas de $3.000 y $2.000 dejan cobrado $5.000 y saldo $5.000; el pago restante lo salda."""
        self.assertEqual(self.cobrar('3000.00').status_code, status.HTTP_200_OK)
        respuesta = self.cobrar('2000.00')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['total'], '10000.00')
        self.assertEqual(respuesta.data['cobrado'], '5000.00')
        self.assertEqual(respuesta.data['saldo'], '5000.00')
        self.assertFalse(respuesta.data['esta_al_dia'])

        respuesta = self.cobrar('5000.00', Cobro.Tipo.PAGO_RESTANTE)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['saldo'], '0.00')
        self.assertTrue(respuesta.data['esta_al_dia'])

    def test_no_se_puede_cobrar_mas_que_el_total(self):
        """CU48: un cobro que pasa el total responde 400 con las tres cifras, y no se registra."""
        respuesta = self.cobrar('12000.00')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede cobrar $12.000: el pedido es de $10.000 y falta cobrar $10.000.',
        )
        self.assertEqual(Cobro.objects.count(), 0)

    def test_una_sena_no_puede_dejar_el_pedido_saldado(self):
        """CU48: una seña por lo que falta responde 400; el mismo monto como pago restante entra."""
        respuesta = self.cobrar('10000.00', Cobro.Tipo.SENA)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'Una seña no puede dejar el pedido saldado, porque es un adelanto. '
            'Si con este cobro te termina de pagar, registralo como «Pago restante».',
        )
        self.assertEqual(Cobro.objects.count(), 0)

        respuesta = self.cobrar('10000.00', Cobro.Tipo.PAGO_RESTANTE)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['saldo'], '0.00')


class EstadoDelPedido(PruebaDePedido):
    """Un pedido no puede estar Listo con piezas sin terminar, en las dos direcciones (CU42, CU44)."""

    def test_no_pasa_a_listo_con_piezas_sin_terminar(self):
        """CU42: sin productos o con una pieza sin terminar responde 400; con todo terminado pasa."""
        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede marcar el pedido como Listo: todavía no tiene productos cargados.',
        )

        terminada = self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)
        pendiente = self.agregar_pieza()
        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede marcar el pedido como Listo: falta terminar 1 de los 2 productos del pedido.',
        )
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, Pedido.Estado.PENDIENTE)

        pendiente.estado = ProductoDelPedido.Estado.TERMINADO
        pendiente.save()
        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.LISTO)

    def test_agregar_una_pieza_a_un_pedido_listo_lo_baja_a_en_produccion(self):
        """CU44: la pieza nueva nace Pendiente, así que el pedido Listo vuelve a En producción."""
        self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)
        self.assertEqual(self.cambiar_estado(Pedido.Estado.LISTO).status_code, status.HTTP_200_OK)

        respuesta = self.client.post(url(self.pedido, 'productos/'), {'producto': self.producto.id})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.EN_PRODUCCION)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, Pedido.Estado.EN_PRODUCCION)


class FechaDeEntregaReal(PruebaDePedido):
    """La fecha de entrega real la escribe el pase a Entregado y nadie más (CU42)."""

    def test_la_fecha_de_entrega_real_solo_la_escribe_entregado(self):
        """CU42: un PUT con la fecha la ignora; Entregado escribe hoy; salir de Entregado la borra."""
        self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)

        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'fecha_entrega_real': '2026-01-01'},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsNone(respuesta.data['fecha_entrega_real'])
        self.pedido.refresh_from_db()
        self.assertIsNone(self.pedido.fecha_entrega_real)

        respuesta = self.cambiar_estado(Pedido.Estado.ENTREGADO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['fecha_entrega_real'], str(timezone.localdate()))

        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsNone(respuesta.data['fecha_entrega_real'])


class ComprobanteSinSesion(PruebaSinSesion):
    """El comprobante es un endpoint de gestión (CU60)."""

    def test_comprobante_sin_sesion_da_403(self):
        """CU60: GET /api/pedidos/<id>/comprobante/ sin sesión responde 403."""
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        pedido = Pedido.objects.create(cliente=cliente)
        respuesta = self.client.get(url(pedido, 'comprobante/'))
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class RendimientoDelListado(PruebaSinSesion):
    """El listado no hace una consulta por pedido (CU41).

    force_authenticate y no la cookie de sesión, por lo mismo que en
    productos: se cuentan solo las consultas del ViewSet.
    """

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(get_user_model().objects.create_user(USUARIA))

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """CU41: con tres pedidos con productos y cobros, el listado hace 4 consultas.

        Pedidos con su cliente (un JOIN por select_related), productos
        del pedido, los productos de esas líneas y los cobros.
        """
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        for _ in range(3):
            pedido = Pedido.objects.create(cliente=cliente)
            for _ in range(2):
                ProductoDelPedido.objects.create(
                    pedido=pedido, producto=producto, precio='5000.00', cantidad=1,
                )
            Cobro.objects.create(pedido=pedido, monto='1000.00')

        with self.assertNumQueries(4):
            respuesta = self.client.get(LISTA)
        self.assertEqual(len(respuesta.data), 3)
