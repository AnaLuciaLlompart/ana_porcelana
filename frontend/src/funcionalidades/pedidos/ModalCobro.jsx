import { useState } from 'react'
import { MEDIOS, TIPOS_COBRO, formatearPrecio, hoy } from './presentacion'


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.06em',
}

const estiloCampo = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #EBE0E2',
  fontSize: 16,
  color: '#3D3238',
  background: 'white',
  borderRadius: 5,
  outline: 'none',
  fontFamily: 'inherit',
}


// Los botones de TIPO y de MEDIO: de cada grupo se elige uno solo.
function Segmentado({ opciones, valor, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {opciones.map((op) => {
        const activo = valor === op.valor

        return (
          <button
            key={op.valor}
            onClick={() => onElegir(op.valor)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
              background: activo ? '#8C5A66' : 'white',
              color: activo ? 'white' : '#857078',
            }}
          >
            {op.label}
          </button>
        )
      })}
    </div>
  )
}


// El mismo modal registra y edita, según llegue o no un cobro. Es el
// patrón de ModalMaterial y ModalCliente: "si llega uno, está en modo
// edición".
//
// Acá encaja mejor que dos archivos separados porque no cambia ningún
// campo entre un caso y el otro: los cuatro son los mismos y lo único
// distinto son los valores iniciales, el título y el botón. En los
// productos del pedido hicimos dos archivos porque ahí el producto pasa
// de ser un desplegable a un texto fijo.
export default function ModalCobro({ cobro, saldo, total, hayCobros, onCerrar, onGuardar }) {
  const editando = Boolean(cobro)

  // Los dos llegan como texto y se comparan contra cero, así que se
  // convierten una sola vez acá.
  const pendiente = Number(saldo)
  const totalDelPedido = Number(total)

  // Con qué arranca el formulario. Al editar, con lo que tiene el cobro.
  // Al registrar, con lo que propone el diseño: la primera es una seña y
  // las que siguen son el pago restante, que ya viene con el saldo
  // cargado para no tener que escribirlo.
  const [tipo, setTipo] = useState(() => {
    if (editando) return cobro.tipo
    return hayCobros ? 'PAGO_RESTANTE' : 'SENA'
  })

  const [monto, setMonto] = useState(() => {
    if (editando) return String(Math.round(Number(cobro.monto)))
    return hayCobros && pendiente > 0 ? String(Math.round(pendiente)) : ''
  })

  const [fecha, setFecha] = useState(() => (editando ? cobro.fecha : hoy()))
  const [medio, setMedio] = useState(() => (editando ? cobro.medio : 'TRANSFERENCIA'))
  const [tocado, setTocado] = useState(false)

  // Cuánto se puede cobrar sin pasarse del total. El saldo YA es lo que
  // falta cobrar; al editar hay que devolverle lo que aportaba este
  // cobro, porque su monto viejo está sumado adentro.
  const disponible = editando ? pendiente + Number(cobro.monto) : pendiente

  const montoInvalido = !(Number(monto) > 0)

  // No se puede cobrar más que el total: el saldo a favor no es un
  // estado válido. El backend lo rechaza igual; acá se avisa antes para
  // no hacer un viaje al servidor que ya se sabe que falla.
  const montoExcedido = !montoInvalido && Number(monto) > disponible

  // Y una seña no puede dejar el pedido saldado: es un adelanto, así que
  // siempre queda algo por cobrar. El que termina de pagar es el pago
  // restante.
  const senaQueSalda =
    tipo === 'SENA' && !montoInvalido && !montoExcedido && Number(monto) === disponible

  // Elegir el tipo completa el monto solo, porque dos de los tres ya
  // dicen cuánto es:
  //
  // - PAGO COMPLETO es pagar el pedido entero, así que carga el TOTAL.
  // - PAGO RESTANTE es pagar lo que falta, así que carga el SALDO.
  // - SEÑA es un adelanto de cuánto quiera el cliente, así que no se
  //   completa: ese número solo lo sabe la emprendedora.
  //
  // Al editar no se toca nada solo: ahí los valores son justamente los
  // que se están corrigiendo, y pisarlos sería trabajar en contra.
  function elegirTipo(nuevo) {
    setTipo(nuevo)

    if (editando) return

    if (nuevo === 'PAGO_COMPLETO' && totalDelPedido > 0) {
      setMonto(String(Math.round(totalDelPedido)))
      return
    }

    if (nuevo === 'PAGO_RESTANTE' && pendiente > 0) {
      setMonto(String(Math.round(pendiente)))
    }
  }

  function guardar() {
    if (montoInvalido || montoExcedido || senaQueSalda) {
      setTocado(true)
      return
    }

    onGuardar(cobro, { tipo, monto, fecha, medio })
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
            {editando ? 'Editar cobro' : 'Registrar cobro'}
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
          <div>
            <span style={estiloEtiqueta}>TIPO</span>
            <Segmentado opciones={TIPOS_COBRO} valor={tipo} onElegir={elegirTipo} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label
                htmlFor="monto"
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}
              >
                <span style={{ ...estiloEtiqueta, display: 'inline', marginBottom: 0 }}>
                  MONTO *
                </span>
                <span style={{ fontSize: 12, color: '#B08791' }}>
                  {pendiente > 0 ? `Saldo: ${formatearPrecio(pendiente)}` : 'Sin saldo pendiente'}
                </span>
              </label>

              <input
                id="monto"
                value={monto}
                // Se limpia todo lo que no sea dígito, como en el resto
                // del sistema: los importes se cargan en pesos enteros.
                onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="$"
                style={{
                  ...estiloCampo,
                  border: `1px solid ${
                    tocado && (montoInvalido || montoExcedido || senaQueSalda)
                      ? '#C0442F'
                      : '#EBE0E2'
                  }`,
                }}
              />

              {tocado && montoInvalido && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                  Ingresá un monto mayor a cero.
                </p>
              )}

              {tocado && montoExcedido && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                  {disponible > 0
                    ? `No podés cobrar más de ${formatearPrecio(disponible)}, que es lo que falta.`
                    : 'Este pedido ya está cobrado por completo.'}
                </p>
              )}

              {tocado && senaQueSalda && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                  Con este monto el pedido queda saldado, así que no puede ser
                  una seña: registralo como «Pago restante».
                </p>
              )}
            </div>

            <div>
              <label htmlFor="fecha" style={estiloEtiqueta}>
                FECHA *
              </label>
              <input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{ ...estiloCampo, padding: '9px 13px' }}
              />
            </div>
          </div>

          <div>
            <span style={estiloEtiqueta}>MEDIO</span>
            <Segmentado opciones={MEDIOS} valor={medio} onElegir={setMedio} />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
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
            {editando ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
