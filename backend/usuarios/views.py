from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
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
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    if not username or not password: # algun campo vacio
        return Response(
            {'detail': 'Debe indicar usuario y contraseña.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # si ambos campos fueron llenados, usa authenticate()
    # authenticate toma los campos, revisa que username este en auth_users, calcula el hash y compara con django_auth. Devuelve el objeto o None
    usuario = authenticate(request, username=username, password=password)

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
    actual = request.data.get('password_actual', '')
    nueva = request.data.get('password_nueva', '')

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

