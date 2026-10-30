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
| Productos | CU17–CU35 | Completo |
| Clientes | CU36–CU39 | Completo |
| Pedidos | CU40–CU47 | Completo |
| Cobros | CU48–CU51 | Completo |
| Gastos | CU52–CU59 | Completo |
| Informes | CU60–CU62 | Completo |
| Catálogo público | CU63–CU70 | Completo |

70 de 70 casos de uso implementados, con backend y frontend completos
en todos los módulos.

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

En producción, el sistema se despliega como tres contenedores de Docker
coordinados por Docker Compose:

```
Internet  →  frontend              →  backend              →  db
             nginx, puertos 80 y 443   Django + gunicorn       PostgreSQL 17
             lee /media/               escribe /media/         volumen "base"
                    └──── volumen "media" ────┘
```

Solo `frontend` es accesible desde Internet; nginx sirve el React
compilado y las imágenes, y cumple la función de proxy inverso hacia
`backend`, que se comunica con `db` por la red interna de Docker. Los
datos persisten en dos volúmenes, uno para la base de datos y otro para
las imágenes, que sobreviven a la destrucción y reconstrucción de los
contenedores en cada actualización. El certificado HTTPS lo emite y
renueva certbot (Let's Encrypt), instalado en el sistema operativo del
servidor y no en un contenedor; nginx lo lee desde una carpeta del
servidor montada en modo de solo lectura. El esquema del proxy es
equivalente al de desarrollo; cambia únicamente quién ejecuta el
reenvío.

Por ese motivo, la capa que comunica el frontend con la API declara su
dirección base como una **ruta relativa** —`/api`— en lugar de una
dirección absoluta. Las peticiones se dirigen siempre al mismo origen
del que se cargó la aplicación, de modo que la misma configuración
funciona sin modificación en ambos entornos.

El mismo criterio rige para los archivos: las direcciones de las
imágenes se exponen como rutas relativas —`/media/...`— y nunca con
host y puerto.

El catálogo público y el módulo de gestión son una sola aplicación de
React servida desde el mismo origen: el catálogo responde en la raíz
del sitio (`/`) y la gestión bajo `/gestion`. Que el catálogo pueda
consultarse sin iniciar sesión no lo decide el servidor web ni el proxy,
sino las vistas de la aplicación `catalogo` del backend, que declaran
`AllowAny` de forma explícita; el resto de la API conserva la denegación
por defecto. El proxy se limita a reenviar `/api` y `/media`, sin
distinguir quién pregunta.

### Stack

**Backend**

| Componente | Función |
|---|---|
| Python 3.11 | Lenguaje |
| Django 5.2 LTS | Framework web. Aporta el ORM, las migraciones y el sistema de autenticación |
| Django REST Framework | Capa que expone los modelos como API. Traduce a JSON y valida las peticiones entrantes |
| PostgreSQL 17 | Base de datos relacional |
| Pillow | Tratamiento de imágenes. Verifica que los archivos subidos sean imágenes reales y las achica a un tamaño razonable |
| ReportLab | Arma los PDF: el comprobante de pago y las exportaciones |
| openpyxl | Arma las planillas de Excel de las exportaciones |
| django-axes | Bloqueo temporal tras varios intentos de login fallidos |
| gunicorn | Servidor de aplicación para producción. Atiende las peticiones con varios procesos en paralelo |

**Frontend**

| Componente | Función |
|---|---|
| React 19 | Biblioteca de interfaz basada en componentes |
| Vite | Herramienta de construcción. Aporta el servidor de desarrollo y el proxy inverso |
| React Router | Enrutamiento del lado del cliente. Determina qué pantalla corresponde a cada dirección sin recargar la página. Se usa como router de datos, que permite frenar la salida de un alta sin confirmar |
| Axios | Cliente HTTP. Realiza las peticiones al backend y gestiona de forma centralizada el envío de credenciales y del token de verificación |

**Despliegue**

| Componente | Función |
|---|---|
| Docker y Docker Compose | Empaquetan el sistema en tres contenedores (frontend, backend y base de datos) para que corra igual en cualquier servidor |
| nginx | Servidor web. Entrega la interfaz compilada y las fotos, y pasa las peticiones de /api/ al backend |
| Let's Encrypt (certbot) | Certificado HTTPS gratuito, renovado automáticamente |

---

## Estructura del proyecto

```
ana_porcelana/
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py          configuración común
│   │   │   ├── desarrollo.py    depuración activa, sin HTTPS
│   │   │   └── produccion.py    cookies cifradas, cabeceras de seguridad y ajustes detrás de nginx
│   │   ├── urls.py              monta /admin/ y /api/
│   │   ├── validadores.py       límite de tamaño de las imágenes
│   │   ├── imagenes.py          achica las fotos al subirlas (lado máximo 1.600 px)
│   │   ├── ip.py                IP real del visitante detrás del proxy inverso
│   │   ├── limpieza_archivos.py señales que borran archivos del disco
│   │   ├── paginacion.py        paginación de los listados
│   │   ├── listados.py          lo que comparten los filtros de los listados
│   │   ├── exportar.py          exportar los listados a PDF y Excel
│   │   ├── wsgi.py · asgi.py    puntos de entrada para producción
│   ├── usuarios/                modelo de usuario y autenticación
│   ├── materiales/
│   ├── categorias/
│   ├── productos/
│   ├── clientes/
│   ├── pedidos/                 pedidos, sus productos y sus cobros
│   ├── gastos/                  gastos y los materiales de cada compra
│   ├── finanzas/                informes económicos; sin modelos propios
│   ├── inicio/                  datos de la pantalla de inicio; sin modelos propios
│   ├── catalogo/                catálogo público: tres endpoints de lectura sin sesión; sin modelos propios
│   ├── pruebas/                 pruebas automatizadas; sin modelos propios
│   │   ├── base.py              utilidades comunes de las pruebas
│   │   ├── tests.py             las 5 generales; las otras 141, en el tests.py de cada app
│   │   ├── PRUEBAS.md           qué cubre cada una de las 146 y cómo correrlas
│   │   └── management/commands/
│   │       ├── cargar_datos_prueba.py   genera datos de prueba (1 o 3 años)
│   │       └── achicar_imagenes.py      achica las fotos ya guardadas
│   ├── media/                   archivos subidos (fuera de control de versiones)
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt     dependencias solo para desarrollo y pruebas
│   ├── .coveragerc              configuración de la cobertura de pruebas
│   ├── Dockerfile               imagen del backend (Django + gunicorn)
│   ├── arrancar.sh              arranque del contenedor: migraciones y gunicorn
│   ├── .dockerignore
│   └── .env                     (fuera de control de versiones)
│
├── frontend/
│   ├── index.html
│   ├── public/
│   │   ├── robots.txt           qué pueden indexar los buscadores: todo salvo /gestion/ y /api/
│   │   └── favicon-*.svg        íconos de la pestaña, uno por ámbito
│   ├── vite.config.js           configuración del proxy inverso
│   ├── Dockerfile               imagen del frontend (compila React y lo sirve con nginx)
│   ├── .dockerignore
│   ├── nginx/
│   │   ├── sitio.conf           reglas comunes: archivos estáticos, /media/ y /api/
│   │   ├── cabeceras.conf       cabeceras de seguridad que nginx agrega a todas las respuestas
│   │   ├── http.conf            sin certificado (solo puerto 80)
│   │   ├── https.conf           con certificado (80 redirige a 443)
│   │   └── elegir-config.sh     elige http o https según exista el certificado
│   └── src/
│       ├── api/cliente.js       cliente HTTP compartido
│       ├── api/exportar.js      lo común de exportar a PDF y Excel
│       ├── contexto/            estado de sesión compartido
│       ├── componentes/         navegación y elementos compartidos
│       │   ├── BarraDePasos.jsx · PieDelRecorrido.jsx  los pasos y los botones del alta
│       │   ├── ModalConfirmar.jsx  la pregunta antes de salir sin crear o de dejar un registro sin contenido
│       │   ├── LayoutPublico.jsx  encabezado, navegación y pie del catálogo público
│       │   └── PiePublico.jsx     el pie del catálogo público
│       ├── funcionalidades/
│       │   ├── auth/
│       │   ├── materiales/
│       │   ├── categorias/
│       │   ├── productos/       listado, alta por pasos y ficha
│       │   ├── clientes/
│       │   ├── pedidos/         listado, alta por pasos y ficha, con los cobros
│       │   ├── gastos/          listado, alta por pasos y ficha
│       │   ├── finanzas/        informes económicos
│       │   ├── inicio/          pantalla de inicio
│       │   └── catalogo/        catálogo público: listado, detalle, selección y mensaje de consulta
│       ├── validadores.js       límite de tamaño (espejo del backend)
│       ├── index.css            hovers y reglas de pantalla chica
│       ├── rutas.jsx            el árbol de direcciones, armado como router de datos
│       └── main.jsx
│
├── disenio/                     prototipos de interfaz de cada módulo
├── docker-compose.yml           los tres contenedores: frontend, backend y db
├── docker-compose.servidor.yml  ajustes solo para el servidor (certificado)
├── .env.produccion.ejemplo      plantilla de variables para producción
├── .gitattributes               fin de línea LF para scripts y configuraciones
├── DESPLIEGUE.md                guía paso a paso para poner el sistema en el servidor
├── CLAUDE.md                    convenciones y decisiones cerradas
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
Los materiales, categorías y productos dados de baja conservan su
registro, ya que aparecen referenciados en productos, pedidos y gastos
anteriores. Una entidad dada de baja queda de solo lectura, y esa
condición alcanza también a sus relaciones. Los clientes, en cambio, no
tienen baja lógica: no integran el historial por sí mismos, sino a
través de sus pedidos.

**Discontinuar no equivale a eliminar.** Discontinuar es una baja
lógica reversible, destinada a los artículos que dejan de ofrecerse;
eliminar corrige errores de carga y es definitivo.

**La visibilidad en el catálogo se calcula y no se almacena.** Un
producto se muestra si está activo, no es personalizado y ninguna de
sus categorías está dada de baja. La regla se evalúa al consultar, de
modo que dar de baja una categoría retira sus productos del catálogo y
reactivarla los restituye exactamente como estaban, porque nunca se
modificaron.

**Consulta de productos sin cuenta.** El catálogo público no tiene
carrito, pago ni registro de usuarios, porque el emprendimiento cierra
sus ventas por mensaje privado de Instagram y una compra en línea no
replicaría ese trato. Lo que ofrece es ordenar el contacto inicial: la
visitante arma una selección de productos con cantidades y
aclaraciones, que vive únicamente en su navegador —en `localStorage`,
sin enviarse al servidor—, y el sistema la convierte en un texto que
ella copia y pega en el chat del emprendimiento. La API pública expone
solo lectura y nunca recibe datos de la visitante; lo único que
persiste es lo que ella misma elige guardar en su dispositivo.

**Precio congelado** en las líneas de pedido. El importe se copia al
registrar la línea, de modo que modificar el precio de un producto no
altera retroactivamente pedidos ya concretados.

**Dos estados independientes en un pedido.** El estado del pedido
—pendiente, en producción, listo, entregado— resume el avance del
encargo completo. La etapa productiva —modelado, secado, pintura y
barniz, terminado— describe el trabajo del taller pieza por pieza. Una
pieza puede estar terminada mientras el pedido continúa en producción
porque otra no lo está, de modo que un único campo no podría
representar ambas situaciones.

**Un pedido no puede declararse listo con piezas sin terminar.** Es la
única condición que vincula esos dos estados independientes: el pedido
no alcanza los estados listo ni entregado mientras alguna de sus piezas
siga en producción. La condición se verifica en las dos direcciones. Al
cambiar el estado, la operación se rechaza e informa cuántas piezas
restan. Al modificar los productos de un pedido ya declarado listo
—incorporar uno nuevo, retroceder una etapa, retirar el último— el
pedido regresa automáticamente a producción, porque de otro modo la
regla se eludiría declarándolo listo y modificándolo a continuación. La
segunda verificación reutiliza la primera: consulta si el pedido podría
alcanzar el estado que ya tiene, de manera que ambas no pueden divergir.
El retroceso opera en un solo sentido; que la última pieza se termine no
declara listo el pedido, porque esa determinación corresponde a la
emprendedora.

**Dos fechas de entrega.** La estimada es la que se acuerda con el
cliente y puede reprogramarse; la real se registra al entregar. Con un
solo campo, cada reprogramación sustituiría la estimación anterior y se
perdería la única forma de determinar si la entrega fue puntual.

La fecha real no se carga a mano: la escribe la operación que marca el
pedido como entregado, con la fecha del día, y se elimina si el pedido
abandona ese estado, porque un pedido no entregado no tiene fecha de
entrega. El campo resulta así **derivado del estado** en lugar de
consignado por separado, y no puede afirmar una entrega que no ocurrió.

**Una única vía de escritura para los campos sujetos a reglas.** El
estado del pedido y la fecha de entrega real se declaran de solo lectura
en el serializador, de modo que no pueden alterarse incluyéndolos en el
cuerpo de una actualización: el estado se modifica mediante una
operación propia, que verifica las condiciones anteriores, y la fecha la
registra esa misma operación. Si el campo admitiera escritura directa,
cada verificación dispondría de una vía alternativa que la eludiría. La
restricción es, otra vez, **estructural en lugar de condicional**.

**Los importes derivados se calculan y no se almacenan.** El total de
un pedido, lo cobrado y el saldo se obtienen de sus productos y sus
cobros cada vez que se consultan. Almacenarlos supondría mantener el
mismo dato en dos lugares, con el riesgo de que dejen de coincidir al
modificar una pieza o registrar un pago.

**Reglas de cobro verificadas entre filas.** La suma de los cobros no
puede superar el total del pedido, y una seña no puede dejarlo saldado:
el cobro que completa el pago se registra como pago restante o pago
completo. Ambas condiciones involucran al conjunto de los cobros y no a
uno solo, de modo que se verifican en la capa de aplicación y no
mediante una restricción de la base de datos, que evalúa cada fila de
forma aislada.

**El monto de un gasto se almacena, a diferencia del total de un
pedido.** Un gasto de publicidad o de otro tipo tiene un monto
consignado por la emprendedora, mientras que el de una compra de
materiales resulta de sumar los subtotales de los materiales adquiridos.
Ambos ocupan la misma columna, de modo que los informes económicos se
obtienen como una suma directa, sin distinguir tipos. El riesgo de
almacenar un dato derivado —que deje de coincidir con aquello de lo que
deriva— se cierra con una única vía de escritura: un solo método
recalcula el monto, y lo invocan todas las operaciones capaces de
alterarlo. El serializador descarta el monto recibido cuando el gasto es
de materiales, de manera que una actualización no puede sustituir el
valor calculado, y una restricción de la base de datos exige un monto
mayor a cero en los demás tipos.

**El tipo de un gasto de materiales no se modifica.** Sus materiales y
su monto calculado dependen del tipo, y no existe forma de convertirlos
en un monto consignado a mano sin inventarlo. La operación inversa sí se
admite: un gasto de otro tipo puede pasar a ser de materiales, con lo
cual su monto queda en cero hasta que se registren las compras.

**Un gasto de materiales puede crearse sin materiales.** El prototipo
exigía al menos uno. La implementación lo admite, porque ningún paso del
alta es obligatorio y un gasto de materiales sin materiales tiene monto
cero, una situación válida. En lugar de impedirlo, la interfaz lo
advierte antes de crearlo y lo señala en el listado.

**Una única operación escribe sobre otro módulo.** Registrar la compra
de un material indica que volvió a haber existencias, de modo que desde
el gasto puede marcarse en disponibilidad alta, de a uno o en conjunto.
La regla reside en el backend —solo se modifican los materiales activos
que no estaban ya en ese nivel— y la respuesta informa la disponibilidad
previa de cada material modificado. Con ese dato la interfaz ofrece
deshacer la operación sin que exista un endpoint dedicado: restituye
cada valor mediante la actualización parcial de materiales ya
disponible.

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

**Un endpoint por caso de uso.** Las relaciones entre entidades se
gestionan mediante subrecursos —`/api/productos/1/materiales/3/`— en
lugar de enviar el objeto completo con sus vínculos. Los
serializadores exponen las relaciones en modo de solo lectura.

**El alta crea el registro al final.** El alta de productos, pedidos y
gastos es un recorrido por pasos —los datos y, en los pasos siguientes,
los materiales, las fotos y las categorías del producto, los productos y
los cobros del pedido, o los materiales del gasto—, y el registro se crea
recién al confirmar el último. Hasta entonces todo se conserva en la
memoria de la pantalla, de modo que abandonar el recorrido no deja
registros incompletos. Al confirmar, la interfaz encadena las mismas
operaciones que emplea la ficha de edición: crea el registro y después
cada uno de sus elementos. Si el servidor rechaza alguno, elimina el
registro —la eliminación arrastra lo que se alcanzó a guardar— y vuelve
al paso correspondiente con el mensaje del servidor y lo cargado intacto.
Se prefirió a una operación única en el servidor porque así cada regla de
negocio conserva una sola vía de verificación: las operaciones que
validan la carga desde la ficha son las mismas que validan la del alta.
Los importes de un pedido o de un gasto que todavía no existe se calculan
en el navegador con la misma cuenta que el servidor; una vez creado, se
muestran los que calcula el servidor. Mientras el alta no se confirma,
cualquier salida de la pantalla —el botón Cancelar, la barra lateral o el
botón Atrás del navegador— pregunta antes de abandonarla, y recargar o
cerrar la pestaña lo advierte el propio navegador.

**Advertir en lugar de prohibir.** Un pedido sin productos, un producto
sin fotos y un gasto de materiales sin materiales son registros válidos,
y el servidor no los rechaza. La interfaz, en cambio, pregunta antes de
crearlos así y antes de quitar el último producto de un pedido o el
último material de un gasto, y los listados los señalan con una marca. La
decisión queda en manos de la emprendedora, pero no puede tomarse por
descuido.

**Formulario o acción.** Lo que se edita dentro de un formulario se
guarda con un botón; lo que está fuera de él es una acción que se aplica
al instante y se confirma con un aviso, y una misma tarjeta no combina
ambos comportamientos. Los formularios de edición de productos, pedidos y
gastos comparten el mismo pie —Descartar y Guardar, inhabilitados
mientras no haya cambios— y una marca de cambios sin guardar en la
cabecera.

**Validación del tamaño de las imágenes en ambas capas.** El límite se
aplica en el backend, que constituye la autoridad y no puede
eludirse, y se replica en el frontend para evitar transferencias
inútiles. Al eliminar un registro o sustituir una imagen, el archivo
correspondiente se borra del disco dentro de una transacción
confirmada, de modo que la operación solo se ejecuta si el cambio en la
base de datos se consolidó.

**Las claves primarias compuestas del modelo lógico** se implementan
como clave sustituta acompañada de una restricción de unicidad sobre el
par de columnas. Django admite claves compuestas desde la versión 5.2,
pero los modelos que las emplean no pueden registrarse en el panel de
administración ni ser referenciados por claves foráneas.

**Normalización del identificador de cliente.** El usuario de Instagram
se almacena sin arroba y en minúsculas, porque la plataforma no
distingue mayúsculas y la restricción de unicidad de PostgreSQL sí lo
hace. La normalización se aplica en el modelo, para que ninguna vía de
escritura pueda eludirla, y en el serializador, porque la validación de
unicidad se ejecuta antes que la lógica propia y de otro modo el
conflicto se manifestaría como un error de base de datos en lugar de un
mensaje comprensible.

**Nombres únicos.** Dos categorías, dos productos o dos materiales no
pueden llamarse igual. La restricción se declara en el modelo, con un
mensaje propio que el serializador devuelve al rechazar el alta o la
modificación, y la base de datos la garantiza para cualquier otra vía de
escritura. A diferencia del usuario de Instagram, el nombre no se
normaliza: la comparación distingue mayúsculas de minúsculas.

**Interfaz de gestión adaptada a pantalla chica.** Los estilos de la
interfaz son objetos en línea de React; para pantallas de hasta 768px,
cada elemento que cambia lleva una clase y una única media query
sobrescribe solo las propiedades que varían, con `!important` porque
los estilos en línea tienen la máxima especificidad. En pantalla chica
la barra lateral se convierte en un panel deslizable que se abre desde
una franja superior, y las tablas se desplazan horizontalmente dentro
de su contenedor. El comportamiento se verificó en la emulación de
Chrome de un teléfono y de una tableta en ambas orientaciones.

---

## Documentación complementaria

`CLAUDE.md` reúne las convenciones de código y las decisiones cerradas
del proyecto, y sirve de referencia tanto para el desarrollo como para
las herramientas de asistencia empleadas.

`disenio/` contiene los prototipos de interfaz de cada módulo, que se
implementan con fidelidad. Las diferencias deliberadas respecto de un
prototipo se documentan junto con su fundamento.

---

## Limitaciones conocidas

El sistema no contempla la edición concurrente. Si un mismo registro se
modifica desde dos sesiones simultáneas, la última en guardar
prevalece sobre la anterior. La restricción no resulta significativa
con una única usuaria, y las validaciones del backend impiden en
cualquier caso que la base de datos quede en un estado inconsistente.

El alta de un registro junto con sus elementos no es atómica en la base
de datos. Entre la creación del registro y la de su último elemento
transcurre un intervalo breve en que el registro existe incompleto, y si
la eliminación que deshace un alta fallida también fallara —por ejemplo,
por una interrupción de la conexión entre ambas operaciones—, el
registro quedaría creado a medias. La pantalla lo informa y ofrece
abrirlo, para completarlo o eliminarlo desde su ficha.

---

## Despliegue

El sistema está publicado en https://anaporcelana.com.ar, en un Cloud
Server de DonWeb con Ubuntu 24.04, Docker Compose y un certificado de
Let's Encrypt. El procedimiento operativo completo —instalación en el
servidor, actualización, tareas programadas, copias de seguridad y
restauración, consulta de registros— está en
[DESPLIEGUE.md](DESPLIEGUE.md). Esta sección resume lo que la aplicación
ya contempla.

**Servidor de aplicación.** En producción Django no se sirve con
`runserver` sino con gunicorn, que carga la aplicación a través de
`config/wsgi.py` (`backend/arrancar.sh`).

**Variables de producción.** Toda la configuración que cambia entre
máquinas —clave criptográfica, dominios permitidos, orígenes de
confianza, credenciales de la base de datos— se lee del entorno; en el
servidor, de un archivo `.env.produccion` que no forma parte del
repositorio (`.env.produccion.ejemplo` documenta cada variable).
`produccion.py` desactiva el modo de depuración, restringe las cookies al
transporte cifrado, fuerza la redirección a HTTPS y declara la política
de transporte estricto; `python manage.py check --deploy` no informa
advertencias.

**Docker.** Las imágenes se construyen desde `backend/Dockerfile` y
`frontend/Dockerfile`; `docker-compose.yml` levanta los tres contenedores
y los dos volúmenes. nginx responde con `index.html` a las rutas de React
(`try_files`), entrega `/media/` directamente desde el volumen, sin
listado de directorio, agrega a todas las respuestas las cabeceras de
seguridad (HSTS, `X-Frame-Options`, `X-Content-Type-Options` y
`Referrer-Policy`) sin publicar su versión, y envía `X-Forwarded-For`
con la dirección del visitante; DRF (`NUM_PROXIES`) y django-axes
(`AXES_CLIENT_IP_CALLABLE`) la leen, de modo que los límites de
peticiones y el bloqueo por intentos fallidos cuentan por visitante y no
por proxy.

**HTTPS.** El certificado lo emite y renueva certbot, instalado en el
sistema operativo del servidor, con el temporizador de systemd que provee
el paquete de Ubuntu y un deploy-hook que recarga nginx. En la máquina de
desarrollo el mismo despliegue se prueba por HTTP con la variable
`HTTPS_ACTIVO=no`.

**Controlador de PostgreSQL.** Se conserva `psycopg2-binary`, la variante
precompilada. Su documentación la desaconseja para producción porque
incorpora copias propias de libpq y libssl, que pueden entrar en
conflicto con otras bibliotecas cargadas en el mismo proceso; en un
contenedor que ejecuta únicamente Django ese conflicto no puede
producirse, y la variante compilada exigiría agregar un compilador de C a
la imagen sin ningún beneficio.

**Copias de seguridad.** Los datos residen en dos lugares, la base de
datos y la carpeta de medios. Una tarea programada del servidor los
respalda juntos todas las noches, con una retención de 30 y 7 días
respectivamente, y DESPLIEGUE.md describe cómo descargar las copias a
otra máquina y cómo restaurarlas.

---

## Autoría

**Ana Lucía Llompart** — desarrollo

**Enzo André Sémola** — tutor

**Carlos Albaca Paraván** — co-tutor

Facultad de Ciencias Exactas y Tecnología · Universidad Nacional de Tucumán