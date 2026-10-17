from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status

from config.imagenes import LADO_MAXIMO
from materiales.models import Material
from productos.models import ImagenProducto, Producto

from .base import PruebaConSesion, foto_jpeg, imagen_png, media_temporal


def png_con_transparencia(ancho, alto):
    """Un PNG RGBA con alfa a la mitad en todos los píxeles: transparencia de verdad."""
    buffer = BytesIO()
    Image.new('RGBA', (ancho, alto), (140, 90, 102, 128)).save(buffer, format='PNG')
    return SimpleUploadedFile('con-alfa.png', buffer.getvalue(), content_type='image/png')


@media_temporal
class AchicadoAlSubir(PruebaConSesion):
    """Toda imagen subida se reguarda: 1600 px de lado mayor y JPEG 90, o PNG
    si usa transparencia (config/imagenes.py)."""

    def _subir_a_material(self, archivo):
        """Sube por CU04 y devuelve el FieldFile guardado."""
        respuesta = self.client.post(
            '/api/materiales/', {'nombre': 'Porcelana fría', 'url_imagen': archivo},
            format='multipart',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        return Material.objects.get().url_imagen

    def test_una_foto_grande_se_achica_a_1600_y_pesa_menos(self):
        """CU04: una foto de 3000×2000 queda en 1600×1067, JPEG, y pesa menos que la subida."""
        original = foto_jpeg(ancho=3000, alto=2000)
        peso_original = original.size

        guardada = self._subir_a_material(original)

        with Image.open(guardada.path) as imagen:
            self.assertEqual(imagen.size, (LADO_MAXIMO, 1067))
            self.assertEqual(imagen.format, 'JPEG')
        self.assertLess(guardada.size, peso_original)
        self.assertTrue(guardada.name.endswith('.jpg'))

    def test_una_imagen_chica_conserva_sus_dimensiones(self):
        """CU04: una imagen de 800×600 se guarda de 800×600."""
        guardada = self._subir_a_material(imagen_png(ancho=800, alto=600))

        with Image.open(guardada.path) as imagen:
            self.assertEqual(imagen.size, (800, 600))

    def test_la_transparencia_se_conserva_en_png(self):
        """CU04: un PNG con alfa real se achica igual pero sigue siendo PNG con transparencia."""
        guardada = self._subir_a_material(png_con_transparencia(2000, 2000))

        with Image.open(guardada.path) as imagen:
            self.assertEqual(imagen.size, (LADO_MAXIMO, LADO_MAXIMO))
            self.assertEqual(imagen.format, 'PNG')
            self.assertEqual(imagen.mode, 'RGBA')
            self.assertLess(imagen.getextrema()[3][0], 255)
        self.assertTrue(guardada.name.endswith('.png'))

    def test_las_imagenes_de_producto_tambien_se_achican(self):
        """CU32: el otro campo de imagen del sistema pasa por el mismo achicado."""
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='1500.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        original = foto_jpeg(ancho=2000, alto=3000)
        peso_original = original.size

        respuesta = self.client.post(
            f'/api/productos/{producto.id}/imagenes/', {'imagen': original},
            format='multipart',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        guardada = ImagenProducto.objects.get().imagen
        with Image.open(guardada.path) as imagen:
            self.assertEqual(imagen.size, (1067, LADO_MAXIMO))
            self.assertEqual(imagen.format, 'JPEG')
        self.assertLess(guardada.size, peso_original)
