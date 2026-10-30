# ana_porcelana

Sistema de gestión web + catálogo público para un emprendimiento de
accesorios artesanales en porcelana fría (Tucumán, Argentina).

Es una **tesis de grado** de Ingeniería en Computación (FACET–UNT).
Eso condiciona todo lo que sigue: el código lo tengo que poder
defender ante un tribunal. Prefiero entender una solución simple antes
que aceptar una compleja que funcione.

Dos ámbitos: módulo de gestión privado para la emprendedora, y
catálogo público sin login para los clientes.

---

## Cómo trabajar conmigo

**Soy principiante en desarrollo web.** Sé HTTP, HTML, CSS, JavaScript, Python
básico y SQL. Frameworks: Node, React y Django básicos. Es mi primera aplicación completa.

- Escribí siempre en **español rioplatense** (vos, no tú).
- **Un paso a la vez.** No encadenes varias tareas sin que yo confirme.
- **Cada comando que me hagas correr, explicámelo:** qué hace, para qué
  sirve, y por qué ese y no otro. Vale igual para el código.
- Cuando propongas código, decime **en qué archivo va y en qué parte**.
- **No modifiques mis comentarios ni mis docstrings.** Tienen errores
  de tipeo y están escritos con mis palabras a propósito: son la
  prueba de que entiendo lo que escribí. Si un comentario quedó
  desactualizado, avisame y lo corrijo yo.
- Si algo de lo que pido contradice una decisión de este archivo,
  paralo y preguntame antes de avanzar.
- Preferí lo explícito y legible a lo ingenioso.

---

## Stack y entorno

**Backend** (puerto 8000): Django 5.2 LTS + DRF + PostgreSQL 17 + Pillow,
y ReportLab y openpyxl para los PDF y los Excel
**Frontend** (puerto 5173): React 19 + Vite + React Router + Axios

Arquitectura desacoplada. El servidor de Vite hace de proxy inverso:
reenvía `/api` y `/media` al 8000, así el navegador ve un solo origen.
Por eso en Axios `baseURL` es `/api`, una ruta relativa.

El proxy de Vite apunta a `127.0.0.1:8000` y no a `localhost:8000`: en
esta máquina `localhost` resuelve a IPv6 (`::1`) y `runserver` escucha
solo en IPv4, así que con `localhost` los pedidos a `/api` se quedaban
colgados sin error.

Windows 11, PowerShell en VS Code. El venv está en la raíz del
proyecto y se activa desde `backend/` con `..\venv\Scripts\Activate.ps1`.

Dos terminales en paralelo:

```powershell
# Terminal 1
cd backend
..\venv\Scripts\Activate.ps1
python manage.py runserver

# Terminal 2
cd frontend
npm run dev
```

**Dos archivos de dependencias en `backend/`.** `requirements.txt` tiene
lo que el sistema necesita para funcionar y es lo que se instala en el
servidor; se edita a mano, nunca con `pip freeze`. `requirements-dev.txt`
tiene las herramientas de revisión y prueba (`pip-audit`, y más adelante
`coverage`), que se instalan solo en mi máquina. Es la misma separación
que `dependencies` y `devDependencies` en `package.json`.

---

## Estructura

Cada app de Django agrupa una funcionalidad completa (modelo, serializer,
ViewSet, urls). El backend **no** lleva carpeta `funcionalidades`: la app
de Django ya es esa unidad.

Hay una app que **no** es una funcionalidad: `pruebas`. Es la
infraestructura de pruebas y las herramientas de administración: la base
compartida de los `tests.py` (`pruebas/base.py`), el listado de pruebas
(`pruebas/PRUEBAS.md`), las pruebas que no son de una app en particular
(`pruebas/tests.py`) y los management commands (`cargar_datos_prueba`,
`achicar_imagenes`). No tiene modelos, vistas ni urls. `.coveragerc` la
excluye entera.

En el frontend, carpetas por funcionalidad dentro de
`src/funcionalidades/`. Lo que usa más de una funcionalidad queda
afuera: `api/cliente.js`, `api/exportar.js`, `contexto/AuthContext.jsx`,
`componentes/Layout.jsx`.

Apps terminadas: `usuarios` (CU01–CU03), `materiales` (CU04–CU10),
`categorias` (CU11–CU16), `productos` (CU17–CU35), `clientes`
(CU36–CU39), `pedidos`, que incluye los cobros (CU40–CU51), `gastos`
(CU52–CU59) y `catalogo` (CU63–CU70). De **informes** (CU60–CU62) están
el comprobante en PDF (CU60, en `pedidos`) y `finanzas` (CU61 y CU62),
backend y frontend. Son 70 casos de uso en total.

---

## Patrón a seguir

**El código nuevo tiene que parecerse al que ya existe.** Antes de
escribir una app nueva, leé `backend/categorias/` y
`frontend/src/funcionalidades/categorias/` y replicá ese patrón.

**Backend**, en este orden: modelo en `models.py` → migración →
registro en `admin.py` → serializer → ViewSet → una línea en `urls.py`
→ verificar en la interfaz navegable de DRF antes de tocar el frontend.

Convenciones que ya uso:

- Los ENUM se declaran como clases `TextChoices` anidadas en el modelo
  (`class Estado(models.TextChoices)`).
- Todo campo lleva `verbose_name` y `help_text`.
- Los docstrings de modelos y ViewSets citan los casos de uso que
  implementan (`"""CRUD de categorías (CU11 a CU16)."""`).
- El `update()` del ViewSet se sobrescribe para rechazar con 400 la
  edición de una entidad dada de baja.
- Los casos de uso que no son CRUD van como `@action(detail=True,
  methods=['post'])`, en snake_case: `dar_de_baja`, `reactivar`.
- El serializer expone los `get_..._display` como campos de solo
  lectura (`estado_display`, `tipo_display`).
- El nombre es único en Categoría, Producto y Material: `unique=True` con
  `error_messages={'unique': 'Ya existe un … con este nombre.'}` en el
  campo del modelo, y nada en el serializer, porque `ModelSerializer` arma
  el `UniqueValidator` con ese mensaje (en PUT y PATCH excluye a la propia
  fila). Distingue mayúsculas: "Aros" y "aros" conviven. El único texto
  normalizado antes de comparar es el instagram de Cliente. Agregar
  `unique` a un campo con datos exige revisar repetidos antes de migrar,
  también en el servidor, donde `arrancar.sh` corre `migrate` al levantar
  y un repetido deja el backend sin arrancar. El alta de producto lo
  avisa ya en el paso Datos (ver Las altas).

**Frontend**: `api.js` con una función exportada por endpoint,
importando `cliente` → pantalla con el patrón de tres estados
(cargando / error / datos) → modales → una línea en `rutas.jsx`.

En las pantallas: derivados calculados con `.filter()` y nunca
guardados en estado, objeto `acciones` que se expande con
`{...acciones}`, y una función `cambiarEstado(entidad, accion)` que
recibe la función de la API como argumento.

**Debounce solo cuando el buscador consulta al servidor**, con 300 ms.
Desde D3 todos los buscadores de la gestión y el del catálogo consultan
al servidor, así que todos lo llevan (ver "Listados en el backend"). Uno
que filtre local sobre datos ya cargados, como la tabla de cobros de
Finanzas, no lo lleva.

**Formulario o acción.** Lo que está adentro de un formulario se guarda
con Guardar; lo que está afuera es una acción, se aplica al instante y
avisa con el aviso flotante. Una misma tarjeta no mezcla las dos cosas.
Salió de que el tutor marcó que en la ficha de pedido el estado cambiaba
al instante y los demás datos esperaban a Guardar. Se ordenaron los dos
casos que la rompían: la tarjeta de estado del pedido salió de la pestaña
Datos (ver Módulo Pedidos), y el tilde "Es un pedido personalizado" de
producto pasó a ser un campo del borrador, que viaja en el POST del alta y
en el PUT de la ficha y cuenta para "Cambios sin guardar". Tildarlo y
guardar es CU24; destildarlo y guardar, CU23. Los endpoints `publicar` y
`quitar_del_catalogo` siguen en el backend, y `api.js` conserva sus
funciones (una por endpoint), pero ninguna pantalla las llama. Un
producto de baja rechaza el PUT con 400, así que el tilde tampoco cambia,
y en la pantalla su formulario ya está apagado.

Revisadas todas las pantallas de la gestión (octubre de 2026), no queda
otro control instantáneo dentro de un formulario con Guardar. El estado y
los cobros del pedido son acciones, y desde A1 viven en la fila del
listado. Las tres fichas (producto, pedido y gasto) son un solo
formulario, tablas, fotos y categorías incluidas, y no tienen acciones al
instante. Dar de baja y Reactivar un producto se hacen desde el listado.

**La ficha de pedido es un solo formulario** (decidido por la usuaria
junto con las correcciones del tutor del 28/10/2026; reemplaza, para el
pedido, la decisión 10 de esas correcciones, que dejaba los productos
como acciones). Datos y Productos del pedido se editan sobre un mismo
borrador y se guardan con un único Guardar, abajo de todo; el pie salió
de la tarjeta Datos. Agregar, editar, cambiar la etapa y quitar un
producto escriben en el borrador, como en el alta (`lineaEnMemoria`, en
`pedidos/presentacion.js`, la comparten los dos). Guardar es una cadena de
los endpoints de siempre, como Crear en el alta: el PUT de los datos si
cambiaron, y después quitar, modificar (solo lo que cambió) y agregar
productos, con el PATCH de etapa de las piezas nuevas que no son
Pendiente; el botón muestra el avance. No es atómico: si algo falla a
mitad, lo anterior queda guardado, la ficha se queda con la última
respuesta y cada pieza nueva ya creada recibe su id real en el borrador,
así reintentar no duplica nada. El error de datos va en la tarjeta Datos;
el de un producto, pegado a la tabla, con "Lo anterior quedó guardado.".
Si todo sale bien, vuelve al listado, que muestra el modal "Cambios
guardados" (y, si el backend bajó el pedido a En producción, lo dice).
Salir con cambios sin guardar pregunta "Salir sin guardar" con el mismo
`useBlocker` de las altas, solo cuando hay cambios, y el navegador avisa
con `beforeunload`. La ficha de gasto funciona igual (ver Módulo Gastos),
y la de producto también, en acordeón (ver el párrafo que sigue).

