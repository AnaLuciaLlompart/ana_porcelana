import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { crearGasto, eliminarGasto, registrarMaterialDelGasto } from './api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

// El mismo import que cruza de funcionalidad en la ficha: la lista de
// materiales para el desplegable del modal.
import { listarMateriales } from '../materiales/api'

import BarraDePasos from '../../componentes/BarraDePasos'
import PieDelRecorrido from '../../componentes/PieDelRecorrido'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import DatosDelGasto from './DatosDelGasto'
import MaterialesDelGasto from './MaterialesDelGasto'
import ModalMaterial from './ModalMaterial'
import { ICONO_FLECHA, hoy, mensajeDeError } from './presentacion'


// Los dos pasos del alta. El segundo existe solo si el gasto es de
// materiales: con publicidad u otro no hay nada más que cargar, así que el
// paso 1 ya tiene "Crear gasto" y la barra no se dibuja.
const PASO_DATOS = { id: 'datos', label: 'Datos' }
const PASO_MATERIALES = { id: 'materiales', label: 'Materiales' }


// Con qué arranca el formulario en un alta: el tipo Materiales y la fecha de
// hoy, que es como nace un gasto en el diseño. Es una función y no una
// constante para que hoy() se calcule al abrir el alta, no al cargar la
// aplicación.
//
// La lista es lo que se junta en el paso Materiales hasta crear.
function borradorVacio() {
  return {
    tipo: 'MATERIALES',
    fecha: hoy(),
    monto: '',
    descripcion: '',
    materiales: [],
  }
}


// El monto del gasto que todavía no existe. Para materiales es la misma
// cuenta que _recalcular_monto en gastos/views.py: la suma de los subtotales
// de las filas. Para los otros tipos es lo que se escribió en el campo. La
// ficha no hace esta cuenta: muestra el monto que manda el backend.
function montoEnMemoria(borrador) {
  if (borrador.tipo !== 'MATERIALES') return Number(borrador.monto) || 0

  return borrador.materiales.reduce((suma, fila) => suma + fila.subtotal, 0)
}


