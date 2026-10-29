import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import {
  obtenerProducto,
  modificarProducto,
  asignarMaterialAProducto,
  modificarCantidadDeMaterial,
  quitarMaterialDeProducto,
  asignarCategoriaAProducto,
  quitarCategoriaDeProducto,
  subirImagenDeProducto,
  modificarImagenDeProducto,
  borrarImagenDeProducto,
} from './api'

// Tercer import que cruza de funcionalidad, con el mismo criterio de
// siempre: el endpoint pertenece a esa app y ahí se queda. Acá hacen falta
// las listas completas para elegir qué agregarle al producto.
import { listarCategorias } from '../categorias/api'
import { listarMateriales } from '../materiales/api'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'

import ChipCambiosSinGuardar from '../../componentes/ChipCambiosSinGuardar'
import ModalConfirmar from '../../componentes/ModalConfirmar'

import PestanaDatos from './PestanaDatos'
import PestanaMateriales from './PestanaMateriales'
import PestanaCategorias from './PestanaCategorias'
import PestanaImagenes from './PestanaImagenes'
import ModalAgregarMaterial from './ModalAgregarMaterial'
import {
  CHEVRON_ABAJO,
  CHEVRON_DERECHA,
  COLOR_DIFICULTAD,
  ICONO_IMAGEN,
  avisoMateriales,
  estadoCatalogoFicha,
  formatearPrecio,
  motivoFuera,
  textoDificultad,
} from './presentacion'


const ICONO_FLECHA = 'M9 5l7 7-7 7'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'

// Los dos grupos de fotos, en el orden en que se guardan.
const TIPOS_DE_IMAGEN = ['RESULTADO', 'REFERENCIA']

// Con qué secciones arranca abierto el acordeón: Datos, que es lo que más se
// edita; las otras tres muestran su resumen en el encabezado.
const ABIERTAS_AL_ENTRAR = { datos: true, materiales: false, imagenes: false, categorias: false }


// Los campos del formulario de Datos y las tres listas. El precio va como
// texto porque el input es de texto; se convierte al guardar. Las listas
// tienen la forma que manda el backend, que es la que las secciones saben
// dibujar; las fotos ya vienen en su orden.
function borradorDe(producto) {
  return {
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: String(Math.round(Number(producto.precio_actual))),
    dificultad: producto.dificultad,
    paso_a_paso: producto.paso_a_paso,
    es_personalizado: producto.es_personalizado,
    materiales: producto.materiales_usados,
    imagenes: producto.imagenes,
    categorias: producto.categorias,
  }
}

// Si algún campo de Datos difiere de lo guardado.
function datosCambiaron(borrador, original) {
  return (
    borrador.nombre !== original.nombre ||
    borrador.descripcion !== original.descripcion ||
    borrador.precio !== original.precio ||
    borrador.dificultad !== original.dificultad ||
    borrador.paso_a_paso !== original.paso_a_paso ||
    borrador.es_personalizado !== original.es_personalizado
  )
}

// Lo que hay que mandar para que los materiales guardados queden como los
// del borrador: los quitados, los de cantidad cambiada y los nuevos, que son
// los de id provisorio negativo.
function cambiosEnMateriales(guardados, enBorrador) {
  const ids = enBorrador.map((linea) => linea.id)
  return {
    quitados: guardados.filter((g) => !ids.includes(g.id)),
    modificados: enBorrador.filter((linea) => {
      const guardada = guardados.find((g) => g.id === linea.id)
      return guardada && guardada.cantidad !== linea.cantidad
    }),
    nuevos: enBorrador.filter((linea) => linea.id < 0),
  }
}

