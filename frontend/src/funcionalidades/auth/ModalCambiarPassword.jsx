import { useState } from 'react'
import { cambiarPassword } from '../../api/cliente'
import BotonAccion from '../../componentes/BotonAccion'

// Los dos estados del ojo que muestra y oculta la contraseña.
const OJO = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const OJO_TACHADO = 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'

// El mismo mínimo que aplica el MinimumLengthValidator de Django, así el
// aviso de acá no puede contradecir al error del servidor.
const MINIMO = 8

const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  letterSpacing: '.06em',
  marginBottom: 7,
}

export default function ModalCambiarPassword({ onCerrar, onGuardado }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')

  // Un booleano por campo: cada ojo muestra solo el suyo.
  const [verActual, setVerActual] = useState(false)
  const [verNueva, setVerNueva] = useState(false)
  const [verRepetir, setVerRepetir] = useState(false)

  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errActual = !actual.trim()
  const errNueva = nueva.length < MINIMO
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

  const campos = [
    {
      id: 'actual',
      etiqueta: 'CONTRASEÑA ACTUAL',
      valor: actual,
      onCambiar: setActual,
      ver: verActual,
      onVer: () => setVerActual((v) => !v),
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
      ver: verNueva,
      onVer: () => setVerNueva((v) => !v),
      hayError: errNueva,
      ayuda: `Mínimo ${MINIMO} caracteres`,
      ayudaError: `La contraseña nueva necesita al menos ${MINIMO} caracteres.`,
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
      ver: verRepetir,
      onVer: () => setVerRepetir((v) => !v),
      hayError: errRepetir,
      ayuda: '',
      ayudaError: 'Las dos contraseñas no coinciden.',
      autoComplete: 'new-password',
      divisor: false,
    },
  ]

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
        zIndex: 100,
      }}
    >
      <div
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
          {campos.map((campo) => {
            const marcado = tocado && campo.hayError
            const ayuda = marcado ? campo.ayudaError : campo.ayuda

            return (
              <div key={campo.id}>
                {campo.divisor && (
                  <div style={{ height: 1, background: '#EBE0E2', margin: '20px 0 30px' }} />
                )}

                <label htmlFor={campo.id} style={estiloEtiqueta}>
                  {campo.etiqueta}
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    id={campo.id}
                    // Alternar el type es lo que muestra y oculta el texto.
                    type={campo.ver ? 'text' : 'password'}
                    value={campo.valor}
                    onChange={(e) => campo.onCambiar(e.target.value)}
                    autoComplete={campo.autoComplete}
                    style={{
                      width: '100%',
                      // El padding de la derecha le hace lugar al ojo, que
                      // va encima del input.
                      padding: '10px 44px 10px 13px',
                      border: marcado ? '1px solid #C0442F' : '1px solid #EBE0E2',
                      background: 'white',
                      fontSize: 16,
                      color: '#3D3238',
                      borderRadius: 5,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <BotonAccion
                      onClick={campo.onVer}
                      titulo={campo.ver ? 'Ocultar' : 'Mostrar'}
                      color="#857078"
                      hover="#F0E2E4"
                      icono={campo.ver ? OJO_TACHADO : OJO}
                      lado={32}
                    />
                  </div>
                </div>

                {ayuda && (
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 13,
                      color: marcado ? '#C0442F' : '#B08791',
                    }}
                  >
                    {ayuda}
                  </p>
                )}
              </div>
            )
          })}

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
