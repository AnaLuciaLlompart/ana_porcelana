// Lo que comparten las pantallas de la gestión de usuarios: los cuatro
// datos del formulario, el chip de ESTADO y el formato de las fechas.

// Import que cruza de funcionalidad, con el criterio de siempre: la fecha
// se escribe igual que en Pedidos y Clientes, desde donde nació.
import { fmtFechaLarga } from '../pedidos/presentacion'

// Los cuatro datos de un usuario, definidos una sola vez. Son los mismos en
// el alta, en la edición, en Mis datos y en el modal Ver, y los cuatro son
// obligatorios.
export const CAMPOS = [
  { clave: 'username', etiqueta: 'USUARIO', max: 150, placeholder: 'Con el que inicia sesión' },
  { clave: 'first_name', etiqueta: 'NOMBRE', max: 150, placeholder: '' },
  { clave: 'last_name', etiqueta: 'APELLIDO', max: 150, placeholder: '' },
  { clave: 'email', etiqueta: 'CORREO', max: 254, placeholder: 'nombre@correo.com' },
]

// El chip de ESTADO. La superadministradora no es Activo ni Baja: su fila
// dice el rol, en rosa, porque desde acá no se gestiona.
const CHIP_ESTADO = {
  superadministradora: { texto: 'Superadministradora', color: '#8C5A66', fondo: '#F0E2E4', borde: '#B08791' },
  activo: { texto: 'Activo', color: '#4E8C6A', fondo: '#E8F5EF', borde: '#4E8C6A' },
  baja: { texto: 'Baja', color: '#C0442F', fondo: '#FAEAE8', borde: '#C0442F' },
}

export function chipEstado(usuario) {
  if (usuario.es_superadministradora) return CHIP_ESTADO.superadministradora
  return usuario.is_active ? CHIP_ESTADO.activo : CHIP_ESTADO.baja
}

// "4 nov 2026, 18:32". El backend manda la fecha y hora ya en la zona
// horaria del proyecto, así que alcanza con cortar el texto: los diez
// primeros caracteres son la fecha y los cinco que siguen a la T, la hora.
export function fmtFechaHora(iso) {
  if (!iso) return ''
  return `${fmtFechaLarga(iso.slice(0, 10))}, ${iso.slice(11, 16)}`
}
