import { useState } from 'react'
import { eliminarGasto } from './api'
import { ICONO_ALERTA, formatearPrecio } from './presentacion'


export default function ModalEliminarGasto({ gasto, onCerrar, onEliminado }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError('')
    setEnviando(true)

    try {
      await eliminarGasto(gasto.id)
      onEliminado()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el gasto.')
      setEnviando(false)
    }
  }

  // Los materiales del gasto se van con él, porque su clave foránea es
  // CASCADE: un material del gasto no significa nada sin su gasto. Por eso
  // el aviso dice cuántos son. Los materiales en sí no se borran: siguen en
  // su listado.
  const cantidad = gasto.materiales.length

  const detalle =
    cantidad === 0
      ? 'Esto no se puede deshacer.'
      : cantidad === 1
        ? 'Se borra también el detalle de su material. Esto no se puede deshacer.'
        : `Se borra también el detalle de sus ${cantidad} materiales. Esto no se puede deshacer.`

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
        {/* Cabecera roja con el triángulo y sin cruz, como la de eliminar
            un cliente: es la del diseño para una acción que no se deshace. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 24px',
            background: '#C0442F',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
          </svg>

          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            Eliminar gasto
          </h2>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 16, color: '#3D3238', textWrap: 'pretty' }}>
            ¿Eliminar el gasto #{gasto.id} de {formatearPrecio(gasto.monto)}?
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
            Cancelar
          </button>

          <button
            onClick={confirmar}
            disabled={enviando}
            style={{
              padding: '10px 18px',
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
            {enviando ? 'Eliminando…' : 'Eliminar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}
