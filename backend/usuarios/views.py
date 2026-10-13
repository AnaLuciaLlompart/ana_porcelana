from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.http import JsonResponse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


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

    return Response({'detail': 'Contraseña actualizada.'})

