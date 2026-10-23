// Todo lo que comparten los archivos del catálogo público para MOSTRAR los
// datos: colores, iconos y armado de textos. Los valores y los textos
// salen del diseño (disenio/Catalogo.dc.html), no se inventan acá.
//
// Es .js y no .jsx porque no tiene una sola línea de JSX.

// El precio ("$6.500") se escribe igual que en la gestión, así que la
// función se importa de Productos en vez de escribirse de nuevo, con el
// mismo criterio que Pedidos y Gastos. Se importa Y se re-exporta para que
// los archivos del catálogo la tomen de acá.
import { formatearPrecio } from '../productos/presentacion'

export { formatearPrecio }


export const QUICKSAND = "'Quicksand', sans-serif"

export const ICONO_FILTROS = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'

export const ICONO_CERRAR = 'M6 18L18 6M6 6l12 12'

export const ICONO_LUPA = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'

export const ICONO_VOLVER = 'M15 19l-7-7 7-7'

export const ICONO_TILDE = 'M5 13l4 4L19 7'

export const ICONO_MAS = 'M12 4v16m8-8H4'

export const ICONO_MENOS = 'M5 12h14'

// El tachito: en el contador del detalle reemplaza al − cuando queda una
// sola pieza, porque restar ahí es sacarla de la selección.
export const ICONO_TACHO = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

export const ICONO_COPIAR = 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'

// El corazón de "Mi selección": el del encabezado y el del estado vacío.
export const ICONO_CORAZON = 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'

// La cámara del lugar vacío de una foto. Son el cuerpo y el lente en un
// solo trazo, para dibujarla con un único <path>.
export const ICONO_CAMARA = 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z'


// Cuántos de los tres círculos de la dificultad de elaboración van llenos,
// por el código que manda el backend. El catálogo no usa colores para la
// dificultad: el detalle la muestra con el texto y los círculos, y la
// tarjeta no la muestra.
export const NIVEL_DIFICULTAD = { BAJA: 1, MEDIA: 2, ALTA: 3 }


// El fondo del lugar de la foto: se ve entero cuando el producto no tiene
// ninguna, y un instante mientras la foto carga. Son cuatro celestes muy
// parecidos y a cada producto le toca siempre el mismo, según su id, para
// que la grilla no quede toda del mismo tono.
const TINTES = ['#E2EAF0', '#E8EEF2', '#DDE6EC', '#E5ECEF']

export function tinteDe(producto) {
  return TINTES[producto.id % TINTES.length]
}


export function textoPiezas(cantidad) {
  return cantidad === 1 ? '1 pieza' : `${cantidad} piezas`
}


// El estado vacío de la selección, que se muestra igual en /seleccion y en
// /mensaje. Son las props de CajaMensaje, listas para expandir con {...}.
export const TEXTOS_SELECCION_VACIA = {
  titulo: 'Todavía no elegiste ningún producto',
  texto: 'Recorré el catálogo y agregá lo que te guste.',
  textoSalida: 'Ver el catálogo',
  ruta: '/',
}
