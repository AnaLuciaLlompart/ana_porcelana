import { useState } from 'react'

const ICONO_MATERIAL = 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
const ICONO_CRUZ = 'M6 18L18 6M6 6l12 12'
const ICONO_MAS = 'M12 5v14m7-7H5'


// Una línea de la lista. La cantidad se escribe libre y se manda al SALIR
// del campo, no en cada tecla: es una edición terminada, no un tipeo.
function Fila({ linea, onGuardarCantidad, onQuitar }) {
  const [cantidad, setCantidad] = useState(linea.cantidad)

  function alSalir() {
    // Si no cambió nada, no se molesta al backend.
    if (cantidad === linea.cantidad) return
    onGuardarCantidad(linea, cantidad)
  }

  return (
    <div
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
          background: '#FAF7F7',
          border: '1px solid #EBE0E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_MATERIAL} />
        </svg>
      </div>

      <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: '#3D3238' }}>
        {linea.material_nombre}
      </span>

      {linea.material_estado === 'DISCONTINUADO' && (
        <span
          title="Este material está discontinuado"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 20,
            padding: '4px 12px',
            border: '1px solid #EEDCB4',
            background: '#FDF3E0',
            color: '#8A6320',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8862B" strokeWidth="2.1">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
          </svg>
          {linea.material_estado_display}
        </span>
      )}

      <input
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        onBlur={alSalir}
        maxLength={50}
        placeholder="Cantidad aprox."
        style={{
          width: 168,
          flexShrink: 0,
          padding: '8px 14px',
          border: '1px solid #EBE0E2',
          fontSize: 14,
          color: '#3D3238',
          background: '#FAF7F7',
          borderRadius: 5,
          outline: 'none',
        }}
      />

      <button
        title="Quitar del producto"
        onClick={() => onQuitar(linea)}
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
}


export default function PestanaMateriales({
  lineas,
  onAgregar,
  onGuardarCantidad,
  onQuitar,
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        maxWidth: 720,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid #EBE0E2',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
          La cantidad se escribe como la medís: “dos gotas”, “medio paquete”.
        </p>

        <button
          onClick={onAgregar}
          className="btn-reponer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            flexShrink: 0,
            padding: '8px 14px',
            border: '1px solid #8C5A66',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 5,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" d={ICONO_MAS} />
          </svg>
          Agregar material
        </button>
      </div>

      {lineas.map((linea) => (
        // La key es el id de la LÍNEA, no el del material. Además fuerza a
        // React a rehacer la fila cuando el backend devuelve otra: así el
        // campo de cantidad arranca con el valor recién guardado.
        <Fila
          key={linea.id}
          linea={linea}
          onGuardarCantidad={onGuardarCantidad}
          onQuitar={onQuitar}
        />
      ))}

      {lineas.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p
            style={{
              margin: '0 0 6px',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: '#3D3238',
            }}
          >
            Todavía no anotaste los materiales
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>
            Sirve para reproducir la pieza tiempo después.
          </p>
        </div>
      )}
    </div>
  )
}
