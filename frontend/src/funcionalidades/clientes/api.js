import cliente from '../../api/cliente'

// el 'cliente' del import es el cliente HTTP de axios, el de
// api/cliente.js. Los clientes del emprendimiento son los que devuelven
// estas funciones.

export function listarClientes(params = {}) {
  return cliente.get('/clientes/', { params })
}

// El total de clientes y los números de los dos chips. No es un CU propio:
// es parte de CU37, porque el listado paginado ya no trae todos los
// clientes para contarlos.
export function resumenDeClientes() {
  return cliente.get('/clientes/resumen/')
}

export function crearCliente(datos) {
  return cliente.post('/clientes/', datos)
}

export function modificarCliente(id, datos) {
  return cliente.put(`/clientes/${id}/`, datos)
}

export function eliminarCliente(id) {
  return cliente.delete(`/clientes/${id}/`)
}