// Lo mismo con las fotos. Una foto cuyo título cambió va en modificadas con
// el título. El orden se toca solo si en su grupo cambió la secuencia (se
// movió alguna) o hay fotos nuevas: ahí el grupo se renumera, y el orden de
// cada foto pasa a ser su posición, la misma regla del alta. Si no, los
// números guardados se respetan aunque estén salteados (0, 2, 3 después de
// borrar una), que ordenan igual.
function cambiosEnImagenes(guardadas, enBorrador) {
  const ids = enBorrador.map((foto) => foto.id)
  const modificadas = []

  for (const tipo of TIPOS_DE_IMAGEN) {
    const grupo = enBorrador.filter((foto) => foto.tipo === tipo)
    const secuenciaGuardada = guardadas
      .filter((g) => g.tipo === tipo && ids.includes(g.id))
      .map((g) => g.id)
    const secuenciaBorrador = grupo.filter((foto) => foto.id > 0).map((foto) => foto.id)

    const renumerar =
      grupo.some((foto) => foto.id < 0) ||
      secuenciaGuardada.join() !== secuenciaBorrador.join()

    grupo.forEach((foto, posicion) => {
      const guardada = guardadas.find((g) => g.id === foto.id)
      if (!guardada) return

      const cambio = {}
      if (renumerar && guardada.orden !== posicion) cambio.orden = posicion
      if (guardada.titulo !== foto.titulo) cambio.titulo = foto.titulo
      if (Object.keys(cambio).length > 0) modificadas.push({ foto, cambio })
    })
  }

  return {
    borradas: guardadas.filter((g) => !ids.includes(g.id)),
    modificadas,
    nuevas: enBorrador.filter((foto) => foto.id < 0),
  }
}

// Y con las categorías: las que entran y las que salen.
function cambiosEnCategorias(guardadas, enBorrador) {
  const idsGuardadas = guardadas.map((c) => c.id)
  const idsBorrador = enBorrador.map((c) => c.id)
  return {
    entran: enBorrador.filter((c) => !idsGuardadas.includes(c.id)),
    salen: guardadas.filter((c) => !idsBorrador.includes(c.id)),
  }
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

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}


// Tiene que ser el mismo 1440 que la media query grande de index.css, por
// lo mismo que PANTALLA_CHICA en Layout.jsx: React decide si el panel del
// resumen existe y CSS reparte las dos columnas, y los dos tienen que
// cambiar en el mismo ancho.
const PANTALLA_GRANDE = '(min-width: 1440px)'

// Dice si la pantalla es grande (1440px o más) y se actualiza sola cuando
// la ventana cruza ese ancho. Es usePantallaChica de Layout.jsx con la otra
// consulta; queda acá porque este es su único consumidor.
function usePantallaGrande() {
  const [grande, setGrande] = useState(() => window.matchMedia(PANTALLA_GRANDE).matches)

  useEffect(() => {
    const consulta = window.matchMedia(PANTALLA_GRANDE)
    const actualizar = (evento) => setGrande(evento.matches)
    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [])

  return grande
}


function Chip({ texto, color, fondo }) {
  return (
    <span
      style={{
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        borderRadius: 20,
        padding: '5px 14px',
        border: `1px solid ${color}`,
        background: fondo,
        color,
      }}
    >
      {texto}
    </span>
  )
}


// El encabezado de una sección del acordeón: el nombre, a la derecha un
// resumen corto ("3 materiales") y, si la sección tiene algo sin guardar,
// "Cambios sin guardar" en rojo. Tocarlo abre o cierra la sección. Va con
// el rosa muy claro de los encabezados de tabla y una franja rosa a la
// izquierda, para que cada sección se distinga de la otra. Con `aviso`,
// antes del resumen va el mismo círculo ámbar de la miniatura del listado,
// con el texto en el title. Vive acá y no en componentes/ porque es su
// único consumidor.
function SeccionDesplegable({ titulo, resumen, aviso, conCambios, abierta, onAlternar, children }) {
  return (
    <section className="ancho-pantalla" style={{ maxWidth: ANCHO_MAXIMO }}>
      <button
        onClick={onAlternar}
        aria-expanded={abierta}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          border: '1px solid #EBE0E2',
          borderLeft: '4px solid #8C5A66',
          borderRadius: 8,
          background: '#F0E2E4',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C5A66" strokeWidth="2.2" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d={abierta ? CHEVRON_ABAJO : CHEVRON_DERECHA} />
        </svg>

        <span
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#8C5A66',
            letterSpacing: '.06em',
          }}
        >
          {titulo}
        </span>

        {conCambios && (
          <span style={{ fontSize: 13, color: '#C0442F', whiteSpace: 'nowrap' }}>
            Cambios sin guardar
          </span>
        )}

        {aviso && (
          <span
            title={aviso}
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              border: '1px solid #EEDCB4',
              background: '#FDF3E0',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8862B" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
            </svg>
          </span>
        )}

        <span style={{ marginLeft: aviso ? 0 : 'auto', fontSize: 14, color: '#857078', whiteSpace: 'nowrap' }}>
          {resumen}
        </span>
      </button>

      {abierta && <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
  )
}


