import cliente from '../../api/cliente'

// Una función por endpoint del backend.

// =====================================================================
//  INICIO
// =====================================================================
// obtenerInicio   el resumen del día para la pantalla de Inicio
//
// No implementa un caso de uso: resume datos de los módulos que ya
// existen. Un solo endpoint sin parámetros, que devuelve el hoy del
// servidor, los cuatro totales y las tres listas ya recortadas, cada una
// con su total.

export function obtenerInicio() {
  return cliente.get('/inicio/')
}
