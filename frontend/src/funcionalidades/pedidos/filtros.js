// El filtrado del listado de Pedidos, escrito una sola vez.
//
// Mismo criterio que el filtros.js de Materiales: acá se DECIDE qué pedidos
// entran en la lista, y lo usan dos lugares con la misma función.
// Pedidos.jsx con los filtros ya aplicados, para armar la tabla, y
// ModalFiltros.jsx con el borrador, para el contador en vivo del pie. Así
// no hay dos versiones de la misma regla que puedan quedar distintas.
//
// El filtro por saldo del prototipo NO está: depende de Cobros, que es el
// módulo siguiente.

import { hoy } from './presentacion'


// Cuántos días abarca "próximos", contando hoy: hoy, mañana y pasado. Tiene
// que ser el mismo número que DIAS_ENTREGAS_PROXIMAS en
// backend/inicio/views.py, que es con el que cuenta la tarjeta de Inicio: si
// cambia uno, cambia el otro, o la tarjeta y el listado dirían cosas
// distintas.
export const DIAS_ENTREGAS_PROXIMAS = 3

// Las dos opciones del filtro por entrega, excluyentes. Las usan el modal
// para los chips y la pantalla para la etiqueta del filtro aplicado. Viven
// acá y no en presentacion.js, donde están ESTADOS y OPCIONES_SALDO, porque
// la etiqueta se arma con DIAS_ENTREGAS_PROXIMAS, y presentacion.js no puede
// importar de este archivo sin que los dos se importen entre sí.
export const OPCIONES_ENTREGA = [
  { valor: 'ATRASADOS', label: 'Atrasados' },
  { valor: 'PROXIMOS', label: `Próximos ${DIAS_ENTREGAS_PROXIMAS} días` },
]


// El paso de los deslizadores del filtro por total y su tope, que sale de
// los pedidos cargados con el mismo criterio que montoMaximo en Gastos: el
// más caro, redondeado hacia arriba a mil. Un tope fijo envejece el día que
// se carga un pedido más caro, y el texto del modal mentiría.
export const PASO = 1000

export function totalMaximo(pedidos) {
  // El 0 de adelante hace que Math.max no devuelva -Infinity sin pedidos.
  const mayor = Math.max(0, ...pedidos.map((p) => Number(p.total)))
  const tope = Math.ceil(mayor / PASO) * PASO

  // Sin pedidos, o con todos en cero, el tope caería en 0: un deslizador
  // sin recorrido. Se le da un paso de aire.
  return tope === 0 ? PASO : tope
}


export const FILTROS_VACIOS = {
  // Un id, no una lista: de clientes se elige uno solo.
  cliente: null,
  estados: [],
  // Un valor o null, no una lista: atrasado y próximo son excluyentes, así
  // que se elige uno, el otro o ninguno.
  entrega: null,
  // Una lista como los estados: el diseño deja marcar las dos opciones
  // a la vez, aunque eso no devuelva nada.
  saldo: [],
  // Los extremos del rango de total. Vacío significa "sin límite de este
  // lado", que no es lo mismo que cero: cero es un total válido.
  desde: '',
  hasta: '',
}


