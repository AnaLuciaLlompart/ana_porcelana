# Despliegue de Ana Porcelana

Cómo levantar el sistema en el servidor, actualizarlo después de un
cambio, dejar programadas las tareas de mantenimiento, hacer copias de
seguridad, restaurarlas y mirar los logs. Está escrito para seguirlo
paso a paso copiando los comandos. Todos los comandos
`docker compose` se corren desde la carpeta del proyecto, donde está
`docker-compose.yml`.

---

## Qué se levanta

Tres contenedores de Docker, definidos en `docker-compose.yml`:

| Contenedor | Qué es | Quién le habla |
|---|---|---|
| `frontend` | nginx con el React compilado. Sirve la página y las fotos, y reenvía `/api/` al backend. | Internet, en los puertos 80 (http) y 443 (https). Es el único que se ve desde afuera. |
| `backend` | Django con gunicorn. | Solo nginx, por la red interna de Docker. |
| `db` | PostgreSQL 17. | Solo el backend. |

Y dos volúmenes, que es donde viven los datos. Los contenedores se pueden
borrar y volver a crear; los volúmenes quedan:

- `ana_porcelana_base`: la base de datos.
- `ana_porcelana_media`: las fotos.

**Lo que hay que respaldar son esos dos.**

El certificado HTTPS lo maneja `certbot`, instalado en el servidor, fuera
de Docker. Sus dos carpetas (`/etc/letsencrypt`, donde guarda los
certificados, y `/var/www/certbot`, donde deja la prueba que Let's
Encrypt le pide) se le prestan al contenedor `frontend` con
`docker-compose.override.yml`, un archivo que existe solo en el servidor.

Las cabeceras de seguridad (HSTS, `X-Frame-Options`,
`X-Content-Type-Options` y `Referrer-Policy`) las agrega nginx a todas
las respuestas, desde `frontend/nginx/cabeceras.conf`. Django las manda
también en `/api/`, y nginx descarta esa copia para que no salgan dos
veces. nginx no publica su versión (`server_tokens off`) y atiende por
HTTP/2. Que HTTP/2 está activo se ve en la columna Protocol de la
pestaña Red de las herramientas del navegador, o desde cualquier
terminal con openssl (tiene que responder `ALPN protocol: h2`):

```bash
echo | openssl s_client -connect anaporcelana.com.ar:443 -servername anaporcelana.com.ar -alpn h2,http/1.1 2>/dev/null | grep ALPN
```

Las contraseñas y el dominio no están en ningún archivo del repositorio.
Están en `.env.produccion`, que se escribe a mano en cada máquina
copiando `.env.produccion.ejemplo`.

---

## Antes de empezar: el DNS

En el panel de DonWeb, el dominio `anaporcelana.com.ar` tiene que tener
dos registros **A** apuntando a la IP del Cloud Server: uno para la raíz
(`anaporcelana.com.ar`, a veces escrito `@`) y otro para `www`. Hasta que
no se propaguen (de minutos a algunas horas) Let's Encrypt no puede
emitir el certificado.

Para comprobarlo desde tu PC:

```powershell
nslookup anaporcelana.com.ar
nslookup www.anaporcelana.com.ar
```

Los dos tienen que devolver la IP del servidor.

---

## Primera vez en el servidor

Todo esto se hace conectada al servidor por SSH, con un usuario que pueda
usar `sudo`. En los Cloud Server de DonWeb el SSH no escucha en el puerto
22 sino en el 5807, así que hay que indicarlo:

```powershell
ssh -p 5807 usuario@IP-DEL-SERVIDOR
```

Cada comando con `sudo` pide tu contraseña, la del usuario con el que
entraste: el servidor no tiene `NOPASSWD` en `/etc/sudoers`.

