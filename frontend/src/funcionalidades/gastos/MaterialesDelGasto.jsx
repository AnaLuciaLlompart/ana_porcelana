import BotonAccion from '../../componentes/BotonAccion'
import {
  COLOR_DISPONIBILIDAD,
  ICONO_CRUZ,
  ICONO_EDITAR,
  ICONO_MAS,
  ICONO_SUBIR,
  formatearPrecio,
} from './presentacion'


const estiloTituloTarjeta = {
  margin: 0,
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#8C5A66',
  letterSpacing: '.06em',
}

const estiloTh = {
  padding: '10px 8px',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#8C5A66',
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


// Si el material de esta fila se puede marcar en disponibilidad Alta. Es la
// misma condición que aplica el backend, que ignora a los discontinuados y
// a los que ya están en Alta. El botón la anticipa para no ofrecer un clic
// que no va a cambiar nada.
function sePuedeMarcarEnAlta(fila) {
  return fila.material_estado === 'ACTIVO' && fila.material_disponibilidad !== 'ALTA'
}

function tituloDeAlta(fila) {
  if (fila.material_estado !== 'ACTIVO') return 'Material discontinuado'
  if (fila.material_disponibilidad === 'ALTA') return 'Ya está en Alta'

  // En la ficha marcar no escribe nada todavía: queda en el borrador y se
  // aplica al guardar. Tocar de nuevo lo desmarca.
  return fila.pasar_a_alta
    ? 'No pasar a disponibilidad Alta al guardar'
    : 'Pasar a disponibilidad Alta al guardar'
}


// Una fila de la tabla: un material comprado, con cuántos, a qué precio y
// en qué disponibilidad está hoy.
//
// Todo lo que se muestra del material viene en la fila, porque el backend lo
// manda al lado del id: el nombre, el estado y la disponibilidad con sus
// etiquetas. No hace falta cruzar la lista de materiales.
function FilaMaterial({ fila, onAlta, onEditar, onQuitar }) {
  return (
    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
      <td style={{ padding: '14px 20px' }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.3, color: '#3D3238' }}>
          {fila.material_nombre}
        </p>

        {fila.material_estado === 'DISCONTINUADO' && (
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#B08791' }}>
            {fila.material_estado_display}
          </p>
        )}
      </td>

      <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: 15, color: '#3D3238' }}>
        {fila.cantidad}
      </td>

      <td
        style={{
          padding: '14px 8px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontSize: 15,
          color: '#3D3238',
        }}
      >
        {formatearPrecio(fila.precio_unitario)}
      </td>

      <td
        style={{
          padding: '14px 8px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 600,
          fontSize: 15,
          color: '#3D3238',
        }}
      >
        {formatearPrecio(fila.subtotal)}
      </td>

      <td
        style={{
          padding: '14px 8px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontSize: 15,
          color: fila.pasar_a_alta ? COLOR_DISPONIBILIDAD.ALTA : COLOR_DISPONIBILIDAD[fila.material_disponibilidad],
        }}
      >
        {/* Marcada para pasar a Alta, dice de dónde a dónde va a ir. */}
        {fila.pasar_a_alta
          ? `${fila.material_disponibilidad_display} → Alta`
          : fila.material_disponibilidad_display}
      </td>

      <td style={{ padding: '11px 8px' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {onAlta && (
            <BotonAccion
              onClick={() => onAlta(fila)}
              titulo={tituloDeAlta(fila)}
              color="#4E8C6A"
              hover="#E8F5EF"
              tamanoIcono={20}
              icono={ICONO_SUBIR}
              deshabilitado={!sePuedeMarcarEnAlta(fila)}
            />
          )}

          <BotonAccion
            onClick={() => onEditar(fila)}
            titulo="Editar material del gasto"
            color="#8C5A66"
            hover="#F0E2E4"
            tamanoIcono={20}
            icono={ICONO_EDITAR}
          />

          <BotonAccion
            onClick={() => onQuitar(fila)}
            titulo="Quitar material"
            color="#C0442F"
            hover="#FAEAE8"
            tamanoIcono={20}
            icono={ICONO_CRUZ}
          />
        </div>
      </td>
    </tr>
  )
}


