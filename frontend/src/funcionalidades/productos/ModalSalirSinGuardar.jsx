const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'


// Este modal no llama a la API: solo pregunta. Quien guarda es la ficha, que
// ya tiene el borrador y sabe cómo mandarlo.
export default function ModalSalirSinGuardar({ nombre, onCancelar, onSalirSinGuardar, onGuardarYSalir }) {
  return (
    <div
      onClick={onCancelar}
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
          maxWidth: 450,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 24px',
            background: '#8C5A66',
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
              fontSize: 18,
              color: 'white',
            }}
          >
            Tenés cambios sin guardar
          </h2>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <p style={{ margin: 0, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
            Editaste “{nombre}” y todavía no guardaste.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onSalirSinGuardar}
            className="btn-salir-sin-guardar"
            style={{
              padding: '10px 18px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#C0442F',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Salir sin guardar
          </button>

          <button
            onClick={onGuardarYSalir}
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
            Guardar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
