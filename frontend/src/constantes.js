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
