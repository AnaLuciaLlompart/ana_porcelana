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

**Backend** (puerto 8000): Django 5.2 LTS + DRF + PostgreSQL 17 + Pillow
**Frontend** (puerto 5173): React 19 + Vite + React Router + Axios

Arquitectura desacoplada. El servidor de Vite hace de proxy inverso:
reenvía `/api` y `/media` al 8000, así el navegador ve un solo origen.
Por eso en Axios `baseURL` es `/api`, una ruta relativa.

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

---

## Estructura

Cada app de Django agrupa una funcionalidad completa (modelo, serializer,
ViewSet, urls). El backend **no** lleva carpeta `funcionalidades`: la app
de Django ya es esa unidad.

En el frontend, carpetas por funcionalidad dentro de
`src/funcionalidades/`. Lo que usa más de una funcionalidad queda
afuera: `api/cliente.js`, `contexto/AuthContext.jsx`,
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

**Frontend**: `api.js` con una función exportada por endpoint,
importando `cliente` → pantalla con el patrón de tres estados
(cargando / error / datos) → modales → una línea en `rutas.jsx`.

En las pantallas: derivados calculados con `.filter()` y nunca
guardados en estado, objeto `acciones` que se expande con
`{...acciones}`, y una función `cambiarEstado(entidad, accion)` que
recibe la función de la API como argumento.

**Debounce solo cuando el buscador consulta al servidor**, con 300 ms,
como en Materiales. Si el filtrado es local sobre datos ya cargados no
lleva debounce, como en Categorías y Productos.

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
igual que `ModalMaterial`, `ModalVerMaterial` y `ModalEliminarMaterial`.
El modal de ver reusa los mismos campos del formulario en
`readOnly disabled`, con el placeholder cambiado a "Sin cargar".

**El módulo está completo.** Las columnas PEDIDOS, ÚLTIMO y SALDO con
su ordenamiento, los dos chips de filtro, la línea de resumen, el
recuento y el chip de saldo del modal Ver, y la rama bloqueada del modal
Eliminar. La tabla ordena por ÚLTIMO descendente, como el prototipo.

**El único aviso flotante del módulo es el de copiar el usuario.** Las
otras acciones ya se confirman solas: se cierra el modal y la fila
aparece, cambia o desaparece de la tabla. Copiar al portapapeles es la
única acción sin efecto visible.

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

La bajada automática se avisa con un cartel flotante en la ficha, porque
es un cambio que la usuaria no pidió. Es la excepción al criterio de
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

**`costo_entrega` solo se habilita cuando el envío es a cargo mío.** La
coherencia se valida en la aplicación, no en el modelo.

**No hay restricción de unicidad sobre (pedido, producto).** El mismo
producto puede figurar en dos filas del mismo pedido si difieren en
variante, precio o etapa productiva. `cantidad` agrupa únicamente
unidades iguales.

**El precio se congela** al registrar el producto del pedido.

**Cada producto del pedido enlaza a `/materiales?producto=X`**, que ya
está implementado en Materiales. El enlace no aparece si el producto no
tiene materiales cargados.

**Los cobros (CU48–CU51) viven en la app `pedidos`**, como los productos
del pedido: un cobro siempre cuelga de un pedido y no tiene pantalla
propia. De ahí salen el saldo, la columna SALDO de los dos listados y
los chips.

**No se puede cobrar más que el total del pedido**, y **una seña no
puede dejar el pedido saldado**: el cobro que termina de pagar es el
pago restante o el pago completo. Las dos reglas las revisa el ViewSet
al registrar y al modificar, porque son reglas entre filas y no de una
fila sola.

El saldo todavía puede quedar negativo por otro camino: bajarle el total
a un pedido ya cobrado, que se permite para poder corregir una carga mal
hecha. Por eso el chip conserva su tercera cara, "A favor $X".

**El comprobante en PDF queda fuera.**


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

**`search_fields` incluye `materiales__material__nombre`:** el buscador
del prototipo dice "descripción, tipo o material". El filtrado real es
local en el navegador, como en todos los módulos.

