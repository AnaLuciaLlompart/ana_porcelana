import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import {
  obtenerPedido,
  modificarPedido,
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

import ChipCambiosSinGuardar from '../../componentes/ChipCambiosSinGuardar'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaProductos from './PestanaProductos'
import ModalAgregarProducto from './ModalAgregarProducto'
import ModalEditarProductoDelPedido from './ModalEditarProductoDelPedido'
import {
  COLOR_ESTADO,
  ICONO_FLECHA,
  chipSaldo,
  datosDeEntrega,
  faltaFormaEntrega,
  hoy,
  lineaEnMemoria,
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
//
// Los productos del pedido también están en el borrador: la ficha es un
// solo formulario, y se guardan con el mismo Guardar que los datos.
function borradorDe(pedido) {
  return {
    cliente: String(pedido.cliente),
    fecha_pedido: pedido.fecha_pedido,
    fecha_entrega_estimada: pedido.fecha_entrega_estimada || '',
    forma_entrega: pedido.forma_entrega,
    direccion_entrega: pedido.direccion_entrega,
    costo_entrega: pedido.costo_entrega === null ? '' : String(Math.round(Number(pedido.costo_entrega))),
    productos: pedido.productos,
  }
}

// Si algún dato del formulario difiere de lo guardado. Los productos van
// aparte, en cambiosEnProductos.
function datosCambiaron(borrador, original) {
  return (
    borrador.cliente !== original.cliente ||
    borrador.fecha_pedido !== original.fecha_pedido ||
    borrador.fecha_entrega_estimada !== original.fecha_entrega_estimada ||
    borrador.forma_entrega !== original.forma_entrega ||
    borrador.direccion_entrega !== original.direccion_entrega ||
    borrador.costo_entrega !== original.costo_entrega
  )
}

// Lo que hay que mandar para que lo guardado quede como el borrador: las
// filas que se quitaron, las que cambiaron (solo con lo que cambió) y las
// nuevas, que son las de id provisorio negativo.
function cambiosEnProductos(guardados, enBorrador) {
  const idsEnBorrador = enBorrador.map((linea) => linea.id)
  const quitados = guardados.filter((g) => !idsEnBorrador.includes(g.id))
  const nuevos = enBorrador.filter((linea) => linea.id < 0)

  const modificados = []
  for (const linea of enBorrador) {
    const guardada = guardados.find((g) => g.id === linea.id)
    if (!guardada) continue

    // El precio llega del backend como texto con decimales ("5000.00") y
    // del modal sin ellos ("5000"): se comparan como números.
    const cambio = {}
    if (linea.cantidad !== guardada.cantidad) cambio.cantidad = linea.cantidad
    if (Number(linea.precio) !== Number(guardada.precio)) cambio.precio = linea.precio
    if (linea.descripcion !== guardada.descripcion) cambio.descripcion = linea.descripcion
    if (linea.estado !== guardada.estado) cambio.estado = linea.estado

    if (Object.keys(cambio).length > 0) modificados.push({ linea, cambio })
  }

  return { quitados, modificados, nuevos }
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
//
// Es un solo formulario: los datos y los productos del pedido se editan en
// el borrador y se guardan juntos con Guardar, que al terminar vuelve al
// listado con un modal de aviso. El estado y los cobros no están acá: son
// acciones, y viven en la fila del listado.
export default function DetallePedido() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Un error al guardar un producto va aparte del general y se muestra
  // pegado a su tabla: el general se dibuja adentro del formulario de Datos,
  // lejos de la fila que lo provocó.
  const [errorProductos, setErrorProductos] = useState('')

  // El borrador vive ACÁ y no en PestanaDatos, al revés que el borrador del
  // modal de filtros. El motivo es que la ficha también lo necesita: la
  // cabecera lee el cliente del borrador, la tabla de productos dibuja sus
  // filas, y hayCambios lo compara con lo guardado para el chip del
  // breadcrumb.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [avance, setAvance] = useState('')

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)

  // Guardar un pedido que va a quedar sin productos se puede, pero antes se
  // pregunta con el modal.
  const [preguntarSinProductos, setPreguntarSinProductos] = useState(false)

  // Los ids provisorios de los productos nuevos: negativos, para que nunca
  // choquen con uno real.
  const proximoId = useRef(-1)

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


  // Hay cambios si algún dato del borrador difiere de lo guardado, o si hay
  // productos quitados, modificados o nuevos. Se calcula acá arriba, antes
  // de los return de la carga, porque lo usan los dos avisos de salir, que
  // son hooks y tienen que correr siempre.
  const cambios = pedido && borrador ? cambiosEnProductos(pedido.productos, borrador.productos) : null
  const hayCambios =
    cambios !== null &&
    (datosCambiaron(borrador, borradorDe(pedido)) ||
      cambios.quitados.length + cambios.modificados.length + cambios.nuevos.length > 0)

  // Con cambios sin guardar, recargar, cerrar la pestaña o escribir otra
  // dirección muestra el cartel del navegador, como en las altas. Su texto
  // no se puede cambiar.
  useEffect(() => {
    if (!hayCambios) return

    function avisar(evento) {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  // Y cualquier navegación dentro de la aplicación (el breadcrumb, el menú
  // lateral, el Atrás, el botón de materiales de un producto) se frena y
  // pregunta, con el mismo bloqueo de las altas. Sin cambios no hay nada
  // que perder y no pregunta. Después de guardar no se frena, y la del
  // cierre de sesión tampoco: la sesión ya no está.
  const saltearBloqueo = useRef(false)
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      !saltearBloqueo.current &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname !== `${BASE_GESTION}/login`
  )


  // Las cuatro operaciones sobre los productos escriben en el borrador, como
  // en el alta: nada viaja hasta Guardar.

  function agregarProducto(datos) {
    setModalProducto(false)
    const delCatalogo = productos.find((p) => p.id === datos.producto)
    const linea = lineaEnMemoria(proximoId.current, datos, delCatalogo)
    proximoId.current -= 1
    setBorrador({ ...borrador, productos: [...borrador.productos, linea] })
  }

  function cambiarLinea(linea, cambio) {
    setBorrador({
      ...borrador,
      productos: borrador.productos.map((l) => (l.id === linea.id ? { ...l, ...cambio } : l)),
    })
  }

  function editarProducto(linea, datos) {
    setProductoEditando(null)
    cambiarLinea(linea, { ...datos, subtotal: datos.cantidad * Number(datos.precio) })
  }

  function cambiarEtapa(linea, estado) {
    cambiarLinea(linea, { estado, fecha_cambio_estado: hoy() })
  }

  // Quitar no pregunta: la pregunta, si el pedido queda sin productos, está
  // al guardar.
  function quitarProducto(linea) {
    setBorrador({ ...borrador, productos: borrador.productos.filter((l) => l.id !== linea.id) })
  }


  // Guardar: primero revisa los datos y, si el pedido va a quedar sin
  // productos, pregunta.
  function pedirGuardar() {
    setError('')
    setErrorProductos('')

    // Los dos que el backend exige. Se muestra el primero que falte: es un
    // formulario corto y una lista de errores sería más ruido que ayuda.
    if (!borrador.cliente) {
      setError('Elegí el cliente del pedido.')
      return
    }
    if (!borrador.fecha_pedido) {
      setError('La fecha del pedido es obligatoria.')
      return
    }
    const faltaForma = faltaFormaEntrega(borrador.forma_entrega)
    if (faltaForma) {
      setError(faltaForma)
      return
    }

    if (borrador.productos.length === 0 && pedido.productos.length > 0) {
      setPreguntarSinProductos(true)
      return
    }

    guardar()
  }

  // Guardar es una cadena de los endpoints que ya existen, como Crear en el
  // alta: el PUT de los datos si cambiaron, y después quitar, modificar y
  // agregar productos. No es atómico: si algo falla a mitad, lo anterior
  // quedó guardado. Por eso, a medida que avanza, la ficha se queda con la
  // última respuesta del backend, y cada producto nuevo que se crea recibe
  // su id real en el borrador: volver a tocar Guardar sigue desde ahí, sin
  // duplicar nada.
  async function guardar() {
    setPreguntarSinProductos(false)
    setGuardando(true)

    // El estado de antes, para saber al final si el backend lo bajó solo.
    const estadoAntes = pedido.estado
    let actual = pedido
    let lineas = borrador.productos

    if (datosCambiaron(borrador, borradorDe(pedido))) {
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
        setAvance('Guardando datos…')
        actual = (await modificarPedido(id, datos)).data
      } catch (err) {
        setError(mensajeDeError(err))
        setGuardando(false)
        setAvance('')
        return
      }
    }

    const { quitados, modificados, nuevos } = cambiosEnProductos(pedido.productos, lineas)
    const total = quitados.length + modificados.length + nuevos.length
    let hechos = 0
    let enCurso = null

    function contar(linea) {
      enCurso = linea
      hechos += 1
      setAvance(`Guardando productos (${hechos} de ${total})…`)
    }

    try {
      for (const linea of quitados) {
        contar(linea)
        actual = (await quitarProductoDelPedido(id, linea.id)).data
      }

      for (const { linea, cambio } of modificados) {
        contar(linea)
        actual = (await modificarProductoDelPedido(id, linea.id, cambio)).data
      }

      for (const linea of nuevos) {
        contar(linea)
        const idsAntes = actual.productos.map((p) => p.id)
        actual = (await agregarProductoAlPedido(id, {
          producto: linea.producto,
          cantidad: linea.cantidad,
          precio: linea.precio,
          descripcion: linea.descripcion,
        })).data

        // La fila creada es la que no estaba antes. Su id real reemplaza al
        // provisorio en el borrador.
        const creada = actual.productos.find((p) => !idsAntes.includes(p.id))
        lineas = lineas.map((l) => (l.id === linea.id ? { ...l, id: creada.id } : l))

        // Una pieza nace Pendiente y la etapa no se puede mandar al crearla:
        // si se eligió otra, va con un PATCH, como en el alta.
        if (linea.estado !== 'PENDIENTE') {
          actual = (await modificarProductoDelPedido(id, creada.id, { estado: linea.estado })).data
        }
      }
    } catch (err) {
      setErrorProductos(
        `No se pudo guardar «${enCurso.producto_nombre}»: ${mensajeDeError(err)} ` +
          'Lo anterior quedó guardado.'
      )
      setPedido(actual)
      setBorrador({ ...borrador, productos: lineas })
      setGuardando(false)
      setAvance('')
      return
    }

    // Todo guardado: se vuelve al listado, que avisa con un modal. Si el
    // backend bajó el pedido a En producción (quedaron piezas sin
    // terminar), el modal lo dice, porque es un cambio que nadie pidió.
    // Sin bloqueo: ya no queda nada sin guardar.
    saltearBloqueo.current = true
    navegar(`${BASE_GESTION}/pedidos`, {
      state: {
        guardado: actual.id,
        bajoAProduccion: actual.estado === 'EN_PRODUCCION' && estadoAntes !== 'EN_PRODUCCION',
      },
    })
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!pedido) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el pedido.'}</p>
  }


  // Salir con cambios sin guardar pregunta: lo frena el bloqueo de arriba.
  // El aviso mientras se está en la ficha es el chip del breadcrumb.
  function volver() {
    navegar(`${BASE_GESTION}/pedidos`)
  }

  // Descartar repone el formulario, datos y productos, desde lo guardado.
  function descartar() {
    setError('')
    setErrorProductos('')
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
  const colorEstado = COLOR_ESTADO[pedido.estado]

  // El subtotal de la tabla sale del borrador, para que acompañe lo que se
  // ve. Es la misma suma que hace el backend con las filas.
  const subtotal = borrador.productos.reduce((suma, linea) => suma + Number(linea.subtotal), 0)

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

            {/* El estado se cambia desde el listado: acá solo se lee. */}
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
          </div>
        </div>
      </div>

      <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
        <PestanaDatos
          borrador={borrador}
          // Va aparte del borrador porque no se edita.
          fechaEntregaReal={pedido.fecha_entrega_real || ''}
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          clientes={clientes}
          error={error}
        />

        <PestanaProductos
          productos={borrador.productos}
          subtotal={subtotal}
          error={errorProductos}
          onAgregar={() => setModalProducto(true)}
          onEditar={(p) => setProductoEditando(p)}
          onCambiarEtapa={cambiarEtapa}
          onQuitar={quitarProducto}
        />

        {/* El pie del formulario, debajo de todo: un solo Guardar para los
            datos y los productos. Sin cambios los dos se apagan, con el
            motivo en el title, como todo botón apagado por una regla. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={descartar}
            disabled={!hayCambios || guardando}
            title={hayCambios ? undefined : 'No hay cambios que descartar'}
            style={{
              padding: '10px 18px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 6,
              cursor: hayCambios && !guardando ? 'pointer' : 'default',
              opacity: hayCambios && !guardando ? undefined : 0.5,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Descartar
          </button>

          <button
            onClick={pedirGuardar}
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
            {guardando ? avance || 'Guardando…' : 'Guardar'}
          </button>
        </div>
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

      {/* La navegación frenada espera acá: Cancelar la deja sin efecto y el
          router repone la dirección; "Salir sin guardar" la deja seguir. */}
      {bloqueo.state === 'blocked' && (
        <ModalConfirmar
          titulo="Salir sin guardar"
          texto="Se pierden los cambios que no guardaste. ¿Salir sin guardar?"
          textoAccion="Salir sin guardar"
          onCerrar={() => bloqueo.reset()}
          onConfirmar={() => bloqueo.proceed()}
        />
      )}

      {preguntarSinProductos && (
        <ModalConfirmar
          titulo="Guardar sin productos"
          texto="Este pedido va a quedar sin productos. ¿Guardar igual?"
          textoAccion="Guardar igual"
          onCerrar={() => setPreguntarSinProductos(false)}
          onConfirmar={guardar}
        />
      )}
    </div>
  )
}
