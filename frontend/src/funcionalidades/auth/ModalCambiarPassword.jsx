import { useState } from 'react'
import { cambiarPassword } from '../../api/cliente'
import CampoContrasena from '../../componentes/CampoContrasena'
import { MINIMO_CONTRASENA } from './presentacion'

export default function ModalCambiarPassword({ onCerrar, onGuardado }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')

  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errActual = !actual.trim()
  const errNueva = nueva.length < MINIMO_CONTRASENA
  const errRepetir = repetir !== nueva || !repetir

  async function guardar() {
    setError('')

    if (errActual || errNueva || errRepetir) {
      setTocado(true)
      return
    }

    setEnviando(true)

    try {
      await cambiarPassword(actual, nueva)
      onGuardado()
    } catch (err) {
      // El servidor aplica cuatro validadores más: contraseña común, solo
      // numérica, parecida al usuario y el largo mínimo. Todos vuelven
      // como un detail.
      setError(err.response?.data?.detail || 'No se pudo cambiar la contraseña.')
      setEnviando(false)
    }
  }

  // Los tres campos son CampoContrasena, el mismo de la gestión de
  // usuarios: cada uno con su ojo. Recién después del primer intento de
  // guardar se marcan en rojo.
  const campos = [
    {
      id: 'actual',
      etiqueta: 'CONTRASEÑA ACTUAL',
      valor: actual,
      onCambiar: setActual,
      hayError: errActual,
      ayuda: '',
      ayudaError: 'Ingresá tu contraseña actual.',
      autoComplete: 'current-password',
      divisor: false,
    },
    {
      id: 'nueva',
      etiqueta: 'CONTRASEÑA NUEVA',
      valor: nueva,
      onCambiar: setNueva,
      hayError: errNueva,
      ayuda: `Mínimo ${MINIMO_CONTRASENA} caracteres`,
      ayudaError: `La contraseña nueva necesita al menos ${MINIMO_CONTRASENA} caracteres.`,
      autoComplete: 'new-password',
      // La línea separa lo que sos de lo que vas a ser: arriba la que
      // tenés, abajo la que viene.
      divisor: true,
    },
    {
      id: 'repetir',
      etiqueta: 'REPETIR CONTRASEÑA NUEVA',
      valor: repetir,
      onCambiar: setRepetir,
      hayError: errRepetir,
      ayuda: '',
      ayudaError: 'Las dos contraseñas no coinciden.',
      autoComplete: 'new-password',
      divisor: false,
    },
  ]

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
          maxWidth: 460,
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
            Cambiar contraseña
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

        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
          }}
        >
          {campos.map((campo) => (
            <div key={campo.id}>
              {campo.divisor && (
                <div style={{ height: 1, background: '#EBE0E2', margin: '4px 0 20px' }} />
              )}

              <CampoContrasena
                id={campo.id}
                etiqueta={campo.etiqueta}
                valor={campo.valor}
                onCambiar={campo.onCambiar}
                error={tocado && campo.hayError ? campo.ayudaError : ''}
                ayuda={campo.ayuda}
                autoComplete={campo.autoComplete}
              />
            </div>
          ))}

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
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
            Cancelar
          </button>

          <button
            onClick={guardar}
            disabled={enviando}
            style={{
              padding: '10px 18px',
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
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
