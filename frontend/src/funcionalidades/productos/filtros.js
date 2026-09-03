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


// Los productos entre los que se filtra. Dos reglas que no dependen de lo
// que haya elegido la usuaria:
//
// 1. Los que tienen una categoría de baja quedan siempre afuera: van en la
//    sección de dados de baja, agrupados bajo su categoría.
// 2. Sin filtro de estado se muestran solo los activos. Elegir "Dados de
//    baja" es lo que trae también a los otros.
function candidatosPorEstado(productos, filtros) {
  return productos.filter((p) => {
    if (p.categorias_de_baja.length > 0) return false

    if (filtros.estados.length === 0) return p.estado === 'ACTIVO'

    return filtros.estados.includes(p.estado)
  })
}


// ¿Este producto pasa los criterios elegidos?
//
// Cada criterio vacío no filtra nada. El campo es_personalizado viene ya
// resuelto del backend: acá no se recalcula ninguna regla de negocio, solo
// se compara.
export function aplicaFiltros(producto, filtros) {
  if (
    filtros.categorias.length > 0 &&
    !producto.categorias.some((c) => filtros.categorias.includes(c.id))
  ) {
    return false
  }

  if (
    filtros.dificultades.length > 0 &&
    !filtros.dificultades.includes(producto.dificultad)
  ) {
    return false
  }

  const precio = Number(producto.precio_actual)
  if (filtros.desde !== null && precio < filtros.desde) return false
  if (filtros.hasta !== null && precio > filtros.hasta) return false

  if (filtros.tipo.length > 0) {
    const etiqueta = producto.es_personalizado ? 'Personalizado' : 'En catálogo'
    if (!filtros.tipo.includes(etiqueta)) return false
  }

  return true
}


// La lista lista para mostrar: primero se recorta por estado, después se
// aplican los criterios, y al final el texto del buscador.
export function candidatos(productos, filtros, busqueda = '') {
  const texto = busqueda.trim().toLowerCase()

  return candidatosPorEstado(productos, filtros).filter(
    (p) => p.nombre.toLowerCase().includes(texto) && aplicaFiltros(p, filtros)
  )
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

export function rangoDePrecios(productos) {
  if (productos.length === 0) return { min: 0, max: PASO }

  const precios = productos.map((p) => Number(p.precio_actual))
  const min = Math.floor(Math.min(...precios) / PASO) * PASO
  const max = Math.ceil(Math.max(...precios) / PASO) * PASO

  // Si todos valen lo mismo, min y max caerían en el número: un deslizador
  // sin recorrido. Se le da un paso de aire.
  return min === max ? { min, max: max + PASO } : { min, max }
}