// El panel de la derecha en pantalla grande: la imagen principal y, debajo,
// el mismo resumen de la cabecera más las categorías. Solo se dibuja en la
// sección Datos, y solo de 1440px para arriba: en
// los otros anchos la cabecera ya dice lo mismo, y un panel escondido con
// CSS igual descargaría la imagen en el celular.
function ResumenDelProducto({ producto, activo, dificultad, catalogo }) {
  // La principal es la primera de tipo RESULTADO, como en PestanaImagenes.
  const principal = producto.imagenes.find((i) => i.tipo === 'RESULTADO')

  // contain: 'size' hace que el panel no cuente para el alto de la fila: lo
  // pone el formulario, y el panel se estira hasta ahí. La foto ocupa todo el
  // ancho y el alto que deja el resumen de abajo; objectFit: 'cover' la
  // recorta sin deformarla.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        contain: 'size',
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {principal ? (
        <img
          src={principal.imagen}
          alt={producto.nombre}
          style={{
            display: 'block',
            flex: '1 1 0',
            minHeight: 0,
            width: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#FAF7F7',
            borderBottom: '1px solid #EBE0E2',
            fontSize: 14,
            color: '#B08791',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_IMAGEN} />
          </svg>
          Sin imagen
        </div>
      )}

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22, color: '#8C5A66' }}>
          {formatearPrecio(producto.precio_actual)}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip texto={textoDificultad(producto)} color={dificultad.color} fondo={dificultad.fondo} />
          <Chip
            texto={producto.estado_display}
            color={activo ? '#4E8C6A' : '#C0442F'}
            fondo={activo ? '#E8F5EF' : '#FAEAE8'}
          />
          <Chip texto={catalogo.texto} color={catalogo.color} fondo={catalogo.fondo} />
        </div>

        <div>
          <p
            style={{
              margin: '0 0 8px',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: '#857078',
              letterSpacing: '.06em',
            }}
          >
            CATEGORÍAS
          </p>

          {producto.categorias.length === 0 ? (
            <span style={{ fontSize: 14, color: '#857078' }}>Sin categorías</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Rosa las de tipo y amarillo las temáticas: los mismos colores
                  que usa PestanaCategorias. */}
              {producto.categorias.map((c) => (
                <Chip
                  key={c.id}
                  texto={c.nombre}
                  color={c.tipo === 'TEMATICA' ? '#D9A441' : '#8C5A66'}
                  fondo={c.tipo === 'TEMATICA' ? '#FDF3E0' : '#F0E2E4'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// La ficha de un producto que ya existe (/productos/:id). El alta vive
// aparte, en AltaProducto: junta todo en memoria y lo crea al final.
//
// Es un solo formulario en acordeón (corrección del tutor, A8-a): Datos,
// Materiales, Imágenes y Categorías trabajan sobre el mismo borrador, como
// en el alta, y se guardan juntas con el único Guardar del pie, que al
// terminar vuelve al listado con un modal de aviso. Nada se guarda solo.
export default function DetalleProducto() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [producto, setProducto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [abiertas, setAbiertas] = useState(ABIERTAS_AL_ENTRAR)

  // Tres errores, cada uno al lado de lo que lo provocó: 'error' es el del
  // formulario de Datos; 'errorImagen' guarda además EN QUÉ GRUPO de fotos
  // falló ({ tipo, mensaje }); 'errorSeccion' es el de Materiales o
  // Categorías ({ seccion, mensaje }).
  const [error, setError] = useState('')
  const [errorImagen, setErrorImagen] = useState(null)
  const [errorSeccion, setErrorSeccion] = useState(null)

  // El borrador vive ACÁ y no en las secciones: cerrar una sección la
  // desmonta, y si viviera adentro se perdería lo cargado.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [avance, setAvance] = useState('')

  // Las filas de materiales y las tarjetas de fotos guardan lo que se está
  // escribiendo hasta salir del campo. Descartar cambia esta versión, que va
  // en la key de las secciones, y React las vuelve a armar desde el borrador.
  const [version, setVersion] = useState(0)

  const [categorias, setCategorias] = useState([])
  const [materiales, setMateriales] = useState([])
  const [modalMaterial, setModalMaterial] = useState(false)

  // Guardar un producto que va a quedar sin fotos se puede, pero antes se
  // pregunta con el modal, como "Crear sin fotos" en el alta.
  const [preguntarSinFotos, setPreguntarSinFotos] = useState(false)

  // Los ids provisorios de lo nuevo: negativos, para que nunca choquen con
  // uno real.
  const proximoId = useRef(-1)
  const pantallaGrande = usePantallaGrande()

  useEffect(() => {
    obtenerProducto(id)
      .then((res) => {
        setProducto(res.data)
        setBorrador(borradorDe(res.data))
      })
      .catch(() => setError('No se pudo cargar el producto.'))
      .finally(() => setCargando(false))

    listarCategorias().then((res) => setCategorias(res.data)).catch(() => {})
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [id])

  // Las miniaturas de las fotos nuevas son URLs de objeto que retienen el
  // archivo hasta que se revocan. Al desmontar se revocan las que quedan;
  // al quitar una foto o al descartar, las suyas.
  const imagenesActuales = useRef([])
  useEffect(() => {
    imagenesActuales.current = borrador ? borrador.imagenes : []
  }, [borrador])
  useEffect(() => {
    return () => imagenesActuales.current.forEach(revocarSiEsNueva)
  }, [])


  // Qué secciones tienen cambios sin guardar. Se calcula acá arriba, antes
  // de los return de la carga, porque lo usan los dos avisos de salir, que
  // son hooks y tienen que correr siempre.
  const cambios = producto && borrador
    ? {
        datos: datosCambiaron(borrador, borradorDe(producto)),
        materiales: cambiosEnMateriales(producto.materiales_usados, borrador.materiales),
        imagenes: cambiosEnImagenes(producto.imagenes, borrador.imagenes),
        categorias: cambiosEnCategorias(producto.categorias, borrador.categorias),
      }
    : null

  const conCambios = cambios && {
    datos: cambios.datos,
    materiales: Object.values(cambios.materiales).some((lista) => lista.length > 0),
    imagenes: Object.values(cambios.imagenes).some((lista) => lista.length > 0),
    categorias: Object.values(cambios.categorias).some((lista) => lista.length > 0),
  }

  const hayCambios = conCambios !== null && Object.values(conCambios).some(Boolean)

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
  // el mismo bloqueo de las otras fichas, solo si hay cambios. Después de
  // guardar no se frena, y la del cierre de sesión tampoco.
  const saltearBloqueo = useRef(false)
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      !saltearBloqueo.current &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname !== `${BASE_GESTION}/login`
  )


  function revocarSiEsNueva(foto) {
    if (foto.archivo) URL.revokeObjectURL(foto.imagen)
  }

  function alternar(seccion) {
    setAbiertas({ ...abiertas, [seccion]: !abiertas[seccion] })
  }

  function nuevoId() {
    const nuevo = proximoId.current
    proximoId.current -= 1
    return nuevo
  }


  // Las acciones de las secciones escriben en el borrador, como en el alta:
  // nada viaja hasta Guardar.

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
  // orden se manda recién al guardar, como la posición dentro de su grupo.
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
    revocarSiEsNueva(imagen)
    setBorrador({ ...borrador, imagenes: borrador.imagenes.filter((foto) => foto.id !== imagen.id) })
  }

  function agregarCategoria(categoria) {
    setBorrador({ ...borrador, categorias: [...borrador.categorias, categoria] })
  }

  function quitarCategoria(categoria) {
    setBorrador({ ...borrador, categorias: borrador.categorias.filter((c) => c.id !== categoria.id) })
  }


  // Guardar: primero revisa los datos y, si el producto va a quedar sin
  // fotos, pregunta.
  function pedirGuardar() {
    setError('')
    setErrorImagen(null)
    setErrorSeccion(null)

    // Los tres que el backend exige y no tienen valor por defecto. Se
    // muestra el primero que falte: es un formulario corto y una lista de
    // errores sería más ruido que ayuda.
    let falta = ''
    if (!borrador.nombre.trim()) falta = 'Ponele un nombre al producto.'
    else if (!borrador.precio) falta = 'Ponele un precio al producto.'
    else if (!borrador.dificultad) falta = 'Elegí la dificultad.'

    if (falta) {
      setError(falta)
      setAbiertas({ ...abiertas, datos: true })
      return
    }

    if (borrador.imagenes.length === 0 && producto.imagenes.length > 0) {
      setPreguntarSinFotos(true)
      return
    }

    guardar()
  }

  // Guardar es una cadena de los endpoints que ya existen, como Crear en el
  // alta: el PUT de los datos si cambiaron, y después materiales, fotos y
  // categorías. No es atómico: si algo falla a mitad, lo anterior quedó
  // guardado. Por eso, a medida que avanza, la ficha se queda con la última
  // respuesta del backend (todos estos endpoints devuelven la ficha
  // completa), y lo nuevo que se crea recibe su id real en el borrador:
  // volver a tocar Guardar sigue desde ahí, sin duplicar nada.
  async function guardar() {
    setPreguntarSinFotos(false)
    setGuardando(true)

    let actual = producto
    let lineas = borrador.materiales
    let fotos = borrador.imagenes

    // Dónde está la cadena, para mostrar el error al lado de lo que falló.
    let enCurso = { seccion: 'datos' }

    try {
      if (datosCambiaron(borrador, borradorDe(producto))) {
        setAvance('Guardando datos…')
        actual = (await modificarProducto(id, {
          nombre: borrador.nombre.trim(),
          descripcion: borrador.descripcion.trim(),
          precio_actual: borrador.precio,
          dificultad: borrador.dificultad,
          paso_a_paso: borrador.paso_a_paso,
          es_personalizado: borrador.es_personalizado,
        })).data
      }

      const m = cambiosEnMateriales(producto.materiales_usados, lineas)
      setAvance('Guardando materiales…')

      for (const linea of m.quitados) {
        enCurso = { seccion: 'materiales', nombre: linea.material_nombre }
        actual = (await quitarMaterialDeProducto(id, linea.id)).data
      }
      for (const linea of m.modificados) {
        enCurso = { seccion: 'materiales', nombre: linea.material_nombre }
        actual = (await modificarCantidadDeMaterial(id, linea.id, linea.cantidad)).data
      }
      for (const linea of m.nuevos) {
        enCurso = { seccion: 'materiales', nombre: linea.material_nombre }
        const idsAntes = actual.materiales_usados.map((l) => l.id)
        actual = (await asignarMaterialAProducto(id, linea.material, linea.cantidad)).data
        const creada = actual.materiales_usados.find((l) => !idsAntes.includes(l.id))
        lineas = lineas.map((l) => (l.id === linea.id ? { ...l, id: creada.id } : l))
      }

      // Las fotos: primero las borradas, después las que cambiaron de
      // título o de lugar, y al final las nuevas, que suben con su orden.
      const f = cambiosEnImagenes(producto.imagenes, fotos)
      const totalFotos = f.borradas.length + f.modificadas.length + f.nuevas.length
      let hechas = 0

      for (const foto of f.borradas) {
        enCurso = { seccion: 'imagenes', tipo: foto.tipo }
        hechas += 1
        setAvance(`Guardando fotos (${hechas} de ${totalFotos})…`)
        actual = (await borrarImagenDeProducto(id, foto.id)).data
      }
      for (const { foto, cambio } of f.modificadas) {
        enCurso = { seccion: 'imagenes', tipo: foto.tipo }
        hechas += 1
        setAvance(`Guardando fotos (${hechas} de ${totalFotos})…`)
        actual = (await modificarImagenDeProducto(id, foto.id, cambio)).data
      }
      for (const foto of f.nuevas) {
        enCurso = { seccion: 'imagenes', tipo: foto.tipo }
        hechas += 1
        setAvance(`Subiendo foto ${hechas} de ${totalFotos}…`)
        const orden = fotos.filter((otra) => otra.tipo === foto.tipo).findIndex((otra) => otra.id === foto.id)
        const datosFoto = { imagen: foto.archivo, tipo: foto.tipo, orden }
        if (foto.titulo) datosFoto.titulo = foto.titulo
        const idsAntes = actual.imagenes.map((i) => i.id)
        actual = (await subirImagenDeProducto(id, datosFoto)).data
        const subida = actual.imagenes.find((i) => !idsAntes.includes(i.id))
        fotos = fotos.map((otra) => (otra.id === foto.id ? { ...otra, id: subida.id } : otra))
      }

      const c = cambiosEnCategorias(producto.categorias, borrador.categorias)
      setAvance('Guardando categorías…')

      for (const categoria of c.salen) {
        enCurso = { seccion: 'categorias', nombre: categoria.nombre }
        actual = (await quitarCategoriaDeProducto(id, categoria.id)).data
      }
      for (const categoria of c.entran) {
        enCurso = { seccion: 'categorias', nombre: categoria.nombre }
        actual = (await asignarCategoriaAProducto(id, categoria.id)).data
      }
    } catch (err) {
      const mensaje = mensajeDeError(err)

      if (enCurso.seccion === 'datos') {
        setError(mensaje)
      } else if (enCurso.seccion === 'imagenes') {
        setErrorImagen({ tipo: enCurso.tipo, mensaje: `${mensaje} Lo anterior quedó guardado.` })
      } else {
        setErrorSeccion({
          seccion: enCurso.seccion,
          mensaje: `No se pudo guardar «${enCurso.nombre}»: ${mensaje} Lo anterior quedó guardado.`,
        })
      }

      // La sección del error se abre, para que se vea.
      setAbiertas({ ...abiertas, [enCurso.seccion]: true })
      setProducto(actual)
      setBorrador({ ...borrador, materiales: lineas, imagenes: fotos })
      setGuardando(false)
      setAvance('')
      return
    }

    // Todo guardado: se vuelve al listado, que avisa con un modal. Sin
    // bloqueo: ya no queda nada sin guardar.
    saltearBloqueo.current = true
    navegar(`${BASE_GESTION}/productos`, { state: { guardado: actual.nombre } })
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!producto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el producto.'}</p>
  }


  // Salir con cambios sin guardar pregunta: lo frena el bloqueo de arriba.
  // El aviso mientras se está en la ficha es el chip del breadcrumb.
  function volver() {
    navegar(`${BASE_GESTION}/productos`)
  }

  // Descartar repone todo desde el producto guardado, y vuelve a armar las
  // secciones para que los campos que se estaban escribiendo se repongan.
  function descartar() {
    borrador.imagenes.forEach(revocarSiEsNueva)
    setError('')
    setErrorImagen(null)
    setErrorSeccion(null)
    setBorrador(borradorDe(producto))
    setVersion(version + 1)
  }


  // Todo lo que sigue describe el producto cargado.
  const activo = producto.estado === 'ACTIVO'
  const deBaja = producto.estado === 'BAJA'
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogoFicha(producto)
  const avisoOculto = activo && !producto.visible_en_catalogo && motivoFuera(producto)

  // Lo que se puede agregar sale del borrador, no de lo guardado: lo recién
  // agregado ya no se ofrece.
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
          Productos
        </button>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
        </svg>

        <span style={{ fontSize: 15, color: '#857078' }}>{producto.nombre}</span>

        {hayCambios && <ChipCambiosSinGuardar />}
      </div>

      <div
        className="ancho-pantalla"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 22,
          flexWrap: 'wrap',
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
              textWrap: 'pretty',
            }}
          >
            {producto.nombre}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                fontSize: 22,
                color: '#8C5A66',
              }}
            >
              {formatearPrecio(producto.precio_actual)}
            </span>

            <Chip texto={textoDificultad(producto)} color={dificultad.color} fondo={dificultad.fondo} />
            <Chip
              texto={producto.estado_display}
              color={activo ? '#4E8C6A' : '#C0442F'}
              fondo={activo ? '#E8F5EF' : '#FAEAE8'}
            />
            <Chip texto={catalogo.texto} color={catalogo.color} fondo={catalogo.fondo} />
          </div>
        </div>
      </div>

      {avisoOculto && (
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
          <span style={{ fontSize: 15, color: '#C0442F', textWrap: 'pretty' }}>{avisoOculto}</span>
        </div>
      )}


      {/* Un producto dado de baja es de solo lectura: el fieldset
          deshabilitado apaga todos los controles de las cuatro secciones
          (campos, botones, casillas, el selector de archivo) sin tocar cada
          uno. Se reactiva desde la sección de bajas del listado. */}
      <fieldset disabled={deBaja} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SeccionDesplegable
            titulo="DATOS"
            conCambios={conCambios.datos}
            abierta={abiertas.datos}
            onAlternar={() => alternar('datos')}
          >
            {/* El contenedor es una grilla de una columna que en pantalla
                grande pasa a dos (formulario y panel del resumen) por la
                clase datos-producto. */}
            <div
              key={`datos-${version}`}
              className="datos-producto"
              // stretch: el panel se estira hasta el alto del formulario, así los
              // dos terminan alineados. Con una sola columna no cambia nada.
              style={{ display: 'grid', gap: 24, alignItems: 'stretch' }}
            >
              <PestanaDatos
                borrador={borrador}
                onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
                error={error}
              />

              {pantallaGrande && (
                <ResumenDelProducto
                  producto={producto}
                  activo={activo}
                  dificultad={dificultad}
                  catalogo={catalogo}
                />
              )}
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo="MATERIALES"
            resumen={plural(borrador.materiales.length, 'material', 'materiales')}
            // Sale del borrador y no del producto guardado: si se quita el
            // material discontinuado, el círculo se va en el momento.
            aviso={avisoMateriales({
              materiales_discontinuados: borrador.materiales
                .filter((linea) => linea.material_estado === 'DISCONTINUADO')
                .map((linea) => linea.material_nombre),
            })}
            conCambios={conCambios.materiales}
            abierta={abiertas.materiales}
            onAlternar={() => alternar('materiales')}
          >
            <div key={`materiales-${version}`}>
              <PestanaMateriales
                lineas={borrador.materiales}
                onAgregar={() => setModalMaterial(true)}
                onGuardarCantidad={cambiarCantidad}
                onQuitar={quitarMaterial}
              />
              {errorSeccion?.seccion === 'materiales' && (
                <p role="alert" style={{ margin: '12px 0 0', color: '#C0442F', fontSize: 14 }}>
                  {errorSeccion.mensaje}
                </p>
              )}
            </div>
          </SeccionDesplegable>

          {/* Diferencia deliberada con el prototipo: allá las imágenes se
              reordenan arrastrándolas, acá con dos flechitas por tarjeta,
              que intercambian dos vecinas. Al guardar, el orden de cada foto
              es su posición dentro de su grupo. */}
          <SeccionDesplegable
            titulo="IMÁGENES"
            resumen={plural(borrador.imagenes.length, 'foto', 'fotos')}
            conCambios={conCambios.imagenes}
            abierta={abiertas.imagenes}
            onAlternar={() => alternar('imagenes')}
          >
            <div key={`imagenes-${version}`}>
              <PestanaImagenes
                imagenes={borrador.imagenes}
                error={errorImagen}
                onError={(tipo, mensaje) => setErrorImagen({ tipo, mensaje })}
                onSubirArchivo={agregarImagen}
                onIntercambiar={intercambiarImagenes}
                onGuardarTitulo={cambiarTitulo}
                onBorrar={quitarImagen}
              />
            </div>
          </SeccionDesplegable>

          <SeccionDesplegable
            titulo="CATEGORÍAS"
            resumen={plural(borrador.categorias.length, 'categoría', 'categorías')}
            conCambios={conCambios.categorias}
            abierta={abiertas.categorias}
            onAlternar={() => alternar('categorias')}
          >
            <div key={`categorias-${version}`}>
              <PestanaCategorias
                asignadas={borrador.categorias}
                disponibles={categoriasDisponibles}
                onAsignar={agregarCategoria}
                onQuitar={quitarCategoria}
              />
              {errorSeccion?.seccion === 'categorias' && (
                <p role="alert" style={{ margin: '12px 0 0', color: '#C0442F', fontSize: 14 }}>
                  {errorSeccion.mensaje}
                </p>
              )}
            </div>
          </SeccionDesplegable>
        </div>
      </fieldset>

      {/* El pie del formulario, debajo de las cuatro secciones: un solo
          Guardar para todo. Sin cambios los dos se apagan, con el motivo en
          el title. */}
      <div
        className="ancho-pantalla"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 24,
          maxWidth: ANCHO_MAXIMO,
        }}
      >
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

      {modalMaterial && (
        <ModalAgregarMaterial
          materiales={materialesDisponibles}
          onCerrar={() => setModalMaterial(false)}
          onElegir={agregarMaterial}
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

      {preguntarSinFotos && (
        <ModalConfirmar
          titulo="Guardar sin fotos"
          texto="Este producto va a quedar sin fotos. ¿Guardar igual?"
          textoAccion="Guardar igual"
          onCerrar={() => setPreguntarSinFotos(false)}
          onConfirmar={guardar}
        />
      )}
    </div>
  )
}
