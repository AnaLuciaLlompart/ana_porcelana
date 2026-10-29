import cliente from '../../api/cliente'

// Los tres endpoints del catálogo público. Son de solo lectura y no piden
// sesión: es lo único de la API que puede usar un visitante.


// CU63 - Los productos visibles. Con pagina, de a 20 y con los filtros, el
// orden y la búsqueda resueltos en el backend (corrección D3); con ids,
// solo esos, que son los de "Mi selección".
export function listarProductosDelCatalogo(params = {}) {
  return cliente.get('/catalogo/productos/', { params })
}

// CU65 - Un producto visible con todas sus imágenes de resultado. El
// backend responde 404 si no existe o si no se muestra en el catálogo.
export function obtenerProductoDelCatalogo(id) {
  return cliente.get(`/catalogo/productos/${id}/`)
}

// CU64 - Las categorías activas, que son las opciones del filtro, cada una
// con cuántos productos visibles tiene.
export function listarCategoriasDelCatalogo() {
  return cliente.get('/catalogo/categorias/')
}
