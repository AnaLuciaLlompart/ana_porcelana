// El filtro por categoría del catálogo público (CU64). Los filtros
// elegidos no se guardan en estado: viven en la dirección, como
// /?categoria=3&categoria=7, un parámetro por cada categoría elegida. Así
// una dirección con filtros se puede copiar, abrir en otra pestaña y
// sobrevive a recargar la página.
//
// Acá están las funciones que leen y escriben esa dirección y la que arma
// los parámetros de cada página: desde la corrección D3, el filtrado lo
// hace el backend.


// El orden en que se muestran los dos grupos: primero por tipo de
// accesorio, después por temática, como el diseño. El backend los manda al
// revés, porque ordena por el código y TEMATICA va antes que TIPO.
const ORDEN_DE_GRUPOS = ['TIPO', 'TEMATICA']


// Arma los grupos del árbol y de los filtros. Cada categoría trae su
// cantidad de productos visibles, que cuenta el backend sobre todos (desde
// la corrección D3 el navegador ya no tiene la lista entera); las que no
// tienen ninguno no salen, y un grupo que queda vacío tampoco.
//
// El título de cada grupo es el tipo_display que manda el backend ("Tipo
// de accesorio", "Temática"): acá no se traduce ningún código.
export function agruparCategorias(categorias) {
  const conCantidad = categorias.filter((categoria) => categoria.cantidad > 0)

  return ORDEN_DE_GRUPOS
    .map((tipo) => conCantidad.filter((categoria) => categoria.tipo === tipo))
    .filter((delGrupo) => delGrupo.length > 0)
    .map((delGrupo) => ({
      tipo: delGrupo[0].tipo,
      titulo: delGrupo[0].tipo_display,
      categorias: delGrupo,
    }))
}


// Las categorías de un producto en el mismo orden que los grupos: primero
// las de tipo de accesorio y después las de temática.
export function ordenarCategorias(categorias) {
  return ORDEN_DE_GRUPOS.flatMap((tipo) =>
    categorias.filter((categoria) => categoria.tipo === tipo)
  )
}


// LEE los filtros de la dirección: los ids de las categorías elegidas.
// Solo devuelve los que existen entre las categorías que se muestran, así
// un id viejo o mal escrito en la dirección no filtra ni se cuenta.
export function leerFiltros(parametros, grupos) {
  const enLaUrl = parametros.getAll('categoria').map(Number)

  return grupos
    .flatMap((grupo) => grupo.categorias)
    .map((categoria) => categoria.id)
    .filter((id) => enLaUrl.includes(id))
}


// ESCRIBE los filtros: arma lo que recibe setSearchParams. Una lista en un
// valor se convierte en el parámetro repetido, y una lista vacía en
// ninguno.
export function escribirFiltros(ids) {
  return { categoria: ids.map(String) }
}


// Saca la categoría si estaba elegida y la agrega si no.
export function alternarFiltro(idsElegidos, id) {
  return idsElegidos.includes(id)
    ? idsElegidos.filter((elegido) => elegido !== id)
    : [...idsElegidos, id]
}


// Los parámetros de una página del listado (corrección D3): el backend
// filtra, busca y ordena, y devuelve de a 20. Las categorías van una por
// parámetro (?categoria=3&categoria=7) y el backend aplica la regla de
// siempre: O dentro de un grupo, Y entre grupos. Va en un URLSearchParams
// porque la categoría se repite.
export function parametrosDelCatalogo({ idsElegidos, orden, busqueda, pagina }) {
  const parametros = new URLSearchParams()

  parametros.append('pagina', pagina)
  parametros.append('orden', orden)
  idsElegidos.forEach((id) => parametros.append('categoria', id))
  if (busqueda.trim() !== '') parametros.append('busqueda', busqueda.trim())

  return parametros
}


// El orden de los productos del listado (CU63). Como los filtros, vive en
// la dirección: ?orden=precio-desc. Si falta o trae otra cosa, vale el de
// por defecto, que no se escribe para que la dirección quede limpia. Lo
// aplica el backend, con los mismos cuatro valores.
export const ORDENES = [
  { valor: 'nombre-asc', label: 'Nombre A–Z' },
  { valor: 'nombre-desc', label: 'Nombre Z–A' },
  { valor: 'precio-asc', label: 'Menor precio' },
  { valor: 'precio-desc', label: 'Mayor precio' },
]

export const ORDEN_POR_DEFECTO = 'nombre-asc'


// LEE el orden de la dirección. Solo acepta uno de ORDENES.
export function leerOrden(parametros) {
  const enLaUrl = parametros.get('orden')
  return ORDENES.some((orden) => orden.valor === enLaUrl) ? enLaUrl : ORDEN_POR_DEFECTO
}


// ESCRIBE el orden: el de por defecto no va a la dirección.
export function escribirOrden(orden) {
  return orden === ORDEN_POR_DEFECTO ? {} : { orden }
}


// La búsqueda por texto del listado. Como los filtros y el orden, vive en
// la dirección: ?busqueda=aros. Es "contiene", sin distinguir mayúsculas
// ni acentos, en el nombre o la descripción, y la hace el backend.


// LEE la búsqueda de la dirección: el texto tal cual, o vacío.
export function leerBusqueda(parametros) {
  return parametros.get('busqueda') ?? ''
}


// ESCRIBE la búsqueda: un texto en blanco no va a la dirección.
export function escribirBusqueda(busqueda) {
  return busqueda.trim() === '' ? {} : { busqueda }
}
