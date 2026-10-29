import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import {
  obtenerGasto,
  modificarGasto,
  registrarMaterialDelGasto,
  modificarMaterialDelGasto,
  quitarMaterialDelGasto,
  marcarDisponibilidadAlta,
} from './api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. La lista de materiales es
// para el desplegable del modal.
import { listarMateriales } from '../materiales/api'

import ChipCambiosSinGuardar from '../../componentes/ChipCambiosSinGuardar'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import DatosDelGasto from './DatosDelGasto'
import MaterialesDelGasto from './MaterialesDelGasto'
import ModalMaterial from './ModalMaterial'
import {
  ICONO_FLECHA,
  filaEnMemoria,
  fmtFechaLarga,
  mensajeDeError,
  montoEnMemoria,
} from './presentacion'


// Los campos que edita el formulario, y las filas de materiales.
//
// El monto va en pesos enteros, como los demás importes del sistema. En un
// gasto de MATERIALES queda vacío a propósito: ahí el monto no se edita ni
// se manda, lo calcula el backend sumando los materiales del gasto. La
// ficha lo muestra con montoEnMemoria, la misma cuenta sobre el borrador.
function borradorDe(gasto) {
  return {
    tipo: gasto.tipo,
    fecha: gasto.fecha,
    monto: gasto.tipo === 'MATERIALES' ? '' : String(Math.round(Number(gasto.monto))),
    descripcion: gasto.descripcion,
    materiales: gasto.materiales,
  }
}

// Si algún dato del formulario difiere de lo guardado. Las filas van
// aparte, en cambiosEnFilas.
function datosCambiaron(borrador, original) {
  return (
    borrador.tipo !== original.tipo ||
    borrador.fecha !== original.fecha ||
    borrador.monto !== original.monto ||
    borrador.descripcion !== original.descripcion
  )
}

// Lo que hay que mandar para que lo guardado quede como el borrador: las
// filas que se quitaron, las que cambiaron (solo cantidad y precio unitario,
// que es lo que se puede modificar), las nuevas, que son las de id
// provisorio negativo, y las marcadas para pasar a disponibilidad Alta.
function cambiosEnFilas(guardadas, enBorrador) {
  const idsEnBorrador = enBorrador.map((fila) => fila.id)
  const quitadas = guardadas.filter((g) => !idsEnBorrador.includes(g.id))
  const nuevas = enBorrador.filter((fila) => fila.id < 0)
  const aAlta = enBorrador.filter((fila) => fila.pasar_a_alta)

  const modificadas = []
  for (const fila of enBorrador) {
    const guardada = guardadas.find((g) => g.id === fila.id)
    if (!guardada) continue

    // El precio llega del backend con decimales ("800.00") y del modal sin
    // ellos ("800"): se comparan como números.
    if (
      fila.cantidad !== guardada.cantidad ||
      Number(fila.precio_unitario) !== Number(guardada.precio_unitario)
    ) {
      modificadas.push(fila)
    }
  }

  return { quitadas, modificadas, nuevas, aAlta }
}


