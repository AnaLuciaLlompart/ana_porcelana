"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

#WSGI es el estándar clásico de Python para conectar una aplicación web con un servidor. Sincrónico: una petición por vez, de principio a fin.
# En desarrollo no se usa: runserver carga la aplicacion por su cuenta. En produccion es la entrada de gunicorn
# (backend/arrancar.sh: gunicorn config.wsgi:application), que levanta varios procesos y cada uno atiende una peticion por vez.

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{os.getenv('ENTORNO', 'desarrollo')}",
)

application = get_wsgi_application()
