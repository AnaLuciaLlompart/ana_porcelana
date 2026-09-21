import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarGastos } from './api'
import ModalFiltros from './ModalFiltros'
import ModalEliminarGasto from './ModalEliminarGasto'
import { FILTROS_VACIOS, candidatos, contarFiltros } from './filtros'
import {
  ICONO_BORRAR,
  ICONO_BUSCAR,
  ICONO_FILTROS,
  ICONO_GASTOS,
  ICONO_NUEVO,
  ICONO_VER,
  TIPOS,
  fmtFechaLarga,
  formatearPrecio,
} from './presentacion'

import BotonAccion from '../../componentes/BotonAccion'
import Paginacion, { paginar } from '../../componentes/Paginacion'


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
// 100 junto al 13% de ACCIONES.
const COLS = [
  { campo: 'id', label: 'GASTO', ancho: '9%', justify: 'flex-start' },
  { campo: 'tipo', label: 'TIPO', ancho: '14%', justify: 'flex-start' },
  { campo: 'fecha', label: 'FECHA', ancho: '14%', justify: 'flex-start' },
  { campo: 'descripcion', label: 'DESCRIPCIÓN', ancho: '36%', justify: 'flex-start' },
  { campo: 'monto', label: 'MONTO', ancho: '14%', justify: 'flex-end' },
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


// Los dos botones de la fila. Ver abre la ficha del gasto, igual que el
// número de la primera columna.
function Acciones({ gasto, onVer, onEliminar }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(gasto)}
        titulo="Ver gasto"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
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


function Tabla({ gastos, cargando, onVer, onEliminar }) {
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

  // Se copia con [...] para no modificar el arreglo original. Sin columna
  // elegida no se ordena nada: las filas quedan como las mandó el backend,
  // que es por fecha descendente, los gastos más nuevos arriba.
  const ordenados = [...gastos].sort((a, b) => {
    if (!orden.campo) return 0

    let cmp = 0
    if (orden.campo === 'id') {
      cmp = a.id - b.id
    } else if (orden.campo === 'tipo') {
      // Por la etiqueta y no por el código, que es lo que se lee en la
      // columna.
      cmp = a.tipo_display.localeCompare(b.tipo_display, 'es')
    } else if (orden.campo === 'fecha') {
      // Las fechas se comparan como texto: en formato ISO eso ordena bien,
      // porque el año va primero y todos los campos miden lo mismo.
      cmp = a.fecha.localeCompare(b.fecha)
    } else if (orden.campo === 'descripcion') {
      cmp = a.descripcion.localeCompare(b.descripcion, 'es')
    } else if (orden.campo === 'monto') {
      // El monto viene como texto, así que se convierte: comparándolo como
      // texto, "9000" quedaría después de "15500".
      cmp = Number(a.monto) - Number(b.monto)
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
                onClick={ordenarPor}
                justify={col.justify}
                ancho={col.ancho}
              />
            ))}
            <th style={{ ...estiloTh, textAlign: 'center', width: '13%', padding: '12px 8px' }}>
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
            visibles.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={estiloTd}>
                  <button
                    onClick={() => onVer(g)}
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
                  {formatearPrecio(g.monto)}
                </td>

                <td style={{ ...estiloTd, padding: '14px 8px' }}>
                  <Acciones gasto={g} onVer={onVer} onEliminar={onEliminar} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {!cargando && ordenados.length === 0 && <SinResultados />}

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
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [gastoEliminando, setGastoEliminando] = useState(null)

  // Una sola carga al montar. El buscador filtra sobre estos datos, así que
  // no vuelve a pedir nada y tampoco lleva debounce.
  useEffect(() => {
    listarGastos()
      .then((res) => setGastos(res.data))
      .catch(() => setError('No se pudieron cargar los gastos.'))
      .finally(() => setCargando(false))
  }, [])

  function recargar() {
    setCargando(true)
    listarGastos()
      .then((res) => setGastos(res.data))
      .catch(() => setError('No se pudieron cargar los gastos.'))
      .finally(() => setCargando(false))
  }

  // El alta y la ficha comparten pantalla, como en Pedidos.
  function nuevoGasto() {
    navegar('/gastos/nuevo')
  }

  function verGasto(gasto) {
    navegar(`/gastos/${gasto.id}`)
  }

  // Derivados: no se guardan en estado porque se calculan de gastos.
  const filtrados = candidatos(gastos, filtros, busqueda)

  // El monto llega como texto, así que se convierte antes de sumar.
  const total = filtrados.reduce((suma, g) => suma + Number(g.monto), 0)

  // La línea de abajo del título. A DIFERENCIA de Pedidos y de Clientes,
  // cuenta sobre los FILTRADOS y no sobre todos: allá el resumen dice cómo
  // viene el trabajo, acá dice cuánto suma lo que se está mirando. Filtrar
  // por período o por tipo es justamente la forma de preguntar cuánto se
  // gastó en ese período o en ese tipo.
  const resumen =
    gastos.length === 0
      ? 'Acá vas a ver todo lo que sale del emprendimiento.'
      : `${filtrados.length} ${filtrados.length === 1 ? 'gasto' : 'gastos'}` +
        ` · ${formatearPrecio(total)} en total`

  const cantFiltros = contarFiltros(filtros)

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  filtros.tipos.forEach((valor) => {
    const tipo = TIPOS.find((t) => t.valor === valor)

    chips.push({
      clave: `tipo-${valor}`,
      label: tipo.label,
      onQuitar: () =>
        setFiltros({ ...filtros, tipos: filtros.tipos.filter((v) => v !== valor) }),
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
      onQuitar: () => setFiltros({ ...filtros, desdeFecha: '', hastaFecha: '' }),
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
      onQuitar: () => setFiltros({ ...filtros, desde: '', hasta: '' }),
    })
  }

  const moduloVacio = !cargando && gastos.length === 0

  return (
    <div>
      <div
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
              flexWrap: 'wrap',
            }}
          >
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

          <Tabla
            gastos={filtrados}
            cargando={cargando}
            onVer={verGasto}
            onEliminar={(g) => setGastoEliminando(g)}
          />
        </>
      )}

      {filtrosAbiertos && (
        <ModalFiltros
          filtros={filtros}
          gastos={gastos}
          busqueda={busqueda}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            setFiltros(nuevos)
            setFiltrosAbiertos(false)
          }}
        />
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
