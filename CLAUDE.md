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
`categorias` (CU11–CU16). En curso: **productos** (CU17–CU35).

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

En las pantallas: debounce de 300 ms en los buscadores, derivados
calculados con `.filter()` y nunca guardados en estado, objeto
`acciones` que se expande con `{...acciones}`, y una función
`cambiarEstado(entidad, accion)` que recibe la función de la API como
argumento.

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
`#8C5A66`), Editar (lápiz, `#8C5A66`), Dar de baja (prohibido,
`#D9A441`), Reactivar (tilde, `#4E8C6A`), Eliminar (papelera,
`#C0442F`).


- El vocabulario sale de mis casos de uso, no de sinónimos. Los materiales de
  un producto son "los materiales del producto", nunca "la receta".