import { useState } from 'react'
import { darDeBajaCategoria } from '../api/categorias'

export default function ModalBajaCategoria({ categoria, onCerrar, onConfirmado }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError('')
    setEnviando(true)

    try {
      await darDeBajaCategoria(categoria.id)
      onConfirmado()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo dar de baja la categoría.')
      setEnviando(false)
    }
  }

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
          maxWidth: 440,
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
            Dar de baja categoría
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
          <p style={{ margin: '0 0 10px', fontSize: 16, color: '#3D3238' }}>
            ¿Dar de baja la categoría «{categoria.nombre}»?
          </p>

          <p style={{ margin: '0 0 10px', fontSize: 14, color: '#857078' }}>
            Sus productos dejarán de aparecer en el catálogo público, aunque
            pertenezcan también a otras categorías activas.
          </p>

          <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>
            Podés reactivarla en cualquier momento y todo vuelve como estaba.
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
              background: '#D9A441',
              color: '#3D3238',
              borderRadius: 6,
              cursor: enviando ? 'default' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {enviando ? 'Guardando…' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  )
}