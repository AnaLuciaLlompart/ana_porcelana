import threading
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
from smtplib import SMTPException
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives
from django.db import connection
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APIClient, APITransactionTestCase

from clientes.models import Cliente
from pruebas.base import TIPO_EXCEL, USUARIA, PruebaConSesion, PruebaSinSesion, celdas_del_excel
from productos.models import Producto

from .models import Cobro, Pedido, ProductoDelPedido
from .views import PedidoViewSet

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


class AltaDePedidoCompleta(PruebaDePedido):
    """El alta trae los productos en el mismo POST y se guarda entera o no se guarda (CU40, CU44)."""

    def test_el_alta_crea_el_pedido_con_sus_productos(self):
        """CU40: un POST con dos productos (uno sin precio) responde 201 con los dos Pendientes, y el precio congelado del catálogo en el que no lo trae."""
        respuesta = self.client.post(LISTA, {
            'cliente': self.cliente.id,
            'productos': [
                {'producto': self.producto.id, 'cantidad': 2},
                {'producto': self.producto.id, 'precio': '4000.00', 'descripcion': 'verde'},
            ],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(respuesta.data['productos']), 2)

        nuevo = Pedido.objects.get(pk=respuesta.data['id'])
        primera, segunda = nuevo.productos.order_by('id')
        self.assertEqual(primera.precio, Decimal('5000.00'))
        self.assertEqual(primera.cantidad, 2)
        self.assertEqual(segunda.precio, Decimal('4000.00'))
        self.assertEqual(
            [primera.estado, segunda.estado],
            [ProductoDelPedido.Estado.PENDIENTE, ProductoDelPedido.Estado.PENDIENTE],
        )
        self.assertEqual(nuevo.total, Decimal('14000.00'))

    def test_una_pieza_nueva_nace_pendiente(self):
        """CU40: una fila del alta con una etapa que no es Pendiente responde 400 con su fila y no se crea nada; con Pendiente pasa (corrección del tutor)."""
        cuerpo = {'cliente': self.cliente.id, 'productos': [
            {'producto': self.producto.id},
            {'producto': self.producto.id, 'estado': ProductoDelPedido.Estado.SECADO},
        ]}
        respuesta = self.client.post(LISTA, cuerpo, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['productos'], [
            'Fila 2 (Aros Hedwig): Una pieza nueva nace Pendiente: la etapa se avanza después, de a una.',
        ])
        self.assertEqual(ProductoDelPedido.objects.count(), 0)

        cuerpo['productos'][1]['estado'] = ProductoDelPedido.Estado.PENDIENTE
        respuesta = self.client.post(LISTA, cuerpo, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)

    def test_si_falla_un_producto_no_queda_el_pedido(self):
        """CU40: con la segunda fila inválida responde 400 con la fila y no queda ni el pedido ni la primera fila; 'productos' que no es lista da 400; sin 'productos' el POST crea el pedido solo."""
        respuesta = self.client.post(LISTA, {
            'cliente': self.cliente.id,
            'productos': [{'producto': self.producto.id}, {'producto': 999999}],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['productos'], ['Fila 2: No existe un producto con ese id.'])
        self.assertEqual(Pedido.objects.count(), 1)   # el del setUp
        self.assertEqual(ProductoDelPedido.objects.count(), 0)

        respuesta = self.client.post(LISTA, {'cliente': self.cliente.id, 'productos': 'aros'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], "'productos' tiene que ser una lista.")
        self.assertEqual(Pedido.objects.count(), 1)

        respuesta = self.client.post(LISTA, {'cliente': self.cliente.id}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Pedido.objects.count(), 2)


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

    def test_un_cobro_sin_tipo_es_una_sena(self):
        """CU48: un cobro sin 'tipo' en el cuerpo se registra como seña, el default del modelo (antes daba 500)."""
        respuesta = self.client.post(url(self.pedido, 'cobros/'), {'monto': '3000.00'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(Cobro.objects.get().tipo, Cobro.Tipo.SENA)


class EstadoDelPedido(PruebaDePedido):
    """El estado avanza de a uno, y un pedido no puede estar Listo con piezas sin terminar (CU42, CU44, CU46, CU47)."""

    def test_el_estado_avanza_de_a_uno_sin_saltear_ni_retroceder(self):
        """CU42: saltear, retroceder y pasar del último dan 400 con el próximo estado; avanzar de a uno pasa (corrección del tutor)."""
        self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)

        rechazos = [
            (Pedido.Estado.LISTO, 'El pedido está Pendiente: el próximo estado es En producción.'),
            (Pedido.Estado.EN_PRODUCCION, None),
            (Pedido.Estado.PENDIENTE, 'El pedido está En producción: el próximo estado es Listo.'),
            (Pedido.Estado.ENTREGADO, 'El pedido está En producción: el próximo estado es Listo.'),
            (Pedido.Estado.LISTO, None),
            (Pedido.Estado.ENTREGADO, None),
            (Pedido.Estado.LISTO, 'El pedido ya está Entregado: es el último estado.'),
        ]
        for estado, mensaje in rechazos:
            with self.subTest(estado=estado):
                respuesta = self.cambiar_estado(estado)
                if mensaje is None:
                    self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
                    self.assertEqual(respuesta.data['estado'], estado)
                else:
                    self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertEqual(respuesta.data['detail'], mensaje)

        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, Pedido.Estado.ENTREGADO)

    def test_no_pasa_a_listo_con_piezas_sin_terminar(self):
        """CU42: desde En producción, sin productos o con una pieza sin terminar responde 400; con todo terminado pasa."""
        self.assertEqual(self.cambiar_estado(Pedido.Estado.EN_PRODUCCION).status_code, status.HTTP_200_OK)

        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede marcar el pedido como Listo: todavía no tiene productos cargados.',
        )

        self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)
        pendiente = self.agregar_pieza()
        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede marcar el pedido como Listo: falta terminar 1 de los 2 productos del pedido.',
        )
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, Pedido.Estado.EN_PRODUCCION)

        pendiente.estado = ProductoDelPedido.Estado.TERMINADO
        pendiente.save()
        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.LISTO)

    def test_un_pedido_listo_no_acepta_cambios_en_sus_productos(self):
        """CU44, CU46 y CU47: con el pedido Listo, agregar, modificar, quitar y el PUT con 'productos' responden 400 y nada cambia; el PUT sin 'productos' sigue cambiando los datos (decisión con la corrección del tutor)."""
        pieza = self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)
        self.cambiar_estado(Pedido.Estado.EN_PRODUCCION)
        self.assertEqual(self.cambiar_estado(Pedido.Estado.LISTO).status_code, status.HTTP_200_OK)
        mensaje = 'El pedido está Listo: sus productos ya no se pueden agregar, quitar ni modificar.'
        fila = url(self.pedido, f'productos/{pieza.id}/')

        respuesta = self.client.post(url(self.pedido, 'productos/'), {'producto': self.producto.id})
        self.assertEqual((respuesta.status_code, respuesta.data['detail']), (status.HTTP_400_BAD_REQUEST, mensaje))
        respuesta = self.client.patch(fila, {'cantidad': 3})
        self.assertEqual((respuesta.status_code, respuesta.data['detail']), (status.HTTP_400_BAD_REQUEST, mensaje))
        respuesta = self.client.delete(fila)
        self.assertEqual((respuesta.status_code, respuesta.data['detail']), (status.HTTP_400_BAD_REQUEST, mensaje))

        respuesta = self.client.put(url(self.pedido), {
            'cliente': self.cliente.id,
            'productos': [{'id': pieza.id, 'producto': self.producto.id, 'cantidad': 1}],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['productos'], [mensaje])

        pieza.refresh_from_db()
        self.assertEqual(pieza.cantidad, 1)
        self.assertEqual(self.pedido.productos.count(), 1)

        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'fecha_entrega_estimada': '2026-12-20'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.LISTO)


