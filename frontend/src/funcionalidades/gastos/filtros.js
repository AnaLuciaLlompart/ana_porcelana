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


// La lista lista para mostrar. Cada criterio vacío no filtra nada.
export function candidatos(gastos, filtros, busqueda = '') {
  const texto = busqueda.trim().toLowerCase()

  return gastos.filter((g) => {
    if (texto) {
      // Se busca por lo que dice el buscador: descripción, tipo o material.
      // El tipo es el tipo_display, que es lo que la usuaria lee en la
      // tabla, no el código. El número va con el numeral adelante, así que
      // buscar "#18" y buscar "18" encuentran los dos.
      const materiales = g.materiales.map((m) => m.material_nombre).join(' ')
      const buscable = `#${g.id} ${g.tipo_display} ${g.descripcion} ${materiales}`

      if (!buscable.toLowerCase().includes(texto)) return false
    }

    if (filtros.tipos.length > 0 && !filtros.tipos.includes(g.tipo)) return false

    // Las fechas se comparan como texto y no como Date. En formato ISO eso
    // funciona, porque el año va primero y todos los campos tienen el mismo
    // largo: '2026-09-08' es menor que '2026-09-09'.
    if (filtros.desdeFecha !== '' && g.fecha < filtros.desdeFecha) return false
    if (filtros.hastaFecha !== '' && g.fecha > filtros.hastaFecha) return false

    // El monto llega como TEXTO ("42300.00"): DRF serializa así los Decimal
    // para que no pierdan precisión al pasar por el número de JavaScript.
    // Hay que convertirlo para compararlo con los valores de los
    // deslizadores.
    const monto = Number(g.monto)

    if (filtros.desde !== '' && monto < Number(filtros.desde)) return false
    if (filtros.hasta !== '' && monto > Number(filtros.hasta)) return false

    return true
  })
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

export function montoMaximo(gastos) {
  // El 0 de adelante hace que Math.max no devuelva -Infinity cuando todavía
  // no hay ningún gasto.
  const mayor = Math.max(0, ...gastos.map((g) => Number(g.monto)))
  const tope = Math.ceil(mayor / PASO) * PASO

  // Sin gastos, o con todos en cero, el tope caería en 0: un deslizador sin
  // recorrido. Se le da un paso de aire.
  return tope === 0 ? PASO : tope
}
