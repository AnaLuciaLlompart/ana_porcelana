import { TIPOS, formatearPrecio } from './presentacion'
import EncabezadoDeTarjeta from '../../componentes/EncabezadoDeTarjeta'


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


// Encabezado de campo con la etiqueta a la izquierda y una aclaración chica
// a la derecha, como el de la ficha de Pedidos. Acá lo usa el monto, que
// cambia de aclaración según el tipo del gasto.
function EtiquetaConNota({ texto, nota }) {
  return (
    <label style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
      <span style={{ ...estiloEtiqueta, display: 'inline', marginBottom: 0, whiteSpace: 'nowrap' }}>
        {texto}
      </span>
      <span style={{ fontSize: 12, color: '#B08791' }}>{nota}</span>
    </label>
  )
}


// La tarjeta con los cuatro datos del gasto. La usan la ficha y el alta, y
// no tiene pie: en el alta los botones los pone PieDelRecorrido, y en la
// ficha el pie va debajo de los materiales, porque se guardan juntos.
export default function DatosDelGasto({
  borrador,
  onCambiar,
  tipoBloqueado,
  montoCalculado,
  error,
}) {
  const esDeMateriales = borrador.tipo === 'MATERIALES'

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <EncabezadoDeTarjeta titulo="DATOS DEL GASTO" />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 18,
            alignItems: 'end',
          }}
        >
          <div>
            <span style={estiloEtiqueta}>TIPO *</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map((t) => {
                const activo = borrador.tipo === t.valor

                // Un gasto que YA es de materiales no puede cambiar de tipo:
                // el backend lo rechaza con un 400, porque sus materiales y
                // su monto calculado no se pueden convertir en un monto
                // cargado a mano. Los otros dos segmentos se apagan para no
                // ofrecer un cambio que se sabe que va a fallar.
                const apagado = tipoBloqueado && !activo

                return (
                  <button
                    key={t.valor}
                    onClick={() => onCambiar({ tipo: t.valor })}
                    disabled={apagado}
                    title={
                      apagado
                        ? 'Un gasto de materiales no puede cambiar de tipo. Si el tipo está mal, eliminá el gasto y cargalo de nuevo.'
                        : undefined
                    }
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 5,
                      cursor: apagado ? 'default' : 'pointer',
                      opacity: apagado ? 0.5 : undefined,
                      whiteSpace: 'nowrap',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
                      background: activo ? '#8C5A66' : 'white',
                      color: activo ? 'white' : '#857078',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="fecha" style={estiloEtiqueta}>
              FECHA *
            </label>
            <input
              id="fecha"
              type="date"
              value={borrador.fecha}
              onChange={(e) => onCambiar({ fecha: e.target.value })}
              style={{ ...estiloCampo, padding: '9px 13px' }}
            />
          </div>

          {/* El monto tiene dos caras según el tipo. En un gasto de
              materiales no se escribe: lo calcula el backend y acá solo se
              muestra. En los otros dos lo carga ella y es obligatorio. */}
          <div>
            {esDeMateriales ? (
              <>
                <EtiquetaConNota texto="MONTO TOTAL" nota="Suma de los subtotales" />
                <p
                  style={{
                    ...estiloCampo,
                    margin: 0,
                    background: '#F3EEEF',
                    cursor: 'default',
                  }}
                >
                  {formatearPrecio(montoCalculado)}
                </p>
              </>
            ) : (
              <>
                <EtiquetaConNota texto="MONTO TOTAL *" nota="Lo que pagaste" />
                <input
                  value={borrador.monto}
                  // Se limpia todo lo que no sea dígito, como en el resto del
                  // sistema: los importes se cargan en pesos enteros.
                  onChange={(e) => onCambiar({ monto: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="$"
                  style={estiloCampo}
                />
              </>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="descripcion" style={estiloEtiqueta}>
            DESCRIPCIÓN
          </label>
          <textarea
            id="descripcion"
            value={borrador.descripcion}
            onChange={(e) => onCambiar({ descripcion: e.target.value })}
            rows={2}
            maxLength={200}
            style={{ ...estiloCampo, lineHeight: 1.5, resize: 'vertical' }}
          />
        </div>

        {error && (
          <p role="alert" style={estiloCartelError}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
