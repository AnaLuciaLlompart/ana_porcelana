from io import BytesIO

from django.contrib.auth import get_user_model
from openpyxl import load_workbook
from rest_framework import status

from pruebas.base import TIPO_EXCEL, USUARIA, PruebaConSesion, PruebaSinSesion, celdas_del_excel
from materiales.models import Material

from .models import Gasto, MaterialDelGasto

LISTA = '/api/gastos/'

MENSAJE_TIPO_FIJO = (
    'Un gasto de materiales no puede cambiar de tipo: su monto sale de los '
    'materiales cargados y no hay forma de convertirlo en un monto cargado '
    'a mano. Si el tipo está mal, eliminá el gasto y cargalo de nuevo.'
)


class AltaDeGasto(PruebaConSesion):
    """El monto depende del tipo: lo carga la usuaria o lo calcula el sistema (CU52)."""

    def test_publicidad_u_otro_con_monto_cero_o_negativo_da_400(self):
        """CU52: publicidad u otro exigen monto mayor a cero; con monto positivo se crea."""
        for tipo, monto in (
            (Gasto.Tipo.PUBLICIDAD, '0'),
            (Gasto.Tipo.PUBLICIDAD, '-10.00'),
            (Gasto.Tipo.OTRO, '0'),
        ):
            with self.subTest(tipo=tipo, monto=monto):
                respuesta = self.client.post(LISTA, {'tipo': tipo, 'monto': monto})
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('monto', respuesta.data)
        self.assertEqual(Gasto.objects.count(), 0)

        respuesta = self.client.post(LISTA, {'tipo': Gasto.Tipo.PUBLICIDAD, 'monto': '0'})
        self.assertEqual(respuesta.data['monto'], ['El monto del gasto tiene que ser mayor a cero.'])

        respuesta = self.client.post(LISTA, {'tipo': Gasto.Tipo.PUBLICIDAD, 'monto': '500.00'})
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(respuesta.data['monto'], '500.00')

    def test_un_gasto_de_materiales_nuevo_vale_cero(self):
        """CU52: un gasto de materiales se crea sin materiales, con monto 0, y es válido."""
        respuesta = self.client.post(LISTA, {'tipo': Gasto.Tipo.MATERIALES})
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(respuesta.data['monto'], '0.00')
        self.assertEqual(respuesta.data['materiales'], [])


class GastoDeMateriales(PruebaConSesion):
    """Base: un gasto de materiales vacío y un ayudante para cargarle filas."""

    def setUp(self):
        super().setUp()
        self.gasto = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES)
        self.url = f'{LISTA}{self.gasto.id}/'

    def registrar(self, material, cantidad, precio_unitario):
        return self.client.post(
            f'{self.url}materiales/',
            {'material': material.id, 'cantidad': cantidad, 'precio_unitario': precio_unitario},
        )

    def monto_en_la_base(self):
        self.gasto.refresh_from_db()
        return str(self.gasto.monto)


