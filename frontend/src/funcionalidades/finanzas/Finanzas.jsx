import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { obtenerFinanzas } from './api'
import {
  FECHAS_AL_REVES,
  PERIODOS,
  claveDelPeriodo,
  etiquetaMes,
  nombreMes,
  problemaDelPersonalizado,
  rangoDelPeriodo,
  subtituloEvolucion,
} from './periodos'

// Imports que cruzan de funcionalidad, con el mismo criterio de siempre: la
// pieza se queda en la funcionalidad donde nació y las demás la usan desde
// ahí. El precio se formatea igual en todo el sistema, y la fecha larga
// ("16 sep 2026") es la que usa el prototipo en las dos tablas.
import { formatearPrecio } from '../productos/presentacion'
import { fmtFechaLarga } from '../pedidos/presentacion'

import Paginacion, { paginar } from '../../componentes/Paginacion'


// El ancho de las tarjetas, del prototipo.
const ANCHO_MAXIMO = 1140

// Los dos colores del gráfico: el verde de los ingresos y el rosa de los
// gastos. Son los mismos de la leyenda, las barras y el tooltip.
const VERDE = '#4E8C6A'
const ROSA = '#B08791'

const QUICKSAND = "'Quicksand', sans-serif"

const estiloTarjeta = {
  background: 'white',
  border: '1px solid #EBE0E2',
  borderRadius: 8,
}

// Los títulos en mayúsculas de cada sección: PERÍODO, EVOLUCIÓN, INGRESOS,
// GASTOS.
const estiloTituloSeccion = {
  margin: 0,
  fontFamily: QUICKSAND,
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '.06em',
  color: '#8C5A66',
}

const estiloTh = {
  padding: '10px 8px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontFamily: QUICKSAND,
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#8C5A66',
}

const estiloTd = {
  padding: '13px 8px',
  fontSize: 15,
  color: '#3D3238',
}

const estiloFecha = {
  padding: '7px 11px',
  border: '1px solid #EBE0E2',
  fontSize: 15,
  color: '#3D3238',
  background: '#FAF7F7',
  borderRadius: 6,
  outline: 'none',
}


// El importe con el signo adelante, como el prototipo. formatearPrecio con
// un negativo devuelve "$-19.500", y lo que se quiere es "−$19.500".
function importeConSigno(texto) {
  const numero = Number(texto)

  return (numero < 0 ? '−' : '') + formatearPrecio(Math.abs(numero))
}

// El texto chico de abajo de cada número: "Sin cobros en el período",
// "1 cobro registrado", "2 cobros registrados".
function detalleCantidad(cantidad, singular, plural) {
  if (cantidad === 0) return `Sin ${plural} en el período`
  if (cantidad === 1) return `1 ${singular} registrado`

  return `${cantidad} ${plural} registrados`
}

// Las tres caras del resultado, como el prototipo: gris cuando no hubo
// movimientos, verde si entró más de lo que salió, rojo si salió más.
//
// Los importes llegan como TEXTO ("49400.00"), porque DRF serializa así los
// decimales para que no pierdan precisión. Hay que convertirlos antes de
// compararlos con cero.
function caraDelResultado(totales) {
  const ingresos = Number(totales.ingresos)
  const gastos = Number(totales.gastos)

  if (ingresos === 0 && gastos === 0) {
    return { color: '#857078', fondo: '#FAF7F7', texto: 'Sin movimientos' }
  }

  if (Number(totales.resultado) >= 0) {
    return { color: '#4E8C6A', fondo: '#E8F5EF', texto: 'Entró más de lo que salió' }
  }

  return { color: '#C0442F', fondo: '#FAEAE8', texto: 'Salió más de lo que entró' }
}


