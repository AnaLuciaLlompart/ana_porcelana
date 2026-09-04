import { useEffect, useState } from 'react'
import { listarMateriales, discontinuarMaterial, reactivarMaterial } from './api'
import ModalMaterial from './ModalMaterial'
import ModalVerMaterial from './ModalVerMaterial'
import ModalEliminarMaterial from './ModalEliminarMaterial'


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

// Iconos del conmutador de vista
const ICONO_LISTA = 'M4 6h16M4 12h16M4 18h16'
const ICONO_GRID = 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'

// Orden lógico de los valores, no alfabético
const ORDEN_DISPONIBILIDAD = { ALTA: 0, MEDIA: 1, BAJA: 2 }
const ORDEN_ESTADO = { ACTIVO: 0, DISCONTINUADO: 1 }

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

function BotonAccion({ onClick, titulo, color, hover, icono }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className="btn-accion"
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        borderRadius: 5,
        cursor: 'pointer',
        color,
        '--hover': hover,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
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
        icono={ICONO_VER}
      />

      {activo && (
        <>
          <BotonAccion
            onClick={() => onEditar(material)}
            titulo="Editar"
            color="#8C5A66"
            hover="#F0E2E4"
            icono={ICONO_EDITAR}
          />
          <BotonAccion
            onClick={() => onDiscontinuar(material)}
            titulo="Discontinuar"
            color="#D9A441"
            hover="#FDF3E0"
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
          icono={ICONO_ALTA}
        />
      )}

      <BotonAccion
        onClick={() => onEliminar(material)}
        titulo="Eliminar"
        color="#C0442F"
        hover="#FAEAE8"
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

// Flechas de anterior y siguiente del pie de tabla
function BotonPagina({ onClick, deshabilitado, icono }) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #EBE0E2',
        background: 'white',
        borderRadius: 5,
        cursor: deshabilitado ? 'default' : 'pointer',
        opacity: deshabilitado ? 0.3 : 1,
        color: '#8C5A66',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}

function Tabla({ materiales, vacio, cargando, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })
  const [porPagina, setPorPagina] = useState(10)
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

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * porPagina
  const visibles = ordenados.slice(desde, desde + porPagina)

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

          {!cargando && visibles.length === 0 && vacio && (
            <tr>
              <td colSpan={4} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                {vacio}
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          padding: '12px 20px',
          borderTop: '1px solid #EBE0E2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#857078' }}>Filas por página</span>
          <select
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value))
              setPagina(1)
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid #EBE0E2',
              borderRadius: 5,
              background: 'white',
              color: '#3D3238',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <span style={{ fontSize: 13, color: '#857078' }}>
          {ordenados.length === 0
            ? '0 de 0'
            : `${desde + 1}–${Math.min(desde + porPagina, ordenados.length)} de ${ordenados.length}`}
        </span>

        <div style={{ display: 'flex', gap: 6 }}>
          <BotonPagina
            onClick={() => setPagina(paginaActual - 1)}
            deshabilitado={paginaActual <= 1}
            icono="M15 19l-7-7 7-7"
          />
          <BotonPagina
            onClick={() => setPagina(paginaActual + 1)}
            deshabilitado={paginaActual >= totalPaginas}
            icono="M9 5l7 7-7 7"
          />
        </div>
      </div>
    </div>
  )
}


