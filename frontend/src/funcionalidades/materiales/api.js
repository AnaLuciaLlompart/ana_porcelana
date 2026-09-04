import cliente from '../../api/cliente'

export function listarMateriales(params = {}) {
  return cliente.get('/materiales/', { params })
}

export function obtenerMaterial(id) {
  return cliente.get(`/materiales/${id}/`)
}

function armarFormData(datos, imagen, quitarImagen) {
  const fd = new FormData()

  fd.append('nombre', datos.nombre)
  fd.append('disponibilidad', datos.disponibilidad)
  fd.append('descripcion', datos.descripcion)
  fd.append('estado', datos.estado)

  // Con la imagen hay tres casos distintos, y el que falta es el que
  // importa:
  if (quitarImagen) {
    // La cadena vacía es cómo se pide "vaciá este campo" por multipart, que
    // no sabe mandar null. DRF la convierte en None porque el campo permite
    // null, y ahí la señal pre_save borra el archivo del disco.
    fd.append('url_imagen', '')
  } else if (imagen) {
    fd.append('url_imagen', imagen)
  }
  // Si no se manda el campo, el backend ni lo toca y la foto queda como
  // estaba: es el caso de editar el nombre sin tocar la imagen.

  return fd
}

export function crearMaterial(datos, imagen) {
  return cliente.post('/materiales/', armarFormData(datos, imagen))
}

export function actualizarMaterial(id, datos, imagen, quitarImagen) {
  return cliente.put(`/materiales/${id}/`, armarFormData(datos, imagen, quitarImagen))
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