import { ICONO_TIPO, ICONO_TEMA } from './presentacion'
import { ANCHO_MAXIMO } from '../../constantes'

const ICONO_CRUZ = 'M6 18L18 6M6 6l12 12'
const ICONO_MAS = 'M12 5v14m7-7H5'

const GRUPOS = [
  { tipo: 'TIPO', titulo: 'Por tipo de accesorio', icono: ICONO_TIPO, fondo: '#F0E2E4', color: '#8C5A66' },
  { tipo: 'TEMATICA', titulo: 'Por temática', icono: ICONO_TEMA, fondo: '#FDF3E0', color: '#D9A441' },
]

// "ASIGNADAS" y "AGREGAR A UNA CATEGORÍA".
const estiloTituloSeccion = {
  margin: 0,
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 15,
  color: '#857078',
  letterSpacing: '.06em',
}


// Una de las dos columnas de "Agregar a una categoría". El título del grupo
// va más chico y más claro que el de la sección, para que se lea un nivel
// por debajo.
function Grupo({ grupo, disponibles, onAsignar }) {
  const opciones = disponibles.filter((c) => c.tipo === grupo.tipo)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <div
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: 6,
            background: grupo.fondo,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={grupo.color} strokeWidth="1.9">
            <path strokeLinecap="round" strokeLinejoin="round" d={grupo.icono} />
          </svg>
        </div>
        <span style={{ fontSize: 13, color: '#857078' }}>{grupo.titulo}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {opciones.map((categoria) => (
          <button
            key={categoria.id}
            onClick={() => onAsignar(categoria)}
            className="btn-agregar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#857078',
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" d={ICONO_MAS} />
            </svg>
            {categoria.nombre}
          </button>
        ))}

        {opciones.length === 0 && (
          <span style={{ fontSize: 14, color: '#B08791' }}>
            Ya está en todas las categorías activas de este grupo.
          </span>
        )}
      </div>
    </div>
  )
}


export default function PestanaCategorias({ asignadas, disponibles, onAsignar, onQuitar }) {
  return (
    <div
      className="ancho-pantalla"
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        maxWidth: ANCHO_MAXIMO,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
        <p style={estiloTituloSeccion}>ASIGNADAS</p>
      </div>

      {asignadas.map((categoria) => {
        const esTema = categoria.tipo === 'TEMATICA'
        const activa = categoria.estado === 'ACTIVO'

        return (
          <div
            key={categoria.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              borderBottom: '1px solid #EBE0E2',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 8,
                background: esTema ? '#FDF3E0' : '#F0E2E4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke={esTema ? '#D9A441' : '#8C5A66'}
                strokeWidth="1.7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={esTema ? ICONO_TEMA : ICONO_TIPO}
                />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, color: '#3D3238' }}>{categoria.nombre}</p>
              <p style={{ margin: '1px 0 0', fontSize: 13, color: '#B08791' }}>
                {categoria.tipo_display}
              </p>
            </div>

            <span
              style={{
                flexShrink: 0,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 20,
                padding: '4px 12px',
                border: `1px solid ${activa ? '#4E8C6A' : '#C0442F'}`,
                background: activa ? '#E8F5EF' : '#FAEAE8',
                color: activa ? '#4E8C6A' : '#C0442F',
              }}
            >
              {categoria.estado_display}
            </span>

            <button
              title="Quitar categoría"
              onClick={() => onQuitar(categoria)}
              className="btn-accion"
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                background: 'transparent',
                borderRadius: 5,
                cursor: 'pointer',
                '--hover': '#FAEAE8',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C0442F" strokeWidth="1.9">
                <path strokeLinecap="round" d={ICONO_CRUZ} />
              </svg>
            </button>
          </div>
        )
      })}

      {asignadas.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 15, color: '#857078' }}>
          Este producto no está en ninguna categoría.
        </div>
      )}

      <div style={{ padding: 20, background: '#FAF7F7', borderTop: '1px solid #EBE0E2' }}>
        <p style={{ ...estiloTituloSeccion, marginBottom: 16 }}>AGREGAR A UNA CATEGORÍA</p>

        {/* En pantalla chica, campos-dos-columnas deja una sola columna. La
            línea es un elemento más de la grilla: en dos columnas la estira el
            alto de la fila, y en una ocupa el ancho y minHeight le da 1px. */}
        <div
          className="campos-dos-columnas"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 24 }}
        >
          <Grupo grupo={GRUPOS[0]} disponibles={disponibles} onAsignar={onAsignar} />
          <div style={{ minHeight: 1, background: '#EBE0E2' }} />
          <Grupo grupo={GRUPOS[1]} disponibles={disponibles} onAsignar={onAsignar} />
        </div>
      </div>
    </div>
  )
}
