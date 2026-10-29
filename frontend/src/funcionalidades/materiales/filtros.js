// El filtrado del listado de Materiales, escrito una sola vez.
//
// Mismo criterio que el filtros.js de Productos: acá se DECIDE qué
// materiales entran en la lista, y lo usan dos lugares con la misma
// función. Materiales.jsx con los filtros ya aplicados, para armar la
// lista, y ModalFiltros.jsx con el borrador, para el contador en vivo del
// pie. Así no hay dos versiones de la misma regla que puedan quedar
// distintas.

export const FILTROS_VACIOS = {
  disponibilidades: [],
  estados: [],
  // Un id, no una lista: de productos se elige uno solo.
  producto: null,
}


// Los parámetros de GET /api/materiales/ para una de las dos listas de la
// pantalla (corrección D3): el filtrado, la búsqueda y el orden los hace el
// backend, en MaterialViewSet._filtrar(), igual que en Pedidos.
//
// estado es el de la lista que se pide: ACTIVO para la de arriba, que se
// pagina, y DISCONTINUADO para la sección colapsable, que viene entera.
// Devuelve null cuando el filtro de estado de la pantalla deja esa lista
// vacía (con solo "Discontinuado" marcado, la de arriba no tiene nada que
// pedir).
export function parametrosDelListado({ filtros, busqueda, orden, estado, pagina, porPagina }) {
  if (filtros.estados.length > 0 && !filtros.estados.includes(estado)) return null

  const parametros = new URLSearchParams()

  if (pagina) parametros.append('pagina', pagina)
  if (porPagina) parametros.append('por_pagina', porPagina)

  parametros.append('estado', estado)

  const texto = busqueda.trim()
  if (texto) parametros.append('busqueda', texto)

  filtros.disponibilidades.forEach((valor) => parametros.append('disponibilidad', valor))
  if (filtros.producto !== null) parametros.append('producto', filtros.producto)

  if (orden.campo) parametros.append('orden', orden.dir === 'desc' ? `-${orden.campo}` : orden.campo)

  return parametros
}


// Cuántos criterios hay puestos, para el globito del botón. El producto
// cuenta como uno.
export function contarFiltros(filtros) {
  return (
    filtros.disponibilidades.length +
    filtros.estados.length +
    (filtros.producto !== null ? 1 : 0)
  )
}
