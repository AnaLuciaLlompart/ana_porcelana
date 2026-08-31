from .base import * # noqa: F401,F403
#el noqa es para que no me tome el import como problema

#Configuración para el entorno de desarrollo local.
#Incluye paginas de error detalladas y cookies sin exigencia de HTTPS, que en localhost no esta disponible (se usa HTTP).


# Muestra el traceback completo en el navegador cuando algo falla.
# En producción esto expone la configuración interna del sistema, por lo que se desactiva.
DEBUG = True

# Con DEBUG activo, Django acepta localhost sin declararlo (por eso va vacio).
ALLOWED_HOSTS = []

# El frontend corre en otro puerto durante el desarrollo (distinto del 8000 de Django), por lo que
# debe declararse como origen de confianza para las operaciones de
# escritura. En producción ambos comparten dominio.
CSRF_TRUSTED_ORIGINS = ['http://localhost:5173']

# Seguridad de cookies. Las variantes SECURE exigen HTTPS, que no
# está disponible en local, así que no se activan acá.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'