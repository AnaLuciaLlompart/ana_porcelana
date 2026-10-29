import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'

import {
  crearPedido,
  eliminarPedido,
  agregarProductoAlPedido,
  modificarProductoDelPedido,
} from './api'

// Los mismos imports que cruzan de funcionalidad en la ficha: los clientes
// para el desplegable y el catálogo para el modal de agregar.
import { listarClientes } from '../clientes/api'
import { listarProductos } from '../productos/api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaProductos from './PestanaProductos'
import ModalAgregarProducto from './ModalAgregarProducto'
import ModalEditarProductoDelPedido from './ModalEditarProductoDelPedido'
import {
  ICONO_FLECHA,
  datosDeEntrega,
  faltaFormaEntrega,
  hoy,
  lineaEnMemoria,
} from './presentacion'


// Con qué arranca el formulario en un alta: la fecha de hoy, que es como
// nace un pedido en el diseño, y todo lo demás vacío.
function borradorVacio() {
  return {
    cliente: '',
    fecha_pedido: hoy(),
    fecha_entrega_estimada: '',
    // Sin elegir: con tres formas, cualquiera de entrada sería un dato que
    // se puede guardar sin haberlo pensado. Crear la pide.
    forma_entrega: '',
    direccion_entrega: '',
    costo_entrega: '',
    productos: [],
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


// El alta de un pedido (CU40). Es la misma pantalla que la ficha, con los
// datos y los productos en un solo formulario, y se crea recién al tocar
// "Crear pedido": un POST del pedido y después uno por producto, con los
// endpoints de la ficha. Si uno falla, se borra el pedido y queda todo
// cargado para corregir. Los cobros no van acá: se registran después, desde
// el listado.
export default function AltaPedido() {
  const navegar = useNavigate()

  // El borrador vacío se guarda para medir si hay algo cargado: lleva la
  // fecha de hoy, que no es un valor vacío.
  const [vacio] = useState(borradorVacio)
  const [borrador, setBorrador] = useState(vacio)

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)

  // Dos errores, como en la ficha: el de los datos va en su tarjeta, y el de
  // un producto, pegado a la tabla.
  const [error, setError] = useState('')
  const [errorProductos, setErrorProductos] = useState('')

  // Mientras se crea, el pie queda apagado y muestra el avance. Si falló un
  // producto y tampoco se pudo borrar el pedido, acá queda su id.
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')
  const [creadoAMedias, setCreadoAMedias] = useState(null)

  // El modal de "Crear sin productos": un pedido sin productos se puede
  // crear, pero antes se pregunta.
  const [modalSinProductos, setModalSinProductos] = useState(false)

  // Un id provisorio por producto, negativo para que no choque con los de la
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
      borrador.forma_entrega !== vacio.forma_entrega ||
      borrador.direccion_entrega !== vacio.direccion_entrega ||
      borrador.costo_entrega !== vacio.costo_entrega ||
      borrador.productos.length > 0)

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

  // Mientras el alta no haya creado el registro, cualquier navegación que
  // salga de esta pantalla se frena y pregunta: Cancelar, el breadcrumb, el
  // menú lateral y el Atrás del navegador pasan todos por acá. Después de
  // crear, la navegación al listado no tiene que preguntar, y la del
  // cierre de sesión tampoco: la sesión ya no está.
  const saltearBloqueo = useRef(false)
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !saltearBloqueo.current &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname !== `${BASE_GESTION}/login`
  )


  // Los dos que el backend exige, los mismos que revisa la ficha, y la forma
  // de entrega. Devuelve el mensaje del primero que falte, o ''.
  function faltaEnDatos() {
    if (!borrador.cliente) return 'Elegí el cliente del pedido para poder crearlo.'
    if (!borrador.fecha_pedido) return 'La fecha del pedido es obligatoria.'
    // La forma de entrega no la exige el backend, que tiene un valor por
    // defecto: la pide el alta, que arranca sin elegir.
    return faltaFormaEntrega(borrador.forma_entrega)
  }

  // Cancelar y el enlace de arriba quieren decir "no lo crees". Navegan al
  // listado, y el bloqueo de arriba es el que pregunta.
  function salir() {
    navegar(`${BASE_GESTION}/pedidos`)
  }

  // Con el pedido creado a medias, el botón principal lleva a su ficha: no
  // se sale sin crear, así que no se pregunta.
  function irAlCreado() {
    saltearBloqueo.current = true
    navegar(`${BASE_GESTION}/pedidos/${creadoAMedias}`)
  }


  // Las acciones de la tabla escriben en el borrador, como en la ficha. La
  // pieza nueva la arma lineaEnMemoria, compartida con la ficha.

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

  function quitarProducto(linea) {
    setBorrador({ ...borrador, productos: borrador.productos.filter((l) => l.id !== linea.id) })
  }


  // "Crear pedido": primero revisa los datos y, si no hay productos,
  // pregunta antes. Un pedido sin productos se puede crear, pero no se puede
  // cobrar.
  function terminar() {
    setErrorProductos('')

    const falta = faltaEnDatos()
    if (falta) {
      setError(falta)
      return
    }
    setError('')

    if (borrador.productos.length === 0) {
      setModalSinProductos(true)
      return
    }
    crear()
  }

  // La cadena de creación. Si falla el POST del pedido, el error va en los
  // datos; si falla un producto, pegado a la tabla.
  async function crear() {
    setModalSinProductos(false)
    setCreando(true)

    // Como en la ficha: la entrega estimada y el costo viajan como null
    // cuando están vacíos, que es como los declara el modelo.
    const datos = {
      cliente: Number(borrador.cliente),
      fecha_pedido: borrador.fecha_pedido,
      fecha_entrega_estimada: borrador.fecha_entrega_estimada || null,
      ...datosDeEntrega(borrador),
    }

    let id = null

    try {
      setAvance('Creando…')
      const res = await crearPedido(datos)
      id = res.data.id

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

      // replace: el alta ya se consumió, y Atrás no tiene que volver a un
      // formulario lleno de lo que ya se creó. Sin bloqueo: se vuelve al
      // listado, que muestra el aviso que le llega en el state.
      saltearBloqueo.current = true
      navegar(`${BASE_GESTION}/pedidos`, { replace: true, state: { creado: id } })
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

      // Sin id falló el pedido mismo: el error es de los datos.
      if (id === null) setError(mensaje)
      else setErrorProductos(mensaje)
    } finally {
      setCreando(false)
      setAvance('')
    }
  }


  // Derivados, calculados en cada dibujo.

  // El cliente se lee del borrador, así la cabecera cambia apenas se elige
  // otro, como en la ficha.
  const clienteElegido = clientes.find((c) => String(c.id) === borrador.cliente)
  const subtitulo = clienteElegido
    ? `@${clienteElegido.instagram} · ${clienteElegido.nombre}`
    : 'Sin cliente'

  // La misma suma que hace el backend con las filas.
  const subtotal = borrador.productos.reduce((suma, linea) => suma + Number(linea.subtotal), 0)

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

      <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
        <PestanaDatos
          borrador={borrador}
          // Un pedido no nace entregado.
          fechaEntregaReal=""
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          clientes={clientes}
          error={error}
        />

        <PestanaProductos
          productos={borrador.productos}
          subtotal={subtotal}
          error={errorProductos}
          onAgregar={() => setModalProducto(true)}
          onEditar={(linea) => setProductoEditando(linea)}
          onCambiarEtapa={cambiarEtapa}
          onQuitar={quitarProducto}
        />

        {/* El pie del formulario, como el de la ficha pero para crear:
            Cancelar quiere decir "no lo crees", y el bloqueo pregunta. Con
            el pedido creado a medias, el botón principal lleva a su ficha. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={salir}
            disabled={creando}
            style={{
              padding: '10px 18px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 6,
              cursor: creando ? 'default' : 'pointer',
              opacity: creando ? 0.5 : undefined,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Cancelar
          </button>

          <button
            onClick={creadoAMedias ? irAlCreado : terminar}
            disabled={creando}
            style={{
              padding: '10px 20px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: creando ? 'default' : 'pointer',
              opacity: creando ? 0.7 : undefined,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {creando ? avance : creadoAMedias ? 'Ir al pedido' : 'Crear pedido'}
          </button>
        </div>
      </div>

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

      {modalSinProductos && (
        <ModalConfirmar
          titulo="Crear sin productos"
          texto="Este pedido no tiene productos cargados. ¿Crear igual?"
          textoAccion="Crear igual"
          onCerrar={() => setModalSinProductos(false)}
          onConfirmar={crear}
        />
      )}

      {/* La navegación frenada espera acá: Cancelar la deja sin efecto y el
          router repone la dirección; "Salir sin crear" la deja seguir. */}
      {bloqueo.state === 'blocked' && (
        <ModalConfirmar
          titulo="Salir sin crear"
          texto={hayAlgo ? 'Se pierde lo que cargaste. ¿Salir sin crear el pedido?' : '¿Salir sin crear el pedido?'}
          textoAccion="Salir sin crear"
          onCerrar={() => bloqueo.reset()}
          onConfirmar={() => bloqueo.proceed()}
        />
      )}
    </div>
  )
}
