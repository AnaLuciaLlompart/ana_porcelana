import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'

import { crearGasto } from './api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

// El mismo import que cruza de funcionalidad en la ficha: la lista de
// materiales para el desplegable del modal.
import { listarMateriales } from '../materiales/api'

import ModalConfirmar from '../../componentes/ModalConfirmar'

import DatosDelGasto from './DatosDelGasto'
import MaterialesDelGasto from './MaterialesDelGasto'
import ModalActualizarDisponibilidad from './ModalActualizarDisponibilidad'
import ModalMaterial from './ModalMaterial'
import {
  ICONO_FLECHA,
  filaEnMemoria,
  hoy,
  mensajeDeError,
  montoEnMemoria,
  sePuedePasarAAlta,
} from './presentacion'


// Con qué arranca el formulario en un alta: el tipo Materiales y la fecha de
// hoy, que es como nace un gasto en el diseño. Es una función y no una
// constante para que hoy() se calcule al abrir el alta, no al cargar la
// aplicación.
//
// La lista es lo que se junta en la tabla de materiales hasta crear.
function borradorVacio() {
  return {
    tipo: 'MATERIALES',
    fecha: hoy(),
    monto: '',
    descripcion: '',
    materiales: [],
  }
}


// El alta de un gasto (CU52). Es la misma pantalla que la ficha, con los
// datos y los materiales en un solo formulario, y se crea recién al tocar
// "Crear gasto": un solo POST con los datos y, si es de materiales, las
// filas adentro, que el backend guarda en una transacción. Si algo falla,
// no queda nada creado y todo sigue cargado para corregir.
export default function AltaGasto() {
  const navegar = useNavigate()

  // El borrador vacío se guarda para medir si hay algo cargado: lleva el
  // tipo y la fecha de hoy, que no son valores vacíos.
  const [vacio] = useState(borradorVacio)
  const [borrador, setBorrador] = useState(vacio)

  // Todos los materiales del sistema, para el desplegable del modal.
  const [materiales, setMateriales] = useState([])

  // null cuando está cerrado, 'nuevo' para agregar o la fila que se edita,
  // como en la ficha.
  const [modalMaterial, setModalMaterial] = useState(null)

  // Dos errores, como en la ficha: el del formulario de Datos y el de la
  // tabla de materiales, cada uno al lado de lo que lo provocó.
  const [error, setError] = useState('')
  const [errorMateriales, setErrorMateriales] = useState('')

  // Mientras se crea, el pie queda apagado y muestra el avance.
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')

  // El modal de "Crear sin materiales": un gasto de materiales sin filas se
  // puede crear, pero antes se pregunta. La pregunta de salir no va acá: la
  // hace el bloqueo de navegación de abajo.
  const [modalSinFilas, setModalSinFilas] = useState(false)

  // La pregunta de la disponibilidad: si entre los materiales cargados hay
  // alguno activo en Media o Baja, "Crear gasto" pregunta si pasarlos a Alta
  // antes de crear (pedido de la usuaria, para no tener que acordarse).
  const [preguntarDisponibilidad, setPreguntarDisponibilidad] = useState(false)

  // Un id provisorio por fila, negativo para que no choque con los de la
  // base. Las filas lo usan de key.
  const proximoId = useRef(-1)

  useEffect(() => {
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [])

  // Hay algo cargado si el borrador difiere del vacío.
  const hayAlgo =
    borrador.tipo !== vacio.tipo ||
    borrador.fecha !== vacio.fecha ||
    borrador.monto !== '' ||
    borrador.descripcion !== '' ||
    borrador.materiales.length > 0

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

  // Cancelar y el enlace de arriba quieren decir "no lo crees". Navegan al
  // listado, y el bloqueo de arriba es el que pregunta.
  function salir() {
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
    const fila = filaEnMemoria(nuevoId(), datos, material)
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


  // "Crear gasto": primero revisa los datos. Un gasto de materiales sin
  // filas se puede crear, pero nace en $0, así que antes se pregunta. Con
  // filas, si alguna es de un material que puede pasar a disponibilidad
  // Alta, se pregunta eso; si no, se crea directo.
  function terminar() {
    setErrorMateriales('')

    const falta = faltaEnDatos()
    if (falta) {
      setError(falta)
      return
    }
    setError('')

    if (borrador.tipo === 'MATERIALES' && borrador.materiales.length === 0) {
      setModalSinFilas(true)
      return
    }
    if (borrador.tipo === 'MATERIALES' && borrador.materiales.some(sePuedePasarAAlta)) {
      setPreguntarDisponibilidad(true)
      return
    }
    crear()
  }

  // Un solo POST con los datos y, si es de materiales, las filas adentro: el
  // backend lo guarda todo en una transacción, así que si algo falla no
  // queda nada creado. Si el error viene con la clave 'materiales', fue una
  // fila y va pegado a la tabla; si no, fue el gasto y va en los datos.
  //
  // idsAAlta son las filas que se tildaron en la pregunta de la
  // disponibilidad: viajan con pasar_a_alta y el backend las pasa a Alta en
  // la misma transacción.
  async function crear(idsAAlta = []) {
    setModalSinFilas(false)
    setPreguntarDisponibilidad(false)
    setCreando(true)

    const esDeMateriales = borrador.tipo === 'MATERIALES'

    // Como en la ficha: en un gasto de materiales el monto NO viaja, lo
    // calcula el backend sumando las filas, que van en el mismo cuerpo.
    const datos = {
      tipo: borrador.tipo,
      fecha: borrador.fecha,
      descripcion: borrador.descripcion.trim(),
    }
    if (esDeMateriales) {
      datos.materiales = borrador.materiales.map((fila) => ({
        material: fila.material,
        cantidad: fila.cantidad,
        precio_unitario: fila.precio_unitario,
        pasar_a_alta: idsAAlta.includes(fila.id),
      }))
    } else {
      datos.monto = borrador.monto
    }

    try {
      setAvance('Creando gasto…')
      const res = await crearGasto(datos)

      // replace: el alta ya se consumió, y Atrás no tiene que volver a un
      // formulario lleno de lo que ya se creó. Sin bloqueo: se vuelve al
      // listado, que muestra el aviso que le llega en el state, como en
      // pedidos, y cuenta los materiales que el backend pasó a Alta de verdad.
      saltearBloqueo.current = true
      navegar(`${BASE_GESTION}/gastos`, {
        replace: true,
        state: { creado: res.data.id, pasaronAAlta: res.data.materiales_cambiados?.length || 0 },
      })
    } catch (err) {
      const mensaje = `No se pudo crear el gasto: ${mensajeDeError(err)}`

      if (err.response?.data?.materiales) setErrorMateriales(mensaje)
      else setError(mensaje)
    } finally {
      setCreando(false)
      setAvance('')
    }
  }


  // Derivados, calculados en cada dibujo.

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

      <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
        <DatosDelGasto
          borrador={borrador}
          onCambiar={(cambio) => {
            setError('')
            setBorrador({ ...borrador, ...cambio })
          }}
          // Antes de crear el tipo es libre: el candado es para un gasto
          // guardado como de materiales.
          tipoBloqueado={false}
          montoCalculado={monto}
          error={error}
        />

        {/* La tabla aparece con el tipo Materiales, como en la ficha. Sin
            onAlta ni onAltaTodos: en el alta la disponibilidad no se marca
            en la tabla, la pregunta aparece al tocar "Crear gasto". */}
        {borrador.tipo === 'MATERIALES' && (
          <MaterialesDelGasto
            gasto={gastoEnMemoria}
            quedanPorAgregar={disponibles.length > 0}
            error={errorMateriales}
            onAgregar={() => setModalMaterial('nuevo')}
            onEditar={(fila) => setModalMaterial(fila)}
            onQuitar={quitarFila}
          />
        )}

        {/* El pie del formulario, como el de la ficha pero para crear:
            Cancelar quiere decir "no lo crees", y el bloqueo pregunta. */}
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
            onClick={terminar}
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
            {creando ? avance : 'Crear gasto'}
          </button>
        </div>
      </div>

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

      {/* La navegación frenada espera acá: Cancelar la deja sin efecto y el
          router repone la dirección; "Salir sin crear" la deja seguir. */}
      {bloqueo.state === 'blocked' && (
        <ModalConfirmar
          titulo="Salir sin crear"
          texto={hayAlgo ? 'Se pierde lo que cargaste. ¿Salir sin crear el gasto?' : '¿Salir sin crear el gasto?'}
          textoAccion="Salir sin crear"
          onCerrar={() => bloqueo.reset()}
          onConfirmar={() => bloqueo.proceed()}
        />
      )}

      {modalSinFilas && (
        <ModalConfirmar
          titulo="Crear sin materiales"
          texto="Este gasto no tiene materiales cargados: se va a crear en $0. ¿Crear igual?"
          textoAccion="Crear igual"
          onCerrar={() => setModalSinFilas(false)}
          onConfirmar={() => crear()}
        />
      )}

      {/* Solo las filas que pueden pasar a Alta: las de un material activo
          que está en Media o Baja. */}
      {preguntarDisponibilidad && (
        <ModalActualizarDisponibilidad
          filas={borrador.materiales.filter(sePuedePasarAAlta)}
          onCerrar={() => setPreguntarDisponibilidad(false)}
          onOmitir={() => crear()}
          onGuardar={(ids) => crear(ids)}
        />
      )}
    </div>
  )
}
