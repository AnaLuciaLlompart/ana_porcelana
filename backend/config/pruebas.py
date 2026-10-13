from django.contrib.auth import get_user_model
from django.core.cache import cache
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
