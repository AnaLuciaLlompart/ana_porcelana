import { useEffect, useState } from 'react'
import { listarProductos, reactivarProducto } from './api'


const ICONO_NUEVO = 'M12 4v16m8-8H4'
const ICONO_CAJA = 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
const ICONO_BUSCAR = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
const ICONO_FILTROS = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
const ICONO_IMAGEN = 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const ICONO_BAJA = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
const ICONO_BORRAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
const ICONO_ALTA = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
const ICONO_TIPO = 'M4 6h16M4 12h16M4 18h7'
const ICONO_TEMA = 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
const ICONO_GRILLA = 'M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z'
const ICONO_LISTA = 'M4 6h16M4 12h16M4 18h16'

const CHEVRON_ABAJO = 'M19 9l-7 7-7-7'
const CHEVRON_ARRIBA = 'M5 15l7-7 7 7'
const CHEVRON_DERECHA = 'M9 5l7 7-7 7'
const ORDEN_SIN_USAR = 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'


const COLOR_DIFICULTAD = {
  BAJA: { color: '#4E8C6A', fondo: '#E8F5EF' },
  MEDIA: { color: '#D9A441', fondo: '#FDF3E0' },
  ALTA: { color: '#8C5A66', fondo: '#F0E2E4' },
}

// Para ordenar por dificultad hay que decir el orden a mano: alfabéticamente
// daría ALTA, BAJA, MEDIA, que no significa nada.
const ORDEN_DIFICULTAD = { BAJA: 0, MEDIA: 1, ALTA: 2 }

const ORDENES = [
  { valor: '', label: 'Sin ordenar' },
  { valor: 'nombre:asc', label: 'Nombre A–Z' },
  { valor: 'nombre:desc', label: 'Nombre Z–A' },
  { valor: 'precio:asc', label: 'Precio: menor primero' },
  { valor: 'precio:desc', label: 'Precio: mayor primero' },
  { valor: 'dificultad:asc', label: 'Dificultad: baja primero' },
  { valor: 'dificultad:desc', label: 'Dificultad: alta primero' },
]


// El precio llega del backend como texto ("5500.00"), no como número: DRF
// serializa los Decimal así para que no pierdan precisión al pasar por el
// float de JavaScript. Hay que convertirlo para poder formatearlo.
function formatearPrecio(texto) {
  return '$' + Math.round(Number(texto)).toLocaleString('es-AR')
}


