from .base import *  # noqa: F401,F403  
#el noqa es para que no me tome el import como problema

#Configuración para el entorno de producción.
#Todos los valores sensibles se leen del entorno: este archivo no contiene ninguna credencial ni dominio escrito a mano.



# Nunca activar en producción: las páginas de error exponen la
# configuración interna, las rutas del proyecto y fragmentos de código.
DEBUG = False


# Dominios desde los que se admiten requests. Django rechaza cualquier petición dirigida a un host que no figure aca, lo que
# protege contra ataques de cabecera Host.
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')


# Las cookies solo viajan sobre conexiones cifradas.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'


# Redirige a HTTPS cualquier petición que llegue por HTTP.
SECURE_SSL_REDIRECT = True


# Indica al navegador que use HTTPS durante un año, incluso si el
# usuario escribe la dirección sin el protocolo.
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True


# Impide que el navegador interprete un archivo con un tipo distinto
# al declarado, lo que podría convertir una imagen en script.
SECURE_CONTENT_TYPE_NOSNIFF = True

# El proxy inverso termina el HTTPS; esta cabecera le informa a Django
# que la conexión original era cifrada.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')