// El ancho máximo de las fichas y de las pantallas que no son listados,
// en escritorio. En pantalla grande lo pisa la regla .ancho-pantalla de
// index.css: acá vive el número de siempre, allá el de 1440 para arriba.
export const ANCHO_MAXIMO = 1140

// El prefijo de todas las rutas del módulo de gestión. El catálogo público
// vive en la raíz del sitio y la gestión cuelga de acá. Va sin barra final
// para poder escribir `${BASE_GESTION}/pedidos`; la pantalla de Inicio es
// BASE_GESTION a secas. Es el único lugar donde está escrito: rutas.jsx
// arma las rutas con esta constante y cada navegar() la usa.
export const BASE_GESTION = '/gestion'

// El ancho desde el que el catálogo público pasa de la versión de celular
// a la de escritorio. Tiene que ser el mismo 900 que la media query del
// catálogo en index.css: React decide qué se dibuja (la barra con el
// desplegable o el botón ☰, los filtros a la vista o en un panel) y CSS
// cambia las medidas, y los dos tienen que cambiar en el mismo ancho. Es
// un corte propio del catálogo, que sale de su diseño: los de la gestión
// (768 y 1440) son otros.
export const ESCRITORIO_CATALOGO = '(min-width: 900px)'

// El Instagram del emprendimiento. Es el único lugar donde está escrito:
// lo usan el encabezado, el panel de celular y la pantalla del mensaje.
// Ojo: es con doble a al final, distinto del nombre del proyecto.
export const INSTAGRAM_USUARIO = 'ana_porcelanaa'
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_USUARIO}`