function motivoFuera(producto) {
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
function estadoCatalogo(producto) {
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


function avisoMateriales(producto) {
  const discontinuados = producto.materiales_discontinuados
  if (discontinuados.length === 0) return ''

  return discontinuados.length === 1
    ? `Usa un material discontinuado: ${discontinuados[0]}`
    : `Usa ${discontinuados.length} materiales discontinuados`
}


function textoDificultad(producto) {
  return `Dificultad ${producto.dificultad_display.toLowerCase()}`
}


function textoMeta(producto) {
  return `${formatearPrecio(producto.precio_actual)} · dificultad ${producto.dificultad_display.toLowerCase()}`
}


function accionesDe(producto, { onVer, onDarDeBaja, onEliminar }) {
  return [
    { title: 'Ver y editar', icono: ICONO_VER, color: '#8C5A66', hover: '#F0E2E4', onClick: () => onVer(producto) },
    { title: 'Dar de baja', icono: ICONO_BAJA, color: '#D9A441', hover: '#FDF3E0', onClick: () => onDarDeBaja(producto) },
    { title: 'Eliminar', icono: ICONO_BORRAR, color: '#C0442F', hover: '#FAEAE8', onClick: () => onEliminar(producto) },
  ]
}



function BotonAccion({ onClick, titulo, color, hover, icono, lado = 36 }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className="btn-accion"
      style={{
        width: lado,
        height: lado,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        borderRadius: 5,
        cursor: 'pointer',
        color,
        '--hover': hover,
      }}
    >
      <svg
        width={lado > 34 ? 19 : 18}
        height={lado > 34 ? 19 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}



function TarjetaProducto({ producto, acciones }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogo(producto)
  const aviso = avisoMateriales(producto)

  return (
    <article
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        onClick={() => acciones.onVer(producto)}
        style={{
          position: 'relative',
          height: 168,
          padding: 0,
          border: 0,
          borderBottom: '1px solid #EBE0E2',
          background: '#FAF7F7',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {producto.imagen_principal ? (
          <img
            src={producto.imagen_principal}
            alt={producto.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DCC9CD" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_IMAGEN} />
          </svg>
        )}

        <span
          title={catalogo.title}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            borderRadius: 20,
            padding: '4px 11px',
            border: `1px solid ${catalogo.color}`,
            background: catalogo.fondo,
            color: catalogo.color,
          }}
        >
          {catalogo.texto}
        </span>

        {aviso && (
          <span
            title={aviso}
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              border: '1px solid #EEDCB4',
              background: '#FDF3E0',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8862B" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
            </svg>
          </span>
        )}
      </button>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 16,
            color: '#3D3238',
            textWrap: 'pretty',
          }}
        >
          {producto.nombre}
        </h3>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 19,
              color: '#8C5A66',
            }}
          >
            {formatearPrecio(producto.precio_actual)}
          </span>
          <span
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              borderRadius: 20,
              padding: '3px 11px',
              border: `1px solid ${dificultad.color}`,
              background: dificultad.fondo,
              color: dificultad.color,
            }}
          >
            {textoDificultad(producto)}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: '#857078', textWrap: 'pretty' }}>
          {producto.categorias.length === 0
            ? 'Sin categorías'
            : producto.categorias.map((c) => c.nombre).join(' · ')}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 'auto',
            paddingTop: 10,
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {accionesDe(producto, acciones).map((a) => (
              <BotonAccion
                key={a.title}
                onClick={a.onClick}
                titulo={a.title}
                color={a.color}
                hover={a.hover}
                icono={a.icono}
                lado={34}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}



function FilaProducto({ producto, acciones }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogo(producto)
  const aviso = avisoMateriales(producto)

  return (
    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
      <td style={{ padding: 16 }}>
        <button
          onClick={() => acciones.onVer(producto)}
          className="btn-nombre-producto"
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            color: '#3D3238',
            textAlign: 'left',
          }}
        >
          {producto.nombre}
        </button>

        {aviso && (
          <span
            title={aviso}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              verticalAlign: 'middle',
              marginLeft: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              border: '1px solid #EEDCB4',
              background: '#FDF3E0',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8862B" strokeWidth="2.1">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
            </svg>
          </span>
        )}
      </td>

      <td
        style={{
          padding: 16,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: '#8C5A66',
        }}
      >
        {formatearPrecio(producto.precio_actual)}
      </td>

      <td style={{ padding: 16 }}>
        <span
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 20,
            padding: '6px 16px',
            border: `1px solid ${dificultad.color}`,
            background: dificultad.fondo,
            color: dificultad.color,
          }}
        >
          {textoDificultad(producto)}
        </span>
      </td>

      <td style={{ padding: 16, fontSize: 14, color: '#857078' }}>
        {producto.categorias.length === 0
          ? 'Sin categorías'
          : producto.categorias.map((c) => c.nombre).join(' · ')}
      </td>

      <td style={{ padding: 16 }}>
        <span
          title={catalogo.title}
          style={{
            display: 'inline-block',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 20,
            padding: '6px 16px',
            border: `1px solid ${catalogo.color}`,
            background: catalogo.fondo,
            color: catalogo.color,
          }}
        >
          {catalogo.texto}
        </span>
      </td>

      <td style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {accionesDe(producto, acciones).map((a) => (
            <BotonAccion
              key={a.title}
              onClick={a.onClick}
              titulo={a.title}
              color={a.color}
              hover={a.hover}
              icono={a.icono}
            />
          ))}
        </div>
      </td>
    </tr>
  )
}



