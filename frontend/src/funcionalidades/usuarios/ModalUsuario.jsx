import { useState } from 'react'
import { crearUsuario, modificarUsuario } from './api'
import { modificarMisDatos } from '../../api/cliente'
import CampoContrasena from './CampoContrasena'
import { CAMPOS } from './presentacion'
import { MINIMO_CONTRASENA } from '../auth/presentacion'
import { estiloCampo, estiloEtiqueta, estiloNombreCampo } from '../clientes/ModalCliente'

const VACIO = { username: '', first_name: '', last_name: '', email: '', password: '', repetir: '', password_actual: '' }

// Lo mismo que acepta el validador de usuario de Django: letras (también
// con acento), números y @ . + - _. Sin espacios.
const USUARIO_VALIDO = /^[\p{L}\p{N}@.+_-]+$/u

function validar(datos, { conContrasena, pideActual }) {
  const e = {}

  if (!datos.username.trim()) {
    e.username = 'El usuario es obligatorio.'
  } else if (!USUARIO_VALIDO.test(datos.username.trim())) {
    e.username = 'Solo letras, números y los signos @ . + - _, sin espacios.'
  }

  if (!datos.first_name.trim()) e.first_name = 'El nombre es obligatorio.'
  if (!datos.last_name.trim()) e.last_name = 'El apellido es obligatorio.'

  if (!datos.email.trim()) {
    e.email = 'El correo es obligatorio.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    e.email = 'Revisá el correo, parece incompleto.'
  }

  if (conContrasena) {
    if (datos.password.length < MINIMO_CONTRASENA) {
      e.password = `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`
    }
    if (!datos.repetir || datos.repetir !== datos.password) {
      e.repetir = 'Las dos contraseñas no coinciden.'
    }
  }

  if (pideActual && !datos.password_actual) {
    e.password_actual = 'Ingresá tu contraseña actual.'
  }

  return e
}

