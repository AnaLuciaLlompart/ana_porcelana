from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status

from clientes.models import Cliente
from pruebas.base import TIPO_EXCEL, USUARIA, PruebaConSesion, PruebaSinSesion, celdas_del_excel
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


class RendimientoDelListado(PruebaSinSesion):
    """El listado no hace una consulta por pedido (CU41).

    force_authenticate y no la cookie de sesión, por lo mismo que en
    productos: se cuentan solo las consultas del ViewSet.
    """

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(get_user_model().objects.create_user(USUARIA))

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """CU41: con tres pedidos con productos y cobros, el listado hace 5 consultas.

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

        with self.assertNumQueries(5):
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