function EstadoVacio({ onNuevo }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: '64px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 16,
          background: '#FAF7F7',
          border: '1px solid #EBE0E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DCC9CD" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAJA} />
        </svg>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 19,
          color: '#3D3238',
        }}
      >
        Todavía no cargaste ningún producto
      </p>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Cargá tus piezas con su precio y dificultad. Después podés sumarles
        materiales, fotos y categorías.
      </p>

      <button
        onClick={onNuevo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          padding: '10px 20px',
          background: '#8C5A66',
          color: 'white',
          border: 0,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" d={ICONO_NUEVO} />
        </svg>
        Cargar el primero
      </button>
    </div>
  )
}



function SinResultados() {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: 48,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: '#3D3238',
        }}
      >
        Ningún producto coincide
      </p>
      <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
        Probá con otra búsqueda o limpiá los filtros.
      </p>
    </div>
  )
}



function SeccionBajas({
  deBaja,
  grupos,
  abierto,
  onToggle,
  colapsadas,
  onToggleCategoria,
  onVer,
  onReactivarProducto,
  onReactivarCategoria,
}) {
  const cantidadPorCategoria = grupos.reduce((total, g) => total + g.productos.length, 0)

  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#857078',
            letterSpacing: '.06em',
          }}
        >
          DADOS DE BAJA
        </h2>
        <span style={{ fontSize: 13, color: '#B08791' }}>
          Separados según de dónde viene la baja
        </span>
        <div style={{ flex: 1, height: 1, background: '#EBE0E2' }} />

        <button
          onClick={onToggle}
          className="btn-colapsar-bajas"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid #EBE0E2',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 5,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {`${deBaja.length} por el producto · ${cantidadPorCategoria} por su categoría`}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={abierto ? CHEVRON_ARRIBA : CHEVRON_ABAJO}
            />
          </svg>
        </button>
      </div>

      {abierto && (
        <div style={{ background: 'white', border: '1px solid #EBE0E2', borderRadius: 8, overflow: 'hidden' }}>

          {deBaja.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  background: '#FAF7F7',
                  borderBottom: '1px solid #EBE0E2',
                }}
              >
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 4, background: '#C0442F' }} />
                <span
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#857078',
                    letterSpacing: '.06em',
                  }}
                >
                  BAJA DEL PROPIO PRODUCTO
                </span>
                <span style={{ fontSize: 13, color: '#B08791', textWrap: 'pretty' }}>
                  Productos particulares que se dieron de baja
                </span>
              </div>

              {deBaja.map((producto) => (
                <div
                  key={producto.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderBottom: '1px solid #EBE0E2',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 8,
                      background: '#F5F0F1',
                      border: '1px solid #EBE0E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {producto.imagen_principal ? (
                      <img
                        src={producto.imagen_principal}
                        alt={producto.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.6">
                        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_IMAGEN} />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 2px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 16,
                        color: '#857078',
                      }}
                    >
                      {producto.nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#B08791' }}>{textoMeta(producto)}</p>
                  </div>

                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      borderRadius: 20,
                      padding: '5px 14px',
                      border: '1px solid #C0442F',
                      background: '#FAEAE8',
                      color: '#C0442F',
                    }}
                  >
                    De baja
                  </span>

                  <BotonAccion
                    onClick={() => onVer(producto)}
                    titulo="Ver"
                    color="#8C5A66"
                    hover="#F0E2E4"
                    icono={ICONO_VER}
                  />

                  <button
                    onClick={() => onReactivarProducto(producto)}
                    title="Volver a activar este producto"
                    className="btn-reactivar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      padding: '7px 14px',
                      border: '1px solid #4E8C6A',
                      background: 'white',
                      color: '#4E8C6A',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALTA} />
                    </svg>
                    Reactivar producto
                  </button>
                </div>
              ))}
            </>
          )}

          {grupos.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  background: '#FAF7F7',
                  borderBottom: '1px solid #EBE0E2',
                }}
              >
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 4, background: '#D9A441' }} />
                <span
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#857078',
                    letterSpacing: '.06em',
                  }}
                >
                  BAJA POR SU CATEGORÍA
                </span>
                <span style={{ fontSize: 13, color: '#B08791', textWrap: 'pretty' }}>
                  Al reactivar la categoría vuelven todos sus productos
                </span>
              </div>

              {grupos.map((grupo) => {
                const colapsado = colapsadas.includes(grupo.categoria.id)

                return (
                  <div key={grupo.categoria.id} style={{ borderBottom: '1px solid #EBE0E2' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 18px',
                        background: '#FDF9F2',
                      }}
                    >
                      <button
                        onClick={() => onToggleCategoria(grupo.categoria.id)}
                        title={colapsado ? 'Ver sus productos' : 'Ocultar sus productos'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          flex: 1,
                          minWidth: 0,
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#B08791"
                          strokeWidth="2.2"
                          style={{ flexShrink: 0 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={colapsado ? CHEVRON_DERECHA : CHEVRON_ABAJO}
                          />
                        </svg>

                        <div
                          style={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            borderRadius: 8,
                            background: '#FDF3E0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D9A441" strokeWidth="1.8">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={grupo.categoria.tipo === 'TEMATICA' ? ICONO_TEMA : ICONO_TIPO}
                            />
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: "'Quicksand', sans-serif",
                              fontWeight: 600,
                              fontSize: 16,
                              color: '#3D3238',
                            }}
                          >
                            {grupo.categoria.nombre}
                          </p>
                          <p style={{ margin: '1px 0 0', fontSize: 13, color: '#B08791' }}>
                            {`${grupo.categoria.tipo_display} · ${
                              grupo.productos.length === 1
                                ? '1 producto afectado'
                                : `${grupo.productos.length} productos afectados`
                            }`}
                          </p>
                        </div>
                      </button>

                      <span
                        style={{
                          flexShrink: 0,
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                          borderRadius: 20,
                          padding: '5px 14px',
                          border: '1px solid #D9A441',
                          background: '#FDF3E0',
                          color: '#D9A441',
                        }}
                      >
                        Categoría de baja
                      </span>

                      <button
                        onClick={() => onReactivarCategoria(grupo.categoria)}
                        title={`Reactiva “${grupo.categoria.nombre}” y todos sus productos`}
                        className="btn-reactivar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                          padding: '7px 14px',
                          border: '1px solid #4E8C6A',
                          background: 'white',
                          color: '#4E8C6A',
                          borderRadius: 5,
                          cursor: 'pointer',
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALTA} />
                        </svg>
                        Reactivar categoría
                      </button>
                    </div>

                    {!colapsado &&
                      grupo.productos.map((producto) => (
                        <div
                          key={producto.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '11px 18px 11px 34px',
                            borderTop: '1px solid #F2E9EA',
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              flexShrink: 0,
                              borderLeft: '1px solid #DCC9CD',
                              borderBottom: '1px solid #DCC9CD',
                              borderBottomLeftRadius: 6,
                              marginTop: -10,
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>{producto.nombre}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 13, color: '#B08791' }}>
                              {textoMeta(producto)}
                            </p>
                          </div>

                          <BotonAccion
                            onClick={() => onVer(producto)}
                            titulo="Ver producto"
                            color="#8C5A66"
                            hover="#F0E2E4"
                            icono={ICONO_VER}
                            lado={34}
                          />
                        </div>
                      ))}
                  </div>
                )
              })}
            </>
          )}

          {deBaja.length === 0 && grupos.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 15, color: '#857078' }}>
              No hay productos fuera del catálogo por una baja.
            </div>
          )}
        </div>
      )}
    </section>
  )
}