// Un solo modal para tres cosas, como ModalCliente para el alta y la
// edición: sin usuario es el alta de un administrador (con la contraseña y
// su repetición); con usuario, la edición de sus cuatro datos; y con
// misDatos, la superadministradora editando los suyos desde Mi cuenta, que
// pide la contraseña actual si cambia el usuario o el correo.
export default function ModalUsuario({ usuario, misDatos = false, onCerrar, onGuardado }) {
  const editando = Boolean(usuario)

  const [datos, setDatos] = useState(
    usuario
      ? {
          ...VACIO,
          username: usuario.username,
          first_name: usuario.first_name,
          last_name: usuario.last_name,
          email: usuario.email,
        }
      : VACIO
  )
  // Recién después del primer intento de guardar se marca en rojo: no tiene
  // sentido señalar como incompleto un formulario que todavía se está
  // llenando.
  const [tocado, setTocado] = useState(false)
  // Los errores por campo que contesta el backend, como el de usuario o
  // correo repetido y el de contraseña débil. Van separados de los locales
  // porque no se pueden recalcular mientras escribe: los sabe el servidor.
  const [erroresServidor, setErroresServidor] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // En Mis datos, cambiar el usuario o el correo pide la contraseña actual:
  // el correo es la llave para recuperar la contraseña. El campo aparece
  // recién cuando alguno de los dos difiere de lo guardado (o si el
  // servidor lo pidió igual).
  const cambiaLaLlave =
    misDatos &&
    (datos.username.trim() !== usuario.username || datos.email.trim() !== usuario.email)
  const pideActual = cambiaLaLlave || Boolean(erroresServidor.password_actual)
  const conContrasena = !editando

  const errores = tocado ? { ...validar(datos, { conContrasena, pideActual }), ...erroresServidor } : {}

  function cambiar(clave, valor) {
    setDatos((d) => ({ ...d, [clave]: valor }))
    // Lo que dijo el servidor era sobre los datos anteriores, así que al
    // corregir cualquier campo deja de valer.
    setErroresServidor({})
  }

  async function guardar() {
    setTocado(true)
    setError('')
    setErroresServidor({})

    if (Object.keys(validar(datos, { conContrasena, pideActual })).length > 0) return

    setEnviando(true)

    const limpios = {
      username: datos.username.trim(),
      first_name: datos.first_name.trim(),
      last_name: datos.last_name.trim(),
      email: datos.email.trim(),
    }

    try {
      let respuesta
      if (misDatos) {
        respuesta = await modificarMisDatos(
          cambiaLaLlave ? { ...limpios, password_actual: datos.password_actual } : limpios
        )
      } else if (editando) {
        respuesta = await modificarUsuario(usuario.id, limpios)
      } else {
        respuesta = await crearUsuario({ ...limpios, password: datos.password })
      }
      // Quien abrió el modal recibe el usuario guardado, para avisarlo con su
      // nombre de usuario o para actualizar la sesión.
      onGuardado(respuesta.data)
    } catch (err) {
      const datosError = err.response?.data

      // El backend contesta de dos formas: las reglas de negocio mandan
      // {'detail': '...'} y los errores de campo mandan
      // {'username': ['Ya existe un usuario con ese nombre.']}. Los de
      // campo van debajo del suyo.
      if (datosError && !datosError.detail && typeof datosError === 'object') {
        const porCampo = {}
        for (const clave of [...CAMPOS.map((c) => c.clave), 'password', 'password_actual']) {
          const mensajes = datosError[clave]
          if (Array.isArray(mensajes) && mensajes.length > 0) {
            porCampo[clave] = mensajes.join(' ')
          }
        }
        setErroresServidor(porCampo)

        if (Object.keys(porCampo).length === 0) {
          setError('No se pudieron guardar los datos.')
        }
      } else {
        setError(datosError?.detail || 'No se pudieron guardar los datos.')
      }

      setEnviando(false)
    }
  }

  const titulo = misDatos ? 'Mis datos' : editando ? 'Editar usuario' : 'Nuevo usuario'

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
          maxWidth: 480,
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

        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
          }}
        >
          {CAMPOS.map((campo) => (
            <div key={campo.clave}>
              <label htmlFor={campo.clave} style={estiloEtiqueta}>
                {/* El asterisco marca los obligatorios, como en los demás
                    formularios. Acá lo llevan los cuatro. */}
                <span style={estiloNombreCampo}>{campo.etiqueta} *</span>
              </label>

              <input
                id={campo.clave}
                value={datos[campo.clave]}
                onChange={(e) => cambiar(campo.clave, e.target.value)}
                placeholder={campo.placeholder}
                maxLength={campo.max}
                // Sin la lista de lo ya escrito que ofrece el navegador: acá
                // se cargan los datos de OTRA persona, y en el correo salían
                // los correos ya usados (pedido de la usuaria).
                autoComplete="off"
                style={{
                  ...estiloCampo,
                  border: errores[campo.clave] ? '1px solid #C0442F' : '1px solid #EBE0E2',
                }}
              />

              {errores[campo.clave] && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                  {errores[campo.clave]}
                </p>
              )}
            </div>
          ))}

          {conContrasena && (
            <>
              {/* La línea separa los datos de la contraseña, como en
                  ModalCambiarPassword separa la actual de la nueva. */}
              <div style={{ height: 1, background: '#EBE0E2', margin: '4px 0' }} />

              <CampoContrasena
                id="password"
                etiqueta="CONTRASEÑA *"
                valor={datos.password}
                onCambiar={(v) => cambiar('password', v)}
                error={errores.password}
                ayuda={`Mínimo ${MINIMO_CONTRASENA} caracteres. El usuario la puede cambiar después desde Mi cuenta.`}
                autoComplete="new-password"
              />

              <CampoContrasena
                id="repetir"
                etiqueta="REPETIR CONTRASEÑA *"
                valor={datos.repetir}
                onCambiar={(v) => cambiar('repetir', v)}
                error={errores.repetir}
                autoComplete="new-password"
              />
            </>
          )}

          {pideActual && (
            <>
              <div style={{ height: 1, background: '#EBE0E2', margin: '4px 0' }} />

              <CampoContrasena
                id="password_actual"
                etiqueta="CONTRASEÑA ACTUAL *"
                valor={datos.password_actual}
                onCambiar={(v) => cambiar('password_actual', v)}
                error={errores.password_actual}
                ayuda="Cambiar el usuario o el correo pide tu contraseña actual."
                autoComplete="current-password"
              />
            </>
          )}

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
            {editando
              ? enviando ? 'Guardando…' : 'Guardar'
              : enviando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
