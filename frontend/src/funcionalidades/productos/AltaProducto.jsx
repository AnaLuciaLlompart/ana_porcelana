import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'

import {
  listarProductos,
  crearProducto,
  eliminarProducto,
  asignarMaterialAProducto,
  subirImagenDeProducto,
  asignarCategoriaAProducto,
} from './api'

// Los mismos imports que cruzan de funcionalidad en la ficha: las listas
// completas para elegir qué agregarle al producto.
import { listarCategorias } from '../categorias/api'
import { listarMateriales } from '../materiales/api'
import { BASE_GESTION } from '../../constantes'

import BarraDePasos from '../../componentes/BarraDePasos'
import PieDelRecorrido from '../../componentes/PieDelRecorrido'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaMateriales from './PestanaMateriales'
import PestanaImagenes from './PestanaImagenes'
import PestanaCategorias from './PestanaCategorias'
import ModalAgregarMaterial from './ModalAgregarMaterial'


const ICONO_FLECHA = 'M9 5l7 7-7 7'

// Los cuatro pasos del alta, en orden. Son las mismas pestañas de la ficha,
// con los mismos id.
const PASOS = [
  { id: 'datos', label: 'Datos' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'imagenes', label: 'Imágenes' },
  { id: 'categorias', label: 'Categorías' },
]

// Los dos grupos de fotos, en el orden en que se suben. Son los de
// PestanaImagenes.
const TIPOS_DE_IMAGEN = ['RESULTADO', 'REFERENCIA']


// Con qué arranca el formulario en un alta. Además de ser el punto de
// partida, es la línea de base contra la que se mide si hay algo escrito:
// en la edición se compara contra el producto cargado, acá contra esto.
//
// Las tres listas son lo que se junta en los otros pasos hasta crear.
const BORRADOR_VACIO = {
  nombre: '',
  descripcion: '',
  precio: '',
  dificultad: '',
  paso_a_paso: '',
  es_personalizado: false,
  materiales: [],
  imagenes: [],
  categorias: [],
}


// El backend contesta de dos formas según qué falló: las reglas de negocio
// mandan {'detail': '...'} y los errores de campo mandan
// {'imagen': ['La imagen pesa 20.0 MB...']}. La subida de fotos usa la
// segunda, así que hay que mirar las dos para no tragarse el mensaje.
function mensajeDeError(err) {
  const datos = err.response?.data
  if (!datos) return 'No se pudo completar la acción.'
  if (datos.detail) return datos.detail

  const primerCampo = Object.values(datos)[0]
  if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0]

  return 'No se pudo completar la acción.'
}


