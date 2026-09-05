import BotonAccion from '../../componentes/BotonAccion'
import {
  ICONO_IMAGEN,
  ICONO_ALERTA,
  COLOR_DIFICULTAD,
  formatearPrecio,
  estadoCatalogo,
  avisoMateriales,
  textoDificultad,
  accionesDe,
} from './presentacion'

// La tarjeta de la grilla. Recibe todo por props y no llama a la API:
// los clics avisan hacia arriba.

export default function TarjetaProducto({ producto, acciones }) {
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