class MontoDelGastoDeMateriales(GastoDeMateriales):
    """El monto de un gasto de materiales lo escribe el backend (CU54, CU56, CU58, CU59)."""

    def test_el_monto_es_la_suma_de_sus_filas_y_un_put_no_lo_pisa(self):
        """CU56 y CU54: 3 × $800 + 2 × $150 dan $2.700; un PUT con otro monto deja el calculado."""
        porcelana = Material.objects.create(nombre='Porcelana')
        acrilico = Material.objects.create(nombre='Acrílico')
        self.assertEqual(self.registrar(porcelana, 3, '800.00').status_code, status.HTTP_200_OK)
        respuesta = self.registrar(acrilico, 2, '150.00')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['monto'], '2700.00')
        self.assertEqual(self.monto_en_la_base(), '2700.00')

        respuesta = self.client.put(
            self.url, {'tipo': Gasto.Tipo.MATERIALES, 'monto': '99999.00',
                       'descripcion': 'Compra de octubre'},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['monto'], '2700.00')
        self.assertEqual(respuesta.data['descripcion'], 'Compra de octubre')
        self.assertEqual(self.monto_en_la_base(), '2700.00')

    def test_modificar_y_quitar_un_material_recalculan_el_monto(self):
        """CU58 y CU59: cambiar la cantidad o el precio mueve el monto; quitar la fila lo baja a 0."""
        porcelana = Material.objects.create(nombre='Porcelana')
        respuesta = self.registrar(porcelana, 3, '800.00')
        self.assertEqual(respuesta.data['monto'], '2400.00')
        fila = f"{self.url}materiales/{respuesta.data['materiales'][0]['id']}/"

        respuesta = self.client.patch(fila, {'cantidad': 5})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['monto'], '4000.00')

        respuesta = self.client.patch(fila, {'precio_unitario': '100.00'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['monto'], '500.00')
        self.assertEqual(self.monto_en_la_base(), '500.00')

        respuesta = self.client.delete(fila)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['monto'], '0.00')
        self.assertEqual(self.monto_en_la_base(), '0.00')

    def test_un_id_de_material_que_es_lista_u_objeto_da_400(self):
        """CU56: {"material": [1]} y {"material": {}} responden 400 con el mensaje de id inexistente."""
        for cuerpo in ({'material': [1]}, {'material': {'id': 1}}):
            with self.subTest(cuerpo=cuerpo):
                respuesta = self.client.post(f'{self.url}materiales/', cuerpo, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], 'No existe un material con ese id.')
        self.assertEqual(MaterialDelGasto.objects.count(), 0)

    def test_registrar_el_mismo_material_dos_veces_da_400(self):
        """CU56: la segunda fila del mismo material responde 400 con mensaje, no el IntegrityError."""
        porcelana = Material.objects.create(nombre='Porcelana')
        self.assertEqual(self.registrar(porcelana, 1, '800.00').status_code, status.HTTP_200_OK)
        respuesta = self.registrar(porcelana, 2, '800.00')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'El gasto ya tiene «Porcelana» entre sus materiales. Si compraste más, corregí la cantidad.',
        )
        self.assertEqual(MaterialDelGasto.objects.count(), 1)


class TipoDelGasto(PruebaConSesion):
    """El tipo se puede cambiar hacia materiales, nunca desde materiales (CU54)."""

    def test_un_gasto_de_materiales_no_puede_cambiar_de_tipo(self):
        """CU54: PUT y PATCH con otro tipo responden 400 con mensaje y el gasto sigue siendo de materiales."""
        gasto = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES)
        for metodo, datos in (
            ('put', {'tipo': Gasto.Tipo.OTRO, 'monto': '500.00'}),
            ('patch', {'tipo': Gasto.Tipo.PUBLICIDAD}),
        ):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.client, metodo)(f'{LISTA}{gasto.id}/', datos)
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], MENSAJE_TIPO_FIJO)
        gasto.refresh_from_db()
        self.assertEqual(gasto.tipo, Gasto.Tipo.MATERIALES)

    def test_un_gasto_de_publicidad_puede_pasar_a_materiales(self):
        """CU54: el camino inverso se permite y el monto cargado a mano pasa a 0."""
        gasto = Gasto.objects.create(tipo=Gasto.Tipo.PUBLICIDAD, monto='500.00')
        respuesta = self.client.patch(f'{LISTA}{gasto.id}/', {'tipo': Gasto.Tipo.MATERIALES})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['tipo'], Gasto.Tipo.MATERIALES)
        self.assertEqual(respuesta.data['monto'], '0.00')
        gasto.refresh_from_db()
        self.assertEqual(str(gasto.monto), '0.00')


