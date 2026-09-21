import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerGasto,
  crearGasto,
  modificarGasto,
  quitarMaterialDelGasto,
  marcarDisponibilidadAlta,
  marcarTodosDisponibilidadAlta,
} from './api'

// Imports que cruzan de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. listarMateriales es para el
// desplegable del modal, y cambiarDisponibilidad para deshacer el "marcar en
// disponibilidad Alta": los dos son operaciones sobre materiales, no sobre
// gastos.
import { cambiarDisponibilidad, listarMateriales } from '../materiales/api'

import BotonAccion from '../../componentes/BotonAccion'
import Toast from '../../componentes/Toast'

import ModalMaterial from './ModalMaterial'
import ModalEliminarGasto from './ModalEliminarGasto'
import {
  COLOR_DISPONIBILIDAD,
  ICONO_BORRAR,
  ICONO_CRUZ,
  ICONO_EDITAR,
  ICONO_FLECHA,
  ICONO_MAS,
  ICONO_SUBIR,
  TIPOS,
  fmtFechaLarga,
  formatearPrecio,
  hoy,
  mensajeDeError,
} from './presentacion'


// Los campos que edita el formulario.
//
// El monto va en pesos enteros, como los demás importes del sistema. En un
// gasto de MATERIALES queda vacío a propósito: ahí el monto no se edita ni
// se manda, lo calcula el backend sumando los materiales del gasto. La
// ficha lo muestra leyéndolo del gasto, no del borrador.
function borradorDe(gasto) {
  return {
    tipo: gasto.tipo,
    fecha: gasto.fecha,
    monto: gasto.tipo === 'MATERIALES' ? '' : String(Math.round(Number(gasto.monto))),
    descripcion: gasto.descripcion,
  }
}


// Con qué arranca el formulario en un alta: el tipo Materiales y la fecha de
// hoy, que es como nace un gasto en el diseño. Es una función y no una
// constante para que hoy() se calcule al abrir el alta, no al cargar la
// aplicación.
function borradorVacio() {
  return {
    tipo: 'MATERIALES',
    fecha: hoy(),
    monto: '',
    descripcion: '',
  }
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

  return 'Marcar en disponibilidad Alta'
}


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


