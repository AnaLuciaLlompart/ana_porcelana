import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listarGastos, resumenDeGastos } from './api'
import ModalFiltros from './ModalFiltros'
import ModalEliminarGasto from './ModalEliminarGasto'
import ModalVerGasto from './ModalVerGasto'
import { FILTROS_VACIOS, contarFiltros, parametrosDelListado } from './filtros'
import {
  ICONO_BORRAR,
  ICONO_BUSCAR,
  ICONO_EDITAR,
  ICONO_FILTROS,
  ICONO_GASTOS,
  ICONO_NUEVO,
  ICONO_VER,
  TIPOS,
  fmtFechaLarga,
  formatearPrecio,
} from './presentacion'

import BotonAccion from '../../componentes/BotonAccion'
import ChipSinContenido from '../../componentes/ChipSinContenido'
import ModalAviso from '../../componentes/ModalAviso'
import Paginacion from '../../componentes/Paginacion'
import { BASE_GESTION } from '../../constantes'


// El título y el texto del modal de aviso, según lo que dejó en el state la
// pantalla de la que se viene (el alta, el gasto que creó; la ficha, el que
// guardó), o null si no dejó nada. Si al guardar algún material pasó a
// disponibilidad Alta, el modal lo cuenta.
function avisoDeLaNavegacion(state) {
  if (state?.creado) {
    return {
      titulo: 'Gasto creado',
      texto: `El gasto #${state.creado} quedó creado y ya aparece en el listado.`,
    }
  }

  if (!state?.guardado) return null

  const n = state.pasaronAAlta || 0
  const alta =
    n === 0 ? '' : n === 1 ? ' 1 material pasó a disponibilidad Alta.' : ` ${n} materiales pasaron a disponibilidad Alta.`

  return {
    titulo: 'Cambios guardados',
    texto: `El gasto #${state.guardado} quedó guardado.${alta}`,
  }
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
  padding: '14px 16px',
  fontSize: 16,
  color: '#3D3238',
}

// Las columnas del listado, con los anchos del diseño. Suman exactamente
// 100 junto al 18% de ACCIONES.
const COLS = [
  { campo: 'id', label: 'GASTO', ancho: '9%', justify: 'flex-start' },
  { campo: 'tipo', label: 'TIPO', ancho: '14%', justify: 'flex-start' },
  { campo: 'fecha', label: 'FECHA', ancho: '14%', justify: 'flex-start' },
  { campo: 'descripcion', label: 'DESCRIPCIÓN', ancho: '26%', justify: 'flex-start' },
  { campo: 'monto', label: 'MONTO', ancho: '19%', justify: 'flex-end' },
]


// Encabezado de tabla clicable, con indicador de orden
function EncabezadoOrdenable({ campo, etiqueta, orden, onClick, justify, ancho }) {
  const activa = orden.campo === campo

  return (
    <th style={{ padding: 0, width: ancho }}>
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
          justifyContent: justify,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{etiqueta}</span>
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


// Los tres botones de la fila. Ver abre el gasto en un modal de solo
// lectura; Editar abre la ficha del gasto, igual que el número de la
// primera columna.
function Acciones({ gasto, onVer, onEditar, onEliminar }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(gasto)}
        titulo="Ver"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
      />
      <BotonAccion
        onClick={() => onEditar(gasto)}
        titulo="Editar"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_EDITAR}
      />
      <BotonAccion
        onClick={() => onEliminar(gasto)}
        titulo="Eliminar"
        color="#C0442F"
        hover="#FAEAE8"
        icono={ICONO_BORRAR}
      />
    </div>
  )
}


// El otro vacío: hay gastos, pero ninguno pasa la búsqueda o los filtros.
function SinResultados() {
  return (
    <div style={{ padding: 48, textAlign: 'center', borderTop: '1px solid #EBE0E2' }}>
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: '#3D3238',
        }}
      >
        Ningún gasto coincide
      </p>
      <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
        Probá con otra búsqueda o soltá los filtros.
      </p>
    </div>
  )
}