class DisponibilidadAltaDesdeElGasto(GastoDeMateriales):
    """Comprar un material es la señal de que volvió a haber existencias (parte de CU58)."""

    def test_marcar_alta_cambia_solo_los_activos_que_no_estaban_en_alta(self):
        """CU58: el activo en Baja cambia; el que ya está en Alta y el discontinuado se ignoran."""
        en_baja = Material.objects.create(
            nombre='Porcelana', disponibilidad=Material.Disponibilidad.BAJA,
        )
        ya_en_alta = Material.objects.create(
            nombre='Acrílico', disponibilidad=Material.Disponibilidad.ALTA,
        )
        discontinuado = Material.objects.create(
            nombre='Barniz viejo', disponibilidad=Material.Disponibilidad.MEDIA,
            estado=Material.Estado.DISCONTINUADO,
        )
        for material in (en_baja, ya_en_alta, discontinuado):
            self.assertEqual(self.registrar(material, 1, '100.00').status_code, status.HTTP_200_OK)

        respuesta = self.client.post(f'{self.url}materiales/disponibilidad_alta/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['materiales_cambiados'], [{
            'id': en_baja.id,
            'nombre': 'Porcelana',
            'disponibilidad_anterior': Material.Disponibilidad.BAJA,
            'disponibilidad_anterior_display': 'Baja',
        }])
        self.assertEqual(respuesta.data['gasto']['id'], self.gasto.id)

        en_baja.refresh_from_db()
        discontinuado.refresh_from_db()
        self.assertEqual(en_baja.disponibilidad, Material.Disponibilidad.ALTA)
        self.assertEqual(discontinuado.disponibilidad, Material.Disponibilidad.MEDIA)

        # De a uno: el que ya está en Alta no cambia nada y la lista vuelve vacía.
        fila_en_alta = MaterialDelGasto.objects.get(material=ya_en_alta)
        respuesta = self.client.post(f'{self.url}materiales/{fila_en_alta.id}/disponibilidad_alta/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['materiales_cambiados'], [])


class RendimientoDelListado(PruebaSinSesion):
    """El listado no hace una consulta por gasto (CU53).

    force_authenticate y no la cookie de sesión, por lo mismo que en
    productos: se cuentan solo las consultas del ViewSet.
    """

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(get_user_model().objects.create_user(USUARIA))

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """CU53: con tres gastos de dos materiales cada uno, el listado hace 3 consultas.

        Gastos, sus filas de materiales del gasto y los materiales de
        esas filas: lo que prefetch_related('materiales__material') trae.
        """
        materiales = [Material.objects.create(nombre=n) for n in ('Porcelana', 'Acrílico')]
        for _ in range(3):
            gasto = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES)
            for material in materiales:
                MaterialDelGasto.objects.create(
                    gasto=gasto, material=material, cantidad=1, precio_unitario='100.00',
                )

        with self.assertNumQueries(3):
            respuesta = self.client.get(LISTA)
        self.assertEqual(len(respuesta.data), 3)


