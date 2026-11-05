from axes.utils import reset as reset_axes
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.db.models import Case, Count, Q, Value, When
from django.http import JsonResponse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework import status
from single_session.models import UserSession

from config.listados import ordenar
from config.paginacion import PaginacionDeListado

from .correo import enviar_enlace_de_restablecimiento
from .models import Usuario
from .serializers import (
    ContrasenaNuevaSerializer, ResumenDeUsuariosSerializer, UsuarioCrearSerializer,
    UsuarioSerializer,
)


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RecuperarThrottle(AnonRateThrottle):
    """El límite de pedidos del enlace para restablecer la contraseña: 5 por hora por IP."""
    scope = 'recuperar'


class EsSuperadministradora(BasePermission):
    """Pasa solo la superadministradora (is_superuser); un administrador recibe 403.

    Es la regla de los dos roles escrita en el backend (corrección del
    tutor, noviembre de 2026): la gestión de usuarios y Mis datos la llevan
    junto con IsAuthenticated. El 403 es "no sos superadministradora"; los
    rechazos de negocio sobre un usuario en particular son 400.
    """

    message = 'Solo la superadministradora puede hacer esto.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


def respuesta_bloqueo(request, respuesta_original, credenciales):
    """Respuesta del login cuando axes bloqueó al usuario + IP.

    La llama AxesMiddleware (AXES_LOCKOUT_CALLABLE en base.py) en lugar
    de la respuesta de la vista. Devuelve 429 con 'detail', el mismo
    formato que el throttle y que la pantalla de login ya muestra. Los
    minutos salen de AXES_COOLOFF_TIME para no repetir el número.
    """
    minutos = int(settings.AXES_COOLOFF_TIME.total_seconds() // 60)
    return JsonResponse(
        {'detail': f'Demasiados intentos fallidos. Esperá {minutos} minutos '
                   'y volvé a intentar.'},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )



@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def sesion_actual(request):
    """Informa quién tiene la sesión activa.

    Además genera la cookie CSRF, que React necesita antes de
    poder enviar cualquier POST.
    """
    if not request.user.is_authenticated:
        return Response(
            {'detail': 'No hay sesión activa.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # El mismo serializer del listado de usuarios: trae el rol
    # (es_superadministradora), que decide si se ve el ítem Usuarios.
    return Response(UsuarioSerializer(request.user).data)




# ------------ INICIAR SESIÓN --------------------------------------

#decoradores (@)
@api_view(['POST'])
@permission_classes([AllowAny]) # sin esta línea, la configuración exigiría sesión activa para iniciar sesión (lo cual es imposible porque este es el iniciar sesion)
@throttle_classes([LoginThrottle])
@csrf_protect
def iniciar_sesion(request):
    """CU01 - Iniciar sesión.

    Protegido contra CSRF: es una petición POST que puede ser
    objetivo de un ataque de login CSRF, donde se fuerza el inicio
    de sesión con la cuenta del atacante.
    """

    # request.data es el JSON que devuelve React del login
    # Un cuerpo que no sea un objeto JSON no tiene .get(), y un usuario que
    # no sea texto no tiene .strip(): los dos casos se rechazan con 400 en
    # vez de terminar en un 500.
    if not isinstance(request.data, dict):
        return Response({'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                        status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get('username', '')
    password = request.data.get('password', '')
    if not isinstance(username, str) or not isinstance(password, str):
        return Response({'detail': 'El usuario y la contraseña tienen que ser texto.'},
                        status=status.HTTP_400_BAD_REQUEST)
    username = username.strip()
    if not username or not password: # algun campo vacio
        return Response(
            {'detail': 'Debe indicar usuario y contraseña.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # El usuario no distingue mayúsculas (pedido del tutor): "Ana" entra como
    # "ana". Se usa el nombre como está guardado, y así axes también cuenta
    # los fallos de "Ana" y "ana" juntos. Si no hay exactamente uno, sigue
    # lo escrito y el error es el de siempre.
    guardados = list(
        Usuario.objects.filter(username__iexact=username).values_list('username', flat=True)
    )
    if len(guardados) == 1:
        username = guardados[0]

    # si ambos campos fueron llenados, usa authenticate()
    # authenticate toma los campos, revisa que username este en auth_users, calcula el hash y compara con django_auth. Devuelve el objeto o None
    # Se le pasa request._request, el HttpRequest de Django que va adentro
    # del request de DRF: axes marca el bloqueo sobre el objeto que recibe,
    # y AxesMiddleware lo busca en el de Django. Con el envoltorio de DRF
    # la marca quedaba en el envoltorio y el middleware no la veía.
    usuario = authenticate(request._request, username=username, password=password)

    if usuario is None:
        return Response(
            {'detail': 'Usuario o contraseña incorrectos.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # django-single-session (issue #11): si este navegador ya tiene la sesión
    # de la usuaria, login() la conserva, la librería la borra junto con las
    # demás y después falla al guardarla (UpdateError, 500). Vaciada, login()
    # crea una nueva, que la librería todavía no anotó y no borra.
    request.session.flush()
    login(request, usuario) # login exitoso: crea una fila en django_session y prepara la cookie
    # La cookie viaja aparte, en las cabeceras, y el JavaScript no la puede leer.

    #la respuesta es la informacion minima que React necesita para renderizar la pagina de Home
    return Response(UsuarioSerializer(usuario).data)



# ----------------------- CERRAR SESION ---------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_protect
def cerrar_sesion(request):
    """CU02 - Cerrar sesión."""
    logout(request)
    return Response({'detail': 'Sesión cerrada.'})




# ------------------------ MODIFICAR PASS -------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_protect
def cambiar_password(request):
    """CU03 - Modificar contraseña."""
    # Mismo chequeo que en iniciar_sesion: el cuerpo tiene que ser un
    # objeto y las dos contraseñas, texto.
    if not isinstance(request.data, dict):
        return Response({'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                        status=status.HTTP_400_BAD_REQUEST)

    actual = request.data.get('password_actual', '')
    nueva = request.data.get('password_nueva', '')
    if not isinstance(actual, str) or not isinstance(nueva, str):
        return Response({'detail': 'Las contraseñas tienen que ser texto.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not actual or not nueva:
        return Response(
            {'detail': 'Debe indicar la contraseña actual y la nueva.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not request.user.check_password(actual):
        return Response(
            {'detail': 'La contraseña actual es incorrecta.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(nueva, user=request.user) # validate.password es el conjunto de reglas para hacer una pass segura (n° carac, letras, numeros, simbolos, etc)
    except ValidationError as e:
        return Response({'detail': ' '.join(e.messages)},
                        status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(nueva)
    request.user.save()
    update_session_auth_hash(request, request.user)
    # update_session_auth_hash mueve la sesión a una clave nueva y borra la
    # vieja, y con ella la anotación de django-single-session. Sin esto, el
    # próximo login en otro lado no cerraría esta sesión.
    UserSession.objects.create(session_id=request.session.session_key, user=request.user)

    return Response({'detail': 'Contraseña actualizada.'})




# ------------- RECUPERAR LA CONTRASEÑA POR CORREO ----------------------
# Corrección del tutor (noviembre de 2026). No es un caso de uso del
# listado: es el camino de vuelta a CU01 cuando se olvidó la contraseña.

MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pedí uno nuevo.'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RecuperarThrottle])
@csrf_protect
def recuperar_contrasena(request):
    """Manda por correo el enlace para elegir una contraseña nueva.

    Responde siempre lo mismo, exista o no el correo: así nadie averigua
    qué correos tienen cuenta. Si Gmail falla, el envío lo registra en el
    log y la respuesta tampoco cambia.
    """
    if not isinstance(request.data, dict):
        return Response({'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                        status=status.HTTP_400_BAD_REQUEST)

    email = request.data.get('email', '')
    if not isinstance(email, str) or not email.strip():
        return Response({'detail': 'Ingresá tu correo.'}, status=status.HTTP_400_BAD_REQUEST)

    # El correo es único sin distinguir mayúsculas (dos roles), así que hay a
    # lo sumo una usuaria con él; si está dada de baja o no existe, no se
    # manda nada y la respuesta es la misma.
    usuaria = Usuario.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if usuaria is not None:
        enviar_enlace_de_restablecimiento(usuaria)

    return Response({'detail': 'Si el correo está registrado, te enviamos un enlace '
                               'para elegir una contraseña nueva.'})


def _usuaria_del_enlace(uidb64, token):
    """La usuaria de un enlace que sirve, o None.

    El uid viene en base64 y el token lo revisa el generador de Django:
    vence a los PASSWORD_RESET_TIMEOUT segundos y deja de servir cuando
    cambia la contraseña, porque la lleva en su firma. Un uid roto, una
    usuaria que no existe y un token vencido o usado dan lo mismo: None.
    """
    try:
        pk = urlsafe_base64_decode(uidb64).decode()
        usuaria = Usuario.objects.get(pk=pk, is_active=True)
    except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
        return None
    if not default_token_generator.check_token(usuaria, token):
        return None
    return usuaria


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
@csrf_protect
def restablecer_contrasena(request, uidb64, token):
    """GET: ¿el enlace sirve? POST: guarda la contraseña nueva.

    La nueva pasa por los mismos validadores que CU03. Al cambiarla se
    cierran todas las sesiones de la usuaria y se libera su bloqueo de
    axes, si lo tenía. El enlace sirve una sola vez solo: lleva la
    contraseña en su firma, y al cambiarla deja de coincidir.
    """
    usuaria = _usuaria_del_enlace(uidb64, token)
    if usuaria is None:
        return Response({'detail': MENSAJE_ENLACE_INVALIDO}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        return Response({'username': usuaria.username})

    if not isinstance(request.data, dict):
        return Response({'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                        status=status.HTTP_400_BAD_REQUEST)

    nueva = request.data.get('password_nueva', '')
    if not isinstance(nueva, str) or not nueva:
        return Response({'detail': 'Ingresá la contraseña nueva.'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(nueva, user=usuaria)
    except ValidationError as e:
        return Response({'detail': ' '.join(e.messages)},
                        status=status.HTTP_400_BAD_REQUEST)

    usuaria.set_password(nueva)
    usuaria.save()
    # Django ya descarta las sesiones de la usuaria en su próximo pedido,
    # porque cada una guarda una huella de la contraseña. Acá se borran
    # además las que anotó django-single-session, para no dejar filas
    # muertas; restablecer no llama a login(), así que la librería no
    # interviene, y el próximo login anota la sesión nueva como siempre.
    Session.objects.filter(usersession__user=usuaria).delete()
    # Si estaba bloqueada por intentos fallidos, el login no entraría ni con
    # la contraseña nueva: AXES_RESET_ON_SUCCESS solo actúa en uno que entra.
    reset_axes(username=usuaria.username)

    return Response({'detail': 'Contraseña actualizada. Ya podés iniciar sesión.'})




# ------------- MIS DATOS (solo la superadministradora) -----------------

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, EsSuperadministradora])
@csrf_protect
def mis_datos(request):
    """La superadministradora cambia sus propios datos desde Mi cuenta (corrección del tutor).

    Toca solo al usuario de la sesión. Cambiar el usuario o el correo
    exige la contraseña actual, porque el correo es la llave para
    recuperar la contraseña; nombre y apellido no la piden. Un
    administrador recibe 403: sus datos los cambia ella desde Usuarios.
    """
    if not isinstance(request.data, dict):
        return Response({'detail': 'El cuerpo tiene que ser un objeto JSON.'},
                        status=status.HTTP_400_BAD_REQUEST)

    usuaria = request.user
    # El mismo serializer de la gestión, con las mismas reglas (obligatorios,
    # repetidos sin distinguir mayúsculas excluyéndose a sí misma). El rol,
    # el estado y la contraseña no son campos suyos de escritura: si vienen
    # en el cuerpo, se ignoran.
    serializer = UsuarioSerializer(usuaria, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data

    cambia_la_llave = (
        datos.get('username', usuaria.username) != usuaria.username
        or datos.get('email', usuaria.email) != usuaria.email
    )
    if cambia_la_llave:
        password = request.data.get('password_actual', '')
        if not isinstance(password, str) or not password:
            return Response(
                {'password_actual': ['Para cambiar el usuario o el correo ingresá tu '
                                     'contraseña actual.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # authenticate() y no check_password(): así axes cuenta la contraseña
        # equivocada como un intento fallido más, igual que en el login, y al
        # quinto bloquea. Por lo mismo este 400 es un return y no un raise:
        # con ATOMIC_REQUESTS un raise desharía el intento que axes acaba de
        # guardar (ver el 401 de iniciar_sesion).
        if authenticate(request._request, username=usuaria.username, password=password) is None:
            return Response(
                {'password_actual': ['La contraseña actual es incorrecta.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer.save()
    return Response(serializer.data)




# ------------- GESTIÓN DE USUARIOS (solo la superadministradora) -------
# Corrección del tutor (noviembre de 2026). No es un caso de uso del
# listado: es la administración de quiénes pueden entrar a la gestión.

# Las columnas por las que se puede ordenar el listado (?orden=nombre, o
# ?orden=-nombre para al revés). ESTADO va en su orden lógico, no en el
# alfabético: la superadministradora, los activos y después los de baja.
ORDENES = {
    'username': ['username'],
    'nombre': ['first_name', 'last_name'],
    'email': ['email'],
    'estado': ['orden_estado'],
}

MENSAJE_SUPERADMINISTRADORA = 'La superadministradora no se gestiona desde acá.'
MENSAJE_DADO_DE_BAJA = 'El usuario está dado de baja. Reactivalo para poder modificarlo.'


class UsuarioViewSet(viewsets.ModelViewSet):
    """Gestión de los administradores por la superadministradora (corrección del tutor).

    Todo exige ser la superadministradora (EsSuperadministradora): un
    administrador recibe 403 también por la API, no solo en la pantalla.

    Dar de baja no es eliminar, como en Materiales: la baja es lógica
    (is_active en False) y reversible, y un dado de baja queda de solo
    lectura hasta que se lo reactiva, como toda entidad de baja del
    sistema; eliminar es definitivo y sirve para corregir una carga mal
    hecha. Sobre la superadministradora no se puede hacer nada desde acá:
    PUT, PATCH, DELETE y las tres acciones responden 400.
    """

    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated, EsSuperadministradora]
    pagination_class = PaginacionDeListado

    def get_serializer_class(self):
        """El alta lleva la contraseña; lo demás, los cuatro datos."""
        if self.action == 'create':
            return UsuarioCrearSerializer

        return super().get_serializer_class()

    def get_queryset(self):
        """En el listado, los filtros y el orden de la URL; en lo demás, sin filtrar."""
        queryset = super().get_queryset()

        if self.action == 'list':
            return self._filtrar(queryset)

        return queryset

    def _filtrar(self, queryset):
        """Aplica al listado la búsqueda, el chip de estado y el orden de la URL.

          busqueda=texto     usuario, nombre, apellido o correo
          estado=ACTIVO      o BAJA; uno solo, como los dos chips
          orden=nombre       una clave de ORDENES; con '-', al revés
        """
        parametros = self.request.query_params

        texto = parametros.get('busqueda', '').strip()
        if texto:
            queryset = queryset.filter(
                Q(username__icontains=texto)
                | Q(first_name__icontains=texto)
                | Q(last_name__icontains=texto)
                | Q(email__icontains=texto)
            )

        estado = parametros.get('estado')
        if estado:
            if estado not in ('ACTIVO', 'BAJA'):
                raise ParseError('Ese estado no existe.')
            queryset = queryset.filter(is_active=(estado == 'ACTIVO'))

        queryset = queryset.annotate(
            orden_estado=Case(
                When(is_superuser=True, then=Value(0)),
                When(is_active=True, then=Value(1)),
                default=Value(2),
            ),
        )
        # Sin orden elegido queda el del modelo, por usuario.
        return ordenar(queryset, parametros, ORDENES, ['username'])

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """La línea de arriba del listado y los números de los dos chips.

        Cuentan sobre TODOS los usuarios, la superadministradora incluida.
        Es una sola consulta: el total y los activos salen de un aggregate,
        y los dados de baja son la diferencia.
        """
        cuentas = Usuario.objects.aggregate(
            usuarios=Count('id'),
            activos=Count('id', filter=Q(is_active=True)),
        )
        datos = {
            'usuarios': cuentas['usuarios'],
            'activos': cuentas['activos'],
            'dados_de_baja': cuentas['usuarios'] - cuentas['activos'],
        }

        return Response(ResumenDeUsuariosSerializer(datos).data)

    def _rechazo(self, usuario, tambien_de_baja=True):
        """Por qué no se puede tocar a este usuario, o None si se puede.

        La superadministradora nunca; un dado de baja, salvo en las dos
        acciones que lo cambian de estado. Los rechazos van antes de
        escribir nada, por eso se devuelven y no se lanzan.
        """
        if usuario.is_superuser:
            return MENSAJE_SUPERADMINISTRADORA
        if tambien_de_baja and not usuario.is_active:
            return MENSAJE_DADO_DE_BAJA
        return None

    def _cerrar_sesiones(self, usuario):
        """Borra las sesiones del usuario que anotó django-single-session.

        Al dado de baja DRF ya no lo autentica (is_active), y al de
        contraseña nueva Django le descarta las sesiones por la huella de la
        contraseña: el efecto es inmediato aunque alguna sesión no estuviera
        anotada. Esto es para no dejar filas muertas.
        """
        Session.objects.filter(usersession__user=usuario).delete()

    def update(self, request, *args, **kwargs):
        """Impide modificar a la superadministradora y a un dado de baja (PUT y PATCH)."""
        rechazo = self._rechazo(self.get_object())
        if rechazo:
            return Response({'detail': rechazo}, status=status.HTTP_400_BAD_REQUEST)

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Elimina un administrador para siempre; a la superadministradora, nunca.

        Es definitivo, a diferencia de dar de baja, y vale también para un
        dado de baja. Antes de borrarlo se cierran sus sesiones (la fila de
        django_session no depende del usuario y quedaría muerta) y se
        borran sus intentos fallidos de axes, que se guardan por nombre: si
        no, le contarían a un usuario nuevo con el mismo nombre.
        """
        usuario = self.get_object()

        if usuario.is_superuser:
            return Response({'detail': MENSAJE_SUPERADMINISTRADORA},
                            status=status.HTTP_400_BAD_REQUEST)

        self._cerrar_sesiones(usuario)
        reset_axes(username=usuario.username)

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def cambiar_password(self, request, pk=None):
        """La superadministradora le pone una contraseña nueva a un administrador.

        Le cierra la sesión que tuviera abierta y libera su bloqueo de axes,
        si lo tenía: con la contraseña nueva entra en el momento.
        """
        usuario = self.get_object()

        rechazo = self._rechazo(usuario)
        if rechazo:
            return Response({'detail': rechazo}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ContrasenaNuevaSerializer(data=request.data, context={'usuario': usuario})
        serializer.is_valid(raise_exception=True)

        usuario.set_password(serializer.validated_data['password_nueva'])
        usuario.save()
        self._cerrar_sesiones(usuario)
        reset_axes(username=usuario.username)

        return Response(self.get_serializer(usuario).data)

    @action(detail=True, methods=['post'])
    def dar_de_baja(self, request, pk=None):
        """Baja lógica: el usuario no puede entrar más y su sesión se cierra ahora.

        Se conserva el registro, con is_active en False. Un dado de baja
        tampoco recibe el enlace para recuperar la contraseña.
        """
        usuario = self.get_object()

        rechazo = self._rechazo(usuario, tambien_de_baja=False)
        if rechazo:
            return Response({'detail': rechazo}, status=status.HTTP_400_BAD_REQUEST)

        if not usuario.is_active:
            return Response({'detail': 'El usuario ya está dado de baja.'},
                            status=status.HTTP_400_BAD_REQUEST)

        usuario.is_active = False
        usuario.save(update_fields=['is_active'])
        self._cerrar_sesiones(usuario)

        return Response(self.get_serializer(usuario).data)

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        """Vuelve a dejar entrar a un dado de baja, y libera su bloqueo de axes si lo tenía."""
        usuario = self.get_object()

        rechazo = self._rechazo(usuario, tambien_de_baja=False)
        if rechazo:
            return Response({'detail': rechazo}, status=status.HTTP_400_BAD_REQUEST)

        if usuario.is_active:
            return Response({'detail': 'El usuario ya está activo.'},
                            status=status.HTTP_400_BAD_REQUEST)

        usuario.is_active = True
        usuario.save(update_fields=['is_active'])
        reset_axes(username=usuario.username)

        return Response(self.get_serializer(usuario).data)

