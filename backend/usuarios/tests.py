import re
from datetime import datetime, timedelta

from axes.models import AccessAttempt
from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient
from single_session.models import UserSession

from pruebas.base import CONTRASENA, USUARIA, PruebaConSesion, PruebaSinSesion


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

    def _login(self, password, username=USUARIA):
        return self.client.post(
            '/api/auth/login/',
            {'username': username, 'password': password},
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
        """La cookie de sesión no se puede leer desde JavaScript, y vence a la hora sin uso (corrección del tutor)."""
        self._crear_usuaria()
        respuesta = self._login(CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        cookie = respuesta.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        # La hora escrita y no settings.SESSION_COOKIE_AGE: así la prueba
        # protege la decisión, y no solo copia lo que diga el setting.
        self.assertEqual(int(cookie['max-age']), 60 * 60)

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

    def test_un_login_fallido_queda_registrado_aunque_responda_401(self):
        """django-axes con ATOMIC_REQUESTS: el 401 del login es un return, no una excepción, así la transacción confirma y el intento fallido queda guardado."""
        self._crear_usuaria()

        respuesta = self._login('incorrecta')
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)

        intento = AccessAttempt.objects.get(username=USUARIA)
        self.assertEqual(intento.failures_since_start, 1)

    def test_el_usuario_no_distingue_mayusculas_y_la_contrasena_si(self):
        """CU01: la contraseña en otra mayúscula y un usuario que no existe dan 401; el usuario en mayúsculas entra."""
        self._crear_usuaria()

        respuesta = self._login(CONTRASENA.swapcase(), username=USUARIA.upper())
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.data['detail'], 'Usuario o contraseña incorrectos.')

        # El mismo mensaje: no revela qué usuarios existen.
        respuesta = self._login(CONTRASENA, username='nadie')
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.data['detail'], 'Usuario o contraseña incorrectos.')

        respuesta = self._login(CONTRASENA, username=USUARIA.upper())
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['username'], USUARIA)

    def test_los_fallos_con_otras_mayusculas_suman_al_mismo_bloqueo(self):
        """django-axes: los fallos con "Ana", "ANA" y "ana" llegan juntos al bloqueo, en una sola fila.

        Entre intento e intento se limpia la caché por el throttle de login,
        como en test_login_bloqueado_tras_intentos_fallidos.
        """
        self._crear_usuaria()
        limite = settings.AXES_FAILURE_LIMIT
        formas = [USUARIA.capitalize(), USUARIA.upper(), USUARIA]

        for intento in range(1, limite):
            cache.clear()
            respuesta = self._login('incorrecta', username=formas[intento % len(formas)])
            with self.subTest(intento=intento):
                self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)

        # El fallo que llega al límite ya responde bloqueado, con otra forma.
        cache.clear()
        respuesta = self._login('incorrecta', username=USUARIA.capitalize())
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Y la contraseña correcta tampoco entra, con ninguna forma.
        cache.clear()
        respuesta = self._login(CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        intento = AccessAttempt.objects.get()
        self.assertEqual(intento.username, USUARIA)
        self.assertGreaterEqual(intento.failures_since_start, limite)


class CerrarSesionYCambiarContrasena(PruebaConSesion):
    """CU02 y CU03, con la usuaria ya adentro."""

    def test_cerrar_sesion_deja_sin_acceso_a_la_gestion(self):
        """CU02: antes del logout la gestión responde 200; después, 403."""
        self.assertEqual(self.client.get('/api/materiales/').status_code, status.HTTP_200_OK)
        respuesta = self.client.post('/api/auth/logout/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)

    def test_cambiar_contrasena_exige_la_actual_y_la_nueva_sirve_para_entrar(self):
        """CU03: con la actual incorrecta da 400; con la correcta da 200, la sesión sigue y la nueva entra."""
        nueva = 'Porcelana-nueva-2027'

        respuesta = self.client.post(
            '/api/auth/password/', {'password_actual': 'incorrecta', 'password_nueva': nueva},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'La contraseña actual es incorrecta.')

        respuesta = self.client.post(
            '/api/auth/password/', {'password_actual': CONTRASENA, 'password_nueva': nueva},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        # update_session_auth_hash: la sesión que hizo el cambio sigue viva.
        self.assertEqual(self.client.get('/api/materiales/').status_code, status.HTTP_200_OK)

        otro_navegador = APIClient()
        datos = {'username': USUARIA, 'password': CONTRASENA}
        self.assertEqual(otro_navegador.post('/api/auth/login/', datos, format='json').status_code,
                         status.HTTP_401_UNAUTHORIZED)
        datos['password'] = nueva
        self.assertEqual(otro_navegador.post('/api/auth/login/', datos, format='json').status_code,
                         status.HTTP_200_OK)


class UnaSolaSesion(PruebaSinSesion):
    """Una única sesión por usuaria con django-single-session (corrección del tutor).

    Cada APIClient es un navegador distinto, con su propia cookie.
    """

    NUEVA = 'Porcelana-nueva-2027'

    def setUp(self):
        super().setUp()
        self.usuaria = get_user_model().objects.create_user(USUARIA, password=CONTRASENA)

    def _entrar(self, cliente, password=CONTRASENA):
        return cliente.post(
            '/api/auth/login/', {'username': USUARIA, 'password': password}, format='json',
        )

    def _sesion_sin_anotar(self):
        """Un navegador con una sesión que la librería no anotó.

        Es como una que ya estaba abierta antes de instalarla: con la
        librería, ni force_login abre una segunda sesión sin cerrar la otra.
        """
        sesion = SessionStore()
        sesion[SESSION_KEY] = str(self.usuaria.pk)
        sesion[BACKEND_SESSION_KEY] = 'django.contrib.auth.backends.ModelBackend'
        sesion[HASH_SESSION_KEY] = self.usuaria.get_session_auth_hash()
        sesion.create()
        cliente = APIClient()
        cliente.cookies[settings.SESSION_COOKIE_NAME] = sesion.session_key
        return cliente

    def test_iniciar_sesion_otra_vez_cierra_la_sesion_anterior(self):
        """CU01: con dos logins de la misma usuaria queda válida solo la segunda; la primera recibe 401 y la gestión 403."""
        primero, segundo = APIClient(), APIClient()
        self.assertEqual(self._entrar(primero).status_code, status.HTTP_200_OK)
        self.assertEqual(primero.get('/api/auth/sesion/').status_code, status.HTTP_200_OK)

        self.assertEqual(self._entrar(segundo).status_code, status.HTTP_200_OK)

        respuesta = primero.get('/api/auth/sesion/')
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.data['detail'], 'No hay sesión activa.')
        self.assertEqual(primero.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)

        self.assertEqual(segundo.get('/api/auth/sesion/').status_code, status.HTTP_200_OK)
        self.assertEqual(segundo.get('/api/materiales/').status_code, status.HTTP_200_OK)
        self.assertEqual(Session.objects.count(), 1)

    def test_un_login_fallido_no_cierra_la_sesion_abierta(self):
        """CU01: un login con la contraseña incorrecta da 401 y la sesión abierta sigue."""
        abierta, intruso = APIClient(), APIClient()
        self.assertEqual(self._entrar(abierta).status_code, status.HTTP_200_OK)

        self.assertEqual(self._entrar(intruso, 'incorrecta').status_code,
                         status.HTTP_401_UNAUTHORIZED)

        self.assertEqual(abierta.get('/api/materiales/').status_code, status.HTTP_200_OK)

    def test_cambiar_la_contrasena_cierra_las_otras_sesiones(self):
        """CU03: la sesión que cambia la contraseña sigue y la otra pasa a 403."""
        quien_cambia = APIClient()
        self.assertEqual(self._entrar(quien_cambia).status_code, status.HTTP_200_OK)
        otra = self._sesion_sin_anotar()
        self.assertEqual(otra.get('/api/materiales/').status_code, status.HTTP_200_OK)

        respuesta = quien_cambia.post(
            '/api/auth/password/', {'password_actual': CONTRASENA, 'password_nueva': self.NUEVA},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        self.assertEqual(quien_cambia.get('/api/materiales/').status_code, status.HTTP_200_OK)
        self.assertEqual(otra.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)

    def test_despues_de_cambiar_la_contrasena_otro_login_cierra_la_sesion(self):
        """CU01 y CU03: la sesión que cambió la contraseña también se cierra cuando se inicia sesión en otro lado."""
        primero, segundo = APIClient(), APIClient()
        self.assertEqual(self._entrar(primero).status_code, status.HTTP_200_OK)
        respuesta = primero.post(
            '/api/auth/password/', {'password_actual': CONTRASENA, 'password_nueva': self.NUEVA},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(primero.get('/api/auth/sesion/').status_code, status.HTTP_200_OK)

        self.assertEqual(self._entrar(segundo, self.NUEVA).status_code, status.HTTP_200_OK)

        self.assertEqual(primero.get('/api/auth/sesion/').status_code,
                         status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(segundo.get('/api/auth/sesion/').status_code, status.HTTP_200_OK)

    def test_el_mismo_navegador_puede_iniciar_sesion_dos_veces(self):
        """CU01: con la sesión ya abierta, otro login responde 200 y queda una sola sesión (issue #11 de django-single-session)."""
        navegador = APIClient()
        self.assertEqual(self._entrar(navegador).status_code, status.HTTP_200_OK)

        # Sin el flush() de iniciar_sesion este login es un 500 (UpdateError).
        self.assertEqual(self._entrar(navegador).status_code, status.HTTP_200_OK)

        self.assertEqual(navegador.get('/api/auth/sesion/').status_code, status.HTTP_200_OK)
        self.assertEqual(Session.objects.count(), 1)
        self.assertEqual(UserSession.objects.count(), 1)


class RecuperarContrasena(PruebaSinSesion):
    """Recuperar la contraseña por correo (corrección del tutor; el camino de vuelta a CU01).

    El runner de Django pone el backend de correo en memoria: lo que se
    manda queda en mail.outbox.
    """

    CORREO = 'ana@example.com'
    NUEVA = 'Porcelana-nueva-2027'
    MENSAJE = 'Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva.'
    MENSAJE_INVALIDO = 'El enlace venció o ya se usó. Pedí uno nuevo.'

    def setUp(self):
        super().setUp()
        self.usuaria = get_user_model().objects.create_user(
            USUARIA, email=self.CORREO, password=CONTRASENA,
        )

    def _pedir_enlace(self, email):
        return self.client.post('/api/auth/recuperar/', {'email': email}, format='json')

    def _enlace_del_correo(self):
        """El uid y el token del último correo mandado, sacados del texto plano."""
        return re.search(r'/gestion/restablecer/([^/\s]+)/([^/\s]+)', mail.outbox[-1].body).groups()

    def _enlace_valido(self):
        """Un uid y un token armados acá, como los arma el backend.

        Se relee la usuaria antes: el token lleva last_login en su firma, y
        un login por la API lo cambia en la base sin tocar este objeto.
        """
        self.usuaria.refresh_from_db()
        uid = urlsafe_base64_encode(force_bytes(self.usuaria.pk))
        return uid, default_token_generator.make_token(self.usuaria)

    def _url(self, uid, token):
        return f'/api/auth/restablecer/{uid}/{token}/'

    def _login(self, password):
        return self.client.post(
            '/api/auth/login/', {'username': USUARIA, 'password': password}, format='json',
        )

    def test_pedir_el_enlace_responde_igual_exista_o_no_el_correo(self):
        """Los dos responden 200 con el mismo texto; solo el correo registrado recibe el enlace, en texto plano y en HTML con el logo."""
        respuesta = self._pedir_enlace(self.CORREO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['detail'], self.MENSAJE)

        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, [self.CORREO])
        self.assertEqual(correo.subject, 'Ana Porcelana · Restablecer tu contraseña')
        uid, token = self._enlace_del_correo()
        enlace = f'{settings.URL_SITIO}/gestion/restablecer/{uid}/{token}'
        self.assertIn(enlace, correo.body)
        self.assertIn('Vale 15 minutos', correo.body)
        # La versión en HTML, con el botón y el mismo enlace.
        html, tipo = correo.alternatives[0]
        self.assertEqual(tipo, 'text/html')
        self.assertIn(f'href="{enlace}"', html)
        self.assertIn('Elegir contraseña nueva', html)
        # El logo va pegado adentro del correo (Content-ID) y el HTML lo usa.
        (logo,) = correo.attachments
        self.assertEqual(logo.get_content_type(), 'image/png')
        self.assertEqual(logo['Content-ID'], '<logo>')
        self.assertIn('src="cid:logo"', html)
        self.assertEqual(correo.message().get_content_type(), 'multipart/related')

        # Un correo que no está registrado: la misma respuesta y ningún correo más.
        respuesta = self._pedir_enlace('nadie@example.com')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['detail'], self.MENSAJE)
        self.assertEqual(len(mail.outbox), 1)

    def test_el_enlace_cambia_la_contrasena_y_sirve_una_sola_vez(self):
        """GET 200 con el usuario, POST 200; entra con la nueva y no con la vieja; el mismo enlace después da 400."""
        self._pedir_enlace(self.CORREO)
        url = self._url(*self._enlace_del_correo())

        respuesta = self.client.get(url)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['username'], USUARIA)

        respuesta = self.client.post(url, {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['detail'], 'Contraseña actualizada. Ya podés iniciar sesión.')

        self.assertEqual(self._login(CONTRASENA).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._login(self.NUEVA).status_code, status.HTTP_200_OK)

        for metodo in ('get', 'post'):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.client, metodo)(url, {'password_nueva': self.NUEVA}, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], self.MENSAJE_INVALIDO)

    def test_un_enlace_vencido_o_mal_armado_da_400(self):
        """Un token de hace 16 minutos, un uid roto, una usuaria que no existe y un token roto dan 400 con el mismo mensaje; uno fresco pasa."""
        class GeneradorDeHace16Minutos(PasswordResetTokenGenerator):
            def _now(self):
                return datetime.now() - timedelta(minutes=16)

        uid, token = self._enlace_valido()
        casos = {
            'vencido': (uid, GeneradorDeHace16Minutos().make_token(self.usuaria)),
            'uid roto': ('zzz', token),
            'usuaria que no existe': (urlsafe_base64_encode(force_bytes(9999)), token),
            'token roto': (uid, 'abc-def'),
        }
        for caso, (u, t) in casos.items():
            with self.subTest(caso=caso):
                respuesta = self.client.get(self._url(u, t))
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], self.MENSAJE_INVALIDO)

        self.assertEqual(self.client.get(self._url(uid, token)).status_code, status.HTTP_200_OK)

    def test_la_contrasena_debil_se_rechaza_y_el_enlace_sigue_valido(self):
        """Vacía o débil, 400 con el mensaje de los validadores; el mismo enlace acepta después una fuerte."""
        url = self._url(*self._enlace_valido())

        respuesta = self.client.post(url, {'password_nueva': ''}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Ingresá la contraseña nueva.')

        respuesta = self.client.post(url, {'password_nueva': '12345678'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotEqual(respuesta.data['detail'], self.MENSAJE_INVALIDO)
        self.assertIn('contraseña', respuesta.data['detail'].lower())
        self.assertTrue(self.usuaria.check_password(CONTRASENA))

        respuesta = self.client.post(url, {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

    def test_restablecer_cierra_las_sesiones_abiertas(self):
        """Una sesión abierta por el login queda afuera: 403 en la gestión y 401 en /api/auth/sesion/."""
        abierta = APIClient()
        datos = {'username': USUARIA, 'password': CONTRASENA}
        self.assertEqual(abierta.post('/api/auth/login/', datos, format='json').status_code,
                         status.HTTP_200_OK)
        self.assertEqual(abierta.get('/api/materiales/').status_code, status.HTTP_200_OK)

        url = self._url(*self._enlace_valido())
        respuesta = self.client.post(url, {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        self.assertEqual(abierta.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(abierta.get('/api/auth/sesion/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Session.objects.count(), 0)

    def test_restablecer_libera_el_bloqueo_de_axes(self):
        """Con la usuaria bloqueada por intentos fallidos, restablecer borra los intentos y el login con la nueva entra.

        Entre intento e intento se limpia la caché por el throttle de login,
        como en test_login_bloqueado_tras_intentos_fallidos.
        """
        for _ in range(settings.AXES_FAILURE_LIMIT):
            cache.clear()
            self._login('incorrecta')
        cache.clear()
        self.assertEqual(self._login(CONTRASENA).status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        url = self._url(*self._enlace_valido())
        cache.clear()
        respuesta = self.client.post(url, {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(AccessAttempt.objects.filter(username=USUARIA).exists())

        cache.clear()
        self.assertEqual(self._login(self.NUEVA).status_code, status.HTTP_200_OK)

    def test_pedir_el_enlace_tiene_un_limite_por_hora(self):
        """El sexto pedido del enlace en una hora desde la misma IP responde 429 (RecuperarThrottle)."""
        for intento in range(1, 6):
            with self.subTest(intento=intento):
                self.assertEqual(self._pedir_enlace('nadie@example.com').status_code,
                                 status.HTTP_200_OK)

        respuesta = self._pedir_enlace('nadie@example.com')
        self.assertEqual(respuesta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(respuesta.has_header('Retry-After'))
