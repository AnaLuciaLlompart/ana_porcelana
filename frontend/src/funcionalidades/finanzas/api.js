import cliente from '../../api/cliente'
import { pedirExportacionExcel, urlDeExportacionPdf } from '../../api/exportar'

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

// El mismo período en PDF o Excel (corrección E10 del tutor), con los mismos
// tres parámetros. Lo que hacen está en api/exportar.js, común con los
// listados: el PDF es una dirección para abrir en otra pestaña y el Excel
// se pide con cliente.
export function urlExportarFinanzasPdf({ desde, hasta, meses }) {
  return urlDeExportacionPdf('/finanzas/', { desde, hasta, meses })
}

export function exportarFinanzasAExcel({ desde, hasta, meses }) {
  return pedirExportacionExcel('/finanzas/', { desde, hasta, meses })
}