// La tabla dibuja la página que mandó el backend: el orden, los filtros y
// el corte de la página ya vienen hechos (corrección D3), como en Pedidos.
function Tabla({
  gastos,
  total,
  cargando,
  orden,
  pagina,
  porPagina,
  onOrdenar,
  onPagina,
  onPorPagina,
  onVer,
  onEditar,
  onEliminar,
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = (pagina - 1) * porPagina

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflowX: 'auto',
      }}
    >
      <table
        style={{
          width: '100%',
          minWidth: 760,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
        }}
      >
        <thead style={{ background: '#F0E2E4' }}>
          <tr>
            {COLS.map((col) => (
              <EncabezadoOrdenable
                key={col.campo}
                campo={col.campo}
                etiqueta={col.label}
                orden={orden}
                onClick={onOrdenar}
                justify={col.justify}
                ancho={col.ancho}
              />
            ))}
            <th style={{ ...estiloTh, textAlign: 'center', width: '18%', padding: '12px 8px' }}>
              ACCIONES
            </th>
          </tr>
        </thead>

        <tbody>
          {cargando && (
            <tr>
              <td colSpan={6} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                Cargando…
              </td>
            </tr>
          )}

          {!cargando &&
            gastos.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={estiloTd}>
                  <button
                    onClick={() => onEditar(g)}
                    className="btn-usuario"
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 16,
                      color: '#3D3238',
                    }}
                  >
                    #{g.id}
                  </button>
                </td>

                {/* La etiqueta la manda el backend: acá no se traduce
                    ningún código. */}
                <td style={{ ...estiloTd, fontSize: 15 }}>{g.tipo_display}</td>

                <td style={{ ...estiloTd, whiteSpace: 'nowrap', fontSize: 15 }}>
                  {fmtFechaLarga(g.fecha)}
                </td>

                <td style={estiloTd}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.3, textWrap: 'pretty' }}>
                    {g.descripcion || 'Sin descripción'}
                  </p>

                  {/* Los materiales del gasto se usan acá solo para
                      contarlos: el detalle se ve en la ficha. */}
                  {g.materiales.length > 0 && (
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: '#B08791' }}>
                      {g.materiales.length === 1
                        ? '1 material'
                        : `${g.materiales.length} materiales`}
                    </p>
                  )}
                </td>

                <td
                  style={{
                    ...estiloTd,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  {/* Sin filas, el chip en lugar del $0: el monto es cero
                      por definición y el chip dice por qué. MONTO pasó de
                      14% a 19% (y DESCRIPCIÓN de 36 a 31) para que entre en
                      el mínimo de 760. */}
                  {g.tipo === 'MATERIALES' && g.materiales.length === 0 ? (
                    <ChipSinContenido texto="Sin materiales" title="Cargale los materiales desde la ficha" />
                  ) : (
                    formatearPrecio(g.monto)
                  )}
                </td>

                <td style={{ ...estiloTd, padding: '14px 8px' }}>
                  <Acciones gasto={g} onVer={onVer} onEditar={onEditar} onEliminar={onEliminar} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {!cargando && total === 0 && <SinResultados />}

      <Paginacion
        total={total}
        desde={desde}
        porPagina={porPagina}
        pagina={pagina}
        totalPaginas={totalPaginas}
        onPorPagina={onPorPagina}
        onPagina={onPagina}
      />
    </div>
  )
}


// Lo que se ve cuando todavía no hay ningún gasto registrado. Es distinto
// de "ningún gasto coincide": ahí hay gastos y no los encontró ni la
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
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_GASTOS} />
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
        Todavía no registraste ningún gasto
      </p>

      <p style={{ margin: 0, maxWidth: 430, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Anotá acá las compras de materiales, la publicidad y cualquier otro egreso
        del emprendimiento.
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
          <path strokeLinecap="round" d={ICONO_NUEVO} />
        </svg>
        Registrar el primero
      </button>
    </div>
  )
}


