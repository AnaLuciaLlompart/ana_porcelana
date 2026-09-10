import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { obtenerPedido, crearPedido, modificarPedido, cambiarEstadoPedido } from './api'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hace falta la lista
// completa para el desplegable de clientes.
import { listarClientes } from '../clientes/api'

import Toast from '../../componentes/Toast'

import PestanaDatos from './PestanaDatos'
import ModalEliminarPedido from './ModalEliminarPedido'
import {
  COLOR_ESTADO,
  ESTADOS,
  ICONO_ALERTA,
  ICONO_FLECHA,
  formatearPrecio,
  hoy,
} from './presentacion'


// Los campos que edita el formulario de Datos. El cliente va como texto
// porque el value de un <select> siempre lo es; se convierte al guardar.
// Las tres fechas y el costo pueden venir en null desde el backend, y un
// input controlado no acepta null: se traducen a cadena vacía.
function borradorDe(pedido) {
  return {
    cliente: String(pedido.cliente),
    fecha_pedido: pedido.fecha_pedido,
    fecha_entrega_estimada: pedido.fecha_entrega_estimada || '',
    fecha_entrega_real: pedido.fecha_entrega_real || '',
    envio_a_cargo: pedido.envio_a_cargo,
    direccion_entrega: pedido.direccion_entrega,
    costo_entrega: pedido.costo_entrega === null ? '' : String(Math.round(Number(pedido.costo_entrega))),
  }
}


// Con qué arranca el formulario en un alta. Los dos valores que no están
// vacíos son los mismos con los que nace un pedido en el diseño: la fecha
// de hoy y el envío a cargo del cliente.
const BORRADOR_VACIO = {
  cliente: '',
  fecha_pedido: hoy(),
  fecha_entrega_estimada: '',
  fecha_entrega_real: '',
  envio_a_cargo: 'CLIENTE',
  direccion_entrega: '',
  costo_entrega: '',
}


// El backend contesta de dos formas según qué falló: las reglas de negocio
// mandan {'detail': '...'} y los errores de campo mandan
// {'cliente': ['Este campo es requerido.']}. Hay que mirar las dos para no
// tragarse el mensaje.
function mensajeDeError(err) {
  const datos = err.response?.data
  if (!datos) return 'No se pudo completar la acción.'
  if (datos.detail) return datos.detail

  const primerCampo = Object.values(datos)[0]
  if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0]

  return 'No se pudo completar la acción.'
}


const PESTANAS = [
  { id: 'datos', label: 'Datos y estado' },
  { id: 'productos', label: 'Productos del pedido' },
]


// Una fila del resumen. La de "Envío (lo paga el cliente)" va apagada,
// porque es plata que el pedido no cobra.
function FilaResumen({ etiqueta, valor, apagada }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: apagada ? '#B08791' : '#857078' }}>{etiqueta}</span>
      <span
        style={{
          color: apagada ? '#B08791' : '#3D3238',
          fontFamily: apagada ? 'inherit' : "'Quicksand', sans-serif",
          fontWeight: apagada ? 400 : 600,
        }}
      >
        {valor}
      </span>
    </div>
  )
}