// El alta de un gasto (CU52), por pasos. Todo se junta en memoria y el
// gasto se crea recién con el botón del último paso: un POST del gasto y,
// si es de materiales, uno por fila, con los endpoints de la ficha. Si uno
// falla, se borra el gasto y se vuelve al paso de la fila.
export default function AltaGasto() {
  const navegar = useNavigate()

  // El borrador vacío se guarda para medir si hay algo cargado: lleva el
  // tipo y la fecha de hoy, que no son valores vacíos.
  const [vacio] = useState(borradorVacio)
  const [borrador, setBorrador] = useState(vacio)
  const [paso, setPaso] = useState('datos')

  // Todos los materiales del sistema, para el desplegable del modal.
  const [materiales, setMateriales] = useState([])

  // null cuando está cerrado, 'nuevo' para agregar o la fila que se edita,
  // como en la ficha.
  const [modalMaterial, setModalMaterial] = useState(null)

  // Dos errores, como en la ficha: el del formulario de Datos y el de la
  // tabla de materiales, cada uno al lado de lo que lo provocó.
  const [error, setError] = useState('')
  const [errorMateriales, setErrorMateriales] = useState('')

  // Mientras se crea, el pie queda apagado y muestra el avance. Si falló una
  // fila y tampoco se pudo borrar el gasto, acá queda su id.
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')
  const [creadoAMedias, setCreadoAMedias] = useState(null)

  // Qué pregunta ModalConfirmar: null (cerrado), 'salir' (Cancelar o el
  // enlace de arriba con algo cargado) o 'sin_filas' (Crear gasto de
  // materiales sin ninguna fila).
  const [confirmacion, setConfirmacion] = useState(null)

  // Un id provisorio por fila, negativo para que no choque con los de la
  // base. Las filas lo usan de key.
  const proximoId = useRef(-1)

  useEffect(() => {
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [])

  // Hay algo cargado si el borrador difiere del vacío. Si el gasto quedó
  // creado a medias, ya no hay nada que perder al salir.
  const hayAlgo =
    creadoAMedias === null &&
    (borrador.tipo !== vacio.tipo ||
      borrador.fecha !== vacio.fecha ||
      borrador.monto !== '' ||
      borrador.descripcion !== '' ||
      borrador.materiales.length > 0)

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

  // Lo que el backend exige, lo mismo que revisa la ficha: el monto si el
  // gasto no es de materiales, y la fecha. Devuelve el mensaje del primero
  // que falte, o ''.
  function faltaEnDatos() {
    if (borrador.tipo !== 'MATERIALES' && !(Number(borrador.monto) > 0)) {
      return 'Ingresá el monto que pagaste para poder crear el gasto.'
    }
    if (!borrador.fecha) return 'La fecha del gasto es obligatoria.'
    return ''
  }

  // Para salir de Datos hacia adelante tiene que estar completo: así Crear
  // no falla por el paso 1 estando en el 2. Volver a Datos no revisa nada.
  function irAlPaso(nuevo) {
    if (paso === 'datos' && nuevo !== 'datos') {
      const falta = faltaEnDatos()
      if (falta) {
        setError(falta)
        return
      }
    }
    setError('')
    setErrorMateriales('')
    setPaso(nuevo)
  }

  // Cancelar y el enlace de arriba quieren decir "no lo crees". Con algo
  // cargado preguntan con el modal, porque se pierde; sin nada, salen.
  function salir() {
    if (hayAlgo) {
      setConfirmacion('salir')
      return
    }
    navegar(`${BASE_GESTION}/gastos`)
  }


  // Las acciones de la tabla escriben en el borrador. Las filas tienen la
  // misma forma que las que devuelve el backend, que es lo que la tabla sabe
  // dibujar: el modal manda material, cantidad y precio unitario, y el
  // nombre, el estado y la disponibilidad salen del material elegido.
  //
  // Las tres limpian el error de la tabla, como en la ficha: si quedó uno de
  // una fila rechazada, tocar las filas es corregirlo.
  function agregarFila(datos) {
    setModalMaterial(null)
    setErrorMateriales('')
    const material = materiales.find((m) => m.id === datos.material)
    const fila = {
      id: nuevoId(),
      material: datos.material,
      material_nombre: material.nombre,
      material_estado: material.estado,
      material_estado_display: material.estado_display,
      material_disponibilidad: material.disponibilidad,
      material_disponibilidad_display: material.disponibilidad_display,
      cantidad: datos.cantidad,
      precio_unitario: datos.precio_unitario,
      subtotal: datos.cantidad * Number(datos.precio_unitario),
    }
    setBorrador({ ...borrador, materiales: [...borrador.materiales, fila] })
  }

  // Al editar el modal manda solo cantidad y precio unitario, como a la API.
  function editarFila(fila, datos) {
    setModalMaterial(null)
    setErrorMateriales('')
    const editada = { ...fila, ...datos, subtotal: datos.cantidad * Number(datos.precio_unitario) }
    setBorrador({
      ...borrador,
      materiales: borrador.materiales.map((f) => (f.id === fila.id ? editada : f)),
    })
  }

  function quitarFila(fila) {
    setErrorMateriales('')
    setBorrador({ ...borrador, materiales: borrador.materiales.filter((f) => f.id !== fila.id) })
  }


  // El botón del último paso. Un gasto de materiales sin filas se puede
  // crear, pero nace en $0, así que antes se pregunta.
  function terminar() {
    if (borrador.tipo === 'MATERIALES' && borrador.materiales.length === 0) {
      setConfirmacion('sin_filas')
      return
    }
    crear()
  }

  // La cadena de creación. Se anota en qué paso está cada llamada para
  // volver ahí si falla.
  async function crear() {
    setConfirmacion(null)

    const falta = faltaEnDatos()
    if (falta) {
      setError(falta)
      setPaso('datos')
      return
    }

    setError('')
    setErrorMateriales('')
    setCreando(true)

    const esDeMateriales = borrador.tipo === 'MATERIALES'

    // Como en la ficha: en un gasto de materiales el monto NO viaja, lo
    // calcula el backend sumando las filas.
    const datos = {
      tipo: borrador.tipo,
      fecha: borrador.fecha,
      descripcion: borrador.descripcion.trim(),
    }
    if (!esDeMateriales) datos.monto = borrador.monto

    let id = null
    let enPaso = 'datos'

    try {
      setAvance('Creando…')
      const res = await crearGasto(datos)
      id = res.data.id

      if (esDeMateriales) {
        enPaso = 'materiales'
        let hechas = 0
        for (const fila of borrador.materiales) {
          hechas += 1
          setAvance(`Guardando materiales (${hechas} de ${borrador.materiales.length})…`)
          await registrarMaterialDelGasto(id, {
            material: fila.material,
            cantidad: fila.cantidad,
            precio_unitario: fila.precio_unitario,
          })
        }
      }

      // replace: el alta ya se consumió, y Atrás no tiene que volver a un
      // formulario lleno de lo que ya se creó.
      navegar(`${BASE_GESTION}/gastos/${id}`, { replace: true })
    } catch (err) {
      let mensaje = `No se pudo crear el gasto: ${mensajeDeError(err)}`

      // Deshacer: el DELETE borra en cascada las filas que se alcanzaron a
      // guardar. Si tampoco se puede, el gasto queda a medias y se dice.
      if (id !== null) {
        try {
          await eliminarGasto(id)
        } catch {
          setCreadoAMedias(id)
          mensaje =
            'No se pudo terminar de cargar el gasto y tampoco se pudo deshacer: ' +
            'quedó creado a medias. Revisalo desde el listado.'
        }
      }

      // El error va al lado de lo que falló: pegado a la tabla si fue una
      // fila, en el formulario si fue el gasto.
      if (enPaso === 'materiales') setErrorMateriales(mensaje)
      else setError(mensaje)
      setPaso(enPaso)
    } finally {
      setCreando(false)
      setAvance('')
    }
  }


  // Derivados, calculados en cada dibujo.

  const pasos = borrador.tipo === 'MATERIALES' ? [PASO_DATOS, PASO_MATERIALES] : [PASO_DATOS]

  const monto = montoEnMemoria(borrador)

  // Lo que la tabla lee del gasto: sus filas y su monto. Acá es el gasto en
  // memoria.
  const gastoEnMemoria = { materiales: borrador.materiales, monto }

  // Los materiales que se pueden agregar: los activos que todavía no están
  // en la lista, con el mismo criterio que la ficha.
  const cargados = borrador.materiales.map((fila) => fila.material)

  const disponibles = materiales.filter(
    (m) => m.estado === 'ACTIVO' && !cargados.includes(m.id)
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
          Gastos
        </button>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
        </svg>

        <span style={{ fontSize: 15, color: '#857078' }}>Nuevo gasto</span>
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
          Nuevo gasto
        </h1>

        <p style={{ margin: 0, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
          Cargá el monto que pagaste y, si compraste materiales, el detalle.
        </p>
      </div>

      {/* Con un solo paso la barra es ruido: aparece al elegir Materiales. */}
      {pasos.length > 1 && <BarraDePasos pasos={pasos} pasoActual={paso} conAnchoMaximo />}

      {paso === 'datos' && (
        <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
          <DatosDelGasto
            borrador={borrador}
            onCambiar={(cambio) => {
              setError('')
              setBorrador({ ...borrador, ...cambio })
            }}
            enRecorrido
            // Antes de crear el tipo es libre: el candado es para un gasto
            // guardado como de materiales.
            tipoBloqueado={false}
            montoCalculado={monto}
            error={error}
          />
        </div>
      )}

      {paso === 'materiales' && (
        <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
          {/* Sin onAlta ni onAltaTodos: la disponibilidad se marca desde la
              ficha, cuando el gasto ya existe. */}
          <MaterialesDelGasto
            gasto={gastoEnMemoria}
            quedanPorAgregar={disponibles.length > 0}
            error={errorMateriales}
            onAgregar={() => setModalMaterial('nuevo')}
            onEditar={(fila) => setModalMaterial(fila)}
            onQuitar={quitarFila}
          />
        </div>
      )}

      <PieDelRecorrido
        pasos={pasos}
        paso={paso}
        onIr={irAlPaso}
        onCancelar={salir}
        onTerminar={creadoAMedias ? () => navegar(`${BASE_GESTION}/gastos/${creadoAMedias}`) : terminar}
        textoTerminar={creadoAMedias ? 'Ir al gasto' : 'Crear gasto'}
        ocupado={creando}
        textoOcupado={avance}
      />

      {modalMaterial && (
        <ModalMaterial
          // 'nuevo' es agregar; cualquier otra cosa es la fila que se está
          // editando.
          fila={modalMaterial === 'nuevo' ? null : modalMaterial}
          materiales={disponibles}
          onCerrar={() => setModalMaterial(null)}
          // Con onGuardar el modal no llama a la API: los datos vienen acá y
          // se guardan en memoria.
          onGuardar={(datos) =>
            modalMaterial === 'nuevo' ? agregarFila(datos) : editarFila(modalMaterial, datos)
          }
        />
      )}

      {confirmacion === 'salir' && (
        <ModalConfirmar
          titulo="Salir sin crear"
          texto="Se pierde lo que cargaste. ¿Salir sin crear el gasto?"
          textoAccion="Salir sin crear"
          onCerrar={() => setConfirmacion(null)}
          onConfirmar={() => navegar(`${BASE_GESTION}/gastos`)}
        />
      )}

      {confirmacion === 'sin_filas' && (
        <ModalConfirmar
          titulo="Crear sin materiales"
          texto="Este gasto no tiene materiales cargados: se va a crear en $0. ¿Crear igual?"
          textoAccion="Crear igual"
          onCerrar={() => setConfirmacion(null)}
          onConfirmar={crear}
        />
      )}
    </div>
  )
}
