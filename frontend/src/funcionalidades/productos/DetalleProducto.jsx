import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  obtenerProducto,
  modificarProducto,
  reactivarProducto,
  publicarProducto,
  quitarProductoDelCatalogo,
  asignarMaterialAProducto,
  modificarCantidadDeMaterial,
  quitarMaterialDeProducto,
  asignarCategoriaAProducto,
  quitarCategoriaDeProducto,
} from './api'

// Tercer import que cruza de funcionalidad, con el mismo criterio de
// siempre: el endpoint pertenece a esa app y ahí se queda. Acá hacen falta
// las listas completas para elegir qué agregarle al producto.
import { listarCategorias } from '../categorias/api'
import { listarMateriales } from '../materiales/api'

import PestanaDatos from './PestanaDatos'
import PestanaMateriales from './PestanaMateriales'
import PestanaCategorias from './PestanaCategorias'
import ModalAgregarMaterial from './ModalAgregarMaterial'
import ModalSalirSinGuardar from './ModalSalirSinGuardar'
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
const ICONO_TILDE = 'M5 13l4 4L19 7'

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
  }
}


function Toast({ texto }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '11px 20px',
        borderRadius: 24,
        background: '#3D3238',
        boxShadow: '0 10px 30px rgba(61,50,56,.3)',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8FD3AE" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
      </svg>
      <span
        style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 15,
          color: 'white',
        }}
      >
        {texto}
      </span>
    </div>
  )
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


export default function DetalleProducto() {
  const { id } = useParams()
  const navegar = useNavigate()

  const [producto, setProducto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('datos')

  // El borrador de Datos vive ACÁ y no en PestanaDatos, al revés que el
  // borrador del modal de filtros. El motivo es que tiene que sobrevivir al
  // cambio de pestaña: si viviera en la pestaña, pasar a Materiales la
  // desmontaría y se perdería lo escrito.
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [materiales, setMateriales] = useState([])

  const [modalMaterial, setModalMaterial] = useState(false)
  const [modalSalir, setModalSalir] = useState(false)
  const [modalBaja, setModalBaja] = useState(false)
  const [toast, setToast] = useState('')

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


  function mostrarToast(texto) {
    setToast(texto)
    setTimeout(() => setToast(''), 2600)
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
      setError(err.response?.data?.detail || 'No se pudo completar la acción.')
    }
  }


  async function guardarDatos() {
    setError('')

    if (!borrador.nombre.trim()) {
      setError('Ponele un nombre al producto.')
      return false
    }

    setGuardando(true)

    try {
      const res = await modificarProducto(id, {
        nombre: borrador.nombre.trim(),
        descripcion: borrador.descripcion.trim(),
        precio_actual: borrador.precio || '0',
        dificultad: borrador.dificultad,
        paso_a_paso: borrador.paso_a_paso,
      })

      setProducto(res.data)
      setBorrador(borradorDe(res.data))
      mostrarToast('Cambios guardados')
      return true
    } catch (err) {
      const datos = err.response?.data
      setError(datos?.detail || datos?.nombre?.[0] || datos?.precio_actual?.[0] || 'No se pudieron guardar los cambios.')
      return false
    } finally {
      setGuardando(false)
    }
  }


  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (!producto) {
    return <p style={{ color: '#C0442F' }}>{error || 'No se encontró el producto.'}</p>
  }


  // Derivados, calculados en cada render.
  const hayCambios =
    borrador.nombre !== producto.nombre ||
    borrador.descripcion !== producto.descripcion ||
    borrador.precio !== String(Math.round(Number(producto.precio_actual))) ||
    borrador.dificultad !== producto.dificultad ||
    borrador.paso_a_paso !== producto.paso_a_paso

  // Salir de la ficha es el único momento en que se avisa de los cambios sin
  // guardar. Cambiar de pestaña no pregunta nada, porque el borrador sigue
  // vivo y no se pierde.
  function volver() {
    if (hayCambios) {
      setModalSalir(true)
      return
    }
    navegar('/productos')
  }

  const activo = producto.estado === 'ACTIVO'
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogoFicha(producto)
  const avisoOculto = activo && !producto.visible_en_catalogo && motivoFuera(producto)

  const idsAsignados = producto.categorias.map((c) => c.id)
  const categoriasDisponibles = categorias.filter(
    (c) => c.estado === 'ACTIVO' && !idsAsignados.includes(c.id)
  )

  const idsMateriales = producto.materiales_usados.map((l) => l.material)
  const materialesDisponibles = materiales.filter(
    (m) => m.estado === 'ACTIVO' && !idsMateriales.includes(m.id)
  )

  const CUENTAS = {
    materiales: producto.cantidad_materiales,
    imagenes: producto.cantidad_imagenes,
    categorias: producto.categorias.length,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <button
          onClick={volver}
          className="btn-breadcrumb"
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() =>
              activo
                ? setModalBaja(true)
                : accionInmediata(() => reactivarProducto(id), 'Producto reactivado')
            }
            className="btn-baja-ficha"
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

          return (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 18px',
                border: 0,
                borderBottom: `2px solid ${activa ? '#8C5A66' : 'transparent'}`,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: activa ? '#8C5A66' : '#857078',
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


      {tab === 'datos' && (
        <PestanaDatos
          borrador={borrador}
          onCambiar={(cambio) => setBorrador({ ...borrador, ...cambio })}
          esPersonalizado={producto.es_personalizado}
          onTogglePersonalizado={() =>
            producto.es_personalizado
              ? accionInmediata(() => publicarProducto(id), 'Ya no es un pedido personalizado')
              : accionInmediata(() => quitarProductoDelCatalogo(id), 'Marcado como personalizado')
          }
          onGuardar={guardarDatos}
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

      {tab === 'imagenes' && (
        <div
          style={{
            background: 'white',
            border: '1px solid #EBE0E2',
            borderRadius: 8,
            padding: 48,
            maxWidth: 720,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 6px',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: '#3D3238',
            }}
          >
            Las imágenes vienen en el paso siguiente
          </p>
          <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
            El producto ya tiene {producto.cantidad_imagenes === 1
              ? '1 foto cargada'
              : `${producto.cantidad_imagenes} fotos cargadas`}.
          </p>
        </div>
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


      {error && tab !== 'datos' && (
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

      {modalSalir && (
        <ModalSalirSinGuardar
          nombre={producto.nombre}
          onCancelar={() => setModalSalir(false)}
          onSalirSinGuardar={() => navegar('/productos')}
          onGuardarYSalir={async () => {
            const guardado = await guardarDatos()
            if (guardado) navegar('/productos')
            else setModalSalir(false)
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
