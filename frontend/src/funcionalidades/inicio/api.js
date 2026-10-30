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

// Las tres listas de la pantalla, de a una página (corrección D3): de a 8
// las piezas y las entregas, de a 6 los materiales. Las piezas aceptan
// además la etapa del chip elegido.
export function listarPiezasEnProduccion(params = {}) {
  return cliente.get('/inicio/en_produccion/', { params })
}

export function listarProximasEntregas(params = {}) {
  return cliente.get('/inicio/entregas/', { params })
}

export function listarMaterialesPorReponer(params = {}) {
  return cliente.get('/inicio/materiales/', { params })
}
