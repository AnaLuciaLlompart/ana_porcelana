import { useState } from 'react'

import { cambiarEstadoPedido } from './api'
import { COLOR_ESTADO, siguienteEstado } from './presentacion'


// Avanzar el estado del pedido (CU42; corrección del tutor: el estado
// avanza de a uno, Pendiente → En producción → Listo → Entregado, y no
// vuelve). El modal ya es la confirmación: muestra el estado actual, la
// pregunta y "Avanzar a …", sin otro modal encima (pedido de la usuaria).
//
// Llama él a cambiar_estado y le entrega el pedido que devuelve el backend
// a quien lo abrió, como ModalCobros, así lo puede usar cualquier pantalla.
// El rechazo del backend (Listo con piezas sin terminar) se ve adentro. En
// Entregado no hay siguiente: dice que es el último y no tiene pie.
export default function ModalEstadoDelPedido({ pedido, onCerrar, onEstadoCambiado }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const siguiente = siguienteEstado(pedido.estado)
  const color = COLOR_ESTADO[pedido.estado]

  async function avanzar() {
    setError('')
    setEnviando(true)

    try {
      const res = await cambiarEstadoPedido(pedido.id, siguiente.valor)
      onEstadoCambiado(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
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
          maxWidth: 480,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 15, color: '#857078' }}>Estado actual</span>
            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 20,
                padding: '5px 12px',
                border: `1px solid ${color.borde}`,
                background: color.fondo,
                color: color.color,
              }}
            >
              {pedido.estado_display}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 16, color: '#3D3238', textWrap: 'pretty' }}>
            {siguiente
              ? `¿Pasar el pedido #${pedido.id} a ${siguiente.label}? No se puede volver atrás.`
              : `${pedido.estado_display} es el último estado: el pedido ya no cambia.`}
          </p>

          {error && (
            <p
              role="alert"
              style={{
                marginTop: 16,
                marginBottom: 0,
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

        {siguiente && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
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
              Cancelar
            </button>

            <button
              onClick={avanzar}
              disabled={enviando}
              style={{
                padding: '10px 20px',
                border: 0,
                background: '#8C5A66',
                color: 'white',
                borderRadius: 6,
                cursor: enviando ? 'default' : 'pointer',
                opacity: enviando ? 0.7 : 1,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {enviando ? 'Avanzando…' : `Avanzar a ${siguiente.label}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
