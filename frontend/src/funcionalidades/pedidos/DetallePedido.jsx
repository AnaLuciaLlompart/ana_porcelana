import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerPedido,
  modificarPedido,
  cambiarEstadoPedido,
  agregarProductoAlPedido,
  modificarProductoDelPedido,
  quitarProductoDelPedido,
} from './api'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hace falta la lista
// completa para el desplegable de clientes.
import { listarClientes } from '../clientes/api'
import { listarProductos } from '../productos/api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

import Toast from '../../componentes/Toast'
import ChipCambiosSinGuardar from '../../componentes/ChipCambiosSinGuardar'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaProductos from './PestanaProductos'
import ModalAgregarProducto from './ModalAgregarProducto'
import ModalEditarProductoDelPedido from './ModalEditarProductoDelPedido'
import ModalCobros from './ModalCobros'
import {
  COLOR_ESTADO,
  ESTADOS,
  ICONO_COBRO,
  ICONO_FLECHA,
  chipSaldo,
  datosDeEntrega,
  faltaFormaEntrega,
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
    forma_entrega: pedido.forma_entrega,
    direccion_entrega: pedido.direccion_entrega,
    costo_entrega: pedido.costo_entrega === null ? '' : String(Math.round(Number(pedido.costo_entrega))),
  }
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