### El frontend de Gastos

En `funcionalidades/gastos/`: `Gastos.jsx` es el listado y
`DetalleGasto.jsx` la ficha, con `esAlta` como DetallePedido. Los
acompañan `ModalFiltros.jsx`, `ModalMaterial.jsx`,
`ModalEliminarGasto.jsx`, `filtros.js`, `presentacion.js` y `api.js`.

**El resumen del listado cuenta sobre lo FILTRADO**, al revés que Pedidos
y Clientes. Allá el resumen dice cómo viene el trabajo; acá dice cuánto
suma lo que se está mirando, porque filtrar por período o por tipo es
justamente la forma de preguntar cuánto se gastó.

**El tope del deslizador de monto sale de los datos.** `montoMaximo`, en
`filtros.js`, toma el gasto más caro y lo redondea hacia arriba a mil, con
el criterio de `rangoDePrecios` en Productos. El piso queda fijo en 0. El
$120.000 del prototipo era de relleno: un tope fijo envejece el día que se
carga un gasto más caro. Los filtros aplicados se muestran como en Pedidos,
con chips que llevan cruz y "Limpiar todo".

**`TIPOS` en `presentacion.js` es para ELEGIR un tipo, no para mostrarlo.**
Dibuja las opciones del modal de filtros, la etiqueta del chip aplicado y
los segmentos de la ficha, que tienen que existir aunque no haya ningún
gasto de ese tipo. Donde se muestra el tipo de un gasto va `tipo_display`.

**El alta crea el gasto primero: diferencia deliberada con el prototipo.**
El prototipo deja cargar materiales antes de crear el gasto y exige al
menos uno. Acá el gasto tiene que existir en la base antes de colgarle
materiales: el alta hace el POST y navega a `/gastos/<id>`, igual que
Pedidos. El "Agregá al menos un material…" del prototipo no es un error:
queda como leyenda bajo la tabla vacía.

**`setGasto` va antes de navegar en el alta, y no es prolijidad.**
`/gastos/nuevo` y `/gastos/:id` dibujan el mismo componente, así que React
Router no lo desmonta al pasar de una ruta a la otra: lo reutiliza con su
estado. Sin ese `setGasto`, la ficha mostraría un instante "No se encontró
el gasto" hasta que llegue el GET.

**La ficha no tiene pestañas**, porque el prototipo no las tiene: son dos
tarjetas apiladas y el botón de eliminar. En un gasto existente los botones
Descartar y Guardar aparecen recién cuando hay cambios; en el alta están
siempre Cancelar y "Crear gasto". Salir descarta sin preguntar.

**El monto de un gasto de materiales no se calcula en el navegador.** Se
muestra `gasto.monto` tal cual viene en cada respuesta, tanto en el campo
apagado de arriba como en el pie de la tabla. El único caso con $0 escrito
por el frontend es cuando se eligió Materiales pero el gasto todavía no se
guardó así: no hay materiales que sumar, y es lo que el backend va a
escribir al guardar.

**El tipo se bloquea en la ficha cuando el gasto GUARDADO es de
materiales.** Los otros dos segmentos van deshabilitados con un title que
lo explica, para no ofrecer un cambio que el backend va a rechazar. Se mira
el gasto guardado, no el borrador. La tabla de materiales aparece con esa
misma condición.

**`ModalMaterial` es un solo modal para agregar y editar**, distinguido
por prop como ModalCobro; al editar, el material queda bloqueado. Pero a
diferencia de ModalCobro llama él mismo a la API, como ModalCliente: es la
única forma de que el error del backend se vea adentro del modal con el
formulario todavía abierto. Al salir bien le entrega a la ficha el gasto
actualizado. El desplegable ofrece solo los materiales activos que todavía
no están en el gasto.

**Las operaciones sobre materiales devuelven el gasto completo**, y la
ficha lo reemplaza en estado sin volver a pedirlo. Quitar es inmediato,
sin modal de confirmación ni aviso, igual que quitar un producto del
pedido. Sus errores se muestran dentro de la tarjeta de materiales, no en
el formulario: el mismo criterio que `errorEstado` en Pedidos.