function Grilla({ materiales, vacio, cargando, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
  if (cargando) {
    return <p style={{ color: '#857078' }}>Cargando…</p>
  }

  if (materiales.length === 0) {
    return vacio ? <p style={{ color: '#857078' }}>{vacio}</p> : null
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 300px))',
        gap: 16,
      }}
    >
      {materiales.map((m) => (
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

function Chip({ etiqueta, activo, color, fondo, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px',
        borderRadius: 20,
        cursor: 'pointer',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        border: activo ? `1px solid ${color}` : '1px solid #EBE0E2',
        background: activo ? fondo : 'white',
        color: activo ? color : '#857078',
      }}
    >
      {etiqueta}
    </button>
  )
}


function PanelFiltros({ fDisp, setFDisp, fEstado, setFEstado, cantidad }) {
  // Agrega o quita un valor de una lista de filtros.
  function alternar(lista, setLista, valor) {
    setLista(
      lista.includes(valor)
        ? lista.filter((v) => v !== valor)
        : [...lista, valor]
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 40,
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: '18px 20px',
        marginBottom: 16,
      }}
    >
      <div>
        <div style={estiloGrupo}>DISPONIBILIDAD</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['ALTA', 'MEDIA', 'BAJA'].map((v) => (
            <Chip
              key={v}
              etiqueta={{ ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[v]}
              activo={fDisp.includes(v)}
              color={COLOR_DISPONIBILIDAD[v].texto}
              fondo={COLOR_DISPONIBILIDAD[v].fondo}
              onClick={() => alternar(fDisp, setFDisp, v)}
            />
          ))}
        </div>
      </div>

      <div>
        <div style={estiloGrupo}>ESTADO</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['ACTIVO', 'DISCONTINUADO'].map((v) => (
            <Chip
              key={v}
              etiqueta={{ ACTIVO: 'Activo', DISCONTINUADO: 'Discontinuado' }[v]}
              activo={fEstado.includes(v)}
              color={COLOR_ESTADO[v].texto}
              fondo={COLOR_ESTADO[v].fondo}
              onClick={() => alternar(fEstado, setFEstado, v)}
            />
          ))}
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 14, color: '#857078' }}>
          {cantidad === 1 ? '1 material' : `${cantidad} materiales`}
        </span>

        <button
          onClick={() => {
            setFDisp([])
            setFEstado([])
          }}
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
          Limpiar
        </button>
      </div>
    </div>
  )
}

const estiloGrupo = {
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#857078',
  marginBottom: 10,
}


// Pantalla de Materiales

export default function Materiales() {
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
  const [fDisp, setFDisp] = useState([])
  const [fEstado, setFEstado] = useState([])
  const [vista, setVista] = useState('lista')

  useEffect(() => {
    // El debounce espera 300 ms desde la última tecla. El clearTimeout
    // del return cancela la espera anterior, así sale un solo pedido.
    const tiempo = setTimeout(() => {
      setCargando(true)

      listarMateriales(busqueda ? { search: busqueda } : {})
        .then((res) => {
          setMateriales(res.data)
          setError('')
        })
        .catch(() => setError('No se pudieron cargar los materiales.'))
        .finally(() => setCargando(false))
    }, 300)

    return () => clearTimeout(tiempo)
  }, [busqueda])


  function recargar() {
    setCargando(true)
    listarMateriales(busqueda ? { search: busqueda } : {})
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
  const filtrados = materiales.filter(
    (m) =>
      (fDisp.length === 0 || fDisp.includes(m.disponibilidad)) &&
      (fEstado.length === 0 || fEstado.includes(m.estado))
  )

  const activos = filtrados.filter((m) => m.estado === 'ACTIVO')
  const discontinuados = filtrados.filter((m) => m.estado === 'DISCONTINUADO')
  const porReponer = materiales.filter((m) => m.estado === 'ACTIVO' && m.disponibilidad === 'BAJA')

  const cantFiltros = fDisp.length + fEstado.length

  const vacio = busqueda
    ? 'No se encontraron materiales con esa búsqueda.'
    : 'Todavía no hay materiales activos.'

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
          onClick={() => setFiltrosAbiertos((v) => !v)}
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

      {filtrosAbiertos && (
        <PanelFiltros
          fDisp={fDisp}
          setFDisp={setFDisp}
          fEstado={fEstado}
          setFEstado={setFEstado}
          cantidad={filtrados.length}
        />
      )}

      {error && (
        <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>
      )}

      {vista === 'lista' ? (
        <Tabla materiales={activos} cargando={cargando} vacio={vacio} {...accionesComunes} />
      ) : (
        <Grilla materiales={activos} cargando={cargando} vacio={vacio} {...accionesComunes} />
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
                <Tabla materiales={discontinuados} cargando={false} vacio="" {...accionesComunes} />
              ) : (
                <Grilla materiales={discontinuados} cargando={false} vacio="" {...accionesComunes} />
              )}
            </div>
          )}
        </div>
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