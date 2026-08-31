"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

#WSGI es el estándar clásico de Python para conectar una aplicación web con un servidor. Sincrónico: una petición por vez, de principio a fin.
# no es necesario en el entorno de produccion, ya que runserver.py levanta un servidor suficientemente potente

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{os.getenv('ENTORNO', 'desarrollo')}",
)

application = get_wsgi_application()
