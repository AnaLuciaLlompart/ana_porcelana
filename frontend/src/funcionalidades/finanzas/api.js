import cliente from '../../api/cliente'

// Una función por endpoint del backend.

// =====================================================================
//  FINANZAS  ·  CU61 y CU62
// =====================================================================
// obtenerFinanzas   CU61 - visualizar gastos de un período de tiempo
//                   CU62 - visualizar ingresos de un período de tiempo
//
// Un solo endpoint para los dos casos de uso: la pantalla muestra los
// ingresos y los gastos del mismo período, uno al lado del otro, y el
// backend devuelve todo en una respuesta. Los tres parámetros viajan en
// la URL: desde y hasta son el período (inclusivos los dos) y meses es
// cuántos meses tiene el gráfico de evolución.

export function obtenerFinanzas({ desde, hasta, meses }) {
  return cliente.get('/finanzas/', { params: { desde, hasta, meses } })
}
