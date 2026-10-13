from axes.models import AccessAttempt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from config.pruebas import CONTRASENA, USUARIA, PruebaConSesion, PruebaSinSesion


class PermisosDeLaGestion(PruebaSinSesion):
    """Denegación por defecto: ningún endpoint de gestión responde sin sesión.

    SessionAuthentication responde 403 y no 401, porque no tiene una
    cabecera WWW-Authenticate que ofrecer.
    """

    def _verificar_sin_sesion(self, base, metodos_con_id=('put', 'patch', 'delete')):
        """GET y POST sobre la lista, y los métodos de escritura sobre /1/.

        El 403 sale antes de buscar el registro, así que el id no tiene
        que existir.
        """
        with self.subTest(metodo='get', url=base):
            self.assertEqual(self.client.get(base).status_code, status.HTTP_403_FORBIDDEN)
        with self.subTest(metodo='post', url=base):
            self.assertEqual(self.client.post(base, {}).status_code, status.HTTP_403_FORBIDDEN)
        for metodo in metodos_con_id:
            url = f'{base}1/'
            with self.subTest(metodo=metodo, url=url):
                respuesta = getattr(self.client, metodo)(url, {})
                self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)

    def test_materiales_sin_sesion_da_403(self):
        """CU04 a CU10: los materiales exigen sesión."""
        self._verificar_sin_sesion('/api/materiales/')

    def test_categorias_sin_sesion_da_403(self):
        """CU11 a CU16: las categorías exigen sesión."""
        self._verificar_sin_sesion('/api/categorias/')

    def test_productos_sin_sesion_da_403(self):
        """CU17 a CU35: los productos exigen sesión."""
        self._verificar_sin_sesion('/api/productos/')

    def test_clientes_sin_sesion_da_403(self):
        """CU36 a CU39: los clientes exigen sesión."""
        self._verificar_sin_sesion('/api/clientes/')

    def test_pedidos_sin_sesion_da_403(self):
        """CU40 a CU51: los pedidos y sus cobros exigen sesión."""
        self._verificar_sin_sesion('/api/pedidos/')

    def test_gastos_sin_sesion_da_403(self):
        """CU52 a CU59: los gastos exigen sesión."""
        self._verificar_sin_sesion('/api/gastos/')

    def test_finanzas_sin_sesion_da_403(self):
        """CU61 y CU62: el informe de finanzas exige sesión, aun con un período válido."""
        url = '/api/finanzas/?desde=2026-01-01&hasta=2026-01-31'
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_inicio_sin_sesion_da_403(self):
        """La pantalla de inicio exige sesión."""
        self.assertEqual(self.client.get('/api/inicio/').status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sin_sesion_redirige_al_login(self):
        """El admin de Django no muestra nada sin sesión: redirige a su login."""
        respuesta = self.client.get('/admin/')
        self.assertEqual(respuesta.status_code, status.HTTP_302_FOUND)
        self.assertEqual(respuesta['Location'], '/admin/login/?next=/admin/')


class SeguridadDeLaSesion(PruebaSinSesion):
    """Protecciones del inicio de sesión (CU01)."""

    def _crear_usuaria(self):
        return get_user_model().objects.create_user(USUARIA, password=CONTRASENA)

    def _login(self, password):
        return self.client.post(
            '/api/auth/login/',
            {'username': USUARIA, 'password': password},
            format='json',
        )

    def test_post_sin_token_csrf_da_403(self):
        """Con sesión pero sin token CSRF, un POST se rechaza.

        El cliente de pruebas de DRF no exige CSRF salvo que se lo pida;
        acá se lo pide para probar que SessionAuthentication lo exige.
        """
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self._crear_usuaria())
        respuesta = cliente.post('/api/materiales/', {'nombre': 'Porcelana fría'})
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('CSRF', respuesta.data['detail'])

    def test_cookie_de_sesion_lleva_httponly(self):
        """La cookie de sesión no se puede leer desde JavaScript."""
        self._crear_usuaria()
        respuesta = self._login(CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        cookie = respuesta.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(int(cookie['max-age']), settings.SESSION_COOKIE_AGE)

    def test_login_bloqueado_tras_intentos_fallidos(self):
        """django-axes: tras AXES_FAILURE_LIMIT fallos, ni la contraseña correcta entra.

        Entre intento e intento se limpia la caché para que el throttle
        de 5 por minuto, que es otra regla, no responda antes que axes.
        """
        self._crear_usuaria()
        limite = settings.AXES_FAILURE_LIMIT

        for intento in range(1, limite):
            cache.clear()
            respuesta = self._login('incorrecta')
            with self.subTest(intento=intento):
                self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)

        # El fallo que llega al límite ya responde bloqueado.
        cache.clear()
        respuesta = self._login('incorrecta')
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Y la contraseña correcta tampoco entra.
        cache.clear()
        respuesta = self._login(CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(
            respuesta.json()['detail'],
            'Demasiados intentos fallidos. Esperá 30 minutos y volvé a intentar.',
        )
        self.assertFalse(respuesta.cookies.get(settings.SESSION_COOKIE_NAME))

        intento = AccessAttempt.objects.get(username=USUARIA)
        self.assertGreaterEqual(intento.failures_since_start, limite)