// La ficha de un pedido que ya existe (/pedidos/:id). El alta vive aparte,
// en AltaPedido: junta todo en memoria y lo crea al final.
export default function DetallePedido() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // El error de los botones de estado va aparte del general, y no por
  // capricho: en la tarjeta Datos el error general se dibuja adentro del
  // formulario, arriba de Guardar. Un rechazo del botón Listo aparecería
  // allá abajo, lejos del botón que lo provocó y mezclado con los errores
  // del formulario. Este se muestra pegado a los botones.
  const [errorEstado, setErrorEstado] = useState('')

  // Por lo mismo, el de las operaciones sobre los productos se muestra
  // pegado a su tabla.
  const [errorProductos, setErrorProductos] = useState('')

  // El borrador de Datos vive ACÁ y no en PestanaDatos, al revés que el
  // borrador del modal de filtros. El motivo es que la ficha también lo
  // necesita: la cabecera lee el cliente del borrador, y hayCambios lo
  // compara con lo guardado para el chip del breadcrumb.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)

  const [modalCobros, setModalCobros] = useState(false)

  // El producto del pedido que se está por quitar cuando es el último: el
  // modal pregunta antes, y recién al confirmar se quita.
  const [productoAQuitar, setProductoAQuitar] = useState(null)

  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  useEffect(() => {
    obtenerPedido(id)
      .then((res) => {
        setPedido(res.data)
        setBorrador(borradorDe(res.data))
      })
      .catch(() => setError('No se pudo cargar el pedido.'))
      .finally(() => setCargando(false))

    listarClientes().then((res) => setClientes(res.data)).catch(() => {})

    // El catálogo es para el modal de agregar. Si falla, la ficha igual
    // sirve: lo único que queda sin poder hacerse es sumar productos.
    listarProductos().then((res) => setProductos(res.data)).catch(() => {})
  }, [id])


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
    // Se limpian los tres y no solo el que va a usarse: si no, al hacer una
    // acción después de un error quedaría el cartel viejo colgado en la
    // pantalla, hablando de algo que ya pasó.
    setError('')
    setErrorEstado('')
    setErrorProductos('')

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
  // tarjeta Datos, que esperan al botón de Guardar. Es un hecho consumado:
  // el pedido pasó a producción, no es un dato que se está editando.
  // La fecha de entrega real que el backend escribe al entregar —o borra al
  // salir de Entregado— no hay que copiarla a ningún lado: el campo de la
  // tarjeta Datos la lee del pedido, y setPedido ya lo dejó actualizado.
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
  // del pie y el chip del saldo de la cabecera.

  // Las tres se guardan el estado que el pedido tenía ANTES de la llamada,
  // porque es lo único con qué comparar el que vuelve para saber si el
  // backend lo bajó solo.
  async function agregarProducto(datos) {
    setModalProducto(false)

    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => agregarProductoAlPedido(id, datos),
      'Producto agregado',
      setErrorProductos
    )

    // Si el pedido bajó, este cartel pisa el de "Producto agregado", y está
    // bien que lo pise: es lo más importante que pasó.
    avisarSiBajoSolo(estadoAntes, actualizado)
  }

  function editarProducto(productoDelPedido, datos) {
    setProductoEditando(null)
    accionInmediata(
      () => modificarProductoDelPedido(id, productoDelPedido.id, datos),
      'Producto actualizado',
      setErrorProductos
    )
  }

  async function cambiarEtapa(productoDelPedido, estado) {
    // Sin aviso flotante: el selector ya muestra la etapa nueva.
    // El único cartel que puede salir es el de la vuelta a En producción,
    // que aparece si esta etapa fue para atrás y dejó al pedido incompleto.
    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => modificarProductoDelPedido(id, productoDelPedido.id, { estado }),
      '',
      setErrorProductos
    )

    avisarSiBajoSolo(estadoAntes, actualizado)
  }

  // Quitar el último producto deja el pedido sin contenido: se puede, pero
  // antes se pregunta con el modal. Los demás se quitan directo.
  function quitarProducto(productoDelPedido) {
    if (pedido.productos.length === 1) {
      setProductoAQuitar(productoDelPedido)
      return
    }
    quitarProductoAhora(productoDelPedido)
  }

  async function quitarProductoAhora(productoDelPedido) {
    setProductoAQuitar(null)

    // Sin aviso flotante: la fila desaparece de la tabla.
    // Salvo que quitar esta pieza haya bajado el pedido, que sí se avisa.
    // Si era la última, la pregunta ya se hizo antes de llegar acá.
    const estadoAntes = pedido.estado
    const actualizado = await accionInmediata(
      () => quitarProductoDelPedido(id, productoDelPedido.id),
      '',
      setErrorProductos
    )

    avisarSiBajoSolo(estadoAntes, actualizado)
  }


  // Devuelve el id del pedido si salió bien, o null si no.
  async function guardarDatos() {
    setError('')

    // Los dos que el backend exige. Se muestra el primero que falte: es un
    // formulario corto y una lista de errores sería más ruido que ayuda.
    if (!borrador.cliente) {
      setError('Elegí el cliente del pedido.')
      return null
    }
    if (!borrador.fecha_pedido) {
      setError('La fecha del pedido es obligatoria.')
      return null
    }
    // Lo guardado siempre tiene una forma completa, pero el árbol puede
    // quedar en "Envío" sin elegir quién lo paga.
    const faltaForma = faltaFormaEntrega(borrador.forma_entrega)
    if (faltaForma) {
      setError(faltaForma)
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
      ...datosDeEntrega(borrador),
    }

    try {
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

  if (!pedido) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el pedido.'}</p>
  }


  // Salir descarta lo escrito sin preguntar, igual que en la ficha de
  // Producto. El aviso mientras se está en la ficha es el chip del breadcrumb.
  function volver() {
    navegar(`${BASE_GESTION}/pedidos`)
  }

  // Descartar repone el formulario desde el pedido guardado.
  function descartar() {
    setError('')
    setBorrador(borradorDe(pedido))
  }


  // Derivados, calculados en cada render.
  //
  // El cliente se lee del BORRADOR y no del pedido guardado, así la cabecera
  // cambia apenas se elige otro.
  const clienteElegido = clientes.find((c) => String(c.id) === borrador.cliente)

  const subtitulo = clienteElegido
    ? `@${clienteElegido.instagram} · ${clienteElegido.nombre}`
    : 'Sin cliente'

  const titulo = `Pedido #${pedido.id}`

  const chipDelSaldo = chipSaldo(pedido.saldo)

  // Hay cambios si algún campo del borrador difiere de lo guardado. Es la
  // misma comparación que hacen las fichas de Gastos y de Productos.
  const original = borradorDe(pedido)

  const hayCambios =
    borrador.cliente !== original.cliente ||
    borrador.fecha_pedido !== original.fecha_pedido ||
    borrador.fecha_entrega_estimada !== original.fecha_entrega_estimada ||
    borrador.forma_entrega !== original.forma_entrega ||
    borrador.direccion_entrega !== original.direccion_entrega ||
    borrador.costo_entrega !== original.costo_entrega

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

        {hayCambios && <ChipCambiosSinGuardar />}
      </div>

      <div
        className="ancho-pantalla"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 22,
          maxWidth: ANCHO_MAXIMO,
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
          </div>
        </div>

        {/* Los cobros se manejan en un modal propio (CU48 a CU51). Siempre
            encendido: adentro, Registrar cobro se apaga solo. */}
        <button
          onClick={() => setModalCobros(true)}
          className="btn-reponer"
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
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_COBRO} />
          </svg>
          Cobros
        </button>
      </div>

      {/* Diferencia deliberada con el prototipo: el estado es una acción
          instantánea, así que va afuera del formulario, arriba de los
          datos y los productos. */}
      <div
        className="ancho-pantalla"
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
          maxWidth: ANCHO_MAXIMO,
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

        <div className="botones-estado" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

      <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
        <PestanaDatos
          borrador={borrador}
          // Va aparte del borrador porque no se edita.
          fechaEntregaReal={pedido.fecha_entrega_real || ''}
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          hayCambios={hayCambios}
          clientes={clientes}
          onGuardar={guardarDatos}
          onCancelar={descartar}
          guardando={guardando}
          error={error}
        />

        <PestanaProductos
          productos={pedido.productos}
          subtotal={pedido.subtotal}
          error={errorProductos}
          onAgregar={() => setModalProducto(true)}
          onEditar={(p) => setProductoEditando(p)}
          onCambiarEtapa={cambiarEtapa}
          onQuitar={quitarProducto}
        />
      </div>

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

      {modalCobros && (
        <ModalCobros
          pedido={pedido}
          onCerrar={() => setModalCobros(false)}
          // Solo el pedido: los cobros no tocan los datos del borrador.
          onPedidoActualizado={(actualizado, aviso) => {
            setPedido(actualizado)
            if (aviso) mostrarToast(aviso)
          }}
        />
      )}

      {productoAQuitar && (
        <ModalConfirmar
          titulo="Quitar el último producto"
          texto="Es el último producto del pedido. ¿Quitarlo igual?"
          textoAccion="Quitar igual"
          onCerrar={() => setProductoAQuitar(null)}
          onConfirmar={() => quitarProductoAhora(productoAQuitar)}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
