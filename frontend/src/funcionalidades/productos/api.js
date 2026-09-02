import cliente from '../../api/cliente'

// Una función por endpoint del backend. 

// =====================================================================
//  PRODUCTO  ·  CU17 a CU24
// =====================================================================
// listarProductos          CU18 - buscar
// crearProducto            CU17 - alta
// modificarProducto        CU19 - modificar
// eliminarProducto         CU22 - eliminar
// darDeBajaProducto        CU20 - dar de baja
// reactivarProducto        CU21 - reactivar
// publicarProducto         CU23 - publicar
// quitarProductoDelCatalogo CU24 - quitar del catálogo
//
// obtenerProducto no implementa un CU: trae la ficha completa que CU19
// necesita para cargar el formulario de edición.

export function listarProductos(params = {}) {
  return cliente.get('/productos/', { params })
}

export function obtenerProducto(id) {
  return cliente.get(`/productos/${id}/`)
}

export function crearProducto(datos) {
  return cliente.post('/productos/', datos)
}

export function modificarProducto(id, datos) {
  return cliente.put(`/productos/${id}/`, datos)
}

export function eliminarProducto(id) {
  return cliente.delete(`/productos/${id}/`)
}

export function darDeBajaProducto(id) {
  return cliente.post(`/productos/${id}/dar_de_baja/`)
}

export function reactivarProducto(id) {
  return cliente.post(`/productos/${id}/reactivar/`)
}

export function publicarProducto(id) {
  return cliente.post(`/productos/${id}/publicar/`)
}

export function quitarProductoDelCatalogo(id) {
  return cliente.post(`/productos/${id}/quitar_del_catalogo/`)
}


// =====================================================================
//  CATEGORÍAS DEL PRODUCTO  ·  CU25 a CU27
// =====================================================================
// listarCategoriasDeProducto  CU26 - listar
// asignarCategoriaAProducto   CU25 - asignar
// quitarCategoriaDeProducto   CU27 - quitar
//
// Las tres cuelgan de la misma URL. Listar y asignar comparten
// /categorias/ y se distinguen por el método; quitar lleva el id de la
// categoría en la ruta.

export function listarCategoriasDeProducto(id) {
  return cliente.get(`/productos/${id}/categorias/`)
}

export function asignarCategoriaAProducto(id, categoriaId) {
  return cliente.post(`/productos/${id}/categorias/`, { categoria: categoriaId })
}

export function quitarCategoriaDeProducto(id, categoriaId) {
  return cliente.delete(`/productos/${id}/categorias/${categoriaId}/`)
}


// =====================================================================
//  MATERIALES DEL PRODUCTO  ·  CU28 a CU31
// =====================================================================
// listarMaterialesDeProducto    CU29 - listar
// asignarMaterialAProducto      CU28 - agregar
// modificarCantidadDeMaterial   CU30 - modificar la cantidad
// quitarMaterialDeProducto      CU31 - quitar
//
// Con respecto a los ids: asignar recibe el id del MATERIAL, pero modificar y
// quitar reciben el id de la LÍNEA, que es la fila que junta el
// material con su cantidad. Son cosas distintas.

export function listarMaterialesDeProducto(id) {
  return cliente.get(`/productos/${id}/materiales/`)
}

export function asignarMaterialAProducto(id, materialId, cantidad = '') {
  return cliente.post(`/productos/${id}/materiales/`, {
    material: materialId,
    cantidad,
  })
}

export function modificarCantidadDeMaterial(id, lineaId, cantidad) {
  return cliente.patch(`/productos/${id}/materiales/${lineaId}/`, { cantidad })
}

export function quitarMaterialDeProducto(id, lineaId) {
  return cliente.delete(`/productos/${id}/materiales/${lineaId}/`)
}


// =====================================================================
//  IMÁGENES DEL PRODUCTO  ·  CU32 a CU35
// =====================================================================
// listarImagenesDeProducto    CU33 - listar
// subirImagenDeProducto       CU32 - subir
// modificarImagenDeProducto   CU34 - modificar título, tipo u orden
// borrarImagenDeProducto      CU35 - borrar
//
// Subir es el único pedido de todo el módulo que no manda JSON: lleva
// un archivo, y un archivo no entra en un JSON.

export function listarImagenesDeProducto(id) {
  return cliente.get(`/productos/${id}/imagenes/`)
}

export function subirImagenDeProducto(id, datos) {
  // FormData es el objeto del navegador que arma un cuerpo
  // multipart/form-data, el formato de los formularios con adjuntos.

  const formulario = new FormData()

  formulario.append('imagen', datos.imagen)

  // Se comparan contra undefined y no por verdadero/falso: un titulo
  // vacío y un orden 0 son valores válidos que hay que mandar igual.
  if (datos.titulo !== undefined) formulario.append('titulo', datos.titulo)
  if (datos.tipo !== undefined) formulario.append('tipo', datos.tipo)
  if (datos.orden !== undefined) formulario.append('orden', datos.orden)

  // No se le pone Content-Type a mano: ver el comentario del final.
  return cliente.post(`/productos/${id}/imagenes/`, formulario)
}

export function modificarImagenDeProducto(id, imagenId, datos) {
  return cliente.patch(`/productos/${id}/imagenes/${imagenId}/`, datos)
}

export function borrarImagenDeProducto(id, imagenId) {
  return cliente.delete(`/productos/${id}/imagenes/${imagenId}/`)
}

