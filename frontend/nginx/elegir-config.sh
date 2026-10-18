#!/bin/sh
# Elige la configuración de nginx al arrancar el contenedor.
#
# La imagen oficial de nginx corre, antes de levantar nginx, todos los
# scripts de /docker-entrypoint.d/ en orden de nombre (los suyos van del
# 10 al 30; este es el 40). nginx no arranca si un ssl_certificate apunta
# a un archivo que no existe, así que https.conf solo puede activarse
# cuando el certificado ya está. En la PC no está nunca; en el servidor,
# desde que certbot lo emite y se reinicia el contenedor.
#
# Así `docker compose up` es el mismo comando en los tres momentos: la
# PC, el servidor antes del certificado y el servidor después.

CERTIFICADO=/etc/letsencrypt/live/anaporcelana.com.ar/fullchain.pem

if [ -f "$CERTIFICADO" ]; then
    echo "Certificado encontrado: nginx atiende en https."
    cp /etc/nginx/configuraciones/https.conf /etc/nginx/conf.d/default.conf
else
    echo "Sin certificado: nginx atiende solo en http."
    cp /etc/nginx/configuraciones/http.conf /etc/nginx/conf.d/default.conf
fi
