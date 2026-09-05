import { useState } from 'react'
import { crearCliente, modificarCliente } from './api'

// Los cuatro campos del cliente, definidos una sola vez. ModalVerCliente
// importa esta lista: el modal de ver es este mismo formulario en solo
// lectura, así que los campos son los del formulario.
export const CAMPOS = [
  { clave: 'instagram', etiqueta: 'INSTAGRAM', ayuda: 'obligatorio, único', max: 30, placeholder: 'usuario sin @' },
  { clave: 'nombre', etiqueta: 'NOMBRE', ayuda: 'obligatorio', max: 50, placeholder: 'Cómo la llamás' },
  { clave: 'apellido', etiqueta: 'APELLIDO', ayuda: 'opcional', max: 50, placeholder: 'Si te lo dio' },
  { clave: 'email', etiqueta: 'EMAIL', ayuda: 'opcional, para mandarle el comprobante', max: 254, placeholder: 'nombre@correo.com' },
]

const VACIO = { instagram: '', nombre: '', apellido: '', email: '' }

export const estiloEtiqueta = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  marginBottom: 7,
}

export const estiloNombreCampo = {
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  letterSpacing: '.06em',
}

export const estiloAyuda = {
  fontSize: 12,
  color: '#B08791',
}

export const estiloCampo = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #EBE0E2',
  background: 'white',
  fontSize: 16,
  color: '#3D3238',
  borderRadius: 5,
  outline: 'none',
  fontFamily: 'inherit',
}

// El usuario se guarda sin el '@' inicial, igual que en el modelo. Se limpia
// acá también para que escribir solo "@" cuente como vacío.
function limpiarUsuario(valor) {
  return valor.trim().replace(/^@/, '')
}

function validar(datos) {
  const e = {}

  if (!limpiarUsuario(datos.instagram)) {
    e.instagram = 'El usuario de Instagram es obligatorio.'
  }

  if (!datos.nombre.trim()) {
    e.nombre = 'El nombre es obligatorio.'
  }

  if (datos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    e.email = 'Revisá el email, parece incompleto.'
  }

  return e
}

export default function ModalCliente({ cliente, onCerrar, onGuardado }) {
  // Si llega un cliente, el modal está en modo edición.
  const editando = Boolean(cliente)

  const [datos, setDatos] = useState(
    cliente
      ? {
          instagram: cliente.instagram,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          email: cliente.email,
        }
      : VACIO
  )
  // Recién después del primer intento de guardar se marca en rojo: no tiene
  // sentido señalar como incompleto un formulario que todavía se está
  // llenando.
  const [tocado, setTocado] = useState(false)
  // Los errores por campo que contesta el backend, como el de usuario
  // repetido. Van separados de los locales porque no se pueden recalcular
  // mientras escribe: los sabe el servidor.
  const [erroresServidor, setErroresServidor] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errores = tocado ? { ...validar(datos), ...erroresServidor } : {}

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

    if (Object.keys(validar(datos)).length > 0) return

    setEnviando(true)

    const limpios = {
      instagram: limpiarUsuario(datos.instagram),
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      email: datos.email.trim(),
    }

    try {
      if (editando) {
        await modificarCliente(cliente.id, limpios)
      } else {
        await crearCliente(limpios)
      }
      onGuardado()
    } catch (err) {
      const datosError = err.response?.data

      // El backend contesta de dos formas: las reglas de negocio mandan
      // {'detail': '...'} y los errores de campo mandan
      // {'instagram': ['Ya tenés un cliente con ese usuario.']}. El de
      // usuario repetido es del segundo tipo, y va debajo de su campo.
      if (datosError && !datosError.detail && typeof datosError === 'object') {
        const porCampo = {}
        for (const campo of CAMPOS) {
          const mensajes = datosError[campo.clave]
          if (Array.isArray(mensajes) && mensajes.length > 0) {
            porCampo[campo.clave] = mensajes[0]
          }
        }
        setErroresServidor(porCampo)

        if (Object.keys(porCampo).length === 0) {
          setError('No se pudo guardar el cliente.')
        }
      } else {
        setError(datosError?.detail || 'No se pudo guardar el cliente.')
      }

      setEnviando(false)
    }
  }

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
            {editando ? 'Editar cliente' : 'Nuevo cliente'}
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
                <span style={estiloNombreCampo}>{campo.etiqueta}</span>
                <span style={estiloAyuda}>{campo.ayuda}</span>
              </label>

              <input
                id={campo.clave}
                value={datos[campo.clave]}
                onChange={(e) => cambiar(campo.clave, e.target.value)}
                placeholder={campo.placeholder}
                maxLength={campo.max}
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
              : enviando ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}