**El aviso con Deshacer.** Al marcar en disponibilidad Alta, si
`materiales_cambiados` viene vacío no hay aviso. Si no, el aviso lleva la
acción Deshacer y dura 6 segundos en vez de 2,6. La lista se guarda en un
ref y no en estado, porque no se dibuja. Deshacer llama a
`cambiarDisponibilidad(id, disponibilidad)`, que vive en
`materiales/api.js` y hace un PATCH con ese solo campo, una vez por
material, y después vuelve a pedir el gasto. `actualizarMaterial` no sirve
para esto: es un PUT con FormData que exige todos los campos.

**Los otros avisos de la ficha** son "Cambios guardados", "Material
agregado" y "Material actualizado", de 2,6 segundos y sin acción. Crear,
quitar y eliminar no avisan: su efecto se ve.

**Dos props opcionales en los componentes compartidos.** `Toast` recibe
`accion` y `onAccion`; sin ellas se dibuja igual. `BotonAccion` recibe
`deshabilitado`; la opacidad se escribe solo cuando está apagado, porque
un 1 fijo le ganaría a la regla de `index.css` que baja la opacidad al
pasar el mouse. `EncabezadoOrdenable` sigue siendo una copia local en cada
listado (Clientes, Pedidos, Materiales y Gastos).

### Las pruebas

No hay pruebas automatizadas en el proyecto: `backend/gastos/tests.py`
está vacío y los `tests.py` de las demás apps tienen solo la plantilla
de Django. Las pruebas del sistema son manuales y quedan documentadas
en el informe final de la tesis.


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
comentario), `serializers.py`, `views.py` y `urls.py`; no tiene
migraciones, admin ni tests.

**Tres endpoints, los tres GET y los tres con `AllowAny` explícito:**

```
GET /api/catalogo/productos/        CU63  los productos visibles, sin paginar
GET /api/catalogo/productos/<id>/   CU65  uno, con todas sus imágenes de resultado; 404 si no es visible
GET /api/catalogo/categorias/       CU64  las categorías activas, por tipo y nombre
```

Son vistas genéricas de DRF (`ListaDeProductosView` y
`ListaDeCategoriasView` sobre `ListAPIView`, `DetalleDeProductoView`
sobre `RetrieveAPIView`), las primeras del proyecto, con tres `path()` y
sin router: una clase por endpoint y nada más expuesto. No declaran
`filter_backends`, `search_fields` ni paginación, así que los parámetros
de la URL se ignoran: el filtrado es local en el navegador, como en toda
la aplicación. El 404 del detalle sale de buscar el producto DENTRO de
los visibles: uno de baja, personalizado o con una categoría de baja
responde lo mismo que uno que no existe.

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
de `BrowserRouter` porque le pondría el prefijo a todo el router, y el
catálogo lo comparte sin prefijo.

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
y el aviso flotante. Importa de la carpeta `catalogo` (`api`, `filtros`,
`seleccion`, `presentacion`, `ToastCatalogo`), al revés de lo habitual:
el layout es el que carga el catálogo, arma el árbol y guarda la
selección, pero esas piezas viven donde corresponde.

**Los productos y las categorías se cargan UNA vez, en el layout**, con
`Promise.all` de las dos funciones de `api.js`
(`listarProductosDelCatalogo`, `listarCategoriasDelCatalogo`) y el patrón
de tres estados. Las pantallas recién se dibujan con los datos y los
leen con `useOutletContext()`: `{ productos, grupos, esEscritorio,
seleccion, mostrarAviso }`. El detalle es la única que pide algo más
(`obtenerProductoDelCatalogo(id)`), porque la lista no trae todas las
fotos. Un visitante hace dos pedidos al entrar y uno por cada detalle;
cambiar filtros, armar la selección o abrir las páginas de texto no pide
nada.