// La ficha de un gasto que ya existe (/gastos/:id). El alta vive aparte, en
// AltaGasto: junta todo en memoria y lo crea al final.
//
// Es un solo formulario, como la ficha de pedido: los datos, las filas de
// materiales y las marcas de disponibilidad Alta se editan en el borrador y
// se guardan juntos con Guardar, que al terminar vuelve al listado con un
// modal de aviso.
export default function DetalleGasto() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [gasto, setGasto] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Dos errores y no uno, por lo mismo que en la ficha de Pedidos: cada uno
  // se muestra al lado de lo que lo provocó. 'error' es el del formulario de
  // datos; 'errorMateriales', el de guardar una fila de la tabla.
  const [error, setError] = useState('')
  const [errorMateriales, setErrorMateriales] = useState('')

  // El borrador vive acá, en la ficha. Es lo que se edita y lo que viaja al
  // guardar; el gasto es lo último que confirmó el backend.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [avance, setAvance] = useState('')

  // Todos los materiales del sistema, para el desplegable del modal.
  const [materiales, setMateriales] = useState([])

  // null cuando está cerrado. Abierto guarda o bien la fila que se está
  // editando, o bien la cadena 'nuevo' para agregar: el mismo truco que el
  // modal de cobros.
  const [modalMaterial, setModalMaterial] = useState(null)

  // Guardar un gasto de materiales que va a quedar sin filas se puede, pero
  // antes se pregunta con el modal.
  const [preguntarSinMateriales, setPreguntarSinMateriales] = useState(false)

  // Los ids provisorios de las filas nuevas: negativos, para que nunca
  // choquen con uno real.
  const proximoId = useRef(-1)

  useEffect(() => {
    obtenerGasto(id)
      .then((res) => {
        setGasto(res.data)
        setBorrador(borradorDe(res.data))
      })
      .catch(() => setError('No se pudo cargar el gasto.'))
      .finally(() => setCargando(false))

    // Si falla, la ficha igual sirve: lo único que queda sin poder hacerse
    // es agregar materiales.
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [id])


  // Hay cambios si algún dato difiere de lo guardado, si hay filas
  // quitadas, modificadas o nuevas, o si alguna está marcada para pasar a
  // Alta. Se calcula antes de los return de la carga porque lo usan los dos
  // avisos de salir, que son hooks y tienen que correr siempre.
  //
  // Las filas cuentan solo si el borrador es de materiales: si se cargaron
  // y después se cambió el tipo, quedan en memoria pero no viajan.
  const cambios =
    gasto && borrador && borrador.tipo === 'MATERIALES'
      ? cambiosEnFilas(gasto.materiales, borrador.materiales)
      : { quitadas: [], modificadas: [], nuevas: [], aAlta: [] }
  const hayCambios =
    gasto !== null &&
    borrador !== null &&
    (datosCambiaron(borrador, borradorDe(gasto)) ||
      cambios.quitadas.length + cambios.modificadas.length + cambios.nuevas.length > 0 ||
      cambios.aAlta.length > 0)

  // Con cambios sin guardar, recargar, cerrar la pestaña o escribir otra
  // dirección muestra el cartel del navegador, como en las altas.
  useEffect(() => {
    if (!hayCambios) return

    function avisar(evento) {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  // Y cualquier navegación dentro de la aplicación se frena y pregunta, con
  // el mismo bloqueo de las altas, solo si hay cambios. Después de guardar
  // no se frena, y la del cierre de sesión tampoco.
  const saltearBloqueo = useRef(false)
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      !saltearBloqueo.current &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname !== `${BASE_GESTION}/login`
  )


  // -------------------------------------------------------------------
  // Las filas de materiales (CU56 a CU59), en el borrador
  // -------------------------------------------------------------------
  // Como en el alta, nada viaja hasta Guardar. Las tres limpian el error de
  // la tabla: si quedó uno de una fila rechazada, tocar las filas es
  // corregirlo.

  function agregarFila(datos) {
    setModalMaterial(null)
    setErrorMateriales('')
    const material = materiales.find((m) => m.id === datos.material)
    const fila = filaEnMemoria(proximoId.current, datos, material)
    proximoId.current -= 1
    setBorrador({ ...borrador, materiales: [...borrador.materiales, fila] })
  }

  function cambiarFila(fila, cambio) {
    setErrorMateriales('')
    setBorrador({
      ...borrador,
      materiales: borrador.materiales.map((f) => (f.id === fila.id ? { ...f, ...cambio } : f)),
    })
  }

  // Al editar el modal manda solo cantidad y precio unitario, como a la API.
  function editarFila(fila, datos) {
    setModalMaterial(null)
    cambiarFila(fila, { ...datos, subtotal: datos.cantidad * Number(datos.precio_unitario) })
  }

  // Quitar no pregunta: la pregunta, si el gasto queda sin materiales, está
  // al guardar.
  function quitarFila(fila) {
    setErrorMateriales('')
    setBorrador({ ...borrador, materiales: borrador.materiales.filter((f) => f.id !== fila.id) })
  }

  // Disponibilidad Alta (parte de CU58): marcar no escribe nada todavía.
  // La fila queda con pasar_a_alta y se aplica al guardar, después de las
  // filas, con el endpoint de siempre. Tocar de nuevo la desmarca.
  function alternarAlta(fila) {
    cambiarFila(fila, { pasar_a_alta: !fila.pasar_a_alta })
  }

  // Marca todas las que se pueden: las de un material activo que no está en
  // Alta, la misma condición que aplica el backend.
  function marcarTodasEnAlta() {
    setBorrador({
      ...borrador,
      materiales: borrador.materiales.map((f) =>
        f.material_estado === 'ACTIVO' && f.material_disponibilidad !== 'ALTA'
          ? { ...f, pasar_a_alta: true }
          : f
      ),
    })
  }


  // -------------------------------------------------------------------
  // Guardar (CU54, y CU56 a CU59 para las filas)
  // -------------------------------------------------------------------

  // Primero revisa los datos y, si el gasto de materiales va a quedar sin
  // filas, pregunta.
  function pedirGuardar() {
    setError('')
    setErrorMateriales('')

    const esDeMateriales = borrador.tipo === 'MATERIALES'

    // Se muestra el primero que falte: es un formulario corto y una lista de
    // errores sería más ruido que ayuda. El backend valida lo mismo; acá se
    // avisa antes para no hacer un viaje que ya se sabe que falla.
    if (!esDeMateriales && !(Number(borrador.monto) > 0)) {
      setError('El monto del gasto tiene que ser mayor a cero.')
      return
    }
    if (!borrador.fecha) {
      setError('La fecha del gasto es obligatoria.')
      return
    }

    if (esDeMateriales && borrador.materiales.length === 0 && gasto.materiales.length > 0) {
      setPreguntarSinMateriales(true)
      return
    }

    guardar()
  }

  // Guardar es una cadena de los endpoints que ya existen, como Crear en el
  // alta: el PUT de los datos si cambiaron, después quitar, modificar y
  // agregar filas, y al final pasar a Alta las marcadas. No es atómico: si
  // algo falla a mitad, lo anterior quedó guardado. Por eso, a medida que
  // avanza, la ficha se queda con la última respuesta del backend, y cada
  // fila nueva que se crea recibe su id real en el borrador: volver a tocar
  // Guardar sigue desde ahí, sin duplicar nada.
  async function guardar() {
    setPreguntarSinMateriales(false)
    setGuardando(true)

    let actual = gasto
    let filas = borrador.materiales

    if (datosCambiaron(borrador, borradorDe(gasto))) {
      const datos = {
        tipo: borrador.tipo,
        fecha: borrador.fecha,
        descripcion: borrador.descripcion.trim(),
      }

      // En un gasto de materiales el monto NO viaja: lo calcula el backend, y
      // si fuera en el cuerpo lo ignoraría.
      if (borrador.tipo !== 'MATERIALES') datos.monto = borrador.monto

      try {
        setAvance('Guardando datos…')
        actual = (await modificarGasto(id, datos)).data
      } catch (err) {
        setError(mensajeDeError(err))
        setGuardando(false)
        setAvance('')
        return
      }
    }

    // Con publicidad u otro no hay filas que mandar: el tipo de un gasto de
    // materiales no se puede cambiar, así que no puede haber filas guardadas.
    const esDeMateriales = borrador.tipo === 'MATERIALES'
    const { quitadas, modificadas, nuevas } = esDeMateriales
      ? cambiosEnFilas(gasto.materiales, filas)
      : { quitadas: [], modificadas: [], nuevas: [] }

    const total = quitadas.length + modificadas.length + nuevas.length
    let hechos = 0
    let enCurso = null
    let pasaronAAlta = 0

    try {
      for (const fila of quitadas) {
        enCurso = fila
        hechos += 1
        setAvance(`Guardando materiales (${hechos} de ${total})…`)
        actual = (await quitarMaterialDelGasto(id, fila.id)).data
      }

      for (const fila of modificadas) {
        enCurso = fila
        hechos += 1
        setAvance(`Guardando materiales (${hechos} de ${total})…`)
        actual = (await modificarMaterialDelGasto(id, fila.id, {
          cantidad: fila.cantidad,
          precio_unitario: fila.precio_unitario,
        })).data
      }

      for (const fila of nuevas) {
        enCurso = fila
        hechos += 1
        setAvance(`Guardando materiales (${hechos} de ${total})…`)
        const idsAntes = actual.materiales.map((f) => f.id)
        actual = (await registrarMaterialDelGasto(id, {
          material: fila.material,
          cantidad: fila.cantidad,
          precio_unitario: fila.precio_unitario,
        })).data

        // La fila creada es la que no estaba antes. Su id real reemplaza al
        // provisorio en el borrador.
        const creada = actual.materiales.find((f) => !idsAntes.includes(f.id))
        filas = filas.map((f) => (f.id === fila.id ? { ...f, id: creada.id } : f))
      }

      // Al final, las marcadas para pasar a Alta, de a una y con su id ya
      // real. La respuesta dice cuántos materiales cambiaron de verdad.
      if (esDeMateriales) {
        for (const fila of filas.filter((f) => f.pasar_a_alta)) {
          enCurso = fila
          setAvance('Pasando materiales a disponibilidad Alta…')
          const respuesta = (await marcarDisponibilidadAlta(id, fila.id)).data
          actual = respuesta.gasto
          pasaronAAlta += respuesta.materiales_cambiados.length
          filas = filas.map((f) =>
            f.id === fila.id
              ? { ...f, pasar_a_alta: false, material_disponibilidad: 'ALTA', material_disponibilidad_display: 'Alta' }
              : f
          )
        }
      }
    } catch (err) {
      setErrorMateriales(
        `No se pudo guardar «${enCurso.material_nombre}»: ${mensajeDeError(err)} ` +
          'Lo anterior quedó guardado.'
      )
      setGasto(actual)
      setBorrador({ ...borrador, materiales: filas })
      setGuardando(false)
      setAvance('')
      return
    }

    // Todo guardado: se vuelve al listado, que avisa con un modal y dice
    // cuántos materiales pasaron a Alta. Sin bloqueo: ya no queda nada sin
    // guardar.
    saltearBloqueo.current = true
    navegar(`${BASE_GESTION}/gastos`, {
      state: { guardado: actual.id, pasaronAAlta },
    })
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!gasto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el gasto.'}</p>
  }


  // Salir con cambios sin guardar pregunta: lo frena el bloqueo de arriba.
  // El aviso mientras se está en la ficha es el chip del breadcrumb.
  function volver() {
    navegar(`${BASE_GESTION}/gastos`)
  }

  // Descartar repone el formulario, datos y filas, desde el gasto guardado.
  function descartar() {
    setError('')
    setErrorMateriales('')
    setBorrador(borradorDe(gasto))
  }


  // Derivados, calculados en cada render.

  const titulo = `Gasto #${gasto.id}`

  // El subtítulo de un gasto que ya existe se lee del gasto GUARDADO y no
  // del borrador, para poder usar el tipo_display que manda el backend.
  const subtitulo = `${gasto.tipo_display} · ${fmtFechaLarga(gasto.fecha)}`

  // Un gasto guardado como de materiales no puede cambiar de tipo: el
  // backend lo rechaza. Se mira el gasto guardado, no el borrador.
  const tipoBloqueado = gasto.tipo === 'MATERIALES'

  // La tabla aparece cuando el BORRADOR es de materiales: un gasto de
  // publicidad que se pasa a materiales ya puede cargar sus filas, y se
  // guardan todas juntas.
  const esDeMateriales = borrador.tipo === 'MATERIALES'

  // El monto se calcula sobre el borrador, como en el alta, para que
  // acompañe lo que se ve. Al guardar lo vuelve a calcular el backend.
  const monto = montoEnMemoria(borrador)

  // Los materiales que se pueden agregar: los activos que todavía no están
  // en este gasto. El backend permitiría uno discontinuado, pero no tiene
  // sentido ofrecer para una compra nueva algo que ya no se usa; y uno
  // repetido lo rechaza, porque cada material va una sola vez por gasto.
  const cargados = borrador.materiales.map((fila) => fila.material)

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

        {hayCambios && <ChipCambiosSinGuardar />}
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
          {titulo}
        </h1>

        <p style={{ margin: 0, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>{subtitulo}</p>
      </div>

      <div className="ancho-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: ANCHO_MAXIMO }}>
        <DatosDelGasto
          borrador={borrador}
          onCambiar={(cambio) => {
            setError('')
            setBorrador({ ...borrador, ...cambio })
          }}
          tipoBloqueado={tipoBloqueado}
          montoCalculado={monto}
          error={error}
        />

        {esDeMateriales && (
          <MaterialesDelGasto
            gasto={{ ...gasto, monto, materiales: borrador.materiales }}
            quedanPorAgregar={disponibles.length > 0}
            error={errorMateriales}
            onAgregar={() => setModalMaterial('nuevo')}
            onEditar={(fila) => setModalMaterial(fila)}
            onQuitar={quitarFila}
            onAlta={alternarAlta}
            onAltaTodos={marcarTodasEnAlta}
          />
        )}

        {/* El pie del formulario, debajo de todo: un solo Guardar para los
            datos, las filas y las marcas de Alta. Sin cambios los dos se
            apagan, con el motivo en el title. */}
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

      {modalMaterial && (
        <ModalMaterial
          // 'nuevo' es agregar; cualquier otra cosa es la fila que se está
          // editando.
          fila={modalMaterial === 'nuevo' ? null : modalMaterial}
          materiales={disponibles}
          onCerrar={() => setModalMaterial(null)}
          onGuardar={(datos) =>
            modalMaterial === 'nuevo' ? agregarFila(datos) : editarFila(modalMaterial, datos)
          }
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

      {preguntarSinMateriales && (
        <ModalConfirmar
          titulo="Guardar sin materiales"
          texto="Este gasto va a quedar sin materiales: el monto queda en $0. ¿Guardar igual?"
          textoAccion="Guardar igual"
          onCerrar={() => setPreguntarSinMateriales(false)}
          onConfirmar={guardar}
        />
      )}
    </div>
  )
}
