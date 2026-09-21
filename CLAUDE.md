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
(CU36–CU39), `pedidos`, que incluye los cobros (CU40–CU51), y `gastos`
(CU52–CU59). La próxima es **informes** (CU60–CU62), y después el
catálogo público (CU63–CU71). Son 71 casos de uso en total.

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
- **Gestión optimizada para escritorio**; la adaptación a móvil va al
  final. El catálogo público sí se diseña directamente para celular.
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

### Las pruebas de Gastos

`backend/gastos/tests.py` tiene 60 pruebas: los ocho casos de uso por sus
endpoints reales, las reglas del monto y del tipo, la disponibilidad Alta
con su deshacer, el cambio en `MaterialViewSet.destroy` y las
restricciones de la base por fuera de la API. Se corren con
`python manage.py test gastos`, que usa una base temporal y no toca la de
desarrollo. Es la única app con pruebas automatizadas por ahora.


---



## Diseño visual — cerrado, no cambiar

Estilos en línea en React. Los hovers van en `index.css` con
`!important`, porque los estilos en línea tienen máxima especificidad.

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