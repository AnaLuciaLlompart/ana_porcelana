import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { restablecerContrasena, validarEnlaceDeRestablecimiento } from '../../api/cliente'
import { BASE_GESTION } from '../../constantes'
import BotonAccion from '../../componentes/BotonAccion'
import ModalAviso from '../../componentes/ModalAviso'
import PaginaDeAcceso, { CajaDeError } from './PaginaDeAcceso'
import {
  MINIMO_CONTRASENA, OJO, OJO_TACHADO, estiloBotonPrincipal, estiloCampo, estiloEnlace,
  estiloEtiqueta, estiloTarjeta,
} from './presentacion'

// La pantalla del enlace del correo: elegir la contraseña nueva (corrección
// del tutor). Al entrar le pregunta al backend si el enlace sirve; si venció
// o ya se usó, ofrece pedir otro. Las validaciones son las de
// ModalCambiarPassword, y el servidor aplica además sus validadores.
const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pedí uno nuevo.'

export default function RestablecerContrasena() {
  const { uid, token } = useParams()
  const navegar = useNavigate()

  // 'cargando' mientras se revisa el enlace; después 'formulario' o 'invalido'.
  const [estado, setEstado] = useState('cargando')
  const [username, setUsername] = useState('')

  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [verNueva, setVerNueva] = useState(false)
  const [verRepetir, setVerRepetir] = useState(false)
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    let vigente = true
    validarEnlaceDeRestablecimiento(uid, token)
      .then((respuesta) => {
        if (!vigente) return
        setUsername(respuesta.data.username)
        setEstado('formulario')
      })
      .catch(() => {
        if (vigente) setEstado('invalido')
      })
    return () => { vigente = false }
  }, [uid, token])

  const errNueva = nueva.length < MINIMO_CONTRASENA
  const errRepetir = repetir !== nueva || !repetir

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    if (errNueva || errRepetir) {
      setTocado(true)
      return
    }
    setEnviando(true)

    try {
      await restablecerContrasena(uid, token, nueva)
      setGuardado(true)
    } catch (err) {
      const respuesta = err.response
      if (respuesta?.data?.detail === MENSAJE_ENLACE_INVALIDO) {
        setEstado('invalido')
      } else if (respuesta?.status === 429) {
        setError('Demasiados intentos. Esperá un minuto y volvé a probar.')
      } else {
        setError(respuesta?.data?.detail || 'No se pudo guardar la contraseña.')
      }
      setEnviando(false)
    }
  }

  const campos = [
    {
      id: 'nueva',
      etiqueta: 'Contraseña nueva',
      valor: nueva,
      onCambiar: setNueva,
      ver: verNueva,
      onVer: () => setVerNueva((v) => !v),
      hayError: errNueva,
      ayuda: `Mínimo ${MINIMO_CONTRASENA} caracteres`,
      ayudaError: `La contraseña nueva necesita al menos ${MINIMO_CONTRASENA} caracteres.`,
    },
    {
      id: 'repetir',
      etiqueta: 'Repetir contraseña nueva',
      valor: repetir,
      onCambiar: setRepetir,
      ver: verRepetir,
      onVer: () => setVerRepetir((v) => !v),
      hayError: errRepetir,
      ayuda: '',
      ayudaError: 'Las dos contraseñas no coinciden.',
    },
  ]

  if (estado === 'cargando') {
    return (
      <PaginaDeAcceso subtitulo="Revisando el enlace…">
        <p style={{ margin: 0, textAlign: 'center', color: '#857078' }}>Cargando…</p>
      </PaginaDeAcceso>
    )
  }

  if (estado === 'invalido') {
    return (
      <PaginaDeAcceso subtitulo="Este enlace venció o ya se usó">
        <div style={estiloTarjeta}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, textWrap: 'pretty' }}>
            Los enlaces para restablecer la contraseña duran poco y sirven una sola vez.
            Pedí uno nuevo con tu correo.
          </p>
          <button
            type="button"
            onClick={() => navegar(`${BASE_GESTION}/recuperar`)}
            style={estiloBotonPrincipal(false)}
          >
            Pedir otro enlace
          </button>
          <div style={{ textAlign: 'center' }}>
            <button type="button" onClick={() => navegar(`${BASE_GESTION}/login`)} style={estiloEnlace}>
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </PaginaDeAcceso>
    )
  }

  return (
    <PaginaDeAcceso subtitulo={`Elegí la contraseña nueva para «${username}»`}>
      <form onSubmit={manejarEnvio} style={estiloTarjeta}>
        {campos.map((campo) => {
          const marcado = tocado && campo.hayError
          const ayuda = marcado ? campo.ayudaError : campo.ayuda

          return (
            <div key={campo.id}>
              <label htmlFor={campo.id} style={estiloEtiqueta}>{campo.etiqueta}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id={campo.id}
                  type={campo.ver ? 'text' : 'password'}
                  value={campo.valor}
                  onChange={(e) => campo.onCambiar(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    ...estiloCampo,
                    padding: '11px 44px 11px 14px',
                    border: marcado ? '1px solid #C0442F' : estiloCampo.border,
                  }}
                />
                <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
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
                <p style={{ margin: '6px 0 0', fontSize: 13, color: marcado ? '#C0442F' : '#B08791' }}>
                  {ayuda}
                </p>
              )}
            </div>
          )
        })}

        {error && <CajaDeError>{error}</CajaDeError>}

        <button type="submit" disabled={enviando} style={estiloBotonPrincipal(enviando)}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>

      {guardado && (
        <ModalAviso
          titulo="Contraseña actualizada"
          texto="Ya podés iniciar sesión con la nueva."
          onCerrar={() => navegar(`${BASE_GESTION}/login`, { replace: true })}
        />
      )}
    </PaginaDeAcceso>
  )
}
