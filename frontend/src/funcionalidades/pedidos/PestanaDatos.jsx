import { ICONO_BORRAR } from './presentacion'


const ENVIOS = [
  { valor: 'MIO', label: 'A cargo mío' },
  { valor: 'CLIENTE', label: 'A cargo del cliente' },
]


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
}

// Los dos campos de fecha llevan un padding un poco menor que el resto,
// porque el selector de fecha del navegador ya trae su propio icono adentro.
const estiloFecha = { ...estiloCampo, padding: '9px 13px' }


// Encabezado de campo con la etiqueta a la izquierda y una aclaración chica
// a la derecha. Lo usan los campos que necesitan explicar cuándo se
// completan, como las dos fechas de entrega.
function EtiquetaConNota({ texto, nota }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 7,
      }}
    >
      <span style={{ ...estiloEtiqueta, display: 'inline', marginBottom: 0 }}>{texto}</span>
      <span style={{ fontSize: 12, color: '#B08791' }}>{nota}</span>
    </label>
  )
}


export default function PestanaDatos({
  borrador,
  onCambiar,
  esAlta,
  clientes,
  onGuardar,
  onCancelar,
  onEliminar,
  guardando,
  error,
}) {
  // Lo único que cambia con el envío es esta nota. El campo del costo se
  // carga igual con las dos opciones: cuando lo paga el cliente el importe
  // se sigue anotando, y el resumen lo muestra aparte sin sumarlo.
  const notaCosto =
    borrador.envio_a_cargo === 'MIO'
      ? 'Se suma al total del pedido'
      : 'Lo paga el cliente: no suma al total'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
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
            DATOS DEL PEDIDO
          </h2>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 18,
            }}
          >
            <div>
              <label htmlFor="cliente" style={estiloEtiqueta}>
                CLIENTE *
              </label>
              <select
                id="cliente"
                value={borrador.cliente}
                onChange={(e) => onCambiar({ cliente: e.target.value })}
                style={estiloCampo}
              >
                <option value="">Elegí un cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    @{c.instagram} · {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fecha" style={estiloEtiqueta}>
                FECHA DEL PEDIDO *
              </label>
              <input
                id="fecha"
                type="date"
                value={borrador.fecha_pedido}
                onChange={(e) => onCambiar({ fecha_pedido: e.target.value })}
                style={estiloFecha}
              />
            </div>

            <div>
              <EtiquetaConNota texto="ENTREGA ESTIMADA" nota="Puede cambiar" />
              <input
                type="date"
                value={borrador.fecha_entrega_estimada}
                onChange={(e) => onCambiar({ fecha_entrega_estimada: e.target.value })}
                style={estiloFecha}
              />
            </div>

            <div>
              <EtiquetaConNota texto="ENTREGA REAL" nota="Se completa al entregar" />
              <input
                type="date"
                value={borrador.fecha_entrega_real}
                onChange={(e) => onCambiar({ fecha_entrega_real: e.target.value })}
                style={estiloFecha}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 18,
            }}
          >
            <div>
              <span style={estiloEtiqueta}>ENVÍO</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {ENVIOS.map((e) => {
                  const activo = borrador.envio_a_cargo === e.valor

                  return (
                    <button
                      key={e.valor}
                      onClick={() => onCambiar({ envio_a_cargo: e.valor })}
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
                      {e.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <EtiquetaConNota texto="COSTO DE ENTREGA" nota={notaCosto} />
              <input
                value={borrador.costo_entrega}
                // Se limpia todo lo que no sea dígito, como el precio en la
                // ficha de Producto: los importes se cargan en pesos
                // enteros.
                onChange={(e) => onCambiar({ costo_entrega: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="$"
                style={estiloCampo}
              />
            </div>
          </div>

          <div>
            <label htmlFor="direccion" style={estiloEtiqueta}>
              DIRECCIÓN DE ENTREGA
            </label>
            <input
              id="direccion"
              value={borrador.direccion_entrega}
              onChange={(e) => onCambiar({ direccion_entrega: e.target.value })}
              maxLength={100}
              placeholder="Calle y número, localidad, referencias..."
              style={estiloCampo}
            />
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
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              paddingTop: 2,
            }}
          >
            <button
              onClick={onCancelar}
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
              onClick={onGuardar}
              disabled={guardando}
              style={{
                padding: '10px 20px',
                border: 0,
                background: '#8C5A66',
                color: 'white',
                borderRadius: 6,
                cursor: guardando ? 'default' : 'pointer',
                opacity: guardando ? 0.7 : 1,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {esAlta
                ? (guardando ? 'Creando…' : 'Crear pedido')
                : (guardando ? 'Guardando…' : 'Guardar')}
            </button>
          </div>
        </div>
      </div>

      {/* Eliminar va fuera de la tarjeta, como en el diseño: no es uno más
          de los campos del formulario. En un alta no hay nada que eliminar. */}
      {!esAlta && (
        <div>
          <button
            onClick={onEliminar}
            className="btn-eliminar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#C0442F',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_BORRAR} />
            </svg>
            Eliminar pedido
          </button>
        </div>
      )}
    </div>
  )
}
