// El cálculo de cada período de la pantalla de Finanzas: qué desde, qué
// hasta, qué etiqueta y cuántos meses pide el gráfico de evolución.
//
// Mismo criterio que filtros.js y presentacion.js en los otros módulos: acá
// se CALCULA y Finanzas.jsx DIBUJA. Es .js y no .jsx porque no tiene una
// sola línea de JSX.
//
// A diferencia de los filtros de los otros listados, acá el período no
// filtra una lista ya cargada: cada período es un pedido nuevo al servidor,
// porque lo que viene son sumas hechas por la base.

// Import que cruza de funcionalidad, con el mismo criterio de siempre: la
// pieza se queda en la funcionalidad donde nació y las demás la usan desde
// ahí. hoy() arma la fecha de hoy en hora local sin pasar por UTC,
// fmtFechaLarga escribe "16 sep 2026", que es como el prototipo muestra las
// fechas, y MESES son las abreviaturas que usan las dos.
import { MESES, fmtFechaLarga, hoy } from '../pedidos/presentacion'


export const PERIODOS = ['Este mes', 'Mes anterior', 'Últimos 3 meses', 'Este año', 'Personalizado']

export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Cuántos meses pide el gráfico según el chip. Personalizado no tiene un
// número fijo: pide los meses que abarca el rango, acotados por abajo y
// por arriba. El techo es el máximo que acepta el backend.
const MESES_POR_DEFECTO = 6
const MESES_ULTIMOS_TRES = 3
const MESES_DEL_ANIO = 12
const MESES_MINIMO = 3
const MESES_MAXIMO = 24


// "2026-09-16" → { anio: 2026, mes: 9 }. Sirve también para las claves
// "2026-09" de la evolución, porque el año y el mes están en el mismo lugar.
function partes(iso) {
  return { anio: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) }
}

// Arma la fecha ISO a mano, con el mes y el día en dos cifras. No se usa
// toISOString() por lo que explica el comentario de hoy(): pasa la fecha a
// UTC y después de las 21 devuelve el día siguiente.
function iso(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Cuántos días tiene el mes. Date cuenta los meses desde 0, así que `mes`
// (de 1 a 12) es para Date el mes SIGUIENTE, y el día 0 del mes siguiente
// es el último día de este. Es el mismo truco del prototipo.
function ultimoDia(anio, mes) {
  return new Date(anio, mes, 0).getDate()
}

// El mes anterior a (anio, mes), dando la vuelta en enero.
function mesAnterior(anio, mes) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}


// Cuántos meses calendario toca el rango, contando el primero y el último:
// del 15 de enero al 20 de septiembre son 9. Es el mesesEntre del prototipo.
export function mesesDelRango(desde, hasta) {
  const d = partes(desde)
  const h = partes(hasta)

  return (h.anio - d.anio) * 12 + (h.mes - d.mes) + 1
}


// Los dos motivos por los que un período personalizado todavía no se puede
// pedir. Son constantes con nombre porque la pantalla necesita distinguirlos:
// el segundo es un error y va en rojo, el primero no. Su texto es el mismo
// que devolvería el backend, para que la pantalla diga lo mismo que diría
// el servidor.
export const FALTAN_FECHAS = 'Elegí las dos fechas'
export const FECHAS_AL_REVES = 'La fecha desde no puede ser posterior a la fecha hasta.'

// Qué le falta al período personalizado para poder pedirse. Vacío cuando
// está bien.
export function problemaDelPersonalizado(desde, hasta) {
  if (!desde || !hasta) return FALTAN_FECHAS

  // Las fechas se comparan como texto y no como Date. En formato ISO eso
  // funciona, porque el año va primero y todos los campos tienen el mismo
  // largo: '2026-09-08' es menor que '2026-09-09'.
  if (desde > hasta) return FECHAS_AL_REVES

  return ''
}


// El período elegido, listo para pedir: { desde, hasta, etiqueta, meses }.
// Devuelve null si es Personalizado y todavía no se puede pedir.
//
// desde y hasta son los dos inputs del personalizado; los otros cuatro chips
// los ignoran y salen de la fecha de hoy.
export function rangoDelPeriodo(periodo, desde, hasta) {
  const { anio, mes } = partes(hoy())

  if (periodo === 'Este mes') {
    return {
      desde: iso(anio, mes, 1),
      hasta: iso(anio, mes, ultimoDia(anio, mes)),
      etiqueta: `${MESES_LARGOS[mes - 1]} ${anio}`,
      meses: MESES_POR_DEFECTO,
    }
  }

  if (periodo === 'Mes anterior') {
    const ant = mesAnterior(anio, mes)

    return {
      desde: iso(ant.anio, ant.mes, 1),
      hasta: iso(ant.anio, ant.mes, ultimoDia(ant.anio, ant.mes)),
      etiqueta: `${MESES_LARGOS[ant.mes - 1]} ${ant.anio}`,
      meses: MESES_POR_DEFECTO,
    }
  }

  if (periodo === 'Últimos 3 meses') {
    // Este mes y los dos anteriores: se retrocede dos veces.
    const unoAtras = mesAnterior(anio, mes)
    const dosAtras = mesAnterior(unoAtras.anio, unoAtras.mes)

    return {
      desde: iso(dosAtras.anio, dosAtras.mes, 1),
      hasta: iso(anio, mes, ultimoDia(anio, mes)),
      etiqueta: 'Últimos 3 meses',
      meses: MESES_ULTIMOS_TRES,
    }
  }

  if (periodo === 'Este año') {
    return {
      desde: iso(anio, 1, 1),
      hasta: iso(anio, 12, 31),
      etiqueta: `Año ${anio}`,
      meses: MESES_DEL_ANIO,
    }
  }

  // Personalizado
  if (problemaDelPersonalizado(desde, hasta) !== '') return null

  const meses = Math.min(MESES_MAXIMO, Math.max(MESES_MINIMO, mesesDelRango(desde, hasta)))

  return {
    desde,
    hasta,
    etiqueta: `${fmtFechaLarga(desde)} – ${fmtFechaLarga(hasta)}`,
    meses,
  }
}


// La clave con la que la pantalla reconoce a qué período pertenece una
// respuesta del servidor: los tres parámetros que viajaron, juntos.
export function claveDelPeriodo(rango) {
  return `${rango.desde}|${rango.hasta}|${rango.meses}`
}


// La etiqueta corta de un mes del gráfico: "sep", o "dic 25" cuando el año
// no es el del último mes de la serie, como hace el prototipo.
export function etiquetaMes(clave, anioFinal) {
  const { anio, mes } = partes(clave)

  return MESES[mes - 1] + (anio !== anioFinal ? ` ${String(anio).slice(2)}` : '')
}

// El nombre largo de un mes del gráfico, para el tooltip: "Septiembre 2026".
export function nombreMes(clave) {
  const { anio, mes } = partes(clave)

  return `${MESES_LARGOS[mes - 1]} ${anio}`
}

// El subtítulo del gráfico: "Abril – Septiembre 2026 · 6 meses, ingresos
// contra gastos". El año del primer mes se escribe solo si es distinto del
// último, como en el prototipo.
export function subtituloEvolucion(evolucion) {
  const primero = partes(evolucion[0].mes)
  const ultimo = partes(evolucion[evolucion.length - 1].mes)

  const inicio =
    MESES_LARGOS[primero.mes - 1] + (primero.anio !== ultimo.anio ? ` ${primero.anio}` : '')

  return (
    `${inicio} – ${MESES_LARGOS[ultimo.mes - 1]} ${ultimo.anio}` +
    ` · ${evolucion.length} meses, ingresos contra gastos`
  )
}
