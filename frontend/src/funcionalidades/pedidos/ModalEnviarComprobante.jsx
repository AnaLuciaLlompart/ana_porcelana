import { useState } from 'react'
import { enviarComprobanteDeCobro, urlComprobanteDeCobro } from './api'
import { ICONO_COMPROBANTE, correoDelComprobante } from './presentacion'

// Enviar el comprobante de un cobro por correo, con vista previa (CU60;
// corrección del tutor): el destinatario, el asunto y el mensaje se revisan
// y se editan antes de enviar, y el PDF adjunto se puede abrir. Se vale
// solo, como ModalEstadoDelPedido: llama él a la API y le entrega el texto
// de la respuesta a quien lo abrió (onEnviado). Hoy lo abre solo ModalCobros:
// el ⋯ del listado lo tuvo y la usuaria lo sacó. Capa 110, para quedar sobre
// ModalCobros.
//
// Para viene completo con el correo del cliente si lo tiene cargado; si no,
// se escribe acá y no se guarda en el cliente (se carga desde Clientes).

// El backend contesta de dos formas: las reglas mandan {'detail': '...'} y
// los errores de campo {'para': ['Introduzca una dirección...']}.
function mensajeDeError(err) {
  const datos = err.response?.data
  if (!datos) return 'No se pudo enviar el correo.'
  if (datos.detail) return datos.detail

  const primerCampo = Object.values(datos)[0]
  if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0]

  return 'No se pudo enviar el correo.'
}

const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  letterSpacing: '.06em',
  marginBottom: 7,
}

const estiloCampo = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #EBE0E2',
  background: 'white',
  fontSize: 15,
  color: '#3D3238',
  borderRadius: 5,
  outline: 'none',
  fontFamily: 'inherit',
}

export default function ModalEnviarComprobante({ pedido, cobro, onCerrar, onEnviado }) {
  // Los tres campos arrancan con el correo del cliente y los textos
  // propuestos; de ahí en más son de la usuaria.
  const [campos, setCampos] = useState(() => ({
    para: pedido.cliente_email || '',
    ...correoDelComprobante(pedido, cobro),
  }))
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const archivo = `comprobante-pedido-${pedido.id}-cobro-${cobro.id}.pdf`

  function cambiar(campo, valor) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }))
  }

  function verPdf() {
    window.open(urlComprobanteDeCobro(pedido.id, cobro.id), '_blank', 'noopener,noreferrer')
  }

  async function enviar() {
    setError('')
    const para = campos.para.trim()
    if (!/^\S+@\S+\.\S+$/.test(para)) {
      setError('Ingresá un correo válido.')
      return
    }
    if (!campos.asunto.trim()) {
      setError('Ingresá el asunto.')
      return
    }
    if (!campos.mensaje.trim()) {
      setError('Escribí el mensaje.')
      return
    }

    setEnviando(true)
    try {
      const res = await enviarComprobanteDeCobro(pedido.id, cobro.id, {
        para,
        asunto: campos.asunto.trim(),
        mensaje: campos.mensaje,
      })
      onEnviado(res.data.detail)
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

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
        zIndex: 110,
      }}
    >
      <div
        className="modal-caja"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 560,
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
            Enviar comprobante por correo
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
          <div>
            <label htmlFor="correo-para" style={estiloEtiqueta}>PARA</label>
            <input
              id="correo-para"
              type="email"
              value={campos.para}
              onChange={(e) => cambiar('para', e.target.value)}
              placeholder="El correo del cliente"
              autoComplete="off"
              style={estiloCampo}
            />
          </div>

          <div>
            <label htmlFor="correo-asunto" style={estiloEtiqueta}>ASUNTO</label>
            <input
              id="correo-asunto"
              type="text"
              value={campos.asunto}
              onChange={(e) => cambiar('asunto', e.target.value)}
              maxLength={150}
              style={estiloCampo}
            />
          </div>

          <div>
            <label htmlFor="correo-mensaje" style={estiloEtiqueta}>MENSAJE</label>
            <textarea
              id="correo-mensaje"
              value={campos.mensaje}
              onChange={(e) => cambiar('mensaje', e.target.value)}
              rows={9}
              maxLength={2000}
              style={{ ...estiloCampo, lineHeight: 1.5, resize: 'vertical' }}
            />
          </div>

          {/* El PDF que va adjunto, con un botón para verlo antes de enviar. */}
          <div>
            <span style={estiloEtiqueta}>ADJUNTO</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 13px',
                border: '1px solid #EBE0E2',
                borderRadius: 5,
                background: '#FAF7F7',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C5A66" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_COMPROBANTE} />
              </svg>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#3D3238', overflowWrap: 'anywhere' }}>
                {archivo}
              </span>
              <button
                type="button"
                onClick={verPdf}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  border: '1px solid #EBE0E2',
                  background: 'white',
                  color: '#8C5A66',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Ver PDF
              </button>
            </div>
          </div>

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
                textWrap: 'pretty',
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
            Cancelar
          </button>

          <button
            onClick={enviar}
            disabled={enviando}
            style={{
              padding: '10px 20px',
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
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
