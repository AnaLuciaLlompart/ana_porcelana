import cliente from './cliente'

// Lo que comparten las funciones de exportar de cada api.js (corrección
// E10 del tutor). ruta es la del listado, escrita como en las demás
// funciones ('/pedidos/'); parametros, los del listado sin la página.

// El PDF se abre en otra pestaña con una dirección común, que no pasa por
// cliente: por eso el /api va escrito acá, como en urlComprobante.
export function urlDeExportacionPdf(ruta, parametros) {
  const conFormato = new URLSearchParams(parametros)
  conFormato.set('formato', 'pdf')
  return `/api${ruta}exportar/?${conFormato}`
}

// El Excel pasa por cliente, para que un 403 lo atrape el interceptor y un
// 400 se muestre en la pantalla. Llega como blob, el archivo tal cual.
export function pedirExportacionExcel(ruta, parametros) {
  const conFormato = new URLSearchParams(parametros)
  conFormato.set('formato', 'excel')
  return cliente.get(`${ruta}exportar/`, { params: conFormato, responseType: 'blob' })
}