**Los filtros viven en la URL: `/?categoria=3&categoria=7`**, un
parámetro por categoría elegida, leído y escrito con `useSearchParams`,
así una dirección filtrada se copia, se abre en otra pestaña y sobrevive
a recargar. **El orden también: `?orden=precio-desc`**, uno de los
cuatro valores de `ORDENES`; si falta o trae otra cosa vale
`ORDEN_POR_DEFECTO` (`nombre-asc`), que no se escribe. El orden se
aplica siempre en el navegador, también el de por defecto, para que A–Z
y Z–A sean espejo exacto aunque la base ordene con otra intercalación.
Las funciones están en `filtros.js`: `agruparCategorias`
(los dos grupos, tipo de accesorio y después temática, cada categoría con su cantidad
contada sobre la lista completa; las que no tienen productos no salen, y
el título del grupo es el `tipo_display` del backend), `leerFiltros`
(solo los ids que existen entre las categorías que se muestran: un id
viejo o mal escrito no filtra ni se cuenta), `escribirFiltros`,
`alternarFiltro`, `filtrarProductos` (**O dentro de un grupo, Y entre
grupos**: con Aros, Dijes y Harry Potter quedan los aros y los dijes que
sean de Harry Potter), `ordenarCategorias`, `leerOrden`, `escribirOrden`
y `ordenarProductos` (copia y ordena con `localeCompare(…, 'es')` o con
`Number(precio_actual)`). Las casillas y el desplegable de orden escriben
con `replace: true`, para que tildar tres filtros no deje tres pasos en
el historial, y cada escritura lleva filtros y orden juntos, porque
`setSearchParams` reemplaza todos los parámetros; elegir desde el árbol,
el pie o un chip del detalle navega a `/?categoria=<id>`, una sola.
"Volver al catálogo" conserva los filtros y el orden porque la tarjeta
los deja en el `state` del enlace. Los derivados (elegidos, orden,
filtrados, cantidades, "N piezas") se calculan en cada dibujo y nunca se
guardan en estado.

**La selección vive en `localStorage`, bajo la clave
`catalogo-seleccion`**, con esta forma exacta:

```
{"cantidades":{"14":2,"37":1},"aclaraciones":"Los aros en dorado, si se puede."}
```

Solo ids y cantidades: el nombre, el precio y la foto salen de la lista
que el layout ya tiene, así un producto que dejó de ser visible
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
seis renglones.

**`INSTAGRAM_USUARIO = 'ana_porcelanaa'` e `INSTAGRAM_URL` viven en
`constantes.js`.** Es con doble a al final, distinto del nombre del
proyecto. Lo usan el encabezado, el panel, el pie, el paso 4 de "Cómo
hacer un pedido" y la pantalla del mensaje.

**Dos cosas más.** `formatearPrecio` y `textoDificultad` se importan de
`productos/presentacion.js` y se re-exportan desde
`catalogo/presentacion.js`, como hacen Pedidos y Gastos; los colores de
dificultad sí son propios (`COLOR_DIFICULTAD`), porque la gestión usa
rosa para Alta. Y la pantalla de la selección se llama `MiSeleccion.jsx`
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

Hovers, fuera de la media query, con `!important` sobre lo que está en
línea:

- `catalogo-suave`: fondo celeste suave; el ☰, Filtrar y su cruz, − y +,
  y los botones y enlaces con borde (Copiar mensaje, Seguir mirando, las
  salidas de `CajaMensaje`).
- `catalogo-tarjeta`: borde más oscuro; la tarjeta del listado y los
  chips de categoría del detalle.
- `catalogo-subrayado`: subrayado; "Volver al catálogo", "Volver",
  "Quitar filtros" y "Ver todos los productos".
- `catalogo-item`: texto celeste; los tres ítems de la barra, el
  desplegable y los enlaces del pie.
- `catalogo-item-panel`: velo blanco; los renglones del panel ☰, su cruz
  y su enlace a Instagram.
- `catalogo-instagram`: celeste claro; los enlaces a Instagram del
  encabezado, del pie y del paso 4.