### 1. Instalar Docker, Compose, certbot y git

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 certbot git
sudo usermod -aG docker $USER
```

Son paquetes de Ubuntu: Docker, el complemento `docker compose`, certbot
(el programa de Let's Encrypt) y git. La última línea te deja usar
`docker` sin `sudo`; hace efecto cuando salís y volvés a entrar por SSH
(`exit` y de nuevo `ssh ...`).

Comprobar: `docker compose version` y `certbot --version` tienen que
responder con un número de versión.

### 2. Abrir solo los puertos que hacen falta

Hay dos firewalls, uno detrás del otro, y los dos tienen que dejar pasar
lo mismo. El primero es el de DonWeb, en el panel del Cloud Server: ya
tiene abiertos 80, 443 y 5807. El segundo es `ufw`, el de Ubuntu, dentro
del servidor:

```bash
sudo ufw allow 5807/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Quedan abiertos 5807 (SSH, para poder entrar), 80 y 443 (el sitio).
**La regla del 5807 va antes de `enable`**: si se activa `ufw` sin ella,
la sesión de SSH se corta y no se puede volver a entrar. PostgreSQL y
gunicorn no se abren a Internet: solo se hablan entre contenedores.
`sudo ufw status` muestra las reglas.

### 3. Bajar el código

```bash
cd /srv
sudo git clone https://github.com/AnaLuciaLlompart/ana_porcelana.git
sudo chown -R $USER:$USER ana_porcelana
cd ana_porcelana
```

`/srv/ana_porcelana` es la carpeta del proyecto en el servidor. El resto
de esta guía supone esa ruta; si usás otra, cambiala también en el
deploy-hook del paso 9.

### 4. Las variables de producción

```bash
cp .env.produccion.ejemplo .env.produccion
nano .env.produccion
```

Hay que completar dos cosas; lo demás ya viene con los valores del
servidor:

- `SECRET_KEY`: una clave nueva. Se genera con
  `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` y se
  pega después del `=`.
- `POSTGRES_PASSWORD` y `DB_PASSWORD`: la contraseña de la base, larga y
  la **misma** en las dos.

En `nano`: Ctrl+O y Enter guarda, Ctrl+X sale.

### 5. Las carpetas de certbot y el archivo del servidor

```bash
sudo mkdir -p /var/www/certbot
cp docker-compose.servidor.yml docker-compose.override.yml
```

La carpeta es donde certbot va a dejar la prueba para Let's Encrypt. El
archivo copiado le dice a Compose que le preste al contenedor `frontend`
esa carpeta y la de los certificados; Compose lo lee solo, por su nombre,
en cada comando.

### 6. Levantar

```bash
docker compose up -d --build
```

La primera vez tarda varios minutos: baja las imágenes, instala las
dependencias y compila el frontend. `-d` lo deja corriendo de fondo.
Después:

```bash
docker compose ps
```

Los tres tienen que decir `Up`, y `db` además `(healthy)`. Al arrancar,
el backend corre las migraciones solo.

En este punto el sitio responde por http pero **todavía no funciona**: la
configuración de producción manda todo a https, y https no existe hasta
el paso 8. Es lo esperado.

### 7. Crear la usuaria

```bash
docker compose exec backend python manage.py createsuperuser
```

Pide usuario, correo (puede quedar vacío) y contraseña. Si después vas a
subir los datos de tu PC (ver Copias de seguridad), este usuario se
reemplaza por el que tengas en tu base.

### 8. El certificado

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
    -d anaporcelana.com.ar -d www.anaporcelana.com.ar \
    --email TU-CORREO --agree-tos --no-eff-email
```

Qué hace: certbot deja un archivo en `/var/www/certbot`; Let's Encrypt lo
pide por http en `anaporcelana.com.ar/.well-known/acme-challenge/...`,
nginx (que ya está corriendo desde el paso 6) lo sirve, y con eso queda
demostrado que el dominio es tuyo. Los certificados quedan en
`/etc/letsencrypt/live/anaporcelana.com.ar/`. El correo es para los
avisos de Let's Encrypt si algo falla con la renovación.

nginx elige su configuración al arrancar, así que hay que reiniciarlo
para que encuentre el certificado:

```bash
docker compose restart frontend
docker compose logs frontend | grep -i certificado
```

Tiene que decir `Certificado encontrado: nginx atiende en https.`. Abrí
`https://anaporcelana.com.ar`: el catálogo con el candado, y
`https://anaporcelana.com.ar/gestion/login` para entrar.

