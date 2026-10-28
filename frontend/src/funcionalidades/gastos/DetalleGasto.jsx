import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerGasto,
  modificarGasto,
  quitarMaterialDelGasto,
  marcarDisponibilidadAlta,
  marcarTodosDisponibilidadAlta,
} from './api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

// Imports que cruzan de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. listarMateriales es para el
// desplegable del modal, y cambiarDisponibilidad para deshacer el "marcar en
// disponibilidad Alta": los dos son operaciones sobre materiales, no sobre
// gastos.
import { cambiarDisponibilidad, listarMateriales } from '../materiales/api'

import Toast from '../../componentes/Toast'
import ChipCambiosSinGuardar from '../../componentes/ChipCambiosSinGuardar'

import DatosDelGasto from './DatosDelGasto'
import MaterialesDelGasto from './MaterialesDelGasto'
import ModalMaterial from './ModalMaterial'
import ModalEliminarGasto from './ModalEliminarGasto'
import {
  ICONO_BORRAR,
  ICONO_FLECHA,
  fmtFechaLarga,
  mensajeDeError,
} from './presentacion'


// Los campos que edita el formulario.
//
// El monto va en pesos enteros, como los demás importes del sistema. En un
// gasto de MATERIALES queda vacío a propósito: ahí el monto no se edita ni
// se manda, lo calcula el backend sumando los materiales del gasto. La
// ficha lo muestra leyéndolo del gasto, no del borrador.
function borradorDe(gasto) {
  return {
    tipo: gasto.tipo,
    fecha: gasto.fecha,
    monto: gasto.tipo === 'MATERIALES' ? '' : String(Math.round(Number(gasto.monto))),
    descripcion: gasto.descripcion,
  }
}


