import { COLOR_DIFICULTAD } from './presentacion'


const DIFICULTADES = [
  { valor: 'BAJA', label: 'Baja' },
  { valor: 'MEDIA', label: 'Media' },
  { valor: 'ALTA', label: 'Alta' },
]


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.03em',
}

const estiloCampo = {
  width: '100%',
  padding: '10px 16px',
  border: '1px solid #EBE0E2',
  fontSize: 15,
  color: '#3D3238',
  background: '#FAF7F7',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
}


// Encabezado de campo con la etiqueta a la izquierda y una aclaración chica
// a la derecha. Es lo que distingue la descripción del paso a paso: uno lo
// lee el cliente, el otro no sale nunca del módulo de gestión.
function EtiquetaConNota({ texto, nota }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 7,
      }}
    >
      <label style={{ ...estiloEtiqueta, display: 'inline', marginBottom: 0 }}>{texto}</label>
      <span style={{ fontSize: 12, color: '#B08791' }}>{nota}</span>
    </div>
  )
}


export default function PestanaDatos({
  borrador,
  onCambiar,
  esPersonalizado,
  onTogglePersonalizado,
  onGuardar,
  onCancelar,
  guardando,
  error,
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: 24,
        maxWidth: 720,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div>
        <label htmlFor="nombre" style={estiloEtiqueta}>
          Nombre del producto *
        </label>
        <input
          id="nombre"
          value={borrador.nombre}
          onChange={(e) => onCambiar({ nombre: e.target.value })}
          maxLength={80}
          style={estiloCampo}
        />
      </div>

      <div>
        <EtiquetaConNota
          texto="Descripción para el catálogo (opcional)"
          nota="La lee el cliente"
        />
        <textarea
          value={borrador.descripcion}
          onChange={(e) => onCambiar({ descripcion: e.target.value })}
          maxLength={500}
          rows={3}
          placeholder="Cómo se ve la pieza, de qué tamaño es, en qué colores…"
          style={{ ...estiloCampo, lineHeight: 1.55, resize: 'vertical' }}
        />
        <div style={{ marginTop: 5, fontSize: 12, color: '#B08791', textAlign: 'right' }}>
          {borrador.descripcion.length} / 500
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="precio" style={estiloEtiqueta}>
            Precio actual *
          </label>
          <input
            id="precio"
            value={borrador.precio}
            // Se limpia todo lo que no sea dígito, como el prototipo: los
            // precios se cargan en pesos enteros.
            onChange={(e) => onCambiar({ precio: e.target.value.replace(/[^0-9]/g, '') })}
            style={estiloCampo}
          />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <span style={estiloEtiqueta}>Dificultad *</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {DIFICULTADES.map((d) => {
              const activo = borrador.dificultad === d.valor
              const color = COLOR_DIFICULTAD[d.valor]

              return (
                <button
                  key={d.valor}
                  onClick={() => onCambiar({ dificultad: d.valor })}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    border: activo ? `2px solid ${color.color}` : '1px solid #EBE0E2',
                    background: activo ? color.fondo : 'white',
                    color: activo ? color.color : '#857078',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Este tilde NO espera al botón de guardar: es el único control del
          formulario que actúa en el momento. Tildarlo es CU24 (quitar del
          catálogo) y destildarlo CU23 (publicar), que son casos de uso
          propios con sus endpoints, no un campo del producto. */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: 'pointer',
          padding: '14px 16px',
          background: '#FAF7F7',
          border: '1px solid #EBE0E2',
          borderRadius: 6,
        }}
      >
        <input
          type="checkbox"
          checked={esPersonalizado}
          onChange={onTogglePersonalizado}
          style={{ accentColor: '#8C5A66', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
        />
        <span>
          <span
            style={{
              display: 'block',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: '#3D3238',
            }}
          >
            Es un pedido personalizado
          </span>
          <span style={{ display: 'block', fontSize: 13, color: '#857078', marginTop: 2 }}>
            Los personalizados no salen en el catálogo público hasta que los destildes.
          </span>
        </span>
      </label>

      <div>
        <EtiquetaConNota
          texto="Paso a paso de elaboración (opcional)"
          nota="Solo uso interno"
        />
        <textarea
          value={borrador.paso_a_paso}
          onChange={(e) => onCambiar({ paso_a_paso: e.target.value })}
          rows={6}
          placeholder="Modelado, secado, pintura, barniz..."
          style={{ ...estiloCampo, lineHeight: 1.55, resize: 'vertical' }}
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
          paddingTop: 4,
        }}
      >
        <button
          onClick={onCancelar}
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
          CANCELAR
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
          {guardando ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
        </button>
      </div>
    </div>
  )
}