- `catalogo-relleno`: opacidad .92; los enlaces con fondo celeste
  (Consultar por Instagram, Abrir Instagram, Ver el catálogo), que al ser
  `<a>` no toman el hover global de los botones.
- `catalogo-quitar`: fondo rojo claro; la cruz de quitar en la selección.
- `catalogo-campo`: borde celeste al enfocar; el textarea de aclaraciones
  y el desplegable de orden del listado (la regla global de foco de
  `index.css` es solo para `input`).
- `catalogo-accion-aviso`: el "Ver" del aviso flotante.

De 900px para arriba, solo medidas:

- `catalogo-contenido`: el `main`; padding 28/24 en vez de 16.
- `catalogo-logo`: el logo del encabezado; 22px en vez de 18.
- `catalogo-portada` y su `h1`: la portada del listado; más aire y el
  título a 36px.
- `catalogo-columnas`: la grilla del listado; `240px 1fr`, filtros y
  tarjetas. Va solo cuando hay filtros que poner en la primera columna.
- `catalogo-detalle`: la grilla del detalle; galería y datos lado a lado.
- `catalogo-seleccion`: la grilla de la selección; lista y resumen de
  320px lado a lado.

**Verificado en un Chrome sin ventana** en 384, 720, 1152 y 1920, en
todas las páginas y estados (38 capturas): sin scroll horizontal, sin
textos recortados y con todas las imágenes en `object-fit: cover`.

### Pendientes

- **Los 8 avisos de `npm run lint`**, que vienen de antes del catálogo y
  no son de él: `react-refresh/only-export-components` en
  `componentes/Paginacion.jsx` (línea 11), `contexto/AuthContext.jsx`
  (34) y `funcionalidades/clientes/ModalCliente.jsx` (7, 16, 23, 31 y
  36); y `react-hooks/exhaustive-deps` en
  `funcionalidades/materiales/Materiales.jsx` (720), que es un warning.
- **Una migración cosmética en `gastos`:** el `help_text` de
  `Gasto.descripcion` cambió en el modelo y no en `0001_initial.py`;
  `makemigrations --check` propone `0002_alter_gasto_descripcion`. No
  cambia la base. Generarla y aplicarla antes de armar Docker, para que
  `migrate` arranque limpio.


---



## Diseño visual — cerrado, no cambiar

Estilos en línea en React. `index.css` tiene dos cosas y nada más: los
hovers, con `!important` porque los estilos en línea tienen máxima
especificidad, y las reglas de pantalla chica de la sección Responsive.

| Uso | Color |
|---|---|
| Rosa viejo profundo — barra lateral, botones principales, títulos | `#8C5A66` |
| Rosa viejo medio — acentos, elementos activos | `#B08791` |
| Rosa muy claro — encabezados de tabla, fondos suaves | `#F0E2E4` |
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

**Patrón de listado:** título + botón de alta a la derecha → buscador y
filtros → tabla o grilla → sección colapsable de dados de baja al final.

**Patrón de modal:** cabecera `#8C5A66` con título blanco y cruz, cuerpo
con campos apilados, pie con Cancelar y la acción principal. Fondo
oscurecido que cierra al hacer clic, con `e.stopPropagation()` en la
tarjeta.

**Botones de acción:** cuadrados de 36px con icono. Ver (ojo,
`#8C5A66`), Editar (lápiz, `#8C5A66`), Copiar (dos hojas superpuestas,
`#8C5A66`), Dar de baja (prohibido, `#D9A441`), Reactivar (tilde,
`#4E8C6A`), Eliminar (papelera, `#C0442F`).


- El vocabulario sale de mis casos de uso, no de sinónimos. Los materiales de
  un producto son "los materiales del producto", nunca "la receta".

  - Antes de crear un estilo, una clase o un componente nuevo, revisá si ya
  existe uno equivalente en otro módulo y reusalo. Las pantallas nuevas
  tienen que sentirse iguales a las que ya están, no más elaboradas.