// La misma ficha atiende dos casos: el alta (/pedidos/nuevo) y la edición
// (/pedidos/:id). Cuál es lo dice la ruta con la prop, en vez de que el
// componente lo deduzca de que falte el id.
export default function DetallePedido({ esAlta = false }) {
  const { id } = useParams()
  const navegar = useNavigate()

  const [pedido, setPedido] = useState(null)
  // En un alta no hay nada que traer del servidor.
  const [cargando, setCargando] = useState(!esAlta)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('datos')

  // El borrador de Datos vive ACÁ y no en PestanaDatos, al revés que el
  // borrador del modal de filtros. El motivo es que tiene que sobrevivir al
  // cambio de pestaña: si viviera en la pestaña, pasar a Productos la
  // desmontaría y se perdería lo escrito.
  const [borrador, setBorrador] = useState(esAlta ? BORRADOR_VACIO : null)
  const [guardando, setGuardando] = useState(false)

  const [clientes, setClientes] = useState([])
  const [modalEliminar, setModalEliminar] = useState(false)

  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  useEffect(() => {
    if (!esAlta) {
      obtenerPedido(id)
        .then((res) => {
          setPedido(res.data)
          setBorrador(borradorDe(res.data))
        })
        .catch(() => setError('No se pudo cargar el pedido.'))
        .finally(() => setCargando(false))
    }

    listarClientes().then((res) => setClientes(res.data)).catch(() => {})
  }, [id, esAlta])


  function mostrarToast(texto) {
    setToast(texto)
    // Se cancela el anterior: si no, al hacer dos acciones seguidas el
    // temporizador de la primera apaga el cartel de la segunda antes de
    // tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 2600)
  }


  // El endpoint devuelve la ficha completa ya recalculada por el backend,
  // así que se usa esa respuesta en vez de volver a pedir el pedido: es un
  // viaje menos y no hay un momento con datos viejos.
  async function accionInmediata(llamada, textoToast) {
    setError('')
    try {
      const res = await llamada()
      setPedido(res.data)
      if (textoToast) mostrarToast(textoToast)
      return res.data
    } catch (err) {
      setError(mensajeDeError(err))
      return null
    }
  }


  // El estado se cambia EN EL MOMENTO, a diferencia de los campos de la
  // pestaña Datos, que esperan al botón de Guardar. Es un hecho consumado:
  // el pedido pasó a producción, no es un dato que se está editando.
  async function cambiarEstado(estado, label) {
    const actualizado = await accionInmediata(
      () => cambiarEstadoPedido(id, estado),
      `Pedido ${label.toLowerCase()}`
    )

    if (!actualizado) return

    // Al pasar a Entregado el backend escribe la fecha de entrega real con
    // la de hoy, así que el campo de la pestaña la copia tal cual. Se pisa
    // lo que hubiera: es lo mismo que acaba de quedar guardado, y si el
    // formulario mostrara otra cosa estaría mintiendo.
    setBorrador((actual) => ({
      ...actual,
      fecha_entrega_real: actualizado.fecha_entrega_real || '',
    }))
  }


  // Devuelve el id del pedido si salió bien, o null si no. En un alta ese
  // id es el del pedido recién creado, y hace falta para navegar a su ficha.
  async function guardarDatos() {
    setError('')

    // Los dos que el backend exige. Se muestra el primero que falte: es un
    // formulario corto y una lista de errores sería más ruido que ayuda.
    if (!borrador.cliente) {
      setError(
        esAlta
          ? 'Elegí el cliente del pedido para poder crearlo.'
          : 'Elegí el cliente del pedido.'
      )
      return null
    }
    if (!borrador.fecha_pedido) {
      setError('La fecha del pedido es obligatoria.')
      return null
    }

    setGuardando(true)

    // Las dos fechas de entrega y el costo viajan como null cuando están
    // vacíos, no como cadena vacía: así están declarados en el modelo, y un
    // '' haría fallar la validación del campo de fecha.
    const datos = {
      cliente: Number(borrador.cliente),
      fecha_pedido: borrador.fecha_pedido,
      fecha_entrega_estimada: borrador.fecha_entrega_estimada || null,
      fecha_entrega_real: borrador.fecha_entrega_real || null,
      envio_a_cargo: borrador.envio_a_cargo,
      direccion_entrega: borrador.direccion_entrega.trim(),
      costo_entrega: borrador.costo_entrega === '' ? null : borrador.costo_entrega,
    }

    try {
      if (esAlta) {
        const res = await crearPedido(datos)
        return res.data.id
      }

      const res = await modificarPedido(id, datos)
      setPedido(res.data)
      setBorrador(borradorDe(res.data))
      mostrarToast('Cambios guardados')
      return res.data.id
    } catch (err) {
      setError(mensajeDeError(err))
      return null
    } finally {
      setGuardando(false)
    }
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!esAlta && !pedido) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el pedido.'}</p>
  }


  // El botón del formulario: en un alta, además de crear, lleva a la ficha
  // del pedido nuevo, que ya es una edición con las dos pestañas.
  async function guardarFormulario() {
    const nuevoId = await guardarDatos()
    if (esAlta && nuevoId) navegar(`/pedidos/${nuevoId}`)
  }


  // Salir descarta lo escrito sin preguntar, igual que en la ficha de
  // Producto.
  function volver() {
    navegar('/pedidos')
  }


  // Derivados, calculados en cada render.
  //
  // El cliente y el estado se leen del BORRADOR y no del pedido guardado,
  // así el encabezado acompaña lo que se está eligiendo, como en el diseño.
  const clienteElegido = clientes.find((c) => String(c.id) === borrador.cliente)

  const subtitulo = clienteElegido
    ? `@${clienteElegido.instagram} · ${clienteElegido.nombre}`
    : 'Sin cliente'

  const titulo = esAlta ? 'Nuevo pedido' : `Pedido #${pedido.id}`

  const colorEstado = esAlta ? null : COLOR_ESTADO[pedido.estado]

  // El costo que el cliente paga por su cuenta: se anota igual, pero no
  // entra en el total del pedido.
  const costoDelCliente =
    !esAlta && pedido.envio_a_cargo === 'CLIENTE' && Number(pedido.costo_entrega) > 0

  const costoPropio = !esAlta && Number(pedido.costo_envio_a_cobrar) > 0

  // En un alta no hay nada que contar, así que la pestaña va sin globito.
  const CUENTAS = esAlta ? {} : { productos: pedido.cantidad_productos }

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
          Pedidos
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: 15,
            color: '#857078',
          }}
        >
          <span>{subtitulo}</span>

          {!esAlta && (
            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 20,
                padding: '5px 12px',
                border: `1px solid ${colorEstado.borde}`,
                background: colorEstado.fondo,
                color: colorEstado.color,
              }}
            >
              {pedido.estado_display}
            </span>
          )}
        </div>
      </div>

      {error && !esAlta && tab !== 'datos' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            marginBottom: 20,
            maxWidth: 1140,
            background: '#FAEAE8',
            border: '1px solid #f0b8b0',
            borderRadius: 6,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C0442F"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
          </svg>
          <span style={{ fontSize: 15, color: '#C0442F', textWrap: 'pretty' }}>{error}</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
          borderBottom: '1px solid #EBE0E2',
          maxWidth: 1140,
        }}
      >
        {PESTANAS.map((p) => {
          const activa = tab === p.id
          const cuenta = CUENTAS[p.id]
          // En un alta solo se puede estar en Datos: los productos del
          // pedido cuelgan de un pedido que todavía no existe.
          const deshabilitada = esAlta && p.id !== 'datos'

          return (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              disabled={deshabilitada}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 18px',
                border: 0,
                borderBottom: `2px solid ${activa ? '#8C5A66' : 'transparent'}`,
                background: 'transparent',
                cursor: deshabilitada ? 'default' : 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: deshabilitada ? '#B08791' : activa ? '#8C5A66' : '#857078',
              }}
            >
              {p.label}

              {cuenta !== undefined && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    borderRadius: 10,
                    background: activa ? '#8C5A66' : '#F0E2E4',
                    color: activa ? 'white' : '#8C5A66',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {cuenta}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {esAlta && (
        <p style={{ margin: '-8px 0 20px', fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
          Primero creá el pedido. Después vas a poder sumarle los productos
          que te encargaron.
        </p>
      )}

      {tab === 'datos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1140 }}>
          {/* El estado no existe hasta que el pedido existe. */}
          {!esAlta && (
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
                  margin: '0 0 10px',
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#8C5A66',
                  letterSpacing: '.06em',
                }}
              >
                ESTADO DEL PEDIDO
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {ESTADOS.map((e) => {
                  const activo = pedido.estado === e.valor
                  const solido = COLOR_ESTADO[e.valor].solido

                  return (
                    <button
                      key={e.valor}
                      onClick={() => cambiarEstado(e.valor, e.label)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 5,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 14,
                        border: activo ? `1px solid ${solido}` : '1px solid #EBE0E2',
                        background: activo ? solido : 'white',
                        color: activo ? 'white' : '#857078',
                      }}
                    >
                      {e.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <PestanaDatos
            borrador={borrador}
            onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
            esAlta={esAlta}
            clientes={clientes}
            onGuardar={guardarFormulario}
            onCancelar={volver}
            onEliminar={() => setModalEliminar(true)}
            guardando={guardando}
            error={error}
          />

          {/* El resumen muestra lo GUARDADO, no el borrador: los tres
              números los calcula el backend, y recalcularlos acá sería
              escribir por segunda vez una regla que ya está resuelta del
              otro lado. Al guardar se actualizan solos. */}
          {!esAlta && (
            <div
              style={{
                background: 'white',
                border: '1px solid #EBE0E2',
                borderRadius: 8,
                padding: 20,
                maxWidth: 360,
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* Los productos del pedido son CU44 a CU47 y llegan en el paso 3. */}
      {tab === 'productos' && (
        <p style={{ color: '#857078' }}>Esta pestaña todavía no está desarrollada.</p>
      )}

      {modalEliminar && (
        <ModalEliminarPedido
          pedido={pedido}
          onCerrar={() => setModalEliminar(false)}
          // Al borrarlo se vuelve al listado: la ficha quedaría mostrando
          // algo que ya no existe.
          onEliminado={() => navegar('/pedidos')}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
