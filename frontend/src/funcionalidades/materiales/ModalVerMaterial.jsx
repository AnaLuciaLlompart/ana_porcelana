const DISPONIBILIDADES = [
  { valor: 'ALTA', etiqueta: 'Alta', color: '#4E8C6A', fondo: '#E8F5EF' },
  { valor: 'MEDIA', etiqueta: 'Media', color: '#D9A441', fondo: '#FDF3E0' },
  { valor: 'BAJA', etiqueta: 'Baja', color: '#C0442F', fondo: '#FAEAE8' },
]

const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#857078',
  marginBottom: 7,
}

const estiloCampo = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #EBE0E2',
  background: '#F7F3F4',
  fontSize: 15,
  color: '#3D3238',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'default',
}

export default function ModalVerMaterial({ material, onCerrar }) {
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
          maxWidth: 490,
          maxHeight: '90vh',
          borderRadius: 10,
          overflow: 'auto',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
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
            Detalle del material
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

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <span style={estiloEtiqueta}>Nombre del material</span>
            <input value={material.nombre} readOnly disabled style={estiloCampo} />
          </div>

          <div>
            <span style={estiloEtiqueta}>Disponibilidad</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {DISPONIBILIDADES.map((d) => {
                const activo = material.disponibilidad === d.valor
                return (
                  <div
                    key={d.valor}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 6,
                      textAlign: 'center',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      border: activo ? `2px solid ${d.color}` : '1px solid #EBE0E2',
                      background: activo ? d.fondo : '#F7F3F4',
                      color: activo ? d.color : '#C9BEC2',
                    }}
                  >
                    {d.etiqueta}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <span style={estiloEtiqueta}>Estado</span>
            <input value={material.estado_display} readOnly disabled style={estiloCampo} />
          </div>

          <div>
            <span style={estiloEtiqueta}>Descripción</span>
            <textarea
              value={material.descripcion || 'Sin descripción.'}
              readOnly
              disabled
              rows={3}
              style={{ ...estiloCampo, resize: 'none' }}
            />
          </div>

          <div>
            <span style={estiloEtiqueta}>Imagen</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 112,
                border: '2px dashed #EBE0E2',
                background: '#F7F3F4',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {material.url_imagen ? (
                <img
                  src={material.url_imagen}
                  alt={material.nombre}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 14, color: '#B08791' }}>
                  Sin imagen
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '16px 24px',
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
  )
}