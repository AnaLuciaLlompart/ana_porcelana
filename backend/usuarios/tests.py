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

    def test_usuarios_y_mis_datos_sin_sesion_dan_403(self):
        """La gestión de usuarios y Mis datos exigen sesión (corrección del tutor: dos roles)."""
        self._verificar_sin_sesion('/api/usuarios/')
        self.assertEqual(self.client.patch('/api/auth/mis_datos/', {}).status_code,
                         status.HTTP_403_FORBIDDEN)

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
        # Nada de la plantilla se cuela en el correo (un comentario {# #} de
        # varias líneas se imprime tal cual: Django solo lo entiende en una).
        self.assertNotIn('{#', html)
        self.assertNotIn('{%', html)
        self.assertIn('Accesorios hechos a mano con', html)

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


class GestionDeUsuarios(PruebaSinSesion):
    """Dos roles (corrección del tutor): la superadministradora gestiona a los administradores.

    La superadministradora es la usuaria de la base (is_superuser); el
    administrador se crea por ORM con create_user, como lo crea el alta.
    """

    ADMINISTRADOR = 'juan'
    CORREO_ADMINISTRADOR = 'juan@example.com'
    NUEVA = 'Porcelana-nueva-2027'
    URL = '/api/usuarios/'

    def setUp(self):
        super().setUp()
        Usuario = get_user_model()
        self.superadministradora = Usuario.objects.create_superuser(
            USUARIA, 'ana@example.com', CONTRASENA, first_name='Ana Lucía', last_name='Llompart',
        )
        self.administrador = Usuario.objects.create_user(
            self.ADMINISTRADOR, self.CORREO_ADMINISTRADOR, CONTRASENA,
            first_name='Juan', last_name='Pérez',
        )
        self.client.force_login(self.superadministradora)

    def _url(self, usuario, accion=''):
        return f'{self.URL}{usuario.pk}/{accion}'

    def _datos(self, **cambios):
        """Un alta válida de administradora, con lo que se quiera cambiar."""
        datos = {
            'username': 'sofi', 'first_name': 'Sofía', 'last_name': 'Gómez',
            'email': 'sofi@example.com', 'password': 'Porcelana-sofi-2026',
        }
        datos.update(cambios)
        return datos

    def _login(self, cliente, username, password):
        return cliente.post('/api/auth/login/', {'username': username, 'password': password},
                            format='json')

    def _bloquear(self, username):
        """Deja al usuario bloqueado por axes con AXES_FAILURE_LIMIT fallos (la caché, por el throttle de login)."""
        intruso = APIClient()
        for _ in range(settings.AXES_FAILURE_LIMIT):
            cache.clear()
            self._login(intruso, username, 'incorrecta')
        cache.clear()
        self.assertEqual(self._login(intruso, username, CONTRASENA).status_code,
                         status.HTTP_429_TOO_MANY_REQUESTS)

    def test_un_administrador_recibe_403_en_la_gestion_de_usuarios(self):
        """Los nueve pedidos de usuarios responden 403 a un administrador, y el resto de la gestión 200."""
        administrador = APIClient()
        administrador.force_login(self.administrador)
        url = self._url(self.superadministradora)
        pedidos = [
            ('get', self.URL), ('get', f'{self.URL}resumen/'), ('post', self.URL),
            ('put', url), ('patch', url), ('delete', url),
            ('post', self._url(self.administrador, 'cambiar_password/')),
            ('post', self._url(self.administrador, 'dar_de_baja/')),
            ('post', self._url(self.administrador, 'reactivar/')),
        ]
        for metodo, direccion in pedidos:
            with self.subTest(metodo=metodo, url=direccion):
                respuesta = getattr(administrador, metodo)(direccion, {}, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(respuesta.data['detail'],
                                 'Solo la superadministradora puede hacer esto.')

        self.assertEqual(administrador.get('/api/materiales/').status_code, status.HTTP_200_OK)
        self.assertEqual(administrador.get('/api/pedidos/').status_code, status.HTTP_200_OK)
        self.assertEqual(administrador.get('/api/inicio/').status_code, status.HTTP_200_OK)

    def test_la_superadministradora_da_de_alta_modifica_lista_busca_filtra_y_pagina(self):
        """Alta 201 sin permisos de staff ni superuser y la nueva entra; PUT y PATCH 200; el listado trae el rol, busca, filtra por estado, ordena y pagina; resumen."""
        respuesta = self.client.post(self.URL, self._datos(), format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', respuesta.data)
        self.assertTrue(respuesta.data['is_active'])
        self.assertFalse(respuesta.data['es_superadministradora'])
        # Recién creada: tiene fecha de alta y todavía no entró nunca.
        self.assertIsNotNone(respuesta.data['date_joined'])
        self.assertIsNone(respuesta.data['last_login'])
        nueva = get_user_model().objects.get(username='sofi')
        self.assertFalse(nueva.is_staff)
        self.assertFalse(nueva.is_superuser)
        self.assertEqual(self._login(APIClient(), 'sofi', 'Porcelana-sofi-2026').status_code,
                         status.HTTP_200_OK)

        respuesta = self.client.put(
            self._url(nueva),
            {'username': 'sofia.g', 'first_name': 'Sofía', 'last_name': 'Gómez Paz',
             'email': 'sofia.gomez@example.com'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['username'], 'sofia.g')
        self.assertEqual(respuesta.data['email'], 'sofia.gomez@example.com')

        respuesta = self.client.patch(self._url(nueva), {'first_name': 'Sofi'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['first_name'], 'Sofi')
        self.assertEqual(respuesta.data['last_name'], 'Gómez Paz')

        respuesta = self.client.get(f'{self.URL}?pagina=1')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['count'], 3)
        por_usuario = {fila['username']: fila for fila in respuesta.data['results']}
        self.assertEqual(list(por_usuario), [USUARIA, self.ADMINISTRADOR, 'sofia.g'])
        self.assertTrue(por_usuario[USUARIA]['es_superadministradora'])
        self.assertFalse(por_usuario[self.ADMINISTRADOR]['es_superadministradora'])

        casos = {'gómez': ['sofia.g'], 'juan@': [self.ADMINISTRADOR], 'LLOMP': [USUARIA]}
        for texto, esperados in casos.items():
            with self.subTest(busqueda=texto):
                respuesta = self.client.get(f'{self.URL}?pagina=1&busqueda={texto}')
                self.assertEqual([fila['username'] for fila in respuesta.data['results']], esperados)

        respuesta = self.client.get(f'{self.URL}?pagina=1&estado=ACTIVO')
        self.assertEqual(respuesta.data['count'], 3)
        respuesta = self.client.get(f'{self.URL}?pagina=1&estado=BAJA')
        self.assertEqual(respuesta.data['count'], 0)
        respuesta = self.client.get(f'{self.URL}?pagina=1&estado=OTRO')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'Ese estado no existe.')

        respuesta = self.client.get(f'{self.URL}?pagina=1&orden=-username')
        self.assertEqual([fila['username'] for fila in respuesta.data['results']],
                         ['sofia.g', self.ADMINISTRADOR, USUARIA])
        respuesta = self.client.get(f'{self.URL}?pagina=1&orden=color')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)

        respuesta = self.client.get(f'{self.URL}?pagina=2&por_pagina=2')
        self.assertEqual(respuesta.data['count'], 3)
        self.assertEqual(len(respuesta.data['results']), 1)
        self.assertIsNone(respuesta.data['next'])

        respuesta = self.client.get(f'{self.URL}resumen/')
        self.assertEqual(respuesta.data, {'usuarios': 3, 'activos': 3, 'dados_de_baja': 0})

    def test_usuario_o_correo_repetidos_sin_distinguir_mayusculas_dan_400(self):
        """En el alta y en la modificación; el propio usuario en otra mayúscula pasa."""
        repetidos = {
            'username': ('JUAN', 'Ya existe un usuario con ese nombre.'),
            'email': ('Juan@Example.com', 'Ya hay un usuario con ese correo.'),
        }
        for campo, (valor, mensaje) in repetidos.items():
            with self.subTest(alta=campo):
                respuesta = self.client.post(self.URL, self._datos(**{campo: valor}), format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data[campo], [mensaje])
        self.assertFalse(get_user_model().objects.filter(username='sofi').exists())

        chocan_con_ana = {'username': 'ANA', 'email': 'ANA@EXAMPLE.COM'}
        for campo, valor in chocan_con_ana.items():
            with self.subTest(modificacion=campo):
                respuesta = self.client.patch(self._url(self.administrador), {campo: valor},
                                              format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data[campo], [repetidos[campo][1]])

        respuesta = self.client.patch(
            self._url(self.administrador), {'username': 'JUAN', 'email': 'JUAN@EXAMPLE.COM'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['username'], 'JUAN')

    def test_nombre_apellido_o_correo_vacios_y_contrasena_debil_dan_400(self):
        """Cada campo obligatorio vacío o ausente da 400 con su clave; la contraseña débil, con la clave password; con todo bien, 201."""
        for campo in ('first_name', 'last_name', 'email', 'username'):
            with self.subTest(vacio=campo):
                respuesta = self.client.post(self.URL, self._datos(**{campo: ''}), format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, respuesta.data)
            with self.subTest(ausente=campo):
                datos = self._datos()
                del datos[campo]
                respuesta = self.client.post(self.URL, datos, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, respuesta.data)

        respuesta = self.client.post(self.URL, self._datos(email='sin-arroba'), format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', respuesta.data)

        for debil in ('12345678', 'sofi', 'sofi@example.com'):
            with self.subTest(password=debil):
                respuesta = self.client.post(self.URL, self._datos(password=debil), format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(list(respuesta.data), ['password'])
        self.assertFalse(get_user_model().objects.filter(username='sofi').exists())

        respuesta = self.client.post(self.URL, self._datos(), format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)

    def test_cambiar_la_contrasena_de_un_administrador_cierra_su_sesion_y_entra_con_la_nueva(self):
        """Su sesión abierta pasa a 403 en la gestión y 401 en /api/auth/sesion/; entra con la nueva y no con la vieja; una débil da 400."""
        navegador = APIClient()
        self.assertEqual(self._login(navegador, self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_200_OK)
        self.assertEqual(navegador.get('/api/materiales/').status_code, status.HTTP_200_OK)

        respuesta = self.client.post(self._url(self.administrador, 'cambiar_password/'),
                                     {'password_nueva': '12345678'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(list(respuesta.data), ['password_nueva'])
        self.assertEqual(navegador.get('/api/materiales/').status_code, status.HTTP_200_OK)

        respuesta = self.client.post(self._url(self.administrador, 'cambiar_password/'),
                                     {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['username'], self.ADMINISTRADOR)

        self.assertEqual(navegador.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(navegador.get('/api/auth/sesion/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Session.objects.filter(usersession__user=self.administrador).count(), 0)

        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, self.NUEVA).status_code,
                         status.HTTP_200_OK)

    def test_dar_de_baja_cierra_la_sesion_y_no_deja_entrar_ni_recuperar_y_reactivar_lo_devuelve(self):
        """De baja: 403 y 401 en la sesión abierta, el login dice "Usuario o contraseña incorrectos." y recuperar no manda correo; reactivado, entra."""
        navegador = APIClient()
        self.assertEqual(self._login(navegador, self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_200_OK)

        respuesta = self.client.post(self._url(self.administrador, 'dar_de_baja/'))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(respuesta.data['is_active'])

        self.assertEqual(navegador.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(navegador.get('/api/auth/sesion/').status_code, status.HTTP_401_UNAUTHORIZED)

        respuesta = self._login(APIClient(), self.ADMINISTRADOR, CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.data['detail'], 'Usuario o contraseña incorrectos.')

        respuesta = self.client.post('/api/auth/recuperar/', {'email': self.CORREO_ADMINISTRADOR},
                                     format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        respuesta = self.client.post(self._url(self.administrador, 'dar_de_baja/'))
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'El usuario ya está dado de baja.')

        respuesta = self.client.get(f'{self.URL}resumen/')
        self.assertEqual(respuesta.data, {'usuarios': 2, 'activos': 1, 'dados_de_baja': 1})
        respuesta = self.client.get(f'{self.URL}?pagina=1&estado=BAJA')
        self.assertEqual([fila['username'] for fila in respuesta.data['results']],
                         [self.ADMINISTRADOR])

        respuesta = self.client.post(self._url(self.administrador, 'reactivar/'))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertTrue(respuesta.data['is_active'])
        cache.clear()
        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_200_OK)

        respuesta = self.client.post(self._url(self.administrador, 'reactivar/'))
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'El usuario ya está activo.')

    def test_un_dado_de_baja_no_se_modifica_ni_se_le_cambia_la_contrasena(self):
        """PUT, PATCH y cambiar_password sobre un dado de baja dan 400; reactivado, los tres pasan."""
        self.client.post(self._url(self.administrador, 'dar_de_baja/'))
        mensaje = 'El usuario está dado de baja. Reactivalo para poder modificarlo.'
        datos = {'username': self.ADMINISTRADOR, 'first_name': 'Juan Carlos', 'last_name': 'Pérez',
                 'email': self.CORREO_ADMINISTRADOR}

        pedidos = [
            ('put', self._url(self.administrador), datos),
            ('patch', self._url(self.administrador), {'first_name': 'Juan Carlos'}),
            ('post', self._url(self.administrador, 'cambiar_password/'), {'password_nueva': self.NUEVA}),
        ]
        for metodo, url, cuerpo in pedidos:
            with self.subTest(metodo=metodo, url=url):
                respuesta = getattr(self.client, metodo)(url, cuerpo, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'], mensaje)
        self.administrador.refresh_from_db()
        self.assertEqual(self.administrador.first_name, 'Juan')
        self.assertTrue(self.administrador.check_password(CONTRASENA))

        self.client.post(self._url(self.administrador, 'reactivar/'))
        for metodo, url, cuerpo in pedidos:
            with self.subTest(reactivado=metodo, url=url):
                respuesta = getattr(self.client, metodo)(url, cuerpo, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

    def test_nada_se_puede_hacer_sobre_la_superadministradora(self):
        """PUT, PATCH, DELETE y las tres acciones sobre ella dan 400; el rol y el estado en el cuerpo de un PUT se ignoran."""
        url = self._url(self.superadministradora)
        datos = {'username': USUARIA, 'first_name': 'Otra', 'last_name': 'Persona',
                 'email': 'ana@example.com'}
        pedidos = [
            ('put', url, datos), ('patch', url, {'first_name': 'Otra'}), ('delete', url, {}),
            ('post', self._url(self.superadministradora, 'cambiar_password/'),
             {'password_nueva': self.NUEVA}),
            ('post', self._url(self.superadministradora, 'dar_de_baja/'), {}),
            ('post', self._url(self.superadministradora, 'reactivar/'), {}),
        ]
        for metodo, direccion, cuerpo in pedidos:
            with self.subTest(metodo=metodo, url=direccion):
                respuesta = getattr(self.client, metodo)(direccion, cuerpo, format='json')
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['detail'],
                                 'La superadministradora no se gestiona desde acá.')
        self.assertTrue(get_user_model().objects.filter(pk=self.superadministradora.pk).exists())
        self.superadministradora.refresh_from_db()
        self.assertEqual(self.superadministradora.first_name, 'Ana Lucía')
        self.assertTrue(self.superadministradora.is_active)
        self.assertTrue(self.superadministradora.check_password(CONTRASENA))

        respuesta = self.client.put(
            self._url(self.administrador),
            {'username': self.ADMINISTRADOR, 'first_name': 'Juan', 'last_name': 'Pérez',
             'email': self.CORREO_ADMINISTRADOR, 'is_superuser': True, 'is_staff': True,
             'is_active': False, 'es_superadministradora': True,
             'date_joined': '2000-01-01T00:00:00Z', 'last_login': '2000-01-01T00:00:00Z'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.administrador.refresh_from_db()
        self.assertFalse(self.administrador.is_superuser)
        self.assertFalse(self.administrador.is_staff)
        self.assertTrue(self.administrador.is_active)
        self.assertNotEqual(self.administrador.date_joined.year, 2000)
        self.assertIsNone(self.administrador.last_login)

    def test_eliminar_un_administrador_es_definitivo(self):
        """DELETE responde 204 y el usuario desaparece con su sesión abierta y sus intentos de axes; un dado de baja también se elimina."""
        navegador = APIClient()
        self.assertEqual(self._login(navegador, self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_200_OK)
        clave = navegador.cookies[settings.SESSION_COOKIE_NAME].value
        cache.clear()
        self._login(APIClient(), self.ADMINISTRADOR, 'incorrecta')
        self.assertTrue(AccessAttempt.objects.filter(username=self.ADMINISTRADOR).exists())

        respuesta = self.client.delete(self._url(self.administrador))
        self.assertEqual(respuesta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(get_user_model().objects.filter(pk=self.administrador.pk).exists())
        self.assertFalse(Session.objects.filter(session_key=clave).exists())
        self.assertEqual(navegador.get('/api/materiales/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(AccessAttempt.objects.filter(username=self.ADMINISTRADOR).exists())
        cache.clear()
        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_401_UNAUTHORIZED)

        de_baja = get_user_model().objects.create_user(
            'sofi', 'sofi@example.com', CONTRASENA, first_name='Sofía', last_name='Gómez',
            is_active=False,
        )
        respuesta = self.client.delete(self._url(de_baja))
        self.assertEqual(respuesta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(get_user_model().objects.filter(pk=de_baja.pk).exists())

    def test_la_sesion_y_el_login_dicen_el_rol_y_traen_los_datos(self):
        """/api/auth/sesion/ y el login responden es_superadministradora (True para ella, False para un administrador), nombre, apellido y correo."""
        respuesta = self.client.get('/api/auth/sesion/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertTrue(respuesta.data['es_superadministradora'])
        self.assertEqual(respuesta.data['username'], USUARIA)
        self.assertEqual(respuesta.data['first_name'], 'Ana Lucía')
        self.assertEqual(respuesta.data['last_name'], 'Llompart')
        self.assertEqual(respuesta.data['email'], 'ana@example.com')

        navegador = APIClient()
        respuesta = self._login(navegador, self.ADMINISTRADOR, CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(respuesta.data['es_superadministradora'])
        self.assertEqual(respuesta.data['first_name'], 'Juan')
        self.assertEqual(respuesta.data['email'], self.CORREO_ADMINISTRADOR)
        self.assertEqual(navegador.get('/api/auth/sesion/').data, respuesta.data)

    def test_cambiar_la_contrasena_y_reactivar_liberan_el_bloqueo_de_axes(self):
        """Un administrador bloqueado por cinco fallos entra con la contraseña nueva que le pone la superadministradora; reactivarlo también borra sus intentos."""
        self._bloquear(self.ADMINISTRADOR)

        respuesta = self.client.post(self._url(self.administrador, 'cambiar_password/'),
                                     {'password_nueva': self.NUEVA}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(AccessAttempt.objects.filter(username=self.ADMINISTRADOR).exists())
        cache.clear()
        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, self.NUEVA).status_code,
                         status.HTTP_200_OK)

        self.administrador.set_password(CONTRASENA)
        self.administrador.save()
        self._bloquear(self.ADMINISTRADOR)
        self.client.post(self._url(self.administrador, 'dar_de_baja/'))
        self.assertTrue(AccessAttempt.objects.filter(username=self.ADMINISTRADOR).exists())

        respuesta = self.client.post(self._url(self.administrador, 'reactivar/'))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(AccessAttempt.objects.filter(username=self.ADMINISTRADOR).exists())
        cache.clear()
        self.assertEqual(self._login(APIClient(), self.ADMINISTRADOR, CONTRASENA).status_code,
                         status.HTTP_200_OK)


class MisDatos(PruebaSinSesion):
    """La superadministradora edita sus propios datos desde Mi cuenta (corrección del tutor)."""

    URL = '/api/auth/mis_datos/'
    SIN_CONTRASENA = 'Para cambiar el usuario o el correo ingresá tu contraseña actual.'

    def setUp(self):
        super().setUp()
        Usuario = get_user_model()
        self.superadministradora = Usuario.objects.create_superuser(
            USUARIA, 'ana@example.com', CONTRASENA, first_name='Ana Lucía', last_name='Llompart',
        )
        self.administrador = Usuario.objects.create_user(
            'juan', 'juan@example.com', CONTRASENA, first_name='Juan', last_name='Pérez',
        )
        self.client.force_login(self.superadministradora)

    def _cambiar(self, **datos):
        return self.client.patch(self.URL, datos, format='json')

    def test_cambia_nombre_y_apellido_sin_contrasena(self):
        """200 con los datos nuevos, que la sesión también muestra; nombre o apellido vacíos dan 400."""
        respuesta = self._cambiar(first_name='Ana', last_name='Llompart Díaz')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['first_name'], 'Ana')
        self.assertEqual(respuesta.data['last_name'], 'Llompart Díaz')
        self.assertTrue(respuesta.data['es_superadministradora'])
        self.assertEqual(self.client.get('/api/auth/sesion/').data, respuesta.data)

        respuesta = self._cambiar(first_name='')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('first_name', respuesta.data)
        self.superadministradora.refresh_from_db()
        self.assertEqual(self.superadministradora.first_name, 'Ana')

    def test_cambiar_el_correo_o_el_usuario_exige_la_contrasena_actual(self):
        """Sin ella, 400; equivocada, 400 y un intento fallido en axes; con la correcta, 200 y entra con el usuario nuevo."""
        for cambio in ({'email': 'nueva@example.com'}, {'username': 'analu'}):
            with self.subTest(sin_contrasena=list(cambio)):
                respuesta = self._cambiar(**cambio)
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(respuesta.data['password_actual'], [self.SIN_CONTRASENA])

        respuesta = self._cambiar(email='nueva@example.com', password_actual='incorrecta')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['password_actual'], ['La contraseña actual es incorrecta.'])
        self.assertEqual(AccessAttempt.objects.get(username=USUARIA).failures_since_start, 1)
        self.superadministradora.refresh_from_db()
        self.assertEqual(self.superadministradora.email, 'ana@example.com')

        # El mismo correo que ya tiene no es un cambio: no pide la contraseña.
        respuesta = self._cambiar(email='ana@example.com', first_name='Ana')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        respuesta = self._cambiar(email='nueva@example.com', username='analu',
                                  password_actual=CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data['email'], 'nueva@example.com')
        self.assertEqual(respuesta.data['username'], 'analu')

        respuesta = APIClient().post('/api/auth/login/', {'username': 'analu', 'password': CONTRASENA},
                                     format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

    def test_usuario_o_correo_de_otro_sin_distinguir_mayusculas_dan_400(self):
        """El usuario y el correo del administrador, en otras mayúsculas, se rechazan con el mismo mensaje que en la gestión."""
        respuesta = self._cambiar(username='JUAN', password_actual=CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['username'], ['Ya existe un usuario con ese nombre.'])

        respuesta = self._cambiar(email='Juan@Example.com', password_actual=CONTRASENA)
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['email'], ['Ya hay un usuario con ese correo.'])

        self.superadministradora.refresh_from_db()
        self.assertEqual(self.superadministradora.username, USUARIA)
        self.assertEqual(self.superadministradora.email, 'ana@example.com')

    def test_el_rol_el_estado_y_la_contrasena_en_el_cuerpo_se_ignoran(self):
        """Un PATCH con is_superuser, is_staff, is_active o password los deja como estaban."""
        respuesta = self._cambiar(first_name='Ana', is_superuser=False, is_staff=False,
                                  is_active=False, es_superadministradora=False, password='otra')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertTrue(respuesta.data['es_superadministradora'])

        self.superadministradora.refresh_from_db()
        self.assertTrue(self.superadministradora.is_superuser)
        self.assertTrue(self.superadministradora.is_staff)
        self.assertTrue(self.superadministradora.is_active)
        self.assertTrue(self.superadministradora.check_password(CONTRASENA))
        self.assertEqual(self.client.get('/api/materiales/').status_code, status.HTTP_200_OK)

    def test_un_administrador_recibe_403_pero_cambia_su_propia_contrasena(self):
        """Mis datos responde 403 a un administrador; /api/auth/password/ le responde 200 (CU03)."""
        administrador = APIClient()
        administrador.force_login(self.administrador)

        respuesta = administrador.patch(self.URL, {'first_name': 'Otro'}, format='json')
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(respuesta.data['detail'], 'Solo la superadministradora puede hacer esto.')
        self.administrador.refresh_from_db()
        self.assertEqual(self.administrador.first_name, 'Juan')

        respuesta = administrador.post(
            '/api/auth/password/',
            {'password_actual': CONTRASENA, 'password_nueva': 'Porcelana-nueva-2027'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(administrador.get('/api/materiales/').status_code, status.HTTP_200_OK)
