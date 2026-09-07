import { useRef, useState } from 'react'
import { useAuth } from '../../contexto/AuthContext'
import ModalCambiarPassword from './ModalCambiarPassword'
import Toast from '../../componentes/Toast'

const ICONO_CANDADO = 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'

export default function MiCuenta() {
  const { usuario } = useAuth()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  function mostrarToast(texto) {
    setToast(texto)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 2600)
  }

  return (
    <div>
      <h1
        style={{
          margin: '0 0 24px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 32,
          color: '#3D3238',
        }}
      >
        Mi cuenta
      </h1>

      <div
        style={{
          maxWidth: 640,
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: '#8C5A66',
              letterSpacing: '.06em',
            }}
          >
            DATOS DE ACCESO
          </h2>
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #EBE0E2' }}>
          <p
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: '#857078',
              letterSpacing: '.06em',
            }}
          >
            USUARIO
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 16, color: '#3D3238' }}>
            {usuario.username}
          </p>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <button
            onClick={() => setModalAbierto(true)}
            className="btn-reponer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              border: '1px solid #8C5A66',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CANDADO} />
            </svg>
            Cambiar contraseña
          </button>
        </div>
      </div>

      {modalAbierto && (
        <ModalCambiarPassword
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false)
            // Cambiar la contraseña no deja ningún rastro en pantalla, así
            // que sin este aviso no habría forma de saber que funcionó.
            mostrarToast('Contraseña actualizada')
          }}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
