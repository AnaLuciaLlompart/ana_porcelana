import cliente from './cliente'

export function listarCategorias(params = {}) {
  return cliente.get('/categorias/', { params })
}

export function crearCategoria(datos) {
  return cliente.post('/categorias/', datos)
}

export function actualizarCategoria(id, datos) {
  return cliente.put(`/categorias/${id}/`, datos)
}

export function eliminarCategoria(id) {
  return cliente.delete(`/categorias/${id}/`)
}

export function darDeBajaCategoria(id) {
  return cliente.post(`/categorias/${id}/dar_de_baja/`)
}

export function reactivarCategoria(id) {
  return cliente.post(`/categorias/${id}/reactivar/`)
}