class EtapaDelProducto(PruebaDePedido):
    """La etapa de una pieza avanza de a una, por el PATCH de etapa (CU46, corrección del tutor)."""

    def test_la_etapa_avanza_de_a_una_sin_saltear_ni_retroceder(self):
        """CU46: saltear, retroceder, pasar de Terminado y una etapa que no existe dan 400; avanzar de a una pasa y anota la fecha de hoy."""
        pieza = self.agregar_pieza()
        ProductoDelPedido.objects.filter(pk=pieza.pk).update(fecha_cambio_estado='2026-01-01')
        fila = url(self.pedido, f'productos/{pieza.id}/')
        Etapa = ProductoDelPedido.Estado

        pasos = [
            (Etapa.SECADO, '«Aros Hedwig» está en Pendiente: la próxima etapa es Modelado.'),
            (Etapa.MODELADO, None),
            (Etapa.PENDIENTE, '«Aros Hedwig» está en Modelado: la próxima etapa es Secado.'),
            ('PERDIDO', 'Esa no es una etapa válida para un producto del pedido.'),
            (Etapa.SECADO, None),
            (Etapa.PINTURA_BARNIZ, None),
            (Etapa.TERMINADO, None),
            (Etapa.PINTURA_BARNIZ, '«Aros Hedwig» ya está Terminado: es la última etapa.'),
        ]
        for etapa, mensaje in pasos:
            with self.subTest(etapa=etapa):
                respuesta = self.client.patch(fila, {'estado': etapa})
                if mensaje is None:
                    self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
                    self.assertEqual(respuesta.data['productos'][0]['estado'], etapa)
                else:
                    self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertEqual(respuesta.data['detail'], mensaje)

        pieza.refresh_from_db()
        self.assertEqual((pieza.estado, pieza.fecha_cambio_estado), (Etapa.TERMINADO, timezone.localdate()))


