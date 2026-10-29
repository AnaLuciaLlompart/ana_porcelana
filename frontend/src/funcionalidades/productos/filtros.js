// El filtrado del listado de Productos, escrito una sola vez.
//
// Está en su propio archivo y no en presentacion.js porque acá sí se
// DECIDE algo: qué productos entran en la grilla y cuáles no. En
// presentacion.js va solo lo que traduce datos a lo que se ve.
//
// Lo usan dos lugares con la misma función: Productos.jsx con los filtros
// ya aplicados, para armar la grilla, y ModalFiltros.jsx con el borrador,
// para el contador en vivo del pie. Así no hay dos versiones de la misma
// regla que puedan quedar distintas.

export const FILTROS_VACIOS = {
  categorias: [],
  estados: [],
  dificultades: [],
  tipo: [],
  desde: null,
  hasta: null,
}


// Los parámetros de GET /api/productos/ para una página de la grilla
// (corrección D3): el filtrado, la búsqueda y el orden los hace el backend,
// en ProductoViewSet._filtrar(), igual que en Pedidos.
//
// El estado siempre viaja: sin filtro de estado, la grilla muestra solo los
// activos, y con estado el backend aplica la regla de las categorías de
// baja (esos productos van a la sección de abajo, salvo que se elija "Dados
// de baja"). Sin estado, el backend devolvería todos los productos.
//
// Va en un URLSearchParams porque varios criterios se repiten
// (?categoria=3&categoria=7).
export function parametrosDelListado({ filtros, busqueda, orden, pagina, porPagina }) {
  const parametros = new URLSearchParams()

  parametros.append('pagina', pagina)
  parametros.append('por_pagina', porPagina)

  const texto = busqueda.trim()
  if (texto) parametros.append('busqueda', texto)

  const estados = filtros.estados.length > 0 ? filtros.estados : ['ACTIVO']
  estados.forEach((estado) => parametros.append('estado', estado))

  filtros.categorias.forEach((id) => parametros.append('categoria', id))
  filtros.dificultades.forEach((valor) => parametros.append('dificultad', valor))
  // El modal guarda la etiqueta que muestra; el backend espera la clave.
  filtros.tipo.forEach((etiqueta) =>
    parametros.append('tipo', etiqueta === 'Personalizado' ? 'personalizado' : 'catalogo')
  )
  if (filtros.desde !== null) parametros.append('precio_desde', filtros.desde)
  if (filtros.hasta !== null) parametros.append('precio_hasta', filtros.hasta)

  if (orden.campo) parametros.append('orden', orden.dir === 'desc' ? `-${orden.campo}` : orden.campo)

  return parametros
}


// Cuántos criterios hay puestos, para el globito del botón. El rango de
// precio cuenta como UNO solo, aunque sean dos valores.
export function contarFiltros(filtros) {
  return (
    filtros.categorias.length +
    filtros.estados.length +
    filtros.dificultades.length +
    filtros.tipo.length +
    (filtros.desde !== null || filtros.hasta !== null ? 1 : 0)
  )
}


// Hasta dónde llegan los deslizadores de precio. El diseño los tiene fijos
// en 3000 y 13000, que son los de sus datos de prueba; acá salen de los
// productos que hay, redondeados hacia afuera al múltiplo de 500, para que
// el deslizador siempre alcance a la pieza más cara.
const PASO = 500

// Recibe el resumen del listado, que trae el precio más bajo y el más alto
// de todos los productos (precio_minimo y precio_maximo, como texto), o
// null mientras no llegó.
export function rangoDePrecios(resumen) {
  if (!resumen) return { min: 0, max: PASO }

  const min = Math.floor(Number(resumen.precio_minimo) / PASO) * PASO
  const max = Math.ceil(Number(resumen.precio_maximo) / PASO) * PASO

  // Si todos valen lo mismo, min y max caerían en el número: un deslizador
  // sin recorrido. Se le da un paso de aire.
  return min === max ? { min, max: max + PASO } : { min, max }
}