### 9. La renovación automática

El certificado dura 90 días. El paquete `certbot` de Ubuntu instala un
timer de systemd que corre `certbot renew` dos veces por día y renueva
cuando faltan menos de 30. Comprobar que está:

```bash
systemctl list-timers certbot.timer
```

Cuando se renueva, nginx tiene que volver a leer el certificado. Eso lo
hace un deploy-hook: un script que certbot corre solo después de renovar.
Se crea así (es un solo comando, de la primera línea a `EOF`):

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh > /dev/null <<'EOF'
#!/bin/sh
# Lo corre certbot después de renovar un certificado: nginx tiene que
# volver a leerlo. Corre como root y desde cualquier carpeta, por eso la
# ruta completa al proyecto.
cd /srv/ana_porcelana && docker compose exec -T frontend nginx -s reload
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh
```

Y probar la renovación en seco, sin cambiar nada:

```bash
sudo certbot renew --dry-run
```

Tiene que terminar con `Congratulations, all simulated renewals
succeeded`. Con eso el HTTPS queda completo.

`--dry-run` simula la renovación pero **no corre los deploy-hooks**. Para
probar también el script de arriba:

```bash
sudo certbot renew --dry-run --run-deploy-hooks
```

Si al final dice `Hook 'deploy-hook' ran with error output` y lo que
muestra adentro son líneas como `Restarting` o `Started`, no es un
error: Docker escribe el progreso por la salida de errores y certbot lo
informa igual.

### 10. Tareas programadas

Tres cosas corren solas, de noche, desde el crontab de `ana`, el usuario
con el que se entra por SSH. Es el crontab de ese usuario y no el de
root: puede usar `docker` sin `sudo` desde el paso 1.

- **Los lunes a las 4:00, `clearsessions`.** Cada inicio de sesión guarda
  una fila en la tabla `django_session`, y Django no borra las vencidas
  por su cuenta: solo deja de aceptarlas. Con el tiempo la tabla acumula
  filas que no sirven.
- **Todos los días a las 3:30, un respaldo de la base**: `pg_dump` dentro
  del contenedor `db`, guardado en `/home/ana/respaldos/base-FECHA.sql`.
  Se borran los de más de 30 días.
- **Todos los días a las 3:45, un respaldo de las fotos**: `tar czf` de
  `/app/media` dentro del contenedor `backend`, guardado en
  `/home/ana/respaldos/media-FECHA.tar.gz`. Se borran los de más de 7
  días.

La carpeta tiene que existir antes:

```bash
mkdir -p ~/respaldos
crontab -e
```

La primera vez pregunta qué editor usar: `nano` (opción 1). Al final del
archivo van estas tres líneas con sus comentarios, que son las que están
instaladas en el servidor:

```
# Ana Porcelana - Tareas automáticas del sistema

# Lunes 4:00 · borrar de la base las sesiones de login vencidas
0 4 * * 1 cd /srv/ana_porcelana && docker compose exec -T backend python manage.py clearsessions

# Todos los días 3:30 · copia de la base en /home/ana/respaldos/base-FECHA.sql (se guardan 30 días)
30 3 * * * cd /srv/ana_porcelana && docker compose exec -T db pg_dump -U ana_porcelana -d ana_porcelana --no-owner --no-acl > /home/ana/respaldos/base-$(date +\%F).sql && find /home/ana/respaldos -name "base-*.sql" -mtime +30 -delete