// La ficha de un gasto que ya existe (/gastos/:id). El alta vive aparte, en
// AltaGasto: junta todo en memoria y lo crea al final.
export default function DetalleGasto() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [gasto, setGasto] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Dos errores y no uno, por lo mismo que en la ficha de Pedidos: cada uno
  // se muestra al lado de lo que lo provocó. 'error' es el del formulario de
  // datos; 'errorMateriales', el de las operaciones sobre la tabla.
  const [error, setError] = useState('')
  const [errorMateriales, setErrorMateriales] = useState('')

  // El borrador de los datos vive acá, en la ficha. Es lo que se edita y lo
  // que viaja al guardar; el gasto es lo último que confirmó el backend.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Todos los materiales del sistema, para el desplegable del modal.
  const [materiales, setMateriales] = useState([])

  // null cuando está cerrado. Abierto guarda o bien la fila que se está
  // editando, o bien la cadena 'nuevo' para agregar: el mismo truco que el
  // modal de cobros.
  const [modalMaterial, setModalMaterial] = useState(null)
  const [modalEliminar, setModalEliminar] = useState(false)

  const [toast, setToast] = useState('')
  const [hayDeshacer, setHayDeshacer] = useState(false)
  const temporizador = useRef(null)

  // Los materiales que cambió el último "marcar en Alta", con la
  // disponibilidad que tenía cada uno. Va en un ref y no en estado porque no
  // se dibuja: solo se usa si ella toca Deshacer.
  const cambiados = useRef([])

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


  // conDeshacer decide las dos cosas que distinguen a ese aviso: que lleve
  // el botón, y que dure 6 segundos en vez de 2,6. Dura más porque es el
  // único aviso con algo para hacer, y hay que llegar a leerlo y decidir.
  function mostrarToast(texto, conDeshacer = false) {
    setToast(texto)
    setHayDeshacer(conDeshacer)

    // Se cancela el anterior: si no, al hacer dos acciones seguidas el
    // temporizador de la primera apaga el cartel de la segunda antes de
    // tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      setToast('')
      setHayDeshacer(false)
    }, conDeshacer ? 6000 : 2600)
  }


  // -------------------------------------------------------------------
  // Los datos del gasto (CU52 y CU54)
  // -------------------------------------------------------------------

  async function guardarDatos() {
    setError('')

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

    setGuardando(true)

    const datos = {
      tipo: borrador.tipo,
      fecha: borrador.fecha,
      descripcion: borrador.descripcion.trim(),
    }

    // En un gasto de materiales el monto NO viaja: lo calcula el backend, y
    // si fuera en el cuerpo lo ignoraría.
    if (!esDeMateriales) datos.monto = borrador.monto

    try {
      const res = await modificarGasto(id, datos)
      setGasto(res.data)
      setBorrador(borradorDe(res.data))
      mostrarToast('Cambios guardados')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }


  // -------------------------------------------------------------------
  // Los materiales del gasto (CU56 a CU59)
  // -------------------------------------------------------------------
  // Las operaciones sobre la tabla son inmediatas, como las de los productos
  // del pedido: quitar un material es un hecho consumado, no un campo que se
  // está editando, así que no esperan al botón de guardar.
  //
  // Todas devuelven el gasto completo ya recalculado por el backend, así que
  // se usa esa respuesta en vez de volver a pedir el gasto: es un viaje
  // menos, y la tabla y el monto se acomodan de una sola vez.

  // Devuelve lo que respondió el backend, o null si falló.
  async function accionSobreMateriales(llamada) {
    // Se limpian los dos carteles: si no, quedaría colgado un error viejo
    // hablando de algo que ya pasó.
    setError('')
    setErrorMateriales('')

    try {
      const res = await llamada()
      return res.data
    } catch (err) {
      setErrorMateriales(mensajeDeError(err))
      return null
    }
  }

  async function quitarMaterial(fila) {
    // Sin modal de confirmación y sin aviso flotante: la fila desaparece de
    // la tabla y el monto baja, que ya es confirmación suficiente.
    const actualizado = await accionSobreMateriales(() => quitarMaterialDelGasto(id, fila.id))

    if (actualizado) setGasto(actualizado)
  }

  // Lo que sigue a marcar en Alta, sea una fila o todas: las dos llamadas
  // responden con la misma forma, { materiales_cambiados, gasto }.
  function aplicarDisponibilidadAlta(respuesta) {
    if (!respuesta) return

    setGasto(respuesta.gasto)

    const lista = respuesta.materiales_cambiados

    // Si no cambió ninguno no hay nada que avisar ni que deshacer.
    if (lista.length === 0) return

    cambiados.current = lista

    mostrarToast(
      lista.length === 1
        ? `«${lista[0].nombre}» pasó a disponibilidad Alta`
        : `${lista.length} materiales pasaron a disponibilidad Alta`,
      true
    )
  }

  async function marcarEnAlta(fila) {
    aplicarDisponibilidadAlta(
      await accionSobreMateriales(() => marcarDisponibilidadAlta(id, fila.id))
    )
  }

  async function marcarTodosEnAlta() {
    aplicarDisponibilidadAlta(
      await accionSobreMateriales(() => marcarTodosDisponibilidadAlta(id))
    )
  }

  // Deshacer no tiene endpoint propio: a cada material que cambió se le
  // devuelve la disponibilidad que tenía, con el PATCH de materiales.
  async function deshacer() {
    clearTimeout(temporizador.current)
    setToast('')
    setHayDeshacer(false)
    setErrorMateriales('')

    try {
      // De a uno y en orden, con un for común: son dos o tres materiales y
      // así se lee de corrido qué se le manda a cada uno.
      for (const material of cambiados.current) {
        await cambiarDisponibilidad(material.id, material.disponibilidad_anterior)
      }

      // Acá SÍ se vuelve a pedir el gasto. cambiarDisponibilidad responde
      // con el material, no con el gasto, así que es la única forma de que
      // la tabla muestre la disponibilidad restaurada.
      const res = await obtenerGasto(id)
      setGasto(res.data)
    } catch (err) {
      setErrorMateriales(mensajeDeError(err))
    }

    cambiados.current = []
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!gasto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el gasto.'}</p>
  }


  // Salir descarta lo escrito sin preguntar, igual que en las otras fichas.
  // El aviso mientras se está en la ficha es el chip del breadcrumb.
  function volver() {
    navegar(`${BASE_GESTION}/gastos`)
  }

  // Descartar repone el formulario desde el gasto guardado.
  function descartar() {
    setError('')
    setBorrador(borradorDe(gasto))
  }


  // Derivados, calculados en cada render.

  const titulo = `Gasto #${gasto.id}`

  // El subtítulo de un gasto que ya existe se lee del gasto GUARDADO y no
  // del borrador, para poder usar el tipo_display que manda el backend.
  const subtitulo = `${gasto.tipo_display} · ${fmtFechaLarga(gasto.fecha)}`

  // Si el gasto guardado ya es de materiales. De esto dependen tres cosas:
  // que el tipo quede bloqueado, que aparezca la tabla, y que haya un monto
  // calculado para mostrar.
  const yaEsDeMateriales = gasto.tipo === 'MATERIALES'

  // El monto de un gasto de materiales es el que manda el backend, tal cual.
  // Hay un solo caso donde todavía no hay ninguno que mostrar: cuando se
  // eligió Materiales pero el gasto no se guardó así todavía (un gasto de
  // publicidad que se está pasando a materiales). Ahí va $0, que es
  // lo que el backend va a escribir al guardar, porque no hay materiales que
  // sumar. No es una cuenta del navegador.
  const montoCalculado = yaEsDeMateriales ? gasto.monto : 0

  // Hay cambios si algún campo del borrador difiere de lo guardado.
  const original = borradorDe(gasto)

  const hayCambios =
    borrador.tipo !== original.tipo ||
    borrador.fecha !== original.fecha ||
    borrador.monto !== original.monto ||
    borrador.descripcion !== original.descripcion

  // La línea gris de abajo del formulario, para cuando se eligió Materiales
  // pero la tabla todavía no puede aparecer porque el gasto no está guardado
  // así.
  const avisoMateriales =
    borrador.tipo === 'MATERIALES' && !yaEsDeMateriales
      ? 'Guardá el cambio de tipo para poder cargarle los materiales.'
      : ''

  // Los materiales que se pueden agregar: los activos que todavía no están
  // en este gasto. El backend permitiría uno discontinuado, pero no tiene
  // sentido ofrecer para una compra nueva algo que ya no se usa; y uno
  // repetido lo rechaza, porque cada material va una sola vez por gasto.
  const cargados = yaEsDeMateriales ? gasto.materiales.map((fila) => fila.material) : []

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
          hayCambios={hayCambios}
          tipoBloqueado={yaEsDeMateriales}
          montoCalculado={montoCalculado}
          guardando={guardando}
          error={error}
          onGuardar={guardarDatos}
          // Descartar vuelve el borrador a lo guardado y se queda en la ficha.
          onCancelar={descartar}
        />

        {avisoMateriales && (
          <p style={{ margin: '-8px 0 0', fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            {avisoMateriales}
          </p>
        )}

        {/* Los materiales cuelgan de un gasto que ya existe y que es de
            materiales: hasta entonces no hay de dónde colgarlos. */}
        {yaEsDeMateriales && (
          <MaterialesDelGasto
            gasto={gasto}
            quedanPorAgregar={disponibles.length > 0}
            error={errorMateriales}
            onAgregar={() => setModalMaterial('nuevo')}
            onEditar={(fila) => setModalMaterial(fila)}
            onQuitar={quitarMaterial}
            onAlta={marcarEnAlta}
            onAltaTodos={marcarTodosEnAlta}
          />
        )}

        {/* Eliminar va fuera de las tarjetas, como en el diseño. */}
        <div>
          <button
            onClick={() => setModalEliminar(true)}
            className="btn-eliminar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#C0442F',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_BORRAR} />
            </svg>
            Eliminar gasto
          </button>
        </div>
      </div>

      {modalMaterial && (
        <ModalMaterial
          gastoId={gasto.id}
          // 'nuevo' es agregar; cualquier otra cosa es la fila que se está
          // editando.
          fila={modalMaterial === 'nuevo' ? null : modalMaterial}
          materiales={disponibles}
          onCerrar={() => setModalMaterial(null)}
          // El modal ya habló con el backend: acá llega el gasto completo
          // actualizado, y alcanza con reemplazarlo.
          onGuardado={(actualizado) => {
            const editando = modalMaterial !== 'nuevo'

            setGasto(actualizado)
            setModalMaterial(null)
            setErrorMateriales('')
            mostrarToast(editando ? 'Material actualizado' : 'Material agregado')
          }}
        />
      )}

      {modalEliminar && (
        <ModalEliminarGasto
          gasto={gasto}
          onCerrar={() => setModalEliminar(false)}
          // Al borrarlo se vuelve al listado: la ficha quedaría mostrando
          // algo que ya no existe.
          onEliminado={() => navegar(`${BASE_GESTION}/gastos`)}
        />
      )}

      {toast && (
        <Toast
          texto={toast}
          accion={hayDeshacer ? 'Deshacer' : undefined}
          onAccion={deshacer}
        />
      )}
    </div>
  )
}
