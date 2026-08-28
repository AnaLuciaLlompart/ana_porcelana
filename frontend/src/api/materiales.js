import cliente from './cliente'

export function listarMateriales(params = {}) {
  return cliente.get('/materiales/', { params })
}

export function obtenerMaterial(id) {
  return cliente.get(`/materiales/${id}/`)
}

function armarFormData(datos, imagen) {
  const fd = new FormData()

  fd.append('nombre', datos.nombre)
  fd.append('disponibilidad', datos.disponibilidad)
  fd.append('descripcion', datos.descripcion)
  fd.append('estado', datos.estado)

  // Solo se envía si la usuaria eligió un archivo nuevo.
  if (imagen) {
    fd.append('url_imagen', imagen)
  }

  return fd
}

export function crearMaterial(datos, imagen) {
  return cliente.post('/materiales/', armarFormData(datos, imagen))
}

export function actualizarMaterial(id, datos, imagen) {
  return cliente.put(`/materiales/${id}/`, armarFormData(datos, imagen))
}

export function eliminarMaterial(id) {
  return cliente.delete(`/materiales/${id}/`)
}

export function discontinuarMaterial(id) {
  return cliente.post(`/materiales/${id}/discontinuar/`)
}

export function reactivarMaterial(id) {
  return cliente.post(`/materiales/${id}/reactivar/`)
}