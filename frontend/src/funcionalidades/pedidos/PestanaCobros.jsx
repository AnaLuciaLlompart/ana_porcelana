import BotonAccion from '../../componentes/BotonAccion'
import {
  ICONO_CRUZ,
  ICONO_EDITAR,
  ICONO_MAS,
  chipSaldo,
  fmtFechaLarga,
  formatearPrecio,
} from './presentacion'


// Una fila del resumen. La de "Envío (lo paga el cliente)" va apagada,
// porque es plata que el pedido no cobra.
function FilaResumen({ etiqueta, valor, apagada, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: apagada ? '#B08791' : '#857078' }}>{etiqueta}</span>
      <span
        style={{
          color: color || (apagada ? '#B08791' : '#3D3238'),
          fontFamily: apagada ? 'inherit' : "'Quicksand', sans-serif",
          fontWeight: apagada ? 400 : 600,
        }}
      >
        {valor}
      </span>
    </div>
  )
}


export default function PestanaCobros({ pedido, onRegistrar, onEditar, onQuitar }) {
  const chip = chipSaldo(pedido.saldo)

  // El costo que el cliente paga por su cuenta: se anota igual, pero no
  // entra en el total del pedido.
  const costoDelCliente =
    pedido.envio_a_cargo === 'CLIENTE' && Number(pedido.costo_entrega) > 0

  const costoPropio = Number(pedido.costo_envio_a_cobrar) > 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: 24,
        alignItems: 'start',
        maxWidth: 1140,
      }}
    >
      <div
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid #EBE0E2',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: '#8C5A66',
                letterSpacing: '.06em',
              }}
            >
              COBROS
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#857078' }}>
              Seña, pago restante o pago completo.
            </p>
          </div>

          <button
            onClick={onRegistrar}
            className="btn-reponer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexShrink: 0,
              padding: '8px 14px',
              border: '1px solid #8C5A66',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" d={ICONO_MAS} />
            </svg>
            Registrar cobro
          </button>
        </div>

        {pedido.cobros.map((cobro) => (
          <div
            key={cobro.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              borderBottom: '1px solid #EBE0E2',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  color: '#3D3238',
                }}
              >
                {cobro.tipo_display}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#857078' }}>
                {fmtFechaLarga(cobro.fecha)} · {cobro.medio_display}
              </p>
            </div>

            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 16,
                color: '#4E8C6A',
              }}
            >
              {formatearPrecio(cobro.monto)}
            </span>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <BotonAccion
                onClick={() => onEditar(cobro)}
                titulo="Editar cobro"
                color="#8C5A66"
                hover="#F0E2E4"
                tamanoIcono={20}
                icono={ICONO_EDITAR}
              />
              <BotonAccion
                onClick={() => onQuitar(cobro)}
                titulo="Quitar cobro"
                color="#C0442F"
                hover="#FAEAE8"
                tamanoIcono={20}
                icono={ICONO_CRUZ}
              />
            </div>
          </div>
        ))}

        {pedido.cobros.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p
              style={{
                margin: '0 0 6px',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 16,
                color: '#3D3238',
              }}
            >
              Sin cobros todavía
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
              Registrá la seña cuando la recibas.
            </p>
          </div>
        )}
      </div>

      {/* El resumen muestra lo GUARDADO, no el borrador de la pestaña de
          datos: los números los calcula el backend, y recalcularlos acá
          sería escribir por segunda vez una regla que ya está resuelta
          del otro lado. Al guardar se actualizan solos. */}
      <div
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h2
          style={{
            margin: '0 0 14px',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#8C5A66',
            letterSpacing: '.06em',
          }}
        >
          RESUMEN
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 15 }}>
          <FilaResumen etiqueta="Productos" valor={formatearPrecio(pedido.subtotal)} />

          {costoPropio && (
            <FilaResumen
              etiqueta="Envío"
              valor={formatearPrecio(pedido.costo_envio_a_cobrar)}
            />
          )}

          {costoDelCliente && (
            <FilaResumen
              etiqueta="Envío (lo paga el cliente)"
              valor={formatearPrecio(pedido.costo_entrega)}
              apagada
            />
          )}

          <div style={{ height: 1, background: '#EBE0E2', margin: '4px 0' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 600 }}>
              Total
            </span>
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                fontSize: 20,
                color: '#8C5A66',
              }}
            >
              {formatearPrecio(pedido.total)}
            </span>
          </div>

          <FilaResumen
            etiqueta="Cobrado"
            valor={formatearPrecio(pedido.cobrado)}
            color="#4E8C6A"
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#857078' }}>Saldo</span>
            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 20,
                padding: '5px 10px',
                border: `1px solid ${chip.borde}`,
                background: chip.fondo,
                color: chip.color,
              }}
            >
              {chip.texto}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
