from .base import *  # noqa: F401,F403  
#el noqa es para que no me tome el import como problema

#Configuración para el entorno de producción.
#Todos los valores sensibles se leen del entorno: este archivo no contiene ninguna credencial ni dominio escrito a mano.



# Nunca activar en producción: las páginas de error exponen la
# configuración interna, las rutas del proyecto y fragmentos de código.
DEBUG = False


# Dominios desde los que se admiten requests. Django rechaza cualquier petición dirigida a un host que no figure aca, lo que
# protege contra ataques de cabecera Host.
ALLOWED_HOSTS = [host for host in os.getenv('ALLOWED_HOSTS', '').split(',') if host]

CSRF_TRUSTED_ORIGINS = [origen for origen in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if origen]



# En el servidor hay certificado y todo viaja cifrado. En la prueba con
# Docker en la PC no lo hay: se entra por http://localhost, y con las
# cuatro opciones que siguen encendidas Django redirigiría a una
# https://localhost que no existe. HTTPS_ACTIVO=no las apaga solo ahí.
# Si la variable falta, quedan encendidas: olvidarla en el servidor es
# seguro. Son las únicas que dependen del certificado; el resto de este
# archivo vale igual con o sin HTTPS.
HTTPS_ACTIVO = os.getenv('HTTPS_ACTIVO', 'si') == 'si'

# Las cookies solo viajan sobre conexiones cifradas. Depende de HTTPS_ACTIVO:
# en el servidor (si) se exige; en la prueba local por http (no) se apaga.
SESSION_COOKIE_SECURE = HTTPS_ACTIVO
CSRF_COOKIE_SECURE = HTTPS_ACTIVO
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'


# Redirige a HTTPS cualquier petición que llegue por HTTP. Depende de
# HTTPS_ACTIVO: sin certificado no habría adónde redirigir.
SECURE_SSL_REDIRECT = HTTPS_ACTIVO


# Indica al navegador que use HTTPS durante un año, incluso si el
# usuario escribe la dirección sin el protocolo. Depende de HTTPS_ACTIVO:
# con no, cero segundos, que es no mandar la cabecera.
SECURE_HSTS_SECONDS = 31536000 if HTTPS_ACTIVO else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True


# Impide que el navegador interprete un archivo con un tipo distinto
# al declarado, lo que podría convertir una imagen en script.
SECURE_CONTENT_TYPE_NOSNIFF = True

# El proxy inverso termina el HTTPS; esta cabecera le informa a Django
# que la conexión original era cifrada.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


# La IP del visitante detrás de nginx. Para Django todos los pedidos
# llegan desde la IP del contenedor de nginx; la del visitante viaja en
# la cabecera X-Forwarded-For, que nginx escribe con la IP que él ve y
# descartando lo que haya mandado el cliente (frontend/nginx/sitio.conf).
# Sin esto, los throttles de DRF y el bloqueo de axes contarían a todos
# los visitantes como si fueran uno solo.
#
# NUM_PROXIES = 1: hay un proxy delante, así que DRF toma el último valor
# de la cabecera. Misma técnica que el renderer de abajo: se le agrega
# una clave al diccionario que viene de base.py.
REST_FRAMEWORK['NUM_PROXIES'] = 1

# axes no lee X-Forwarded-For por su cuenta: o se instala django-ipware
# o se le da una función. ip_de_origen hace lo mismo que NUM_PROXIES = 1
# en unas pocas líneas propias (config/ip.py). En desarrollo no se
# configura: sin proxy, REMOTE_ADDR ya es la IP real.
AXES_CLIENT_IP_CALLABLE = 'config.ip.ip_de_origen'


# Caché compartida entre los workers de gunicorn. Los throttles de DRF
# guardan sus contadores en la caché 'default', que sin configurar es
# LocMemCache: la memoria de CADA proceso. Con tres workers cada uno
# contaría por su lado y los límites valdrían el triple. Una caché en
# archivos, dentro del contenedor, la comparten los tres. Se vacía al
# recrear el contenedor, igual que la de memoria al reiniciar. axes no
# la necesita: guarda los intentos en la base. La carpeta va al lado de
# media/, como MEDIA_ROOT: una ruta absoluta en cualquier sistema (Django
# avisa si es relativa), y dentro de /app, que en la imagen es del
# usuario que corre gunicorn.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': BASE_DIR / 'cache',
    },
}


# Con DEBUG=False, Django manda los errores (los 500 con su traza) al
# logger 'django', cuyo único destino en producción es un mail a los
# administradores, que acá no está configurado: no se verían en ningún
# lado. Esto los manda a la salida estándar, que es lo que muestra
# `docker compose logs backend`. WARNING incluye los 4xx que Django
# registra (403 por CSRF, 400 por un host no permitido) y los 500.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'consola': {'class': 'logging.StreamHandler'},
    },
    'root': {'handlers': ['consola'], 'level': 'WARNING'},
}


# La interfaz navegable de DRF es una herramienta de desarrollo. En
# producción la API responde solo JSON, también si se la abre desde un
# navegador. Se le agrega la clave al diccionario que viene de base.py,
# así el resto de la configuración de DRF queda igual.
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
    'rest_framework.renderers.JSONRenderer',
]