// Pantalla de Gastos

export default function Gastos() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  // La página que mandó el backend y cuántos gastos hay con los filtros
  // puestos (el count de la paginación).
  const [gastos, setGastos] = useState([])
  const [total, setTotal] = useState(0)
  // Cuánto suman los filtrados y el monto más alto, de /gastos/resumen/.
  const [resumenDatos, setResumenDatos] = useState(null)
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
  // Sube en uno cada vez que hay que volver a pedir la misma página.
  const [version, setVersion] = useState(0)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [gastoEliminando, setGastoEliminando] = useState(null)
  const [gastoViendo, setGastoViendo] = useState(null)

  // El modal de aviso del alta o de la ficha, que dejan en el state de la
  // navegación el gasto que crearon o guardaron. Se lee al montar.
  const [aviso, setAviso] = useState(() => avisoDeLaNavegacion(ubicacion.state))

  // El debounce del buscador, como en Pedidos: 300 ms después de la última
  // tecla se manda el texto y se vuelve a la página 1.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaEnviada(busqueda)
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La página del listado, cada vez que cambia algo de lo que la define. Si
  // llegan dos respuestas fuera de orden, vigente descarta la vieja.
  useEffect(() => {
    let vigente = true
    const parametros = parametrosDelListado({ filtros, busqueda: busquedaEnviada, orden, pagina, porPagina })

    listarGastos(parametros)
      .then((res) => {
        if (!vigente) return
        setGastos(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe (se eliminó el último gasto de la
        // última página) responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los gastos.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, orden, pagina, porPagina, version])

  // El resumen suma lo FILTRADO, así que va con los mismos filtros y la
  // misma búsqueda, sin la página ni el orden.
  useEffect(() => {
    let vigente = true

    resumenDeGastos(parametrosDelListado({ filtros, busqueda: busquedaEnviada }))
      .then((res) => {
        if (vigente) setResumenDatos(res.data)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, version])

  // Ya leído, el state se borra, así el aviso no reaparece al recargar ni al
  // volver con Atrás.
  useEffect(() => {
    if (!ubicacion.state) return
    navegar(`${ubicacion.pathname}${ubicacion.search}`, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Vuelve a pedir la página que se está mirando y el resumen.
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

  // El alta es otra pantalla, como en Productos y Pedidos.
  function nuevoGasto() {
    navegar(`${BASE_GESTION}/gastos/nuevo`)
  }

  function verGasto(gasto) {
    navegar(`${BASE_GESTION}/gastos/${gasto.id}`)
  }

  const cantFiltros = contarFiltros(filtros)

  // Sin gastos de ningún tipo: la respuesta vino vacía sin filtros ni
  // búsqueda. Con filtros y vacía es "ningún gasto coincide", otra cosa.
  const moduloVacio = !cargando && total === 0 && cantFiltros === 0 && busquedaEnviada.trim() === ''

  // La línea de abajo del título. A DIFERENCIA de Pedidos y de Clientes,
  // cuenta sobre los FILTRADOS y no sobre todos: allá el resumen dice cómo
  // viene el trabajo, acá dice cuánto suma lo que se está mirando. Filtrar
  // por período o por tipo es justamente la forma de preguntar cuánto se
  // gastó en ese período o en ese tipo.
  // Los números vienen del backend (/gastos/resumen/).
  let resumen = ''
  if (moduloVacio) {
    resumen = 'Acá vas a ver todo lo que sale del emprendimiento.'
  } else if (resumenDatos) {
    const { cantidad, monto_total: montoTotal } = resumenDatos
    resumen = `${cantidad} ${cantidad === 1 ? 'gasto' : 'gastos'} · ${formatearPrecio(montoTotal)} en total`
  }

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  filtros.tipos.forEach((valor) => {
    const tipo = TIPOS.find((t) => t.valor === valor)

    chips.push({
      clave: `tipo-${valor}`,
      label: tipo.label,
      onQuitar: () =>
        cambiarFiltros({ ...filtros, tipos: filtros.tipos.filter((v) => v !== valor) }),
    })
  })

  if (filtros.desdeFecha !== '' || filtros.hastaFecha !== '') {
    const label =
      filtros.desdeFecha !== '' && filtros.hastaFecha !== ''
        ? `${fmtFechaLarga(filtros.desdeFecha)} – ${fmtFechaLarga(filtros.hastaFecha)}`
        : filtros.desdeFecha !== ''
          ? `Desde ${fmtFechaLarga(filtros.desdeFecha)}`
          : `Hasta ${fmtFechaLarga(filtros.hastaFecha)}`

    chips.push({
      clave: 'periodo',
      label,
      onQuitar: () => cambiarFiltros({ ...filtros, desdeFecha: '', hastaFecha: '' }),
    })
  }

  if (filtros.desde !== '' || filtros.hasta !== '') {
    const label =
      filtros.desde !== '' && filtros.hasta !== ''
        ? `${formatearPrecio(filtros.desde)} – ${formatearPrecio(filtros.hasta)}`
        : filtros.desde !== ''
          ? `Desde ${formatearPrecio(filtros.desde)}`
          : `Hasta ${formatearPrecio(filtros.hasta)}`

    chips.push({
      clave: 'monto',
      label,
      onQuitar: () => cambiarFiltros({ ...filtros, desde: '', hasta: '' }),
    })
  }

  return (
    <div>
      <div
        className="encabezado-pantalla"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
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
          Gestión de Gastos
        </h1>

        <button
          onClick={nuevoGasto}
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
            <path strokeLinecap="round" d={ICONO_NUEVO} />
          </svg>
          Nuevo gasto
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>{resumen}</p>

      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}

      {moduloVacio && <EstadoVacio onNuevo={nuevoGasto} />}

      {!moduloVacio && (
        <>
          <div
            className="barra-herramientas"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
              flexWrap: 'wrap',
            }}
          >
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
                <path strokeLinecap="round" d={ICONO_BUSCAR} />
              </svg>

              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por descripción, tipo o material..."
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
              className="boton-filtros"
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
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
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
          </div>

          {chips.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 18,
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

          <Tabla
            gastos={gastos}
            total={total}
            cargando={cargando}
            orden={orden}
            pagina={pagina}
            porPagina={porPagina}
            onOrdenar={ordenarPor}
            onPagina={setPagina}
            onPorPagina={(n) => {
              setPorPagina(n)
              setPagina(1)
            }}
            onVer={(g) => setGastoViendo(g)}
            onEditar={verGasto}
            onEliminar={(g) => setGastoEliminando(g)}
          />
        </>
      )}

      {filtrosAbiertos && (
        <ModalFiltros
          filtros={filtros}
          montoMaximo={resumenDatos ? resumenDatos.monto_maximo : '0'}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            cambiarFiltros(nuevos)
            setFiltrosAbiertos(false)
          }}
        />
      )}

      {gastoViendo && (
        <ModalVerGasto
          gasto={gastoViendo}
          onCerrar={() => setGastoViendo(null)}
          onEditar={() => verGasto(gastoViendo)}
        />
      )}

      {aviso && (
        <ModalAviso titulo={aviso.titulo} texto={aviso.texto} onCerrar={() => setAviso(null)} />
      )}

      {gastoEliminando && (
        <ModalEliminarGasto
          gasto={gastoEliminando}
          onCerrar={() => setGastoEliminando(null)}
          onEliminado={() => {
            setGastoEliminando(null)
            recargar()
          }}
        />
      )}
    </div>
  )
}