**La ficha de producto es un acordeón con un solo Guardar** (corrección
del tutor del 28/10/2026, A8-a: pidió un Guardar en vez de que cada
pestaña guardara sola; el pedido era sobre la edición, y el alta sigue
por pasos). Las cuatro secciones, DATOS, MATERIALES, IMÁGENES y
CATEGORÍAS, van una debajo de la otra en `SeccionDesplegable`, local de
`DetalleProducto.jsx`: un encabezado en `#F0E2E4` con franja `#8C5A66` a
la izquierda, que abre y cierra la sección, y a la derecha su resumen ("5
materiales", "1 foto"). Al entrar está abierta solo Datos
(`ABIERTAS_AL_ENTRAR`). Si la sección tiene algo sin guardar, el
encabezado dice "Cambios sin guardar" en rojo, solo el texto; si el
producto usa un material discontinuado, el de Materiales lleva el mismo
círculo ámbar de la miniatura del listado, con `avisoMateriales` en el
title, calculado sobre el borrador. El acordeón lo eligió la usuaria en
lugar de dejar las pestañas con un solo Guardar. Antes las pestañas
Materiales, Imágenes y Categorías guardaban al instante, y Datos tenía su
propio Guardar.

Todo se edita sobre un borrador (datos, `materiales`, `imagenes` y
`categorias`), con las mismas funciones en memoria del alta y los ids
provisorios negativos. Guardar encadena: el PUT de los datos si
cambiaron; quitar, cambiar la cantidad y asignar materiales; borrar fotos,
modificar título u orden y subir las nuevas (cada grupo se renumera solo
si su orden cambió o tiene fotos nuevas); sacar y agregar categorías. El
botón muestra el avance ("Subiendo foto 2 de 5…"). Si algo falla, el
error va en su sección, que se abre, con "Lo anterior quedó guardado.", y
lo ya creado recibe su id real en el borrador, como en pedido y gasto.
Descartar repone el borrador y vuelve a montar las secciones (`version`
en su `key`), así los campos de cada fila también vuelven a lo guardado.
Las vistas previas de las fotos nuevas se revocan al quitarlas, al
descartar y al salir. Guardar valida nombre, precio y dificultad (y abre
Datos si falta algo), pregunta "Guardar sin fotos" si el producto tenía
fotos y el borrador no, y vuelve al listado con "Cambios guardados".
`PestanaDatos` de productos ya no tiene pie ni la prop `enRecorrido`: el
pie lo pone `PieDelRecorrido` en el alta y la ficha debajo de todo.

**El pie de Datos es el mismo en las tres fichas** (producto, pedido y
gasto): Descartar y Guardar siempre visibles, apagados mientras no haya
cambios, con el motivo en el `title` ("No hay cambios que descartar" / "No
hay cambios que guardar"); Guardar se apaga además mientras guarda.
Descartar repone el borrador desde lo guardado y se queda en la ficha;
para salir está el breadcrumb, y el aviso mientras se está en la ficha es
el chip "Cambios sin guardar" del breadcrumb, `ChipCambiosSinGuardar` en
`componentes/`, que las tres dibujan con `hayCambios`. Antes
cada ficha tenía su pie (Producto y Pedido con Cancelar que salía al
listado y nada apagado, Gasto con Descartar y Guardar solo con cambios) y
solo Producto tenía el chip. Es una diferencia deliberada con los tres
prototipos: en el de Productos el pie es CANCELAR (vuelve al listado, con
un modal si hay cambios) y GUARDAR CAMBIOS, siempre visibles, y el chip
existe; en los de Pedidos y Gastos el pie es Cancelar / Guardar y aparece
solo con cambios, donde ese Cancelar descarta, y no hay chip. En las tres
el pie va debajo de todo y no en la tarjeta de Datos, Guardar vuelve al
listado y salir con cambios pregunta (ver "La ficha de pedido es un solo
formulario").

**Avisar, no prohibir, cuando falta el contenido principal.** Un pedido sin
productos, un producto sin fotos y un gasto de materiales sin filas son
válidos: el backend no los rechaza y ningún paso del alta es obligatorio.
Pero se avisa, siempre con `ModalConfirmar` y una pregunta "¿… igual?":

| Cuándo | Título | Texto | Acción |
|---|---|---|---|
| "Crear pedido" sin productos | Crear sin productos | Este pedido no tiene productos cargados. ¿Crear igual? | Crear igual |
| "Crear producto" sin fotos (de ningún grupo) | Crear sin fotos | Este producto no tiene fotos. ¿Crear igual? | Crear igual |
| "Crear gasto" de materiales sin filas | Crear sin materiales | Este gasto no tiene materiales cargados: se va a crear en $0. ¿Crear igual? | Crear igual |
| "Guardar" un pedido que queda sin productos | Guardar sin productos | Este pedido va a quedar sin productos. ¿Guardar igual? | Guardar igual |
| "Guardar" un gasto de materiales que queda sin filas | Guardar sin materiales | Este gasto va a quedar sin materiales: el monto queda en $0. ¿Guardar igual? | Guardar igual |
| "Guardar" un producto que queda sin fotos | Guardar sin fotos | Este producto va a quedar sin fotos. ¿Guardar igual? | Guardar igual |

En las altas lo decide `terminar()`, que llama a `crear()` directo si hay
contenido; en las tres fichas, `pedirGuardar()`, si
tenían contenido guardado y el borrador ya no. Quitar filas en memoria no
pregunta: la pregunta está al crear o al guardar. La
acción va en rosa, no en rojo: es una confirmación, no un modal de
eliminar. En los listados el aviso es `ChipSinContenido` (en
`componentes/`, con `texto` y `title`): "Sin materiales" en MONTO de
Gastos y "Sin productos" en CONTENIDO de Pedidos, en ámbar, el color de
"falta algo" y no el de error.

---

## Decisiones cerradas — no proponer cambiarlas

- **Autenticación por sesión, no JWT.** Un solo backend, una sola
  usuaria, cookie HttpOnly, logout efectivo. El argumento de CORS no
  aplica: tengo origen único. Ya lo descartamos dos veces.
- **Denegación por defecto:** `IsAuthenticated` global en DRF. Los
  endpoints públicos del catálogo llevarán `AllowAny` explícito.
- **Modelo de usuario propio** heredando de `AbstractUser`, en la app
  `usuarios`. Conserva grupos y permisos de Django: no los desactives.
- **Baja lógica** en las entidades que la tienen. Se conserva el
  registro y cambia el estado. Una entidad de baja queda de solo
  lectura.
- **Discontinuar ≠ Eliminar.** Discontinuar es baja lógica reversible;
  eliminar es corrección de errores de carga, y es definitivo.
- **Precio congelado** en las líneas de pedido: se copia al registrar.
- **Cantidad en texto libre** en los materiales de un producto ("dos
  gotas", "media plancha"). Sale del relevamiento con la emprendedora.
- **Disponibilidad cualitativa** (Alta/Media/Baja), no inventario
  numérico.
- **El admin de Django es herramienta de desarrollo, no interfaz de
  usuaria.** Todos los módulos llevan pantalla propia en React.
- **`ImageField`** para imágenes: guarda la ruta en la base y el
  archivo en `media/`, y Pillow valida que sea una imagen real.
- **Las imágenes se reguardan al subir** (`config/imagenes.py`): se
  aplica la orientación EXIF, se achican a 1600 px de lado mayor si hace
  falta, y se guardan como JPEG 90, o PNG si usan transparencia de verdad
  (algún píxel con alfa < 255, no el modo del archivo). Lo llaman los dos
  serializers que reciben archivos, en `validate_<campo>`, que corre
  después de las validaciones de imagen real y de 15 MB. El admin no pasa
  por ahí y se acepta: es herramienta de desarrollo. Las ya guardadas se
  pasan por `python manage.py achicar_imagenes` (`--solo-mirar` para ver
  sin tocar; es idempotente). Salió de medir el catálogo con fotos de
  celular de 2,3 MB: 18 MB por visita, que en Slow 4G eran 4 minutos.
- **Gestión diseñada para escritorio y adaptada a pantalla chica al
  final**, sin rediseñar ninguna pantalla, con la técnica de la sección
  Responsive. El catálogo público sí se diseña directamente para celular.
- **Eliminar un cliente con pedidos está prohibido.** La FK de Pedido a
  Cliente va con `on_delete=models.PROTECT`, y `ClienteViewSet.destroy`
  cuenta los pedidos antes de borrar para devolver un 400 con mensaje
  entendible, igual que hace `materiales/views.py`. CASCADE borraría
  historial de cobros; SET_NULL contradice el modelo lógico, donde
  IdCliente es obligatorio. Cliente no tiene baja lógica, así que el
  mensaje NO puede ofrecer discontinuar: la salida es dejarlo cargado.

---

## Regla de visibilidad del catálogo

Un producto se muestra en el catálogo público si:

```
Producto.estado == ACTIVO
  Y  Producto.es_personalizado == False
  Y  ninguna de sus categorías está en estado BAJA
```

**El estado de la categoría no se propaga por escritura: se evalúa al
consultar.** Dar de baja una categoría retira todos sus productos del
catálogo, aunque pertenezcan también a otras categorías activas.
Reactivarla los devuelve exactamente como estaban.

Un producto sin categorías depende solo de su propio estado.

Eliminar una categoría no elimina sus productos: solo borra las
asociaciones. Los que queden sin categorías siguen visibles.

---

## Módulo Clientes (CU36–CU39)

Diseño en `disenio/Clientes.dc.html`.

**Cliente NO tiene baja lógica.** La tabla no tiene campo Estado. Las
únicas operaciones son alta, búsqueda, modificación y eliminación.

**El usuario de Instagram es único y se guarda normalizado:** sin
espacios, sin el `@` inicial y en minúscula. En Instagram
`Sofi.Delgado` y `sofi.delgado` son la misma cuenta, pero `unique=True`
sobre un `CharField` en PostgreSQL distingue mayúsculas y dejaría
entrar las dos. La normalización va en `Model.save()` para que ningún
camino de escritura la esquive. El serializer necesita además
normalizar en `to_internal_value()`, porque DRF corre el validador de
unicidad ANTES del código propio y si no devolvería un 500 de la base
en vez de un mensaje.

**Clientes sigue el patrón de Materiales, no el de Productos.** La
entidad tiene cuatro campos, así que no lleva pantalla de detalle:
lleva `Clientes.jsx` más los modales de alta/edición, ver y eliminar,
igual que `ModalMaterial`, `ModalVerMaterial`, `ModalDiscontinuarMaterial`
y `ModalEliminarMaterial`.
El modal de ver reusa los mismos campos del formulario en
`readOnly disabled`, con el placeholder cambiado a "Sin cargar".

**El módulo está completo.** Las columnas PEDIDOS, ÚLTIMO y SALDO con
su ordenamiento, los dos chips de filtro, la línea de resumen, el
recuento y el chip de saldo del modal Ver, y la rama bloqueada del modal
Eliminar. La tabla ordena por ÚLTIMO descendente, como el prototipo.

**El único aviso flotante del módulo es el de copiar el email.** El botón
de dos hojas copia el email del cliente y no el usuario (pedido de la
usuaria); sin email cargado se apaga, con "Este cliente no tiene email
cargado" en el title. Copiar
al portapapeles es la única acción sin efecto visible. El alta y la
edición se confirman con `ModalAviso`, como en todos los listados (ver
"Después de crear, las tres vuelven al listado con un modal de aviso");
eliminar se confirma sola: la fila desaparece de la tabla.

**Dos componentes compartidos:** `BotonAccion.jsx` y `Toast` viven en
`componentes/`. Se movieron ahí cuando Clientes pasó a ser la segunda
funcionalidad que los usaba.



---

## Módulo Pedidos (CU40–CU47)

Diseño en `disenio/Pedidos.dc.html`.

**Dos modelos: `Pedido` y `ProductoDelPedido`.** El segundo se llama
así y no "línea": el vocabulario sale de los casos de uso.

**La FK de ProductoDelPedido a Pedido va CASCADE**: un producto del
pedido no significa nada sin su pedido. **La FK a Producto va
PROTECT**, igual que MaterialProducto.

**La FK de Pedido a Cliente va PROTECT**, y `ClienteViewSet.destroy`
pasa a contar los pedidos antes de borrar, devolviendo un 400 con
mensaje. Eso completa lo que quedó pendiente en Clientes.

**Dos fechas de entrega, no una.** `fecha_entrega_estimada` es la que
se le comunica al cliente y puede cambiar; `fecha_entrega_real` se
completa al pasar el pedido a Entregado. Con un solo campo se perdería
la estimación, y con ella la única forma de saber si se entregó a
tiempo.

**La fecha de entrega real no se carga a mano: la escribe el botón
Entregado y nadie más.** La regla es que un pedido tiene fecha de entrega
real si y solo si está Entregado. Al entrar a Entregado se escribe siempre
con la fecha de hoy, aunque el campo ya tuviera una; al salir de Entregado
se borra, también cuando el pedido baja solo a En producción por tener
piezas sin terminar. Borrarla hace falta porque el campo va `read_only` en
el serializer, así que no queda ningún otro lugar donde arreglar un
Entregado tocado por error. Las dos direcciones viven en un solo método,
`_guardar_estado`, por donde pasan los dos lugares que cambian el estado.
El formulario de la ficha muestra el campo apagado y la fecha no forma
parte del borrador, así que no puede viajar en un PUT.

**El estado del pedido y el de sus productos son independientes.** El
primero resume el avance del encargo completo (Pendiente, En producción,
Listo, Entregado); el segundo es la etapa productiva de esas piezas
(Pendiente, Modelado, Secado, Pintura/Barniz, Terminado). Los dos son para
la emprendedora: el cliente no ve ninguno, porque lo único a lo que accede
sin login es el catálogo. Se tocan en un solo punto, el de acá abajo.

**Un pedido no puede estar Listo ni Entregado con piezas sin terminar.**
Es el único punto donde los dos estados de arriba se tocan: son
independientes, pero el pedido no puede decir que está listo si en el
taller falta pintar algo. La regla tiene dos caras, las dos en
`PedidoViewSet`. Al cambiar el estado, `_revisar_estado` rechaza con un 400
que dice cuántas piezas faltan; un pedido sin productos tampoco puede
estar Listo. Al agregar, modificar o quitar un producto,
`_bajar_si_quedo_incompleto` devuelve el pedido a En producción si con ese
cambio dejó de estar completo. Sin la segunda cara, la primera se esquiva
sola: se marca Listo con todo terminado y después se agrega una pieza
nueva, que nace Pendiente. La segunda reusa la primera —le pregunta si el
pedido podría pasar al estado que YA tiene— así que no pueden llegar a
contradecirse. Solo baja el estado, nunca lo sube: terminar la última
pieza no pasa el pedido a Listo, porque decidir que un encargo está para
entregar es de la emprendedora.

La bajada automática se avisa, porque es un cambio que la usuaria no
pidió: en el modal "Cambios guardados" del listado, después de guardar la
ficha. Es la excepción al criterio de
Clientes, donde el aviso flotante se reserva para las acciones sin efecto
visible: acá el efecto se ve, pero nadie lo pidió, que es el otro motivo
para avisar.

**`cambiar_estado` es la única puerta al estado del pedido.** El campo va
`read_only` en el serializer, y el `extra_kwargs` que lo hace vive en
`PedidoListaSerializer.Meta`, de la que hereda la del detalle, así que
vale también para el POST y el PUT de la ficha: un `estado` en el cuerpo
se ignora. Sin ese candado, las dos reglas del estado —esta y la fecha de
entrega real— tendrían una puerta de atrás. El admin de Django sí lo deja
cambiar a mano, y se acepta: es herramienta de desarrollo, no interfaz de
usuaria.

**La forma de entrega tiene tres valores: retiro, envío a cargo mío y
envío a cargo del cliente** (corrección del tutor del 28/10/2026, B4).
Antes el campo era `envio_a_cargo` y solo tenía los dos envíos: no había
forma de decir que el cliente pasaba a buscar el pedido. El campo pasó a
llamarse `forma_entrega` (migración `0003`, escrita a mano: un
`RenameField`, que en la base es un `RENAME COLUMN` sin tocar filas, y un
`AlterField` de choices y textos, que no genera SQL), y su clase
`FormaEntrega` suma `RETIRO`. Las etiquetas pasaron a "Retiro", "Envío a
cargo mío" y "Envío a cargo del cliente"; los valores `MIO` y `CLIENTE`
no cambiaron, así que los pedidos guardados siguen valiendo. Solo el envío
a cargo mío suma el costo al total (`costo_envio_a_cobrar`).

Con retiro no hay dirección ni costo: el frontend los oculta y los manda
vacíos (`datosDeEntrega`, en `pedidos/presentacion.js`), y el comprobante
dice "Retiro por cuenta del cliente" en lugar de la dirección. El backend
no los prohíbe: la coherencia se valida en la aplicación, no en el modelo.
El modelo conserva el default `CLIENTE`, a diferencia de `Gasto.tipo`,
porque los pedidos que se crean por ORM (pruebas y `cargar_datos_prueba`)
quedarían con un valor que no existe.

**Se elige en dos desplegables**, en `PestanaDatos`, igual en el alta y en
la ficha: FORMA DE ENTREGA [Retiro | Envío] y, si es envío, al lado,
QUIÉN ESTÁ A CARGO DEL ENVÍO [Yo | El cliente], que son `MIO` y `CLIENTE`.
La dirección aparece al elegir Envío; el costo, recién al elegir quién lo
realiza, porque de eso depende su nota ("Se suma al total del pedido" /
"Lo paga el cliente: no suma al total"). El borrador guarda `''` (sin
elegir), `'ENVIO'` (el paso intermedio, que nunca viaja), `'RETIRO'`,
`'MIO'` o `'CLIENTE'`; `faltaFormaEntrega` frena los dos primeros en
Crear y en Guardar ("Elegí la forma de entrega…" / "Elegí quién está a
cargo del envío."). El alta arranca sin elegir, con "Elegí…" en el desplegable:
con tres formas, cualquiera de entrada sería un dato guardado sin
pensarlo. Lo pidió así la usuaria ("que quede como los demás", con los
textos "Yo" y "El cliente"); antes fue un árbol de botones en el alta y un
botón "Cambiar forma de entrega" en la ficha, que era lo que pedía el
tutor. Las etiquetas del backend ("Envío a cargo mío" / "Envío a cargo del
cliente") no cambiaron, y son las que se ven en el modal Ver y en el PDF.

**No hay restricción de unicidad sobre (pedido, producto).** El mismo
producto puede figurar en dos filas del mismo pedido si difieren en
variante, precio o etapa productiva. `cantidad` agrupa únicamente
unidades iguales.

**El precio se congela** al registrar el producto del pedido.

**Los materiales de cada pieza se ven desde Inicio.** En la tabla
PRODUCTOS EN ELABORACIÓN, la columna MATERIALES lleva "Ver/Editar Materiales", que
enlaza a `/materiales?producto=X`, ya implementado en Materiales; no
aparece si el producto no tiene materiales cargados. Antes estaba en la
tabla de productos del pedido, y la usuaria lo movió: en el taller es
donde hace falta saber qué lleva cada pieza. Para eso
`ProductoDelPedidoEnProduccionSerializer`, en `inicio/serializers.py`,
trae `producto` y `producto_tiene_materiales` (con `len()` sobre los
materiales prefetcheados, como en Pedidos), y la vista suma
`prefetch_related('producto__materiales')`. La tabla de Inicio pasó de un
mínimo de 720 a 940; en la del pedido, ACCIONES (lápiz y cruz) bajó de
27% a 10% y PRODUCTO subió de 20% a 37%. El "desde" de la etapa ya no
marca en rojo con "· revisar" las piezas con 3 días o más en Secado: la
usuaria pidió sacarlo, y con eso salió `DIAS_AVISO_SECADO`.

**Los cobros (CU48–CU51) viven en la app `pedidos`**, como los productos
del pedido: un cobro siempre cuelga de un pedido y no tiene pantalla
propia: se maneja en `ModalCobros` (ver más abajo). De ahí salen el
saldo, la columna SALDO de los dos listados y los chips.

**No se puede cobrar más que el total del pedido**, y **una seña no
puede dejar el pedido saldado**: el cobro que termina de pagar es el
pago restante o el pago completo. Las dos reglas las revisa el ViewSet
al registrar y al modificar, porque son reglas entre filas y no de una
fila sola.

El saldo todavía puede quedar negativo por otro camino: bajarle el total
a un pedido ya cobrado, que se permite para poder corregir una carga mal
hecha. Por eso el chip conserva su tercera cara, "A favor $X".

**Pendiente del backend:** `POST /api/pedidos/<id>/cobros/` sin `tipo`
responde 500 y no 400, porque la vista lee `datos['tipo']` y DRF no
completa el default del modelo. `ModalCobro` siempre manda `tipo`, así que
la pantalla no lo sufre. Se encontró al revisar los endpoints para el alta
en memoria y queda anotado, sin arreglar.

**Lo que propone el modal de cobro al registrar.** La seña propone la
mitad de lo que falta cobrar (`PORCENTAJE_SENA`, en
`pedidos/presentacion.js`), y Pago completo y Pago restante proponen lo
que falta. Sin pagos, lo que falta es el total: el modal arranca en Seña
con el 50% del total. Con pagos, arranca en Pago restante con el saldo.
Elegir un tipo vuelve a proponer su monto; al editar un cobro no se toca
nada. Es una diferencia deliberada con el prototipo, donde la seña
arranca vacía. Con pagos previos, Pago completo y Pago restante proponen
el mismo número, y la diferencia queda solo en el tipo del cobro.

**Cuándo se puede registrar un cobro.** `motivoSinCobro(pedido)`, en
`pedidos/presentacion.js`, devuelve por qué no, o `''` si se puede. Hay dos
motivos. Sin productos: "Agregá productos al pedido para poder registrar
un cobro", la misma regla que `_revisar_cobro`, que cuenta filas y no el
total. Ya pagado, con saldo en cero o a favor: "Este pedido ya está
cobrado por completo". Lo usan `PestanaCobros` y el listado, así los dos
botones se apagan en los mismos casos y con el mismo title. Como el title
no se ve en el celular, sin productos la lista vacía de cobros lo
dice, y la frase de la seña sale solo con el botón encendido. Desde que el
alta de pedido no tiene cobros, se evalúa solo sobre pedidos guardados.

**La fila del listado: ojo, lápiz, $ (Cobros) y ⋯** (corrección del
tutor del 28/10/2026, A1, con los cambios que pidió la usuaria). Cuatro
iconos por fila, y lo menos usado va en el ⋯ (`MenuMasAcciones`, en
`componentes/`): Último comprobante y Eliminar, este en rojo. El estado no
es un icono: se cambia en su columna (ver "El estado se cambia en la
columna ESTADO"). El ojo (`onVer`) abre `ModalVerPedido`, de solo
lectura, que pide la ficha al abrirse (el listado no trae productos ni
cobros) con los tres estados adentro, y muestra los chips de estado y de
saldo, los datos, los productos con su etapa, los cobros, total y
cobrado; su Editar lleva a la ficha. El lápiz y el número (`onEditar`)
abren la ficha. El $ (Cobros) pide el pedido completo, abre `ModalCobros`
y al cerrarlo recarga el listado, porque el saldo pudo cambiar y con un
filtro de saldo la fila puede irse; abre `ModalCobros` y no un
`ModalCobro` suelto, que ahora solo abre `ModalCobros`. Salió de la fila
el comprobante del pedido. ACCIONES sigue en 19% (178px en el mínimo de
940), porque siguen siendo cuatro botones; ese 19% salió en su momento de
PEDIDO (de 10 a 8), CLIENTE (de 16 a 10) y antes CONTENIDO (de 14 a 12):
a 384px todavía se lee la primera palabra antes del "+N". Con el selector
de estado, ESTADO pasó de 13 a 15% a costa de CLIENTE (de 10 a 9) y
ENTREGA (de 12 a 11).

**El ⋯ es `MenuMasAcciones({ items })`.** Cada ítem es `{ texto, icono,
onClick }` y puede llevar `deshabilitado` con su `motivo` en el title, y
`color`. El botón es un `BotonAccion` con tres puntos; la lista va con
`position: fixed`, calculada desde el botón con `getBoundingClientRect`,
porque la tabla vive en una caja con `overflowX: auto` que recortaría una
lista absoluta, y abre hacia arriba si abajo no entra. Se cierra con un
clic afuera (capa invisible), con Escape y con cualquier scroll o cambio
de tamaño, porque la lista fija no seguiría a la fila. Capas 92 y 93.

**`SelectorBuscable` con `flotante` usa la misma técnica.** Sin esa prop,
el panel con el buscador se abre en el flujo y empuja lo de abajo; con
ella, va con `position: fixed`, calculado desde el campo
(`posicionDebajo`), así no lo recorta el cuerpo con scroll de un modal ni
corre los otros campos. A diferencia del ⋯, no se cierra al deslizar: se
vuelve a ubicar con cada scroll o cambio de tamaño, porque en el celular
abrir el teclado cambia el tamaño de la ventana y lo cerraría apenas se
abre. La lista mide hasta 240px, o menos (mínimo 120) si abajo no hay
lugar. Lo usan el cliente del pedido, el producto de "Agregar producto" y
el material de `ModalMaterial` del gasto (pedido de la usuaria: la lista
corría los campos de abajo). El de `ModalAgregarMaterial` de producto
sigue en el flujo, también por decisión de la usuaria.

**El estado se cambia en la columna ESTADO, con un selector** (pedido de
la usuaria; antes era un icono de dos flechas que abría `ModalEstado`, ya
borrado, con los cuatro estados como botones). Es un `<select>` como el
de la etapa de una pieza en Inicio: elegir otro estado llama a
`cambiar_estado` al instante. El backend devuelve el pedido completo, que
trae todos los campos del listado, y con eso se reemplaza solo esa fila,
sin recargar la tabla; avisa "Pedido listo" (o el que sea) con el aviso
flotante. Si el backend lo rechaza (Listo con piezas sin terminar), el
motivo va en `ModalAviso` con `error` (triángulo rojo, "No se pudo
cambiar el estado"), que se ve esté donde esté la fila, y el selector
vuelve solo al estado anterior porque muestra lo que dice el backend. Va
neutro, como el de etapa, salvo Entregado, en verde
(`colorSelectorEstado`, en `Pedidos.jsx`); `COLOR_ESTADO` sigue pintando
el chip de la ficha y del modal Ver. El estado sigue siendo una acción
instantánea y no un campo del formulario (ver "Formulario o acción" en
Patrón a seguir).

**Último comprobante (CU60)** abre en otra pestaña el comprobante de pago
del cobro más reciente; en el celular lo comparte (ver "En el celular, el
comprobante se comparte", en Diseño visual). `PedidoListaSerializer` trae `ultimo_cobro`, su
id o `null`, calculado con `max()` por (fecha, id) sobre lo que ya trajo
el prefetch, así que el listado sigue en 4 consultas. Sin cobros, el ítem
se apaga con "Este pedido todavía no tiene cobros".

**Cada cobro tiene su comprobante de pago** (corrección del tutor del
28/10/2026, C5): así queda el historial de cada pago, y no solo el del
pedido. `GET /api/pedidos/<id>/cobros/<cobro_id>/comprobante/`
(`comprobante_de_cobro`) busca el cobro con `_buscar_cobro`, como
modificar y borrar: uno de otro pedido da 400 "Ese cobro no pertenece a
este pedido.". No revisa que haya productos, porque un cobro solo existe
si los hay. El modelo no cambia. `generar_comprobante(pedido, cobro=None)`
arma los dos PDF: sin cobro, el de siempre; con cobro, el título es
"Comprobante de pago" y en lugar de "COBROS DEL PEDIDO" va la sección
"PAGOS", una sola tabla con los pagos hasta este (por fecha y, el mismo
día, por id), este al final con fondo verde y "Este pago" debajo del
tipo, y después "Cobrado hasta este pago" y "Saldo después de este pago"
con el chip de tres caras. Es una sola tabla y no dos secciones (este
pago / pagos anteriores) porque con dos un pedido de un producto ya
ocupaba dos hojas. El saldo se calcula con el total de hoy: el PDF no se
guarda, se arma cada vez. En pantalla, el botón con la hoja va al lado
del lápiz de cada cobro en `PestanaCobros`, con la prop opcional
`onComprobante`, que pasa `ModalCobros` y no el alta (sus cobros todavía
no existen). En el celular el mismo botón comparte el comprobante, con la
prop `comprobanteSeComparte` (ver "En el celular, el comprobante se
comparte", en Diseño visual).

**Dónde queda cada comprobante, decidido por la usuaria.** En
`ModalCobros`, el de cada pago, como historial. En el ⋯ del listado,
"Último comprobante". El PDF del pedido sin cobro queda en el backend
(`comprobante`), pero ninguna pantalla lo llama, como `publicar` y
`quitar_del_catalogo`. Esto reemplaza lo que decía el pedido del tutor,
que conservaba el del pedido en la cabecera de la ficha.

**La ficha no tiene Comprobante, Eliminar, Cobros ni la tarjeta de
estado** (octubre de 2026): todo eso se hace desde la fila del listado.
Con el comprobante se fue el motivo "Guardá los cambios para generar el
comprobante", que solo existía en la ficha. La cabecera muestra el chip de
estado, solo para leer, al lado del de saldo; cambia solo cuando el
backend baja el pedido a En producción (ver "La bajada automática").

**La ficha no tiene pestañas** (corrección del tutor del 28/10/2026, A7).
Es como la de Gasto: la cabecera y, apiladas debajo, la tarjeta Datos, la
tabla de Productos del pedido y el pie Descartar / Guardar. Antes eran
tres pestañas (Datos, Productos del pedido y Cobros, las dos últimas con
un globito de cantidad); el tutor pidió que el detalle del pedido sea del
pedido y no de los cobros, que pasaron a un modal. Diferencia deliberada
con el prototipo, que tiene las pestañas y el estado en "Datos y estado".
Es un solo formulario (ver "La ficha de pedido es un solo formulario", en
Patrón a seguir).

**Los cobros van en un modal, `ModalCobros`** (A6, adelantado en A7). Lo
abre el $ (Cobros) de la fila del listado. Envuelve a `PestanaCobros` sin modificarla (sigue compartida con el paso
Cobros del alta) y abre `ModalCobro` encima, capas 100 y 110, para
registrar y editar. No sabe quién lo abrió: recibe el pedido completo,
llama a `registrarCobro`, `modificarCobro` y `borrarCobro`, que devuelven
el pedido completo, y se lo entrega a quien lo abrió con
`onPedidoActualizado(pedido, aviso)`. El aviso flotante ("Cobro
registrado"; editar y quitar no avisan) lo muestra quien lo abrió.
`ModalCobro` queda abierto mientras viaja el cobro y el error del backend
se ve adentro (props `error` y `enviando`, la segunda apaga Registrar para
que un doble clic no cobre dos veces); el de quitar, arriba de la lista.
En A7 lo abría un botón en la cabecera de la ficha; en A1, el ⋯; hoy, el $
de la fila.

**El error de los productos va pegado a su tabla.** `PestanaProductos`
recibe una prop opcional `error` (`errorProductos` en la ficha), copiada
de `MaterialesDelGasto` con `errorMateriales`: si Guardar falla en un
producto, el rechazo se ve entre la cabecera de la tarjeta y la tabla. El
error de los datos queda en el formulario de Datos. El alta no pasa
`error`.

**Un pedido sin productos se marca, no se prohíbe.** En el listado,
CONTENIDO muestra el chip "Sin productos" (`ChipSinContenido`, con el
title "Agregale productos desde la ficha") cuando `cantidad_productos` es
0, en lugar del texto plano del prototipo. Entra en el 12% de CONTENIDO
sin mover ninguna columna: a 12px de letra y `padding: '3px 7px'`, como el
"+N", mide 94px, y a 940 la celda deja 81 de contenido más 16 de padding
derecho (medido en el navegador). Subir CONTENIDO no se pudo: ninguna
columna tenía tres puntos de sobra a 940, y subir el mínimo daba scroll
horizontal en una notebook de 1366. La tabla de Productos vacía dice
"Todavía no hay productos" y "Sin productos no se puede cobrar el
pedido.", en la ficha y en el alta; la usuaria pidió simplificarla, y
salieron "Cargá cada producto con su cantidad…" y la aclaración del
comprobante, que repetía el título (desde C5 el comprobante sale de un
cobro). Guardar un pedido que queda sin productos pregunta (ver "Avisar,
no prohibir" en Patrón a seguir).

**El comprobante en PDF queda fuera.**


---


## Las altas (Productos por pasos; Pedidos y Gastos como la ficha)

**El registro se crea recién al final**, con "Crear producto" / "Crear
pedido" / "Crear gasto": fue la segunda corrección del tutor, porque la
primera versión lo creaba al terminar el paso 1. Hasta tocar Crear todo
vive en memoria, en el estado de la pantalla de alta. Vale para las tres.

**El alta de producto es un recorrido por pasos; las de pedido y gasto son
la misma pantalla que su ficha.** Al principio las tres eran por pasos:
salió de que el tutor encontró confuso que "Crear producto" dejara la
ficha en Datos con un botón Guardar. Después, cuando las fichas de pedido
y de gasto pasaron a ser un solo formulario, la usuaria decidió que sus
altas fueran iguales: las tarjetas apiladas (Datos y Productos del
pedido; Datos y, si el tipo es Materiales, Materiales del gasto) y un pie
Cancelar / Crear, sin pasos. El alta de pedido además dejó de tener
cobros: se registran después, desde el $ de la fila del listado. El alta de producto
quedó por pasos, también por decisión de la usuaria: es la más larga
(datos, materiales, fotos y categorías) y el tutor no la objetó.

**El alta es otra pantalla, no la ficha.** `productos/AltaProducto.jsx`,
`pedidos/AltaPedido.jsx` y `gastos/AltaGasto.jsx` atienden
`/gestion/productos/nuevo`, `/gestion/pedidos/nuevo` y
`/gestion/gastos/nuevo`; `DetalleProducto`, `DetallePedido` y
`DetalleGasto` son solo la ficha de un registro que existe. En productos
no hay `?paso=`: el paso es un estado de la pantalla y `/nuevo` es la
única dirección del alta. Los pasos son `datos`, `materiales`, `imagenes`
y `categorias`.

**El borrador junta todo.** Es el de Datos más una lista por sección
(`materiales`, `imagenes`, `categorias`; `productos`; `materiales`). Las
tarjetas y pestañas son los mismos componentes de la ficha: reciben la
lista y avisan con callbacks, y cada callback escribe en el borrador en
vez de llamar a la API. Para eso los ítems en memoria tienen la misma
forma que los que devuelve el backend, con un id provisorio negativo
(`-1`, `-2`, …) que nunca choca con uno real; en pedidos y gastos los
arman `lineaEnMemoria` y `filaEnMemoria`, que comparten alta y ficha. Las
fotos se guardan como su `File` más una URL de `URL.createObjectURL` para
la miniatura (ninguna de las dos copia el archivo); la URL se revoca al
quitar la foto y al desmontar la pantalla. Intercambiar el orden
intercambia las posiciones del arreglo, y al crear `orden` es la posición
dentro de su grupo. `ModalMaterial` le entrega los datos con
`onGuardar`, en el alta y en la ficha. Si se cargan filas y después se
cambia el tipo a Publicidad, las filas quedan en memoria pero no viajan;
al volver a Materiales reaparecen.

**El monto del gasto en memoria.** `montoEnMemoria(borrador)`, en
`gastos/presentacion.js` (la usan el alta y la ficha), hace la cuenta de
`_recalcular_monto` en `gastos/views.py`: la suma de cantidad por precio
unitario de las filas. Es la única cuenta del backend escrita por segunda
vez en el navegador; las tablas de productos del pedido suman el
subtotal de sus filas, que es la misma suma que hace el backend. Una
pieza nueva nace Pendiente: si se le cambia la etapa antes de crear, va
un PATCH después de su POST, que es lo que hace el selector en la ficha.
En el alta de gastos no se ofrece "Marcar en disponibilidad Alta": esos
endpoints necesitan un gasto creado, y escribir sobre Materiales antes de
registrar la compra no corresponde; se marca desde la ficha. Por eso
`MaterialesDelGasto` recibe `onAlta` y `onAltaTodos` opcionales, y sin
ellos no dibuja esos botones.

**Crear es una cadena de los endpoints de la ficha**, porque el backend no
tiene transacciones ni escrituras anidadas y cada POST hijo ya acepta todo
en una llamada (`cantidad`; `titulo`, `tipo` y `orden`; `precio` y
`descripcion`; `material`, `cantidad` y `precio_unitario`). Productos:
POST del producto → materiales → fotos → categorías. Pedidos: POST del
pedido → productos del pedido (y el PATCH de etapa). Gastos: POST del
gasto → materiales del gasto; el POST va sin `monto` cuando es de
materiales, porque el serializer lo descarta y los validadores de campo
corren antes. Mientras tanto los botones del pie están apagados y el
principal muestra el avance ("Subiendo foto 2 de 5…", "Agregando
productos (1 de 2)…", "Guardando materiales (1 de 2)…"). Si un POST hijo
falla, se hace el DELETE del registro (borra en cascada lo que se alcanzó
a guardar) y se muestra "No se pudo crear el …: <mensaje del backend>",
con el borrador entero para corregir y volver a tocar Crear: en productos
se vuelve al paso del ítem y en fotos el error va en el grupo que falló;
en pedidos y gastos el error va pegado a la tabla. Si falla el POST
principal, el error va en la tarjeta o el paso de Datos. Lo que se cede:
no es atómico en la base. Hay una ventana de milisegundos a segundos en
que el registro existe incompleto, y si falla un ítem y también falla el
DELETE (se cayó la red entre los dos), el registro queda a medias: la
pantalla lo dice, el botón pasa a "Ir al producto" / "Ir al pedido" /
"Ir al gasto", y se arregla desde la ficha. Se eligió esto y no un
endpoint anidado con `transaction.atomic` porque el backend no se toca,
las pruebas siguen valiendo, y cada regla (duplicados, achicado de la
imagen, precio congelado, `_recalcular_monto`) sigue con una sola puerta.

**Después de crear, las tres vuelven al listado con un modal de aviso**
(corrección del tutor del 28/10/2026, A8-b y A9, para productos y
pedidos; gastos se igualó cuando su alta pasó a ser como la ficha).
`crear()` navega al listado con `replace` y `state: { creado: <nombre> }`
o `{ creado: <id> }`: el `state` de la navegación no se ve en la
dirección, y viaja el dato, no el texto, que lo arma cada listado. El
listado lo lee al montar en el inicializador de `useState` y abre
`ModalAviso` ("Producto creado" / «Aros de Luna» quedó creado y ya
aparece en el listado.; "Pedido creado" / "Gasto creado" con su número);
un efecto borra el `state` con un `navegar` a la misma dirección con
`replace`, porque el navegador lo conserva al recargar y el modal
reaparecería. Las fichas de pedido y de gasto dejan `{ guardado: <id> }`
al guardar, y la de producto `{ guardado: <nombre> }`, con el mismo
mecanismo ("Cambios guardados"). Materiales, Clientes y Categorías, que
dan de alta y editan en un modal sobre el listado, muestran el mismo
`ModalAviso` sin navegación de por medio: `ModalMaterial`,
`ModalCliente` y `ModalCategoria` le pasan a `onGuardado` el registro que
devolvió el backend, y el listado elige "Material creado" / "Cliente
creado" / "Categoría creada" o "Cambios guardados" según hubiera un
registro en edición. El cliente se nombra con su usuario de Instagram
(@sofi.delgado). Es un modal y
no el aviso flotante porque, al cambiar de pantalla, el aviso de 2,6
segundos abajo pasaba desapercibido (pedido de la usuaria); la excepción
al criterio de Clientes es la misma que la bajada automática del pedido:
el efecto queda en otra pantalla. "Ir al …" del registro a medias sigue
yendo a la ficha.

**Ningún paso ni sección es obligatorio.** En productos, la barra marca
hecho lo que está antes del actual, y "Siguiente" en Datos hace las
mismas comprobaciones que la ficha (nombre, precio y dificultad, y que el
nombre no exista, contra la lista de todos los productos que el alta trae
al abrirse; si la lista no cargó, lo rechaza el backend al crear) y no
avanza si falta algo; "Anterior" va a cualquier paso sin guardar nada. En
pedidos y gastos esas comprobaciones las hace "Crear" (cliente, fecha y
forma de entrega; fecha, y el monto si el gasto no es de materiales). El
pie tiene Cancelar, y quiere decir una sola cosa: "no lo crees". Un
pedido sin productos, un producto sin fotos y un gasto de materiales sin
filas se pueden crear, pero "Crear …" pregunta antes con `ModalConfirmar`
(ver "Avisar, no prohibir" en Patrón a seguir), y los listados de pedidos
y gastos los marcan con un chip. Como en el alta no hay registro, no hay
nada que ocultar: el panel de la foto y los botones de disponibilidad
Alta existen solo en la ficha, y la cabecera del alta no lleva ningún
chip: tampoco "Cambios sin guardar", que en un alta no dice nada que no
se sepa.

**Salir pierde todo, y se avisa.** Con algo cargado (cualquier campo de
Datos distinto del vacío o cualquier ítem) y mientras se crea, la pantalla
escucha `beforeunload` y el navegador muestra su propio cartel al
recargar, cerrar la pestaña, escribir otra dirección o salir de la
aplicación con Atrás; el texto no se puede cambiar. Cancelar y el enlace
del breadcrumb abren `ModalConfirmar` siempre, con la acción "Salir sin
crear": con algo cargado dice "Se pierde lo que cargaste. ¿Salir sin crear
el producto?" (pedido, gasto) y sin nada cargado solo "¿Salir sin crear el
producto?". **Nada de `window.confirm`** en la aplicación: las preguntas
van con el patrón de modal del sistema, y el único cartel del navegador es
el de `beforeunload`, que no tiene reemplazo. **El que pregunta es un
bloqueo de navegación**, `useBlocker` de React Router, en cada alta: frena
toda navegación que cambie de ruta y la deja esperando; el modal se dibuja
con `bloqueo.state === 'blocked'`, su Cancelar llama a `reset()` (el
router repone la dirección, también después de un Atrás) y "Salir sin
crear" a `proceed()`. Así Cancelar y el breadcrumb (que solo navegan al
listado), el menú lateral y el Atrás del navegador pasan todos por el
mismo lugar. No frena dos navegaciones: la de después de crear (al
listado, y la de "Ir al …" con el registro a medias), con el ref
`saltearBloqueo`, y la del login, porque al cerrar sesión desde un alta la
sesión ya no está. Las tres fichas usan el mismo bloqueo,
pero solo con cambios sin guardar ("Salir sin guardar"). `useBlocker`
exige un data router: por eso `rutas.jsx` usa `createBrowserRouter` (ver
Rutas, en Catálogo público). Un router admite un solo bloqueo a la vez, y
las pantallas que lo usan nunca están montadas juntas.

**Cuatro componentes compartidos en `componentes/`.** `BarraDePasos({
pasos, pasoActual, conAnchoMaximo })` y `PieDelRecorrido({ pasos, paso,
onIr, onCancelar, onTerminar, textoTerminar, ocupado, textoOcupado })` hoy
los usa solo el alta de producto. `BarraDePasos` es la fila de pestañas
con el número del paso en el globito; los pasos son botones apagados, así
les llega la regla `.fila-pestanas > button` de pantalla chica.
`PieDelRecorrido` dibuja Cancelar, Anterior desde el segundo paso y
Siguiente, que en el último dice `textoTerminar`; con `ocupado` apaga los
tres y el principal muestra `textoOcupado`. `ModalConfirmar({ titulo,
texto, textoAccion, onCerrar, onConfirmar })` es el patrón de modal con
una pregunta, Cancelar y la acción en rosa, copiado de los modales de
eliminar sin la llamada a la API; no sabe de navegación ni de API, quien
lo abre decide qué pasa al confirmar. Lo usan las tres altas para salir
sin crear y para crear sin el contenido principal, y las tres fichas
para salir sin guardar y para guardar sin el contenido principal.
`ModalAviso({ titulo, texto, onCerrar, error })` es su hermano para avisar
algo que ya pasó: el texto y un solo botón, Aceptar, sin Cancelar porque
no pregunta nada; capa 100, porque se abre sobre un listado. Es más
angosto que los otros modales (380px, texto a 15), porque lleva una sola
frase. No lleva la cabecera rosa del patrón de modal (pedido de la
usuaria: "parece un modal cualquiera"): arriba va una franja verde claro
(`#E8F5EF`) con un círculo verde de 52px, el tilde blanco y el título en
verde a 18; el círculo entra con un saltito y el tilde se dibuja solo,
con `element.animate()` y `pathLength="1"`, como el aviso flotante. El
texto va centrado y Aceptar sigue en rosa, porque el verde es color de
estado y no de botón. Con `error` es la misma forma en rojo (franja
`#FAEAE8`, círculo rojo con el triángulo): la usan Pedidos cuando el
backend rechaza un cambio de estado y `BotonesExportar` cuando falla un
Excel. Lo usan los seis listados con alta y
edición (productos, pedidos, gastos, materiales, clientes y categorías)
para confirmar las dos. Ninguna tarjeta de Datos tiene pie: la
`PestanaDatos` de pedidos y `DatosDelGasto` lo tienen debajo de la tabla,
y la `PestanaDatos` de productos, en el alta, en `PieDelRecorrido`, y en
la ficha, debajo de todas las secciones.


---



## Módulo Gastos (CU52–CU59)

Diseño en `disenio/Gastos.dc.html`. **El módulo está completo**, backend
y frontend. Los informes son CU60 a CU62 y quedan fuera de este módulo.

**Dos modelos en la app `gastos`: `Gasto` y `MaterialDelGasto`.** El
segundo no lleva app ni ViewSet propio: cuelga siempre de un gasto, igual
que ProductoDelPedido cuelga de Pedido, y se maneja con `@action`
anidadas en `GastoViewSet` bajo `/api/gastos/<id>/materiales/`. Es la
tabla MaterialesDelGasto del modelo lógico: la clave primaria compuesta
(IdMaterial, IdGasto) se resuelve con la PK automática más una
`UniqueConstraint` sobre (gasto, material), como en MaterialProducto.
`registrar_material` chequea el duplicado en Python antes de guardar para
devolver un 400 con mensaje y no el IntegrityError crudo.

**La FK de MaterialDelGasto a Gasto va CASCADE; la FK a Material va
PROTECT**, con `related_name='en_gastos'`. Por eso
`MaterialViewSet.destroy` cuenta también los gastos donde figura el
material antes de borrar, y el mensaje dice "está usado en N productos y
figura en N gastos" según corresponda.

**Gasto no tiene baja lógica**, como Pedido y Cliente: se elimina o se
deja cargado.

**Tres tipos: MATERIALES, PUBLICIDAD y OTRO.** `tipo` no tiene default en
el modelo: el formulario lo pide siempre.

**El monto se guarda en la base, y quién lo escribe depende del tipo.**
Si el gasto es de materiales, lo escribe el backend: es la suma de los
subtotales de sus materiales del gasto. Si es de publicidad u otro, lo
carga la usuaria y tiene que ser mayor a cero. Un gasto de materiales
recién creado, sin materiales, vale 0 y es válido: la pantalla deja crear
el gasto y cargar los materiales después. Guardarlo en vez de calcularlo
al leer es lo que deja los informes como una suma directa de la columna.

**`_recalcular_monto` es la única puerta al monto de un gasto de
materiales.** Vive en `GastoViewSet` y se llama desde cinco lugares:
`perform_create`, `perform_update`, y las tres acciones que tocan los
materiales del gasto (registrar, modificar, quitar). Son los primeros
`perform_*` del proyecto: son los ganchos que DRF deja para actuar sobre
el objeto recién guardado sin reescribir `create()` ni `update()`. El
candado del otro lado está en `GastoSerializer.validate()`: cuando el tipo
efectivo es MATERIALES, el monto que venga en el cuerpo se descarta, así
un PUT no puede pisar lo calculado. Es el `read_only` condicional, con el
mismo motivo que `estado` en PedidoListaSerializer. Cuando el tipo es
PUBLICIDAD u OTRO, ese mismo `validate()` exige monto mayor a cero. En la
base, la regla está escrita como `gasto_monto_positivo_salvo_materiales`:
o el tipo es MATERIALES o el monto es mayor a cero. El admin de Django
deja escribir el monto y cambiar el tipo a mano, y se acepta: es
herramienta de desarrollo.

**Un gasto de materiales no puede cambiar de tipo.** `update()` está
sobrescrito para rechazarlo con 400: los materiales del gasto y el monto
calculado dependen del tipo, y no hay forma de convertirlos en un monto
cargado a mano sin inventarlo. Si el tipo está mal, se elimina el gasto y
se carga de nuevo. El camino inverso sí se permite: un gasto de publicidad
u otro puede pasar a materiales, el monto pasa a 0 y se cargan los
materiales.

**`precio_unitario` no se copia de ningún lado:** Material no tiene
precio. Es lo que se pagó por unidad en esa compra, y el subtotal de la
fila es cantidad por precio unitario. `cantidad` es entero con mínimo 1;
el precio pide 0.01 como Cobro.monto, porque la restricción de la base
pide mayor a cero y las dos capas frenan lo mismo.

**Modificar un material del gasto (CU58) no cambia el material:** el
serializer de modificación solo tiene cantidad y precio unitario, misma
garantía estructural que ProductoDelPedidoModificarSerializer. Para anotar
otro material se quita la fila y se agrega otra.

**No se rechaza un material discontinuado al registrarlo**, igual que en
los materiales de un producto: la pantalla no lo ofrece en el
desplegable, así que el backend no necesita una regla para algo que no le
mandan.

**Disponibilidad Alta desde el gasto es parte de CU58 y es lo único del
sistema que escribe sobre otro módulo.** Comprar un material es la señal
de que volvió a haber existencias. Dos endpoints POST, en snake_case como
todas las acciones del proyecto:

```
POST /api/gastos/<id>/materiales/<fila>/disponibilidad_alta   una fila
POST /api/gastos/<id>/materiales/disponibilidad_alta          todas
```

Los dos pasan por `_marcar_disponibilidad_alta`, que solo cambia los
materiales ACTIVOS con disponibilidad distinta de ALTA. Los discontinuados
(de solo lectura, misma condición que `MaterialViewSet.update`) y los que
ya están en Alta se ignoran: no son un error, y la lista de cambios vuelve
vacía. La respuesta es:

```
{ "materiales_cambiados": [ { "id", "nombre", "disponibilidad_anterior",
                              "disponibilidad_anterior_display" } ],
  "gasto": { ...el gasto completo con sus filas ya actualizadas... } }
```

`materiales_cambiados` es lo que el frontend guarda para el Deshacer del
aviso flotante. **Deshacer no es un endpoint:** se hace con el PATCH de
`/api/materiales/<id>/` que ya existe, mandando la disponibilidad
anterior.

**Un solo serializer de Gasto, no dos como Pedido:** el listado necesita
igual los materiales de cada gasto, porque la tabla muestra cuántos son y
el buscador local busca por nombre de material. Las filas viajan con el
nombre, el estado y la disponibilidad del material y sus `_display`, que
es lo que la tabla del prototipo muestra.

**La búsqueda encuentra también por material:** el buscador del
prototipo dice "descripción, tipo o material". Desde D3 la hace
`_filtrar()` en la base: número (con o sin #), descripción, la etiqueta
del tipo ("publi") y, con un `Exists` para no repetir gastos, el nombre de
un material comprado.

### El frontend de Gastos

En `funcionalidades/gastos/`: `Gastos.jsx` es el listado, `AltaGasto.jsx`
el alta por pasos y `DetalleGasto.jsx` la ficha. Las dos tarjetas de la
ficha, `DatosDelGasto.jsx` y `MaterialesDelGasto.jsx`, están en archivos
propios porque el alta las comparte. Los acompañan `ModalFiltros.jsx`,
`ModalMaterial.jsx`, `ModalEliminarGasto.jsx`, `filtros.js`,
`presentacion.js` y `api.js`.

**El resumen del listado cuenta sobre lo FILTRADO**, al revés que Pedidos
y Clientes. Allá el resumen dice cómo viene el trabajo; acá dice cuánto
suma lo que se está mirando, porque filtrar por período o por tipo es
justamente la forma de preguntar cuánto se gastó.

**El chip "Sin materiales" del listado.** En la columna MONTO, un gasto de
materiales con cero filas muestra el chip en lugar del "$0": el monto es
cero por definición y el chip dice por qué. Va en ámbar (texto `#8A6320`,
fondo `#FDF3E0`, borde `#D9A441`), el color de "falta algo" y no el de
error, con el title "Cargale los materiales desde la ficha". Es
`ChipSinContenido`, en `componentes/`, compartido con el "Sin productos" de
Pedidos (ver "Avisar, no prohibir" en Patrón a seguir); salió de
`Gastos.jsx`, que lo tenía local. Para que entre en el mínimo de 760, MONTO
pasó de 14% a 19% y DESCRIPCIÓN de 36 a 31; hoy el chip mide 97px (12px de
letra) y la celda deja 112 de contenido. Con el ojo de A1, ACCIONES pasó
de 13% a 18% (tres botones de 36px, 136px con el padding a 760) a costa
de DESCRIPCIÓN, de 31 a 26, que ya cortaba con puntos suspensivos.

**Ver un gasto sin entrar a la ficha** (corrección del tutor del
28/10/2026, A1). La fila tiene ojo, lápiz y papelera, como Clientes: el
ojo (`onVer`) abre `ModalVerGasto`, de solo lectura, y el lápiz y el
número (`onEditar`) abren la ficha. El modal no pide nada: la fila ya
trae el gasto con sus materiales. Muestra fecha, tipo, descripción y monto
en `readOnly disabled` con "Sin cargar" de placeholder, y si es de
materiales, la tabla sin botones (decidido por la usuaria; el pedido del
tutor decía solo los datos). El pie es Cerrar y Editar, que lleva a la
ficha, como el Ver de Clientes.

**El tope del deslizador de monto sale de los datos.** `topeDelMonto`, en
`filtros.js`, toma el gasto más caro (`monto_maximo`, que desde D3 manda
`/gastos/resumen/` sobre todos los gastos) y lo redondea hacia arriba a
mil, con el criterio de `rangoDePrecios` en Productos. El piso queda fijo en 0. El
$120.000 del prototipo era de relleno: un tope fijo envejece el día que se
carga un gasto más caro. Los filtros aplicados se muestran como en Pedidos,
con chips que llevan cruz y "Limpiar todo".

**`TIPOS` en `presentacion.js` es para ELEGIR un tipo, no para mostrarlo.**
Dibuja las opciones del modal de filtros, la etiqueta del chip aplicado y
los segmentos de la ficha, que tienen que existir aunque no haya ningún
gasto de ese tipo. Donde se muestra el tipo de un gasto va `tipo_display`.

**El alta crea el gasto al final**, como Productos y Pedidos (ver Alta por
pasos): dos pasos, Datos y Materiales, el segundo solo si el tipo es
Materiales. La primera versión creaba primero y cargaba los materiales en
la ficha. El "Agregá al menos un material…" del prototipo no es un error:
ningún paso es obligatorio, un gasto de materiales en $0 es válido (el alta
pregunta antes de crearlo así) y el listado lo marca con el chip "Sin
materiales". La tabla vacía dice "Todavía no hay materiales" y "Sin
materiales, el gasto queda en $0." (simplificada a pedido de la usuaria).

**La ficha es un solo formulario**, como la de pedido (decidido por la
usuaria junto con las correcciones del tutor del 28/10/2026). Son dos
tarjetas apiladas, Datos y Materiales del gasto, y abajo un solo pie
Descartar / Guardar; el pie salió de `DatosDelGasto`, y "Eliminar gasto"
salió de la ficha (queda la papelera del listado). Agregar, editar y
quitar filas escriben en el borrador (`filaEnMemoria`, compartida con el
alta); Guardar encadena el PUT de los datos si cambiaron, quitar,
modificar (cantidad y precio unitario) y registrar filas, y al final pasa
a Alta las marcadas. Mismo manejo que la de pedido si algo falla a mitad
(lo anterior queda guardado, las filas nuevas reciben su id real, el
error va pegado a la tabla), misma vuelta al listado con el modal
"Cambios guardados" y el mismo "Salir sin guardar". Quitar el último
material no pregunta: pregunta Guardar si el gasto queda sin materiales.

**El monto de un gasto de materiales se calcula en el navegador mientras
se edita**, con `montoEnMemoria` sobre el borrador, en el campo apagado de
arriba y en el pie de la tabla, como en el alta: tiene que acompañar las
filas que todavía no se guardaron. Al guardar lo vuelve a escribir el
backend (`_recalcular_monto`), que es el que vale. `montoEnMemoria` pasa
cada subtotal por `Number()` porque en la ficha se mezclan filas del
backend, con el subtotal como texto, y filas nuevas, con un número.

**El tipo se bloquea en la ficha cuando el gasto GUARDADO es de
materiales.** Los otros dos segmentos van deshabilitados con un title que
lo explica, para no ofrecer un cambio que el backend va a rechazar. Se mira
el gasto guardado, no el borrador. La tabla aparece cuando el BORRADOR es
de materiales, así un gasto de publicidad que se pasa a materiales carga
sus filas y se guarda todo junto; si después se vuelve a publicidad, las
filas quedan en memoria pero no viajan ni cuentan como cambios.

**`ModalMaterial` es un solo modal para agregar y editar**, distinguido
por prop como ModalCobro; al editar, el material queda bloqueado. No llama
a la API: valida y le entrega los datos a quien lo abrió con `onGuardar`,
porque el alta y la ficha guardan en memoria. Antes la ficha lo usaba
llamando a la API, y ese modo se sacó. El desplegable ofrece solo los
materiales activos que todavía no están en el borrador.

**Disponibilidad Alta, parte del Guardar** (decidido por la usuaria). La
flecha de cada fila marca o desmarca `pasar_a_alta` en el borrador, y la
celda DISPONIBILIDAD lo muestra ("Baja → Alta", en verde); "Marcar todos
en disponibilidad Alta" marca todas las que se pueden. Nada cambia en
Materiales hasta Guardar, que al final de la cadena llama a
`marcarDisponibilidadAlta` por cada fila marcada, ya con su id real (así
sirve también para una fila nueva), y suma los `materiales_cambiados`.
El modal "Cambios guardados" dice cuántos pasaron a Alta. Ya no hay
Deshacer: si fue un error, se corrige desde Materiales. El endpoint de
"todas" y `cambiarDisponibilidad` siguen en sus `api.js` (una función por
endpoint), pero ninguna pantalla los llama. Los avisos flotantes de la
ficha desaparecieron: todo se confirma con el modal del listado.

**Dos props opcionales en los componentes compartidos.** `Toast` recibe
`accion` y `onAccion`; sin ellas se dibuja igual. `BotonAccion` recibe
`deshabilitado`; la opacidad se escribe solo cuando está apagado, porque
un 1 fijo le ganaría a la regla de `index.css` que baja la opacidad al
pasar el mouse. `EncabezadoOrdenable` sigue siendo una copia local en cada
listado (Clientes, Pedidos, Materiales y Gastos).


---



## Módulo Finanzas (CU61, CU62)

Diseño en `disenio/Finanzas.dc.html`. La pantalla se llama Finanzas; el
módulo de la tesis sigue siendo Informes. **El módulo está completo: el
backend, verificado en la interfaz navegable, y el frontend.**

**App `finanzas` sin modelos propios:** solo vista, serializers y urls.
Finanzas cruza los cobros (app `pedidos`) y los gastos (app `gastos`), así
que no pertenece a ninguna de las dos. No tiene migraciones ni admin.

**Un solo endpoint, `GET /api/finanzas/`**, con `desde` y `hasta`
(obligatorios, AAAA-MM-DD, inclusivos los dos) y `meses` (opcional,
cuántos meses tiene la evolución: por defecto 6, entre 1 y 24). Si falta
una fecha, está mal escrita, `desde` es posterior a `hasta` o `meses` se
va de rango, responde 400 con `detail`, como en Pedidos. Devuelve todo lo
que la pantalla necesita en un pedido: `totales` (ingresos, gastos,
resultado y las dos cantidades), `ingresos_por_medio`, `gastos_por_tipo`,
`evolucion`, `cobros` y `gastos`. Es una función con `@api_view`, como las
vistas de `usuarios`, porque no es un CRUD. Hereda la autenticación
global.

**Los ingresos son los cobros con fecha dentro del período**, no el total
de los pedidos: es la plata que entró de verdad, y es lo que se puede
comparar contra los gastos.

**Las sumas y los agrupados se hacen en la base** con `aggregate()` y
`annotate()`, y los huecos se completan en Python: los desgloses traen
siempre los dos medios y los tres tipos, también en cero, recorriendo los
`choices` del modelo; la evolución trae un mes por entrada, en cero si no
tuvo movimientos, porque el GROUP BY saltea los meses vacíos. La serie
termina en el mes de `hasta` y tiene su propia ventana de fechas, distinta
del período: con "Este mes" el período es un mes y el gráfico muestra seis.
Son 8 consultas por llamada, siempre las mismas.

**La respuesta pasa entera por `FinanzasDelPeriodoSerializer`**, un
`serializers.Serializer` de solo salida, el primero del proyecto que no es
`ModelSerializer`. Es lo que hace que los importes calculados salgan como
texto con dos decimales, igual que en el resto del proyecto: un `Decimal`
crudo en un `Response` lo convierte DRF a float.

Las dos listas vienen completas y del más nuevo al más viejo; la
paginación y el filtrado son locales. La lista de cobros lleva
`select_related('pedido__cliente')` porque trae el instagram y el nombre.

**La vista está partida en dos funciones** que comparte con la
exportación: `leer_periodo(parametros)` lee y valida `desde`, `hasta` y
`meses` y devuelve el período o el mensaje del 400, y
`calcular_finanzas(desde, hasta, meses)` hace todas las cuentas y devuelve
el diccionario que pasa por el serializer. `finanzas_del_periodo` quedó
en cuatro líneas. Antes de partirla se comparó la respuesta vieja con la
nueva en seis períodos de la base de desarrollo: idénticas.

**Exportar el período (corrección E10).** `GET /api/finanzas/exportar/`
con los mismos `desde`, `hasta` y `meses`, más `formato` (`pdf` o
`excel`; otro, 400). Es otra función con `@api_view`,
`exportar_finanzas`, que usa las mismas `leer_periodo` y
`calcular_finanzas`: el archivo no puede dar otros números que la
pantalla. El armado está en `finanzas/exportar.py`, con las piezas de
`config/exportar.py` (ver "Exportar a PDF y Excel"):

- PDF: el período y "Emitido el … · N cobros · N gastos"; Totales; los dos
  desgloses lado a lado; la evolución como tabla (mes, ingresos, gastos,
  resultado); la lista de cobros y la de gastos. El pie lleva el período a
  la izquierda.
- Excel, en tres hojas: Resumen (las cuatro tablas chicas, una debajo de
  la otra), Cobros (con la columna Medio, que la tabla de la pantalla no
  muestra) y Gastos.

En la pantalla, PDF y Excel van en el renglón del título, a la derecha,
alineados por abajo con la línea del período (`encabezado-pantalla`,
`alignItems: 'flex-end'`). Se apagan con el personalizado incompleto,
mientras carga, si hubo error y con un período sin cobros ni gastos
(`motivoSinExportar`, con el motivo en el title).


---



## Catálogo público (CU63–CU70)

Diseño en `disenio/Catalogo.dc.html`. Son ocho casos de uso, del
Visitante: el catálogo (CU63 visualizar, CU64 filtrar por categoría,
CU65 ver el detalle) y la consulta de productos (CU66 agregar a la
selección, CU67 modificar cantidad, CU68 quitar, CU69 registrar
aclaraciones, CU70 generar el mensaje). CU71 se eliminó de la tesis.
**El módulo está completo**, backend y frontend.

### Backend

**App `catalogo` sin modelos**, como `finanzas` e `inicio`: lee
`productos` y `categorias`. Son `apps.py`, `models.py` (solo el
comentario), `serializers.py`, `views.py`, `urls.py` y `tests.py`; no
tiene migraciones ni admin.

**Tres endpoints, los tres GET y los tres con `AllowAny` explícito:**

```
GET /api/catalogo/productos/        CU63  los productos visibles; con ?pagina=, de a 20
GET /api/catalogo/productos/<id>/   CU65  uno, con todas sus imágenes de resultado; 404 si no es visible
GET /api/catalogo/categorias/       CU64  las categorías activas, por tipo y nombre, con su cantidad
```

Son vistas genéricas de DRF (`ListaDeProductosView` y
`ListaDeCategoriasView` sobre `ListAPIView`, `DetalleDeProductoView`
sobre `RetrieveAPIView`), las primeras del proyecto, con tres `path()` y
sin router: una clase por endpoint y nada más expuesto. El 404 del
detalle sale de buscar el producto DENTRO de los visibles: uno de baja,
personalizado o con una categoría de baja responde lo mismo que uno que
no existe.

**Desde D3 el listado filtra y pagina en la base.** `ListaDeProductosView`
lee de la URL, en su `get_queryset()`:

- `categoria=id`, que se repite: O dentro de un grupo, Y entre grupos.
  Las elegidas se reparten por su `tipo` y, por cada grupo con algo
  elegido, va un `Exists` sobre la tabla que une productos y categorías.
- `busqueda=texto`, en el nombre o la descripción, sin mayúsculas ni
  acentos: `sin_acentos()` limpia el texto en Python y
  `sin_acentos_en_la_base()` el campo en PostgreSQL, con `TRANSLATE` sobre
  `Lower` (viene con la base: ni la extensión unaccent ni migraciones).
- `orden`, una clave de `ORDENES` (`nombre-asc` por defecto), con el
  nombre y el id de desempate.
- `ids=3,7,12`, para la selección.

Un valor que no se entiende responde 400 con `detail`.
`PaginacionDelCatalogo` es la de la gestión con `page_size = 20` y sin
`por_pagina`: el "Cargar más" pide la página siguiente. Como en la
gestión, pagina solo con `?pagina=`; sin él devuelve todos (así pide la
selección sus productos, con `?ids=`). `ListaDeCategoriasView` le suma a
cada categoría `cantidad`, cuántos productos visibles tiene, con una
subconsulta sobre la tabla intermedia y la misma
`visibles_en_catalogo()`: antes lo contaba el navegador sobre la lista
entera, que ya no tiene. `CategoriaConCantidadSerializer` es el de
categorías con ese campo.

**Serializers propios, que no heredan de los de gestión.**
`ProductoListaSerializer` y `ProductoDetalleSerializer` exponen el
estado, los materiales, el paso a paso y las imágenes de referencia, y
con una herencia cualquier campo que se les agregue mañana saldría al
público solo. Los cuatro del catálogo escriben su `fields` entero, sin
sumarle a otro:

- `ProductoCatalogoListaSerializer`: `id`, `nombre`, `descripcion`,
  `precio_actual`, `dificultad`, `dificultad_display`, `categorias`,
  `imagen_principal` (la ruta `/media/...` o `null`).
- `ProductoCatalogoDetalleSerializer`: los mismos ocho más `imagenes`.
- `ImagenCatalogoSerializer`: `id`, `imagen`, `titulo`, `orden`. Sin
  `tipo`: al catálogo solo llegan las de resultado.
- `CategoriaCatalogoSerializer`: `id`, `nombre`, `tipo`, `tipo_display`.

**`Producto.objects.visibles_en_catalogo()` es la regla de visibilidad
escrita para la base.** Vive en `ProductoManager`, en
`productos/models.py`, arriba de `Producto` porque `objects = ...` se
ejecuta al definirse la clase. Es `.filter(estado=ACTIVO,
es_personalizado=False).exclude(categorias__estado=BAJA)`: el `exclude`
sobre la relación de muchos a muchos saca al producto con que UNA de sus
categorías esté de baja, y uno sin categorías pasa. Es la misma regla que
la property `visible_en_catalogo`, que la gestión sigue usando sobre lo
prefetcheado: **si cambia una, cambia la otra**. El manager no genera
migración porque no lleva `use_in_migrations`.

**Las imágenes de referencia ni salen de la base.**
`productos_del_catalogo()`, en `views.py`, es la consulta que comparten
el listado y el detalle: `visibles_en_catalogo()` más `prefetch_related`
de las categorías y un `Prefetch('imagenes', queryset=...filter(tipo=RESULTADO))`.
Así `producto.imagenes.all()` ya viene filtrado y ordenado, y tanto el
serializer como la property `imagen_principal` lo recorren sin
encadenarle un `.filter()`, que rompería el prefetch. Son tres consultas
haya los productos que haya. OJO: en los productos que salen de ahí,
`.imagenes.all()` no son todas sus imágenes; por eso esa consulta no se
usa fuera del catálogo.

**Throttle propio: `ScopedRateThrottle` con scope `'catalogo'`, 60 por
minuto por IP**, en las tres vistas (`throttle_classes` y
`throttle_scope`), que lo comparten porque usan el mismo scope. En esas
vistas REEMPLAZA a los dos throttles globales, no se les suma. No se usó
`AnonRateThrottle` porque su tasa (`'anon'`, 30 por minuto) es la de
cualquier pedido anónimo al resto de la API, y un visitante recorriendo
el catálogo necesita otra: dos pedidos al entrar y uno por cada detalle.
Con un scope aparte cada uno se ajusta por su lado. En desarrollo cada
carga de página son cuatro pedidos, porque `StrictMode` duplica los
efectos: recargar quince veces seguidas llega al límite y el layout
muestra "No se pudo cargar el catálogo." hasta que pasa el minuto.

**`http_method_names = ['get']`** en las tres vistas. Sin esa línea,
POST, PUT, PATCH y DELETE ya daban 405, pero DRF contestaba también HEAD
y OPTIONS, y OPTIONS le devuelve a cualquiera el nombre de la vista y su
docstring. Es lo que hace literal "solo GET".

**En producción la API responde solo JSON.** `produccion.py` deja
`DEFAULT_RENDERER_CLASSES` en `JSONRenderer`: la interfaz navegable es
herramienta de desarrollo y se apaga para TODOS los endpoints, también
los de gestión. El comprobante en PDF no se ve afectado: sale con
`FileResponse`, que no pasa por los renderers de DRF.

### Rutas

**`BASE_GESTION = '/gestion'`, en `constantes.js`, es el único lugar
donde está escrito el prefijo de la gestión.** En `rutas.jsx` hay una
ruta madre `<Route path={BASE_GESTION}>` y las de adentro son relativas
(`index` para Inicio, `'materiales'`, `'productos/nuevo'` antes que
`'productos/:id'`…). El login es `/gestion/login`, adentro de la misma
madre. `Protegido` redirige a `` `${BASE_GESTION}/login` `` y `Publico` a
`BASE_GESTION`. Los 43 paths absolutos de la gestión (los `navegar`, las
rutas de `NAV` en `Layout.jsx`, los dos con query string) usan la
constante con template literals. `rutaActual`, en `Layout.jsx`, le saca
la barra final a `pathname` antes de comparar, porque `/gestion/` muestra
Inicio igual pero no sería igual a `BASE_GESTION`. No se usó `basename`
del router porque le pondría el prefijo a todo el router, y el catálogo lo
comparte sin prefijo.

**`Rutas` es un data router.** El `router` se arma una vez, a nivel de
módulo, con `createBrowserRouter(createRoutesFromElements(…))` sobre el
mismo árbol de `<Route>` de siempre (dentro de un fragmento), y `Rutas()`
devuelve `<RouterProvider router={router} />`. Se pasó de `BrowserRouter`
porque `useBlocker`, el que frena el menú lateral y el Atrás en las altas,
solo funciona en un data router. Todo lo demás es igual: `AuthProvider`
como `element` de la ruta madre, `Protegido` y `Publico` con `<Navigate>`,
`LayoutPublico` con `Outlet`, `useNavigate`, `useSearchParams`, el `state`
del `Link` del catálogo. Verificado recorriendo las 28 direcciones y las
navegaciones internas antes y después del cambio, con la misma salida; y
HMR de Vite actualiza `rutas.jsx` en caliente. La única diferencia: un
error de render ya no deja la pantalla en blanco, lo atrapa la página de
error propia de React Router ("Unexpected Application Error!"). Un
`errorElement` propio queda pendiente.

**`AuthProvider` envuelve solo la rama de gestión**, como `element` de la
ruta madre (`<AuthProvider><Outlet /></AuthProvider>`), y ya no a toda la
aplicación en `main.jsx`. Es la única rama que necesita saber quién
tiene la sesión; así un visitante del catálogo no consulta
`/api/auth/sesion/` nunca. `Protegido` y `Publico` siguen teniendo el
contexto porque se dibujan dentro de ese `Outlet`.

**El catálogo cuelga de `LayoutPublico`, sin path, y termina en una ruta
`*`:**

```
/                        Catalogo              CU63, CU64
/productos/:id           DetalleCatalogo       CU65
/seleccion               MiSeleccion           CU67, CU68, CU69
/mensaje                 Mensaje               CU70
/como-hacer-un-pedido    ComoHacerUnPedido
/tips                    Tips
*                        PaginaNoEncontrada    "No encontramos esa página" y un enlace al catálogo
```

En la `*` caen también las direcciones de gestión escritas sin el
prefijo (`/pedidos`) y las desconocidas dentro de `/gestion`.

### Frontend

En `funcionalidades/catalogo/`: `api.js`, `filtros.js`, `seleccion.js`,
`presentacion.js`, `Catalogo.jsx`, `TarjetaCatalogo.jsx`,
`FiltrosCatalogo.jsx`, `DetalleCatalogo.jsx`, `MiSeleccion.jsx`,
`Mensaje.jsx`, `ComoHacerUnPedido.jsx`, `Tips.jsx`, `CajaMensaje.jsx`,
`ToastCatalogo.jsx` y `PaginaNoEncontrada.jsx`. En `componentes/`:
`LayoutPublico.jsx`, `PiePublico.jsx` e `IconoInstagram.jsx`.

**`LayoutPublico` es independiente de `Layout`:** no usa `AuthContext`
ni nada de gestión. Tiene la franja celeste, el encabezado pegado arriba
(logo, ☰ o enlace a Instagram, "Mi selección" con su contador), la barra
con "Productos ▾ · Cómo hacer un pedido · Tips para tus piezas" en
escritorio y el panel ☰ con el mismo árbol en celular, el `main`, el pie
y el aviso flotante. El panel ☰ es blanco con la barra celeste arriba;
arranca con "Inicio", que lleva a `/` igual que "Ver todos los productos"
porque es lo primero que se busca en un menú; cada nivel del árbol lleva
un fondo un poco más oscuro (`FONDOS` en `ItemPanel`), y termina con "Mi
selección" con su contador y el enlace a Instagram. Los títulos de las
columnas del pie y de los grupos de filtros van en el celeste del precio
a 15px, para distinguirse de los enlaces y las casillas. Importa de la
carpeta `catalogo` (`api`, `filtros`,
`seleccion`, `presentacion`, `ToastCatalogo`), al revés de lo habitual:
el layout es el que carga el catálogo, arma el árbol y guarda la
selección, pero esas piezas viven donde corresponde.

**Las categorías se cargan UNA vez, en el layout**, con
`listarCategoriasDelCatalogo` y el patrón de tres estados: el listado, el
árbol del encabezado y el pie usan la misma lista, que trae la cantidad
de cada una. Las pantallas recién se dibujan con ella y la leen con
`useOutletContext()`: `{ grupos, esEscritorio, seleccion, mostrarAviso }`.
**Los productos los pide cada pantalla** (corrección D3): el listado, de
a 20 con los filtros, y "Cargar más" suma los 20 siguientes debajo
(`Catalogo.jsx`, con `pagina`, `total` y `cargandoMas`; el primer pedido
se repite cuando cambian los filtros, el orden o la búsqueda, con la
bandera `vigente`); el detalle, el suyo (`obtenerProductoDelCatalogo(id)`);
y la selección, sus productos por id, desde el layout
(`listarProductosDelCatalogo({ ids })`), solo cuando cambia QUÉ productos
hay elegidos y no la cantidad. Un visitante hace tres pedidos al entrar
(las categorías, la primera página y, si tiene algo elegido, su
selección), uno por cada "Cargar más" y uno por cada detalle.

**Los filtros viven en la URL: `/?categoria=3&categoria=7`**, un
parámetro por categoría elegida, leído y escrito con `useSearchParams`,
así una dirección filtrada se copia, se abre en otra pestaña y sobrevive
a recargar. **El orden también: `?orden=precio-desc`**, uno de los
cuatro valores de `ORDENES`; si falta o trae otra cosa vale
`ORDEN_POR_DEFECTO` (`nombre-asc`), que no se escribe. **Y la búsqueda:
`?busqueda=aros`**, el texto tal cual; un texto en blanco no se escribe.
Desde D3 el filtrado, el orden y la búsqueda (sin acentos ni mayúsculas)
los hace el backend; la búsqueda viaja 300 ms después de la última letra.
Las funciones están en `filtros.js`: `agruparCategorias`
(los dos grupos, tipo de accesorio y después temática, cada categoría con
la `cantidad` que manda el backend; las que no tienen productos no salen,
y el título del grupo es el `tipo_display` del backend), `leerFiltros`
(solo los ids que existen entre las categorías que se muestran: un id
viejo o mal escrito no filtra ni se cuenta), `escribirFiltros`,
`alternarFiltro`, `ordenarCategorias`, `leerOrden`, `escribirOrden`,
`leerBusqueda`, `escribirBusqueda` y `parametrosDelCatalogo`, que traduce
los elegidos, el orden, la búsqueda y la página a los parámetros del
listado (**O dentro de un grupo, Y entre grupos** lo resuelve el backend:
con Aros, Dijes y Harry Potter quedan los aros y los dijes que sean de
Harry Potter). Las casillas, el desplegable de orden y el buscador
escriben con `replace: true`, para que tildar tres filtros o escribir seis
letras no deje seis pasos en el historial, y cada escritura lleva filtros,
orden y búsqueda juntos, por `escribirDireccion` en `Catalogo.jsx`, que
parte de lo que hay y pisa lo que cambia, porque `setSearchParams`
reemplaza todos los parámetros; elegir desde el árbol, el pie o un chip
del detalle navega a `/?categoria=<id>`, una sola. "Volver al catálogo"
conserva los filtros, el orden y la búsqueda porque la tarjeta los deja en
el `state` del enlace. Los derivados (elegidos, orden, búsqueda, "N
piezas" con el `count` del backend) se calculan en cada dibujo y nunca se
guardan en estado. Sin resultados por la búsqueda, "Limpiar búsqueda" es
un botón (prop `onSalida` de `CajaMensaje`) que deja los filtros; sin
resultados por los filtros, "Ver todas las piezas" sigue siendo el enlace
a `/`.

**La selección vive en `localStorage`, bajo la clave
`catalogo-seleccion`**, con esta forma exacta:

```
{"cantidades":{"14":2,"37":1},"aclaraciones":"Los aros en dorado, si se puede."}
```

Solo ids y cantidades: el nombre, el precio y la foto salen de los
productos que el layout pide por id, así un producto que dejó de ser visible
desaparece de la selección solo, sin error (su id queda guardado, y si
vuelve al catálogo vuelve a la selección). Se lee una vez, al montar el
layout, y se guarda en cada cambio, las dos cosas con `try/catch`: si el
navegador bloquea `localStorage` o lo guardado está roto, se arranca
vacío. Al leer se revisa la forma: de `cantidades` sobreviven solo las
entradas con clave entera positiva y valor entero entre 1 y 99;
`aclaraciones` tiene que ser texto y se corta a 500. Las funciones puras
están en `seleccion.js` (`leerSeleccionGuardada`, `guardarSeleccion`,
`agregar`, `modificar`, `quitar`, `itemsDeLaSeleccion`, `cantidadTotal`,
`totalOrientativo`, `textoDelMensaje`, con `CANTIDAD_MAXIMA = 99` y
`LARGO_MAXIMO_ACLARACIONES = 500`); el estado y las cuatro funciones que
lo cambian viven en el layout y se llaman con los verbos de los casos de
uso: `agregarProducto` (CU66), `modificarCantidad` (CU67),
`quitarProducto` (CU68), `registrarAclaraciones` (CU69). Los ítems, el
contador y el total se calculan en cada dibujo: nunca en estado.

**El mensaje (CU70) está calcado de `textoSeleccion()`:**
"Hola Ana! Te consulto por estas piezas del catálogo:", una línea
"• N × nombre — $subtotal" por pieza, "Aclaraciones: …" solo si hay,
"Total orientativo: $X" y "Gracias!". Se arma en cada dibujo con
`textoDelMensaje` y se muestra en un `<pre>` con `pre-wrap`, que se
puede seleccionar. "Copiar mensaje" usa `navigator.clipboard.writeText`,
que existe solo en https y en localhost; si falla, el aviso dice que se
copie a mano. "Abrir Instagram" es un `<a>` al perfil, en pestaña nueva
con `rel="noopener noreferrer"`, como todos los enlaces externos del
catálogo.

**Todo lo que navega es un `<Link>`, no un botón con `navegar()`.** Es
un sitio público: las tarjetas, los chips de categoría, los ítems del
árbol y del pie, "Volver", el logo y "Mi selección" tienen que poder
abrirse en otra pestaña y copiarse con clic derecho. Lo que no cambia la
dirección (☰, las ramas del árbol, las casillas de filtro, "Quitar
filtros", − y +, Quitar, las miniaturas, Copiar) sigue siendo botón. En
la gestión el patrón sigue siendo botón con `navegar()`.

**`ToastCatalogo` es otro componente que `Toast`**, por dos motivos: los
colores (el del catálogo es oscuro, con texto blanco y tilde verde
clara; `Toast` es verde sobre verde claro) y, el
decisivo, que su acción "Ver" lleva a `/seleccion` y por eso es un
`<Link>`, mientras que en `Toast` la acción es un botón. Vive en el
layout, para seguir a la vista si cambia la pantalla; dura 2,8 segundos;
lleva `width: max-content`, porque un elemento fijo con `left: 50%` solo
puede medirse con la mitad derecha de la pantalla y el texto se partía en
seis renglones. Agregar un producto desde el detalle ya no avisa: el
contador que aparece en el lugar del botón lo dice solo. Hoy el aviso lo
usa solo la pantalla del mensaje ("Mensaje copiado"), así que la acción
"Ver" sigue en el componente pero nadie la pasa.

**La galería del detalle se recorre deslizando el dedo.** La foto grande
es una fila con todas las fotos, que se desplaza de costado con
`scroll-snap` para frenar siempre en una foto; seguir el dedo y la inercia
los hace el navegador, sin librerías. Las miniaturas se sincronizan con la
fila en los dos sentidos: `alDeslizar` marca la que quedó a la vista e
`irAFoto` lleva la fila hasta la que se toca.

**`INSTAGRAM_USUARIO = 'ana_porcelanaa'` e `INSTAGRAM_URL` viven en
`constantes.js`.** Es con doble a al final, distinto del nombre del
proyecto. Lo usan el encabezado, el panel, el pie, el paso 4 de "Cómo
hacer un pedido" y la pantalla del mensaje.

**Dos cosas más.** `formatearPrecio` se importa de
`productos/presentacion.js` y se re-exporta desde
`catalogo/presentacion.js`, como hacen Pedidos y Gastos. La dificultad de
elaboración no lleva chip ni colores en el catálogo: la tarjeta no la
muestra (como chip en la miniatura no se entendía a qué se refería), y el
detalle la muestra debajo del precio como "Dificultad de elaboración:
media" con tres círculos celestes que se rellenan según el nivel
(`NIVEL_DIFICULTAD`: 1, 2 o 3), dibujados en SVG y no con los caracteres
●○○ para que se vean iguales en todos los sistemas, como el corazón de la
portada; sin rojo, que se lee como error. Y la pantalla de la selección se llama `MiSeleccion.jsx`
y no `Seleccion.jsx` porque al lado está `seleccion.js`: en Windows el
disco no distingue mayúsculas, un import de `./Seleccion` encontraba
primero al `.js` y el build fallaba.

### Responsive del catálogo

**El catálogo se diseñó primero para celular**: los estilos en línea son
la versión de celular, y lo que cambia en escritorio lo decide React
cuando cambia la estructura (la barra con el desplegable o el ☰ con el
panel; los filtros a la vista o en el panel que sube desde abajo) y una
clase `catalogo-*` de `index.css` cuando solo cambian medidas.

**Un solo punto de corte, propio, en 900px.** Está en dos lugares que
tienen que coincidir: `ESCRITORIO_CATALOGO = '(min-width: 900px)'` en
`constantes.js` y la media query del bloque del catálogo en `index.css`.
Los 768 y 1440 de la gestión son otros y no se mezclan. `useEsEscritorio`,
en `LayoutPublico.jsx`, es `usePantallaChica` con esa consulta; el layout
es el único que lo llama y pasa el resultado por el contexto, así hay una
sola escucha y todas las pantallas cambian a la vez.

**Capas del catálogo (`z-index`):** desplegable 45 sobre su capa
invisible 40, encabezado 50, fondo oscuro 60, panel ☰ y panel de filtros
61, aviso flotante 70. No se cruzan con las de la gestión (90 a 120)
porque son otras pantallas.

**Las clases `catalogo-*` de `index.css` son estas y solo estas.** Las
grillas del pie, de los pasos y de las tarjetas usan
`repeat(auto-fit, …)` y no necesitan clase.

Hovers, fuera de la media query de 900, con `!important` sobre lo que
está en línea. Van todos dentro de `@media (hover: hover)`, que se cumple
solo donde hay un mouse de verdad: en un celular el navegador activa
`:hover` al tocar y algunos lo dejan puesto después del toque, así que el
botón tocado ("Mi selección", el ☰, Filtrar) quedaba sombreado en unos
celulares y en otros no. En una pantalla táctil no hay hover nunca. El
foco de `catalogo-campo` queda afuera, porque no es un hover:

- `catalogo-suave`: fondo celeste suave; el ☰, Filtrar y su cruz, la cruz
  del buscador, el enlace a Instagram del panel ☰, − y +, y los botones y
  enlaces con borde (Copiar mensaje, Seguir mirando, las salidas de
  `CajaMensaje`).
- `catalogo-tarjeta`: borde más oscuro; la tarjeta del listado y los
  chips de categoría del detalle.
- `catalogo-subrayado`: subrayado; "Volver al catálogo", "Volver",
  "Quitar filtros" y "Ver todos los productos".
- `catalogo-item`: texto celeste; los tres ítems de la barra, el
  desplegable y los enlaces del pie.
- `catalogo-item-panel`: se oscurecen apenas (`brightness .97`, sin
  `!important` porque `filter` no está en línea); los renglones del
  panel ☰.
- `catalogo-instagram`: celeste claro; los enlaces a Instagram del
  encabezado, del pie y del paso 4.
- `catalogo-relleno`: opacidad .92; los enlaces con fondo celeste
  (Consultar por Instagram, Abrir Instagram, Ver el catálogo), que al ser
  `<a>` no toman el hover global de los botones.
- `catalogo-quitar`: fondo rojo claro; la cruz de quitar en la selección.
- `catalogo-campo`: borde celeste al enfocar; el textarea de aclaraciones,
  el desplegable de orden y el buscador del listado (la regla global de
  foco de `index.css` es solo para `input` y pinta el rosa de la gestión:
  en el buscador la clase le gana por especificidad).
- `catalogo-accion-aviso`: velo blanco sobre fondo oscuro; el "Ver" del
  aviso flotante y la cruz del panel ☰.

De 900px para arriba, solo medidas:

- `catalogo-contenido`: el `main`; padding 28/24 en vez de 16.
- `catalogo-logo`: el logo del encabezado; 22px en vez de 18.
- `catalogo-portada` y su `h1`: la portada del listado; más aire y el
  título a 36px (22 en celular).
- `catalogo-columnas`: la grilla del listado; `240px 1fr`, filtros y
  tarjetas. Va solo cuando hay filtros que poner en la primera columna.
- `catalogo-detalle`: la grilla del detalle; galería y datos lado a lado.
- `catalogo-seleccion`: la grilla de la selección; lista y resumen de
  320px lado a lado.

**Verificado en un Chrome sin ventana** en 384, 720, 1152 y 1920, en
todas las páginas y estados (38 capturas): sin scroll horizontal, sin
textos recortados y con todas las imágenes en `object-fit: cover`.

### Pendientes

- **Los 11 errores de `npm run lint`** (medidos el 29/10/2026). Siete
  vienen de antes del catálogo y no son de él:
  `react-refresh/only-export-components` en `componentes/Paginacion.jsx`
  (línea 11), `contexto/AuthContext.jsx` (39) y
  `funcionalidades/clientes/ModalCliente.jsx` (7, 16, 23, 31 y 36). Los
  otros cuatro son de D3, `react-hooks/set-state-in-effect`: un `setState`
  sincrónico al principio de un efecto, para vaciar una lista cuando no
  hay nada que pedir, en `componentes/LayoutPublico.jsx` (251),
  `funcionalidades/categorias/Categorias.jsx` (341) y
  `funcionalidades/materiales/Materiales.jsx` (765 y 803). El
  `exhaustive-deps` de Materiales ya no aparece.


---



## Pruebas

**Hay 146 pruebas automatizadas del backend**, con `APITestCase` de DRF:
en el `tests.py` de cada app (las diez tienen) y en `pruebas/tests.py`
las que no son de una app en particular (el achicado de imágenes).
Corren con `python manage.py test` desde `backend/`; una app sola con
`python manage.py test <app>`. El listado completo, con qué verifica
cada una, el CU o la regla que cubre y su grupo, está en
`pruebas/PRUEBAS.md`, que se actualiza al agregar una prueba. La
cobertura es del 89 % (`coverage run manage.py test` y
`coverage report`; `.coveragerc` excluye la app `pruebas`, las
migraciones y los settings).

**Las pruebas en verde no prueban el servidor que está corriendo.**
`manage.py test` lee cada archivo de nuevo; `runserver` puede quedar con
una versión intermedia si un cambio se hizo en dos pasos y el segundo
cayó en el mismo segundo (pasó con `FILA_ENCABEZADO`: cuatro Excel en 500
con las pruebas pasando). Después de cambiar el backend se pide el
endpoint a través del proxy, y si falla con algo que el archivo ya tiene,
se recarga tocando la fecha del archivo.

**La base compartida vive en `pruebas/base.py`.** `PruebaSinSesion`
limpia la caché en `setUp`, porque los throttles guardan ahí sus
contadores y sin eso una prueba hace fallar a la siguiente con un 429 al
azar. `PruebaConSesion` además crea la usuaria y entra con `force_login`:
`client.login()` pasa por los backends y el de axes exige un request.
Las de rendimiento (`assertNumQueries`) autentican con
`force_authenticate`, que no toca la base, para contar solo las
consultas del ViewSet: la sesión suma las suyas (leerla, leer la usuaria
y renovarla por `SESSION_SAVE_EVERY_REQUEST`). Para las exportaciones,
`celdas_del_excel(respuesta, primera_columna)` devuelve las filas de
datos de la planilla (las que van debajo de la fila cuya primera celda es
esa) y `TIPO_EXCEL` es el content-type del `.xlsx`.

**Las imágenes se generan en memoria** con Pillow: `imagen_png` (un PNG
chico de un color), `foto_jpeg` (un JPEG de ruido de 4 MB, parecido a
una foto: una imagen lisa comprime tanto que el JPEG achicado pesaría
más y "pesa menos" fallaría por el dato), `png_de_mas_de_15mb` (válido,
con un chunk `tEXt` de 16 MB, para que lo único que lo rechace sea
`validar_tamano_archivo`) y `png_bomba` (una cabecera que declara 900
millones de píxeles; Pillow la rechaza al abrir y responde 400, no 500).
Las clases que suben archivos llevan `@media_temporal`, que apunta
`MEDIA_ROOT` a una carpeta temporal y la borra al terminar: las pruebas
no dejan nada en `media/`.

**Convenciones:** nombres en español que dicen qué pasa y qué responde
(`test_editar_material_discontinuado_da_400`); docstring de una o dos
líneas con el CU según el listado oficial de la tesis; mensajes de error
comparados contra el texto exacto; cada regla que rechaza algo va
seguida, en la misma prueba, del caso que sí pasa. Los datos se crean
por ORM; la operación que se prueba va por la API. CSRF se prueba con
`APIClient(enforce_csrf_checks=True)`; el borrado de archivos por señal,
con `captureOnCommitCallbacks(execute=True)`, porque en un `TestCase` no
hay commit. Las pruebas manuales siguen documentadas en el informe final.

**Datos de prueba para medir rendimiento.**
`python manage.py cargar_datos_prueba --escenario 1anio|3anios
[--fotos-reales] [--semilla N]` llena una base con los volúmenes de la
entrevista (40 pedidos/mes, 2 productos por pedido: 500 pedidos y 150
productos por año). Se niega a correr si el nombre de la base no termina
en `_prueba` y pide la base vacía. Respeta las reglas del sistema
llamando a las mismas funciones del ViewSet (`_revisar_estado`,
`_revisar_cobro`, `_recalcular_monto`). Las imágenes que genera se
llaman `prueba-*` en `media/productos/`: PNG de un color, o con
`--fotos-reales` copias achicadas de las fotos reales de esa carpeta
(las originales no se tocan). Para usarla: `ana_porcelana_prueba` existe
en PostgreSQL; `DB_NAME=ana_porcelana_prueba` en el `.env` (y reiniciar
`runserver`), `createsuperuser`, cargar; para empezar de nuevo,
`flush --no-input` (borra también la usuaria) y
`Remove-Item media\productos\prueba-*`. Al terminar,
`DB_NAME=ana_porcelana`.


---



## Despliegue

Guía de operación en `DESPLIEGUE.md` (raíz): primera vez en el servidor,
actualizar, tareas programadas, logs, respaldos. **En producción desde
octubre de 2026 en https://anaporcelana.com.ar.** Servidor: Cloud Server
de DonWeb, Ubuntu 24.04, 2 vCPU, 4 GB, anaporcelana.com.ar (con `www`).

**Tres contenedores con Compose, y nada más:** `frontend` (nginx con el
React compilado, único expuesto, 80/443), `backend` (Django + gunicorn,
sin puerto publicado) y `db` (postgres:17). Dos volúmenes, `base` y
`media`. Archivos: `docker-compose.yml`, `docker-compose.servidor.yml`,
`.env.produccion.ejemplo`, `.gitattributes`, `backend/Dockerfile`,
`backend/arrancar.sh`, `backend/.dockerignore`, `frontend/Dockerfile`,
`frontend/.dockerignore`, `frontend/nginx/{sitio,http,https}.conf`,
`frontend/nginx/elegir-config.sh`, `config/ip.py`.

**`/admin/` no se expone:** nginx reenvía solo `/api/`. Por eso no hay
`STATIC_ROOT`, `collectstatic` ni volumen `static`: lo único que los
usaba era el admin, que es herramienta de desarrollo.

**certbot va en el servidor, instalado con apt, no en un contenedor.**
Modo webroot: escribe el desafío en `/var/www/certbot` y guarda los
certificados en `/etc/letsencrypt`; las dos carpetas se montan de solo
lectura en `frontend`. Renueva el `certbot.timer` del paquete de Ubuntu,
y un deploy-hook en `/etc/letsencrypt/renewal-hooks/deploy/` recarga
nginx. Los dos montajes van en `docker-compose.servidor.yml`, que en el
servidor se copia como `docker-compose.override.yml` (Compose lo suma
solo si existe; está en `.gitignore`): en la PC esas carpetas no existen
y un bind mount a una ruta Linux inexistente en Windows crea carpetas
raras. El `docker-compose.yml` base es idéntico en los dos lados y no
usa `${}`.

**nginx elige su configuración al arrancar según exista el certificado.**
nginx no arranca si un `ssl_certificate` apunta a un archivo que no
existe. `elegir-config.sh`, en `/docker-entrypoint.d/` (la imagen oficial
corre esos scripts antes de nginx), copia `https.conf` si encuentra
`/etc/letsencrypt/live/anaporcelana.com.ar/fullchain.pem` y `http.conf`
si no. Las rutas comunes (`/api/`, `/media/`, `/assets/`, SPA) están una
sola vez en `sitio.conf`, incluido por los dos. Así `docker compose up`
es el mismo comando en la PC, en el servidor antes del certificado y
después; tras emitirlo hace falta `docker compose restart frontend`. El
dominio está escrito en `https.conf` y en `elegir-config.sh`; para
Django, en `.env.produccion`.

**`HTTPS_ACTIVO`** (variable de entorno, por defecto `si`) gobierna en
`produccion.py` las cuatro opciones que dependen del certificado:
`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT` y
`SECURE_HSTS_SECONDS`. Con `no` se prueba en la PC por
`http://localhost`; si falta, quedan encendidas. `check --deploy` da 0
avisos con `si` y exactamente W004, W008, W012 y W016 con `no`. `DEBUG`
no es variable: `produccion.py` lo fija en False.

**La IP real detrás de nginx.** nginx escribe `X-Forwarded-For` con
`$remote_addr` (lo que él ve) y NO con `$proxy_add_x_forwarded_for`, así
la cabecera trae un solo valor y no se puede falsificar. Del lado de
Django, en `produccion.py`: `REST_FRAMEWORK['NUM_PROXIES'] = 1` para los
throttles y `AXES_CLIENT_IP_CALLABLE = 'config.ip.ip_de_origen'` para
axes (función propia de pocas líneas, en vez de sumar django-ipware;
toma el último valor de la cabecera o `REMOTE_ADDR`). Verificado:
`axes_list_attempts` muestra la IP del gateway de la PC (172.20.0.1), no
la de nginx. Además `X-Forwarded-Proto $scheme` para
`SECURE_PROXY_SSL_HEADER` y `Host $host` para `ALLOWED_HOSTS`.

**Caché compartida entre workers.** Los throttles guardan contadores en
la caché `default`; con LocMemCache cada worker de gunicorn tiene la
suya y los límites valen por tres. `produccion.py` usa `FileBasedCache`
en `BASE_DIR / 'cache'` (absoluta en los dos sistemas; `/tmp/...` en
Windows cuenta como relativa y `check` avisa), git-ignorada. Verificado:
65 pedidos al catálogo dan 60 de 200 y 5 de 429 en total, no por worker.
axes no la necesita: guarda en la base.

**`LOGGING` a consola en `produccion.py`:** con DEBUG=False, Django manda
los errores solo a `mail_admins`, que no existe acá; sin esto un 500 no
se vería en `docker compose logs`. `root` en WARNING: incluye los 4xx
que Django registra y los 500.

**Backend:** `python:3.11-slim` (la versión del venv), dependencias en
una capa aparte, usuario `app` sin privilegios dueño de `/app` (y de
`/app/media`, para que el volumen vacío copie ese dueño), `arrancar.sh`
como CMD: `set -e`, `migrate --noinput` y `exec gunicorn` con
`--workers 3` (2 × CPU + 1), `--forwarded-allow-ips="*"` (nginx no tiene
IP fija en la red de Docker y nadie más llega al backend) y
`--access-logfile -`. `migrate` va al arrancar y no en el Dockerfile
porque al construir no hay base. psycopg2-binary se queda: la
advertencia de psycopg2 es por conflictos de libpq con OTRAS bibliotecas
del mismo proceso, que en un contenedor que corre solo Django no hay.

**Frontend:** dos etapas, `node:24-alpine` (`npm ci`, `npm run build`)
y `nginx:1.30-alpine`. En `sitio.conf`: `client_max_body_size 16m` (15
MB de imagen más el sobre del multipart, así rechaza Django con su
mensaje y nginx solo frena lo absurdo con 413); gzip de css, js, json y
svg; `/api/` con `resolver 127.0.0.11` y `proxy_pass` por variable, para
que un backend recreado con otra IP no deje 502; `/media/` con `alias` al
volumen, 30 días (el storage reutiliza un nombre solo tras borrar el
archivo), nosniff y sin autoindex; `/assets/` un año e `immutable` (Vite
pone un hash en el nombre); `/` con `try_files $uri /index.html` y
`no-cache`, para que cada despliegue se vea al recargar. Las cuatro
cabeceras de seguridad (HSTS, `X-Frame-Options`, `nosniff`,
`Referrer-Policy`) las pone nginx en todas las respuestas desde
`cabeceras.conf`, incluido a nivel server y otra vez en cada location con
`add_header` propio, porque un `add_header` en una location anula los del
server; HSTS solo en https, por la variable `$hsts` que `http.conf` deja
vacía (nginx no manda una cabecera vacía); en `/api/` se descartan con
`proxy_hide_header` las copias que manda Django, para que no salgan dos
veces; `server_tokens off` oculta la versión.

**`.env.produccion`** (git-ignorado; ejemplo en
`.env.produccion.ejemplo`): `ENTORNO`, `SECRET_KEY`
(`secrets.token_urlsafe(50)`: 67 caracteres sin nada que `.env` o Compose
interpreten), `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `HTTPS_ACTIVO` y
la base en dos ternas, `POSTGRES_*` (las lee la imagen de PostgreSQL al
crear la base) y `DB_*` (las lee Django), que tienen que coincidir: con
ese nombre de archivo Compose no interpola `${}` (solo lo hace desde un
`.env` de la raíz o con `--env-file` en cada comando), así que no hay
forma de escribirlas una vez. El healthcheck de db usa
`pg_isready -h localhost`: por TCP, porque la primera vez la imagen
levanta un servidor provisorio sin TCP que sin `-h` ya contestaría que
sí.

**`.gitattributes`** fija `eol=lf` en `*.sh`, `*.conf`, `Dockerfile`,
`.dockerignore` y `.env.produccion.ejemplo`: con `core.autocrlf=true`
saldrían con CRLF y un script con CRLF no arranca en Linux. Los dos `.sh`
están en git con modo 100755.

**Datos del servidor real que están en `DESPLIEGUE.md` y no en el
código:** SSH en el puerto 5807 (`ssh -p 5807`, `scp -P 5807`, o el alias
`anaporcelana` de `~/.ssh/config`), el firewall del panel de DonWeb con
80, 443 y 5807 (y `ufw` adentro con los mismos tres), `sudo` pide
contraseña, y el crontab de `ana` con tres tareas: `clearsessions` los
lunes, y los respaldos diarios de la base (`base-FECHA.sql`, 30 días) y
de las fotos (`media-FECHA.tar.gz`, 7 días) en `/home/ana/respaldos`. La
renovación del certificado es del `certbot.timer`, no de cron.


---



## Diseño visual — cerrado, no cambiar

Estilos en línea en React. `index.css` tiene dos cosas y nada más: los
hovers, con `!important` porque los estilos en línea tienen máxima
especificidad, y las reglas de pantalla chica de la sección Responsive.

| Uso | Color |
|---|---|
| Rosa viejo profundo — barra lateral, botones principales, títulos | `#8C5A66` |
| Rosa viejo medio — acentos, elementos activos | `#B08791` |
| Rosa muy claro — encabezados de tabla de los listados, fondos suaves | `#F0E2E4` |
| Fondo general | `#FAF7F7` |
| Tarjetas, tablas, modales | `#FFFFFF` |
| Texto principal | `#3D3238` |
| Texto secundario | `#857078` |
| Bordes | `#EBE0E2` |

Estados:

| Estado | Texto | Fondo |
|---|---|---|
| Positivo (activo, disponible, alta) | `#4E8C6A` | `#E8F5EF` |
| Intermedio (en proceso, media) | `#D9A441` | `#FDF3E0` |
| Negativo (baja, agotado, error) | `#C0442F` | `#FAEAE8` |

**Tipografías:** Quicksand 600 para títulos y etiquetas destacadas,
Nunito Sans 400 para texto y tablas. Cargadas desde Google Fonts en
`index.html`. **Prohibidas las serif.**

**Estilo:** bordes de 1px sin sombras marcadas, radios de 6 a 10px,
mucho espacio en blanco.

**Patrón de listado:** título + botón de alta a la derecha → barra de
herramientas → tabla o grilla → sección colapsable de dados de baja al
final. **En la barra, Filtros va pegado al buscador** y lo demás a la
derecha (pedido de la usuaria, para no mezclar filtrar con exportar): la
vista grilla/lista y PDF/Excel van en una caja `acciones-derecha` con
`marginLeft: 'auto'`. En Productos el orden es buscador, Ordenar y
Filtros, y su buscador mide 320 y no 420 para que la barra entre en una
notebook de 1366. **Todo lo de esa barra mide 40px de alto** (buscador,
Filtros, Ordenar, la vista, PDF y Excel), el alto del buscador: así
Filtros no crece cuando aparece su globito.

**Encabezados de tabla en rosa oscuro, en los listados y en las
tarjetas** (pedido de la usuaria: los grises se perdían con el fondo y se
mezclaban con los campos). En un listado la franja del `thead` es
`#8C5A66`, el color de la barra lateral, con los títulos de columna en
blanco (y el hover de las columnas que ordenan, `.th-orden`, es un velo
blanco). Se probaron y descartaron el rosa del ítem seleccionado de la
barra (`#A37B85`) y el blanco al 75% de sus textos. Cuando la tabla vive
dentro de una tarjeta con su propio título (Datos y Productos del pedido,
Datos y Materiales del gasto, los tres paneles de Inicio), el título va
en `EncabezadoDeTarjeta` (`componentes/`): una franja `#8C5A66` con el
título en blanco a 17px, `nota` opcional al lado y lo que va a la derecha
como `children`; la tarjeta lleva `overflow: 'hidden'` para que la franja
tome las esquinas. Debajo, los títulos de columna van en gris `#857078`
sobre blanco con una línea `#F0E2E4` de 2px, y el total de la tabla lleva
la misma línea arriba, sin fondo. Las tablas de Finanzas, los modales Ver
de pedido y de gasto y los encabezados del acordeón de la ficha de
producto quedan como estaban (decidido por la usuaria).

**El aviso de disponibilidad baja de Materiales muestra cuatro filas**
(`AvisoReponer`, pedido de la usuaria): de la quinta en adelante se ven
deslizando dentro del aviso, que así no empuja la tabla hacia abajo. Para
que entren cuatro justas las filas miden siempre lo mismo
(`FILAS_VISIBLES = 4`, `ALTO_FILA = 58`) y la caja de las filas tiene
`maxHeight` de cuatro filas con `overflowY: 'auto'`; el título queda fijo
arriba. **El título es un botón que esconde y muestra las filas**, con una
flechita a la derecha que gira; arranca abierto y no se recuerda al salir
de la pantalla.

**Las tres listas de Inicio van paginadas desde el backend** (pedido de la
usuaria, para no tener que deslizar dentro de cada panel; reemplaza al
scroll que se había elegido para D2): PRODUCTOS EN ELABORACIÓN (antes EN
PRODUCCIÓN, renombrada por la usuaria, que además evita confundirla con
el estado En producción del pedido) y PRÓXIMAS ENTREGAS de a 8, y
MATERIALES POR REPONER de a 6 (`FILAS_EN_PRODUCCION`, `FILAS_ENTREGAS`,
`FILAS_MATERIALES`). Cada lista tiene su endpoint, con un paginador hecho
a mano (`una_pagina`, `PaginacionDeInicio`, `PaginacionDeMateriales`):
`GET /api/inicio/en_produccion/` (con `?etapa=`),
`/api/inicio/entregas/` y `/api/inicio/materiales/`. `GET /api/inicio/`
quedó para el resumen (las tarjetas de arriba, con la deuda sumada en la
base sobre `saldo_calculado`, y los totales y la cantidad por etapa de
las listas). Cada panel tiene su `PieDePaginas` y su página en el estado;
una página con menos filas se dibuja más chica, sin relleno (pedido de la
usuaria). El pie "Ver todos … (N …)" sigue llevando al módulo.

**PRODUCTOS EN ELABORACIÓN se filtra por etapa** (la otra mitad de D2).
Entre el título y la tabla, `FiltroEtapas` dibuja Todas y un chip por
etapa salvo Terminado, cada uno con cuántas piezas tiene (`por_etapa` del
resumen); se elige una a la vez y se pide al backend con `?etapa=`, desde
la página 1. Si la etapa elegida se queda sin piezas, la tabla dice
"Ninguna pieza en …" en vez del vacío del taller. Los chips son
`ChipFiltro`, que salió de `Clientes.jsx` a `componentes/` al tener este
segundo uso. PRÓXIMAS ENTREGAS ya no muestra "Cobrar al entregar" debajo
del estado (pedido de la usuaria; diferencia con el prototipo). **Cada
cambio de etapa avisa** con el aviso flotante: "Aros de Luna pasó a
Secado", y Terminado, con Deshacer, como siempre.

**El aviso flotante (`Toast`) va en el medio de la pantalla** (pedido de
la usuaria: quería algo más grande que un toast, más verde y que se fuera
solo). Es una tarjeta verde claro con borde verde, un círculo verde con
el tilde blanco y el texto en verde a 16; no oscurece el fondo ni frena
nada. Entra con un saltito y el tilde se dibuja solo, con
`element.animate()`, la API de animaciones del navegador (sin estado de
React ni `index.css`); se vuelve a animar con cada texto nuevo. Dura
1,4 segundos (cada pantalla tiene su temporizador en `mostrarToast`); el
de copiar el email y el de "Cobro registrado", 0,93; el de Terminado con
Deshacer, 3. Lo usan las pantallas de la gestión; el catálogo tiene el
suyo, `ToastCatalogo`.

**Patrón de modal:** cabecera `#8C5A66` con título blanco y cruz, cuerpo
con campos apilados, pie con Cancelar y la acción principal. Fondo
oscurecido que cierra al hacer clic, con `e.stopPropagation()` en la
tarjeta. **La excepción es `ModalAviso`**, que avisa algo que ya pasó y
lleva una franja verde (o roja) con un círculo en lugar de la cabecera
rosa (ver "Cuatro componentes compartidos" en Las altas).

**Botones de acción:** cuadrados de 36px con icono. Ver (ojo,
`#8C5A66`), Editar (lápiz, `#8C5A66`), Copiar (dos hojas superpuestas,
`#8C5A66`), Cobros (signo $ en un círculo, `#8C5A66`), Comprobante
(hoja con la punta doblada, `#8C5A66`), Compartir (tres círculos unidos,
`#8C5A66`), Dar de baja (prohibido, `#D9A441`), Reactivar
(tilde, `#4E8C6A`), Eliminar (papelera, `#C0442F`), Más acciones (tres
puntos, `#8C5A66`).

**En el celular, el comprobante se comparte** (corrección del tutor,
E11). El botón de comprobante de cada cobro, en `ModalCobros`, pasa a
ser Compartir: mismo lugar, el ícono de compartir y el title "Compartir
comprobante". En el ⋯ del listado de Pedidos, "Último comprobante" pasa
a "Compartir último comprobante". No se agrega un botón: se reemplaza,
para que la fila no se recargue en pantalla chica. **Por qué:** en el
teléfono lo que se hace con el comprobante es mandárselo al cliente, y
abrirlo en otra pestaña obligaba a descargarlo y adjuntarlo a mano; así
abre el menú de compartir del teléfono (WhatsApp, Instagram) con el PDF.
**La condición** son las dos cosas: pantalla chica (una línea con
`window.matchMedia('(max-width: 768px)')`, en `ModalCobros` y en
`Acciones` de `Pedidos.jsx`) y un navegador que comparta archivos
(`puedeCompartirArchivos()`, en `api/exportar.js`, que le pregunta a
`navigator.canShare` por un PDF vacío). Si falta una, en la compu o en un
celular cuyo navegador no comparte, se ve el comprobante como siempre.
Compartir pide el PDF con `cliente` como blob
(`pedirComprobanteDeCobro`, el mismo endpoint), arma un `File` con el
nombre que manda el backend (`comprobante-pedido-<id>-cobro-<cobro>.pdf`)
y llama a `navigator.share`, todo en `compartirArchivo`. Si la usuaria
cierra el menú sin elegir (`AbortError`) no se avisa nada; un error de
verdad abre el `ModalAviso` rojo "No se pudo compartir". No hay
reintento: si un navegador rechaza compartir porque bajar el PDF tardó
(pasa en algunos iPhone, que piden que compartir salga del toque), sale
ese mismo aviso (decidido por la usuaria). Se probó en Chrome sin
ventana con el menú de compartir simulado; la prueba en un celular real
necesita el despliegue.

**Cuatro iconos por fila, como máximo** (corrección del tutor del
28/10/2026, A1). Si una fila tiene más acciones, las menos usadas van en
el ⋯ de `MenuMasAcciones`, con icono y texto. Hoy solo lo usa Pedidos;
Productos (ojo, lápiz, dar de baja, papelera) y Gastos (ojo, lápiz,
papelera) entran sin él.

**Lápiz donde se puede modificar, ojo donde solo se mira.** La acción que
abre una ficha editable se llama "Editar" (antes "Ver y editar"; desde
que existe el ojo, ver es otra acción) y lleva el lápiz: en los
listados de Productos (grilla, tabla y el bloque "Baja por su categoría",
cuyos productos están activos), Pedidos y Gastos. El ojo queda para lo
que se abre en solo lectura: los modales Ver de Materiales, Clientes,
Gastos, Productos y Pedidos. El $ de Cobros no son los billetes de Gastos
a propósito: cobrar es plata que entra y gastar, plata que sale.

En Productos (corrección del tutor del 28/10/2026, A1) un producto activo
lleva ojo, lápiz, dar de baja y papelera, en la grilla y en la tabla
(`accionesDe`): son cuatro y entran sin ⋯. El ojo abre
`ModalVerProducto`, que pide la ficha al abrirse (el listado no trae
todas las fotos) con los tres estados adentro, y muestra precio,
dificultad, catálogo, descripción, paso a paso, las fotos de cada grupo y
las categorías; su Editar lleva a la ficha y no aparece en un producto de
baja. La foto y el nombre siguen abriendo la ficha (`onEditar`). En la
sección de bajas, el ojo de un producto de baja abre el mismo modal y no
la ficha, así que su ficha, de solo lectura, ya no se abre desde ninguna
pantalla.


- El vocabulario sale de mis casos de uso, no de sinónimos. Los materiales de
  un producto son "los materiales del producto", nunca "la receta".

  - Antes de crear un estilo, una clase o un componente nuevo, revisá si ya
  existe uno equivalente en otro módulo y reusalo. Las pantallas nuevas
  tienen que sentirse iguales a las que ya están, no más elaboradas.

**El filtrado y la paginación los hace el backend** desde D3 (ver
Listados en el backend). Antes eran locales, sobre la lista entera.

**Al escribir el catálogo público**, revisar que su serializer NO
herede de ProductoListaSerializer ni de ProductoDetalleSerializer:
esos exponen los ids de materiales, y la composición no va al catálogo.


---



## Listados en el backend (corrección D3)

El tutor pidió filtrar y paginar en el backend, y la usuaria lo resumió
así: "el objetivo es que la página NO DEMORE". Cada listado pide solo la
página que se mira, con los filtros, la búsqueda y el orden resueltos en
la base.

**La paginación es opcional: `PaginacionDeListado`**, en
`config/paginacion.py`. Pagina solo si viene `?pagina=` (de a 12; con
`?por_pagina=` hasta 48) y devuelve `count` y `results`. Sin `?pagina=`
devuelve la lista entera, como antes: así la siguen pidiendo los
desplegables (clientes de un pedido, materiales de un producto o de un
gasto, productos de un pedido) y el alta de producto, que revisa que el
nombre no exista.

**Cada ViewSet filtra en su `_filtrar()`**, llamado desde `get_queryset()`
cuando la acción es `list` (o `exportar`). Reemplaza al `SearchFilter` y
al `OrderingFilter` de DRF, que no sabían filtrar por saldo, entrega o
total, y los ViewSets ya no declaran `search_fields`. Lo que se repite
está en `config/listados.py`: `leer_importe`, `leer_fecha` y
`ordenar(queryset, parametros, ORDENES, desempate)`, con `?orden=campo` u
`?orden=-campo` sobre una lista cerrada `ORDENES` por ViewSet (de menor a
mayor los vacíos van al final; al revés, al principio). Un valor que no
se entiende responde 400 con `detail` (`ParseError`): un filtro mal
escrito que no filtra mostraría una lista que parece correcta y no lo es.

**Lo que antes sumaba el navegador ahora lo suma la base**, con
subconsultas, y cada cuenta tiene una prueba que la compara con la
propiedad de Python: `Pedido.objects.con_totales()` (`total_calculado`,
`cobrado_calculado`, `saldo_calculado`, `cantidad_productos_calculada`) y
`clientes_con_cuentas()` (pedidos, pedidos en curso, último y saldo).
`condicion_de_entrega()`, en `pedidos/views.py`, es la regla de atrasados
y próximos de Inicio escrita para un `.filter()`.

**Los números de arriba de cada listado salen de `/resumen/`**, porque la
pantalla ya no tiene la lista entera para contarlos: pedidos (activos,
atrasados, con saldo y el total más alto), clientes (total y los dos
chips) y productos (activos, de baja, baja por categoría, visibles y el
rango de precios) cuentan sobre todos; gastos suma lo filtrado, como su
línea de resumen.

**Lo propio de cada listado:** Productos aplica la regla de la sección de
bajas solo con `?estado=` (la grilla pide `ACTIVO`; la sección, que se
pide recién al abrirla, `BAJA`, sin filtros). Materiales pide dos listas,
los activos paginados y los discontinuados enteros para su sección, con
los mismos filtros. Pedidos pide los clientes del filtro recién al abrir
el modal. Categorías busca en el backend con `?busqueda=` y no pagina. El
catálogo va de a 20 con "Cargar más" (ver Catálogo público).

**El patrón de las pantallas.** `parametrosDelListado(...)`, en el
`filtros.js` de cada módulo, traduce los filtros a un `URLSearchParams`
(porque estado, tipo y categoría se repiten). El buscador espera 300 ms
después de la última tecla (`busqueda` → `busquedaEnviada`) y vuelve a
la página 1. El efecto que pide la página lleva la bandera `vigente`, que
descarta una respuesta vieja si llega después de la nueva; un contador
`version` fuerza el pedido después de un cambio; y una página que ya no
existe (se borró el último registro de la última) responde 404 y se
vuelve a la anterior. `Paginacion` muestra "Filas por página" solo si
recibe `onPorPagina`.



## Exportar a PDF y Excel (corrección E10)

Materiales, Productos, Pedidos y Gastos exportan lo que el listado tiene
filtrado y buscado, en su orden y sin paginar; sin filtros, todo,
incluidos los de baja y los discontinuados, con su columna de estado.
Finanzas exporta el período (ver Módulo Finanzas). Clientes y Categorías
no exportan: no estaban en el pedido.

**El backend está escrito una vez, en `config/exportar.py`.** Cada
ViewSet hereda `ExportarMixin`, que suma la acción
`GET /api/<listado>/exportar/?formato=pdf|excel&<los filtros>`, y declara
solo lo suyo: `EXPORTAR_TITULO`, `EXPORTAR_ARCHIVO`, `EXPORTAR_UNIDAD`
(singular y plural), `COLUMNAS_PARA_EXPORTAR` (una lista de
`Columna(titulo, valor, tipo, ancho)`: `valor` es una función del
registro; `tipo`, `texto`, `plata`, `fecha`, `mes` o `numero`; `ancho`,
su parte del ancho del PDF, y por 1,6 los caracteres en el Excel) y
`describir_filtros(parametros)`, que pasa los filtros de la URL a
palabras con los textos de los chips de la pantalla.
`get_queryset()` incluye `'exportar'` junto a `'list'`, y la acción toma
`filter_queryset(get_queryset())` sin paginar, lo mismo que el `list()`
de DRF; Materiales y Productos sobrescriben `registros_para_exportar()`
para poner primero lo de arriba de la pantalla (activos; la grilla) y
después lo de su sección de abajo, con `sorted()`, que no cambia el orden
elegido dentro de cada grupo. `describir_rango(nombre, desde, hasta,
escribir=plata)` arma "Total: $5.000 – $90.000", "desde" o "hasta", y con
`escribir_fecha` sirve para un período.

**Las piezas**, para que Finanzas arme varias tablas con las mismas:
`encabezado_pdf`, `tabla_pdf` (títulos en rosa claro que se repiten en
cada hoja, pegada al margen izquierdo), `construir_pdf` (A4 apaisada; pie
en cada hoja con los filtros o el período a la izquierda, la fecha en el
medio y la página a la derecha; los márgenes descuentan el relleno de
`SimpleDocTemplate`, como en el comprobante, para que textos y tablas
queden alineados), y en Excel `escribir_encabezado_excel`,
`escribir_tabla_excel`, `ajustar_anchos_excel` y `guardar_excel`.
`armar_pdf` y `armar_excel` las juntan para un listado. En el Excel cada
fila se escribe por su número (preguntar por `max_row` daba una fila
menos y los títulos quedaban fuera de la fila pintada y fija); los
títulos van en la fila 5 y lo de arriba queda fijo. Los importes y las
fechas van como números y fechas, y **los textos siempre como texto**
(`data_type = 's'`): un nombre cargado como "=1+1" no se toma como
fórmula. Los importes negativos se escriben "-$484.970".

**El PDF se abre en otra pestaña (`inline`) y el Excel se descarga
(`attachment`)**, con el nombre `<listado>-AAAA-MM-DD`. En el frontend,
`BotonesExportar({ urlPdf, pedirExcel, deshabilitado, motivo })`, en
`componentes/`: PDF en rojo y Excel en verde, con borde y el estilo de
Filtros. El PDF se abre con `window.open`, como el comprobante. El Excel
se pide con `cliente` (`responseType: 'blob'`), así un 403 lo atrapa el
interceptor y un 400 no saca a la pestaña de la aplicación: se guarda con
una dirección temporal (`URL.createObjectURL`) y un `<a download>`, con el
nombre que manda el backend, y un error se muestra en el `ModalAviso`
rojo del propio componente. Los dos se apagan sin resultados, con el
motivo en el title, y el Excel también mientras descarga.
`api/exportar.js` tiene `urlDeExportacionPdf(ruta, parametros)` y
`pedirExportacionExcel(ruta, parametros)`; cada `api.js` suma dos
funciones de una línea. Productos pregunta cuántos irían al archivo con
una página de una fila, porque sin filtro de estado se suman los de la
sección de bajas y `total` no alcanza.

**openpyxl** (3.1.5, con `et_xmlfile` 2.0.0) está en `requirements.txt`;
`pip-audit -r requirements.txt` dio sin vulnerabilidades conocidas. En el
servidor hay que reconstruir la imagen del backend. `config/exportar.py`
importa `plata()` de `pedidos/presentacion.py`, la misma del comprobante.


---



## Responsive

La gestión se diseñó para escritorio y se adaptó al final, en pasos y sin
rediseñar ninguna pantalla, primero a pantalla chica y después a monitor
grande. El catálogo público no entra acá: se diseña directamente para
celular.

**La técnica: los estilos siguen siendo objetos en línea, y en los otros
anchos se pisan desde `src/index.css`.** Cada elemento que cambia lleva una
clase, y una media query (`max-width: 768px` para pantalla chica,
`min-width: 1440px` para pantalla grande) escribe solo las propiedades que
cambian. El `!important` va únicamente sobre las
propiedades que ya están en línea y cambian, porque un estilo en línea le
gana a cualquier regla de la hoja; las que no están en línea (`flex-wrap`,
`overflow-x`, `position`) van sin él. Nada se reescribe de línea a CSS.
Cuando la clase está en un contenedor y hay que tocar un hijo que no tiene
clase (el `h1` del encabezado, los botones de un pie), se usa un selector
por descendencia, `.encabezado-pantalla h1`, y en cada caso hay un solo
hijo de ese tipo. Lo que React decide dibujar o no (la franja superior, el
fondo oscuro del menú) va por condicional en JSX y no por `display: none`:
en escritorio esos elementos no existen.

**Dos puntos de corte, cada uno con su evidencia.** El primero es
`(max-width: 768px)`: de ahí para abajo la gestión es un celular, o una
tablet vertical que funciona como un celular ancho. El segundo es
`(min-width: 1440px)`: de ahí para arriba es un monitor grande, y las
fichas, que en escritorio normal miden `ANCHO_MAXIMO` (1140, en
`src/constantes.js`), se estiran a 1400. Entre los dos está el escritorio
normal, notebook o tablet apaisada, que es para lo que se diseñó todo y
no lleva ninguna regla. Cada número está en los lugares que tienen que
coincidir: el 768 en `index.css`, en `PANTALLA_CHICA` de `Layout.jsx` y,
desde E11, en la línea que decide si el comprobante se comparte, en
`ModalCobros.jsx` y en `Acciones` de `Pedidos.jsx`; el
1440 en `index.css` y en `PANTALLA_GRANDE` de `DetalleProducto.jsx`. React
decide qué dibujar y CSS cómo se ve: si los dos números difieren, hay un
rango de anchos donde uno cree estar de un lado y el otro del otro.
Ninguno se agregó por las dudas: el 768 salió de probar en el celular, y
el 1440 de ver 500px vacíos a la derecha en un monitor de 1920.

**Un tercer punto de corte se agregaría solo con la misma evidencia:** un
ancho donde lo que hay no sirve y que ninguno de los dos lados arregla.
Nunca por pantalla: el corte es del sistema.

**La barra lateral en pantalla chica es un panel que se desliza desde la
izquierda.** En `Layout.jsx`, `usePantallaChica` es un hook (empieza con
`use` porque React y su linter reconocen los hooks por ese prefijo, como
`useAuth`) que escucha el evento `change` de `matchMedia` y devuelve si la
pantalla es chica. El estado `menuAbierto` abre y cierra el panel, y lo que
se dibuja es `panelAbierto = pantallaChica && menuAbierto`: si la ventana
pasa a escritorio con el menú abierto, el estado queda en `true` pero no
se ve nada, y al volver reaparece como se lo dejó. En pantalla chica hay
una franja superior de 48px con el ☰ y el nombre del sistema (salvo en
Inicio, cuyo título ya lo dice); el `aside` se dibuja siempre expandido, y
lo que lo muestra u oculta es un `transform` en CSS, con las clases
`barra-lateral` y `abierta`. El panel se cierra al elegir una opción, al
tocar el fondo oscuro o con Escape. El alto del Layout es `100dvh` y no
`100vh`, porque `vh` no descuenta la barra del navegador del celular.
`usePantallaGrande`, en `DetalleProducto.jsx`, es el mismo mecanismo con
la consulta de 1440: decide si existe el panel con la imagen y el resumen
del producto, que solo se dibuja en pantalla grande.

**Capas (`z-index`):** fondo oscuro del menú 90, barra lateral 91, la
capa invisible del ⋯ 92 y su lista 93, modales 100 y 110, Toast 120. El panel queda debajo de cualquier modal:
un modal abierto sigue tapando todo, como en escritorio.

**Las tablas siguen un solo patrón:** caja blanca con `overflowX: 'auto'`
y tabla con `width: '100%'`, `minWidth` en píxeles y
`tableLayout: 'fixed'` con anchos de columna en porcentaje. En escritorio
la tabla es más ancha que el mínimo y no cambia nada; en pantalla chica la
caja se desliza de lado. `overflowX: 'auto'` recorta las esquinas
redondeadas igual que `hidden`. Materiales y la lista de Productos son la
excepción a `fixed`: no tienen anchos por columna y ponérselos sería
inventarlos, así que quedan en `auto` con su `minWidth`.

**Cuando un chip no entra en su columna, se ajusta el porcentaje de la
columna; no se vuelve a subir el mínimo en celular.** El problema es del
ancho de la columna y aparece también en escritorio con ventana angosta,
como la tablet apaisada, así que una regla solo para celular no lo
arregla: así SALDO de Pedidos pasó de 13% a 16%. Para calcular hay que
saber que un chip centrado que no entra no se reparte a los dos lados:
arranca en el borde izquierdo del contenido y se pasa por el derecho, así
que entra si mide menos que el contenido de la celda más su padding
derecho. La única excepción es la tabla de entregas de Inicio, cuyo mínimo
de 640 era demasiado bajo por sí mismo y sube a 720 en pantalla chica.

**Las clases de `index.css` para pantalla chica son estas y solo estas.**
Antes de crear una, revisá la lista; cada una vive en el elemento que
dice.

- `barra-lateral` y `abierta`: el `aside` del Layout; fijo y deslizado
  fuera de pantalla, `abierta` lo trae.
- `contenido`: el `main`; padding 16 en vez de 32.
- `encabezado-pantalla`: el div del título y el botón de alta de los seis
  listados, y el del título y PDF/Excel de Finanzas; se apila, el título
  baja a 26px y el botón ocupa todo el ancho.
- `barra-herramientas` y `buscador`: el contenedor buscador + Filtros y el
  div del buscador; la barra se parte y el buscador ocupa su fila entera.
- `boton-filtros`: el botón Filtros de Materiales, Productos, Pedidos y
  Gastos; crece hasta llenar su fila.
- `orden-listado`: el desplegable Ordenar de Productos; comparte el
  renglón con Filtros, por mitades. Lleva `min-width: 0` porque un select,
  por defecto, no se achica por debajo de su opción más larga.
- `acciones-derecha`: la caja de la derecha de la barra (la vista y
  PDF/Excel) en Materiales, Productos, Pedidos y Gastos; baja a un renglón
  propio, a todo el ancho.
- `botones-exportar`: la caja de PDF y Excel de `BotonesExportar`; ella y
  sus dos botones se estiran hasta llenar el renglón.
- `fila-pestanas`: la `BarraDePasos` del alta de producto (la ficha ya no
  tiene pestañas: es un acordeón); se desliza de lado, con los pasos sin
  partirse y menos padding.
- `modal-fondo` y `modal-caja`: el fondo oscuro y la caja de los 31
  modales (`ModalConfirmar` y `ModalAviso` cuentan uno cada uno, aunque
  se dibujen en varios lugares); 8px de aire y hasta 96vh de alto.
- `campos-dos-columnas`: los grids de dos campos de ModalCobro,
  ModalAgregarProducto y ModalEditarProductoDelPedido, la grilla
  Descripción / Paso a paso de PestanaDatos de producto y las dos columnas
  de "Agregar a una categoría" de PestanaCategorias; una columna. En
  PestanaDatos los dos campos son subgrillas (`gridTemplateRows:
  'subgrid'`), así las cajas arrancan a la misma altura aunque una
  etiqueta se parta; en PestanaCategorias la línea del medio es un
  elemento de la grilla, que con una columna queda horizontal.
- `paneles-finanzas` y `cobros-dos-columnas`: la grilla INGRESOS / GASTOS
  de Finanzas y la grilla lista + resumen de `PestanaCobros` (en
  `ModalCobros`); una columna.
- `fila-fechas`: la fila Desde / Hasta del período Personalizado de
  Finanzas; se parte, sin margen, con cada fecha en su renglón.
- `acciones-materiales`: los dos botones de la cabecera de materiales de
  un gasto; uno debajo del otro, a todo el ancho.
- `acciones-encabezado`: el enlace "Ver catálogo" y el botón de alta del
  encabezado de Productos; uno debajo del otro, a todo el ancho.
- `accesos-rapidos`: los cuatro accesos rápidos de Inicio; de a dos por
  fila, por mitades, y uno por fila si ni dos entran.
- `fila-producto-baja` y `fila-categoria-baja`: las filas de la sección de
  bajas de Productos; dos y tres renglones.
- `chips-filtro`: los dos chips de Clientes; se parten, a la izquierda
  (los de etapa de Inicio ya se parten solos, con `flexWrap` en línea).
- `toast`: el aviso flotante; hasta 16px de cada borde, centrado.
- `pie-filtros`: el pie de los cuatro modales de filtros; contador arriba
  y los dos botones abajo por mitades.
- `tabla-entregas`: la tabla de entregas de Inicio; mínimo 720.
- `tipo-cobro`: el div de TIPO en ModalCobro; sus opciones miden según su
  texto en vez de en tercios.
- `ancho-pantalla`: todo elemento con `maxWidth: ANCHO_MAXIMO`; de 1440
  para arriba mide 1400.
- `datos-producto`: el contenedor de la sección Datos de la ficha de
  producto; de 1440
  para arriba, dos columnas (formulario y panel con la imagen). El panel
  mide lo que el formulario: lleva `contain: 'size'`, así no cuenta para
  el alto de la fila, y la grilla lo estira (`stretch`). La foto ocupa el
  alto que deja el resumen de abajo, a todo el ancho y recortada con
  `cover`. Es la que quedó de tres versiones probadas: las otras eran la
  foto cuadrada más chica y hacer crecer las cajas de texto.

Los hovers siguen en el mismo archivo, fuera de las media queries, con
sus propias clases (`nav-item`, `btn-accion`, `btn-reponer`, etc.).

**Verificado en la emulación de Chrome:** Galaxy S23+ (384px), Galaxy Tab
S10 FE vertical (720px) y apaisada (1152px), y un monitor de 1920px,
además del escritorio.
Las medidas de texto con las que se calcularon mínimos y porcentajes son
estimaciones, porque Quicksand no está instalada en la máquina: la
verificación que vale es la del navegador.