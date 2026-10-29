import { formatearPrecio } from './presentacion'


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
}


// El gasto en solo lectura (CU53 y CU57). La fila del listado ya trae todo,
// también los materiales, así que no pide nada al servidor. Los mismos
// campos de la ficha en readOnly disabled, con "Sin cargar" de placeholder,
// como en el Ver de Clientes; y si es de materiales, su tabla sin botones.
export default function ModalVerGasto({ gasto, onCerrar, onEditar }) {
  const esDeMateriales = gasto.tipo === 'MATERIALES'

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
            Gasto #{gasto.id}
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
          <div className="campos-dos-columnas" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <span style={estiloEtiqueta}>FECHA</span>
              <input type="date" value={gasto.fecha} readOnly disabled style={estiloCampo} />
            </div>

            <div>
              <span style={estiloEtiqueta}>TIPO</span>
              <input value={gasto.tipo_display} readOnly disabled style={estiloCampo} />
            </div>
          </div>

          <div>
            <span style={estiloEtiqueta}>DESCRIPCIÓN</span>
            <textarea
              value={gasto.descripcion}
              readOnly
              disabled
              rows={2}
              placeholder="Sin cargar"
              style={{ ...estiloCampo, resize: 'none' }}
            />
          </div>

          <div>
            <span style={estiloEtiqueta}>MONTO</span>
            <input value={formatearPrecio(gasto.monto)} readOnly disabled style={estiloCampo} />
          </div>

          {esDeMateriales && (
            <div>
              <span style={estiloEtiqueta}>MATERIALES DEL GASTO</span>

              {gasto.materiales.length === 0 ? (
                <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
                  Sin materiales cargados: el gasto está en $0.
                </p>
              ) : (
                <div style={{ border: '1px solid #EBE0E2', borderRadius: 6, overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 420, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F0E2E4' }}>
                        <th style={{ ...estiloTh, width: '40%', textAlign: 'left', paddingLeft: 12 }}>MATERIAL</th>
                        <th style={{ ...estiloTh, width: '14%', textAlign: 'center' }}>CANT.</th>
                        <th style={{ ...estiloTh, width: '23%', textAlign: 'right' }}>P. UNITARIO</th>
                        <th style={{ ...estiloTh, width: '23%', textAlign: 'right', paddingRight: 12 }}>SUBTOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gasto.materiales.map((fila) => (
                        <tr key={fila.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                          <td style={{ ...estiloTd, paddingLeft: 12 }}>{fila.material_nombre}</td>
                          <td style={{ ...estiloTd, textAlign: 'center' }}>{fila.cantidad}</td>
                          <td style={{ ...estiloTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatearPrecio(fila.precio_unitario)}
                          </td>
                          <td style={{ ...estiloTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, paddingRight: 12 }}>
                            {formatearPrecio(fila.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
