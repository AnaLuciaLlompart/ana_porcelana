import cliente from '../../api/cliente'

// La gestión de usuarios (corrección del tutor: dos roles). Todos estos
// endpoints responden 403 a un administrador: son de la superadministradora.
// Las funciones de la sesión (login, logout, Mis datos) siguen en
// api/cliente.js, con las de auth.

export function listarUsuarios(params = {}) {
  return cliente.get('/usuarios/', { params })
}

// El total de usuarios y los números de los dos chips, sobre todos.
export function resumenDeUsuarios() {
  return cliente.get('/usuarios/resumen/')
}

export function crearUsuario(datos) {
  return cliente.post('/usuarios/', datos)
}

export function modificarUsuario(id, datos) {
  return cliente.put(`/usuarios/${id}/`, datos)
}

export function cambiarPasswordDeUsuario(id, passwordNueva) {
  return cliente.post(`/usuarios/${id}/cambiar_password/`, { password_nueva: passwordNueva })
}

export function darDeBajaUsuario(id) {
  return cliente.post(`/usuarios/${id}/dar_de_baja/`)
}

export function reactivarUsuario(id) {
  return cliente.post(`/usuarios/${id}/reactivar/`)
}

// Definitivo, a diferencia de dar de baja.
export function eliminarUsuario(id) {
  return cliente.delete(`/usuarios/${id}/`)
}
