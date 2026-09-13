import {
  CAMPOS,
  estiloAyuda,
  estiloCampo,
  estiloEtiqueta,
  estiloNombreCampo,
} from './ModalCliente'

// Import que cruza de funcionalidad, con el criterio de siempre: el chip
// del saldo se pinta igual acá que en los pedidos, así que la función se
// usa desde donde nació.
import { chipSaldo } from '../pedidos/presentacion'

// Lo que dice el recuento, con los textos del diseño.
function textoPedidos(cliente) {
  if (cliente.cantidad_pedidos === 0) return 'Sin pedidos registrados'

  const cuantos =
    cliente.cantidad_pedidos === 1 ? '1 pedido' : `${cliente.cantidad_pedidos} pedidos`

  return cliente.pedidos_en_curso > 0
    ? `${cuantos} · ${cliente.pedidos_en_curso} en curso`
    : cuantos
}


export default function ModalVerCliente({ cliente, onCerrar, onEditar }) {
  const chip = chipSaldo(cliente.saldo)

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
            Ver cliente
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
          {/* Los mismos campos del formulario, en solo lectura. El
              placeholder cambia a "Sin cargar" porque acá no hay nada que
              sugerir: dice que el dato no está. */}
          {CAMPOS.map((campo) => (
            <div key={campo.clave}>
              <label style={estiloEtiqueta}>
                <span style={estiloNombreCampo}>{campo.etiqueta}</span>
                <span style={estiloAyuda}>{campo.ayuda}</span>
              </label>

              <input
                value={cliente[campo.clave]}
                readOnly
                disabled
                placeholder="Sin cargar"
                style={{ ...estiloCampo, background: '#FAF7F7', cursor: 'default' }}
              />
            </div>
          ))}

          {/* Los dos van como texto y no como campos en solo lectura: los
              cuatro de arriba son datos del cliente que se pueden editar,
              y estos salen de sus pedidos. */}
          <div>
            <label style={estiloEtiqueta}>
              <span style={estiloNombreCampo}>PEDIDOS</span>
            </label>

            <p style={{ margin: 0, fontSize: 16, color: '#3D3238' }}>
              {textoPedidos(cliente)}
            </p>
          </div>

          <div>
            <label style={estiloEtiqueta}>
              <span style={estiloNombreCampo}>SALDO</span>
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
            Cerrar
          </button>

          <button
            onClick={onEditar}
            style={{
              padding: '10px 18px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}
