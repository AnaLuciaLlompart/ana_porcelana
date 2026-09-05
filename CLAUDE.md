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
`categorias` (CU11–CU16), `productos` (CU17–CU35).
En curso: **clientes** (CU36–CU39).

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

**Implementación por etapas: lo que depende de Pedidos NO se hace
todavía**, y no se simula con ceros ni con "Sin pedidos". Espera al
módulo de Pedidos:

- las columnas PEDIDOS, ÚLTIMO y SALDO, y su ordenamiento
- los dos chips de filtro (con saldo pendiente, con pedidos en curso)
- la línea de resumen bajo el título
- el recuento de pedidos y el chip de saldo dentro del modal Ver
- la rama bloqueada del modal Eliminar, con candado

Esto no es una diferencia con el prototipo como las cinco de Productos,
que son permanentes. Es orden de construcción, y se documenta así.

**Mientras tanto la tabla ordena por usuario de Instagram ascendente**,
que es el `ordering` del modelo. Cuando exista Pedidos, el orden
inicial vuelve a ser ÚLTIMO como dice el prototipo.

**El único aviso flotante del módulo es el de copiar el usuario.** Las
otras acciones ya se confirman solas: se cierra el modal y la fila
aparece, cambia o desaparece de la tabla. Copiar al portapapeles es la
única acción sin efecto visible.

**Dos componentes a compartir antes de escribir el frontend:**
`BotonAccion.jsx` hoy vive en `funcionalidades/productos/` y `Toast`
está declarado adentro de `DetalleProducto.jsx`. Clientes es la segunda
funcionalidad que los usa, así que van a `componentes/`.

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