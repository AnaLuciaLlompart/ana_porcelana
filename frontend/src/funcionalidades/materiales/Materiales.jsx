import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listarMateriales, discontinuarMaterial, reactivarMaterial } from './api'
import ModalMaterial from './ModalMaterial'
import ModalVerMaterial from './ModalVerMaterial'
import ModalEliminarMaterial from './ModalEliminarMaterial'
import ModalFiltros from './ModalFiltros'
import { FILTROS_VACIOS, candidatos, contarFiltros } from './filtros'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hacen falta los productos
// para el filtro "aparece en el producto".
import { listarProductos } from '../productos/api'

import BotonAccion from '../../componentes/BotonAccion'
import Paginacion, { paginar } from '../../componentes/Paginacion'


// Colores de cada valor
const COLOR_DISPONIBILIDAD = {
  ALTA: { texto: '#4E8C6A', fondo: '#E8F5EF' },
  MEDIA: { texto: '#D9A441', fondo: '#FDF3E0' },
  BAJA: { texto: '#C0442F', fondo: '#FAEAE8' },
}

const COLOR_ESTADO = {
  ACTIVO: { texto: '#4E8C6A', fondo: '#E8F5EF' },
  DISCONTINUADO: { texto: '#C0442F', fondo: '#FAEAE8' },
}

const estiloTh = {
  padding: '12px 16px',
  textAlign: 'left',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#8C5A66',
}

const estiloTd = {
  padding: 16,
  fontSize: 16,
  color: '#3D3238',
}

// Iconos de las acciones por fila
const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const ICONO_EDITAR = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
const ICONO_ELIMINAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
const ICONO_BAJA = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
const ICONO_ALTA = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'

// El mismo icono que Materiales tiene en la barra lateral, igual que hacen
// Productos con la caja y Clientes con las personas.
const ICONO_MATERIAL = 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'

// Iconos del conmutador de vista
const ICONO_LISTA = 'M4 6h16M4 12h16M4 18h16'
const ICONO_GRID = 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'

// Orden lógico de los valores, no alfabético
const ORDEN_DISPONIBILIDAD = { ALTA: 0, MEDIA: 1, BAJA: 2 }
const ORDEN_ESTADO = { ACTIVO: 0, DISCONTINUADO: 1 }

