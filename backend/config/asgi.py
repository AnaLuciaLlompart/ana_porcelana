"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

#ASGI es el servidor moderno. Hace lo mismo que WSGI pero además soporta conexiones persistentes, como las que necesitaría un chat en vivo o notificaciones que llegan solas.
#por el momento no es necesario en este proyecto
# no es necesario en el entorno de produccion, ya que runserver.py levanta un servidor suficientemente potente



import os

from django.core.asgi import get_asgi_application

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{os.getenv('ENTORNO', 'desarrollo')}",
)

application = get_asgi_application()