// La tarjeta con los cuatro datos del gasto.
function DatosDelGasto({
  borrador,
  onCambiar,
  esAlta,
  tipoBloqueado,
  montoCalculado,
  mostrarBotones,
  guardando,
  error,
  onGuardar,
  onCancelar,
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
        <h2 style={estiloTituloTarjeta}>DATOS DEL GASTO</h2>
      </div>

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

        {/* En un alta los botones están siempre. En un gasto que ya existe
            aparecen recién cuando hay algo que guardar, como en el diseño:
            una ficha sin cambios no tiene nada que guardar ni que descartar. */}
        {mostrarBotones && (
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
              {esAlta ? 'Cancelar' : 'Descartar'}
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
                ? (guardando ? 'Creando…' : 'Crear gasto')
                : (guardando ? 'Guardando…' : 'Guardar')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
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
          color: COLOR_DISPONIBILIDAD[fila.material_disponibilidad],
        }}
      >
        {fila.material_disponibilidad_display}
      </td>

      <td style={{ padding: '11px 8px' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <BotonAccion
            onClick={() => onAlta(fila)}
            titulo={tituloDeAlta(fila)}
            color="#4E8C6A"
            hover="#E8F5EF"
            tamanoIcono={20}
            icono={ICONO_SUBIR}
            deshabilitado={!sePuedeMarcarEnAlta(fila)}
          />

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


// La tarjeta con los materiales del gasto. Solo existe para un gasto de
// materiales que ya está guardado.
function MaterialesDelGasto({
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

  const hayPorMarcar = filas.some(sePuedeMarcarEnAlta)

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onAltaTodos}
            disabled={!hayPorMarcar}
            title={
              hayPorMarcar
                ? 'Marcar todos los materiales de este gasto en disponibilidad Alta'
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
          criterio que el error de los botones de estado en la ficha de
          Pedidos. */}
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

          {/* El total es el monto del gasto, tal cual lo manda el backend: es
              el mismo número que muestra MONTO TOTAL en la tarjeta de arriba.
              No se suma acá. */}
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
            Sin materiales cargados
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            Anotá qué compraste y a qué precio.
          </p>

          {/* DIFERENCIA DELIBERADA CON EL DISEÑO: allá esto es un error que
              impide crear el gasto sin materiales. Acá el gasto se crea
              primero y los materiales se cargan después, así que un gasto de
              materiales en $0 es válido y el texto queda como aclaración. */}
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#B08791', textWrap: 'pretty' }}>
            El monto sale de la suma de los subtotales: mientras no haya
            materiales, el gasto queda en $0.
          </p>
        </div>
      )}
    </div>
  )
}


// La misma ficha atiende dos casos: el alta (/gastos/nuevo) y la edición
// (/gastos/:id). Cuál es lo dice la ruta con la prop, igual que en la ficha
// de Pedidos.
export default function DetalleGasto({ esAlta = false }) {
  const { id } = useParams()
  const navegar = useNavigate()

  const [gasto, setGasto] = useState(null)
  // En un alta no hay nada que traer del servidor.
  const [cargando, setCargando] = useState(!esAlta)

  // Dos errores y no uno, por lo mismo que en la ficha de Pedidos: cada uno
  // se muestra al lado de lo que lo provocó. 'error' es el del formulario de
  // datos; 'errorMateriales', el de las operaciones sobre la tabla.
  const [error, setError] = useState('')
  const [errorMateriales, setErrorMateriales] = useState('')

  // El borrador de los datos vive acá, en la ficha. Es lo que se edita y lo
  // que viaja al guardar; el gasto es lo último que confirmó el backend.
  const [borrador, setBorrador] = useState(esAlta ? borradorVacio() : null)
  const [guardando, setGuardando] = useState(false)

  // Todos los materiales del sistema, para el desplegable del modal.
  const [materiales, setMateriales] = useState([])

  // null cuando está cerrado. Abierto guarda o bien la fila que se está
  // editando, o bien la cadena 'nuevo' para agregar: el mismo truco que el
  // modal de cobros.
  const [modalMaterial, setModalMaterial] = useState(null)
  const [modalEliminar, setModalEliminar] = useState(false)

  const [toast, setToast] = useState('')
  const [hayDeshacer, setHayDeshacer] = useState(false)
  const temporizador = useRef(null)

  // Los materiales que cambió el último "marcar en Alta", con la
  // disponibilidad que tenía cada uno. Va en un ref y no en estado porque no
  // se dibuja: solo se usa si ella toca Deshacer.
  const cambiados = useRef([])

  useEffect(() => {
    if (!esAlta) {
      obtenerGasto(id)
        .then((res) => {
          setGasto(res.data)
          setBorrador(borradorDe(res.data))
        })
        .catch(() => setError('No se pudo cargar el gasto.'))
        .finally(() => setCargando(false))
    }

    // Si falla, la ficha igual sirve: lo único que queda sin poder hacerse
    // es agregar materiales.
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [id, esAlta])


  // conDeshacer decide las dos cosas que distinguen a ese aviso: que lleve
  // el botón, y que dure 6 segundos en vez de 2,6. Dura más porque es el
  // único aviso con algo para hacer, y hay que llegar a leerlo y decidir.
  function mostrarToast(texto, conDeshacer = false) {
    setToast(texto)
    setHayDeshacer(conDeshacer)

    // Se cancela el anterior: si no, al hacer dos acciones seguidas el
    // temporizador de la primera apaga el cartel de la segunda antes de
    // tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      setToast('')
      setHayDeshacer(false)
    }, conDeshacer ? 6000 : 2600)
  }


  // -------------------------------------------------------------------
  // Los datos del gasto (CU52 y CU54)
  // -------------------------------------------------------------------

  async function guardarDatos() {
    setError('')

    const esDeMateriales = borrador.tipo === 'MATERIALES'

    // Se muestra el primero que falte: es un formulario corto y una lista de
    // errores sería más ruido que ayuda. El backend valida lo mismo; acá se
    // avisa antes para no hacer un viaje que ya se sabe que falla.
    if (!esDeMateriales && !(Number(borrador.monto) > 0)) {
      setError(
        esAlta
          ? 'Ingresá el monto que pagaste para poder crear el gasto.'
          : 'El monto del gasto tiene que ser mayor a cero.'
      )
      return
    }
    if (!borrador.fecha) {
      setError('La fecha del gasto es obligatoria.')
      return
    }

    setGuardando(true)

    const datos = {
      tipo: borrador.tipo,
      fecha: borrador.fecha,
      descripcion: borrador.descripcion.trim(),
    }

    // En un gasto de materiales el monto NO viaja: lo calcula el backend, y
    // si fuera en el cuerpo lo ignoraría.
    if (!esDeMateriales) datos.monto = borrador.monto

    try {
      if (esAlta) {
        const res = await crearGasto(datos)

        // El gasto recién creado se guarda en el estado ANTES de navegar, y
        // no es una prolijidad. /gastos/nuevo y /gastos/:id dibujan el mismo
        // componente, así que React Router no lo desmonta al pasar de una
        // ruta a la otra: lo reutiliza, con su estado. Sin esto la ficha
        // quedaría un instante sin gasto y mostraría "No se encontró el
        // gasto" hasta que llegue el GET del useEffect.
        setGasto(res.data)
        setBorrador(borradorDe(res.data))

        // El alta termina en la ficha del gasto nuevo, que ya es una
        // edición: si es de materiales, ahí aparece la tabla para cargarlos.
        navegar(`/gastos/${res.data.id}`)
        return
      }

      const res = await modificarGasto(id, datos)
      setGasto(res.data)
      setBorrador(borradorDe(res.data))
      mostrarToast('Cambios guardados')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }


  // -------------------------------------------------------------------
  // Los materiales del gasto (CU56 a CU59)
  // -------------------------------------------------------------------
  // Las operaciones sobre la tabla son inmediatas, como las de los productos
  // del pedido: quitar un material es un hecho consumado, no un campo que se
  // está editando, así que no esperan al botón de guardar.
  //
  // Todas devuelven el gasto completo ya recalculado por el backend, así que
  // se usa esa respuesta en vez de volver a pedir el gasto: es un viaje
  // menos, y la tabla y el monto se acomodan de una sola vez.

  // Devuelve lo que respondió el backend, o null si falló.
  async function accionSobreMateriales(llamada) {
    // Se limpian los dos carteles: si no, quedaría colgado un error viejo
    // hablando de algo que ya pasó.
    setError('')
    setErrorMateriales('')

    try {
      const res = await llamada()
      return res.data
    } catch (err) {
      setErrorMateriales(mensajeDeError(err))
      return null
    }
  }

  async function quitarMaterial(fila) {
    // Sin modal de confirmación y sin aviso flotante: la fila desaparece de
    // la tabla y el monto baja, que ya es confirmación suficiente.
    const actualizado = await accionSobreMateriales(() => quitarMaterialDelGasto(id, fila.id))

    if (actualizado) setGasto(actualizado)
  }

  // Lo que sigue a marcar en Alta, sea una fila o todas: las dos llamadas
  // responden con la misma forma, { materiales_cambiados, gasto }.
  function aplicarDisponibilidadAlta(respuesta) {
    if (!respuesta) return

    setGasto(respuesta.gasto)

    const lista = respuesta.materiales_cambiados

    // Si no cambió ninguno no hay nada que avisar ni que deshacer.
    if (lista.length === 0) return

    cambiados.current = lista

    mostrarToast(
      lista.length === 1
        ? `«${lista[0].nombre}» pasó a disponibilidad Alta`
        : `${lista.length} materiales pasaron a disponibilidad Alta`,
      true
    )
  }

  async function marcarEnAlta(fila) {
    aplicarDisponibilidadAlta(
      await accionSobreMateriales(() => marcarDisponibilidadAlta(id, fila.id))
    )
  }

  async function marcarTodosEnAlta() {
    aplicarDisponibilidadAlta(
      await accionSobreMateriales(() => marcarTodosDisponibilidadAlta(id))
    )
  }

  // Deshacer no tiene endpoint propio: a cada material que cambió se le
  // devuelve la disponibilidad que tenía, con el PATCH de materiales.
  async function deshacer() {
    clearTimeout(temporizador.current)
    setToast('')
    setHayDeshacer(false)
    setErrorMateriales('')

    try {
      // De a uno y en orden, con un for común: son dos o tres materiales y
      // así se lee de corrido qué se le manda a cada uno.
      for (const material of cambiados.current) {
        await cambiarDisponibilidad(material.id, material.disponibilidad_anterior)
      }

      // Acá SÍ se vuelve a pedir el gasto. cambiarDisponibilidad responde
      // con el material, no con el gasto, así que es la única forma de que
      // la tabla muestre la disponibilidad restaurada.
      const res = await obtenerGasto(id)
      setGasto(res.data)
    } catch (err) {
      setErrorMateriales(mensajeDeError(err))
    }

    cambiados.current = []
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!esAlta && !gasto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el gasto.'}</p>
  }


  // Salir descarta lo escrito sin preguntar, igual que en las otras fichas.
  function volver() {
    navegar('/gastos')
  }

  // Descartar repone el formulario desde el gasto guardado.
  function descartar() {
    setError('')
    setBorrador(borradorDe(gasto))
  }


  // Derivados, calculados en cada render.

  const titulo = esAlta ? 'Nuevo gasto' : `Gasto #${gasto.id}`

  // El subtítulo de un gasto que ya existe se lee del gasto GUARDADO y no
  // del borrador, para poder usar el tipo_display que manda el backend.
  const subtitulo = esAlta
    ? 'Cargá los datos del gasto. Si es una compra de materiales, el detalle se carga después de crearlo.'
    : `${gasto.tipo_display} · ${fmtFechaLarga(gasto.fecha)}`

  // Si el gasto guardado ya es de materiales. De esto dependen tres cosas:
  // que el tipo quede bloqueado, que aparezca la tabla, y que haya un monto
  // calculado para mostrar.
  const yaEsDeMateriales = !esAlta && gasto.tipo === 'MATERIALES'

  // El monto de un gasto de materiales es el que manda el backend, tal cual.
  // Hay un solo caso donde todavía no hay ninguno que mostrar: cuando se
  // eligió Materiales pero el gasto no se guardó así todavía (un alta, o un
  // gasto de publicidad que se está pasando a materiales). Ahí va $0, que es
  // lo que el backend va a escribir al guardar, porque no hay materiales que
  // sumar. No es una cuenta del navegador.
  const montoCalculado = yaEsDeMateriales ? gasto.monto : 0

  // Hay cambios si algún campo del borrador difiere de lo guardado.
  const original = esAlta ? null : borradorDe(gasto)

  const hayCambios =
    !esAlta &&
    (borrador.tipo !== original.tipo ||
      borrador.fecha !== original.fecha ||
      borrador.monto !== original.monto ||
      borrador.descripcion !== original.descripcion)

  // La línea gris de abajo del formulario, para cuando se eligió Materiales
  // pero la tabla todavía no puede aparecer porque el gasto no está guardado
  // así.
  const avisoMateriales =
    borrador.tipo === 'MATERIALES' && !yaEsDeMateriales
      ? esAlta
        ? 'Primero creá el gasto. Después vas a poder cargarle los materiales que compraste.'
        : 'Guardá el cambio de tipo para poder cargarle los materiales.'
      : ''

  // Los materiales que se pueden agregar: los activos que todavía no están
  // en este gasto. El backend permitiría uno discontinuado, pero no tiene
  // sentido ofrecer para una compra nueva algo que ya no se usa; y uno
  // repetido lo rechaza, porque cada material va una sola vez por gasto.
  const cargados = yaEsDeMateriales ? gasto.materiales.map((fila) => fila.material) : []

  const disponibles = materiales.filter(
    (m) => m.estado === 'ACTIVO' && !cargados.includes(m.id)
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <button
          onClick={volver}
          className="btn-ver-productos"
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#8C5A66',
          }}
        >
          Gastos
        </button>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
        </svg>

        <span style={{ fontSize: 15, color: '#857078' }}>{titulo}</span>
      </div>

      <div style={{ marginBottom: 22, maxWidth: 1140 }}>
        <h1
          style={{
            margin: '0 0 8px',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 32,
            color: '#3D3238',
          }}
        >
          {titulo}
        </h1>

        <p style={{ margin: 0, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>{subtitulo}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1140 }}>
        <DatosDelGasto
          borrador={borrador}
          onCambiar={(cambio) => {
            setError('')
            setBorrador({ ...borrador, ...cambio })
          }}
          esAlta={esAlta}
          tipoBloqueado={yaEsDeMateriales}
          montoCalculado={montoCalculado}
          mostrarBotones={esAlta || hayCambios}
          guardando={guardando}
          error={error}
          onGuardar={guardarDatos}
          // En un alta, cancelar es irse. En un gasto que ya existe, es
          // descartar lo escrito y quedarse en la ficha.
          onCancelar={esAlta ? volver : descartar}
        />

        {avisoMateriales && (
          <p style={{ margin: '-8px 0 0', fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            {avisoMateriales}
          </p>
        )}

        {/* Los materiales cuelgan de un gasto que ya existe y que es de
            materiales: hasta entonces no hay de dónde colgarlos. */}
        {yaEsDeMateriales && (
          <MaterialesDelGasto
            gasto={gasto}
            quedanPorAgregar={disponibles.length > 0}
            error={errorMateriales}
            onAgregar={() => setModalMaterial('nuevo')}
            onEditar={(fila) => setModalMaterial(fila)}
            onQuitar={quitarMaterial}
            onAlta={marcarEnAlta}
            onAltaTodos={marcarTodosEnAlta}
          />
        )}

        {/* Eliminar va fuera de las tarjetas, como en el diseño. En un alta
            no hay nada que eliminar. */}
        {!esAlta && (
          <div>
            <button
              onClick={() => setModalEliminar(true)}
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
              Eliminar gasto
            </button>
          </div>
        )}
      </div>

      {modalMaterial && (
        <ModalMaterial
          gastoId={gasto.id}
          // 'nuevo' es agregar; cualquier otra cosa es la fila que se está
          // editando.
          fila={modalMaterial === 'nuevo' ? null : modalMaterial}
          materiales={disponibles}
          onCerrar={() => setModalMaterial(null)}
          // El modal ya habló con el backend: acá llega el gasto completo
          // actualizado, y alcanza con reemplazarlo.
          onGuardado={(actualizado) => {
            const editando = modalMaterial !== 'nuevo'

            setGasto(actualizado)
            setModalMaterial(null)
            setErrorMateriales('')
            mostrarToast(editando ? 'Material actualizado' : 'Material agregado')
          }}
        />
      )}

      {modalEliminar && (
        <ModalEliminarGasto
          gasto={gasto}
          onCerrar={() => setModalEliminar(false)}
          // Al borrarlo se vuelve al listado: la ficha quedaría mostrando
          // algo que ya no existe.
          onEliminado={() => navegar('/gastos')}
        />
      )}

      {toast && (
        <Toast
          texto={toast}
          accion={hayDeshacer ? 'Deshacer' : undefined}
          onAccion={deshacer}
        />
      )}
    </div>
  )
}
