// El filtrado del listado de Gastos, escrito una sola vez.
//
// Mismo criterio que el filtros.js de Pedidos: acá se DECIDE qué gastos
// entran en la lista, y lo usan dos lugares con la misma función.
// Gastos.jsx con los filtros ya aplicados, para armar la tabla y el resumen,
// y ModalFiltros.jsx con el borrador, para el contador en vivo del pie. Así
// no hay dos versiones de la misma regla que puedan quedar distintas.

export const FILTROS_VACIOS = {
  // Una lista: se pueden marcar varios tipos a la vez.
  tipos: [],
  // Los extremos del período, en ISO (aaaa-mm-dd), que es como los entrega
  // el input de fecha. Vacío significa "sin límite de este lado".
  desdeFecha: '',
  hastaFecha: '',
  // Los extremos del rango de monto. Vacío significa "sin límite de este
  // lado", que no es lo mismo que cero: cero es un monto válido, el de un
  // gasto de materiales que todavía no tiene materiales cargados.
  desde: '',
  hasta: '',
}


// Los parámetros de GET /api/gastos/ (corrección D3): el filtrado, la
// búsqueda y el orden los hace el backend, en GastoViewSet._filtrar(). Acá
// solo se traducen los filtros de la pantalla a los nombres de la URL, igual
// que en Pedidos. Cada criterio vacío no viaja. Sin pagina ni porPagina
// sirven también para el resumen, que suma lo filtrado.
//
// Va en un URLSearchParams porque el tipo se repite (?tipo=OTRO&tipo=…).
export function parametrosDelListado({ filtros, busqueda, orden, pagina, porPagina }) {
  const parametros = new URLSearchParams()

  if (pagina) parametros.append('pagina', pagina)
  if (porPagina) parametros.append('por_pagina', porPagina)

  const texto = busqueda.trim()
  if (texto) parametros.append('busqueda', texto)

  filtros.tipos.forEach((tipo) => parametros.append('tipo', tipo))
  if (filtros.desdeFecha !== '') parametros.append('fecha_desde', filtros.desdeFecha)
  if (filtros.hastaFecha !== '') parametros.append('fecha_hasta', filtros.hastaFecha)
  if (filtros.desde !== '') parametros.append('monto_desde', filtros.desde)
  if (filtros.hasta !== '') parametros.append('monto_hasta', filtros.hasta)

  // La columna GASTO se ordena por número, que en el backend se llama así.
  if (orden?.campo) {
    const clave = orden.campo === 'id' ? 'numero' : orden.campo
    parametros.append('orden', orden.dir === 'desc' ? `-${clave}` : clave)
  }

  return parametros
}


// Cuántos criterios hay puestos, para el globito del botón. El período y el
// rango de monto cuentan como uno solo cada uno, aunque tengan dos extremos.
export function contarFiltros(filtros) {
  return (
    filtros.tipos.length +
    (filtros.desdeFecha !== '' || filtros.hastaFecha !== '' ? 1 : 0) +
    (filtros.desde !== '' || filtros.hasta !== '' ? 1 : 0)
  )
}


// Hasta dónde llegan los deslizadores de monto. El diseño los tiene fijos en
// 120000, que es el de sus datos de prueba; acá el tope sale de los gastos
// que hay: el monto más alto, redondeado hacia arriba al múltiplo de 1000,
// para que el deslizador siempre alcance al gasto más caro. Es el mismo
// criterio que rangoDePrecios en Productos.
//
// El piso no se calcula: queda fijo en 0.
export const PASO = 1000

// Recibe el monto más alto, que manda el backend en el resumen del listado
// (monto_maximo, como texto).
export function topeDelMonto(montoMaximo) {
  const mayor = Number(montoMaximo)
  const tope = Math.ceil(mayor / PASO) * PASO

  // Sin gastos, o con todos en cero, el tope caería en 0: un deslizador sin
  // recorrido. Se le da un paso de aire.
  return tope === 0 ? PASO : tope
}
