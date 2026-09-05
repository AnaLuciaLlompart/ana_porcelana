import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerProducto,
  crearProducto,
  modificarProducto,
  reactivarProducto,
  publicarProducto,
  quitarProductoDelCatalogo,
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

import Toast from '../../componentes/Toast'

import PestanaDatos from './PestanaDatos'
import PestanaMateriales from './PestanaMateriales'
import PestanaCategorias from './PestanaCategorias'
import PestanaImagenes from './PestanaImagenes'
import ModalAgregarMaterial from './ModalAgregarMaterial'
import ModalBajaProducto from './ModalBajaProducto'
import {
  COLOR_DIFICULTAD,
  estadoCatalogoFicha,
  formatearPrecio,
  motivoFuera,
  textoDificultad,
} from './presentacion'


const ICONO_FLECHA = 'M9 5l7 7-7 7'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'

const PESTANAS = [
  { id: 'datos', label: 'Datos' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'imagenes', label: 'Imágenes' },
  { id: 'categorias', label: 'Categorías' },
]


// Los campos que edita el formulario de Datos. El precio va como texto
// porque el input es de texto; se convierte al guardar.
function borradorDe(producto) {
  return {
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: String(Math.round(Number(producto.precio_actual))),
    dificultad: producto.dificultad,
    paso_a_paso: producto.paso_a_paso,
    es_personalizado: producto.es_personalizado,
  }
}


