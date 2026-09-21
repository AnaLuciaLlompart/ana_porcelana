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
| Informes | CU60–CU62 | Pendiente |
| Catálogo público | CU63–CU71 | Pendiente |

59 de los 71 casos de uso implementados, con backend y frontend
completos en cada módulo terminado.

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

El mismo criterio rige para los archivos: las direcciones de las
imágenes se exponen como rutas relativas —`/media/...`— y nunca con
host y puerto.

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
│   │   ├── validadores.py       límite de tamaño de las imágenes
│   │   ├── limpieza_archivos.py señales que borran archivos del disco
│   │   ├── wsgi.py · asgi.py    puntos de entrada para producción
│   ├── usuarios/                modelo de usuario y autenticación
│   ├── materiales/
│   ├── categorias/
│   ├── productos/
│   ├── clientes/
│   ├── pedidos/                 pedidos, sus productos y sus cobros
│   ├── gastos/                  gastos y los materiales de cada compra
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
│       ├── componentes/         navegación y elementos compartidos
│       ├── funcionalidades/
│       │   ├── auth/
│       │   ├── materiales/
│       │   ├── categorias/
│       │   ├── productos/
│       │   ├── clientes/
│       │   ├── pedidos/
│       │   └── gastos/
│       ├── validadores.js       límite de tamaño (espejo del backend)
│       ├── rutas.jsx
│       └── main.jsx
│
├── disenio/                     prototipos de interfaz de cada módulo
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

### 4 · Pruebas automatizadas

El módulo de gastos cuenta con pruebas de sus ocho casos de uso, de las
reglas del monto y del tipo, y de las restricciones de la base de datos.
Se ejecutan desde `backend/`:

```bash
python manage.py test gastos
```

Django crea una base de datos temporal, ejecuta cada prueba dentro de
una transacción que revierte al finalizar y elimina esa base al
terminar, de modo que los datos de desarrollo no se alteran. El usuario
de PostgreSQL debe tener permiso para crear bases de datos.

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

**El gasto se crea antes de registrar sus materiales.** El prototipo
permitía cargar los materiales antes de crear el gasto y exigía al menos
uno. La implementación se aparta deliberadamente de ese flujo: los
materiales son un subrecurso del gasto y requieren que este exista. Un
gasto de materiales recién creado tiene monto cero, y esa situación es
válida.

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