// Lo que se ve cuando todavía no hay ningún material cargado. Es distinto
// de "ningún material coincide": ahí hay materiales y no los encontró ni la
// búsqueda ni los filtros.
function EstadoVacio({ onNuevo }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: '64px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 16,
          background: '#FAF7F7',
          border: '1px solid #EBE0E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DCC9CD" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_MATERIAL} />
        </svg>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 19,
          color: '#3D3238',
        }}
      >
        Todavía no cargaste ningún material
      </p>
      <p style={{ margin: 0, maxWidth: 430, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Cargá la arcilla, los acrílicos y todo lo que usás para producir.
        Después vas a poder asignárselos a tus productos.
      </p>

      <button
        onClick={onNuevo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          padding: '10px 20px',
          background: '#8C5A66',
          color: 'white',
          border: 0,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" d="M12 4v16m8-8H4" />
        </svg>
        Cargar el primero
      </button>
    </div>
  )
}

// El otro vacío: hay materiales, pero ninguno pasa la búsqueda o los
// filtros. En la tabla va como una franja debajo del encabezado, y en la
// grilla como una tarjeta más, que es como se ve en Clientes y Productos.
function SinResultados({ enGrilla }) {
  return (
    <div
      style={
        enGrilla
          ? {
              background: 'white',
              border: '1px solid #EBE0E2',
              borderRadius: 8,
              padding: 48,
              textAlign: 'center',
            }
          : { padding: 48, textAlign: 'center', borderTop: '1px solid #EBE0E2' }
      }
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
        Ningún material coincide
      </p>
      <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
        Probá con otra búsqueda o limpiá los filtros.
      </p>
    </div>
  )
}

// Componentes auxiliares
function Etiqueta({ colores, children }) {
  return (
    <span
      style={{
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 15,
        borderRadius: 20,
        padding: '6px 16px',
        border: `1px solid ${colores.texto}`,
        background: colores.fondo,
        color: colores.texto,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// Botones de acción, compartidos por la tabla y la grilla
function Acciones({ material, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
  const activo = material.estado === 'ACTIVO'

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(material)}
        titulo="Ver"
        color="#8C5A66"
        hover="#F0E2E4"
        tamanoIcono={20}
        icono={ICONO_VER}
      />

      {activo && (
        <>
          <BotonAccion
            onClick={() => onEditar(material)}
            titulo="Editar"
            color="#8C5A66"
            hover="#F0E2E4"
            tamanoIcono={20}
            icono={ICONO_EDITAR}
          />
          <BotonAccion
            onClick={() => onDiscontinuar(material)}
            titulo="Discontinuar"
            color="#D9A441"
            hover="#FDF3E0"
            tamanoIcono={20}
            icono={ICONO_BAJA}
          />
        </>
      )}

      {!activo && (
        <BotonAccion
          onClick={() => onReactivar(material)}
          titulo="Reactivar"
          color="#4E8C6A"
          hover="#E8F5EF"
          tamanoIcono={20}
          icono={ICONO_ALTA}
        />
      )}

      <BotonAccion
        onClick={() => onEliminar(material)}
        titulo="Eliminar"
        color="#C0442F"
        hover="#FAEAE8"
        tamanoIcono={20}
        icono={ICONO_ELIMINAR}
      />
    </div>
  )
}


// Encabezado de tabla clicable, con indicador de orden
function EncabezadoOrdenable({ campo, etiqueta, orden, onClick, centrado }) {
  const activa = orden.campo === campo

  return (
    <th style={{ padding: 0 }}>
      <button
        onClick={() => onClick(campo)}
        className="th-orden"
        style={{
          ...estiloTh,
          width: '100%',
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: centrado ? 'center' : 'flex-start',
        }}
      >
        {etiqueta}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ opacity: activa ? 1 : 0.4, flexShrink: 0 }}
        >
          {activa ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={orden.dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
            />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          )}
        </svg>
      </button>
    </th>
  )
}

function Tabla({ materiales, cargando, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)

  // Alterna asc/desc, o empieza en asc si es una columna nueva.
  function ordenarPor(campo) {
    setOrden((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
    setPagina(1)
  }

  // Se copia con [...] para no modificar el arreglo original.
  const ordenados = [...materiales].sort((a, b) => {
    if (!orden.campo) return 0

    let cmp = 0
    if (orden.campo === 'nombre') {
      cmp = a.nombre.localeCompare(b.nombre, 'es')
    } else if (orden.campo === 'disponibilidad') {
      cmp = ORDEN_DISPONIBILIDAD[a.disponibilidad] - ORDEN_DISPONIBILIDAD[b.disponibilidad]
    } else if (orden.campo === 'estado') {
      cmp = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]
    }

    return orden.dir === 'asc' ? cmp : -cmp
  })

  const { visibles, paginaActual, totalPaginas, desde } = paginar(ordenados, porPagina, pagina)

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#F0E2E4' }}>
          <tr>
            <EncabezadoOrdenable campo="nombre" etiqueta="MATERIAL" orden={orden} onClick={ordenarPor} />
            <EncabezadoOrdenable campo="disponibilidad" etiqueta="DISPONIBILIDAD" orden={orden} onClick={ordenarPor} centrado />
            <EncabezadoOrdenable campo="estado" etiqueta="ESTADO" orden={orden} onClick={ordenarPor} centrado />
            <th style={{ ...estiloTh, textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>

        <tbody>
          {cargando && (
            <tr>
              <td colSpan={4} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                Cargando…
              </td>
            </tr>
          )}

          {!cargando &&
            visibles.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={estiloTd}>{m.nombre}</td>
                <td style={{ ...estiloTd, textAlign: 'center' }}>
                  <Etiqueta colores={COLOR_DISPONIBILIDAD[m.disponibilidad]}>
                    {m.disponibilidad_display}
                  </Etiqueta>
                </td>
                <td style={{ ...estiloTd, textAlign: 'center' }}>
                  <Etiqueta colores={COLOR_ESTADO[m.estado]}>
                    {m.estado_display}
                  </Etiqueta>
                </td>
                <td style={estiloTd}>
                  <Acciones
                    material={m}
                    onVer={onVer}
                    onEditar={onEditar}
                    onEliminar={onEliminar}
                    onDiscontinuar={onDiscontinuar}
                    onReactivar={onReactivar}
                  />
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {!cargando && visibles.length === 0 && <SinResultados />}

      <Paginacion
        total={ordenados.length}
        desde={desde}
        porPagina={porPagina}
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        onPorPagina={(n) => {
          setPorPagina(n)
          setPagina(1)
        }}
        onPagina={setPagina}
      />
    </div>
  )
}


function Grilla({ materiales, cargando, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
  // Su propia paginación, separada de la de la tabla. Los hooks van antes
  // que los return de arriba: React exige que se llamen siempre, en el
  // mismo orden, y uno adentro de un if no se llamaría en todos los
  // renders.
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)

  const { visibles, paginaActual, totalPaginas, desde } = paginar(materiales, porPagina, pagina)

  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (materiales.length === 0) {
    return <SinResultados enGrilla />
  }

  return (
    <>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
        gap: 18,
      }}
    >
      {visibles.map((m) => (
        <div
          key={m.id}
          style={{
            background: 'white',
            border: '1px solid #EBE0E2',
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              height: 150,
              background: '#FAF7F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid #EBE0E2',
            }}
          >
            {m.url_imagen ? (
              <img
                src={m.url_imagen}
                alt={m.nombre}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 44,
                  color: '#B08791',
                }}
              >
                {m.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 16,
                color: '#3D3238',
              }}
            >
              {m.nombre}
            </span>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Etiqueta colores={COLOR_DISPONIBILIDAD[m.disponibilidad]}>
                {m.disponibilidad_display}
              </Etiqueta>
              {m.estado !== 'ACTIVO' && (
                <Etiqueta colores={COLOR_ESTADO[m.estado]}>
                  {m.estado_display}
                </Etiqueta>
              )}
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: 10,
                borderTop: '1px solid #EBE0E2',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Acciones
                material={m}
                onVer={onVer}
                onEditar={onEditar}
                onEliminar={onEliminar}
                onDiscontinuar={onDiscontinuar}
                onReactivar={onReactivar}
              />
            </div>
          </div>
        </div>
      ))}
    </div>

    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        marginTop: 16,
      }}
    >
      <Paginacion
        total={materiales.length}
        desde={desde}
        porPagina={porPagina}
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        onPorPagina={(n) => {
          setPorPagina(n)
          setPagina(1)
        }}
        onPagina={setPagina}
        borde={false}
      />
    </div>
    </>
  )
}