**El filtrado es siempre local**, sobre los datos ya cargados, así que
ningún buscador lleva debounce. El volumen del emprendimiento no
supera el centenar de productos, así que traer la lista completa y
filtrarla en el navegador es instantáneo y evita un pedido por tecla.
Los ViewSets igual declaran `search_fields` porque es lo que hace
andar el buscador de la interfaz navegable de DRF.

**Al escribir el catálogo público**, revisar que su serializer NO
herede de ProductoListaSerializer ni de ProductoDetalleSerializer:
esos exponen los ids de materiales, y la composición no va al catálogo.


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
no lleva ninguna regla. Cada número está en dos lugares que tienen que
coincidir: el 768 en `index.css` y en `PANTALLA_CHICA` de `Layout.jsx`; el
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

**Capas (`z-index`):** fondo oscuro del menú 90, barra lateral 91,
modales 100 y 110, Toast 120. El panel queda debajo de cualquier modal:
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
  listados; se apila, el título baja a 26px y el botón ocupa todo el
  ancho.
- `barra-herramientas` y `buscador`: el contenedor buscador + Filtros y el
  div del buscador; la barra se parte y el buscador ocupa su fila entera.
- `boton-filtros`: el botón Filtros de Materiales, Productos, Pedidos y
  Gastos; crece hasta llenar su fila.
- `fila-pestanas`: la fila de pestañas de las fichas de producto y de
  pedido; se desliza de lado, con las pestañas sin partirse y menos
  padding.
- `modal-fondo` y `modal-caja`: el fondo oscuro y la caja de los 24
  modales; 8px de aire y hasta 96vh de alto.
- `campos-dos-columnas`: los grids de dos campos de ModalCobro,
  ModalAgregarProducto y ModalEditarProductoDelPedido; una columna.
- `paneles-finanzas` y `cobros-dos-columnas`: la grilla INGRESOS / GASTOS
  de Finanzas y la grilla lista + resumen de la pestaña Cobros; una
  columna.
- `fila-fechas`: la fila Desde / Hasta del período Personalizado de
  Finanzas; se parte, sin margen, con cada fecha en su renglón.
- `acciones-materiales`: los dos botones de la cabecera de materiales de
  un gasto; uno debajo del otro, a todo el ancho.
- `fila-producto-baja` y `fila-categoria-baja`: las filas de la sección de
  bajas de Productos; dos y tres renglones.
- `chips-filtro`: los dos chips de Clientes; se parten, a la izquierda.
- `toast`: el aviso flotante; hasta 16px de cada borde, centrado.
- `pie-filtros`: el pie de los cuatro modales de filtros; contador arriba
  y los dos botones abajo por mitades.
- `tabla-entregas`: la tabla de entregas de Inicio; mínimo 720.
- `celda-desde`: la celda DESDE de la tabla de producción de Inicio; deja
  partir "hace N días · revisar".
- `tipo-cobro`: el div de TIPO en ModalCobro; sus opciones miden según su
  texto en vez de en tercios.
- `ancho-pantalla`: todo elemento con `maxWidth: ANCHO_MAXIMO`; de 1440
  para arriba mide 1400.
- `envio-y-costo`: la fila ENVÍO / COSTO de la ficha de pedido; de 1440
  para arriba, dos tercios y un tercio, para que el costo no sea un campo
  de 700px.
- `datos-producto`: el contenedor de la pestaña Datos de Producto; de 1440
  para arriba, dos columnas (formulario y panel con la imagen).

Los hovers siguen en el mismo archivo, fuera de las media queries, con
sus propias clases (`nav-item`, `btn-accion`, `btn-reponer`, etc.).

**Verificado en la emulación de Chrome:** Galaxy S23+ (384px), Galaxy Tab
S10 FE vertical (720px) y apaisada (1152px), y un monitor de 1920px,
además del escritorio.
Las medidas de texto con las que se calcularon mínimos y porcentajes son
estimaciones, porque Quicksand no está instalada en la máquina: la
verificación que vale es la del navegador.