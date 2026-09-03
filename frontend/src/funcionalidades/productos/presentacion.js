// Todo lo que comparten los archivos de la pantalla de Productos para
// MOSTRAR los datos: iconos, colores y armado de textos.
//
// Nada de esto decide una regla de negocio. Las reglas ya vienen
// resueltas del backend, en visible_en_catalogo, oculto_por_categoria y
// categorias_de_baja; acá solo se traducen a lo que se ve.
//
// Es .js y no .jsx porque no tiene una sola línea de JSX.


export const ICONO_NUEVO = 'M12 4v16m8-8H4'

export const ICONO_CAJA = 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'

export const ICONO_BUSCAR = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'

export const ICONO_FILTROS = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'

export const ICONO_IMAGEN = 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'

export const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'

export const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'

export const ICONO_BAJA = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'

export const ICONO_BORRAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

export const ICONO_ALTA = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'

export const ICONO_TIPO = 'M4 6h16M4 12h16M4 18h7'

export const ICONO_TEMA = 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'

export const ICONO_GRILLA = 'M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z'

export const ICONO_LISTA = 'M4 6h16M4 12h16M4 18h16'

export const CHEVRON_ABAJO = 'M19 9l-7 7-7-7'

export const CHEVRON_ARRIBA = 'M5 15l7-7 7 7'

export const CHEVRON_DERECHA = 'M9 5l7 7-7 7'

export const ORDEN_SIN_USAR = 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'

export const COLOR_DIFICULTAD = {
  BAJA: { color: '#4E8C6A', fondo: '#E8F5EF' },
  MEDIA: { color: '#D9A441', fondo: '#FDF3E0' },
  ALTA: { color: '#8C5A66', fondo: '#F0E2E4' },
}

// El precio llega del backend como texto ("5500.00"), no como número: DRF
// serializa los Decimal así para que no pierdan precisión al pasar por el
// float de JavaScript. Hay que convertirlo para poder formatearlo.
export function formatearPrecio(texto) {
  return '$' + Math.round(Number(texto)).toLocaleString('es-AR')
}

// Por qué esta pieza no se ve en el catálogo. Lo usan el title del chip de
// la tarjeta y el aviso rojo de la ficha.
export function motivoFuera(producto) {
  const bajas = producto.categorias_de_baja
  if (bajas.length === 0) return ''

  const nombres = bajas.map((c) => `“${c.nombre}”`).join(', ')

  return bajas.length === 1
    ? `No aparece en el catálogo porque su categoría ${nombres} está dada de baja.`
    : `No aparece en el catálogo porque sus categorías ${nombres} están dadas de baja.`
}


// La etiqueta de catálogo. El backend ya manda visible_en_catalogo y
// oculto_por_categoria calculados, así que la regla de visibilidad no se
// repite acá: solo se elige qué mostrar según lo que llegó.

export function estadoCatalogo(producto) {
  if (producto.estado !== 'ACTIVO') {
    return {
      texto: 'Dado de baja',
      color: '#C0442F',
      fondo: '#FAEAE8',
      title: 'Este producto está dado de baja',
    }
  }

  if (producto.es_personalizado) {
    return {
      texto: 'Personalizado',
      color: '#8C5A66',
      fondo: '#F0E2E4',
      title: 'Personalizado, fuera del catálogo',
    }
  }

  if (producto.visible_en_catalogo) {
    return {
      texto: 'En catálogo',
      color: '#4E8C6A',
      fondo: '#E8F5EF',
      title: 'Visible en el catálogo público',
    }
  }

  if (producto.oculto_por_categoria) {
    return {
      texto: 'Categoría de baja',
      color: '#D9A441',
      fondo: '#FDF3E0',
      title: motivoFuera(producto),
    }
  }

  return { texto: 'Sin publicar', color: '#857078', fondo: '#FAF7F7', title: '' }
}


// La misma etiqueta, pero para la ficha. Son dos funciones y no una porque
// difieren en dos cosas:
//
// - La ficha muestra el estado en un chip aparte, así que acá no va la rama
//   "Dado de baja": sería repetir al lado lo que ya dice el otro chip.
// - En la ficha hay lugar, así que el texto de personalizado es el largo.
export function estadoCatalogoFicha(producto) {
  if (producto.es_personalizado) {
    return {
      texto: 'Personalizado, fuera del catálogo',
      color: '#8C5A66',
      fondo: '#F0E2E4',
    }
  }

  if (producto.visible_en_catalogo) {
    return { texto: 'En catálogo', color: '#4E8C6A', fondo: '#E8F5EF' }
  }

  if (producto.oculto_por_categoria) {
    return { texto: 'Categoría de baja', color: '#D9A441', fondo: '#FDF3E0' }
  }

  return { texto: 'Sin publicar', color: '#857078', fondo: '#FAF7F7' }
}


export function avisoMateriales(producto) {
  const discontinuados = producto.materiales_discontinuados
  if (discontinuados.length === 0) return ''

  return discontinuados.length === 1
    ? `Usa un material discontinuado: ${discontinuados[0]}`
    : `Usa ${discontinuados.length} materiales discontinuados`
}

export function textoDificultad(producto) {
  return `Dificultad ${producto.dificultad_display.toLowerCase()}`
}

export function textoMeta(producto) {
  return `${formatearPrecio(producto.precio_actual)} · dificultad ${producto.dificultad_display.toLowerCase()}`
}

export function accionesDe(producto, { onVer, onDarDeBaja, onEliminar }) {
  return [
    { title: 'Ver y editar', icono: ICONO_VER, color: '#8C5A66', hover: '#F0E2E4', onClick: () => onVer(producto) },
    { title: 'Dar de baja', icono: ICONO_BAJA, color: '#D9A441', hover: '#FDF3E0', onClick: () => onDarDeBaja(producto) },
    { title: 'Eliminar', icono: ICONO_BORRAR, color: '#C0442F', hover: '#FAEAE8', onClick: () => onEliminar(producto) },
  ]
}
