import cliente from '../../api/cliente'

// Una función por endpoint del backend.

// =====================================================================
//  PEDIDO  ·  CU40 a CU43
// =====================================================================
// listarPedidos        CU41 - buscar
// crearPedido          CU40 - alta
// modificarPedido      CU42 - modificar
// eliminarPedido       CU43 - borrar
//
// obtenerPedido no implementa un CU: trae la ficha completa que CU42
// necesita para cargar el formulario de edición.
//
// cambiarEstadoPedido tampoco es un CU propio: es parte de CU42. Tiene su
// endpoint porque en la pantalla el estado se cambia solo, con efecto
// inmediato, sin pasar por el botón de guardar, y porque al pasar el
// pedido a Entregado el backend completa la fecha de entrega real.

export function listarPedidos(params = {}) {
  return cliente.get('/pedidos/', { params })
}

export function obtenerPedido(id) {
  return cliente.get(`/pedidos/${id}/`)
}

export function crearPedido(datos) {
  return cliente.post('/pedidos/', datos)
}

export function modificarPedido(id, datos) {
  return cliente.put(`/pedidos/${id}/`, datos)
}

export function eliminarPedido(id) {
  return cliente.delete(`/pedidos/${id}/`)
}

export function cambiarEstadoPedido(id, estado) {
  return cliente.post(`/pedidos/${id}/cambiar_estado/`, { estado })
}


// =====================================================================
//  PRODUCTOS DEL PEDIDO  ·  CU44 a CU47
// =====================================================================
// listarProductosDelPedido    CU45 - listar
// agregarProductoAlPedido     CU44 - agregar
// modificarProductoDelPedido  CU46 - modificar
// quitarProductoDelPedido     CU47 - quitar
//
// Con respecto a los ids: agregar recibe el id del PRODUCTO, pero
// modificar y quitar reciben el id de la LÍNEA, que es la fila que junta
// el producto con su cantidad, su precio y su etapa. Son cosas distintas.
//
// Acá esa diferencia pesa más que en los materiales de un producto: el
// mismo producto puede figurar dos veces en el mismo pedido, así que su
// id no alcanzaría para saber de cuál de las dos filas se habla.
//
// Al agregar, el precio es opcional: si no va, el backend copia el del
// catálogo y lo congela ahí.

export function listarProductosDelPedido(id) {
  return cliente.get(`/pedidos/${id}/productos/`)
}

export function agregarProductoAlPedido(id, datos) {
  return cliente.post(`/pedidos/${id}/productos/`, datos)
}

export function modificarProductoDelPedido(id, lineaId, datos) {
  return cliente.patch(`/pedidos/${id}/productos/${lineaId}/`, datos)
}

export function quitarProductoDelPedido(id, lineaId) {
  return cliente.delete(`/pedidos/${id}/productos/${lineaId}/`)
}


// =====================================================================
//  COBROS DEL PEDIDO  ·  CU48 a CU51
// =====================================================================
// listarCobrosDelPedido  CU49 - listar
// registrarCobro         CU48 - registrar
// modificarCobro         CU50 - modificar
// borrarCobro            CU51 - borrar
//
// El mismo criterio de ids que los productos del pedido: registrar va
// contra el PEDIDO, porque el cobro todavía no existe, y modificar y
// borrar van contra el COBRO.
//
// Al registrar alcanza con el monto: el tipo, la fecha y el medio tienen
// valor por defecto en el modelo.

export function listarCobrosDelPedido(id) {
  return cliente.get(`/pedidos/${id}/cobros/`)
}

export function registrarCobro(id, datos) {
  return cliente.post(`/pedidos/${id}/cobros/`, datos)
}

export function modificarCobro(id, cobroId, datos) {
  return cliente.patch(`/pedidos/${id}/cobros/${cobroId}/`, datos)
}

export function borrarCobro(id, cobroId) {
  return cliente.delete(`/pedidos/${id}/cobros/${cobroId}/`)
}
