// Todo lo que comparten los archivos de la pantalla de Gastos para MOSTRAR
// los datos: los tipos del filtro, los iconos y el formato de la plata y de
// las fechas.
//
// Es .js y no .jsx porque no tiene una sola línea de JSX.

// Imports que cruzan de funcionalidad, con el mismo criterio de siempre: la
// pieza se queda en la funcionalidad donde nació y las demás la usan desde
// ahí. El precio se formatea igual en todo el sistema y nació en Productos;
// la fecha "8 sep 2026" es la misma del listado de Clientes y nació en
// Pedidos, igual que hoy(), que da la fecha con la que nace un alta.
//
// Se importan Y se re-exportan, como hace pedidos/presentacion.js, para que
// los archivos de Gastos las pidan todas de acá y el cruce quede escrito
// una sola vez.
import { formatearPrecio } from '../productos/presentacion'
import { fmtFechaLarga, hoy } from '../pedidos/presentacion'

export { formatearPrecio, fmtFechaLarga, hoy }


// Los tres tipos de gasto, con los códigos del backend.
//
// Esta lista es para ELEGIR un tipo, no para mostrar el de un gasto: dibuja
// las tres opciones del modal de filtros, la etiqueta del chip del filtro
// aplicado y los tres segmentos del formulario de la ficha. Las tres cosas
// tienen que existir aunque todavía no haya ningún gasto de ese tipo. Donde
// se MUESTRA el tipo de un gasto —la tabla, el buscador, el subtítulo de la
// ficha— va el tipo_display que ya manda el backend.
//
// Viven acá y no en el modal porque la usan varios archivos, igual que los
// ESTADOS de Pedidos.
export const TIPOS = [
  { valor: 'MATERIALES', label: 'Materiales' },
  { valor: 'PUBLICIDAD', label: 'Publicidad' },
  { valor: 'OTRO', label: 'Otro' },
]


// El color de la disponibilidad en la tabla de materiales del gasto. Es el
// del diseño: lo que falta en rojo, lo que sobra en verde, y Media sin
// resaltar. Va indexado por el código que guarda el backend, como
// COLOR_ESTADO en Pedidos; el texto que se muestra es el
// material_disponibilidad_display.
export const COLOR_DISPONIBILIDAD = {
  BAJA: '#C0442F',
  MEDIA: '#3D3238',
  ALTA: '#4E8C6A',
}


// El backend contesta de dos formas según qué falló: las reglas de negocio
// mandan {'detail': '...'} y los errores de campo mandan
// {'monto': ['El monto del gasto tiene que ser mayor a cero.']}. Hay que
// mirar las dos para no tragarse el mensaje.
//
// Es la misma función que DetallePedido tiene adentro. Acá va en este
// archivo porque la usan dos: la ficha y el modal de material.
export function mensajeDeError(err) {
  const datos = err.response?.data
  if (!datos) return 'No se pudo completar la acción.'
  if (datos.detail) return datos.detail

  const primerCampo = Object.values(datos)[0]
  if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0]

  return 'No se pudo completar la acción.'
}


export const ICONO_NUEVO = 'M12 4v16m8-8H4'

export const ICONO_BUSCAR = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'

export const ICONO_FILTROS = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'

export const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'

export const ICONO_BORRAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

// El triángulo de la cabecera del modal de eliminar.
export const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'

// La flecha del breadcrumb de la ficha.
export const ICONO_FLECHA = 'M9 5l7 7-7 7'

// El más del botón de agregar, el lápiz de editar y la cruz de quitar, en
// la tabla de materiales del gasto. Son los mismos de los productos del
// pedido.
export const ICONO_MAS = 'M12 5v14m7-7H5'

export const ICONO_EDITAR = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'

export const ICONO_CRUZ = 'M6 18L18 6M6 6l12 12'

// La flecha hacia arriba de marcar en disponibilidad Alta.
export const ICONO_SUBIR = 'M5 10l7-7m0 0l7 7m-7-7v18'

// El mismo icono que Gastos tiene en la barra lateral, igual que hacen los
// otros módulos en sus estados vacíos.
export const ICONO_GASTOS = 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