# Todos los días 3:45 · copia de las fotos en /home/ana/respaldos/media-FECHA.tar.gz (se guardan 7 días)
45 3 * * * cd /srv/ana_porcelana && docker compose exec -T backend tar czf - -C /app media > /home/ana/respaldos/media-$(date +\%F).tar.gz && find /home/ana/respaldos -name "media-*.tar.gz" -mtime +7 -delete
```

Los cinco primeros campos de cada línea son minuto, hora, día del mes,
mes y día de la semana. `-T` hace falta porque cron no tiene terminal.
En crontab el `%` es un carácter especial (corta la línea), así que el
de `date +%F` va escapado: `\%F`. `crontab -l` muestra que quedó, y al
día siguiente `ls -lh ~/respaldos` tiene que mostrar los dos archivos.

La renovación del certificado **no** está acá: la hace el `certbot.timer`
de systemd del paso 9 (`systemctl list-timers certbot.timer`). Con eso el
servidor queda completo.

---

## Actualizar el sistema

Siempre desde la carpeta del proyecto (`cd /srv/ana_porcelana`). Según
qué cambió:

- **Solo documentación** (archivos `.md`): `git pull` y nada más. Los
  contenedores no la usan.
- **Código** (backend, frontend, nginx, Dockerfiles):

  ```bash
  git pull
  docker compose up -d --build
  ```

  Compose vuelve a construir lo que cambió y recrea solo esos
  contenedores; el backend corre las migraciones al arrancar. El sitio se
  corta unos segundos mientras cambia. Después, `docker compose ps` y
  `docker compose logs --tail 50 backend` para ver que arrancó bien.
- **Solo `.env.produccion`**: `docker compose up -d`, sin `--build`. Las
  imágenes son las mismas; cambian las variables con las que arrancan.

**Volver atrás.** Si una versión nueva sale mal, se vuelve a la anterior
con el hash del commit que funcionaba (`git log --oneline` los lista):

```bash
git checkout <hash>
docker compose up -d --build
```

Para retomar después la rama principal, `git checkout main` y otra vez
`docker compose up -d --build`.

---

## Ver los logs

```bash
docker compose ps                        # estado de los tres
docker compose logs -f                   # todo, en vivo (Ctrl+C para salir)
docker compose logs -f backend           # solo Django y gunicorn
docker compose logs --tail 100 frontend  # las últimas 100 líneas de nginx
```

Qué hay en cada uno:

- `backend`: las migraciones al arrancar, una línea por cada pedido que
  atiende gunicorn, y los errores de Django (un 500 sale con su traza
  completa; un 400 por un Host no permitido o un 403 por CSRF salen como
  avisos).
- `frontend`: una línea por cada pedido que llega a nginx, con la IP del
  visitante, y sus errores (un `502` quiere decir que no pudo hablar con
  el backend).
- `db`: los mensajes de PostgreSQL.

---

## Reinicio automático

Los tres contenedores tienen `restart: unless-stopped`: si uno se cae,
Docker lo vuelve a levantar solo, también después de reiniciar el
servidor. Para probarlo hay que matar el proceso **desde adentro**:

```bash
docker compose exec backend sh -c 'kill 1'
docker compose ps
```

A los pocos segundos vuelve a decir `Up`. `docker kill` desde afuera no
sirve como prueba: Docker lo cuenta como una parada a mano, y una parada
a mano no se reinicia.

---

## Copias de seguridad

Los datos están en dos lugares, la base y las fotos, y se respaldan
juntos: una base restaurada sin sus fotos muestra productos sin imagen.
Las copias las hace cron todas las noches (paso 10), en
`/home/ana/respaldos`:

- `base-FECHA.sql`: la base entera como un archivo de texto con las
  órdenes para reconstruirla (`pg_dump`, sin dueños ni permisos, para
  que sirva en cualquier base). Crea las tablas pero no borra las que
  haya: por eso la restauración vacía la base antes de cargarlo. Quedan
  los últimos 30 días.
- `media-FECHA.tar.gz`: la carpeta `media` del volumen (con
  `materiales/` y `productos/`) comprimida. Quedan los últimos 7 días.

`ls -lh ~/respaldos` muestra que se están haciendo.

### Una copia a mano

Antes de un cambio grande conviene una copia fuera de horario. Son los
mismos dos comandos del crontab, con la fecha de hoy en el nombre:

```bash
cd /srv/ana_porcelana
docker compose exec -T db pg_dump -U ana_porcelana -d ana_porcelana --no-owner --no-acl > ~/respaldos/base-$(date +%F).sql
docker compose exec -T backend tar czf - -C /app media > ~/respaldos/media-$(date +%F).tar.gz
```

Acá el `%` va sin escapar: la barra invertida es solo para crontab. `-T`
hace falta para que la salida vaya al archivo sin pasar por una
terminal.

### Bajarlas a la PC

Un respaldo que vive en la misma máquina que los datos no sirve si la
máquina se pierde. Desde PowerShell, con la fecha que corresponda y una
carpeta de la PC como destino:

```powershell
scp "anaporcelana:~/respaldos/*FECHA*" <carpeta>
```

Trae los dos archivos de ese día. `anaporcelana` es un alias definido en
`~/.ssh/config` de la PC, que ahorra escribir el usuario, la IP y el
puerto en cada comando:

```
Host anaporcelana
    HostName IP-DEL-SERVIDOR
    User ana
    Port 5807
