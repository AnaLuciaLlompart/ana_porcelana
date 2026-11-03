import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pedirEnlaceDeRestablecimiento } from '../../api/cliente'
import { BASE_GESTION } from '../../constantes'
import PaginaDeAcceso, { CajaDeError } from './PaginaDeAcceso'
import {
  estiloBotonPrincipal, estiloCampo, estiloEnlace, estiloEtiqueta, estiloTarjeta,
} from './presentacion'

// "¿Olvidaste tu contraseña?": pide el correo y el backend manda el enlace
// (corrección del tutor). El backend responde lo mismo exista o no el
// correo, y la pantalla muestra ese texto tal cual.
function mensajeDeError(err) {
  const respuesta = err.response
  if (respuesta?.status === 429) {
    return 'Demasiados pedidos. Esperá un rato y volvé a intentar.'
  }
  return respuesta?.data?.detail || 'No se pudo enviar el correo.'
}

export default function RecuperarContrasena() {
  const navegar = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Lo que respondió el backend: con esto la tarjeta deja de ser un formulario.
  const [mensaje, setMensaje] = useState('')

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Ingresá tu correo.')
      return
    }
    setEnviando(true)

    try {
      const respuesta = await pedirEnlaceDeRestablecimiento(email.trim())
      setMensaje(respuesta.data.detail)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const volverAlLogin = (
    <div style={{ textAlign: 'center' }}>
      <button type="button" onClick={() => navegar(`${BASE_GESTION}/login`)} style={estiloEnlace}>
        Volver al inicio de sesión
      </button>
    </div>
  )

  return (
    <PaginaDeAcceso subtitulo="Ingresá el correo de tu cuenta y te mandamos un enlace para elegir una contraseña nueva">
      {mensaje ? (
        <div style={estiloTarjeta}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, textWrap: 'pretty' }}>{mensaje}</p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>
            Si no lo ves, revisá la carpeta de spam.
          </p>
          {volverAlLogin}
        </div>
      ) : (
        <form onSubmit={manejarEnvio} style={estiloTarjeta}>
          <div>
            <label htmlFor="email" style={estiloEtiqueta}>Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="El correo de tu cuenta"
              autoComplete="email"
              style={estiloCampo}
            />
          </div>

          {error && <CajaDeError>{error}</CajaDeError>}

          <button type="submit" disabled={enviando} style={estiloBotonPrincipal(enviando)}>
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </button>

          {volverAlLogin}
        </form>
      )}
    </PaginaDeAcceso>
  )
}
