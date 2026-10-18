# Imagen del frontend: el React compilado, servido por nginx, que además
# hace de proxy inverso hacia el backend (lo que en desarrollo hace Vite).
#
# Dos etapas. La primera tiene Node y compila; la segunda es nginx solo y
# recibe únicamente la carpeta dist/. Node, node_modules y el código
# fuente no viajan a la imagen final.

# --- Etapa 1: compilar ------------------------------------------------
# La misma versión mayor de Node que la PC de desarrollo (24).
FROM node:24-alpine AS compilar

WORKDIR /app

# Primero las dependencias, después el código: misma idea que en el
# Dockerfile del backend. npm ci instala exactamente lo que dice
# package-lock.json, sin resolver versiones de nuevo.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Etapa 2: servir --------------------------------------------------
FROM nginx:1.30-alpine

# El resultado de `npm run build`, a la carpeta que nginx sirve por defecto.
COPY --from=compilar /app/dist /usr/share/nginx/html

# Las configuraciones. sitio.conf son las rutas que comparten las dos
# variantes; http.conf y https.conf son las variantes, y elegir-config.sh
# decide cuál se activa al arrancar (la imagen oficial corre todo lo que
# haya en /docker-entrypoint.d/ antes de levantar nginx).
COPY nginx/sitio.conf /etc/nginx/sitio.conf
COPY nginx/http.conf nginx/https.conf /etc/nginx/configuraciones/
COPY nginx/elegir-config.sh /docker-entrypoint.d/40-elegir-config.sh
RUN chmod +x /docker-entrypoint.d/40-elegir-config.sh

EXPOSE 80 443
