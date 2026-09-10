import { useState } from 'react'
import { eliminarPedido } from './api'

export default function ModalEliminarPedido({ pedido, onCerrar, onEliminado }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError('')
    setEnviando(true)

    try {
      await eliminarPedido(pedido.id)
      onEliminado()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el pedido.')
      setEnviando(false)
    }
  }

  // Los productos del pedido se van con él, porque su clave foránea es
  // CASCADE: una pieza encargada no significa nada sin su pedido. Por eso
  // el aviso dice cuántas son.
  const cantidad = pedido.cantidad_productos

  const detalle =
    cantidad === 0
      ? 'Esto no se puede deshacer.'
      : cantidad === 1
        ? 'Se borra su producto. Esto no se puede deshacer.'
        : `Se borran sus ${cantidad} productos. Esto no se puede deshacer.`

  return (
    <div
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
            Eliminar pedido
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
          <p style={{ margin: '0 0 10px', fontSize: 16, color: '#3D3238', textWrap: 'pretty' }}>
            ¿Eliminar el pedido #{pedido.id} de @{pedido.cliente_instagram}?
          </p>

          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            {detalle}
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
            onClick={confirmar}
            disabled={enviando}
            style={{
              padding: '10px 20px',
              border: 0,
              background: '#C0442F',
              color: 'white',
              borderRadius: 6,
              cursor: enviando ? 'default' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {enviando ? 'Eliminando…' : 'Eliminar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
