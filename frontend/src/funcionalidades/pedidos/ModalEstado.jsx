import { useState } from 'react'
import { cambiarEstadoPedido } from './api'
import { COLOR_ESTADO, ESTADOS } from './presentacion'


// "Cambiar estado" del ⋯ del listado (CU42). Son los cuatro botones que
// antes estaban en la tarjeta de estado de la ficha: el estado es una
// acción instantánea y no un campo del formulario, así que vive fuera de la
// ficha. Tocar uno llama a cambiar_estado; si el backend lo rechaza (un
// Listo con piezas sin terminar), el mensaje se ve adentro y el modal queda
// abierto. Si sale bien, le entrega a quien lo abrió el pedido y el aviso.
export default function ModalEstado({ pedido, onCerrar, onCambiado }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function elegir(estado) {
    if (estado.valor === pedido.estado) return

    setError('')
    setEnviando(true)

    try {
      const res = await cambiarEstadoPedido(pedido.id, estado.valor)
      onCambiado(res.data, `Pedido ${estado.label.toLowerCase()}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    } finally {
      setEnviando(false)
    }
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
        zIndex: 100,
      }}
    >
      <div
        className="modal-caja"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 520,
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
            Estado del pedido #{pedido.id}
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

        <div style={{ padding: '22px 24px' }}>
          <div className="botones-estado" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {ESTADOS.map((e) => {
              const activo = pedido.estado === e.valor
              const solido = COLOR_ESTADO[e.valor].solido

              return (
                <button
                  key={e.valor}
                  onClick={() => elegir(e)}
                  disabled={enviando}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 5,
                    cursor: enviando ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    border: activo ? `1px solid ${solido}` : '1px solid #EBE0E2',
                    background: activo ? solido : 'white',
                    color: activo ? 'white' : '#857078',
                  }}
                >
                  {e.label}
                </button>
              )
            })}
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: '14px 0 0',
                padding: '10px 12px',
                background: '#FAEAE8',
                border: '1px solid #F0C4BC',
                borderRadius: 6,
                fontSize: 14,
                color: '#C0442F',
                textWrap: 'pretty',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '16px 24px',
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onCerrar}
            style={{
              padding: '10px 20px',
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
        </div>
      </div>
    </div>
  )
}
