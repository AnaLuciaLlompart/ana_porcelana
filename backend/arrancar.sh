#!/bin/sh
# Lo que corre al arrancar el contenedor del backend (CMD del Dockerfile).
#
# Las migraciones van acá y no en el Dockerfile porque el Dockerfile se
# ejecuta al CONSTRUIR la imagen, cuando la base de datos no está a mano.
# Acá ya está: Compose arranca el backend recién cuando el healthcheck de
# db responde.

# Si un comando falla, el script se corta ahí: sin las migraciones no
# tiene sentido levantar gunicorn.
set -e

python manage.py migrate --noinput

# exec reemplaza el shell por gunicorn, que pasa a ser el proceso 1 del
# contenedor: así recibe directamente la señal de `docker compose stop`
# y termina ordenadamente, en vez de que la reciba el shell y se la quede.
#
# --workers 3: 2 × CPU + 1, con las 2 vCPU del servidor.
# --forwarded-allow-ips="*": gunicorn solo cree en las cabeceras
#   X-Forwarded-* si vienen de una IP de confianza. nginx no tiene IP fija
#   dentro de la red de Docker, y nadie más puede llegar al backend (no
#   publica puerto), así que se confía en cualquier origen.
# --access-logfile -: la línea de cada pedido va a la salida estándar,
#   que es lo que muestra `docker compose logs backend`.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --forwarded-allow-ips="*" \
    --access-logfile -
