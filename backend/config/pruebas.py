import shutil
import tempfile
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
# Lo que necesita más de una app para probarse. Vive en config por el
# mismo motivo que validadores.py: ninguna app debería importar de otra.

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