class FechaDeEntregaReal(PruebaDePedido):
    """La fecha de entrega real la escribe el pase a Entregado y nadie más (CU42)."""

    def test_la_fecha_de_entrega_real_solo_la_escribe_entregado(self):
        """CU42: un PUT con la fecha la ignora; avanzando de a uno, solo Entregado escribe hoy, y como de Entregado no se sale, la fecha queda."""
        self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)

        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'fecha_entrega_real': '2026-01-01'},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsNone(respuesta.data['fecha_entrega_real'])
        self.pedido.refresh_from_db()
        self.assertIsNone(self.pedido.fecha_entrega_real)

        for estado in (Pedido.Estado.EN_PRODUCCION, Pedido.Estado.LISTO):
            respuesta = self.cambiar_estado(estado)
            self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
            self.assertIsNone(respuesta.data['fecha_entrega_real'])

        respuesta = self.cambiar_estado(Pedido.Estado.ENTREGADO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['fecha_entrega_real'], str(timezone.localdate()))

        respuesta = self.cambiar_estado(Pedido.Estado.LISTO)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.fecha_entrega_real, timezone.localdate())


class FormaDeEntrega(PruebaDePedido):
    """Retiro, o envío a cargo mío o del cliente (CU42)."""

    def test_retiro_no_suma_el_costo_al_total(self):
        """CU42: con retiro el costo cargado no entra en el total; con envío a cargo mío sí."""
        self.agregar_pieza()   # $5.000
        self.pedido.forma_entrega = Pedido.FormaEntrega.RETIRO
        self.pedido.costo_entrega = '2000.00'
        self.pedido.save()

        respuesta = self.client.get(url(self.pedido))
        self.assertEqual(respuesta.data['costo_envio_a_cobrar'], '0.00')
        self.assertEqual(respuesta.data['total'], '5000.00')

        self.pedido.forma_entrega = Pedido.FormaEntrega.MIO
        self.pedido.save()
        respuesta = self.client.get(url(self.pedido))
        self.assertEqual(respuesta.data['costo_envio_a_cobrar'], '2000.00')
        self.assertEqual(respuesta.data['total'], '7000.00')

    def test_la_forma_de_entrega_se_guarda_con_su_etiqueta(self):
        """CU42: un PUT con una forma que no existe responde 400; con RETIRO guarda y devuelve "Retiro"."""
        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'forma_entrega': 'ENVIO'},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('forma_entrega', respuesta.data)

        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'forma_entrega': Pedido.FormaEntrega.RETIRO},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['forma_entrega'], Pedido.FormaEntrega.RETIRO)
        self.assertEqual(respuesta.data['forma_entrega_display'], 'Retiro')
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.forma_entrega, Pedido.FormaEntrega.RETIRO)


