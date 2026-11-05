import { useState } from 'react'
import { cambiarPasswordDeUsuario } from './api'
import CampoContrasena from './CampoContrasena'
import { MINIMO_CONTRASENA } from '../auth/presentacion'

// La superadministradora le pone una contraseña nueva a un administrador.
// Sin "contraseña actual", a diferencia de ModalCambiarPassword: no la
// cambia él. Al guardar, el backend le cierra la sesión que tuviera abierta.
export default function ModalContrasenaDeUsuario({ usuario, onCerrar, onGuardado }) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [tocado, setTocado] = useState(false)
  const [errorServidor, setErrorServidor] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errNueva = nueva.length < MINIMO_CONTRASENA
  const errRepetir = !repetir || repetir !== nueva

  async function guardar() {
    setError('')
    setErrorServidor('')

    if (errNueva || errRepetir) {
      setTocado(true)
      return
    }

    setEnviando(true)

    try {
      const respuesta = await cambiarPasswordDeUsuario(usuario.id, nueva)
      onGuardado(respuesta.data)
    } catch (err) {
      const datosError = err.response?.data
      // Los validadores de Django (común, solo numérica, parecida al
      // usuario) vuelven con la clave password_nueva, debajo del campo; las
      // reglas de negocio (dado de baja, superadministradora), como detail.
      if (Array.isArray(datosError?.password_nueva)) {
        setErrorServidor(datosError.password_nueva.join(' '))
      } else {
        setError(datosError?.detail || 'No se pudo cambiar la contraseña.')
      }
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
          <p style={{ margin: 0, fontSize: 15, color: '#3D3238', textWrap: 'pretty' }}>
            La contraseña nueva de <strong>{usuario.username}</strong>. Si tiene una sesión
            abierta, se cierra ahora.
          </p>

          <CampoContrasena
            id="password_nueva"
            etiqueta="CONTRASEÑA NUEVA"
            valor={nueva}
            onCambiar={(v) => {
              setNueva(v)
              setErrorServidor('')
            }}
            error={(tocado && errNueva && `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`) || errorServidor}
            ayuda={`Mínimo ${MINIMO_CONTRASENA} caracteres`}
            autoComplete="new-password"
          />

          <CampoContrasena
            id="repetir"
            etiqueta="REPETIR CONTRASEÑA NUEVA"
            valor={repetir}
            onCambiar={setRepetir}
            error={tocado && errRepetir ? 'Las dos contraseñas no coinciden.' : ''}
            autoComplete="new-password"
          />

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
