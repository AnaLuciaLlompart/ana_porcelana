import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerPedido,
  crearPedido,
  modificarPedido,
  cambiarEstadoPedido,
  urlComprobante,
  agregarProductoAlPedido,
  modificarProductoDelPedido,
  quitarProductoDelPedido,
  registrarCobro,
  modificarCobro,
  borrarCobro,
} from './api'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hace falta la lista
// completa para el desplegable de clientes.
import { listarClientes } from '../clientes/api'
import { listarProductos } from '../productos/api'

import Toast from '../../componentes/Toast'

import PestanaDatos from './PestanaDatos'
import PestanaProductos from './PestanaProductos'
import PestanaCobros from './PestanaCobros'
import ModalAgregarProducto from './ModalAgregarProducto'
import ModalEditarProductoDelPedido from './ModalEditarProductoDelPedido'
import ModalCobro from './ModalCobro'
import ModalEliminarPedido from './ModalEliminarPedido'
import {
  COLOR_ESTADO,
  ESTADOS,
  ICONO_ALERTA,
  ICONO_COMPROBANTE,
  ICONO_FLECHA,
  chipSaldo,
  hoy,
} from './presentacion'


// Los campos que edita el formulario de Datos. El cliente va como texto
// porque el value de un <select> siempre lo es; se convierte al guardar.
// Las tres fechas y el costo pueden venir en null desde el backend, y un
// input controlado no acepta null: se traducen a cadena vacía.
//
// La fecha de entrega real NO está acá, aunque el formulario la muestre: la
// escribe el botón Entregado y el serializer la tiene en solo lectura. El
// borrador es lo que se edita y lo que viaja al guardar, así que dejarla
// afuera es lo que garantiza que no se pueda mandar. Es la misma garantía
// estructural que usa ProductoDelPedidoModificarSerializer no teniendo el
// campo producto.
function borradorDe(pedido) {
  return {
    cliente: String(pedido.cliente),
    fecha_pedido: pedido.fecha_pedido,
    fecha_entrega_estimada: pedido.fecha_entrega_estimada || '',
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
  { id: 'cobros', label: 'Cobros' },
]


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

  // El error de los botones de estado va aparte del general, y no por
  // capricho: en la pestaña Datos el error general se dibuja adentro del
  // formulario, arriba de Guardar. Un rechazo del botón Listo aparecería
  // allá abajo, lejos del botón que lo provocó y mezclado con los errores
  // del formulario. Este se muestra pegado a los botones.
  const [errorEstado, setErrorEstado] = useState('')

  const [tab, setTab] = useState('datos')

  // El borrador de Datos vive ACÁ y no en PestanaDatos, al revés que el
  // borrador del modal de filtros. El motivo es que tiene que sobrevivir al
  // cambio de pestaña: si viviera en la pestaña, pasar a Productos la
  // desmontaría y se perdería lo escrito.
  const [borrador, setBorrador] = useState(esAlta ? BORRADOR_VACIO : null)
  const [guardando, setGuardando] = useState(false)

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)

  // null cuando está cerrado. Abierto guarda o bien el cobro que se está
  // editando, o bien la cadena 'nuevo' para el alta: hacen falta los dos
  // casos y null ya significa "cerrado".
  const [modalCobro, setModalCobro] = useState(null)
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

    // El catálogo es para el modal de agregar. Si falla, la ficha igual
    // sirve: lo único que queda sin poder hacerse es sumar productos.
    listarProductos().then((res) => setProductos(res.data)).catch(() => {})
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
  //
  // El tercer parámetro dice EN QUÉ CARTEL se muestra el error, y por
  // defecto es el general. Se le pasa una función igual que a las otras
  // funciones del proyecto que reciben la de la API.
  async function accionInmediata(llamada, textoToast, avisarError = setError) {
    // Se limpian los dos y no solo el que va a usarse: si no, al hacer una
    // acción después de un error quedaría el cartel viejo colgado en la
    // pantalla, hablando de algo que ya pasó.
    setError('')
    setErrorEstado('')

    try {
      const res = await llamada()
      setPedido(res.data)
      if (textoToast) mostrarToast(textoToast)
      return res.data
    } catch (err) {
      avisarError(mensajeDeError(err))
      return null
    }
  }


  // El backend puede devolver el pedido en En producción sin que se le haya
  // pedido: si una operación sobre los productos dejó piezas sin terminar,
  // el pedido no puede seguir diciendo que está Listo y baja solo.
  //
  // El chip del encabezado y el botón resaltado ya cambian con la respuesta,
  // pero es un cambio que la usuaria no pidió, así que además se avisa.
  function avisarSiBajoSolo(estadoAntes, actualizado) {
    if (!actualizado) return
    if (actualizado.estado === estadoAntes) return
    if (actualizado.estado !== 'EN_PRODUCCION') return

    mostrarToast('El pedido volvió a En producción: quedaron piezas sin terminar')
  }


  // El estado se cambia EN EL MOMENTO, a diferencia de los campos de la
  // pestaña Datos, que esperan al botón de Guardar. Es un hecho consumado:
  // el pedido pasó a producción, no es un dato que se está editando.
  // La fecha de entrega real que el backend escribe al entregar —o borra al
  // salir de Entregado— no hay que copiarla a ningún lado: el campo de la
  // pestaña la lee del pedido, y setPedido ya lo dejó actualizado.
  function cambiarEstado(estado, label) {
    return accionInmediata(
      () => cambiarEstadoPedido(id, estado),
      `Pedido ${label.toLowerCase()}`,
      // El rechazo se muestra en la tarjeta del estado, no en el
      // formulario: es ahí donde está el botón que se tocó.
      setErrorEstado
    )
  }


  // Las tres operaciones sobre los productos del pedido también son
  // inmediatas: agregar una pieza al encargo es un hecho consumado, no un
  // campo que se está editando, así que no hay botón de guardar.
  //
  // Las tres devuelven el pedido completo, y por eso alcanza con la
  // respuesta para que se acomoden de una sola vez la tabla, el subtotal
  // del pie, el resumen de la otra pestaña y el contador del globito.

  // Las tres se guardan el estado que el pedido tenía ANTES de la llamada,
  // porque es lo único con qué comparar el que vuelve para saber si el
  // backend lo bajó solo.
  async function agregarProducto(datos) {
    setModalProducto(false)

    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => agregarProductoAlPedido(id, datos),
      'Producto agregado'
    )

    // Si el pedido bajó, este cartel pisa el de "Producto agregado", y está
    // bien que lo pise: es lo más importante que pasó.
    avisarSiBajoSolo(estadoAntes, actualizado)
  }

  function editarProducto(productoDelPedido, datos) {
    setProductoEditando(null)
    accionInmediata(
      () => modificarProductoDelPedido(id, productoDelPedido.id, datos),
      'Producto actualizado'
    )
  }

  async function cambiarEtapa(productoDelPedido, estado) {
    // Sin aviso flotante: el selector ya muestra la etapa nueva.
    // El único cartel que puede salir es el de la vuelta a En producción,
    // que aparece si esta etapa fue para atrás y dejó al pedido incompleto.
    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => modificarProductoDelPedido(id, productoDelPedido.id, { estado })
    )

    avisarSiBajoSolo(estadoAntes, actualizado)
  }

  async function quitarProducto(productoDelPedido) {
    // Sin aviso flotante: la fila desaparece de la tabla.
    // Salvo que quitar esta pieza haya bajado el pedido, que sí se avisa.
    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => quitarProductoDelPedido(id, productoDelPedido.id)
    )

    avisarSiBajoSolo(estadoAntes, actualizado)
  }


  // Los cobros van por el mismo camino: el pedido se cobra o no se
  // cobra, no es un campo que se esté editando. Las tres devuelven el
  // pedido completo, así que el resumen, el chip del encabezado y el
  // contador de la pestaña se acomodan solos.

  function guardarCobro(cobro, datos) {
    setModalCobro(null)

    // El mismo modal registra y edita: si trae un cobro, es una
    // corrección.
    if (cobro) {
      accionInmediata(() => modificarCobro(id, cobro.id, datos))
      return
    }

    accionInmediata(() => registrarCobro(id, datos), 'Cobro registrado')
  }

  function quitarCobro(cobro) {
    // Sin aviso flotante: la fila desaparece de la lista y el saldo se
    // mueve solo.
    accionInmediata(() => borrarCobro(id, cobro.id))
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

    // La entrega estimada y el costo viajan como null cuando están vacíos,
    // no como cadena vacía: así están declarados en el modelo, y un '' haría
    // fallar la validación del campo de fecha.
    //
    // La entrega real no viaja: no está en el borrador.
    const datos = {
      cliente: Number(borrador.cliente),
      fecha_pedido: borrador.fecha_pedido,
      fecha_entrega_estimada: borrador.fecha_entrega_estimada || null,
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
  const chipDelSaldo = esAlta ? null : chipSaldo(pedido.saldo)

  // En un alta no hay nada que contar, así que la pestaña va sin globito.
  const CUENTAS = esAlta
    ? {}
    : { productos: pedido.cantidad_productos, cobros: pedido.cobros.length }

  // Hay cambios si algún campo del borrador difiere de lo guardado. Es la
  // misma comparación que hacen las fichas de Gastos y de Productos.
  const original = esAlta ? null : borradorDe(pedido)

  const hayCambios =
    !esAlta &&
    (borrador.cliente !== original.cliente ||
      borrador.fecha_pedido !== original.fecha_pedido ||
      borrador.fecha_entrega_estimada !== original.fecha_entrega_estimada ||
      borrador.envio_a_cargo !== original.envio_a_cargo ||
      borrador.direccion_entrega !== original.direccion_entrega ||
      borrador.costo_entrega !== original.costo_entrega)

  // Por qué el botón Comprobante está apagado, o '' si está encendido. Es un
  // solo texto y no tres booleanos: el tooltip lo muestra tal cual y el
  // apagado sale de preguntar si está vacío, así que no pueden decir cosas
  // distintas.
  //
  // El orden importa: se muestra el primer motivo que se cumpla, y van del
  // más de fondo al más fácil de resolver.
  let motivoSinComprobante = ''

  if (esAlta) {
    motivoSinComprobante = 'Disponible después de crear el pedido'
  } else if (pedido.cantidad_productos === 0) {
    // El mismo criterio con el que el backend devuelve el 400: los dos
    // cuentan las filas de productos del pedido.
    motivoSinComprobante = 'Agregá productos al pedido para generar el comprobante'
  } else if (hayCambios) {
    // El PDF se arma con lo GUARDADO. Con el borrador a medio editar
    // mostraría, por ejemplo, la dirección vieja mientras la pantalla
    // muestra la nueva.
    motivoSinComprobante = 'Guardá los cambios para generar el comprobante'
  }

  const comprobanteApagado = motivoSinComprobante !== ''

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

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 22,
          maxWidth: 1140,
        }}
      >
        <div style={{ minWidth: 0 }}>
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
              <>
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

                <span
                  style={{
                    whiteSpace: 'nowrap',
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    borderRadius: 20,
                    padding: '5px 12px',
                    border: `1px solid ${chipDelSaldo.borde}`,
                    background: chipDelSaldo.fondo,
                    color: chipDelSaldo.color,
                  }}
                >
                  {chipDelSaldo.texto}
                </span>
              </>
            )}
          </div>
        </div>

        {/* CU60. Es un enlace y no un <button>: abre el PDF en otra pestaña,
            y eso es justo lo que hace un <a> con target="_blank", sin una
            línea de JavaScript. La sesión viaja sola en la cookie.

            Apagado, se le saca el href. Un <a> sin href no es un enlace: no
            navega con ningún tipo de clic ni se alcanza con Tab, así que
            está apagado de verdad y no solo pintado de gris. No se usa
            pointer-events: none porque haría que el elemento no reciba el
            mouse, y sin mouse no aparece el tooltip que explica por qué
            está apagado.

            La clase del hover también se saca al apagarlo, para que no se
            pinte de rosa algo que no se puede tocar.

            rel="noopener noreferrer" es lo que se le pone a todo enlace que
            abre otra pestaña: evita que la pestaña nueva pueda manejar a
            esta. textDecoration va en none porque un enlace, a diferencia
            de un botón, viene subrayado de fábrica. */}
        <a
          href={comprobanteApagado ? undefined : urlComprobante(id)}
          target="_blank"
          rel="noopener noreferrer"
          title={comprobanteApagado ? motivoSinComprobante : 'Generar comprobante en PDF'}
          className={comprobanteApagado ? undefined : 'btn-reponer'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            padding: '10px 18px',
            border: '1px solid #EBE0E2',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 6,
            textDecoration: 'none',
            cursor: comprobanteApagado ? 'default' : 'pointer',
            opacity: comprobanteApagado ? 0.5 : undefined,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_COMPROBANTE} />
          </svg>
          Comprobante
        </a>
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

              {/* Debajo de los botones y no arriba: se lee después de haber
                  tocado el que lo provocó. Es el mismo recuadro del
                  formulario, para que un error se vea siempre igual. */}
              {errorEstado && (
                <p
                  role="alert"
                  style={{
                    margin: '12px 0 0',
                    padding: '10px 12px',
                    background: '#FAEAE8',
                    border: '1px solid #F0C4BC',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#C0442F',
                    textWrap: 'pretty',
                  }}
                >
                  {errorEstado}
                </p>
              )}
            </div>
          )}

          <PestanaDatos
            borrador={borrador}
            // Va aparte del borrador porque no se edita. En un alta está
            // vacía: un pedido no nace entregado.
            fechaEntregaReal={esAlta ? '' : pedido.fecha_entrega_real || ''}
            onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
            esAlta={esAlta}
            clientes={clientes}
            onGuardar={guardarFormulario}
            onCancelar={volver}
            onEliminar={() => setModalEliminar(true)}
            guardando={guardando}
            error={error}
          />

        </div>
      )}

      {tab === 'cobros' && (
        <PestanaCobros
          pedido={pedido}
          onRegistrar={() => setModalCobro('nuevo')}
          onEditar={(cobro) => setModalCobro(cobro)}
          onQuitar={quitarCobro}
        />
      )}

      {tab === 'productos' && (
        <PestanaProductos
          productos={pedido.productos}
          subtotal={pedido.subtotal}
          onAgregar={() => setModalProducto(true)}
          onEditar={(p) => setProductoEditando(p)}
          onCambiarEtapa={cambiarEtapa}
          onQuitar={quitarProducto}
        />
      )}

      {modalProducto && (
        <ModalAgregarProducto
          // Solo los activos: una pieza dada de baja ya no se ofrece, y
          // encargarla de nuevo sería volver a ponerla en circulación por
          // la puerta de atrás.
          productos={productos.filter((p) => p.estado === 'ACTIVO')}
          onCerrar={() => setModalProducto(false)}
          onAgregar={agregarProducto}
        />
      )}

      {productoEditando && (
        <ModalEditarProductoDelPedido
          productoDelPedido={productoEditando}
          onCerrar={() => setProductoEditando(null)}
          onGuardar={editarProducto}
        />
      )}

      {modalCobro && (
        <ModalCobro
          // 'nuevo' es el alta; cualquier otra cosa es el cobro que se
          // está corrigiendo.
          cobro={modalCobro === 'nuevo' ? null : modalCobro}
          saldo={pedido.saldo}
          total={pedido.total}
          hayCobros={pedido.cobros.length > 0}
          onCerrar={() => setModalCobro(null)}
          onGuardar={guardarCobro}
        />
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
