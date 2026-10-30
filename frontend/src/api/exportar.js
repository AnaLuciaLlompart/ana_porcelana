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


// El nombre del archivo, del Content-Disposition que manda el backend
// (attachment; filename="pedidos-2026-10-29.xlsx", o inline para un PDF),
// así está escrito en un solo lugar. Si no viene, porDefecto.
export function nombreDelArchivo(respuesta, porDefecto) {
  const cabecera = respuesta.headers['content-disposition'] || ''
  const encontrado = cabecera.match(/filename="(.+)"/)
  return encontrado ? encontrado[1] : porDefecto
}


// Si el navegador puede compartir un PDF con el menú de compartir del
// teléfono (corrección E11). canShare responde sobre lo que se le pasa, así
// que se le pregunta por un PDF vacío; si ni existe, no se puede.
export function puedeCompartirArchivos() {
  if (typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [new File([], 'comprobante.pdf', { type: 'application/pdf' })] })
}


// Baja un PDF con pedirArchivo (una función de api.js que lo trae como blob)
// y lo manda al menú de compartir del teléfono (corrección E11). Devuelve ''
// si salió bien, si la usuaria cerró el menú sin elegir nada (AbortError) o
// si no había sesión (el interceptor ya está llevando al login); si no, el
// mensaje para el aviso de error.
export async function compartirArchivo(pedirArchivo, titulo) {
  try {
    const respuesta = await pedirArchivo()
    const archivo = new File([respuesta.data], nombreDelArchivo(respuesta, 'comprobante.pdf'), {
      type: 'application/pdf',
    })
    await navigator.share({ files: [archivo], title: titulo })
    return ''
  } catch (err) {
    if (err.name === 'AbortError' || err.response?.status === 403) return ''
    return 'No se pudo compartir el comprobante.'
  }
}
