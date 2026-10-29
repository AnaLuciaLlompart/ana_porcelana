import { useEffect, useState } from 'react'
import { obtenerPedido } from './api'
import { COLOR_ESTADO, chipSaldo, fmtFechaLarga, formatearPrecio } from './presentacion'


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
  fontSize: 15,
  color: '#3D3238',
  background: '#FAF7F7',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'default',
}

const estiloTh = {
  padding: '9px 8px',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: '.06em',
  color: '#8C5A66',
}

const estiloTd = {
  padding: '10px 8px',
  fontSize: 15,
  color: '#3D3238',
  verticalAlign: 'top',
}

const estiloVacio = { margin: 0, fontSize: 15, color: '#857078' }


function Campo({ etiqueta, valor }) {
  return (
    <div>
      <span style={estiloEtiqueta}>{etiqueta}</span>
      <input value={valor || ''} readOnly disabled placeholder="Sin cargar" style={estiloCampo} />
    </div>
  )
}


function Chip({ texto, color, fondo, borde }) {
  return (
    <span
      style={{
        whiteSpace: 'nowrap',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        borderRadius: 20,
        padding: '4px 12px',
        border: `1px solid ${borde}`,
        background: fondo,
        color,
      }}
    >
      {texto}
    </span>
  )
}


// Una tabla chica en solo lectura, con la caja que se desliza de costado
// en pantalla chica, como todas las tablas del sistema.
function Tabla({ minimo, children }) {
  return (
    <div style={{ border: '1px solid #EBE0E2', borderRadius: 6, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: minimo, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  )
}


function Contenido({ pedido }) {
  const estado = COLOR_ESTADO[pedido.estado]
  const saldo = chipSaldo(pedido.saldo)
  const esEnvio = pedido.forma_entrega !== 'RETIRO'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip texto={pedido.estado_display} color={estado.color} fondo={estado.fondo} borde={estado.borde} />
        <Chip texto={saldo.texto} color={saldo.color} fondo={saldo.fondo} borde={saldo.borde} />
      </div>

      <div className="campos-dos-columnas" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Campo etiqueta="CLIENTE" valor={`@${pedido.cliente_instagram} · ${pedido.cliente_nombre}`} />
        <Campo etiqueta="FECHA DEL PEDIDO" valor={fmtFechaLarga(pedido.fecha_pedido)} />
        <Campo
          etiqueta="ENTREGA ESTIMADA"
          valor={pedido.fecha_entrega_estimada && fmtFechaLarga(pedido.fecha_entrega_estimada)}
        />
        <Campo
          etiqueta="ENTREGA REAL"
          valor={pedido.fecha_entrega_real && fmtFechaLarga(pedido.fecha_entrega_real)}
        />
        <Campo etiqueta="FORMA DE ENTREGA" valor={pedido.forma_entrega_display} />
        {esEnvio && (
          <Campo
            etiqueta="COSTO DE ENTREGA"
            valor={pedido.costo_entrega !== null && formatearPrecio(pedido.costo_entrega)}
          />
        )}
      </div>

      {esEnvio && <Campo etiqueta="DIRECCIÓN DE ENTREGA" valor={pedido.direccion_entrega} />}

      <div>
        <span style={estiloEtiqueta}>PRODUCTOS DEL PEDIDO</span>

        {pedido.productos.length === 0 ? (
          <p style={estiloVacio}>Sin productos</p>
        ) : (
          <Tabla minimo={560}>
            <thead>
              <tr style={{ background: '#F0E2E4' }}>
                <th style={{ ...estiloTh, width: '34%', textAlign: 'left', paddingLeft: 12 }}>PRODUCTO</th>
                <th style={{ ...estiloTh, width: '10%', textAlign: 'center' }}>CANT.</th>
                <th style={{ ...estiloTh, width: '18%', textAlign: 'right' }}>PRECIO</th>
                <th style={{ ...estiloTh, width: '18%', textAlign: 'right' }}>SUBTOTAL</th>
                <th style={{ ...estiloTh, width: '20%', textAlign: 'left', paddingLeft: 14 }}>ETAPA</th>
              </tr>
            </thead>
            <tbody>
              {pedido.productos.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                  <td style={{ ...estiloTd, paddingLeft: 12 }}>
                    {p.producto_nombre}
                    {p.descripcion && (
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#857078' }}>{p.descripcion}</p>
                    )}
                  </td>
                  <td style={{ ...estiloTd, textAlign: 'center' }}>{p.cantidad}</td>
                  <td style={{ ...estiloTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatearPrecio(p.precio)}</td>
                  <td style={{ ...estiloTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {formatearPrecio(p.subtotal)}
                  </td>
                  <td style={{ ...estiloTd, paddingLeft: 14 }}>{p.estado_display}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <div>
        <span style={estiloEtiqueta}>COBROS</span>

        {pedido.cobros.length === 0 ? (
          <p style={estiloVacio}>Sin cobros</p>
        ) : (
          <Tabla minimo={460}>
            <thead>
              <tr style={{ background: '#F0E2E4' }}>
                <th style={{ ...estiloTh, width: '30%', textAlign: 'left', paddingLeft: 12 }}>FECHA</th>
                <th style={{ ...estiloTh, width: '26%', textAlign: 'left' }}>TIPO</th>
                <th style={{ ...estiloTh, width: '24%', textAlign: 'left' }}>MEDIO</th>
                <th style={{ ...estiloTh, width: '20%', textAlign: 'right', paddingRight: 12 }}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {pedido.cobros.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                  <td style={{ ...estiloTd, paddingLeft: 12 }}>{fmtFechaLarga(c.fecha)}</td>
                  <td style={estiloTd}>{c.tipo_display}</td>
                  <td style={estiloTd}>{c.medio_display}</td>
                  <td style={{ ...estiloTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, paddingRight: 12 }}>
                    {formatearPrecio(c.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, flexWrap: 'wrap', fontSize: 15 }}>
        <span style={{ color: '#857078' }}>
          Total <strong style={{ color: '#8C5A66' }}>{formatearPrecio(pedido.total)}</strong>
        </span>
        <span style={{ color: '#857078' }}>
          Cobrado <strong style={{ color: '#4E8C6A' }}>{formatearPrecio(pedido.cobrado)}</strong>
        </span>
      </div>
    </>
  )
}


// El pedido en solo lectura (CU41): datos, productos y cobros. El listado
// no trae los productos ni los cobros, así que al abrirse pide la ficha,
// con el patrón de tres estados. Editar lleva a la ficha.
export default function ModalVerPedido({ pedido, onCerrar, onEditar }) {
  const [ficha, setFicha] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerPedido(pedido.id)
      .then((res) => setFicha(res.data))
      .catch(() => setError('No se pudo cargar el pedido.'))
      .finally(() => setCargando(false))
  }, [pedido.id])

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
          maxWidth: 760,
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
            Pedido #{pedido.id}
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
            gap: 18,
            overflowY: 'auto',
          }}
        >
          {cargando && <p style={estiloVacio}>Cargando…</p>}
          {error && <p style={{ margin: 0, fontSize: 15, color: '#C0442F' }}>{error}</p>}
          {ficha && <Contenido pedido={ficha} />}
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
