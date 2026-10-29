const ICONO_TILDE = 'M5 13l4 4L19 7'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'


// El modal que avisa algo que ya pasó: un texto y Aceptar. Es hermano de
// ModalConfirmar, sin Cancelar porque no pregunta nada, y más angosto que
// los otros modales porque solo lleva una frase. Lo usan los seis listados
// (productos, pedidos, gastos, materiales, clientes y categorías) para
// confirmar el alta y la edición. Con error, el tilde verde pasa a ser un
// triángulo rojo: lo usa el listado de pedidos cuando el backend rechaza un
// cambio de estado, para que el motivo se vea esté donde esté la fila.
export default function ModalAviso({ titulo, texto, onCerrar, error = false }) {
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
          maxWidth: 380,
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
            padding: '12px 20px',
            background: '#8C5A66',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: 'white',
            }}
          >
            {titulo}
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

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 20px' }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={error ? '#C0442F' : '#4E8C6A'}
            strokeWidth={error ? 2 : 2.2}
            style={{ flexShrink: 0 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={error ? ICONO_ALERTA : ICONO_TILDE} />
          </svg>
          <p style={{ margin: 0, fontSize: 15, color: '#3D3238', textWrap: 'pretty' }}>{texto}</p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onCerrar}
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
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
