import shutil
import struct
import tempfile
import zlib
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

# =====================================================================
# BASE COMPARTIDA DE LAS PRUEBAS
# =====================================================================
# Lo que necesita más de una app para probarse. Vive en la app pruebas,
# que no es una funcionalidad sino la infraestructura de pruebas: así
# ninguna app importa de otra, y los tests.py de todas importan de acá.

USUARIA = 'ana'
CONTRASENA = 'Porcelana-fria-2026'


class PruebaSinSesion(APITestCase):
    """Base de las pruebas que NO inician sesión.

    Los throttles de DRF guardan sus contadores en la caché, que es la
    misma para todas las pruebas del proceso: sin limpiarla, los
    pedidos de una prueba cuentan para la siguiente y en algún momento
    responde 429 al azar.
    """

    def setUp(self):
        cache.clear()


class PruebaConSesion(PruebaSinSesion):
    """Base de las pruebas que actúan como la usuaria con sesión.

    force_login en vez de client.login(): login() pasa por los backends
    de autenticación, y el de axes exige un request que ahí no existe.
    force_login escribe la sesión directamente.
    """

    def setUp(self):
        super().setUp()
        self.usuaria = get_user_model().objects.create_user(
            USUARIA, password=CONTRASENA,
        )
        self.client.force_login(self.usuaria)


# ---------------------------------------------------------------------
# Imágenes
# ---------------------------------------------------------------------
# Los ImageField guardan el archivo en MEDIA_ROOT, que es la carpeta
# media/ del proyecto. Las pruebas no tienen que dejar nada ahí.

def media_temporal(clase):
    """Decorador de clase: los archivos subidos van a una carpeta temporal.

    Crea la carpeta, le apunta MEDIA_ROOT con override_settings mientras
    corre la clase, y la borra al terminar.
    """
    carpeta = tempfile.mkdtemp(prefix='media_pruebas_')
    clase = override_settings(MEDIA_ROOT=carpeta)(clase)

    terminar_original = clase.tearDownClass

    @classmethod
    def tearDownClass(cls):
        terminar_original.__func__(cls)
        shutil.rmtree(carpeta, ignore_errors=True)

    clase.tearDownClass = tearDownClass
    return clase


def imagen_png(nombre='foto.png', ancho=4, alto=4):
    """Un PNG real y chico, generado en memoria con Pillow.

    Pillow lo abre y lo verifica como imagen válida, que es lo que exige
    ImageField. Devuelve un archivo subido, listo para un POST multipart
    o para crear una fila por ORM.
    """
    buffer = BytesIO()
    Image.new('RGB', (ancho, alto), color=(140, 90, 102)).save(buffer, format='PNG')
    return SimpleUploadedFile(nombre, buffer.getvalue(), content_type='image/png')


# Un PNG es la firma de 8 bytes seguida de chunks. Cada chunk es: el largo
# de los datos (4 bytes), el tipo (4 letras), los datos y un CRC-32 del
# tipo más los datos. Pillow verifica ese CRC chunk por chunk.

FIRMA_PNG = b'\x89PNG\r\n\x1a\n'


def _chunk_png(tipo, datos):
    return (struct.pack('>I', len(datos)) + tipo + datos
            + struct.pack('>I', zlib.crc32(tipo + datos)))


def png_de_mas_de_15mb(nombre='pesada.png'):
    """Un PNG válido de 4×4 que pesa 16 MB.

    Se le agrega, antes del IEND, un chunk tEXt (un comentario) de 16 MB
    con su CRC correcto. Pillow lo abre y lo verifica bien, así que lo
    único que lo rechaza es validar_tamano_archivo: la prueba cubre esa
    regla y no otra.
    """
    base = imagen_png().read()
    iend = _chunk_png(b'IEND', b'')
    comentario = _chunk_png(b'tEXt', b'Comment\x00' + b'a' * (16 * 1024 * 1024))
    return SimpleUploadedFile(
        nombre, base[:-len(iend)] + comentario + iend, content_type='image/png',
    )


def png_bomba(nombre='bomba.png'):
    """Una bomba de descompresión: la cabecera de un PNG de 30.000 × 30.000.

    Son 900 millones de píxeles declarados en el IHDR y casi nada de
    datos. Pillow compara ese tamaño con MAX_IMAGE_PIXELS al abrir el
    archivo, antes de decodificar nada, y por encima del doble del
    límite lanza DecompressionBombError. ImageField atrapa cualquier
    excepción de Pillow y la convierte en "no es una imagen".
    """
    ihdr = struct.pack('>IIBBBBB', 30000, 30000, 8, 2, 0, 0, 0)
    datos = (FIRMA_PNG + _chunk_png(b'IHDR', ihdr)
             + _chunk_png(b'IDAT', zlib.compress(b'\x00'))
             + _chunk_png(b'IEND', b''))
    return SimpleUploadedFile(nombre, datos, content_type='image/png')
