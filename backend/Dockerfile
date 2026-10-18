# Imagen del backend: Django servido por gunicorn.
#
# La construye `docker compose up --build` con la carpeta backend/ como
# contexto, así que acá "." es backend/. Lo que no tiene que entrar en la
# imagen (el .env, las fotos, la caché) está en .dockerignore.

# La misma versión de Python que el venv de desarrollo. "slim" es la
# variante sin compiladores ni documentación: alcanza porque todas las
# dependencias de requirements.txt vienen precompiladas (wheels).
FROM python:3.11-slim

# Que lo que Python escribe salga al instante y no cuando se llene el
# buffer: `docker compose logs backend` lo muestra en el momento.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Primero las dependencias y después el código, en dos capas. Docker
# guarda cada capa: si cambia solo el código, no vuelve a instalar nada.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# gunicorn no corre como root. El usuario app es dueño de /app, donde
# Django escribe la caché (cache/) y donde se monta el volumen de fotos
# (media/). La carpeta media/ se crea acá para que, cuando Docker cree el
# volumen vacío, copie su dueño y Django pueda escribir en ella.
RUN useradd --create-home app \
    && mkdir -p /app/media \
    && chmod +x /app/arrancar.sh \
    && chown -R app:app /app
USER app

EXPOSE 8000

# Lo que corre al arrancar el contenedor: migraciones y gunicorn.
CMD ["./arrancar.sh"]