function AvisoReponer({ materiales, onReponer }) {
  if (materiales.length === 0) return null

  const titulo =
    materiales.length === 1
      ? '1 material con disponibilidad baja'
      : `${materiales.length} materiales con disponibilidad baja`

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #f0b8b0',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          background: '#FAEAE8',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C0442F"
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>

        <span
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#C0442F',
          }}
        >
          {titulo}
        </span>
      </div>

      {materiales.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 18px',
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <span style={{ fontSize: 15, color: '#3D3238' }}>{m.nombre}</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 20,
                padding: '4px 14px',
                border: '1px solid #C0442F',
                background: '#FAEAE8',
                color: '#C0442F',
              }}
            >
              Baja
            </span>

            <button
              onClick={() => onReponer(m)}
              className="btn-reponer"
              style={{
                padding: '6px 14px',
                border: '1px solid #EBE0E2',
                background: 'white',
                color: '#8C5A66',
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Reponer
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}



// Pantalla de Materiales

export default function Materiales() {
  const [parametros] = useSearchParams()
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [discAbierto, setDiscAbierto] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [materialEditando, setMaterialEditando] = useState(null)
  const [materialViendo, setMaterialViendo] = useState(null)
  const [materialEliminando, setMaterialEliminando] = useState(null)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [productos, setProductos] = useState([])
  const [vista, setVista] = useState('grid')


  // El link a los materiales de un producto llega como /materiales?producto=7.
  //
  // Se llama una sola vez, desde la carga inicial, así que no puede pisar lo
  // que la usuaria toque después.
  function aplicarProductoDeLaUrl(lista) {
    const pedido = parametros.get('producto')
    if (!pedido) return

    const producto = lista.find((p) => String(p.id) === pedido)

    // Un id que no existe se ignora: la pantalla abre normal.
    if (!producto) return

    setFiltros({ ...FILTROS_VACIOS, producto: producto.id })
  }


  // Una sola carga al montar. El buscador filtra sobre estos datos, así que
  // no vuelve a pedir nada y tampoco lleva debounce.
  useEffect(() => {
    listarMateriales()
      .then((res) => setMateriales(res.data))
      .catch(() => setError('No se pudieron cargar los materiales.'))
      .finally(() => setCargando(false))

    // Los productos son para el filtro "aparece en el producto". Cada uno
    // trae los ids de sus materiales, así que elegir uno no pide nada más.
    listarProductos()
      .then((res) => {
        setProductos(res.data)
        aplicarProductoDeLaUrl(res.data)
      })
      .catch(() => {})
  }, [])


  function recargar() {
    setCargando(true)
    listarMateriales()
      .then((res) => setMateriales(res.data))
      .catch(() => setError('No se pudieron cargar los materiales.'))
      .finally(() => setCargando(false))
  }

  // Cambia el estado de un material y refresca la lista
  async function cambiarEstado(material, accion) {
    try {
      await accion(material.id)
      recargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
  }

  // Derivados: no se guardan en estado porque se calculan de materiales.
  const filtrados = candidatos(materiales, filtros, busqueda, productos)

  const activos = filtrados.filter((m) => m.estado === 'ACTIVO')
  const discontinuados = filtrados.filter((m) => m.estado === 'DISCONTINUADO')
  const porReponer = materiales.filter((m) => m.estado === 'ACTIVO' && m.disponibilidad === 'BAJA')

  const cantFiltros = contarFiltros(filtros)

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  filtros.disponibilidades.forEach((d) =>
    chips.push({
      clave: `disp-${d}`,
      label: { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[d],
      onQuitar: () =>
        setFiltros({
          ...filtros,
          disponibilidades: filtros.disponibilidades.filter((v) => v !== d),
        }),
    })
  )

  filtros.estados.forEach((e) =>
    chips.push({
      clave: `estado-${e}`,
      label: e === 'ACTIVO' ? 'Activo' : 'Discontinuado',
      onQuitar: () =>
        setFiltros({ ...filtros, estados: filtros.estados.filter((v) => v !== e) }),
    })
  )

  // El del producto dice cuál es: es lo que explica por qué se ven 6
  // materiales de 17.
  const productoFiltrado = productos.find((p) => p.id === filtros.producto)

  if (productoFiltrado) {
    chips.push({
      clave: 'producto',
      label: `Aparece en “${productoFiltrado.nombre}”`,
      onQuitar: () => setFiltros({ ...filtros, producto: null }),
    })
  }

  const moduloVacio = !cargando && materiales.length === 0

  // Propiedades comunes a la tabla y la grilla
  const accionesComunes = {
    onVer: (m) => setMaterialViendo(m),
    onEditar: (m) => setMaterialEditando(m),
    onEliminar: (m) => setMaterialEliminando(m),
    onDiscontinuar: (m) => cambiarEstado(m, discontinuarMaterial),
    onReactivar: (m) => cambiarEstado(m, reactivarMaterial),
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 32,
            color: '#3D3238',
          }}
        >
          Gestión de Materiales
        </h1>

        <button
          onClick={() => setModalAbierto(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: '#8C5A66',
            color: 'white',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo material
        </button>


      </div>

      <AvisoReponer
        materiales={porReponer}
        onReponer={(m) => setMaterialEditando(m)}
      />

      {moduloVacio && <EstadoVacio onNuevo={() => setModalAbierto(true)} />}

      {!moduloVacio && (
        <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 420 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#857078"
            strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar material..."
            style={{
              width: '100%',
              padding: '8px 16px 8px 36px',
              border: '1px solid #EBE0E2',
              background: 'white',
              fontSize: 16,
              color: '#3D3238',
              borderRadius: 5,
              outline: 'none',
            }}
          />
        </div>

        <button
          onClick={() => setFiltrosAbiertos(true)}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            minWidth: 130,
            borderRadius: 5,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            border: filtrosAbiertos || cantFiltros ? '1px solid #8C5A66' : '1px solid #EBE0E2',
            background: filtrosAbiertos || cantFiltros ? '#F0E2E4' : 'white',
            color: '#8C5A66',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filtros
          {cantFiltros > 0 && (
            <span
              style={{
                minWidth: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                borderRadius: 10,
                background: '#8C5A66',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {cantFiltros}
            </span>
          )}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 3,
            background: 'white',
            border: '1px solid #EBE0E2',
            borderRadius: 6,
          }}
        >
          {[
            { id: 'lista', titulo: 'Ver como lista', icono: ICONO_LISTA },
            { id: 'grid', titulo: 'Ver como tarjetas', icono: ICONO_GRID },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              title={v.titulo}
              style={{
                width: 34,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
                background: vista === v.id ? '#F0E2E4' : 'transparent',
                color: vista === v.id ? '#8C5A66' : '#B08791',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={v.icono} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {chips.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          {chips.map((chip) => (
            <button
              key={chip.clave}
              onClick={chip.onQuitar}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 12px',
                borderRadius: 20,
                cursor: 'pointer',
                border: '1px solid #8C5A66',
                background: '#F0E2E4',
                color: '#8C5A66',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {chip.label}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}

          <button
            onClick={() => setFiltros(FILTROS_VACIOS)}
            style={{
              padding: '6px 12px',
              border: 0,
              background: 'transparent',
              color: '#857078',
              cursor: 'pointer',
              fontSize: 14,
              textDecoration: 'underline',
            }}
          >
            Limpiar todo
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>
      )}

      {vista === 'lista' ? (
        <Tabla materiales={activos} cargando={cargando} {...accionesComunes} />
      ) : (
        <Grilla materiales={activos} cargando={cargando} {...accionesComunes} />
      )}

      {discontinuados.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setDiscAbierto((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                transform: discAbierto ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>

            {discontinuados.length === 1
              ? '1 material discontinuado'
              : `${discontinuados.length} materiales discontinuados`}
          </button>

          {discAbierto && (
            <div style={{ marginTop: 12 }}>
              {vista === 'lista' ? (
                <Tabla materiales={discontinuados} cargando={false} {...accionesComunes} />
              ) : (
                <Grilla materiales={discontinuados} cargando={false} {...accionesComunes} />
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {(modalAbierto || materialEditando) && (
        <ModalMaterial
          material={materialEditando}
          onCerrar={() => {
            setModalAbierto(false)
            setMaterialEditando(null)
          }}
          onGuardado={() => {
            setModalAbierto(false)
            setMaterialEditando(null)
            recargar()
          }}
        />
      )}

      {materialViendo && (
        <ModalVerMaterial
          material={materialViendo}
          onCerrar={() => setMaterialViendo(null)}
        />
      )}

      {filtrosAbiertos && (
        <ModalFiltros
          filtros={filtros}
          materiales={materiales}
          productos={productos}
          busqueda={busqueda}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            setFiltros(nuevos)
            setFiltrosAbiertos(false)
          }}
        />
      )}

      {materialEliminando && (
        <ModalEliminarMaterial
          material={materialEliminando}
          onCerrar={() => setMaterialEliminando(null)}
          onEliminado={() => {
            setMaterialEliminando(null)
            recargar()
          }}
        />
      )}

    </div>
  )
}