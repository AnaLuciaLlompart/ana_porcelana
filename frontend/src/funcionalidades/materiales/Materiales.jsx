import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  exportarMaterialesAExcel,
  listarMateriales,
  reactivarMaterial,
  urlExportarMaterialesPdf,
} from './api'
import ModalMaterial from './ModalMaterial'
import ModalVerMaterial from './ModalVerMaterial'
import ModalDiscontinuarMaterial from './ModalDiscontinuarMaterial'
import ModalEliminarMaterial from './ModalEliminarMaterial'
import ModalFiltros from './ModalFiltros'
import { FILTROS_VACIOS, contarFiltros, parametrosDelListado } from './filtros'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hacen falta los productos
// para el filtro "aparece en el producto".
import { listarProductos } from '../productos/api'

import BotonAccion from '../../componentes/BotonAccion'
import BotonesExportar from '../../componentes/BotonesExportar'
import ModalAviso from '../../componentes/ModalAviso'
import Paginacion from '../../componentes/Paginacion'


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
  color: 'white',
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

// El pie de páginas de una lista paginada en el backend (corrección D3).
// paginacion es { total, pagina, porPagina, onPagina, onPorPagina }.
function PieDePaginas({ paginacion, borde }) {
  const { total, pagina, porPagina, onPagina, onPorPagina } = paginacion

  return (
    <Paginacion
      total={total}
      desde={(pagina - 1) * porPagina}
      porPagina={porPagina}
      pagina={pagina}
      totalPaginas={Math.max(1, Math.ceil(total / porPagina))}
      onPorPagina={onPorPagina}
      onPagina={onPagina}
      borde={borde}
    />
  )
}

// La tabla dibuja lo que mandó el backend, ya filtrado y ordenado. Con
// paginacion lleva el pie de páginas: es la lista de los activos. Sin ella
// es la sección de discontinuados, que viene entera.
function Tabla({ materiales, cargando, orden, onOrdenar, paginacion, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflowX: 'auto',
      }}
    >
      <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
        <thead style={{ background: '#8C5A66' }}>
          <tr>
            <EncabezadoOrdenable campo="nombre" etiqueta="MATERIAL" orden={orden} onClick={onOrdenar} />
            <EncabezadoOrdenable campo="disponibilidad" etiqueta="DISPONIBILIDAD" orden={orden} onClick={onOrdenar} centrado />
            <EncabezadoOrdenable campo="estado" etiqueta="ESTADO" orden={orden} onClick={onOrdenar} centrado />
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
            materiales.map((m) => (
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

      {!cargando && materiales.length === 0 && <SinResultados />}

      {paginacion && <PieDePaginas paginacion={paginacion} />}
    </div>
  )
}


// La grilla, igual que la tabla: con paginacion lleva el pie de páginas.
function Grilla({ materiales, cargando, paginacion, onVer, onEditar, onEliminar, onDiscontinuar, onReactivar }) {
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

    {paginacion && (
      <div
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
          marginTop: 16,
        }}
      >
        <PieDePaginas paginacion={paginacion} borde={false} />
      </div>
    )}
    </>
  )
}

// Las filas miden siempre lo mismo para que la caja muestre cuatro justas:
// de la quinta en adelante se ven deslizando dentro del aviso, sin empujar
// la tabla hacia abajo.
const FILAS_VISIBLES = 4
const ALTO_FILA = 58

function AvisoReponer({ materiales, onReponer }) {
  // El encabezado abre y cierra la lista, para ahorrar lugar. Arranca
  // abierta. useState va antes del return: un hook no puede quedar
  // salteado según lo que llegue.
  const [abierto, setAbierto] = useState(true)

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
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        title={abierto ? 'Esconder la lista' : 'Mostrar la lista'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          border: 0,
          background: '#FAEAE8',
          cursor: 'pointer',
          textAlign: 'left',
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

        {/* La flechita apunta hacia arriba abierta y hacia abajo cerrada. */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C0442F"
          strokeWidth="2"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            transform: abierto ? 'rotate(180deg)' : 'none',
            transition: 'transform .2s',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
      <div style={{ maxHeight: FILAS_VISIBLES * ALTO_FILA, overflowY: 'auto' }}>
      {materiales.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            height: ALTO_FILA,
            padding: '0 18px',
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
      )}
    </div>
  )
}



// Pantalla de Materiales

