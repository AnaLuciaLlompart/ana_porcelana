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

// Recibe el total más alto, que manda el backend en el resumen del listado
// (total_maximo, como texto).
export function topeDelTotal(totalMaximo) {
  const mayor = Number(totalMaximo)
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


// Los parámetros de GET /api/pedidos/ para una página del listado
// (corrección D3): el filtrado, la búsqueda, el orden y la paginación los
// hace el backend, en PedidoViewSet._filtrar(). Acá solo se traducen los
// filtros de la pantalla a los nombres de la URL. Cada criterio vacío no
// viaja.
//
// Va en un URLSearchParams y no en un objeto común porque estado y saldo se
// repiten (?estado=LISTO&estado=PENDIENTE): con un arreglo en un objeto,
// Axios escribiría estado[]=, que Django no lee como la misma clave.
export function parametrosDelListado({ filtros, busqueda, orden, pagina, porPagina }) {
  const parametros = new URLSearchParams()

  parametros.append('pagina', pagina)
  parametros.append('por_pagina', porPagina)

  const texto = busqueda.trim()
  if (texto) parametros.append('busqueda', texto)

  if (filtros.cliente !== null) parametros.append('cliente', filtros.cliente)
  filtros.estados.forEach((estado) => parametros.append('estado', estado))
  if (filtros.entrega !== null) parametros.append('entrega', filtros.entrega.toLowerCase())
  filtros.saldo.forEach((saldo) => parametros.append('saldo', saldo.toLowerCase()))
  if (filtros.desde !== '') parametros.append('total_desde', filtros.desde)
  if (filtros.hasta !== '') parametros.append('total_hasta', filtros.hasta)

  // La columna PEDIDO se ordena por número, que en el backend se llama así.
  if (orden.campo) {
    const clave = orden.campo === 'id' ? 'numero' : orden.campo
    parametros.append('orden', orden.dir === 'desc' ? `-${clave}` : clave)
  }

  return parametros
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