```

Sin el alias es lo mismo con la forma larga,
`scp -P 5807 "ana@IP-DEL-SERVIDOR:~/respaldos/*FECHA*" <carpeta>`
(`-P` mayúscula es el puerto en `scp`, al revés que en `ssh`).

### Restaurar la base

Con el respaldo en `~/respaldos` del servidor (si está en la PC, se sube
con `scp <carpeta>\base-FECHA.sql anaporcelana:~/respaldos/`). Se para el
backend para que nadie use la base mientras se reemplaza, se la borra y
se la crea vacía (el archivo crea las tablas, no las borra), se carga el
archivo y se vuelve a arrancar el backend. Medido con la base real: 1,9
segundos.

```bash
cd /srv/ana_porcelana
docker compose stop backend
docker compose exec db psql -U ana_porcelana -d postgres -c "DROP DATABASE ana_porcelana;" -c "CREATE DATABASE ana_porcelana;"
docker compose exec -T db psql -U ana_porcelana -d ana_porcelana -v ON_ERROR_STOP=1 < ~/respaldos/base-FECHA.sql
docker compose start backend
```

`ON_ERROR_STOP=1` corta al primer error, en vez de seguir y dejar la base
a medias.

### Restaurar las fotos

Se descomprime el `.tar.gz` (deja una carpeta `media/`), se copia adentro
del contenedor y se le devuelve la propiedad al usuario `app`, con el que
corre Django: `docker cp` deja los archivos como de `root`, y sin el
`chown` Django podría leerlos pero no reemplazarlos ni borrarlos.

```bash
cd ~/respaldos
tar xzf media-FECHA.tar.gz
docker cp media/. ana_porcelana-backend-1:/app/media/
cd /srv/ana_porcelana
docker compose run --rm --no-deps -u root backend chown -R app:app /app/media
```

Los dos últimos comandos sirven aunque el backend esté parado: `docker
cp` copia igual, y `run --rm --no-deps` levanta un contenedor aparte solo
para ese `chown` y lo borra al terminar.

### Subir los datos de tu PC al servidor

Es una restauración con un respaldo hecho en la PC. En PowerShell, en la
carpeta del proyecto:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres --no-owner --no-acl -f base-pc.sql ana_porcelana
scp base-pc.sql anaporcelana:~/respaldos/
scp -r backend\media anaporcelana:~/respaldos/media-pc
```