// El alta de un producto (CU17), por pasos. Todo se junta en memoria y el
// producto se crea recién con el botón del último paso: un POST del producto
// y después uno por material, foto y categoría, con los endpoints de la
// ficha. Si uno falla, se borra el producto y se vuelve al paso del ítem.
export default function AltaProducto() {
  const navegar = useNavigate()

  const [borrador, setBorrador] = useState(BORRADOR_VACIO)
  const [paso, setPaso] = useState('datos')

  const [categorias, setCategorias] = useState([])
  const [materiales, setMateriales] = useState([])
  const [modalMaterial, setModalMaterial] = useState(false)

  // Todos los productos, también los de baja, para avisar en Datos un
  // nombre que ya existe sin esperar a Crear.
  const [productos, setProductos] = useState([])

  // El error general se muestra en el formulario de Datos, o debajo de
  // Materiales y Categorías. El de las fotos guarda en qué grupo fue, como
  // en la ficha.
  const [error, setError] = useState('')
  const [errorImagen, setErrorImagen] = useState(null)

  // Mientras se crea, el pie queda apagado y muestra el avance. Si falló un
  // ítem y tampoco se pudo borrar el producto, acá queda su id.
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')
  const [creadoAMedias, setCreadoAMedias] = useState(null)

  // El modal de "Crear sin fotos": un producto sin fotos se puede crear,
  // pero antes se pregunta.
  const [modalSinFotos, setModalSinFotos] = useState(false)

  // Un id provisorio por ítem, negativo para que no choque con los de la
  // base. Las filas lo usan de key, y Fila y Tarjeta guardan estado por fila.
  const proximoId = useRef(-1)

  useEffect(() => {
    listarCategorias().then((res) => setCategorias(res.data)).catch(() => {})
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
    listarProductos().then((res) => setProductos(res.data)).catch(() => {})
  }, [])

  // Las miniaturas son URLs de objeto que retienen el archivo hasta que se
  // revocan. Al desmontar se revocan todas; al quitar una foto, la suya.
  const imagenesActuales = useRef([])
  useEffect(() => {
    imagenesActuales.current = borrador.imagenes
  }, [borrador.imagenes])
  useEffect(() => {
    return () => imagenesActuales.current.forEach((foto) => URL.revokeObjectURL(foto.imagen))
  }, [])

  // Hay algo cargado si el borrador difiere del vacío. Si el producto quedó
  // creado a medias, ya no hay nada que perder al salir.
  const hayAlgo =
    creadoAMedias === null &&
    (borrador.nombre !== '' ||
      borrador.descripcion !== '' ||
      borrador.precio !== '' ||
      borrador.dificultad !== '' ||
      borrador.paso_a_paso !== '' ||
      borrador.es_personalizado ||
      borrador.materiales.length > 0 ||
      borrador.imagenes.length > 0 ||
      borrador.categorias.length > 0)

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


  function nuevoId() {
    const id = proximoId.current
    proximoId.current -= 1
    return id
  }

  // Los tres que el backend exige y no tienen valor por defecto, los mismos
  // que revisa la ficha. Devuelve el mensaje del primero que falte, o ''.
  function faltaEnDatos() {
    if (!borrador.nombre.trim()) return 'Ponele un nombre al producto.'
    // Compara como el backend: sin los espacios de los extremos y
    // distinguiendo mayúsculas. Si la lista no cargó, avisa el backend al crear.
    if (productos.some((p) => p.nombre === borrador.nombre.trim())) {
      return 'Ya existe un producto con este nombre.'
    }
    if (!borrador.precio) return 'Ponele un precio al producto.'
    if (!borrador.dificultad) return 'Elegí la dificultad.'
    return ''
  }

  // Para salir de Datos hacia adelante tiene que estar completo: así Crear
  // no falla por el paso 1 estando en el 4. Volver a Datos no revisa nada.
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

  // Cancelar y el enlace de arriba quieren decir "no lo crees". Navegan al
  // listado, y el bloqueo de arriba es el que pregunta.
  function salir() {
    navegar(`${BASE_GESTION}/productos`)
  }

  // Con el producto creado a medias, el último botón lleva a su ficha: no
  // se sale sin crear, así que no se pregunta.
  function irAlCreado() {
    saltearBloqueo.current = true
    navegar(`${BASE_GESTION}/productos/${creadoAMedias}`)
  }


  // Las acciones de las pestañas escriben en el borrador. Los ítems tienen
  // la misma forma que los que devuelve el backend, que es lo que las
  // pestañas saben dibujar.

  function agregarMaterial(material) {
    setModalMaterial(false)
    const linea = {
      id: nuevoId(),
      material: material.id,
      material_nombre: material.nombre,
      material_estado: material.estado,
      material_estado_display: material.estado_display,
      cantidad: '',
    }
    setBorrador({ ...borrador, materiales: [...borrador.materiales, linea] })
  }

  function cambiarCantidad(linea, cantidad) {
    setBorrador({
      ...borrador,
      materiales: borrador.materiales.map((l) => (l.id === linea.id ? { ...l, cantidad } : l)),
    })
  }

  function quitarMaterial(linea) {
    setBorrador({ ...borrador, materiales: borrador.materiales.filter((l) => l.id !== linea.id) })
  }

  function agregarImagen(tipo, archivo) {
    setErrorImagen(null)
    const foto = { id: nuevoId(), archivo, imagen: URL.createObjectURL(archivo), titulo: '', tipo }
    setBorrador({ ...borrador, imagenes: [...borrador.imagenes, foto] })
  }

  // Mover una foto es cambiarla de lugar con su vecina en el arreglo. El
  // orden se manda recién al crear, como la posición dentro de su grupo.
  function intercambiarImagenes(a, b) {
    const lista = [...borrador.imagenes]
    const i = lista.findIndex((foto) => foto.id === a.id)
    const j = lista.findIndex((foto) => foto.id === b.id)
    lista[i] = b
    lista[j] = a
    setBorrador({ ...borrador, imagenes: lista })
  }

  function cambiarTitulo(imagen, titulo) {
    setBorrador({
      ...borrador,
      imagenes: borrador.imagenes.map((foto) => (foto.id === imagen.id ? { ...foto, titulo } : foto)),
    })
  }

  function quitarImagen(imagen) {
    URL.revokeObjectURL(imagen.imagen)
    setBorrador({ ...borrador, imagenes: borrador.imagenes.filter((foto) => foto.id !== imagen.id) })
  }

  function agregarCategoria(categoria) {
    setBorrador({ ...borrador, categorias: [...borrador.categorias, categoria] })
  }

  function quitarCategoria(categoria) {
    setBorrador({ ...borrador, categorias: borrador.categorias.filter((c) => c.id !== categoria.id) })
  }


  // El botón del último paso. Sin ninguna foto (de los dos grupos) se puede
  // crear, pero antes se pregunta: el catálogo lo mostraría sin imagen.
  function terminar() {
    if (borrador.imagenes.length === 0) {
      setModalSinFotos(true)
      return
    }
    crear()
  }

  // La cadena de creación. Se anota en qué paso está cada llamada para
  // volver ahí si falla; en las fotos, también el grupo.
  async function crear() {
    setModalSinFotos(false)

    const falta = faltaEnDatos()
    if (falta) {
      setError(falta)
      setPaso('datos')
      return
    }

    setError('')
    setErrorImagen(null)
    setCreando(true)

    const datos = {
      nombre: borrador.nombre.trim(),
      descripcion: borrador.descripcion.trim(),
      precio_actual: borrador.precio,
      dificultad: borrador.dificultad,
      paso_a_paso: borrador.paso_a_paso,
      es_personalizado: borrador.es_personalizado,
    }

    let id = null
    let enPaso = 'datos'
    let tipoDeFoto = null

    try {
      setAvance('Creando…')
      const res = await crearProducto(datos)
      id = res.data.id

      enPaso = 'materiales'
      let hechos = 0
      for (const linea of borrador.materiales) {
        hechos += 1
        setAvance(`Guardando materiales (${hechos} de ${borrador.materiales.length})…`)
        await asignarMaterialAProducto(id, linea.material, linea.cantidad)
      }

      // Cada grupo se numera por separado desde 0, que es como la ficha
      // muestra las fotos: en el orden del arreglo.
      enPaso = 'imagenes'
      hechos = 0
      for (const tipo of TIPOS_DE_IMAGEN) {
        const fotos = borrador.imagenes.filter((foto) => foto.tipo === tipo)
        for (const [orden, foto] of fotos.entries()) {
          hechos += 1
          tipoDeFoto = tipo
          setAvance(`Subiendo foto ${hechos} de ${borrador.imagenes.length}…`)
          const datosFoto = { imagen: foto.archivo, tipo, orden }
          if (foto.titulo) datosFoto.titulo = foto.titulo
          await subirImagenDeProducto(id, datosFoto)
        }
      }

      enPaso = 'categorias'
      setAvance('Guardando categorías…')
      for (const categoria of borrador.categorias) {
        await asignarCategoriaAProducto(id, categoria.id)
      }

      // replace: el alta ya se consumió, y Atrás no tiene que volver a un
      // formulario lleno de lo que ya se creó. Sin bloqueo: se vuelve al
      // listado, que muestra el aviso que le llega en el state.
      saltearBloqueo.current = true
      navegar(`${BASE_GESTION}/productos`, { replace: true, state: { creado: borrador.nombre.trim() } })
    } catch (err) {
      let mensaje = `No se pudo crear el producto: ${mensajeDeError(err)}`

      // Deshacer: el DELETE borra en cascada lo que se alcanzó a guardar. Si
      // tampoco se puede, el producto queda a medias y se dice.
      if (id !== null) {
        try {
          await eliminarProducto(id)
        } catch {
          setCreadoAMedias(id)
          mensaje =
            'No se pudo terminar de cargar el producto y tampoco se pudo deshacer: ' +
            'quedó creado a medias. Revisalo desde el listado.'
        }
      }

      if (enPaso === 'imagenes') setErrorImagen({ tipo: tipoDeFoto, mensaje })
      else setError(mensaje)
      setPaso(enPaso)
    } finally {
      setCreando(false)
      setAvance('')
    }
  }


  // Derivados, calculados en cada dibujo, como en la ficha.
  const idsAsignados = borrador.categorias.map((c) => c.id)
  const categoriasDisponibles = categorias.filter(
    (c) => c.estado === 'ACTIVO' && !idsAsignados.includes(c.id)
  )

  const idsMateriales = borrador.materiales.map((l) => l.material)
  const materialesDisponibles = materiales.filter(
    (m) => m.estado === 'ACTIVO' && !idsMateriales.includes(m.id)
  )

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
          Productos
        </button>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
        </svg>

        <span style={{ fontSize: 15, color: '#857078' }}>Nuevo producto</span>
      </div>

      <h1
        style={{
          margin: '0 0 22px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 32,
          color: '#3D3238',
        }}
      >
        Nuevo producto
      </h1>

      <BarraDePasos pasos={PASOS} pasoActual={paso} />

      {paso === 'datos' && (
        <PestanaDatos
          borrador={borrador}
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          error={error}
        />
      )}

      {paso === 'materiales' && (
        <PestanaMateriales
          lineas={borrador.materiales}
          onAgregar={() => setModalMaterial(true)}
          onGuardarCantidad={cambiarCantidad}
          onQuitar={quitarMaterial}
        />
      )}

      {paso === 'imagenes' && (
        <PestanaImagenes
          imagenes={borrador.imagenes}
          error={errorImagen}
          onError={(tipo, mensaje) => setErrorImagen({ tipo, mensaje })}
          onSubirArchivo={agregarImagen}
          onIntercambiar={intercambiarImagenes}
          onGuardarTitulo={cambiarTitulo}
          onBorrar={quitarImagen}
        />
      )}

      {paso === 'categorias' && (
        <PestanaCategorias
          asignadas={borrador.categorias}
          disponibles={categoriasDisponibles}
          onAsignar={agregarCategoria}
          onQuitar={quitarCategoria}
        />
      )}

      {/* Datos muestra su error adentro del formulario e Imágenes arriba
          del grupo que falló; este es para los otros dos pasos. */}
      {error && (paso === 'materiales' || paso === 'categorias') && (
        <p role="alert" style={{ marginTop: 16, color: '#C0442F', fontSize: 14 }}>
          {error}
        </p>
      )}

      <PieDelRecorrido
        pasos={PASOS}
        paso={paso}
        onIr={irAlPaso}
        onCancelar={salir}
        onTerminar={creadoAMedias ? irAlCreado : terminar}
        textoTerminar={creadoAMedias ? 'Ir al producto' : 'Crear producto'}
        ocupado={creando}
        textoOcupado={avance}
      />

      {modalMaterial && (
        <ModalAgregarMaterial
          materiales={materialesDisponibles}
          onCerrar={() => setModalMaterial(false)}
          onElegir={agregarMaterial}
        />
      )}

      {modalSinFotos && (
        <ModalConfirmar
          titulo="Crear sin fotos"
          texto="Este producto no tiene fotos. ¿Crear igual?"
          textoAccion="Crear igual"
          onCerrar={() => setModalSinFotos(false)}
          onConfirmar={crear}
        />
      )}

      {/* La navegación frenada espera acá: Cancelar la deja sin efecto y el
          router repone la dirección; "Salir sin crear" la deja seguir. */}
      {bloqueo.state === 'blocked' && (
        <ModalConfirmar
          titulo="Salir sin crear"
          texto={hayAlgo ? 'Se pierde lo que cargaste. ¿Salir sin crear el producto?' : '¿Salir sin crear el producto?'}
          textoAccion="Salir sin crear"
          onCerrar={() => bloqueo.reset()}
          onConfirmar={() => bloqueo.proceed()}
        />
      )}
    </div>
  )
}
