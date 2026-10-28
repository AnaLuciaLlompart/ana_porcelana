import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  crearPedido,
  eliminarPedido,
  agregarProductoAlPedido,
  modificarProductoDelPedido,
  registrarCobro,
} from './api'

// Los mismos imports que cruzan de funcionalidad en la ficha: los clientes
// para el desplegable y el catálogo para el modal de agregar.
import { listarClientes } from '../clientes/api'
import { listarProductos } from '../productos/api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

import BarraDePasos from '../../componentes/BarraDePasos'
import PieDelRecorrido from '../../componentes/PieDelRecorrido'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaProductos from './PestanaProductos'
import PestanaCobros from './PestanaCobros'
import ModalAgregarProducto from './ModalAgregarProducto'
import ModalEditarProductoDelPedido from './ModalEditarProductoDelPedido'
import ModalCobro from './ModalCobro'
import { ICONO_ALERTA, ICONO_FLECHA, MEDIOS, TIPOS_COBRO, hoy } from './presentacion'


// Los tres pasos del alta, con nombres cortos para la barra. Los id son los
// de las pestañas de la ficha.
const PASOS = [
  { id: 'datos', label: 'Datos' },
  { id: 'productos', label: 'Productos' },
  { id: 'cobros', label: 'Cobros' },
]


