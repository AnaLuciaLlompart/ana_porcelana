import os

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from pruebas.base import (
    PruebaConSesion, imagen_png, media_temporal, png_bomba, png_de_mas_de_15mb,
)
from gastos.models import Gasto, MaterialDelGasto
from productos.models import MaterialProducto, Producto

from .models import Material

LISTA = '/api/materiales/'


def url(material):
    return f'{LISTA}{material.id}/'


class MaterialDiscontinuado(PruebaConSesion):
    """Un material discontinuado queda de solo lectura (CU07)."""

    def setUp(self):
        super().setUp()
        self.material = Material.objects.create(
            nombre='Acrílico rojo', estado=Material.Estado.DISCONTINUADO,
        )

    def test_editar_material_discontinuado_da_400(self):
        """CU06: PUT y PATCH sobre un material discontinuado responden 400 y no cambian nada."""
        for metodo, datos in (('put', {'nombre': 'Otro'}), ('patch', {'nombre': 'Otro'})):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.client, metodo)(url(self.material), datos)
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(
                    respuesta.data['detail'],
                    'El material está discontinuado. Reactivalo para poder modificarlo.',
                )
        self.material.refresh_from_db()
        self.assertEqual(self.material.nombre, 'Acrílico rojo')

    def test_discontinuar_un_material_discontinuado_da_400(self):
        """CU07: la baja lógica no se aplica dos veces."""
        respuesta = self.client.post(f'{url(self.material)}discontinuar/')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'El material ya está discontinuado.')


class EliminarMaterialEnUso(PruebaConSesion):
    """Discontinuar ≠ eliminar: un material referenciado no se elimina (CU09)."""

    def setUp(self):
        super().setUp()
        self.material = Material.objects.create(nombre='Porcelana fría')

    def _usar_en_un_producto(self):
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='1500.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        MaterialProducto.objects.create(producto=producto, material=self.material)

    def _anotar_en_un_gasto(self):
        gasto = Gasto.objects.create(tipo=Gasto.Tipo.MATERIALES)
        MaterialDelGasto.objects.create(
            gasto=gasto, material=self.material, cantidad=1, precio_unitario='800.00',
        )

    def _verificar_rechazo(self, motivos):
        respuesta = self.client.delete(url(self.material))
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            f'No se puede eliminar «Porcelana fría» porque {motivos}. '
            'Si ya no lo conseguís o no lo querés usar más, discontinualo.',
        )
        self.assertTrue(Material.objects.filter(pk=self.material.pk).exists())

    def test_eliminar_material_usado_en_un_producto_da_400(self):
        """CU09: la FK PROTECT de MaterialProducto se explica con un mensaje, no con un 500."""
        self._usar_en_un_producto()
        self._verificar_rechazo('está usado en 1 producto')

    def test_eliminar_material_que_figura_en_un_gasto_da_400(self):
        """CU09: lo mismo con la FK PROTECT de MaterialDelGasto."""
        self._anotar_en_un_gasto()
        self._verificar_rechazo('figura en 1 gasto')

    def test_eliminar_material_usado_y_en_gasto_nombra_los_dos_motivos(self):
        """CU09: el mensaje une los dos motivos con "y"."""
        self._usar_en_un_producto()
        self._anotar_en_un_gasto()
        self._verificar_rechazo('está usado en 1 producto y figura en 1 gasto')


@media_temporal
class ImagenDelMaterial(PruebaConSesion):
    """Lo que ImageField y validar_tamano_archivo rechazan al dar de alta (CU04)."""

    def _subir(self, archivo):
        return self.client.post(
            LISTA, {'nombre': 'Porcelana fría', 'url_imagen': archivo}, format='multipart',
        )

    def _verificar_rechazo(self, respuesta, mensaje):
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['url_imagen'], [mensaje])
        # No quedó ni la fila ni el archivo.
        self.assertEqual(Material.objects.count(), 0)
        self.assertEqual(os.listdir(settings.MEDIA_ROOT), [])

    def test_una_imagen_valida_se_guarda(self):
        """Control: un PNG real entra y la ruta queda bajo /media/materiales/."""
        respuesta = self._subir(imagen_png())
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(respuesta.data['url_imagen'].startswith('/media/materiales/'))
        self.assertEqual(len(os.listdir(os.path.join(settings.MEDIA_ROOT, 'materiales'))), 1)

    def test_un_archivo_que_no_es_imagen_da_400(self):
        """ImageField valida con Pillow que el archivo sea una imagen real, no solo por la extensión."""
        falso = SimpleUploadedFile('foto.png', b'esto no es un png', content_type='image/png')
        self._verificar_rechazo(
            self._subir(falso),
            'El archivo adjunto o bien no es una imagen o bien está dañado.',
        )

    def test_una_imagen_de_mas_de_15_mb_da_400(self):
        """validar_tamano_archivo: el mensaje dice cuánto pesa y cuánto se permite."""
        self._verificar_rechazo(
            self._subir(png_de_mas_de_15mb()),
            'La imagen pesa 16.0 MB y el máximo son 15 MB.',
        )

    def test_una_bomba_de_descompresion_da_400(self):
        """Un PNG que declara 900 millones de píxeles se rechaza sin decodificarlo."""
        self._verificar_rechazo(
            self._subir(png_bomba()),
            'El archivo adjunto o bien no es una imagen o bien está dañado.',
        )