// La fecha de hoy más N días, en ISO y en hora local. Se arma a mano con
// getFullYear, getMonth y getDate, igual que hoy() en presentacion.js, y no
// con toISOString(), que pasa a UTC y después de las 21 devolvería el día
// siguiente. setDate se encarga solo del cambio de mes y de año.
function hoyMasDias(cantidad) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + cantidad)

  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${fecha.getFullYear()}-${mes}-${dia}`
}


// El filtro de ENTREGA. Es la MISMA regla que usa backend/inicio/views.py
// para las dos tarjetas de Inicio, escrita para el navegador: si cambia
// una, cambia la otra. Un pedido Entregado no está atrasado ni se va a
// entregar, y uno sin fecha estimada tampoco: los dos quedan afuera de las
// dos opciones. Atrasado es el que tiene la fecha estimada antes de hoy;
// próximo, el que la tiene entre hoy y el último día de la ventana, los dos
// inclusive. Las fechas se comparan como texto en ISO, como hace atraso()
// en presentacion.js.
function cumpleEntrega(pedido, entrega, hoyIso, ultimoDia) {
  const estimada = pedido.fecha_entrega_estimada

  if (pedido.estado === 'ENTREGADO') return false
  if (!estimada) return false

  if (entrega === 'ATRASADOS') return estimada < hoyIso

  return hoyIso <= estimada && estimada <= ultimoDia
}


// La lista lista para mostrar. Cada criterio vacío no filtra nada.
export function candidatos(pedidos, filtros, busqueda = '') {
  const texto = busqueda.trim().toLowerCase()

  // Hoy y el último día de "próximos" se calculan una vez por llamada, no
  // una vez por pedido.
  const hoyIso = hoy()
  const ultimoDia = hoyMasDias(DIAS_ENTREGAS_PROXIMAS - 1)

  return pedidos.filter((p) => {
    if (texto) {
      // El número va con el numeral adelante, así que buscar "#43" y
      // buscar "43" encuentran los dos.
      const buscable = `#${p.id} ${p.cliente_instagram} ${p.cliente_nombre} ${p.productos_nombres.join(' ')}`

      if (!buscable.toLowerCase().includes(texto)) return false
    }

    if (filtros.cliente !== null && p.cliente !== filtros.cliente) return false

    if (filtros.estados.length > 0 && !filtros.estados.includes(p.estado)) return false

    if (filtros.entrega !== null && !cumpleEntrega(p, filtros.entrega, hoyIso, ultimoDia)) return false

    // Las dos opciones del saldo son EXCLUSIONES, no una unión: cada una
    // saca lo que no cumple. Por eso marcar las dos no devuelve nada, que
    // es lo que hace el diseño.
    //
    // "Al día" incluye a los que pagaron de más: el que abonó de sobra
    // tampoco debe nada.
    const saldo = Number(p.saldo)

    if (filtros.saldo.includes('PENDIENTE') && saldo <= 0) return false
    if (filtros.saldo.includes('AL_DIA') && saldo > 0) return false

    // El total llega como TEXTO ("15500.00"): DRF serializa así los Decimal
    // para que no pierdan precisión al pasar por el número de JavaScript.
    // Hay que convertirlo para compararlo con los valores de los
    // deslizadores.
    const total = Number(p.total)

    if (filtros.desde !== '' && total < Number(filtros.desde)) return false
    if (filtros.hasta !== '' && total > Number(filtros.hasta)) return false

    return true
  })
}


// Cuántos criterios hay puestos, para el globito del botón. El rango de
// total cuenta como uno solo, aunque tenga dos extremos.
export function contarFiltros(filtros) {
  return (
    (filtros.cliente !== null ? 1 : 0) +
    filtros.estados.length +
    (filtros.entrega !== null ? 1 : 0) +
    filtros.saldo.length +
    (filtros.desde !== '' || filtros.hasta !== '' ? 1 : 0)
  )
}


// Los filtros con los que se entra desde las tarjetas de Inicio:
// ?entrega=atrasados, ?entrega=proximos y ?saldo=pendiente. Cualquier otro
// valor se ignora y la pantalla abre sin filtros. Se lee una sola vez, al
// montar Pedidos, y después la URL no se vuelve a leer ni a escribir, como
// hace Productos con ?categoria=.
export function leerFiltrosDeLaUrl(parametros) {
  const filtros = { ...FILTROS_VACIOS }
  const entrega = parametros.get('entrega')

  if (entrega === 'atrasados') filtros.entrega = 'ATRASADOS'
  if (entrega === 'proximos') filtros.entrega = 'PROXIMOS'
  if (parametros.get('saldo') === 'pendiente') filtros.saldo = ['PENDIENTE']

  return filtros
}