// Con qué arranca el formulario en un alta. Los dos valores que no están
// vacíos son los mismos con los que nace un pedido en el diseño: la fecha
// de hoy y el envío a cargo del cliente.
//
// Las dos listas son lo que se junta en los otros pasos hasta crear.
function borradorVacio() {
  return {
    cliente: '',
    fecha_pedido: hoy(),
    fecha_entrega_estimada: '',
    envio_a_cargo: 'CLIENTE',
    direccion_entrega: '',
    costo_entrega: '',
    productos: [],
    cobros: [],
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


// La etiqueta de un valor con choices, para armar los _display de un cobro
// en memoria como los que manda el backend.
function etiquetaDe(opciones, valor) {
  return opciones.find((op) => op.valor === valor).label
}


// Las mismas cuentas que hace Pedido en models.py (subtotal, costo de envío
// a cobrar, total, cobrado y saldo), para el pedido que todavía no existe.
// Es lo único de la ficha que acá se calcula en el navegador: antes de crear
// no hay backend que lo haga, y la pestaña Cobros y su modal las necesitan.
function pedidoEnMemoria(borrador) {
  const subtotal = borrador.productos.reduce((suma, linea) => suma + Number(linea.subtotal), 0)
  const costoEnvio =
    borrador.envio_a_cargo === 'MIO' && borrador.costo_entrega !== '' ? Number(borrador.costo_entrega) : 0
  const total = subtotal + costoEnvio
  const cobrado = borrador.cobros.reduce((suma, cobro) => suma + Number(cobro.monto), 0)

  return {
    envio_a_cargo: borrador.envio_a_cargo,
    costo_entrega: borrador.costo_entrega,
    subtotal,
    costo_envio_a_cobrar: costoEnvio,
    total,
    cobrado,
    saldo: total - cobrado,
    cantidad_productos: borrador.productos.length,
    productos: borrador.productos,
    cobros: borrador.cobros,
  }
}


// El alta de un pedido (CU40), por pasos. Todo se junta en memoria y el
// pedido se crea recién con el botón del último paso: un POST del pedido y
// después uno por producto y por cobro, con los endpoints de la ficha. Si
// uno falla, se borra el pedido y se vuelve al paso del ítem.
export default function AltaPedido() {
  const navegar = useNavigate()

  // El borrador vacío se guarda para medir si hay algo cargado: lleva la
  // fecha de hoy, que no es un valor vacío.
  const [vacio] = useState(borradorVacio)
  const [borrador, setBorrador] = useState(vacio)
  const [paso, setPaso] = useState('datos')

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)

  // null cuando está cerrado, 'nuevo' para registrar o el cobro que se
  // edita, como en la ficha.
  const [modalCobro, setModalCobro] = useState(null)

  // El error se muestra en el formulario de Datos, o en el cartel de arriba
  // de las pestañas en los otros dos pasos, como en la ficha.
  const [error, setError] = useState('')

  // Mientras se crea, el pie queda apagado y muestra el avance. Si falló un
  // ítem y tampoco se pudo borrar el pedido, acá queda su id.
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')
  const [creadoAMedias, setCreadoAMedias] = useState(null)

  // El modal de "¿Salir sin crear?". Se abre solo con algo cargado.
  const [modalSalir, setModalSalir] = useState(false)

  // Un id provisorio por ítem, negativo para que no choque con los de la
  // base. Las filas lo usan de key.
  const proximoId = useRef(-1)

  useEffect(() => {
    listarClientes().then((res) => setClientes(res.data)).catch(() => {})
    listarProductos().then((res) => setProductos(res.data)).catch(() => {})
  }, [])

  // Hay algo cargado si el borrador difiere del vacío. Si el pedido quedó
  // creado a medias, ya no hay nada que perder al salir.
  const hayAlgo =
    creadoAMedias === null &&
    (borrador.cliente !== vacio.cliente ||
      borrador.fecha_pedido !== vacio.fecha_pedido ||
      borrador.fecha_entrega_estimada !== vacio.fecha_entrega_estimada ||
      borrador.envio_a_cargo !== vacio.envio_a_cargo ||
      borrador.direccion_entrega !== vacio.direccion_entrega ||
      borrador.costo_entrega !== vacio.costo_entrega ||
      borrador.productos.length > 0 ||
      borrador.cobros.length > 0)

  // Recargar o cerrar la pestaña pierde todo, así que mientras haya algo
  // cargado (o se esté creando) el navegador pregunta antes, con su propio
  // cartel. Las salidas dentro de la aplicación no pasan por acá: ver
  // CLAUDE.md.
  useEffect(() => {
    if (!hayAlgo && !creando) return

    function avisar(evento) {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayAlgo, creando])


  function nuevoId() {
    const id = proximoId.current
    proximoId.current -= 1
    return id
  }

  // Los dos que el backend exige, los mismos que revisa la ficha. Devuelve
  // el mensaje del primero que falte, o ''.
  function faltaEnDatos() {
    if (!borrador.cliente) return 'Elegí el cliente del pedido para poder crearlo.'
    if (!borrador.fecha_pedido) return 'La fecha del pedido es obligatoria.'
    return ''
  }

  // Para salir de Datos hacia adelante tiene que estar completo: así Crear
  // no falla por el paso 1 estando en el 3. Volver a Datos no revisa nada.
  function irAlPaso(nuevo) {
    if (paso === 'datos' && nuevo !== 'datos') {
      const falta = faltaEnDatos()
      if (falta) {
        setError(falta)
        return
      }
    }
    setError('')
    setPaso(nuevo)
  }

  // Cancelar y el enlace de arriba quieren decir "no lo crees". Con algo
  // cargado preguntan con el modal, porque se pierde; sin nada, salen.
  function salir() {
    if (hayAlgo) {
      setModalSalir(true)
      return
    }
    navegar(`${BASE_GESTION}/pedidos`)
  }


  // Las acciones de las pestañas escriben en el borrador. Los ítems tienen
  // la misma forma que los que devuelve el backend, que es lo que las
  // pestañas saben dibujar.

  // El modal manda producto, cantidad, precio y descripcion; el nombre y si
  // tiene materiales salen del catálogo. Una pieza nueva nace Pendiente.
  function agregarProducto(datos) {
    setModalProducto(false)
    const delCatalogo = productos.find((p) => p.id === datos.producto)
    const linea = {
      id: nuevoId(),
      producto: datos.producto,
      producto_nombre: delCatalogo.nombre,
      producto_tiene_materiales: delCatalogo.cantidad_materiales > 0,
      precio: datos.precio,
      cantidad: datos.cantidad,
      subtotal: datos.cantidad * Number(datos.precio),
      descripcion: datos.descripcion,
      estado: 'PENDIENTE',
      fecha_cambio_estado: hoy(),
    }
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

  function quitarProducto(linea) {
    setBorrador({ ...borrador, productos: borrador.productos.filter((l) => l.id !== linea.id) })
  }

  // El mismo modal registra y edita: si trae un cobro, es una corrección.
  function guardarCobro(cobro, datos) {
    setModalCobro(null)
    const conEtiquetas = {
      ...datos,
      tipo_display: etiquetaDe(TIPOS_COBRO, datos.tipo),
      medio_display: etiquetaDe(MEDIOS, datos.medio),
    }

    if (cobro) {
      setBorrador({
        ...borrador,
        cobros: borrador.cobros.map((c) => (c.id === cobro.id ? { ...c, ...conEtiquetas } : c)),
      })
      return
    }

    setBorrador({ ...borrador, cobros: [...borrador.cobros, { id: nuevoId(), ...conEtiquetas }] })
  }

  function quitarCobro(cobro) {
    setBorrador({ ...borrador, cobros: borrador.cobros.filter((c) => c.id !== cobro.id) })
  }


  // La cadena de creación. Se anota en qué paso está cada llamada para
  // volver ahí si falla.
  async function crear() {
    const falta = faltaEnDatos()
    if (falta) {
      setError(falta)
      setPaso('datos')
      return
    }

    setError('')
    setCreando(true)

    // Como en la ficha: la entrega estimada y el costo viajan como null
    // cuando están vacíos, que es como los declara el modelo.
    const datos = {
      cliente: Number(borrador.cliente),
      fecha_pedido: borrador.fecha_pedido,
      fecha_entrega_estimada: borrador.fecha_entrega_estimada || null,
      envio_a_cargo: borrador.envio_a_cargo,
      direccion_entrega: borrador.direccion_entrega.trim(),
      costo_entrega: borrador.costo_entrega === '' ? null : borrador.costo_entrega,
    }

    let id = null
    let enPaso = 'datos'

    try {
      setAvance('Creando…')
      const res = await crearPedido(datos)
      id = res.data.id

      enPaso = 'productos'
      let hechos = 0
      for (const linea of borrador.productos) {
        hechos += 1
        setAvance(`Agregando productos (${hechos} de ${borrador.productos.length})…`)
        const respuesta = await agregarProductoAlPedido(id, {
          producto: linea.producto,
          cantidad: linea.cantidad,
          precio: linea.precio,
          descripcion: linea.descripcion,
        })

        // Una pieza nace Pendiente y la etapa no se puede mandar al crearla:
        // si acá se eligió otra, va con el PATCH que usa la ficha. La fila
        // recién creada es la de id más alto de la respuesta.
        if (linea.estado !== 'PENDIENTE') {
          const nueva = respuesta.data.productos.reduce((a, b) => (a.id > b.id ? a : b))
          await modificarProductoDelPedido(id, nueva.id, { estado: linea.estado })
        }
      }

      enPaso = 'cobros'
      hechos = 0
      for (const cobro of borrador.cobros) {
        hechos += 1
        setAvance(`Registrando cobros (${hechos} de ${borrador.cobros.length})…`)
        await registrarCobro(id, {
          tipo: cobro.tipo,
          monto: cobro.monto,
          fecha: cobro.fecha,
          medio: cobro.medio,
        })
      }

      // replace: el alta ya se consumió, y Atrás no tiene que volver a un
      // formulario lleno de lo que ya se creó.
      navegar(`${BASE_GESTION}/pedidos/${id}`, { replace: true })
    } catch (err) {
      let mensaje = `No se pudo crear el pedido: ${mensajeDeError(err)}`

      // Deshacer: el DELETE borra en cascada lo que se alcanzó a guardar. Si
      // tampoco se puede, el pedido queda a medias y se dice.
      if (id !== null) {
        try {
          await eliminarPedido(id)
        } catch {
          setCreadoAMedias(id)
          mensaje =
            'No se pudo terminar de cargar el pedido y tampoco se pudo deshacer: ' +
            'quedó creado a medias. Revisalo desde el listado.'
        }
      }

      setError(mensaje)
      setPaso(enPaso)
    } finally {
      setCreando(false)
      setAvance('')
    }
  }


  // Derivados, calculados en cada dibujo.
  const pedido = pedidoEnMemoria(borrador)

  // El cliente se lee del borrador, así la cabecera cambia apenas se elige
  // otro, como en la ficha.
  const clienteElegido = clientes.find((c) => String(c.id) === borrador.cliente)
  const subtitulo = clienteElegido
    ? `@${clienteElegido.instagram} · ${clienteElegido.nombre}`
    : 'Sin cliente'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <button
          onClick={salir}
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

        <span style={{ fontSize: 15, color: '#857078' }}>Nuevo pedido</span>
      </div>

      <div className="ancho-pantalla" style={{ marginBottom: 22, maxWidth: ANCHO_MAXIMO }}>
        <h1
          style={{
            margin: '0 0 8px',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 32,
            color: '#3D3238',
          }}
        >
          Nuevo pedido
        </h1>

        <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>{subtitulo}</p>
      </div>

      {/* Datos muestra su error adentro del formulario; este cartel es para
          los otros dos pasos, como en la ficha. */}
      {error && paso !== 'datos' && (
        <div
          className="ancho-pantalla"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            marginBottom: 20,
            maxWidth: ANCHO_MAXIMO,
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

      <BarraDePasos pasos={PASOS} pasoActual={paso} conAnchoMaximo />

      {paso === 'datos' && (
        <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
          <PestanaDatos
            borrador={borrador}
            // Un pedido no nace entregado.
            fechaEntregaReal=""
            onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
            esAlta
            enRecorrido
            clientes={clientes}
            error={error}
          />
        </div>
      )}

      {paso === 'productos' && (
        <PestanaProductos
          productos={borrador.productos}
          subtotal={pedido.subtotal}
          onAgregar={() => setModalProducto(true)}
          onEditar={(linea) => setProductoEditando(linea)}
          onCambiarEtapa={cambiarEtapa}
          onQuitar={quitarProducto}
        />
      )}

      {paso === 'cobros' && (
        <PestanaCobros
          pedido={pedido}
          onRegistrar={() => setModalCobro('nuevo')}
          onEditar={(cobro) => setModalCobro(cobro)}
          onQuitar={quitarCobro}
        />
      )}

      <PieDelRecorrido
        pasos={PASOS}
        paso={paso}
        onIr={irAlPaso}
        onCancelar={salir}
        onTerminar={creadoAMedias ? () => navegar(`${BASE_GESTION}/pedidos/${creadoAMedias}`) : crear}
        textoTerminar={creadoAMedias ? 'Ir al pedido' : 'Crear pedido'}
        ocupado={creando}
        textoOcupado={avance}
      />

      {modalProducto && (
        <ModalAgregarProducto
          // Solo los activos, como en la ficha.
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
          cobro={modalCobro === 'nuevo' ? null : modalCobro}
          saldo={pedido.saldo}
          hayCobros={borrador.cobros.length > 0}
          onCerrar={() => setModalCobro(null)}
          onGuardar={guardarCobro}
        />
      )}

      {modalSalir && (
        <ModalConfirmar
          titulo="Salir sin crear"
          texto="Se pierde lo que cargaste. ¿Salir sin crear el pedido?"
          textoAccion="Salir sin crear"
          onCerrar={() => setModalSalir(false)}
          onConfirmar={() => navegar(`${BASE_GESTION}/pedidos`)}
        />
      )}
    </div>
  )
}