// Una de las tres tarjetas de arriba: INGRESOS, GASTOS y RESULTADO. Las dos
// primeras llevan el detalle con la cantidad; la tercera, el chip.
function TarjetaNumero({ titulo, valor, detalle, color, chip }) {
  return (
    <div style={{ ...estiloTarjeta, padding: '20px 22px' }}>
      <p
        style={{
          margin: 0,
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: '.06em',
          color: '#857078',
        }}
      >
        {titulo}
      </p>

      <p
        style={{
          margin: '10px 0 0',
          fontFamily: QUICKSAND,
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1.1,
          color: color || '#3D3238',
        }}
      >
        {valor}
      </p>

      {detalle && <p style={{ margin: '8px 0 0', fontSize: 14, color: '#857078' }}>{detalle}</p>}

      {chip && (
        <span
          style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '4px 11px',
            borderRadius: 20,
            border: `1px solid ${chip.color}`,
            background: chip.fondo,
            fontFamily: QUICKSAND,
            fontWeight: 600,
            fontSize: 13,
            color: chip.color,
          }}
        >
          {chip.texto}
        </span>
      )}
    </div>
  )
}


// La escala del eje del gráfico, del prototipo: el mayor valor de la serie,
// con un piso para que una serie chica no quede toda en el techo, redondeado
// hacia arriba al múltiplo siguiente.
const PISO_ESCALA = 10000
const PASO_ESCALA = 25000

// "$25k" para el eje; por debajo de mil, el número entero.
function fmtCorto(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

// Un cuadradito de color con su texto, para la leyenda del gráfico.
function Leyenda({ color, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 14, color: '#857078' }}>{texto}</span>
    </div>
  )
}

// Una línea del tooltip: el cuadradito, la etiqueta y el importe a la derecha.
function FilaTooltip({ color, etiqueta, valor, conMargen }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: conMargen ? 4 : 0,
        fontSize: 13,
        color: '#857078',
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      <span>{etiqueta}</span>
      <span style={{ marginLeft: 'auto', paddingLeft: 12, fontWeight: 600, color: '#3D3238' }}>
        {valor}
      </span>
    </div>
  )
}