// La tarjeta con los materiales del gasto. En la ficha aparece cuando el
// borrador es de materiales, y en el alta es el paso Materiales; en los dos
// las filas viven en memoria hasta guardar o crear.
//
// onAlta y onAltaTodos son opcionales: sin ellos no se dibujan "Marcar todos
// en disponibilidad Alta" ni el botón Alta de cada fila. Los pasa solo la
// ficha, donde marcar deja la fila con pasar_a_alta y se aplica al guardar.
export default function MaterialesDelGasto({
  gasto,
  quedanPorAgregar,
  error,
  onAgregar,
  onEditar,
  onQuitar,
  onAlta,
  onAltaTodos,
}) {
  const filas = gasto.materiales

  const hayPorMarcar = filas.some((fila) => sePuedeMarcarEnAlta(fila) && !fila.pasar_a_alta)

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
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
          flexWrap: 'wrap',
        }}
      >
        <h2 style={estiloTituloTarjeta}>MATERIALES DEL GASTO</h2>

        <div className="acciones-materiales" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onAltaTodos && (
            <button
              onClick={onAltaTodos}
              disabled={!hayPorMarcar}
              title={
                hayPorMarcar
                  ? 'Pasar todos los materiales de este gasto a disponibilidad Alta al guardar'
                  : 'No queda ningún material por marcar'
              }
              className="btn-reponer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                whiteSpace: 'nowrap',
                padding: '8px 14px',
                border: '1px solid #EBE0E2',
                background: 'white',
                color: '#8C5A66',
                borderRadius: 5,
                cursor: hayPorMarcar ? 'pointer' : 'default',
                opacity: hayPorMarcar ? undefined : 0.5,
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_SUBIR} />
              </svg>
              Marcar todos en disponibilidad Alta
            </button>
          )}

          <button
            onClick={onAgregar}
            disabled={!quedanPorAgregar}
            title={
              quedanPorAgregar
                ? 'Agregar material al gasto'
                : 'Ya cargaste todos los materiales activos'
            }
            className="btn-reponer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              padding: '8px 14px',
              border: '1px solid #8C5A66',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 5,
              cursor: quedanPorAgregar ? 'pointer' : 'default',
              opacity: quedanPorAgregar ? undefined : 0.5,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" d={ICONO_MAS} />
            </svg>
            Agregar material
          </button>
        </div>
      </div>

      {/* El error de una operación sobre los materiales va acá, pegado a la
          tabla que la provocó, y no en el formulario de arriba. Es el mismo
          criterio que el error de los productos en la ficha de Pedidos. */}
      {error && (
        <div style={{ padding: '14px 20px 0' }}>
          <p role="alert" style={estiloCartelError}>
            {error}
          </p>
        </div>
      )}

      {filas.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 780,
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ background: '#F0E2E4' }}>
                  <th style={{ ...estiloTh, width: '24%', padding: '10px 20px', textAlign: 'left' }}>
                    MATERIAL
                  </th>
                  <th style={{ ...estiloTh, width: '10%', textAlign: 'center' }}>CANTIDAD</th>
                  <th style={{ ...estiloTh, width: '16%', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    PRECIO UNITARIO
                  </th>
                  <th style={{ ...estiloTh, width: '12%', textAlign: 'right' }}>SUBTOTAL</th>
                  <th style={{ ...estiloTh, width: '18%', textAlign: 'center' }}>DISPONIBILIDAD</th>
                  <th style={{ ...estiloTh, width: '20%', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {filas.map((fila) => (
                  // La key es el id del MATERIAL DEL GASTO, que es la fila.
                  <FilaMaterial
                    key={fila.id}
                    fila={fila}
                    onAlta={onAlta}
                    onEditar={onEditar}
                    onQuitar={onQuitar}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* El total es el monto del gasto que llega, que en el alta y en la
              ficha es el del borrador (montoEnMemoria): el mismo número que
              muestra MONTO TOTAL en la tarjeta de arriba. No se suma acá. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 24,
              padding: '14px 20px',
              borderTop: '1px solid #EBE0E2',
              background: '#FAF7F7',
            }}
          >
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: '#8C5A66',
              }}
            >
              {formatearPrecio(gasto.monto)}
            </span>
          </div>
        </>
      )}

      {filas.length === 0 && (
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
            Todavía no hay materiales
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            Sin materiales, el gasto queda en $0.
          </p>
        </div>
      )}
    </div>
  )
}
