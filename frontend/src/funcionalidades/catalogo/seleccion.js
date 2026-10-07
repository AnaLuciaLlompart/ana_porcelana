// La selección y el mensaje de consulta (CU66 a CU70).
//
// La selección vive en el navegador y en ningún otro lado: no hay carrito
// ni pedido en el servidor. Son dos cosas: las cantidades, un objeto
// { [idProducto]: cantidad } como el del diseño, y el texto de las
// aclaraciones. Se guardan en localStorage para que sobrevivan a recargar
// la página y a cerrar la pestaña.
//
// Solo se guardan ids y cantidades. El nombre, el precio y la foto de cada
// producto salen de la lista que el layout ya tiene, así un producto que
// dejó de ser visible desaparece de la selección solo, sin error.
//
// Acá están las funciones puras: reciben y devuelven, no tocan ningún
// estado de React. El estado y las funciones que lo cambian viven en
// LayoutPublico, que llama a estas. Es .js y no .jsx porque no tiene JSX,
// y por eso se puede probar con Node, como filtros.js.

import { formatearPrecio } from './presentacion'

// La clave bajo la que se guarda en localStorage. Es propia del catálogo:
// la gestión no usa localStorage.
const CLAVE = 'catalogo-seleccion'

export const CANTIDAD_MAXIMA = 99

export const LARGO_MAXIMO_ACLARACIONES = 500


function seleccionVacia() {
  return { cantidades: {}, aclaraciones: '' }
}

function esEnteroEntre(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

// Deja de las cantidades guardadas solo las entradas que sirven: la clave
// tiene que ser un id (un entero positivo) y el valor una cantidad entre 1
// y el máximo. Lo demás se descarta sin avisar: es lo que puede dejar un
// valor editado a mano o una versión vieja de este código.
function revisarCantidades(valor) {
  if (typeof valor !== 'object' || valor === null) return {}

  const limpias = {}
  for (const [clave, cantidad] of Object.entries(valor)) {
    const id = Number(clave)
    if (esEnteroEntre(id, 1, Number.MAX_SAFE_INTEGER) && esEnteroEntre(cantidad, 1, CANTIDAD_MAXIMA)) {
      limpias[clave] = cantidad
    }
  }

  return limpias
}


// Lee lo guardado. Devuelve { cantidades, aclaraciones } ya revisado, o
// vacío si no hay nada, si el navegador no deja leer localStorage o si lo
// guardado no se puede entender.
export function leerSeleccionGuardada() {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(CLAVE))

    if (typeof guardado !== 'object' || guardado === null) return seleccionVacia()

    return {
      cantidades: revisarCantidades(guardado.cantidades),
      aclaraciones: typeof guardado.aclaraciones === 'string'
        ? guardado.aclaraciones.slice(0, LARGO_MAXIMO_ACLARACIONES)
        : '',
    }
  } catch {
    return seleccionVacia()
  }
}


// Guarda las dos cosas bajo la clave. Si no puede, no hace nada: la
// selección vive igual mientras la pestaña esté abierta.
export function guardarSeleccion(cantidades, aclaraciones) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ cantidades, aclaraciones }))
  } catch {
    // Sin localStorage (bloqueado o lleno) no hay dónde guardar.
  }
}


// CU67. Deja al producto en esa cantidad, acotada entre 1 y el máximo.
// Devuelve un objeto nuevo: el que recibe no se toca.
export function modificar(cantidades, id, cantidad) {
  const acotada = Math.min(Math.max(cantidad, 1), CANTIDAD_MAXIMA)
  return { ...cantidades, [id]: acotada }
}

// CU66. Suma 1 al producto, o lo agrega con 1 si no estaba.
export function agregar(cantidades, id) {
  return modificar(cantidades, id, (cantidades[id] || 0) + 1)
}

// CU68. Saca al producto.
export function quitar(cantidades, id) {
  const restantes = { ...cantidades }
  delete restantes[id]
  return restantes
}


// Los ítems de la selección: { producto, cantidad } por cada id que
// todavía está entre los productos visibles, en el orden del catálogo. Un
// id que ya no está entre los productos se ignora, como hace
// itemsSeleccion() del diseño: no es un error, el producto dejó de
// mostrarse. Lo guardado no se toca, así que si vuelve al catálogo vuelve
// a la selección.
export function itemsDeLaSeleccion(cantidades, productos) {
  return productos
    .filter((producto) => cantidades[producto.id] > 0)
    .map((producto) => ({ producto, cantidad: cantidades[producto.id] }))
}

// La suma de las cantidades: el número del contador del encabezado.
export function cantidadTotal(items) {
  return items.reduce((suma, item) => suma + item.cantidad, 0)
}

// La suma de precio por cantidad, como número. El precio llega del backend
// como texto ("5500.00"), por eso el Number().
export function totalOrientativo(items) {
  return items.reduce(
    (suma, { producto, cantidad }) => suma + Number(producto.precio_actual) * cantidad,
    0,
  )
}


// CU70. El texto del mensaje de consulta, con el formato exacto de
// textoSeleccion() del diseño: el saludo, una línea por pieza, las
// aclaraciones solo si hay, el total y el saludo final.
export function textoDelMensaje(items, aclaraciones) {
  const lineas = items.map(({ producto, cantidad }) =>
    `• ${cantidad} × ${producto.nombre} — ${formatearPrecio(Number(producto.precio_actual) * cantidad)}`
  )

  let texto = 'Hola Ana! Te consulto por estas piezas del catálogo:\n\n' + lineas.join('\n')

  if (aclaraciones.trim()) texto += '\n\nAclaraciones: ' + aclaraciones.trim()

  texto += '\n\nTotal orientativo: ' + formatearPrecio(totalOrientativo(items)) + '\n\nGracias!'

  return texto
}
