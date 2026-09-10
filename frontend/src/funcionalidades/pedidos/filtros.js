// El filtrado del listado de Pedidos, escrito una sola vez.
//
// Mismo criterio que el filtros.js de Materiales: acá se DECIDE qué pedidos
// entran en la lista, y lo usan dos lugares con la misma función.
// Pedidos.jsx con los filtros ya aplicados, para armar la tabla, y
// ModalFiltros.jsx con el borrador, para el contador en vivo del pie. Así
// no hay dos versiones de la misma regla que puedan quedar distintas.
//
// El filtro por saldo del prototipo NO está: depende de Cobros, que es el
// módulo siguiente.

export const FILTROS_VACIOS = {
  // Un id, no una lista: de clientes se elige uno solo.
  cliente: null,
  estados: [],
  // Los extremos del rango de total. Vacío significa "sin límite de este
  // lado", que no es lo mismo que cero: cero es un total válido.
  desde: '',
  hasta: '',
}


// La lista lista para mostrar. Cada criterio vacío no filtra nada.
export function candidatos(pedidos, filtros, busqueda = '') {
  const texto = busqueda.trim().toLowerCase()

  return pedidos.filter((p) => {
    if (texto) {
      // El número va con el numeral adelante, así que buscar "#43" y
      // buscar "43" encuentran los dos.
      const buscable = `#${p.id} ${p.cliente_instagram} ${p.cliente_nombre} ${p.productos_nombres.join(' ')}`

      if (!buscable.toLowerCase().includes(texto)) return false
    }

    if (filtros.cliente !== null && p.cliente !== filtros.cliente) return false

    if (filtros.estados.length > 0 && !filtros.estados.includes(p.estado)) return false

    // El total llega como TEXTO ("15500.00"): DRF serializa así los Decimal
    // para que no pierdan precisión al pasar por el número de JavaScript.
    // Hay que convertirlo para compararlo con los valores de los
    // deslizadores.
    const total = Number(p.total)

    if (filtros.desde !== '' && total < Number(filtros.desde)) return false
    if (filtros.hasta !== '' && total > Number(filtros.hasta)) return false

    return true
  })
}


// Cuántos criterios hay puestos, para el globito del botón. El rango de
// total cuenta como uno solo, aunque tenga dos extremos.
export function contarFiltros(filtros) {
  return (
    (filtros.cliente !== null ? 1 : 0) +
    filtros.estados.length +
    (filtros.desde !== '' || filtros.hasta !== '' ? 1 : 0)
  )
}