// El gráfico de barras, dibujado con divs y estilos en línea como en el
// prototipo. Cada mes es una columna con dos barras cuya altura es el
// porcentaje del importe sobre la escala del eje. El mes con el mouse encima
// se guarda en estado para pintar su columna y mostrar el tooltip.
function Evolucion({ evolucion }) {
  const [mesHover, setMesHover] = useState(null)

  const anioFinal = Number(evolucion[evolucion.length - 1].mes.slice(0, 4))

  const tope = Math.max(
    PISO_ESCALA,
    ...evolucion.map((m) => Math.max(Number(m.ingresos), Number(m.gastos)))
  )
  const escala = Math.ceil(tope / PASO_ESCALA) * PASO_ESCALA

  // El 3% de piso es para que un mes en cero se vea como una rayita y no
  // desaparezca.
  const alto = (importe) => `${Math.max(3, Math.round((Number(importe) / escala) * 100))}%`

  // Dónde va el tooltip: centrado sobre la columna, salvo en los extremos,
  // donde se corre para no salirse del gráfico.
  const indice = evolucion.findIndex((m) => m.mes === mesHover)
  const activo = indice >= 0 ? evolucion[indice] : null
  const cantidad = evolucion.length
  const centro = ((indice + 0.5) / cantidad) * 100
  const corrimiento = indice === 0 ? '-20%' : indice === cantidad - 1 ? '-80%' : '-50%'

  return (
    <div style={{ ...estiloTarjeta, maxWidth: ANCHO_MAXIMO, marginBottom: 24, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '16px 20px',
          borderBottom: '1px solid #EBE0E2',
        }}
      >
        <div>
          <h2 style={estiloTituloSeccion}>EVOLUCIÓN</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#857078' }}>
            {subtituloEvolucion(evolucion)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Leyenda color={VERDE} texto="Ingresos" />
          <Leyenda color={ROSA} texto="Gastos" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '24px 20px 20px' }}>
        {/* El eje: cuatro marcas repartidas en la altura de las barras. El
            marginTop de 96 es el mismo aire que tiene el área de barras
            arriba, donde va el tooltip. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 136,
            marginTop: 96,
            flexShrink: 0,
            textAlign: 'right',
          }}
        >
          {[escala, escala * 0.66, escala * 0.33, 0].map((marca) => (
            <span key={marca} style={{ fontSize: 12, lineHeight: 1, color: '#B08791' }}>
              {fmtCorto(marca)}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {activo && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                zIndex: 5,
                whiteSpace: 'nowrap',
                padding: '10px 14px',
                borderRadius: 8,
                pointerEvents: 'none',
                background: 'white',
                border: '1px solid #EBE0E2',
                boxShadow: '0 4px 14px rgba(61,50,56,.08)',
                left: `${centro}%`,
                transform: `translateX(${corrimiento})`,
              }}
            >
              <p
                style={{
                  margin: '0 0 6px',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#3D3238',
                }}
              >
                {nombreMes(activo.mes)}
              </p>
              <FilaTooltip color={VERDE} etiqueta="Ingresos" valor={formatearPrecio(activo.ingresos)} />
              <FilaTooltip color={ROSA} etiqueta="Gastos" valor={formatearPrecio(activo.gastos)} conMargen />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              height: 232,
              padding: '96px 6px 0',
              borderBottom: '1px solid #EBE0E2',
              borderLeft: '1px solid #EBE0E2',
            }}
          >
            {evolucion.map((m) => (
              <div
                key={m.mes}
                onMouseEnter={() => setMesHover(m.mes)}
                onMouseLeave={() => setMesHover(null)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 6,
                  height: '100%',
                  borderRadius: '6px 6px 0 0',
                  background: mesHover === m.mes ? '#FAF7F7' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 26,
                    borderRadius: '4px 4px 0 0',
                    background: VERDE,
                    height: alto(m.ingresos),
                  }}
                />
                <div
                  style={{
                    width: '100%',
                    maxWidth: 26,
                    borderRadius: '4px 4px 0 0',
                    background: ROSA,
                    height: alto(m.gastos),
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, padding: '10px 6px 0' }}>
            {evolucion.map((m) => (
              <span
                key={m.mes}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#857078',
                }}
              >
                {etiquetaMes(m.mes, anioFinal)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


// La caja de cada uno de los dos paneles de abajo, con su título.
function Panel({ titulo, children }) {
  return (
    <div style={{ ...estiloTarjeta, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
        <h2 style={estiloTituloSeccion}>{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

// Los recuadros del desglose: uno por medio de pago o por tipo de gasto,
// siempre todos, también los que están en cero. El backend ya los manda
// completos, así que acá solo se dibujan.
function Desglose({ filas }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '16px 20px',
        borderBottom: '1px solid #EBE0E2',
        flexWrap: 'wrap',
      }}
    >
      {filas.map((fila) => (
        <div
          key={fila.clave}
          style={{
            flex: 1,
            minWidth: 150,
            padding: '12px 14px',
            border: '1px solid #EBE0E2',
            borderRadius: 6,
            background: '#FAF7F7',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>{fila.etiqueta}</p>
          <p
            style={{
              margin: '5px 0 0',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 19,
              color: '#3D3238',
            }}
          >
            {formatearPrecio(fila.total)}
          </p>
        </div>
      ))}
    </div>
  )
}

// Lo que se ve en un panel cuando el período no tiene movimientos de ese
// lado. Los textos son los del prototipo.
function Vacio({ titulo, texto }) {
  return (
    <div style={{ padding: '44px 24px', textAlign: 'center' }}>
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 16,
          color: '#3D3238',
        }}
      >
        {titulo}
      </p>
      <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>{texto}</p>
    </div>
  )
}


// La tabla de cobros del período. La paginación es local, como en todos los
// listados: la lista llega completa y acá se corta. Cada tabla tiene su
// propia página y sus propias filas por página, igual que la Tabla de
// Pedidos.
function TablaCobros({ cobros, onVerPedido }) {
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)

  if (cobros.length === 0) {
    return (
      <Vacio
        titulo="No entró plata en este período"
        texto="Cuando registres un cobro con fecha dentro del período, lo vas a ver acá."
      />
    )
  }

  const { visibles, paginaActual, totalPaginas, desde } = paginar(cobros, porPagina, pagina)

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 520, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F0E2E4' }}>
              <th style={{ ...estiloTh, width: '22%', padding: '10px 20px' }}>FECHA</th>
              <th style={{ ...estiloTh, width: '13%' }}>PEDIDO</th>
              <th style={{ ...estiloTh, width: '25%' }}>CLIENTE</th>
              <th style={{ ...estiloTh, width: '22%' }}>TIPO</th>
              <th style={{ ...estiloTh, width: '18%', padding: '10px 20px', textAlign: 'right' }}>MONTO</th>
            </tr>
          </thead>

          <tbody>
            {visibles.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={{ ...estiloTd, padding: '13px 20px', whiteSpace: 'nowrap' }}>
                  {fmtFechaLarga(c.fecha)}
                </td>

                {/* Navega con navegar() y no con una etiqueta <a>, aunque en
                    el diseño sea un enlace: un <a> recargaría la aplicación
                    entera en vez de cambiar de pantalla. La clase le da el
                    subrayado al pasar el mouse. */}
                <td style={{ ...estiloTd, whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => onVerPedido(c.pedido)}
                    title={`Ver el pedido #${c.pedido}`}
                    className="btn-ver-productos"
                    style={{
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#8C5A66',
                    }}
                  >
                    #{c.pedido}
                  </button>
                </td>

                <td
                  style={{
                    ...estiloTd,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{c.cliente_instagram}
                </td>

                <td style={estiloTd}>{c.tipo_display}</td>

                <td
                  style={{
                    ...estiloTd,
                    padding: '13px 20px',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {formatearPrecio(c.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacion
        total={cobros.length}
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
    </>
  )
}


// La tabla de gastos del período. Misma paginación que la de cobros.
function TablaGastos({ gastos }) {
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)

  if (gastos.length === 0) {
    return (
      <Vacio
        titulo="No hubo gastos en este período"
        texto="Mirá otro período o registrá los gastos que te falten cargar."
      />
    )
  }

  const { visibles, paginaActual, totalPaginas, desde } = paginar(gastos, porPagina, pagina)

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 520, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F0E2E4' }}>
              <th style={{ ...estiloTh, width: '22%', padding: '10px 20px' }}>FECHA</th>
              <th style={{ ...estiloTh, width: '26%' }}>TIPO</th>
              <th style={{ ...estiloTh, width: '34%', whiteSpace: 'normal' }}>DESCRIPCIÓN</th>
              <th style={{ ...estiloTh, width: '18%', padding: '10px 20px', textAlign: 'right' }}>MONTO</th>
            </tr>
          </thead>

          <tbody>
            {visibles.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={{ ...estiloTd, padding: '13px 20px', whiteSpace: 'nowrap' }}>
                  {fmtFechaLarga(g.fecha)}
                </td>

                <td style={estiloTd}>{g.tipo_display}</td>

                <td style={{ ...estiloTd, lineHeight: 1.35, textWrap: 'pretty' }}>{g.descripcion}</td>

                <td
                  style={{
                    ...estiloTd,
                    padding: '13px 20px',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {formatearPrecio(g.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacion
        total={gastos.length}
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
    </>
  )
}


// Pantalla de Finanzas

export default function Finanzas() {
  const navegar = useNavigate()
  const [periodo, setPeriodo] = useState('Este mes')
  // Las dos fechas del período personalizado. Quedan guardadas aunque se
  // cambie a otro chip, así al volver a Personalizado siguen ahí.
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  // La última respuesta del servidor y el último error, cada uno guardado
  // junto con la clave del período al que pertenece. La pantalla los usa
  // solo si son los del período que se está mirando: al cambiar de chip, lo
  // anterior deja de valer solo, sin que nadie tenga que borrarlo. Por eso
  // no hay un estado "cargando" aparte: cargando es no tener todavía ni la
  // respuesta ni el error de este período. Es lo que pide la regla
  // react-hooks/set-state-in-effect: el efecto no toca el estado por su
  // cuenta, solo cuando llega la respuesta.
  const [respuesta, setRespuesta] = useState(null)
  const [fallo, setFallo] = useState(null)

  // A diferencia de los otros listados, acá cada cambio de período es un
  // pedido nuevo al servidor: lo que viene son sumas hechas por la base, no
  // una lista para filtrar. Por eso el efecto depende del período y de las
  // dos fechas, y no corre una sola vez al montar.
  //
  // Con Personalizado incompleto o al revés no se pide nada: rangoDelPeriodo
  // devuelve null y la pantalla lo dice.
  useEffect(() => {
    const rango = rangoDelPeriodo(periodo, desde, hasta)

    if (!rango) return

    // Si se cambia de chip antes de que llegue la respuesta anterior, esta
    // bandera hace que la respuesta vieja se descarte: React ejecuta la
    // función de limpieza del efecto anterior antes de correr el nuevo, y
    // ahí la bandera del anterior pasa a false. Sin esto, la respuesta
    // vieja pisaría a la nueva y la pantalla quedaría en "Cargando…".
    let vigente = true
    const clave = claveDelPeriodo(rango)

    obtenerFinanzas(rango)
      .then((res) => {
        if (vigente) setRespuesta({ clave, datos: res.data })
      })
      .catch((err) => {
        // El backend escribe sus mensajes de 400 para que se entiendan, así
        // que se muestran tal cual. Si no hay mensaje, es otra cosa (el
        // servidor caído, la red) y va el texto genérico.
        if (vigente) {
          setFallo({
            clave,
            mensaje: err.response?.data?.detail || 'No se pudieron cargar los datos de finanzas.',
          })
        }
      })

    return () => {
      vigente = false
    }
  }, [periodo, desde, hasta])

  function verPedido(id) {
    navegar(`/pedidos/${id}`)
  }

  // Se vuelve a calcular acá, fuera del efecto, para la etiqueta y las
  // fechas de la tarjeta de período. Es una función pura y barata, y así el
  // efecto no depende de un objeto que cambia en cada render.
  const rango = rangoDelPeriodo(periodo, desde, hasta)
  const clave = rango ? claveDelPeriodo(rango) : ''
  const esPersonalizado = periodo === 'Personalizado'
  const problema = esPersonalizado ? problemaDelPersonalizado(desde, hasta) : ''

  // Los tres estados de la pantalla, derivados: hay datos si la respuesta
  // guardada es la de este período, hay error si el fallo guardado es el de
  // este período, y si hay período pero todavía ni datos ni error, está
  // cargando.
  const datos = respuesta !== null && respuesta.clave === clave ? respuesta.datos : null
  const error = fallo !== null && fallo.clave === clave ? fallo.mensaje : ''
  const cargando = rango !== null && datos === null && error === ''

  // La línea de abajo del título: el período y cuántos movimientos tuvo.
  let resumen = rango ? rango.etiqueta : 'Período personalizado'

  if (cargando) {
    resumen = 'Cargando…'
  } else if (datos) {
    const cobros = datos.totales.cantidad_cobros
    const gastos = datos.totales.cantidad_gastos

    resumen +=
      ` · ${cobros} ${cobros === 1 ? 'cobro' : 'cobros'}` +
      ` · ${gastos} ${gastos === 1 ? 'gasto' : 'gastos'}`
  }

  return (
    <div>
      <h1
        style={{
          margin: 0,
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 32,
          color: '#3D3238',
        }}
      >
        Finanzas
      </h1>

      <p style={{ margin: '6px 0 24px', fontSize: 15, color: '#857078' }}>{resumen}</p>

      {/* La tarjeta del período: los cinco chips, las dos fechas del
          personalizado y, a la derecha, qué se está mirando. */}
      <div
        style={{
          ...estiloTarjeta,
          maxWidth: ANCHO_MAXIMO,
          marginBottom: 24,
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <p style={{ ...estiloTituloSeccion, fontSize: 13 }}>PERÍODO</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PERIODOS.map((p) => {
              const activo = periodo === p

              return (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: QUICKSAND,
                    fontWeight: 600,
                    fontSize: 14,
                    border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
                    background: activo ? '#8C5A66' : 'white',
                    color: activo ? 'white' : '#857078',
                  }}
                >
                  {p}
                </button>
              )
            })}

            {esPersonalizado && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
                <span style={{ fontSize: 14, color: '#857078' }}>Desde</span>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  style={estiloFecha}
                />
                <span style={{ fontSize: 14, color: '#857078' }}>Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  style={estiloFecha}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
          <p
            style={{
              margin: 0,
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 22,
              lineHeight: 1.2,
              color: '#3D3238',
            }}
          >
            {rango ? rango.etiqueta : 'Período personalizado'}
          </p>

          {/* Debajo van las fechas del período o, si el personalizado no se
              puede pedir todavía, qué le falta. El aviso de fechas al revés
              va en rojo porque es un error; el de fechas sin cargar, no. */}
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: problema === FECHAS_AL_REVES ? '#C0442F' : '#857078',
            }}
          >
            {rango ? `${fmtFechaLarga(rango.desde)} – ${fmtFechaLarga(rango.hasta)}` : problema}
          </p>
        </div>
      </div>

      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}

      {!rango && (
        <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
          Elegí las dos fechas para ver el período.
        </p>
      )}

      {datos && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
              maxWidth: ANCHO_MAXIMO,
              marginBottom: 24,
            }}
          >
            <TarjetaNumero
              titulo="INGRESOS"
              valor={formatearPrecio(datos.totales.ingresos)}
              detalle={detalleCantidad(datos.totales.cantidad_cobros, 'cobro', 'cobros')}
            />
            <TarjetaNumero
              titulo="GASTOS"
              valor={formatearPrecio(datos.totales.gastos)}
              detalle={detalleCantidad(datos.totales.cantidad_gastos, 'gasto', 'gastos')}
            />
            <TarjetaNumero
              titulo="RESULTADO"
              valor={importeConSigno(datos.totales.resultado)}
              color={caraDelResultado(datos.totales).color}
              chip={caraDelResultado(datos.totales)}
            />
          </div>

          <Evolucion evolucion={datos.evolucion} />

          {/* Las dos tablas llevan key con el período: al cambiarlo, React
              desmonta la tabla vieja y monta una nueva, que arranca en la
              página 1. Es la forma que React documenta para reiniciar el
              estado de un componente. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 24,
              maxWidth: ANCHO_MAXIMO,
              alignItems: 'start',
            }}
          >
            <Panel titulo="INGRESOS">
              <Desglose
                filas={datos.ingresos_por_medio.map((m) => ({
                  clave: m.medio,
                  etiqueta: m.medio_display,
                  total: m.total,
                }))}
              />
              <TablaCobros key={clave} cobros={datos.cobros} onVerPedido={verPedido} />
            </Panel>

            <Panel titulo="GASTOS">
              <Desglose
                filas={datos.gastos_por_tipo.map((t) => ({
                  clave: t.tipo,
                  etiqueta: t.tipo_display,
                  total: t.total,
                }))}
              />
              <TablaGastos key={clave} gastos={datos.gastos} />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