// Con qué arranca el formulario en un alta. Además de ser el punto de
// partida, es la línea de base contra la que se mide si hay algo escrito:
// en la edición se compara contra el producto cargado, acá contra esto.
const BORRADOR_VACIO = {
  nombre: '',
  descripcion: '',
  precio: '',
  dificultad: '',
  paso_a_paso: '',
  es_personalizado: false,
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


// La misma ficha atiende dos casos: el alta (/productos/nuevo) y la edición
// (/productos/:id). Cuál es lo dice la ruta con la prop, en vez de que el
// componente lo deduzca de que falte el id.
export default function DetalleProducto({ esAlta = false }) {
  const { id } = useParams()
  const navegar = useNavigate()

  const [producto, setProducto] = useState(null)
  // En un alta no hay nada que traer del servidor.
  const [cargando, setCargando] = useState(!esAlta)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('datos')

  // El borrador de Datos vive ACÁ y no en PestanaDatos, al revés que el
  // borrador del modal de filtros. El motivo es que tiene que sobrevivir al
  // cambio de pestaña: si viviera en la pestaña, pasar a Materiales la
  // desmontaría y se perdería lo escrito.
  const [borrador, setBorrador] = useState(esAlta ? BORRADOR_VACIO : null)
  const [guardando, setGuardando] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [materiales, setMateriales] = useState([])

  const [modalMaterial, setModalMaterial] = useState(false)
  const [modalBaja, setModalBaja] = useState(false)

  // El error de las imágenes va aparte del general, y guarda EN QUÉ GRUPO
  // falló: { tipo, mensaje }. Se muestra arriba de la grilla de ese grupo,
  // al lado del botón que lo provocó, y no al final de la pestaña, donde
  // quedaba tan lejos que no se veía.
  const [errorImagen, setErrorImagen] = useState(null)
  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  useEffect(() => {
    if (!esAlta) {
      obtenerProducto(id)
        .then((res) => {
          setProducto(res.data)
          setBorrador(borradorDe(res.data))
        })
        .catch(() => setError('No se pudo cargar el producto.'))
        .finally(() => setCargando(false))
    }

    listarCategorias().then((res) => setCategorias(res.data)).catch(() => {})
    listarMateriales().then((res) => setMateriales(res.data)).catch(() => {})
  }, [id, esAlta])




  function mostrarToast(texto) {
    setToast(texto)
    // Se cancela el anterior: si no, al hacer dos acciones seguidas el
    // temporizador de la primera apaga el cartel de la segunda antes de
    // tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 2600)
  }


  // Las acciones sobre materiales y categorías se aplican EN EL MOMENTO,
  // a diferencia de la pestaña Datos, que junta los cambios y espera al
  // botón de GUARDAR. La razón es que son hechos consumados: agregarle una categoría
  // a un producto es un caso de uso que ya pasó (CU25), no un campo que se
  // está editando. Por eso no hay botón de guardar en esas pestañas, y por
  // eso confirman con un toast.
  //
  // Todos estos endpoints devuelven la ficha completa, ya recalculada por
  // el backend, así que se usa esa respuesta en vez de volver a pedir el
  // producto: es un viaje menos y no hay un momento con datos viejos.
  async function accionInmediata(llamada, textoToast) {
    setError('')
    try {
      const res = await llamada()
      setProducto(res.data)
      mostrarToast(textoToast)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }


  // Como accionInmediata, pero para las imágenes: el error se recuerda
  // junto con el grupo donde ocurrió. Empezar cualquier acción nueva borra
  // el error anterior, así que se limpia solo al reintentar.
  async function accionDeImagen(tipo, llamada, textoToast) {
    setErrorImagen(null)
    try {
      const res = await llamada()
      setProducto(res.data)
      mostrarToast(textoToast)
    } catch (err) {
      setErrorImagen({ tipo, mensaje: mensajeDeError(err) })
    }
  }


  // Mover una imagen es intercambiar el campo 'orden' de dos: dos PATCH que
  // se mandan juntos, y recién después se refresca con la última respuesta.
  async function intercambiarOrden(a, b) {
    setErrorImagen(null)
    try {
      await modificarImagenDeProducto(id, a.id, { orden: b.orden })
      const res = await modificarImagenDeProducto(id, b.id, { orden: a.orden })
      setProducto(res.data)
      mostrarToast('Orden actualizado')
    } catch (err) {
      // Las dos son del mismo grupo, así que alcanza con el tipo de una.
      setErrorImagen({ tipo: a.tipo, mensaje: mensajeDeError(err) })
      // Si el segundo PATCH falló, el primero ya se aplicó: se vuelve a
      // pedir la ficha para mostrar cómo quedó de verdad.
      obtenerProducto(id).then((res) => setProducto(res.data)).catch(() => {})
    }
  }


  // Devuelve el id del producto si salió bien, o null si no. En un alta ese
  // id es el del producto recién creado, y hace falta para navegar a su
  // ficha.
  async function guardarDatos() {
    setError('')

    // Los tres que el backend exige y no tienen valor por defecto. Se
    // muestra el primero que falte: es un formulario corto y una lista de
    // errores sería más ruido que ayuda.
    if (!borrador.nombre.trim()) {
      setError('Ponele un nombre al producto.')
      return null
    }
    if (!borrador.precio) {
      setError('Ponele un precio al producto.')
      return null
    }
    if (!borrador.dificultad) {
      setError('Elegí la dificultad.')
      return null
    }

    setGuardando(true)

    const datos = {
      nombre: borrador.nombre.trim(),
      descripcion: borrador.descripcion.trim(),
      precio_actual: borrador.precio,
      dificultad: borrador.dificultad,
      paso_a_paso: borrador.paso_a_paso,
    }

    try {
      if (esAlta) {
        // El tilde de personalizado viaja acá porque en el alta todavía no
        // hay producto al que pedirle CU23 o CU24.
        const res = await crearProducto({ ...datos, es_personalizado: borrador.es_personalizado })
        return res.data.id
      }

      const res = await modificarProducto(id, datos)
      setProducto(res.data)
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

  if (!esAlta && !producto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el producto.'}</p>
  }


  // Derivados, calculados en cada render.
  //
  // Lo que cambia entre el alta y la edición no es la comparación sino la
  // LÍNEA DE BASE: en la edición se mide contra el producto que se cargó,
  // en el alta contra el borrador vacío, o sea "hay algo escrito".
  const original = esAlta ? BORRADOR_VACIO : borradorDe(producto)

  const hayCambios =
    borrador.nombre !== original.nombre ||
    borrador.descripcion !== original.descripcion ||
    borrador.precio !== original.precio ||
    borrador.dificultad !== original.dificultad ||
    borrador.paso_a_paso !== original.paso_a_paso ||
    borrador.es_personalizado !== original.es_personalizado

  // El botón del formulario: en un alta, además de crear, lleva a la ficha
  // del producto nuevo, que ya es una edición con las cuatro pestañas.
  async function guardarFormulario() {
    const nuevoId = await guardarDatos()
    if (esAlta && nuevoId) navegar(`/productos/${nuevoId}`)
  }


  // Salir descarta lo escrito sin preguntar. El aviso mientras se está en la
  // ficha es el chip del breadcrumb.
  function volver() {
    navegar('/productos')
  }

  // Todo lo que sigue describe un producto que existe, así que en un alta
  // no aplica y el encabezado lo omite.
  const activo = !esAlta && producto.estado === 'ACTIVO'
  const dificultad = esAlta ? null : COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = esAlta ? null : estadoCatalogoFicha(producto)
  const avisoOculto = !esAlta && activo && !producto.visible_en_catalogo && motivoFuera(producto)

  const idsAsignados = esAlta ? [] : producto.categorias.map((c) => c.id)
  const categoriasDisponibles = categorias.filter(
    (c) => c.estado === 'ACTIVO' && !idsAsignados.includes(c.id)
  )

  const idsMateriales = esAlta ? [] : producto.materiales_usados.map((l) => l.material)
  const materialesDisponibles = materiales.filter(
    (m) => m.estado === 'ACTIVO' && !idsMateriales.includes(m.id)
  )

  // En un alta no hay nada que contar, así que las pestañas van sin globito.
  const CUENTAS = esAlta ? {} : {
    materiales: producto.cantidad_materiales,
    imagenes: producto.cantidad_imagenes,
    categorias: producto.categorias.length,
  }

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

        <span style={{ fontSize: 15, color: '#857078' }}>
          {esAlta ? 'Nuevo producto' : producto.nombre}
        </span>

        {hayCambios && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 4,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 20,
              padding: '3px 11px',
              border: '1px solid #EEDCB4',
              background: '#FDF3E0',
              color: '#8A6320',
            }}
          >
            Cambios sin guardar
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 22,
          flexWrap: 'wrap',
          maxWidth: 720,
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
            {esAlta ? 'Nuevo producto' : producto.nombre}
          </h1>

          {!esAlta && (
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
          )}
        </div>

        {/* Dar de baja no tiene sentido sobre algo que todavía no existe. */}
        {!esAlta && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() =>
              activo
                ? setModalBaja(true)
                : accionInmediata(() => reactivarProducto(id), 'Producto reactivado')
            }
            className="btn-reponer"
            style={{
              padding: '10px 16px',
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
            {activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
        )}
      </div>

      {avisoOculto && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            marginBottom: 20,
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
          borderBottom: '1px solid #EBE0E2',
        }}
      >
        {PESTANAS.map((p) => {
          const activa = tab === p.id
          const cuenta = CUENTAS[p.id]
          // En un alta solo se puede estar en Datos: las otras tres piden un
          // producto que todavía no existe.
          const deshabilitada = esAlta && p.id !== 'datos'

          return (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              disabled={deshabilitada}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 18px',
                border: 0,
                borderBottom: `2px solid ${activa ? '#8C5A66' : 'transparent'}`,
                background: 'transparent',
                cursor: deshabilitada ? 'default' : 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: deshabilitada ? '#B08791' : activa ? '#8C5A66' : '#857078',
              }}
            >
              {p.label}

              {cuenta !== undefined && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    borderRadius: 10,
                    background: activa ? '#8C5A66' : '#F0E2E4',
                    color: activa ? 'white' : '#8C5A66',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {cuenta}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {esAlta && (
        <p style={{ margin: '-8px 0 20px', fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
          Primero guardá el producto. Después vas a poder sumarle materiales,
          fotos y categorías.
        </p>
      )}


      {tab === 'datos' && (
        <PestanaDatos
          borrador={borrador}
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          esAlta={esAlta}
          // En el alta el tilde sale del borrador y no llama a nada; en la
          // edición sale del producto y dispara CU23 o CU24 al instante.
          esPersonalizado={esAlta ? borrador.es_personalizado : producto.es_personalizado}
          onTogglePersonalizado={() => {
            if (esAlta) {
              setBorrador({ ...borrador, es_personalizado: !borrador.es_personalizado })
              return
            }
            return producto.es_personalizado
              ? accionInmediata(() => publicarProducto(id), 'Ya no es un pedido personalizado')
              : accionInmediata(() => quitarProductoDelCatalogo(id), 'Marcado como personalizado')
          }}
          onGuardar={guardarFormulario}
          onCancelar={volver}
          guardando={guardando}
          error={error}
        />
      )}

      {tab === 'materiales' && (
        <PestanaMateriales
          lineas={producto.materiales_usados}
          onAgregar={() => setModalMaterial(true)}
          onGuardarCantidad={(linea, cantidad) =>
            accionInmediata(
              () => modificarCantidadDeMaterial(id, linea.id, cantidad),
              'Cantidad guardada'
            )
          }
          onQuitar={(linea) =>
            accionInmediata(
              () => quitarMaterialDeProducto(id, linea.id),
              `“${linea.material_nombre}” quitado`
            )
          }
        />
      )}

      {/* Diferencia deliberada con el prototipo: allá las imágenes se
          reordenan arrastrándolas, acá con dos flechitas por tarjeta.
          Arrastrar mueve un número variable de imágenes de una vez, así que
          serían N pedidos y si uno falla la galería queda a medias.
          Intercambiar de a dos es siempre la misma operación: dos PATCH que
          se cruzan el campo 'orden'. */}
      {tab === 'imagenes' && (
        <PestanaImagenes
          imagenes={producto.imagenes}
          error={errorImagen}
          onError={(tipo, mensaje) => setErrorImagen({ tipo, mensaje })}
          onSubirArchivo={(tipo, archivo) =>
            accionDeImagen(
              tipo,
              () =>
                subirImagenDeProducto(id, {
                  imagen: archivo,
                  tipo,
                  // El orden se numera por separado dentro de cada tipo,
                  // así que la nueva va al final de SU grupo. Además le da
                  // un valor distinto al de sus compañeras, que si no
                  // quedarían todas empatadas en el 0 que trae el modelo
                  // por defecto: entre dos con el mismo orden,
                  // intercambiarlo no cambiaría nada.
                  orden: producto.imagenes.filter((i) => i.tipo === tipo).length,
                }),
              'Imagen subida'
            )
          }
          onIntercambiar={intercambiarOrden}
          onGuardarTitulo={(imagen, titulo) =>
            accionDeImagen(
              imagen.tipo,
              () => modificarImagenDeProducto(id, imagen.id, { titulo }),
              'Título guardado'
            )
          }
          onBorrar={(imagen) =>
            accionDeImagen(
              imagen.tipo,
              () => borrarImagenDeProducto(id, imagen.id),
              'Imagen borrada'
            )
          }
        />
      )}

      {tab === 'categorias' && (
        <PestanaCategorias
          asignadas={producto.categorias}
          disponibles={categoriasDisponibles}
          onAsignar={(categoria) =>
            accionInmediata(
              () => asignarCategoriaAProducto(id, categoria.id),
              `Agregado a “${categoria.nombre}”`
            )
          }
          onQuitar={(categoria) =>
            accionInmediata(
              () => quitarCategoriaDeProducto(id, categoria.id),
              `Quitado de “${categoria.nombre}”`
            )
          }
        />
      )}


      {/* Datos muestra su error adentro del formulario e Imágenes arriba
          del grupo que falló; este del pie es solo para las otras dos. */}
      {error && (tab === 'materiales' || tab === 'categorias') && (
        <p role="alert" style={{ marginTop: 16, color: '#C0442F', fontSize: 14 }}>
          {error}
        </p>
      )}


      {modalMaterial && (
        <ModalAgregarMaterial
          materiales={materialesDisponibles}
          onCerrar={() => setModalMaterial(false)}
          onElegir={(material) => {
            setModalMaterial(false)
            accionInmediata(
              () => asignarMaterialAProducto(id, material.id),
              `“${material.nombre}” agregado`
            )
          }}
        />
      )}

      {modalBaja && (
        <ModalBajaProducto
          producto={producto}
          onCerrar={() => setModalBaja(false)}
          // Al darlo de baja se vuelve al listado, como en el prototipo: el
          // producto queda de solo lectura y no tiene sentido quedarse acá.
          onConfirmado={() => navegar('/productos')}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