class ListadoEnLaBase(PruebaConSesion):
    """El listado se filtra, se ordena y se pagina en la base (CU53, corrección D3)."""

    def setUp(self):
        super().setUp()
        self.porcelana = Material.objects.create(nombre='Porcelana fría')
        self.de_materiales = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES, fecha='2026-09-10')
        MaterialDelGasto.objects.create(
            gasto=self.de_materiales, material=self.porcelana, cantidad=2, precio_unitario='3000.00',
        )
        self.de_materiales.monto = '6000.00'
        self.de_materiales.save()
        self.publicidad = Gasto.objects.create(
            tipo=Gasto.Tipo.PUBLICIDAD, monto='1500.00', fecha='2026-10-05', descripcion='Instagram',
        )

    def ids(self, parametros):
        """Los ids de la primera página que devuelve el listado con esos parámetros."""
        respuesta = self.client.get(LISTA, {'pagina': 1, **parametros})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        return [gasto['id'] for gasto in respuesta.data['results']]

    def test_el_listado_viene_paginado(self):
        """CU53: con ?pagina= y por_pagina=12, 13 gastos dan 12 y el count; sin pagina, la lista entera."""
        for _ in range(11):
            Gasto.objects.create(tipo=Gasto.Tipo.OTRO, monto='100.00')

        respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertEqual(respuesta.data['count'], 13)
        self.assertEqual(len(respuesta.data['results']), 12)

        self.assertEqual(len(self.client.get(LISTA).data), 13)

    def test_filtra_por_tipo_periodo_y_monto(self):
        """CU53: tipo, período y rango de monto dejan solo los que cumplen, con los extremos incluidos."""
        self.assertEqual(self.ids({'tipo': 'PUBLICIDAD'}), [self.publicidad.id])
        self.assertEqual(self.ids({'fecha_desde': '2026-10-05'}), [self.publicidad.id])
        self.assertEqual(self.ids({'fecha_hasta': '2026-09-10'}), [self.de_materiales.id])
        self.assertEqual(self.ids({'monto_desde': '6000'}), [self.de_materiales.id])

    def test_busca_por_material_y_por_tipo(self):
        """CU53: la búsqueda encuentra por el nombre de un material comprado y por la etiqueta del tipo."""
        self.assertEqual(self.ids({'busqueda': 'porcelana'}), [self.de_materiales.id])
        self.assertEqual(self.ids({'busqueda': 'publi'}), [self.publicidad.id])

    def test_ordena_por_monto(self):
        """CU53: orden=monto pone primero el más barato y orden=-monto el más caro."""
        self.assertEqual(self.ids({'orden': 'monto'}), [self.publicidad.id, self.de_materiales.id])
        self.assertEqual(self.ids({'orden': '-monto'}), [self.de_materiales.id, self.publicidad.id])

    def test_una_fecha_mal_escrita_da_400(self):
        """CU53: una fecha que no es AAAA-MM-DD responde 400 con mensaje; una bien escrita pasa."""
        respuesta = self.client.get(LISTA, {'pagina': 1, 'fecha_desde': '05/10/2026'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'fecha_desde tiene que ser una fecha AAAA-MM-DD.')

        self.assertEqual(self.ids({'fecha_desde': '2026-10-05'}), [self.publicidad.id])

    def test_el_resumen_suma_lo_filtrado(self):
        """CU53: cantidad y monto total sobre lo filtrado; el monto máximo, sobre todos."""
        respuesta = self.client.get(f'{LISTA}resumen/', {'tipo': 'PUBLICIDAD'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data, {
            'cantidad': 1, 'monto_total': '1500.00', 'monto_maximo': '6000.00',
        })


EXPORTAR = f'{LISTA}exportar/'


class ExportarSinSesion(PruebaSinSesion):
    """Exportar es un endpoint de gestión (corrección E10)."""

    def test_exportar_sin_sesion_da_403(self):
        """E10: GET /api/gastos/exportar/ sin sesión responde 403, en PDF y en Excel."""
        for formato in ('pdf', 'excel'):
            respuesta = self.client.get(EXPORTAR, {'formato': formato})
            self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class ExportarGastos(PruebaConSesion):
    """El listado filtrado se exporta a PDF y a Excel (corrección E10).

    Un gasto de materiales con una fila, uno de materiales sin filas y uno
    de publicidad.
    """

    def setUp(self):
        super().setUp()
        self.de_materiales = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES, fecha='2026-09-10', monto='6000.00')
        MaterialDelGasto.objects.create(
            gasto=self.de_materiales, material=Material.objects.create(nombre='Porcelana fría'),
            cantidad=2, precio_unitario='3000.00',
        )
        self.vacio = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES, fecha='2026-09-20')
        self.publicidad = Gasto.objects.create(
            tipo=Gasto.Tipo.PUBLICIDAD, monto='1500.00', fecha='2026-10-05', descripcion='Instagram',
        )

    def test_el_pdf_se_muestra_y_el_excel_se_descarga(self):
        """E10: el PDF va inline como application/pdf; el Excel, como adjunto .xlsx."""
        respuesta = self.client.get(EXPORTAR, {'formato': 'pdf'})
        self.assertEqual(respuesta['Content-Type'], 'application/pdf')
        self.assertTrue(respuesta['Content-Disposition'].startswith('inline'))

        respuesta = self.client.get(EXPORTAR, {'formato': 'excel'})
        self.assertEqual(respuesta['Content-Type'], TIPO_EXCEL)
        self.assertTrue(respuesta['Content-Disposition'].startswith('attachment'))

    def test_exporta_las_mismas_filas_que_el_listado_filtrado(self):
        """E10: con período y orden=-monto, los gastos del Excel son los del listado; la columna Materiales los nombra o dice "Sin materiales"."""
        filtros = {'fecha_hasta': '2026-09-30', 'orden': '-monto'}

        listado = self.client.get(LISTA, {'pagina': 1, **filtros})
        respuesta = self.client.get(EXPORTAR, {'formato': 'excel', **filtros})
        filas = [[celda.value for celda in fila] for fila in celdas_del_excel(respuesta, 'N.º')]

        self.assertEqual([fila[0] for fila in filas], [gasto['id'] for gasto in listado.data['results']])
        # La columna 4 es Materiales y la 5, el monto, como número.
        self.assertEqual([(fila[0], fila[4], fila[5]) for fila in filas], [
            (self.de_materiales.id, '2 × Porcelana fría', 6000),
            (self.vacio.id, 'Sin materiales', 0),
        ])

    def test_el_encabezado_dice_los_filtros(self):
        """E10: el renglón de filtros nombra el tipo, el período con sus fechas y el rango de monto."""
        respuesta = self.client.get(EXPORTAR, {
            'formato': 'excel', 'tipo': 'PUBLICIDAD',
            'fecha_desde': '2026-10-01', 'fecha_hasta': '2026-10-31', 'monto_desde': '1000',
        })
        hoja = load_workbook(BytesIO(b''.join(respuesta.streaming_content))).active
        # A1 es el título, A2 la fecha y la cantidad, A3 los filtros.
        self.assertEqual(hoja['A2'].value.split(' · ')[1], '1 gasto')
        self.assertEqual(hoja['A3'].value, 'Tipo: Publicidad · Fecha: 01/10/2026 – 31/10/2026 · Monto: desde $1.000')
