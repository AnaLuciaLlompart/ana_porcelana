import { CAMPOS, chipEstado, fmtFechaHora } from './presentacion'
import { estiloCampo, estiloEtiqueta, estiloNombreCampo } from '../clientes/ModalCliente'

// El modal de ver, de solo lectura, como ModalVerCliente: los mismos cuatro
// campos del formulario apagados, y debajo lo que la tabla no muestra, el
// estado y las dos fechas que escribe Django (el alta de la cuenta y el
// último ingreso). No tiene pie, como ningún modal de ver.
export default function ModalVerUsuario({ usuario, onCerrar }) {
  const chip = chipEstado(usuario)

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
            Ver usuario
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
              <label style={estiloEtiqueta}>
                <span style={estiloNombreCampo}>{campo.etiqueta}</span>
              </label>

              <input
                value={usuario[campo.clave]}
                readOnly
                disabled
                placeholder="Sin cargar"
                style={{ ...estiloCampo, background: '#FAF7F7', cursor: 'default' }}
              />
            </div>
          ))}

          {/* Los tres van como texto y no como campos apagados: los cuatro
              de arriba se editan, y estos los escribe el sistema. */}
          <div>
            <label style={estiloEtiqueta}>
              <span style={estiloNombreCampo}>ESTADO</span>
            </label>

            <span
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 20,
                padding: '5px 12px',
                border: `1px solid ${chip.borde}`,
                background: chip.fondo,
                color: chip.color,
              }}
            >
              {chip.texto}
            </span>
          </div>

          <div>
            <label style={estiloEtiqueta}>
              <span style={estiloNombreCampo}>CUENTA CREADA</span>
            </label>

            <p style={{ margin: 0, fontSize: 16, color: '#3D3238' }}>
              {fmtFechaHora(usuario.date_joined)}
            </p>
          </div>

          <div>
            <label style={estiloEtiqueta}>
              <span style={estiloNombreCampo}>ÚLTIMO INGRESO</span>
            </label>

            <p style={{ margin: 0, fontSize: 16, color: usuario.last_login ? '#3D3238' : '#857078' }}>
              {usuario.last_login ? fmtFechaHora(usuario.last_login) : 'Todavía no entró'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
