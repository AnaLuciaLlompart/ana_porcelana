# Ana Porcelana

Sistema de gestión web y catálogo digital para un emprendimiento de
accesorios artesanales en porcelana fría.

Trabajo de graduación · Ingeniería en Computación · FACET–UNT

---

## Qué resuelve

Una emprendedora de Tucumán elabora y vende accesorios artesanales,
gestionando toda su actividad de forma manual. La comercialización ocurre 
íntegramente por Instagram, donde recibe los encargos por mensajería privada.

Ese esquema produce olvidos en el seguimiento de producción, ausencia
de trazabilidad de pedidos y falta de registro económico. Además,
buena parte del tiempo se destina a responder consultas previas que en
su mayoría no derivan en una compra.

El sistema comprende **dos ámbitos diferenciados**:

- **Módulo de gestión**, de acceso privado, para la emprendedora.
- **Catálogo público**, accesible sin identificación, para que los
  clientes consulten los productos y ordenen el contacto inicial.

---

## Estado del desarrollo

| Módulo | Casos de uso | Estado |
|---|---|---|
| Acceso al sistema | CU01–CU03 | Completo |
| Materiales | CU04–CU10 | Completo |
| Categorías | CU11–CU16 | Completo |
| Productos | CU17–CU35 | Pendiente |
| Clientes | CU36–CU39 | Pendiente |
| Pedidos | CU40–CU47 | Pendiente |
| Cobros y gastos | CU48–CU58 | Pendiente |
| Informes | CU59–CU61 | Pendiente |
| Catálogo público | CU62–CU70 | Pendiente |

---

## Arquitectura

Arquitectura cliente-servidor desacoplada en cuatro capas. El backend
expone una API REST y no genera interfaz; el frontend la consume y
resuelve íntegramente la presentación.

```
Navegador  →  React + Vite  →  Django + DRF  →  PostgreSQL
              (puerto 5173)    (puerto 8000)    (puerto 5432)
                                                + carpeta de medios
```

### El proxy inverso

Los navegadores impiden que una página solicite datos a un origen
distinto del que la cargó, y un puerto diferente constituye un origen
distinto. Para evitarlo, en desarrollo el servidor de Vite actúa como
**proxy inverso**: recibe todas las peticiones y reenvía al backend las
que comienzan con `/api` o `/media`. El navegador percibe un único
origen y nunca se dirige al puerto 8000.

En producción, ambos componentes se despliegan en un mismo contenedor
tras un servidor web que cumple la misma función. El esquema es
equivalente; cambia únicamente quién ejecuta el reenvío.

Por ese motivo, la capa que comunica el frontend con la API declara su
dirección base como una **ruta relativa** —`/api`— en lugar de una
dirección absoluta. Las peticiones se dirigen siempre al mismo origen
del que se cargó la aplicación, de modo que la misma configuración
funciona sin modificación en ambos entornos.

### Stack

**Backend**

| Componente | Función |
|---|---|
| Python 3.11 | Lenguaje |
| Django 5.2 LTS | Framework web. Aporta el ORM, las migraciones y el sistema de autenticación |
| Django REST Framework | Capa que expone los modelos como API. Traduce a JSON y valida las peticiones entrantes |
| PostgreSQL 17 | Base de datos relacional |
| Pillow | Tratamiento de imágenes. Verifica que los archivos subidos sean imágenes reales |

**Frontend**

| Componente | Función |
|---|---|
| React 19 | Biblioteca de interfaz basada en componentes |
| Vite | Herramienta de construcción. Aporta el servidor de desarrollo y el proxy inverso |
| React Router | Enrutamiento del lado del cliente. Determina qué pantalla corresponde a cada dirección sin recargar la página |
| Axios | Cliente HTTP. Realiza las peticiones al backend y gestiona de forma centralizada el envío de credenciales y del token de verificación |

---

## Estructura del proyecto

```
ana_porcelana/
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py          configuración común
│   │   │   ├── desarrollo.py    depuración activa, sin HTTPS
│   │   │   └── produccion.py    cookies cifradas y cabeceras de seguridad
│   │   ├── urls.py              monta /admin/ y /api/
│   │   ├── wsgi.py · asgi.py    puntos de entrada para producción
│   ├── usuarios/                modelo de usuario y autenticación
│   ├── materiales/
│   ├── categorias/
│   ├── media/                   archivos subidos (fuera de control de versiones)
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                     (fuera de control de versiones)
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js           configuración del proxy inverso
│   └── src/
│       ├── api/cliente.js       cliente HTTP compartido
│       ├── contexto/            estado de sesión compartido
│       ├── componentes/         estructura de navegación compartida
│       ├── funcionalidades/
│       │   ├── auth/
│       │   ├── materiales/
│       │   └── categorias/
│       ├── rutas.jsx
│       └── main.jsx
│
├── .gitignore
└── venv/                        entorno de Python (fuera de control de versiones)
```