export default function Materiales() {
  const [parametros] = useSearchParams()
  // Las tres listas que pide la pantalla (corrección D3): la página de los
  // activos, con cuántos hay en total; los discontinuados, enteros, para su
  // sección; y los que hay que reponer, para el aviso de arriba, que no
  // depende de los filtros.
  const [materiales, setMateriales] = useState([])
  const [total, setTotal] = useState(0)
  const [discontinuados, setDiscontinuados] = useState([])
  const [porReponer, setPorReponer] = useState([])
  // Solo la primera carga, como en Pedidos.
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Lo que se escribe en el buscador, y lo que se manda 300 ms después de
  // la última tecla (debounce).
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(12)
  // Sube en uno cada vez que hay que volver a pedir las listas.
  const [version, setVersion] = useState(0)
  const [discAbierto, setDiscAbierto] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [materialEditando, setMaterialEditando] = useState(null)
  const [materialViendo, setMaterialViendo] = useState(null)
  const [materialDiscontinuando, setMaterialDiscontinuando] = useState(null)
  const [materialEliminando, setMaterialEliminando] = useState(null)
  // El modal "Material creado" o "Cambios guardados", como en productos,
  // pedidos y gastos.
  const [aviso, setAviso] = useState(null)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  // El link a los materiales de un producto llega como
  // /materiales?producto=7: el filtro arranca con ese producto. Se lee una
  // sola vez, al montar, así que no pisa lo que la usuaria toque después.
  const [filtros, setFiltros] = useState(() => {
    const producto = parametros.get('producto')
    return producto && /^\d+$/.test(producto)
      ? { ...FILTROS_VACIOS, producto: Number(producto) }
      : FILTROS_VACIOS
  })
  const [productos, setProductos] = useState([])
  const [vista, setVista] = useState('grid')


  // Los productos son para el filtro "aparece en el producto" (la lista del
  // modal y el nombre del chip). Se piden recién al abrir el modal, o al
  // entrar si se llegó con ?producto=, para no demorar la primera página,
  // como los clientes en Pedidos.
  function cargarProductos() {
    if (productos.length > 0) return

    listarProductos()
      .then((res) => setProductos(res.data))
      .catch(() => {})
  }

  useEffect(() => {
    if (filtros.producto !== null) cargarProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function abrirFiltros() {
    setFiltrosAbiertos(true)
    cargarProductos()
  }

  // El debounce del buscador, como en Pedidos: 300 ms después de la última
  // tecla se manda el texto y se vuelve a la página 1.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaEnviada(busqueda)
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La página de los activos, cada vez que cambia algo de lo que la define.
  // Si llegan dos respuestas fuera de orden, vigente descarta la vieja.
  useEffect(() => {
    let vigente = true
    const pedido = parametrosDelListado({
      filtros, busqueda: busquedaEnviada, orden, estado: 'ACTIVO', pagina, porPagina,
    })

    // Con solo "Discontinuado" en el filtro de estado no hay activos que
    // pedir.
    if (pedido === null) {
      setMateriales([])
      setTotal(0)
      setCargando(false)
      return
    }

    listarMateriales(pedido)
      .then((res) => {
        if (!vigente) return
        setMateriales(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los materiales.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, orden, pagina, porPagina, version])

  // Los discontinuados, enteros: son pocos y su sección está colapsada. Con
  // los mismos filtros y la misma búsqueda que la lista de arriba.
  useEffect(() => {
    let vigente = true
    const pedido = parametrosDelListado({ filtros, busqueda: busquedaEnviada, orden, estado: 'DISCONTINUADO' })

    if (pedido === null) {
      setDiscontinuados([])
      return
    }

    listarMateriales(pedido)
      .then((res) => {
        if (vigente) setDiscontinuados(res.data)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, orden, version])

  // Los que hay que reponer, para el aviso de arriba: todos los activos en
  // disponibilidad Baja, sin mirar los filtros.
  useEffect(() => {
    listarMateriales({ estado: 'ACTIVO', disponibilidad: 'BAJA' })
      .then((res) => setPorReponer(res.data))
      .catch(() => {})
  }, [version])

  // Vuelve a pedir las tres listas.
  function recargar() {
    setVersion((v) => v + 1)
  }

  // Cambiar los filtros o el orden vuelve a la página 1.
  function cambiarFiltros(nuevos) {
    setFiltros(nuevos)
    setPagina(1)
  }

  // Alterna asc/desc, o empieza en asc si es una columna nueva.
  function ordenarPor(campo) {
    setOrden((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
    setPagina(1)
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

  const cantFiltros = contarFiltros(filtros)

  // Lo que necesitan la tabla y la grilla de los activos para su pie.
  const paginacion = {
    total,
    pagina,
    porPagina,
    onPagina: setPagina,
    onPorPagina: (n) => {
      setPorPagina(n)
      setPagina(1)
    },
  }

  // Lo que se exporta es lo que muestra la pantalla, activos y
  // discontinuados juntos: los mismos filtros, la búsqueda ya enviada y el
  // orden, sin página (corrección E10).
  const parametrosExportar = parametrosDelListado({ filtros, busqueda: busquedaEnviada, orden })

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  filtros.disponibilidades.forEach((d) =>
    chips.push({
      clave: `disp-${d}`,
      label: { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[d],
      onQuitar: () =>
        cambiarFiltros({
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
        cambiarFiltros({ ...filtros, estados: filtros.estados.filter((v) => v !== e) }),
    })
  )

  // El del producto dice cuál es: es lo que explica por qué se ven 6
  // materiales de 17.
  const productoFiltrado = productos.find((p) => p.id === filtros.producto)

  if (productoFiltrado) {
    chips.push({
      clave: 'producto',
      label: `Aparece en “${productoFiltrado.nombre}”`,
      onQuitar: () => cambiarFiltros({ ...filtros, producto: null }),
    })
  }

  // Sin materiales de ningún tipo: las dos listas vinieron vacías sin
  // filtros ni búsqueda.
  const moduloVacio =
    !cargando && total === 0 && discontinuados.length === 0 && cantFiltros === 0 && busquedaEnviada.trim() === ''

  // Propiedades comunes a la tabla y la grilla
  const accionesComunes = {
    onVer: (m) => setMaterialViendo(m),
    onEditar: (m) => setMaterialEditando(m),
    onEliminar: (m) => setMaterialEliminando(m),
    onDiscontinuar: (m) => setMaterialDiscontinuando(m),
    onReactivar: (m) => cambiarEstado(m, reactivarMaterial),
  }

  return (
    <div>
      <div
        className="encabezado-pantalla"
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

      {error && (
        <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>
      )}

      {moduloVacio && !error && <EstadoVacio onNuevo={() => setModalAbierto(true)} />}

      {!moduloVacio && (
        <>
      <div className="barra-herramientas" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div className="buscador" style={{ position: 'relative', width: 420 }}>
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
              height: 40,
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
          className="boton-filtros"
          onClick={abrirFiltros}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            minWidth: 130,
            height: 40,
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

        {/* Filtros queda pegado al buscador; la vista y exportar, a la
            derecha. En pantalla chica bajan juntos a un renglón propio
            (acciones-derecha en index.css). */}
        <div className="acciones-derecha" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              height: 40,
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

          <BotonesExportar
            urlPdf={urlExportarMaterialesPdf(parametrosExportar)}
            pedirExcel={() => exportarMaterialesAExcel(parametrosExportar)}
            deshabilitado={total + discontinuados.length === 0}
            motivo="No hay materiales para exportar"
          />
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
            onClick={() => cambiarFiltros(FILTROS_VACIOS)}
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

      {vista === 'lista' ? (
        <Tabla
          materiales={materiales}
          cargando={cargando}
          orden={orden}
          onOrdenar={ordenarPor}
          paginacion={paginacion}
          {...accionesComunes}
        />
      ) : (
        <Grilla materiales={materiales} cargando={cargando} paginacion={paginacion} {...accionesComunes} />
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
                <Tabla
                  materiales={discontinuados}
                  cargando={false}
                  orden={orden}
                  onOrdenar={ordenarPor}
                  {...accionesComunes}
                />
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
          onGuardado={(guardado) => {
            setAviso(
              materialEditando
                ? { titulo: 'Cambios guardados', texto: `«${guardado.nombre}» quedó guardado.` }
                : {
                    titulo: 'Material creado',
                    texto: `«${guardado.nombre}» quedó creado y ya aparece en el listado.`,
                  }
            )
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
          productos={productos}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            cambiarFiltros(nuevos)
            setFiltrosAbiertos(false)
          }}
        />
      )}

      {materialDiscontinuando && (
        <ModalDiscontinuarMaterial
          material={materialDiscontinuando}
          onCerrar={() => setMaterialDiscontinuando(null)}
          onConfirmado={() => {
            setMaterialDiscontinuando(null)
            recargar()
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

      {aviso && (
        <ModalAviso titulo={aviso.titulo} texto={aviso.texto} onCerrar={() => setAviso(null)} />
      )}
    </div>
  )
}