import { useState } from 'react'
import { COLOR_DISPONIBILIDAD } from './presentacion'

// Lo que mide "Cancelar" con su padding, como en ModalConfirmar: los dos
// botones del pie miden al menos eso.
const ANCHO_MINIMO_BOTON = 104

// La pregunta del alta de un gasto: ¿pasar a disponibilidad Alta los
// materiales que se compraron y estaban en Media o Baja? Recibe solo esas
// filas y las muestra tildadas, porque en el alta todo es la compra que se
// está registrando. No llama a la API: le devuelve a quien lo abrió los ids
// de las filas tildadas. Omitir crea sin marcar ninguna; la cruz y el fondo
// cierran sin crear nada, como en todo modal.
export default function ModalActualizarDisponibilidad({ filas, onCerrar, onOmitir, onGuardar }) {
  const [tildadas, setTildadas] = useState(() => filas.map((fila) => fila.id))

  function alternar(id) {
    setTildadas((ids) => (ids.includes(id) ? ids.filter((otro) => otro !== id) : [...ids, id]))
  }

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
        zIndex: 110,
      }}
    >
      <div
        className="modal-caja"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 480,
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
            Actualizar disponibilidad
          </h2>

          <button
            onClick={onCerrar}
            style={{
              width: 32,
              height: 32,
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

        {/* El cuerpo se desliza si hay muchos materiales; la cabecera y el
            pie quedan fijos, también en el celular. */}
        <div style={{ padding: '22px 24px', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px', fontSize: 16, color: '#3D3238', textWrap: 'pretty' }}>
            ¿Actualizar la disponibilidad de estos materiales?
          </p>

          <div style={{ border: '1px solid #EBE0E2', borderRadius: 6 }}>
            {filas.map((fila, i) => {
              const tildada = tildadas.includes(fila.id)

              return (
                // Toda la fila es clicable: el label tilda la casilla.
                <label
                  key={fila.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderTop: i === 0 ? 0 : '1px solid #EBE0E2',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tildada}
                    onChange={() => alternar(fila.id)}
                    style={{ accentColor: '#8C5A66', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                  />

                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: '#3D3238', overflowWrap: 'anywhere' }}>
                    {fila.material_nombre}
                  </span>

                  {/* Tildada dice de dónde a dónde va a ir, como la celda de la
                      ficha cuando se marca con la flecha. */}
                  <span
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontSize: 14,
                      color: tildada ? COLOR_DISPONIBILIDAD.ALTA : COLOR_DISPONIBILIDAD[fila.material_disponibilidad],
                    }}
                  >
                    {tildada
                      ? `${fila.material_disponibilidad_display} → Alta`
                      : fila.material_disponibilidad_display}
                  </span>
                </label>
              )
            })}
          </div>
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
            onClick={onOmitir}
            style={{
              minWidth: ANCHO_MINIMO_BOTON,
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
            Omitir
          </button>

          <button
            onClick={() => onGuardar(tildadas)}
            style={{
              minWidth: ANCHO_MINIMO_BOTON,
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
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
