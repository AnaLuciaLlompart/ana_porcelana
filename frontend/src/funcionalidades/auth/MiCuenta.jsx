import { useRef, useState } from 'react'
import { useAuth } from '../../contexto/AuthContext'
import ModalCambiarPassword from './ModalCambiarPassword'
import Toast from '../../componentes/Toast'
import { ICONO_CANDADO } from './presentacion'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// formulario del usuario nació en la gestión de usuarios y Mis datos lo usa
// desde ahí, con la prop misDatos.
import ModalUsuario from '../usuarios/ModalUsuario'

// El lápiz de "Editar", el mismo de los listados: acá edita los datos de la
// tarjeta.
const ICONO_EDITAR = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'

const estiloBoton = {
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
}

const estiloEtiqueta = {
  margin: 0,
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  letterSpacing: '.06em',
}

export default function MiCuenta() {
  const { usuario, actualizarUsuario } = useAuth()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoDatos, setEditandoDatos] = useState(false)
  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  function mostrarToast(texto) {
    setToast(texto)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 1400)
  }

  // Los tres datos que muestra la tarjeta, para todos. El correo es adonde
  // llega el enlace para recuperar la contraseña.
  const datos = [
    { etiqueta: 'USUARIO', valor: usuario.username },
    { etiqueta: 'NOMBRE Y APELLIDO', valor: `${usuario.first_name} ${usuario.last_name}`.trim() },
    { etiqueta: 'CORREO', valor: usuario.email },
  ]

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
        {/* Sin cabecera (pedido de la usuaria): la tarjeta son los datos y
            los botones. Un administrador ve los datos sin botón para
            editarlos: los cambia la superadministradora desde Usuarios. */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid #EBE0E2',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {datos.map((dato) => (
            <div key={dato.etiqueta}>
              <p style={estiloEtiqueta}>{dato.etiqueta}</p>
              <p style={{ margin: '5px 0 0', fontSize: 16, color: dato.valor ? '#3D3238' : '#857078' }}>
                {dato.valor || 'Sin cargar'}
              </p>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setModalAbierto(true)} className="btn-reponer" style={estiloBoton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CANDADO} />
            </svg>
            Cambiar contraseña
          </button>

          {/* Edita los datos de la tarjeta (usuario, nombre, apellido y
              correo); solo la superadministradora. */}
          {usuario.es_superadministradora && (
            <button onClick={() => setEditandoDatos(true)} className="btn-reponer" style={estiloBoton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_EDITAR} />
              </svg>
              Editar
            </button>
          )}
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

      {editandoDatos && (
        <ModalUsuario
          usuario={usuario}
          misDatos
          onCerrar={() => setEditandoDatos(false)}
          onGuardado={(guardado) => {
            setEditandoDatos(false)
            // La respuesta tiene la misma forma que la sesión: la tarjeta
            // muestra los datos nuevos sin recargar.
            actualizarUsuario(guardado)
            mostrarToast('Datos guardados')
          }}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
