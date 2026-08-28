import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexto/AuthContext'

const OJO = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const OJO_TACHADO = 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'

const estiloCampo = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #EBE0E2',
  background: '#FAF7F7',
  fontSize: 15,
  color: '#3D3238',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
}

const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.03em',
}

export default function Login() {
  const { entrar } = useAuth()
  const navegar = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)

    try {
      await entrar(username, password)
      navegar('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAF7F7',
      padding: '40px 24px',
      fontFamily: "'Nunito Sans', sans-serif",
      color: '#3D3238',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          marginBottom: 28,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#F0E2E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#8C5A66" strokeWidth="1.4">
              <circle cx="12" cy="7" r="3" />
              <circle cx="7.2" cy="10.5" r="3" />
              <circle cx="16.8" cy="10.5" r="3" />
              <circle cx="9.2" cy="15.4" r="3" />
              <circle cx="14.8" cy="15.4" r="3" />
              <circle cx="12" cy="11.6" r="1.5" fill="#8C5A66" stroke="none" />
            </svg>
          </div>
          <h1 style={{
            margin: 0,
            textAlign: 'center',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: '#8C5A66',
          }}>
            Ana Porcelana
          </h1>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, color: '#857078' }}>
            Ingresá con tu usuario para administrar tu emprendimiento
          </p>
        </div>

        <form
          onSubmit={manejarEnvio}
          style={{
            background: 'white',
            border: '1px solid #EBE0E2',
            borderRadius: 10,
            padding: '28px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <label htmlFor="username" style={estiloEtiqueta}>Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              autoComplete="username"
              style={estiloCampo}
            />
          </div>

          <div>
            <label htmlFor="password" style={estiloEtiqueta}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={verPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                style={{ ...estiloCampo, padding: '11px 44px 11px 14px' }}
              />
              <button
                type="button"
                onClick={() => setVerPass((v) => !v)}
                title={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857078" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d={verPass ? OJO_TACHADO : OJO} />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" style={{
              margin: 0,
              padding: '10px 12px',
              background: '#FAEAE8',
              border: '1px solid #F0C4BC',
              borderRadius: 6,
              fontSize: 14,
              color: '#C0442F',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 2,
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: enviando ? 'default' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            {enviando ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#B08791' }}>
          Accesorios hechos a mano con ♥
        </p>
      </div>
    </div>
  )
}