Cada aplicación de Django agrupa una funcionalidad completa: modelo,
serializador, vistas y rutas. En el frontend, que carece de un
equivalente nativo, la agrupación se resuelve mediante carpetas por
funcionalidad. Los elementos utilizados por más de una funcionalidad
quedan fuera de ellas.

---

## Puesta en marcha

### Requisitos previos

- Python 3.11 o superior
- Node.js 18 o superior
- PostgreSQL 17

### 1 · Base de datos

Crear una base vacía llamada `ana_porcelana`.

### 2 · Backend

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1        # Windows
source venv/bin/activate           # Linux y macOS

cd backend
pip install -r requirements.txt
```

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

El backend queda disponible en `http://localhost:8000`.

### 3 · Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

---

## Decisiones de diseño

Las decisiones y su fundamento están documentados por separado. Un
resumen de las principales:

**Autenticación por sesión** en lugar de token autocontenido (JWT). El
sistema tiene un único backend y una única usuaria; las sesiones manejadas por Django
ofrecen una cookie inaccesible al código del cliente y un cierre de
sesión efectivo del lado del servidor.

**Denegación por defecto** en la API: todo endpoint exige autenticación
salvo declaración explícita en contra. Una omisión produce un recurso
inaccesible, no uno expuesto.

**Baja lógica** en las entidades que integran el historial económico.
Los materiales y categorías dados de baja conservan su registro, ya que
aparecen referenciados en productos y gastos anteriores.

**Precio congelado** en las líneas de pedido. El importe se copia al
registrar la línea, de modo que modificar el precio de un producto no
altera retroactivamente pedidos ya concretados.

**Cantidad en texto libre** en la composición de productos. Las
cantidades del oficio no admiten una unidad uniforme —«dos gotas»,
«media plancha»— y un esquema numérico obligaría a registrar
información falsa.

**Serializadores diferenciados por ámbito.** El catálogo público no
debe exponer el procedimiento de elaboración ni la composición de
materiales, que constituyen el conocimiento del oficio. En lugar de
filtrar esos campos mediante una condición, se define una
representación separada que directamente no los incluye. La restricción
resulta así **estructural en lugar de condicional**: los campos
sensibles no pueden filtrarse por un error de lógica, porque no forman
parte de la respuesta.

---

## Pendiente para el despliegue

El sistema se desarrolla en un entorno local. Su puesta en producción
requiere las siguientes tareas, ninguna de las cuales corresponde al
código de la aplicación:

**Regenerar la clave criptográfica.** La clave utilizada en desarrollo
fue generada automáticamente por el framework y así lo indica su
prefijo. En producción debe generarse una nueva.

**Provisionar un volumen persistente para la carpeta de medios.** Los
contenedores se destruyen y reconstruyen en cada actualización, y su
contenido interno se pierde. Las imágenes que suben los usuarios deben
residir en un directorio del servidor montado dentro del contenedor.

**Definir un procedimiento de copia de seguridad completo.** Los datos
del sistema residen en dos lugares: los registros en la base de datos y
los archivos en la carpeta de medios. Un respaldo que contemple solo el
primero produciría un sistema con referencias a archivos inexistentes.

**Sustituir el controlador de PostgreSQL** por su variante compilada.
Durante el desarrollo se emplea la versión precompilada, que evita
requerir un compilador de C; su propia documentación la desaconseja
para producción.

**Aprovisionar el certificado HTTPS**, que corresponde a la
infraestructura de despliegue y no a la aplicación.

La configuración de producción ya contempla la desactivación del modo
de depuración, la restricción de cookies al transporte cifrado, la
redirección forzada a HTTPS y la política de transporte estricto.
Puede verificarse con:

```bash
python manage.py check --deploy
```

---

## Autoría

**Ana Lucía Llompart** — desarrollo

**Enzo André Sémola** — tutor

**Carlos Albaca Paraván** — co-tutor

Facultad de Ciencias Exactas y Tecnología · Universidad Nacional de Tucumán