Y en el servidor, los pasos de arriba: la base con `base-pc.sql`, y las
fotos sin descomprimir nada, con
`docker cp ~/respaldos/media-pc/. ana_porcelana-backend-1:/app/media/` y
el `chown`. El respaldo trae tu usuaria de desarrollo, que reemplaza a la
del paso 7.

---

## Probar en la PC con Docker Desktop

Es el mismo `docker compose up`, con `.env.produccion` armado para la PC:
en `.env.produccion.ejemplo`, las líneas que empiezan con `PC:` dicen qué
valor usar (`localhost`, `http://localhost`, `HTTPS_ACTIVO=no`, porque en
la PC no hay certificado).

```powershell
Copy-Item .env.produccion.ejemplo .env.produccion
.\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))"
# editar .env.produccion: la clave, la contraseña (dos veces) y los valores PC:
docker compose up --build
```

Sin `-d` queda en primer plano mostrando los logs; Ctrl+C lo detiene. En
otra terminal, `docker compose exec backend python manage.py
createsuperuser`, y en el navegador `http://localhost`. Para comprobar la
configuración de producción con los valores del servidor:

```powershell
docker compose exec -e HTTPS_ACTIVO=si backend python manage.py check --deploy
```

Tiene que decir `System check identified no issues`. Sin el `-e` da
cuatro avisos, que son exactamente los de HTTPS apagado.

`docker compose down` apaga y borra los contenedores pero conserva los
volúmenes (la base y las fotos siguen al volver a levantar);
`docker compose down -v` borra también los volúmenes.

---

## Si algo sale mal

- **Un contenedor no queda `Up`** o se reinicia a cada rato: `docker
  compose logs <nombre>` muestra por qué. Lo más común: una variable mal
  escrita en `.env.produccion` (la base rechaza la contraseña) o la base
  todavía iniciando.
- **`502 Bad Gateway`**: nginx no pudo hablar con el backend. Pasa unos
  segundos al arrancar, mientras corren las migraciones; si sigue,
  `docker compose logs backend`.
- **"No se pudo cargar el catálogo."** En el servidor antes del
  certificado es lo esperado (paso 6). En la PC, puede ser el límite de
  60 pedidos por minuto por IP del catálogo: esperá un minuto.
- **certbot no emite el certificado**: el DNS todavía no apunta al
  servidor (`nslookup`), el puerto 80 está cerrado (`sudo ufw status`),
  falta `docker-compose.override.yml` o `/var/www/certbot` (paso 5), o
  los contenedores no están levantados (paso 6: nginx tiene que estar
  sirviendo el puerto 80).
- **certbot falla con "During secondary validation: DNS problem:
  networking error"** aunque el DNS esté bien: antes de tocar nada,
  revisar https://letsdebug.net (prueba el dominio desde afuera) y
  https://letsencrypt.status.io (incidentes de Let's Encrypt). Ya pasó
  una vez y era un incidente de ellos. Let's Encrypt admite 5 fallos por
  hora por dominio: para reintentar sin gastarlos, `--dry-run`.
- **`docker compose` dice "no configuration file provided"**: no estás en
  la carpeta del proyecto. `cd /srv/ana_porcelana` y de nuevo.
- **`/api/` responde 400 "DisallowedHost" al entrar por la IP** en vez de
  por el dominio: es lo esperado. Django solo acepta los nombres de
  `ALLOWED_HOSTS`, el dominio con y sin `www`.
- **nginx sigue en http después de emitir el certificado**: falta el
  `docker compose restart frontend` del paso 8.
- **La contraseña de la usuaria se perdió**:
  `docker compose exec backend python manage.py changepassword <usuaria>`.
- **En la PC, el puerto 80 está ocupado**: `netstat -ano | findstr :80`
  dice qué programa lo usa.
- **No se puede entrar por SSH**: el puerto es el 5807 (`ssh -p 5807`).
  Si se activó `ufw` sin la regla del 5807, hay que entrar por la consola
  del panel de DonWeb y correr `sudo ufw allow 5807/tcp`.
