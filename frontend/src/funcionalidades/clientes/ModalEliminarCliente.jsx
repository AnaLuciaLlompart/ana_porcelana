import { useState } from 'react'
import { eliminarCliente } from './api'


const ICONO_CANDADO = 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'


export default function ModalEliminarCliente({ cliente, onCerrar, onEliminado, onVerCliente }) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // El modal tiene dos caras. La decisión se toma acá, con el dato que ya
  // vino en el listado, para no ofrecer un botón que se sabe que va a
  // fallar. El backend igual rechaza el borrado por su cuenta: esto es
  // para explicarlo antes, no en lugar de eso.
  const bloqueado = cliente.cantidad_pedidos > 0

  const conPedidos =
    cliente.cantidad_pedidos === 1
      ? '1 pedido registrado'
      : `${cliente.cantidad_pedidos} pedidos registrados`

  async function confirmar() {
    setError('')
    setEnviando(true)

    try {
      await eliminarCliente(cliente.id)
      onEliminado()
    } catch (err) {
      // El destroy del ViewSet rechaza el borrado de un cliente con
      // pedidos, y su mensaje aparece acá.
      setError(err.response?.data?.detail || 'No se pudo eliminar el cliente.')
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
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 480,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 24px',
            background: bloqueado ? '#8C5A66' : '#C0442F',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={bloqueado ? ICONO_CANDADO : ICONO_ALERTA}
            />
          </svg>

          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            {bloqueado ? 'No se puede eliminar' : 'Eliminar cliente'}
          </h2>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 16, color: '#3D3238', textWrap: 'pretty' }}>
            {bloqueado
              ? `@${cliente.instagram} tiene ${conPedidos}.`
              : `¿Eliminar a @${cliente.instagram}?`}
          </p>

          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            {bloqueado
              ? 'Los pedidos guardan a qué cliente pertenecen, así que borrarlo dejaría ese historial sin dueño. Si ya no le vendés, dejalo cargado: no molesta en el listado.'
              : 'No tiene pedidos registrados, así que se puede eliminar sin perder historial. Esta acción no se puede deshacer.'}
          </p>

          {error && (
            <p
              role="alert"
              style={{
                marginTop: 16,
                marginBottom: 0,
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
            {bloqueado ? 'Entendido' : 'Cancelar'}
          </button>

          {/* La cara bloqueada no ofrece borrar: lleva a la ficha del
              cliente, que es la salida que queda. */}
          {bloqueado ? (
            <button
              onClick={onVerCliente}
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
              Ver cliente
            </button>
          ) : (
            <button
              onClick={confirmar}
              disabled={enviando}
              style={{
                padding: '10px 18px',
                border: 0,
                background: '#C0442F',
                color: 'white',
                borderRadius: 6,
                cursor: enviando ? 'default' : 'pointer',
                opacity: enviando ? 0.7 : 1,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {enviando ? 'Eliminando…' : 'Eliminar cliente'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
