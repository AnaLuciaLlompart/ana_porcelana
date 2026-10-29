import { useEffect, useState } from 'react'
import { obtenerProducto } from './api'
import { COLOR_DIFICULTAD, estadoCatalogo, formatearPrecio } from './presentacion'


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.06em',
}

const estiloCampo = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #EBE0E2',
  fontSize: 15,
  color: '#3D3238',
  background: '#FAF7F7',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'default',
  resize: 'none',
}

const estiloVacio = { margin: 0, fontSize: 15, color: '#857078' }

// Los dos grupos de fotos, con los títulos de la pestaña Imágenes.
const GRUPOS = [
  { tipo: 'RESULTADO', titulo: 'PIEZA TERMINADA' },
  { tipo: 'REFERENCIA', titulo: 'REFERENCIAS' },
]


function Chip({ texto, color, fondo, title }) {
  return (
    <span
      title={title}
      style={{
        whiteSpace: 'nowrap',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        borderRadius: 20,
        padding: '4px 12px',
        border: `1px solid ${color}`,
        background: fondo,
        color,
      }}
    >
      {texto}
    </span>
  )
}


// Lo que se ve cuando la ficha ya llegó: los datos, las fotos y las
// categorías, todo en solo lectura.
function Contenido({ producto }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogo(producto)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: '#8C5A66',
          }}
        >
          {formatearPrecio(producto.precio_actual)}
        </span>
        <Chip
          texto={`Dificultad ${producto.dificultad_display.toLowerCase()}`}
          color={dificultad.color}
          fondo={dificultad.fondo}
        />
        <Chip texto={catalogo.texto} color={catalogo.color} fondo={catalogo.fondo} title={catalogo.title} />
      </div>

      <div>
        <span style={estiloEtiqueta}>DESCRIPCIÓN PARA EL CATÁLOGO</span>
        <textarea value={producto.descripcion} readOnly disabled rows={2} placeholder="Sin cargar" style={estiloCampo} />
      </div>

      <div>
        <span style={estiloEtiqueta}>PASO A PASO DE ELABORACIÓN</span>
        <textarea value={producto.paso_a_paso} readOnly disabled rows={3} placeholder="Sin cargar" style={estiloCampo} />
      </div>

      {GRUPOS.map((grupo) => {
        const fotos = producto.imagenes.filter((i) => i.tipo === grupo.tipo)

        return (
          <div key={grupo.tipo}>
            <span style={estiloEtiqueta}>{grupo.titulo}</span>

            {fotos.length === 0 ? (
              <p style={estiloVacio}>Sin fotos</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                {fotos.map((foto) => (
                  <img
                    key={foto.id}
                    src={foto.imagen}
                    alt={foto.titulo || producto.nombre}
                    title={foto.titulo || undefined}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 6,
                      border: '1px solid #EBE0E2',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div>
        <span style={estiloEtiqueta}>CATEGORÍAS</span>

        {producto.categorias.length === 0 ? (
          <p style={estiloVacio}>Sin categorías</p>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {producto.categorias.map((c) =>
              c.estado === 'ACTIVO' ? (
                <Chip key={c.id} texto={c.nombre} color="#8C5A66" fondo="#F0E2E4" />
              ) : (
                <Chip key={c.id} texto={`${c.nombre} (de baja)`} color="#C0442F" fondo="#FAEAE8" />
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}


// El producto en solo lectura (CU18): datos, fotos y categorías. El
// listado no trae todas las fotos, así que al abrirse pide la ficha, con
// el patrón de tres estados. Editar lleva a la ficha; un producto de baja
// no lo ofrece, porque su ficha es de solo lectura.
export default function ModalVerProducto({ producto, onCerrar, onEditar }) {
  const [ficha, setFicha] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerProducto(producto.id)
      .then((res) => setFicha(res.data))
      .catch(() => setError('No se pudo cargar el producto.'))
      .finally(() => setCargando(false))
  }, [producto.id])

  const activo = producto.estado === 'ACTIVO'

  return (
    <div
      className="modal-fondo"
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,50,56,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100,
      }}
    >
      <div
        className="modal-caja"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 24px',
            flexShrink: 0,
            background: '#8C5A66',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            {producto.nombre}
          </h2>

          <button
            onClick={onCerrar}
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'transparent',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflowY: 'auto',
          }}
        >
          {cargando && <p style={estiloVacio}>Cargando…</p>}
          {error && <p style={{ margin: 0, fontSize: 15, color: '#C0442F' }}>{error}</p>}
          {ficha && <Contenido producto={ficha} />}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            flexShrink: 0,
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onCerrar}
            style={{
              padding: '10px 18px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Cerrar
          </button>

          {activo && (
            <button
              onClick={onEditar}
              style={{
                padding: '10px 18px',
                border: 0,
                background: '#8C5A66',
                color: 'white',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
