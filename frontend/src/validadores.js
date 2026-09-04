// Validaciones que usa más de una funcionalidad, así que viven acá afuera.
//
// OJO: este límite está también en backend/config/validadores.py, y son dos
// programas distintos, así que el número está escrito dos veces. Si cambia,
// hay que cambiarlo en los dos lados.
//
// El que manda es el del backend: ese no se puede esquivar, aunque alguien
// mande el archivo por fuera de la pantalla. El de acá es una cortesía, para
// no subir 20 MB y que recién después nos los rechacen.

export const TAMANO_MAXIMO_MB = 15

const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024


// Devuelve el mensaje de error, o cadena vacía si el archivo está bien.
// El texto es el mismo que arma el backend, para que la usuaria lea lo
// mismo venga de donde venga el rechazo.
export function validarTamanoArchivo(archivo) {
  if (archivo.size <= TAMANO_MAXIMO_BYTES) return ''

  const pesa = (archivo.size / (1024 * 1024)).toFixed(1)

  return `La imagen pesa ${pesa} MB y el máximo son ${TAMANO_MAXIMO_MB} MB.`
}
