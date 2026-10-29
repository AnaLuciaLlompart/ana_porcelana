import { useState } from 'react'
import { registrarCobro, modificarCobro, borrarCobro } from './api'
import PestanaCobros from './PestanaCobros'
import ModalCobro from './ModalCobro'


// El backend contesta de dos formas según qué falló: las reglas de negocio
// mandan {'detail': '...'} y los errores de campo mandan
// {'cliente': ['Este campo es requerido.']}. Hay que mirar las dos para no
// tragarse el mensaje.
function mensajeDeError(err) {
  const datos = err.response?.data
  if (!datos) return 'No se pudo completar la acción.'
  if (datos.detail) return datos.detail

  const primerCampo = Object.values(datos)[0]
  if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0]

  return 'No se pudo completar la acción.'
}

const estiloCartelError = {
  margin: 0,
  padding: '10px 12px',
  background: '#FAEAE8',
  border: '1px solid #F0C4BC',
  borderRadius: 6,
  fontSize: 14,
  color: '#C0442F',
  textWrap: 'pretty',
}


// Los cobros de un pedido (CU48 a CU51), en un modal y no en la ficha.
// Recibe el pedido completo y no sabe quién lo abrió: cada cambio se lo
// devuelve con onPedidoActualizado, junto con el aviso a mostrar.
export default function ModalCobros({ pedido, onCerrar, onPedidoActualizado }) {
  // null cuando está cerrado. Abierto guarda o bien el cobro que se está
  // editando, o bien la cadena 'nuevo' para el alta: hacen falta los dos
  // casos y null ya significa "cerrado".
  const [modalCobro, setModalCobro] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function abrirCobro(cobro) {
    setError('')
    setModalCobro(cobro)
  }

  function cerrarCobro() {
    setError('')
    setModalCobro(null)
  }

  // Los cobros se registran en el momento: el pedido se cobra o no se
  // cobra, no es un campo que se esté editando. Las tres devuelven el
  // pedido completo, así que el resumen de acá y el chip de la cabecera se
  // acomodan solos.
  //
  // El modal del cobro queda abierto mientras viaja, y se cierra solo si
  // salió bien: si el servidor lo rechaza, el mensaje se ve adentro.
  async function guardarCobro(cobro, datos) {
    setError('')
    setEnviando(true)

    try {
      // El mismo modal registra y edita: si trae un cobro, es una
      // corrección.
      const res = cobro
        ? await modificarCobro(pedido.id, cobro.id, datos)
        : await registrarCobro(pedido.id, datos)

      setModalCobro(null)
      onPedidoActualizado(res.data, cobro ? '' : 'Cobro registrado')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function quitarCobro(cobro) {
    // Sin aviso flotante: la fila desaparece de la lista y el saldo se
    // mueve solo.
    setError('')

    try {
      const res = await borrarCobro(pedido.id, cobro.id)
      onPedidoActualizado(res.data, '')
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <>
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
            maxWidth: 900,
            maxHeight: '88vh',
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
              Cobros del pedido #{pedido.id}
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
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
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
            {/* Con el modal del cobro abierto, el error se ve allá. */}
            {error && !modalCobro && (
              <p role="alert" style={estiloCartelError}>
                {error}
              </p>
            )}

            <PestanaCobros
              pedido={pedido}
              onRegistrar={() => abrirCobro('nuevo')}
              onEditar={(cobro) => abrirCobro(cobro)}
              onQuitar={quitarCobro}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '16px 24px',
              flexShrink: 0,
              borderTop: '1px solid #EBE0E2',
            }}
          >
            <button
              onClick={onCerrar}
              style={{
                padding: '10px 20px',
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
          </div>
        </div>
      </div>

      {/* Hermano del fondo y no adentro de la caja: ModalCobro trae su
          propio fondo, y con zIndex 110 queda encima de este. */}
      {modalCobro && (
        <ModalCobro
          // 'nuevo' es el alta; cualquier otra cosa es el cobro que se
          // está corrigiendo.
          cobro={modalCobro === 'nuevo' ? null : modalCobro}
          saldo={pedido.saldo}
          hayCobros={pedido.cobros.length > 0}
          error={error}
          enviando={enviando}
          onCerrar={cerrarCobro}
          onGuardar={guardarCobro}
        />
      )}
    </>
  )
}