export default function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState('grid')
  const [sortBy, setSortBy] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [bajasAbierto, setBajasAbierto] = useState(false)
  const [catsColapsadas, setCatsColapsadas] = useState([])

  useEffect(() => {
    listarProductos()
      .then((res) => setProductos(res.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setCargando(false))
  }, [])


  function recargar() {
    setCargando(true)
    listarProductos()
      .then((res) => setProductos(res.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setCargando(false))
  }

  async function cambiarEstado(producto, accion) {
    try {
      await accion(producto.id)
      recargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
  }


  function ordenarPor(campo) {
    setSortDir(sortBy === campo && sortDir === 'asc' ? 'desc' : 'asc')
    setSortBy(campo)
  }


  // Derivados: se calculan en cada render a partir del estado y no se
  // guardan. Los campos visible_en_catalogo, oculto_por_categoria y
  // categorias_de_baja vienen ya resueltos del backend.
  const activos = productos.filter((p) => p.estado === 'ACTIVO')
  const deBaja = productos.filter((p) => p.estado === 'BAJA')

  // Un producto activo con una categoría de baja NO va a la grilla: sale
  // solo en la sección de abajo, agrupado bajo su categoría. Así ningún
  // producto aparece en dos lugares a la vez.
  const porCategoria = activos.filter((p) => p.categorias_de_baja.length > 0)
  const enGrilla = activos.filter((p) => p.categorias_de_baja.length === 0)

  const publicables = activos.filter((p) => p.visible_en_catalogo).length

  const texto = busqueda.trim().toLowerCase()
  const filtrados = enGrilla.filter((p) => p.nombre.toLowerCase().includes(texto))

  const visibles = !sortBy
    ? filtrados
    : filtrados.slice().sort((x, y) => {
        const dir = sortDir === 'asc' ? 1 : -1

        if (sortBy === 'nombre') return x.nombre.localeCompare(y.nombre, 'es') * dir
        if (sortBy === 'precio') return (Number(x.precio_actual) - Number(y.precio_actual)) * dir
        if (sortBy === 'dificultad') {
          return (ORDEN_DIFICULTAD[x.dificultad] - ORDEN_DIFICULTAD[y.dificultad]) * dir
        }
        return (x.categorias.length - y.categorias.length) * dir
      })

  // El árbol de bajas por categoría se arma con las categorías que ya
  // vienen adentro de cada producto, en categorias_de_baja: llegan
  // completas, con nombre, tipo y tipo_display. No hace falta pedirlas.
  const grupos = []
  porCategoria.forEach((producto) => {
    producto.categorias_de_baja.forEach((categoria) => {
      const grupo = grupos.find((g) => g.categoria.id === categoria.id)
      if (grupo) {
        grupo.productos.push(producto)
      } else {
        grupos.push({ categoria, productos: [producto] })
      }
    })
  })

  const COLUMNAS = [
    { campo: 'nombre', label: 'PRODUCTO' },
    { campo: 'precio', label: 'PRECIO' },
    { campo: 'dificultad', label: 'DIFICULTAD' },
    { campo: 'categorias', label: 'CATEGORÍAS' },
  ]

  const VISTAS = [
    { id: 'grid', title: 'Ver como imágenes', icono: ICONO_GRILLA },
    { id: 'lista', title: 'Ver como lista', icono: ICONO_LISTA },
  ]


  // TODO(paso siguiente): la ficha del producto. Por ahora ver no navega.
  // TODO(paso siguiente): los modales de dar de baja y de eliminar.
  const acciones = {
    onVer: () => {},
    onDarDeBaja: () => {},
    onEliminar: () => {},
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 32,
            color: '#3D3238',
          }}
        >
          Gestión de Productos
        </h1>

        {/* TODO(paso siguiente): el alta abre la ficha vacía. */}
        <button
          onClick={() => {}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: '#8C5A66',
            color: 'white',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d={ICONO_NUEVO} />
          </svg>
          Nuevo producto
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>
        {`${enGrilla.length} productos activos · ${publicables} visibles en el catálogo público`}
      </p>


      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}
      {cargando && <p style={{ color: '#857078' }}>Cargando…</p>}


      {!cargando && productos.length === 0 && <EstadoVacio onNuevo={() => {}} />}

      {!cargando && productos.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', width: 420 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#857078"
                strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              >
                <path strokeLinecap="round" d={ICONO_BUSCAR} />
              </svg>

              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto..."
                style={{
                  width: '100%',
                  padding: '8px 16px 8px 36px',
                  border: '1px solid #EBE0E2',
                  background: 'white',
                  fontSize: 16,
                  color: '#3D3238',
                  borderRadius: 5,
                  outline: 'none',
                }}
              />
            </div>

            {/* TODO(paso siguiente): el modal de filtros y los chips de
                filtros activos. El botón queda dibujado pero no abre nada
                y todavía no muestra el contador. */}
            <button
              onClick={() => {}}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 12px',
                minWidth: 130,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                border: '1px solid #EBE0E2',
                background: 'white',
                color: '#8C5A66',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
              </svg>
              Filtros
            </button>

            <select
              value={sortBy ? `${sortBy}:${sortDir}` : ''}
              onChange={(e) => {
                const valor = e.target.value
                if (!valor) {
                  setSortBy(null)
                  return
                }
                const [campo, direccion] = valor.split(':')
                setSortBy(campo)
                setSortDir(direccion)
              }}
              title="Ordenar"
              style={{
                padding: '8px 12px',
                border: '1px solid #EBE0E2',
                background: 'white',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: '#8C5A66',
                borderRadius: 5,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: 3,
                background: 'white',
                border: '1px solid #EBE0E2',
                borderRadius: 6,
              }}
            >
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVista(v.id)}
                  title={v.title}
                  style={{
                    width: 34,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 0,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: vista === v.id ? '#F0E2E4' : 'transparent',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={vista === v.id ? '#8C5A66' : '#B08791'}
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={v.icono} />
                  </svg>
                </button>
              ))}
            </div>
          </div>


          {vista === 'grid' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
                gap: 18,
              }}
            >
              {visibles.map((p) => (
                <TarjetaProducto key={p.id} producto={p} acciones={acciones} />
              ))}

              {visibles.length === 0 && <SinResultados />}
            </div>
          )}

          {vista === 'lista' && (
            <div style={{ background: 'white', border: '1px solid #EBE0E2', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0E2E4' }}>
                    {COLUMNAS.map((col) => (
                      <th key={col.campo} style={{ textAlign: 'left', padding: 0 }}>
                        <button
                          onClick={() => ordenarPor(col.campo)}
                          className="btn-columna"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            width: '100%',
                            padding: '12px 16px',
                            border: 0,
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: "'Quicksand', sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            color: '#8C5A66',
                            letterSpacing: '.06em',
                          }}
                        >
                          {col.label}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ opacity: sortBy === col.campo ? 1 : 0.4 }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={
                                sortBy === col.campo
                                  ? sortDir === 'asc'
                                    ? CHEVRON_ARRIBA
                                    : CHEVRON_ABAJO
                                  : ORDEN_SIN_USAR
                              }
                            />
                          </svg>
                        </button>
                      </th>
                    ))}

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#8C5A66',
                        letterSpacing: '.06em',
                      }}
                    >
                      CATÁLOGO
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#8C5A66',
                        letterSpacing: '.06em',
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.map((p) => (
                    <FilaProducto key={p.id} producto={p} acciones={acciones} />
                  ))}

                  {visibles.length === 0 && (
                    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
                      <td colSpan="6" style={{ padding: 32, textAlign: 'center', fontSize: 15, color: '#857078' }}>
                        Ningún producto coincide con esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}


          <SeccionBajas
            deBaja={deBaja}
            grupos={grupos}
            abierto={bajasAbierto}
            onToggle={() => setBajasAbierto((v) => !v)}
            colapsadas={catsColapsadas}
            onToggleCategoria={(id) =>
              setCatsColapsadas((actual) =>
                actual.includes(id) ? actual.filter((x) => x !== id) : actual.concat(id)
              )
            }
            onVer={acciones.onVer}
            onReactivarProducto={(p) => cambiarEstado(p, reactivarProducto)}
            /* TODO(paso siguiente): el modal de reactivar categoría. */
            onReactivarCategoria={() => {}}
          />
        </>
      )}
    </div>
  )
}
