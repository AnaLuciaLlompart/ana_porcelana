import cliente from '../../api/cliente'

// Una función por endpoint del backend.

// =====================================================================
//  GASTO  ·  CU52 a CU55
// =====================================================================
// listarGastos     CU53 - buscar
// crearGasto       CU52 - alta
// modificarGasto   CU54 - modificar
// eliminarGasto    CU55 - borrar
//
// obtenerGasto no implementa un CU: trae la ficha que CU54 necesita para
// cargar el formulario de edición.
//
// El listado usa solo listarGastos y eliminarGasto. Las otras tres son de
// la ficha del gasto.
//
// Al crear y al modificar un gasto de MATERIALES el monto no se manda: lo
// calcula el backend sumando los materiales del gasto, y si va en el cuerpo
// lo ignora.

export function listarGastos(params = {}) {
  return cliente.get('/gastos/', { params })
}

export function obtenerGasto(id) {
  return cliente.get(`/gastos/${id}/`)
}

export function crearGasto(datos) {
  return cliente.post('/gastos/', datos)
}

export function modificarGasto(id, datos) {
  return cliente.put(`/gastos/${id}/`, datos)
}

export function eliminarGasto(id) {
  return cliente.delete(`/gastos/${id}/`)
}


// =====================================================================
//  MATERIALES DEL GASTO  ·  CU56 a CU59
// =====================================================================
// listarMaterialesDelGasto    CU57 - listar
// registrarMaterialDelGasto   CU56 - registrar
// modificarMaterialDelGasto   CU58 - modificar
// quitarMaterialDelGasto      CU59 - quitar
//
// Con respecto a los ids: registrar recibe en los datos el id del MATERIAL,
// pero modificar y quitar reciben el id del MATERIAL DEL GASTO, que es la
// fila que junta el material con su cantidad y su precio unitario. Son
// cosas distintas, igual que en los productos del pedido.
//
// Las cuatro que escriben devuelven el gasto completo, con el monto ya
// recalculado.

export function listarMaterialesDelGasto(id) {
  return cliente.get(`/gastos/${id}/materiales/`)
}

export function registrarMaterialDelGasto(id, datos) {
  return cliente.post(`/gastos/${id}/materiales/`, datos)
}

export function modificarMaterialDelGasto(id, materialDelGastoId, datos) {
  return cliente.patch(`/gastos/${id}/materiales/${materialDelGastoId}/`, datos)
}

export function quitarMaterialDelGasto(id, materialDelGastoId) {
  return cliente.delete(`/gastos/${id}/materiales/${materialDelGastoId}/`)
}


// =====================================================================
//  DISPONIBILIDAD ALTA  ·  parte de CU58
// =====================================================================
// Marcan en disponibilidad Alta el material de una fila, o los de todas las
// filas del gasto. El backend solo cambia los materiales activos que no
// estaban ya en Alta; los demás los ignora sin dar error.
//
// La respuesta trae dos cosas: 'materiales_cambiados', con el id, el nombre
// y la disponibilidad que tenía antes cada material que cambió, y 'gasto',
// el gasto completo con las filas ya actualizadas.
//
// Deshacer no tiene endpoint propio en gastos: el backend lo resuelve con el
// PATCH de /materiales/{id}/, mandando la disponibilidad anterior.

export function marcarDisponibilidadAlta(id, materialDelGastoId) {
  return cliente.post(`/gastos/${id}/materiales/${materialDelGastoId}/disponibilidad_alta/`)
}

export function marcarTodosDisponibilidadAlta(id) {
  return cliente.post(`/gastos/${id}/materiales/disponibilidad_alta/`)
}
