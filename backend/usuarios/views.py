from axes.utils import reset as reset_axes
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.http import JsonResponse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from single_session.models import UserSession

from .correo import enviar_enlace_de_restablecimiento
from .models import Usuario


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RecuperarThrottle(AnonRateThrottle):
    """El límite de pedidos del enlace para restablecer la contraseña: 5 por hora por IP."""
    scope = 'recuperar'


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

    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'nombre': request.user.get_full_name() or request.user.username,
    })




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
    return Response({
        'id': usuario.id,
        'username': usuario.username,
        'nombre': usuario.get_full_name() or usuario.username,
    })



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

    # El correo no es único en el modelo: a cada usuaria activa que lo tenga
    # le llega su enlace, como hace el PasswordResetForm de Django.
    for usuaria in Usuario.objects.filter(email__iexact=email.strip(), is_active=True):
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

