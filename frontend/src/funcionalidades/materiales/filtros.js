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


// Los ids de los materiales que usa el producto elegido.
//
// Devuelve null cuando no hay ninguno elegido, que significa "no filtres
// por esto". Un producto sin materiales devuelve el arreglo vacío, que sí
// filtra: no hay ningún material que mostrar, y esa es la respuesta
// correcta.
function materialesDelProducto(productos, id) {
  if (id === null) return null

  const producto = productos.find((p) => p.id === id)

  return producto ? producto.materiales : null
}


// La lista lista para mostrar. Cada criterio vacío no filtra nada.
//
// Ojo: acá NO va la regla de Productos de "sin filtro de estado, solo los
// activos". Materiales muestra los activos arriba y los discontinuados en
// la sección colapsable, y ese reparto lo hace la pantalla después.
export function candidatos(materiales, filtros, busqueda = '', productos = []) {
  const texto = busqueda.trim().toLowerCase()
  const ids = materialesDelProducto(productos, filtros.producto)

  return materiales.filter((m) => {
    if (
      texto &&
      !m.nombre.toLowerCase().includes(texto) &&
      !m.descripcion.toLowerCase().includes(texto)
    ) {
      return false
    }

    if (
      filtros.disponibilidades.length > 0 &&
      !filtros.disponibilidades.includes(m.disponibilidad)
    ) {
      return false
    }

    if (filtros.estados.length > 0 && !filtros.estados.includes(m.estado)) {
      return false
    }

    if (ids !== null && !ids.includes(m.id)) return false

    return true
  })
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
