import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexto/AuthContext'
import { BASE_GESTION } from '../../constantes'
import PaginaDeAcceso, { CajaDeError } from './PaginaDeAcceso'
import {
  OJO, OJO_TACHADO, estiloBotonPrincipal, estiloCampo, estiloEnlace, estiloEtiqueta, estiloTarjeta,
} from './presentacion'

// El texto que se muestra cuando el login falla. El backend responde 429
// por dos motivos distintos: el throttle de DRF (más de 5 intentos en un
// minuto), cuyo 'detail' es un texto genérico traducido ("Solicitud fue
// regulada…"), y el bloqueo de axes por intentos fallidos, que trae un
// texto propio. Los distingue la cabecera Retry-After, que DRF manda
// siempre con el throttle y axes no: solo el primero se reemplaza.
function mensajeDeError(err) {
  const respuesta = err.response
  if (respuesta?.status === 429 && respuesta.headers['retry-after']) {
    return 'Demasiados intentos. Esperá un minuto y volvé a probar.'
  }
  return respuesta?.data?.detail || 'No se pudo iniciar sesión.'
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
      navegar(BASE_GESTION)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PaginaDeAcceso subtitulo="Ingresá con tu usuario para administrar tu emprendimiento">
      <form onSubmit={manejarEnvio} style={estiloTarjeta}>
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

          {/* Recuperar la contraseña por correo (corrección del tutor). */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => navegar(`${BASE_GESTION}/recuperar`)}
              style={estiloEnlace}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        {error && <CajaDeError>{error}</CajaDeError>}

        <button type="submit" disabled={enviando} style={estiloBotonPrincipal(enviando)}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </PaginaDeAcceso>
  )
}
