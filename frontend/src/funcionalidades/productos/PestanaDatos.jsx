import { COLOR_DIFICULTAD } from './presentacion'
import { ANCHO_MAXIMO } from '../../constantes'


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


// enRecorrido es true en el alta por pasos: ahí la pestaña no dibuja su pie,
// porque los botones los pone PieDelRecorrido. Por defecto false, que es la
// ficha, con Descartar y Guardar apagados mientras no haya cambios.
export default function PestanaDatos({
  borrador,
  onCambiar,
  enRecorrido = false,
  hayCambios,
  onGuardar,
  onCancelar,
  guardando,
  error,
}) {
  return (
    <div
      className="ancho-pantalla"
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: 24,
        maxWidth: ANCHO_MAXIMO,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Nombre, precio y dificultad en una fila, con la misma grilla que la
          ficha del pedido: entran de a tres cuando hay lugar y bajan solas a
          dos y a una cuando no. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
          alignItems: 'end',
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

        <div>
          <span style={estiloEtiqueta}>Dificultad de elaboración *</span>
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

      {/* El tilde es un campo más del formulario: espera a Guardar y viaja
          con el resto, en el POST del alta y en el PUT de la ficha.
          Tildarlo y guardar es CU24 (quitar del catálogo); destildarlo y
          guardar, CU23 (publicar). */}
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
          checked={borrador.es_personalizado}
          onChange={() => onCambiar({ es_personalizado: !borrador.es_personalizado })}
          style={{ accentColor: '#8C5A66', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
        />
        <span>
          <span style={{ ...estiloEtiqueta, marginBottom: 0 }}>
            Es un pedido personalizado
          </span>
          <span style={{ display: 'block', fontSize: 13, color: '#857078', marginTop: 2 }}>
            Los personalizados no salen en el catálogo público hasta que los destildes.
          </span>
        </span>
      </label>

      {/* Descripción y paso a paso, de a dos cuando hay lugar, como la fila
          de arriba. En pantalla chica campos-dos-columnas los apila siempre:
          ahí dos columnas de 300px no entran. */}
      <div
        className="campos-dos-columnas"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}
      >
        {/* Cada campo es una subgrilla de dos filas, etiqueta y caja, que usa
            las filas de la grilla de afuera: la de las etiquetas mide lo que
            la más alta, así las dos cajas arrancan a la misma altura. */}
        <div style={{ display: 'grid', gridRow: 'span 2', gridTemplateRows: 'subgrid', rowGap: 0 }}>
          <label style={{ ...estiloEtiqueta, alignSelf: 'end' }}>Descripción para el catálogo (opcional)</label>
          <div>
            <textarea
              value={borrador.descripcion}
              onChange={(e) => onCambiar({ descripcion: e.target.value })}
              maxLength={500}
              rows={6}
              placeholder="Cómo se ve la pieza, de qué tamaño es, en qué colores…"
              style={{ ...estiloCampo, lineHeight: 1.55, resize: 'vertical' }}
            />
            <div style={{ marginTop: 5, fontSize: 12, color: '#B08791', textAlign: 'right' }}>
              {borrador.descripcion.length} / 500
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridRow: 'span 2', gridTemplateRows: 'subgrid', rowGap: 0 }}>
          <label style={{ ...estiloEtiqueta, alignSelf: 'end' }}>Paso a paso de elaboración (opcional)</label>
          <div>
            <textarea
              value={borrador.paso_a_paso}
              onChange={(e) => onCambiar({ paso_a_paso: e.target.value })}
              rows={6}
              placeholder="Modelado, secado, pintura, barniz..."
              style={{ ...estiloCampo, lineHeight: 1.55, resize: 'vertical' }}
            />
          </div>
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
          }}
        >
          {error}
        </p>
      )}

      {!enRecorrido && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          paddingTop: 4,
        }}
      >
        {/* Sin cambios los dos se apagan, con el motivo en el title, como
            todo botón apagado por una regla. */}
        <button
          onClick={onCancelar}
          disabled={!hayCambios}
          title={hayCambios ? undefined : 'No hay cambios que descartar'}
          style={{
            padding: '10px 20px',
            border: '1px solid #EBE0E2',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 6,
            cursor: hayCambios ? 'pointer' : 'default',
            opacity: hayCambios ? undefined : 0.5,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Descartar
        </button>

        <button
          onClick={onGuardar}
          disabled={!hayCambios || guardando}
          title={hayCambios ? undefined : 'No hay cambios que guardar'}
          style={{
            padding: '10px 20px',
            border: 0,
            background: '#8C5A66',
            color: 'white',
            borderRadius: 6,
            cursor: hayCambios && !guardando ? 'pointer' : 'default',
            opacity: guardando ? 0.7 : hayCambios ? undefined : 0.5,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      )}
    </div>
  )
}
