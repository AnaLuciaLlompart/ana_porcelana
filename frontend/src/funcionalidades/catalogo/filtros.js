// El filtro por categoría del catálogo público (CU64). Los filtros
// elegidos no se guardan en estado: viven en la dirección, como
// /?categoria=3&categoria=7, un parámetro por cada categoría elegida. Así
// una dirección con filtros se puede copiar, abrir en otra pestaña y
// sobrevive a recargar la página.
//
// Acá están las funciones que leen y escriben esa dirección y las que
// filtran. Ninguna pide nada al servidor: todas trabajan sobre las listas
// que el layout ya cargó.


// El orden en que se muestran los dos grupos: primero por tipo de
// accesorio, después por temática, como el diseño. El backend los manda al
// revés, porque ordena por el código y TEMATICA va antes que TIPO.
const ORDEN_DE_GRUPOS = ['TIPO', 'TEMATICA']


// Arma los grupos del árbol y de los filtros. Cada categoría sale con su
// cantidad de productos, contada sobre la lista completa; las que no
// tienen ninguno no salen, y un grupo que queda vacío tampoco.
//
// El título de cada grupo es el tipo_display que manda el backend ("Tipo
// de accesorio", "Temática"): acá no se traduce ningún código.
export function agruparCategorias(categorias, productos) {
  const conCantidad = categorias
    .map((categoria) => ({
      ...categoria,
      cantidad: productos.filter((producto) =>
        producto.categorias.some((c) => c.id === categoria.id)
      ).length,
    }))
    .filter((categoria) => categoria.cantidad > 0)

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


// O dentro de un grupo, Y entre grupos: con Aros, Dijes y Harry Potter
// elegidos quedan los aros y los dijes que sean de Harry Potter.
export function filtrarProductos(productos, grupos, idsElegidos) {
  return productos.filter((producto) => {
    const idsDelProducto = producto.categorias.map((c) => c.id)

    return grupos.every((grupo) => {
      const elegidasDelGrupo = grupo.categorias.filter((c) => idsElegidos.includes(c.id))

      // Un grupo sin nada elegido no filtra.
      if (elegidasDelGrupo.length === 0) return true

      return elegidasDelGrupo.some((c) => idsDelProducto.includes(c.id))
    })
  })
}
