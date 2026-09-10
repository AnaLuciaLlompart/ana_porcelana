// Todo lo que comparten los archivos de la pantalla de Pedidos para
// MOSTRAR los datos: iconos, fechas y armado de textos.
//
// Los textos y las reglas de cuándo va cada uno salen del prototipo de
// diseño, no se inventan acá.
//
// Es .js y no .jsx porque no tiene una sola línea de JSX.

// El precio se formatea igual en todo el sistema, así que la función se
// importa de Productos en vez de escribirse de nuevo. Es el mismo criterio
// con el que Materiales importa listarProductos: la pieza se queda en la
// funcionalidad donde nació y las demás la usan desde ahí.
export { formatearPrecio } from '../productos/presentacion'


const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


// Los cuatro estados del pedido. Viven acá y no en el modal de filtros
// porque los usan dos archivos: el modal para los chips y la pantalla para
// la etiqueta del filtro aplicado.
export const ESTADOS = [
  { valor: 'PENDIENTE', label: 'Pendiente' },
  { valor: 'EN_PRODUCCION', label: 'En producción' },
  { valor: 'LISTO', label: 'Listo' },
  { valor: 'ENTREGADO', label: 'Entregado' },
]

// Los extremos de los deslizadores del filtro por total.
export const TOTAL_MIN = 0
export const TOTAL_MAX = 60000


// El color de cada estado en la ficha. Es el colorEstado() del prototipo,
// escrito como objeto indexado por el código que guarda el backend, que es
// la forma que ya usa COLOR_DIFICULTAD en Productos.
//
// 'solido' es el fondo del botón cuando ese estado es el actual; los otros
// tres quedan en blanco con el texto gris. 'color' y 'fondo' son los del
// chip del encabezado.
export const COLOR_ESTADO = {
  PENDIENTE: { color: '#B08791', fondo: 'white', borde: '#EBE0E2', solido: '#B08791' },
  EN_PRODUCCION: { color: '#8C5A66', fondo: 'white', borde: '#DCC9CD', solido: '#8C5A66' },
  LISTO: { color: '#8C5A66', fondo: 'white', borde: '#8C5A66', solido: '#8C5A66' },
  ENTREGADO: { color: '#4E8C6A', fondo: '#E8F5EF', borde: '#4E8C6A', solido: '#4E8C6A' },
}


export const ICONO_NUEVO = 'M12 4v16m8-8H4'

export const ICONO_BUSCAR = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'

export const ICONO_FILTROS = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'

export const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'

export const ICONO_BORRAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

// La flecha del breadcrumb de la ficha.
export const ICONO_FLECHA = 'M9 5l7 7-7 7'

// El triángulo del aviso de error de la ficha.
export const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'

// El mismo icono que Pedidos tiene en la barra lateral, igual que hacen
// Materiales, Productos y Clientes en sus estados vacíos.
export const ICONO_PEDIDOS = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'


// La fecha de hoy en ISO (aaaa-mm-dd), en hora local.
//
// Se arma a mano y NO con toISOString(), que pasa la fecha a UTC: en
// Argentina, que va tres horas atrás, después de las 21 eso devuelve el día
// siguiente, y todos los cálculos de atraso quedarían corridos un día.
export function hoy() {
  const fecha = new Date()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${fecha.getFullYear()}-${mes}-${dia}`
}

// "12/08/2026"
export function fmtFechaNum(iso) {
  if (!iso) return ''

  const partes = iso.split('-')

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

// "12 ago 2026"
export function fmtFechaLarga(iso) {
  if (!iso) return ''

  const partes = iso.split('-')

  return `${Number(partes[2])} ${MESES[Number(partes[1]) - 1]} ${partes[0]}`
}

// Cuántos días hay entre dos fechas ISO. 86400000 son los milisegundos que
// tiene un día.
function dias(desde, hasta) {
  return Math.round((new Date(hasta) - new Date(desde)) / 86400000)
}


// Cuántos días de atraso lleva el pedido, o 0 si no está atrasado.
//
// Un pedido entregado nunca está atrasado, aunque se haya entregado tarde:
// la columna pasa a mostrar cuándo se entregó.
//
// Las fechas se comparan como texto y no como Date. En formato ISO eso
// funciona, porque el año va primero y todos los campos tienen el mismo
// largo: '2026-09-08' es menor que '2026-09-09'.
export function atraso(pedido) {
  const estimada = pedido.fecha_entrega_estimada

  if (!estimada) return 0
  if (pedido.estado === 'ENTREGADO') return 0
  if (estimada >= hoy()) return 0

  return dias(estimada, hoy())
}


// Lo que dice la columna ENTREGA.
export function entregaTexto(pedido) {
  if (pedido.estado === 'ENTREGADO') {
    return pedido.fecha_entrega_real ? fmtFechaNum(pedido.fecha_entrega_real) : 'Sin fecha'
  }

  if (!pedido.fecha_entrega_estimada) return 'Sin fecha'

  const atrasado = atraso(pedido)

  if (atrasado > 0) {
    return atrasado === 1 ? 'Atrasado 1 día' : `Atrasado ${atrasado} días`
  }

  const faltan = dias(hoy(), pedido.fecha_entrega_estimada)

  if (faltan === 0) return 'Hoy'
  if (faltan === 1) return 'Mañana'

  return `En ${faltan} días`
}


// El tooltip de esa misma columna, que aclara de qué fecha se está
// hablando: la real si ya se entregó, la estimada si todavía no.
export function entregaTitle(pedido) {
  if (pedido.estado === 'ENTREGADO') {
    return pedido.fecha_entrega_real
      ? `Entregado el ${fmtFechaLarga(pedido.fecha_entrega_real)}`
      : 'Sin fecha de entrega'
  }

  return pedido.fecha_entrega_estimada
    ? `Entrega estimada: ${fmtFechaLarga(pedido.fecha_entrega_estimada)}`
    : 'Sin fecha de entrega estimada'
}


// Lo que muestra la columna CONTENIDO: el primer producto, un «+N» con los
// que siguen, y el tooltip con todos.
//
// El backend manda en productos_nombres los nombres DISTINTOS, así que el
// +N ya viene bien contado: un pedido con la misma pieza en dos colores
// dice +1, no +2.
export function contenido(pedido) {
  const nombres = pedido.productos_nombres

  if (nombres.length === 0) {
    return { texto: 'Sin productos', resto: '', title: 'Sin productos' }
  }

  return {
    texto: nombres[0],
    resto: nombres.length > 1 ? `+${nombres.length - 1}` : '',
    title: nombres.join(' · '),
  }
}