class GuardadoDePedidoCompleto(PruebaDePedido):
    """La ficha se guarda con un solo PUT que trae la lista completa de
    productos, y se aplica entero o no se aplica (CU42, CU44, CU46, CU47;
    corrección del tutor).

    Arranca con un pedido En producción con una pieza terminada y otra, de
    dos unidades, en Secado. (Uno Listo ya no acepta cambios en sus
    productos: ver test_un_pedido_listo_no_acepta_cambios_en_sus_productos.)
    """

    def setUp(self):
        super().setUp()
        self.terminada = self.agregar_pieza(estado=ProductoDelPedido.Estado.TERMINADO)
        self.otra = self.agregar_pieza(cantidad=2, estado=ProductoDelPedido.Estado.SECADO)
        self.pedido.estado = Pedido.Estado.EN_PRODUCCION
        self.pedido.save()

    def fila(self, linea, **cambios):
        """Una fila guardada tal como la manda la ficha, con lo que cambie."""
        datos = {
            'id': linea.id, 'producto': linea.producto_id, 'cantidad': linea.cantidad,
            'precio': str(linea.precio), 'descripcion': linea.descripcion, 'estado': linea.estado,
        }
        datos.update(cambios)
        return datos

    def test_el_put_quita_modifica_y_agrega_productos_en_un_pedido(self):
        """CU42, CU46, CU47 y CU44: un PUT con la lista completa cambia los datos, quita la fila que no viene, cambia la cantidad de la que sigue (su etapa queda) y agrega la nueva, que nace Pendiente con el precio congelado; el estado del pedido no cambia."""
        respuesta = self.client.put(url(self.pedido), {
            'cliente': self.cliente.id,
            'fecha_entrega_estimada': '2026-12-20',
            'productos': [
                self.fila(self.terminada, cantidad=3),
                {'producto': self.producto.id, 'cantidad': 2},
            ],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['fecha_entrega_estimada'], '2026-12-20')
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.EN_PRODUCCION)
        self.assertEqual(len(respuesta.data['productos']), 2)

        self.assertFalse(ProductoDelPedido.objects.filter(pk=self.otra.pk).exists())
        self.terminada.refresh_from_db()
        self.assertEqual(
            (self.terminada.cantidad, self.terminada.estado),
            (3, ProductoDelPedido.Estado.TERMINADO),
        )
        nueva = self.pedido.productos.exclude(pk=self.terminada.pk).get()
        self.assertEqual(
            (nueva.cantidad, nueva.estado, str(nueva.precio)),
            (2, ProductoDelPedido.Estado.PENDIENTE, '5000.00'),
        )

    def test_el_put_no_cambia_la_etapa(self):
        """CU42 y CU46: una fila guardada con la etapa salteada o retrocedida, o una nueva que no es Pendiente, responde 400 con 'productos' y su fila, y nada cambia; con las etapas de siempre el PUT pasa (corrección del tutor)."""
        mensaje_guardada = (
            'Fila 2 (Aros Hedwig): La etapa no se cambia al guardar el pedido: '
            'se avanza con su botón, de a una.'
        )
        for etapa in (ProductoDelPedido.Estado.TERMINADO, ProductoDelPedido.Estado.MODELADO):
            with self.subTest(etapa=etapa):
                respuesta = self.client.put(url(self.pedido), {
                    'cliente': self.cliente.id,
                    'productos': [self.fila(self.terminada), self.fila(self.otra, cantidad=5, estado=etapa)],
                }, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['productos'], [mensaje_guardada])

        respuesta = self.client.put(url(self.pedido), {
            'cliente': self.cliente.id,
            'productos': [
                self.fila(self.terminada), self.fila(self.otra),
                {'producto': self.producto.id, 'estado': ProductoDelPedido.Estado.SECADO},
            ],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['productos'], [
            'Fila 3 (Aros Hedwig): Una pieza nueva nace Pendiente: la etapa se avanza después, de a una.',
        ])

        self.otra.refresh_from_db()
        self.assertEqual((self.otra.cantidad, self.otra.estado), (2, ProductoDelPedido.Estado.SECADO))
        self.assertEqual(self.pedido.productos.count(), 2)

        respuesta = self.client.put(url(self.pedido), {
            'cliente': self.cliente.id,
            'productos': [self.fila(self.terminada), self.fila(self.otra, cantidad=5)],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.otra.refresh_from_db()
        self.assertEqual((self.otra.cantidad, self.otra.estado), (5, ProductoDelPedido.Estado.SECADO))

    def test_si_falla_una_fila_el_pedido_queda_como_estaba(self):
        """CU42: con una fila de un producto inexistente el PUT responde 400 con 'productos' y su fila, y ni los datos, ni las piezas, ni el estado cambian."""
        respuesta = self.client.put(url(self.pedido), {
            'cliente': self.cliente.id,
            'fecha_entrega_estimada': '2026-12-20',
            'productos': [self.fila(self.terminada, cantidad=3), {'producto': 999999}],
        }, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['productos'], ['Fila 2: No existe un producto con ese id.'])

        self.pedido.refresh_from_db()
        self.assertIsNone(self.pedido.fecha_entrega_estimada)
        self.assertEqual(self.pedido.estado, Pedido.Estado.EN_PRODUCCION)
        self.terminada.refresh_from_db()
        self.assertEqual(self.terminada.cantidad, 1)
        self.assertEqual(self.pedido.productos.count(), 2)

    def test_un_put_sin_productos_no_toca_las_piezas(self):
        """CU42: un PUT con los datos y sin la clave 'productos' cambia la entrega estimada y deja las dos piezas y el estado como estaban."""
        respuesta = self.client.put(
            url(self.pedido), {'cliente': self.cliente.id, 'fecha_entrega_estimada': '2026-12-20'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['fecha_entrega_estimada'], '2026-12-20')
        self.assertEqual(respuesta.data['estado'], Pedido.Estado.EN_PRODUCCION)
        self.assertEqual(
            sorted((linea.cantidad, linea.estado) for linea in self.pedido.productos.all()),
            [(1, ProductoDelPedido.Estado.TERMINADO), (2, ProductoDelPedido.Estado.SECADO)],
        )


class ComprobanteSinSesion(PruebaSinSesion):
    """El comprobante es un endpoint de gestión (CU60)."""

    def test_comprobante_sin_sesion_da_403(self):
        """CU60: GET /api/pedidos/<id>/comprobante/ sin sesión responde 403."""
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        pedido = Pedido.objects.create(cliente=cliente)
        respuesta = self.client.get(url(pedido, 'comprobante/'))
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)

    def test_comprobante_de_un_cobro_sin_sesion_da_403(self):
        """CU60: GET /api/pedidos/<id>/cobros/<cobro_id>/comprobante/ sin sesión responde 403."""
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        pedido = Pedido.objects.create(cliente=cliente)
        cobro = Cobro.objects.create(pedido=pedido, monto='1000.00')
        respuesta = self.client.get(url(pedido, f'cobros/{cobro.id}/comprobante/'))
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class UltimoCobroDelListado(PruebaDePedido):
    """El listado dice cuál es el cobro más reciente, para "Último comprobante" (CU60)."""

    def test_el_listado_trae_el_cobro_mas_reciente(self):
        """CU60: sin cobros ultimo_cobro es None; con dos, el de fecha mayor aunque se haya cargado antes."""
        respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertIsNone(respuesta.data['results'][0]['ultimo_cobro'])

        self.agregar_pieza()
        nuevo = Cobro.objects.create(pedido=self.pedido, monto='1000.00', fecha='2026-10-20')
        Cobro.objects.create(pedido=self.pedido, monto='1000.00', fecha='2026-10-01')

        respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertEqual(respuesta.data['results'][0]['ultimo_cobro'], nuevo.id)


class ComprobanteDeUnCobro(PruebaDePedido):
    """Cada cobro tiene su comprobante de pago (CU60)."""

    def test_el_comprobante_de_un_cobro_ajeno_da_400(self):
        """CU60: con el cobro de otro pedido responde 400 con mensaje; con uno propio, el PDF."""
        self.agregar_pieza()
        propio = Cobro.objects.create(pedido=self.pedido, monto='1000.00')

        otro_pedido = Pedido.objects.create(cliente=self.cliente)
        ajeno = Cobro.objects.create(pedido=otro_pedido, monto='1000.00')

        respuesta = self.client.get(url(self.pedido, f'cobros/{ajeno.id}/comprobante/'))
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Ese cobro no pertenece a este pedido.')

        respuesta = self.client.get(url(self.pedido, f'cobros/{propio.id}/comprobante/'))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta['Content-Type'], 'application/pdf')
        self.assertIn(
            f'comprobante-pedido-{self.pedido.id}-cobro-{propio.id}.pdf',
            respuesta['Content-Disposition'],
        )
        self.assertTrue(b''.join(respuesta.streaming_content).startswith(b'%PDF-'))


class EnvioDelComprobantePorCorreo(PruebaDePedido):
    """El comprobante de un cobro se manda por correo con el PDF adjunto (CU60; corrección del tutor).

    El runner de Django pone el backend de correo en memoria: lo que se
    manda queda en mail.outbox.
    """

    DATOS = {
        'para': 'sofi@example.com',
        'asunto': 'Comprobante de pago · Pedido',
        'mensaje': 'Hola, Sofía:\n\nTe mando el comprobante <del pago>.\n\nAna Porcelana',
    }

    def setUp(self):
        super().setUp()
        self.agregar_pieza()
        self.cobro = Cobro.objects.create(pedido=self.pedido, monto='1000.00')
        self.url = url(self.pedido, f'cobros/{self.cobro.id}/enviar_comprobante/')

    def test_envia_el_comprobante_con_el_pdf_adjunto(self):
        """CU60: 200 y un correo al destinatario con el asunto, el mensaje en texto y en HTML (escapado, con saltos de línea y el logo) y el PDF adjunto."""
        respuesta = self.client.post(self.url, self.DATOS, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['detail'], 'Comprobante enviado a sofi@example.com.')

        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ['sofi@example.com'])
        self.assertEqual(correo.subject, self.DATOS['asunto'])
        self.assertEqual(correo.body, self.DATOS['mensaje'])

        html, tipo = correo.alternatives[0]
        self.assertEqual(tipo, 'text/html')
        self.assertIn('Hola, Sofía:<br>', html)
        self.assertIn('Te mando el comprobante &lt;del pago&gt;.', html)
        self.assertIn('src="cid:logo"', html)

        # Dos adjuntos: el logo en línea y el PDF.
        logo, pdf = correo.attachments
        self.assertEqual(logo['Content-ID'], '<logo>')
        nombre, contenido, tipo_pdf = pdf
        self.assertEqual(nombre, f'comprobante-pedido-{self.pedido.id}-cobro-{self.cobro.id}.pdf')
        self.assertEqual(tipo_pdf, 'application/pdf')
        self.assertTrue(contenido.startswith(b'%PDF-'))

    def test_un_correo_invalido_o_sin_asunto_da_400(self):
        """CU60: un destinatario sin forma de correo da 400 con la clave para; sin asunto, con asunto; y no sale ningún correo."""
        respuesta = self.client.post(self.url, {**self.DATOS, 'para': 'no-es-un-correo'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('para', respuesta.data)

        respuesta = self.client.post(self.url, {**self.DATOS, 'asunto': ''}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('asunto', respuesta.data)

        self.assertEqual(len(mail.outbox), 0)

    def test_el_cobro_de_otro_pedido_da_400(self):
        """CU60: con el cobro de otro pedido responde 400 con mensaje y no sale ningún correo."""
        otro_pedido = Pedido.objects.create(cliente=self.cliente)
        ajeno = Cobro.objects.create(pedido=otro_pedido, monto='1000.00')

        respuesta = self.client.post(
            url(self.pedido, f'cobros/{ajeno.id}/enviar_comprobante/'), self.DATOS, format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Ese cobro no pertenece a este pedido.')
        self.assertEqual(len(mail.outbox), 0)

    def test_sin_sesion_da_403(self):
        """Denegación por defecto: sin sesión el envío responde 403 y no sale ningún correo."""
        respuesta = APIClient().post(self.url, self.DATOS, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(mail.outbox), 0)

    def test_si_el_correo_falla_responde_503(self):
        """CU60: si Gmail rechaza el envío, 503 con un mensaje claro para el modal."""
        with mock.patch.object(EmailMultiAlternatives, 'send', side_effect=SMTPException('sin conexión')):
            respuesta = self.client.post(self.url, self.DATOS, format='json')

        self.assertEqual(respuesta.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            respuesta.data['detail'],
            'No se pudo enviar el correo. Probá de nuevo en un rato; si sigue pasando, '
            'revisá la configuración del correo del servidor.',
        )


class RendimientoDelListado(PruebaSinSesion):
    """El listado no hace una consulta por pedido (CU41).

    force_authenticate y no la cookie de sesión, por lo mismo que en
    productos: se cuentan solo las consultas del ViewSet.
    """

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(get_user_model().objects.create_user(USUARIA))

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """CU41: con tres pedidos con productos y cobros, el listado hace 5 consultas (más las 2 de la transacción por pedido).

        El COUNT de la paginación, los pedidos de la página con su cliente
        (un JOIN por select_related) y sus totales (subconsultas de la misma
        consulta), productos del pedido, los productos de esas líneas y los
        cobros.
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

        # 5 del listado más las 2 de la transacción por pedido
        # (ATOMIC_REQUESTS): dentro de un TestCase son un SAVEPOINT y su
        # RELEASE, y assertNumQueries los cuenta.
        with self.assertNumQueries(7):
            respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertEqual(len(respuesta.data['results']), 3)


class ListadoEnLaBase(PruebaDePedido):
    """El listado se filtra, se ordena y se pagina en la base (CU41, corrección D3)."""

    def ids(self, parametros):
        """Los ids de la primera página que devuelve el listado con esos parámetros."""
        respuesta = self.client.get(LISTA, {'pagina': 1, **parametros})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        return [pedido['id'] for pedido in respuesta.data['results']]

    def test_el_listado_viene_paginado(self):
        """CU41: con ?pagina= devuelve 12 de 13 y el count; con por_pagina=24, los 13; sin pagina, la lista entera."""
        for _ in range(12):
            Pedido.objects.create(cliente=self.cliente)

        respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertEqual(respuesta.data['count'], 13)
        self.assertEqual(len(respuesta.data['results']), 12)
        self.assertIsNotNone(respuesta.data['next'])

        respuesta = self.client.get(LISTA, {'pagina': 1, 'por_pagina': 24})
        self.assertEqual(len(respuesta.data['results']), 13)
        self.assertIsNone(respuesta.data['next'])

        # Sin ?pagina= viaja la lista entera, que es lo que piden los
        # desplegables de los formularios.
        respuesta = self.client.get(LISTA)
        self.assertEqual(len(respuesta.data), 13)

    def test_el_total_y_el_saldo_de_la_base_son_los_de_las_propiedades(self):
        """CU41: con_totales() da el mismo total y saldo que las propiedades, con y sin envío a cobrar."""
        self.agregar_pieza(cantidad=2)
        self.pedido.forma_entrega = Pedido.FormaEntrega.MIO
        self.pedido.costo_entrega = Decimal('1500.00')
        self.pedido.save()
        Cobro.objects.create(pedido=self.pedido, monto='3000.00')

        # El envío a cargo del cliente no suma, y un pedido vacío vale cero.
        Pedido.objects.create(
            cliente=self.cliente, forma_entrega=Pedido.FormaEntrega.CLIENTE,
            costo_entrega=Decimal('900.00'),
        )

        for pedido in Pedido.objects.con_totales().prefetch_related('productos', 'cobros'):
            self.assertEqual(pedido.total_calculado, pedido.total)
            self.assertEqual(pedido.saldo_calculado, pedido.saldo)

    def test_filtra_por_saldo_y_por_total(self):
        """CU41: saldo=pendiente deja el que debe y al_dia el que no; el rango de total incluye los extremos."""
        self.agregar_pieza()
        pagado = Pedido.objects.create(cliente=self.cliente)
        ProductoDelPedido.objects.create(pedido=pagado, producto=self.producto, precio='5000.00', cantidad=2)
        Cobro.objects.create(pedido=pagado, monto='10000.00')

        self.assertEqual(self.ids({'saldo': 'pendiente'}), [self.pedido.id])
        self.assertEqual(self.ids({'saldo': 'al_dia'}), [pagado.id])
        self.assertEqual(self.ids({'total_desde': '10000'}), [pagado.id])
        self.assertEqual(self.ids({'total_hasta': '5000'}), [self.pedido.id])

    def test_filtra_por_entrega(self):
        """CU41: atrasados y proximos dejan afuera a los entregados y a los que no tienen fecha."""
        hoy = timezone.localdate()
        self.pedido.fecha_entrega_estimada = hoy - timedelta(days=1)
        self.pedido.save()
        proximo = Pedido.objects.create(cliente=self.cliente, fecha_entrega_estimada=hoy)
        Pedido.objects.create(
            cliente=self.cliente, fecha_entrega_estimada=hoy - timedelta(days=1),
            estado=Pedido.Estado.ENTREGADO,
        )
        Pedido.objects.create(cliente=self.cliente)

        self.assertEqual(self.ids({'entrega': 'atrasados'}), [self.pedido.id])
        self.assertEqual(self.ids({'entrega': 'proximos'}), [proximo.id])

    def test_filtra_por_forma_de_entrega(self):
        """CU41: una forma que no existe da 400; forma_entrega deja los de esa forma, y repetida, los de cualquiera."""
        respuesta = self.client.get(LISTA, {'forma_entrega': 'MOTO'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Una de las formas de entrega no existe.')

        # self.pedido queda con la forma por defecto, envío a cargo del cliente.
        retiro = Pedido.objects.create(cliente=self.cliente, forma_entrega=Pedido.FormaEntrega.RETIRO)
        mio = Pedido.objects.create(cliente=self.cliente, forma_entrega=Pedido.FormaEntrega.MIO)

        self.assertEqual(self.ids({'forma_entrega': 'RETIRO'}), [retiro.id])
        self.assertCountEqual(self.ids({'forma_entrega': ['RETIRO', 'MIO']}), [retiro.id, mio.id])

    def test_busca_por_numero_cliente_y_producto(self):
        """CU41: la búsqueda encuentra por número con o sin #, por instagram y por nombre de producto."""
        self.agregar_pieza()
        otra = Cliente.objects.create(instagram='mica.luna', nombre='Micaela')
        otro = Pedido.objects.create(cliente=otra)

        self.assertEqual(self.ids({'busqueda': f'#{otro.id}'}), [otro.id])
        self.assertEqual(self.ids({'busqueda': 'mica'}), [otro.id])
        self.assertEqual(self.ids({'busqueda': 'hedwig'}), [self.pedido.id])

    def test_ordena_por_saldo_y_por_estado(self):
        """CU41: orden=-saldo pone primero al que más debe; orden=estado sigue el orden del trabajo."""
        self.agregar_pieza()
        listo = Pedido.objects.create(cliente=self.cliente, estado=Pedido.Estado.LISTO)
        ProductoDelPedido.objects.create(pedido=listo, producto=self.producto, precio='5000.00', cantidad=3)

        self.assertEqual(self.ids({'orden': '-saldo'}), [listo.id, self.pedido.id])
        self.assertEqual(self.ids({'orden': 'estado'}), [self.pedido.id, listo.id])

    def test_un_parametro_invalido_da_400(self):
        """CU41: un estado o un orden que no existen responden 400 con mensaje; uno válido pasa."""
        respuesta = self.client.get(LISTA, {'estado': 'PERDIDO'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Uno de los estados no existe.')

        respuesta = self.client.get(LISTA, {'orden': 'color'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'No se puede ordenar por esa columna.')

        self.assertEqual(self.ids({'estado': 'PENDIENTE'}), [self.pedido.id])

    def test_el_resumen_cuenta_sobre_todos_los_pedidos(self):
        """CU41: activos, atrasados, con saldo y el total más alto, sin mirar los filtros."""
        self.agregar_pieza(cantidad=2)
        self.pedido.fecha_entrega_estimada = timezone.localdate() - timedelta(days=1)
        self.pedido.save()
        Pedido.objects.create(cliente=self.cliente, estado=Pedido.Estado.ENTREGADO)

        respuesta = self.client.get(f'{LISTA}resumen/', {'estado': 'ENTREGADO'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data, {
            'activos': 1, 'atrasados': 1, 'con_saldo': 1, 'total_maximo': '10000.00',
        })


EXPORTAR = f'{LISTA}exportar/'


class ExportarSinSesion(PruebaSinSesion):
    """Exportar es un endpoint de gestión (corrección E10)."""

    def test_exportar_sin_sesion_da_403(self):
        """E10: GET /api/pedidos/exportar/ sin sesión responde 403, en PDF y en Excel."""
        for formato in ('pdf', 'excel'):
            respuesta = self.client.get(EXPORTAR, {'formato': formato})
            self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class ExportarPedidos(PruebaDePedido):
    """El listado filtrado se exporta a PDF y a Excel (corrección E10)."""

    def test_el_pdf_se_muestra_en_la_pestana(self):
        """E10: formato=pdf responde un PDF inline, para que el navegador lo muestre."""
        respuesta = self.client.get(EXPORTAR, {'formato': 'pdf'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta['Content-Type'], 'application/pdf')
        self.assertTrue(respuesta['Content-Disposition'].startswith('inline'))
        self.assertTrue(b''.join(respuesta.streaming_content).startswith(b'%PDF-'))

    def test_el_excel_se_descarga(self):
        """E10: formato=excel responde una planilla .xlsx como adjunto, con una fila por pedido."""
        respuesta = self.client.get(EXPORTAR, {'formato': 'excel'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta['Content-Type'], TIPO_EXCEL)
        self.assertTrue(respuesta['Content-Disposition'].startswith('attachment'))
        self.assertEqual(len(celdas_del_excel(respuesta, 'N.º')), 1)

    def test_exporta_las_mismas_filas_que_el_listado_filtrado(self):
        """E10: con estado, búsqueda y orden, los pedidos del Excel son los del listado, en su orden; sin filtros, todos."""
        self.agregar_pieza()
        listo = Pedido.objects.create(cliente=self.cliente, estado=Pedido.Estado.LISTO)
        ProductoDelPedido.objects.create(pedido=listo, producto=self.producto, precio='5000.00', cantidad=3)
        Pedido.objects.create(cliente=self.cliente, estado=Pedido.Estado.ENTREGADO)

        filtros = {'estado': ['LISTO', 'PENDIENTE'], 'busqueda': 'hedwig', 'orden': '-total'}

        listado = self.client.get(LISTA, {'pagina': 1, **filtros})
        exportado = self.client.get(EXPORTAR, {'formato': 'excel', **filtros})
        ids_del_excel = [fila[0].value for fila in celdas_del_excel(exportado, 'N.º')]
        self.assertEqual(listado.data['count'], 2)
        self.assertEqual(ids_del_excel, [pedido['id'] for pedido in listado.data['results']])
        self.assertEqual(ids_del_excel, [listo.id, self.pedido.id])

        exportado = self.client.get(EXPORTAR, {'formato': 'excel'})
        self.assertEqual(len(celdas_del_excel(exportado, 'N.º')), Pedido.objects.count())

    def test_los_titulos_de_las_columnas_quedan_pintados_y_fijos(self):
        """E10: los títulos van en la fila 5, la pintada; la 4 queda vacía y sin color, y lo fijo termina en la 5."""
        respuesta = self.client.get(EXPORTAR, {'formato': 'excel'})
        hoja = load_workbook(BytesIO(b''.join(respuesta.streaming_content))).active

        self.assertEqual(hoja['A5'].value, 'N.º')
        self.assertEqual(hoja['A5'].fill.fgColor.rgb, '00F0E2E4')
        self.assertIsNone(hoja['A4'].value)
        self.assertIsNone(hoja['A4'].fill.fill_type)
        # freeze_panes es la primera celda que se desplaza: todo lo de arriba queda fijo.
        self.assertEqual(hoja.freeze_panes, 'A6')

    def test_un_formato_desconocido_da_400(self):
        """E10: sin formato o con uno que no es pdf ni excel responde 400 con mensaje; con pdf pasa."""
        for parametros in ({}, {'formato': 'word'}):
            respuesta = self.client.get(EXPORTAR, parametros)
            self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(respuesta.data['detail'], 'El formato tiene que ser pdf o excel.')

        respuesta = self.client.get(EXPORTAR, {'formato': 'pdf'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

    def test_un_texto_que_empieza_con_igual_sale_como_texto(self):
        """E10: una clienta llamada "=1+1" queda en la planilla como texto y no como fórmula."""
        self.cliente.nombre = '=1+1'
        self.cliente.save()

        respuesta = self.client.get(EXPORTAR, {'formato': 'excel'})
        fila = celdas_del_excel(respuesta, 'N.º')[0]
        nombre = fila[3]
        self.assertEqual(nombre.value, '=1+1')
        # 's' es texto; una fórmula vendría como 'f'.
        self.assertEqual(nombre.data_type, 's')


class CobrosSimultaneos(APITransactionTestCase):
    """Dos cobros al mismo tiempo no pueden pasarse del total (CU48).

    Sobre APITransactionTestCase y no sobre PruebaConSesion: dos pedidos de
    verdad simultáneos necesitan dos conexiones y transacciones de verdad,
    y APITestCase envuelve cada prueba en una sola. Por eso la clase arma
    sus datos a mano y cada hilo tiene su propio APIClient.
    """

    def setUp(self):
        cache.clear()

    def test_dos_cobros_a_la_vez_no_pasan_el_total(self):
        """CU48: dos cobros de $6.000 sobre $10.000 lanzados a la vez: uno entra (200), el otro responde 400, y queda un solo cobro."""
        usuaria = get_user_model().objects.create_user(USUARIA)
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='5000.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        pedido = Pedido.objects.create(cliente=cliente)
        ProductoDelPedido.objects.create(
            pedido=pedido, producto=producto, precio='5000.00', cantidad=2,
        )

        # Para que los dos pedidos se superpongan de verdad, _revisar_cobro
        # espera en una barrera de dos hasta 2 segundos. Con el candado de
        # _bloquear el segundo hilo nunca llega a la barrera (está esperando
        # la fila del pedido), el primero sigue al vencer la espera y
        # confirma, y el segundo recién entonces lee: ve el cobro del otro y
        # lo rechaza. Sin el candado, los dos cruzan la barrera juntos, los
        # dos leen cobrado $0 y los dos entran: la prueba falla.
        barrera = threading.Barrier(2, timeout=2)
        revisar_original = PedidoViewSet._revisar_cobro

        def revisar_esperando(vista, *args, **kwargs):
            try:
                barrera.wait()
            except threading.BrokenBarrierError:
                pass
            return revisar_original(vista, *args, **kwargs)

        respuestas = []

        def cobrar():
            try:
                api = APIClient()
                api.force_authenticate(usuaria)
                respuesta = api.post(
                    url(pedido, 'cobros/'), {'monto': '6000.00', 'tipo': Cobro.Tipo.SENA},
                    format='json',
                )
                respuestas.append((respuesta.status_code, respuesta.data))
            finally:
                # Cada hilo abre su conexión a la base; se cierra para no
                # dejarla colgada al terminar la prueba.
                connection.close()

        with mock.patch.object(PedidoViewSet, '_revisar_cobro', revisar_esperando):
            hilos = [threading.Thread(target=cobrar) for _ in range(2)]
            for hilo in hilos:
                hilo.start()
            for hilo in hilos:
                hilo.join()

        self.assertCountEqual(
            [codigo for codigo, _ in respuestas],
            [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST],
        )
        rechazo = next(datos for codigo, datos in respuestas if codigo == status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            rechazo['detail'],
            'No se puede cobrar $6.000: el pedido es de $10.000 y falta cobrar $4.000.',
        )
        self.assertEqual(Cobro.objects.count(), 1)
