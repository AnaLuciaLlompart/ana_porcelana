import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listarMaterialesPorReponer,
  listarPiezasEnProduccion,
  listarProximasEntregas,
  obtenerInicio,
} from './api'

// Imports que cruzan de funcionalidad, con el mismo criterio de siempre: la
// pieza se queda en la funcionalidad donde nació y las demás la usan desde
// ahí. Cambiar la etapa de un producto del pedido es una operación de
// Pedidos, así que va por su api.js. Las etapas, los textos de la columna
// ENTREGA, el "desde" de cada pieza y el chip del saldo son los mismos que
// muestra Pedidos, y así las dos pantallas dicen lo mismo. El precio se
// formatea igual en todo el sistema, y los nombres largos de los meses ya
// están en Finanzas.
import { modificarProductoDelPedido } from '../pedidos/api'
import {
  COLOR_ETAPA,
  ETAPAS,
  ICONO_FLECHA,
  ICONO_MATERIALES,
  ICONO_NUEVO,
  chipSaldo,
  diasEnEtapa,
  entregaTexto,
  entregaTitle,
} from '../pedidos/presentacion'
import { DIAS_ENTREGAS_PROXIMAS } from '../pedidos/filtros'
import { formatearPrecio } from '../productos/presentacion'
import { MESES_LARGOS } from '../finanzas/periodos'

import ChipFiltro from '../../componentes/ChipFiltro'
import EncabezadoDeTarjeta from '../../componentes/EncabezadoDeTarjeta'
import Paginacion from '../../componentes/Paginacion'
import Toast from '../../componentes/Toast'
import EnlaceCatalogo from '../../componentes/EnlaceCatalogo'
import { ANCHO_MAXIMO, BASE_GESTION } from '../../constantes'


// El ancho de las tarjetas, del prototipo.

const QUICKSAND = "'Quicksand', sans-serif"

// Para la fecha del encabezado, "Miércoles 24 de septiembre". Empieza en
// domingo porque getDay() devuelve 0 para el domingo.
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// El check verde de los dos vacíos que lo llevan.
const ICONO_TILDE = 'M5 13l4 4L19 7'

const estiloTarjeta = {
  background: 'white',
  border: '1px solid #EBE0E2',
  borderRadius: 8,
}

// Los títulos de columna van en gris sobre blanco, con una línea rosa
// debajo, como en las fichas: el que manda es el encabezado rosa oscuro del
// panel, no los de las columnas.
const estiloTh = {
  padding: '10px 8px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontFamily: QUICKSAND,
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#857078',
  borderBottom: '2px solid #F0E2E4',
}

const estiloTd = {
  padding: '13px 8px',
  fontSize: 15,
  color: '#3D3238',
}


// "Miércoles 24 de septiembre", a partir del hoy que manda el servidor
// (AAAA-MM-DD). El día de la semana necesita un Date, y se arma al mediodía
// para que la zona horaria no lo corra al día anterior, como hace el
// prototipo. El mes sale de la lista de Finanzas, que lo tiene con
// mayúscula inicial; acá va en minúscula porque está en medio de la frase.
function fechaDelEncabezado(iso) {
  const partes = iso.split('-')
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  const diaDeLaSemana = new Date(`${iso}T12:00:00`).getDay()

  return `${DIAS_SEMANA[diaDeLaSemana]} ${dia} de ${MESES_LARGOS[mes - 1].toLowerCase()}`
}

// El texto del pie de cada lista. Conserva el del prototipo y, solo cuando
// hay más de los que se muestran, agrega cuántos son en total: la lista
// llega recortada y el total viene aparte justamente para esto.
function textoVerTodos(texto, total, mostrados, detalle) {
  if (total <= mostrados) return texto

  return `${texto} (${total} ${detalle})`
}


// El "Ver …" con la flecha: el de las cuatro tarjetas y el del pie de cada
// lista. Navega con navegar() y no con una etiqueta <a>, aunque en el
// diseño sea un enlace: un <a> recargaría la aplicación entera en vez de
// cambiar de pantalla. La clase le da el subrayado al pasar el mouse.
function Enlace({ texto, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-ver-productos"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: QUICKSAND,
        fontWeight: 600,
        fontSize: 14,
        color: '#8C5A66',
      }}
    >
      {texto}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
      </svg>
    </button>
  )
}

// El número del pedido como enlace a su ficha, en las dos tablas. Mismo
// botón que la tabla de cobros de Finanzas, por el mismo motivo que Enlace.
function EnlacePedido({ id, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`Ver el pedido #${id}`}
      className="btn-ver-productos"
      style={{
        padding: 0,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: QUICKSAND,
        fontWeight: 600,
        fontSize: 15,
        color: '#3D3238',
      }}
    >
      #{id}
    </button>
  )
}

// Los tres accesos rápidos del encabezado. El principal va sólido y los
// otros dos en blanco con borde; los tres navegan con navegar(). La clase
// btn-reponer les da a los blancos el fondo rosa claro al pasar el mouse,
// que es el del diseño; el sólido usa el hover general de los botones.
function AccesoRapido({ texto, onClick, principal }) {
  return (
    <button
      onClick={onClick}
      className={principal ? undefined : 'btn-reponer'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: principal ? '10px 20px' : '10px 18px',
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: QUICKSAND,
        fontWeight: 600,
        fontSize: principal ? 16 : 15,
        border: principal ? '1px solid #8C5A66' : '1px solid #EBE0E2',
        background: principal ? '#8C5A66' : 'white',
        color: principal ? 'white' : '#8C5A66',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={principal ? 2.5 : 2.3}>
        <path strokeLinecap="round" d={ICONO_NUEVO} />
      </svg>
      {texto}
    </button>
  )
}

// Una de las cuatro tarjetas de arriba: el título, el número y el enlace.
// Mismos valores que TarjetaNumero en Finanzas, que no está exportada y
// lleva un detalle y un chip donde esta lleva el enlace.
function Tarjeta({ titulo, valor, color, enlace, onClick }) {
  return (
    <div
      style={{
        ...estiloTarjeta,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
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
          margin: 0,
          fontFamily: QUICKSAND,
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1.1,
          color: color || '#3D3238',
        }}
      >
        {valor}
      </p>

      <Enlace texto={enlace} onClick={onClick} />
    </div>
  )
}

// La caja de cada uno de los tres paneles, con su título. Igual que en
// Finanzas, más un estilo extra para el ancho que le toca a cada uno.
function Panel({ titulo, nota, estilo, className, children }) {
  return (
    <div className={className} style={{ ...estiloTarjeta, overflow: 'hidden', minWidth: 0, ...estilo }}>
      {/* La aclaración chica al lado del título, como la cantidad en las
          secciones de Categorías. Es opcional: solo la lleva EN PRODUCCIÓN. */}
      <EncabezadoDeTarjeta titulo={titulo} nota={nota} />
      {children}
    </div>
  )
}

// El pie de cada panel, con el enlace "Ver todos …". Lleva la línea de
// arriba salvo en la lista de materiales, donde cada fila y el vacío ya
// dibujan la suya abajo: si no, quedarían dos líneas juntas.
function Pie({ texto, onClick, conBorde = true }) {
  return (
    <div style={{ padding: '12px 20px', borderTop: conBorde ? '1px solid #EBE0E2' : 'none' }}>
      <Enlace texto={texto} onClick={onClick} />
    </div>
  )
}

// Lo que se ve en un panel cuando no hay nada que mostrar. Los textos son
// los del prototipo. Dos de los tres llevan el check verde arriba: los que
// dicen que está todo bien. El del taller no, porque no tener nada en el
// taller no es una buena ni una mala noticia.
function Vacio({ titulo, texto, conIcono = false, conBorde = false }) {
  return (
    <div
      style={{
        padding: conIcono ? '48px 24px' : '44px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        borderBottom: conBorde ? '1px solid #EBE0E2' : 'none',
      }}
    >
      {conIcono && (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#E8F5EF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4E8C6A" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
          </svg>
        </div>
      )}

      <p style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 17, color: '#3D3238' }}>
        {titulo}
      </p>
      <p style={{ margin: 0, maxWidth: 380, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
        {texto}
      </p>
    </div>
  )
}


// Las etapas por las que se filtra EN PRODUCCIÓN: todas menos Terminado,
// porque esas piezas ya no están en la tabla.
const ETAPAS_EN_PRODUCCION = ETAPAS.filter((e) => e.valor !== 'TERMINADO')

// Los chips de etapa arriba de PRODUCTOS EN ELABORACIÓN: Todas y una por
// etapa, cada una con cuántas piezas tiene. Los números los cuenta el
// backend (por_etapa, en /api/inicio/), y elegir una le pide al backend las
// piezas de esa etapa (corrección D3). Se elige una sola a la vez.
function FiltroEtapas({ total, porEtapa, etapa, onElegir }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px 20px',
        borderBottom: '1px solid #EBE0E2',
      }}
    >
      <ChipFiltro label="Todas" cuenta={total} activo={etapa === ''} onClick={() => onElegir('')} />
      {ETAPAS_EN_PRODUCCION.map((e) => (
        <ChipFiltro
          key={e.valor}
          label={e.label}
          cuenta={porEtapa[e.valor] ?? 0}
          activo={etapa === e.valor}
          onClick={() => onElegir(e.valor)}
        />
      ))}
    </div>
  )
}


// Cuántas filas trae cada página de cada lista. Tienen que ser las mismas
// que pagina el backend (PaginacionDeInicio y PaginacionDeMateriales, en
// inicio/views.py): acá se usan para el "1–8 de 117" del pie y para el
// "Ver todos" de abajo.
const FILAS_EN_PRODUCCION = 8
const FILAS_ENTREGAS = 8
const FILAS_MATERIALES = 6

// El pie de páginas de cada panel: "1–8 de 117" y las dos flechas, sin el
// selector de filas, porque cada panel pagina siempre de a lo mismo. Solo
// aparece si hay más de una página: con todo en una, no hay a dónde ir.
// borde es la línea de arriba; la lista de materiales no la lleva, porque
// cada fila ya dibuja la suya abajo, como el Pie.
function PieDePaginas({ total, pagina, porPagina, onPagina, borde = true }) {
  if (total <= porPagina) return null

  return (
    <Paginacion
      total={total}
      desde={(pagina - 1) * porPagina}
      porPagina={porPagina}
      pagina={pagina}
      totalPaginas={Math.ceil(total / porPagina)}
      onPagina={onPagina}
      borde={borde}
    />
  )
}


// La tabla EN PRODUCCIÓN: los productos del pedido que todavía no están
// terminados, del más avanzado al que recién empieza, como los manda el
// backend. El selector de etapa es el mismo de la pestaña de productos de
// la ficha, y el "desde" también, con el hoy del servidor.
//
// MATERIALES lleva el botón que antes estaba en la tabla de productos del
// pedido: en el taller es donde hace falta saber qué lleva cada pieza.
function TablaEnProduccion({ productos, hoy, onVerPedido, onCambiarEtapa, onVerMateriales }) {
  if (productos.length === 0) {
    return (
      <Vacio
        titulo="No tenés nada en el taller"
        texto="Cuando cargues productos en un pedido, los vas a ver acá con su etapa."
      />
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 940, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...estiloTh, width: '27%', padding: '10px 20px' }}>PRODUCTO</th>
            <th style={{ ...estiloTh, width: '8%', textAlign: 'center' }}>CANT.</th>
            <th style={{ ...estiloTh, width: '10%' }}>PEDIDO</th>
            <th style={{ ...estiloTh, width: '20%' }}>ETAPA</th>
            <th style={{ ...estiloTh, width: '14%' }}>DESDE</th>
            <th style={{ ...estiloTh, width: '21%', padding: '10px 20px', textAlign: 'center' }}>MATERIALES</th>
          </tr>
        </thead>

        <tbody>
          {productos.map((p) => {
            const etapa = COLOR_ETAPA[p.estado]
            const desde = diasEnEtapa(p, hoy)

            return (
              // La key es el id del PRODUCTO DEL PEDIDO, no el del producto:
              // el mismo producto puede estar en dos pedidos, o dos veces en
              // el mismo, y ahí los ids se repetirían.
              <tr key={p.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={{ padding: '12px 20px' }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.3, color: '#3D3238' }}>
                    {p.producto_nombre}
                  </p>
                  {p.descripcion && (
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#857078', textWrap: 'pretty' }}>
                      {p.descripcion}
                    </p>
                  )}
                </td>

                <td style={{ ...estiloTd, padding: '12px 8px', textAlign: 'center' }}>{p.cantidad}</td>

                <td style={{ ...estiloTd, padding: '12px 8px', whiteSpace: 'nowrap' }}>
                  <EnlacePedido id={p.pedido} onClick={() => onVerPedido(p.pedido)} />
                </td>

                <td style={{ padding: '9px 8px' }}>
                  <select
                    value={p.estado}
                    onChange={(e) => onCambiarEtapa(p, e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: 190,
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 13,
                      border: `1px solid ${etapa.borde}`,
                      background: etapa.fondo,
                      color: etapa.color,
                    }}
                  >
                    {ETAPAS.map((e) => (
                      <option key={e.valor} value={e.valor}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td
                  style={{
                    padding: '12px 8px',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                    color: desde ? desde.color : '#857078',
                  }}
                >
                  {desde ? desde.texto : ''}
                </td>

                {/* No aparece si la pieza no tiene materiales cargados:
                    llevaría a una pantalla filtrada sin nada que mostrar. */}
                <td style={{ padding: '9px 20px', textAlign: 'center' }}>
                  {p.producto_tiene_materiales && (
                    <button
                      onClick={() => onVerMateriales(p.producto)}
                      title={`Ver los materiales de ${p.producto_nombre}`}
                      className="btn-reponer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        border: '1px solid #EBE0E2',
                        background: 'white',
                        color: '#8C5A66',
                        borderRadius: 5,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontFamily: QUICKSAND,
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_MATERIALES} />
                      </svg>
                      Ver/Editar Materiales
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


// La tabla PRÓXIMAS ENTREGAS: los pedidos sin entregar, del más urgente al
// menos, como los manda el backend. La columna ENTREGA y el chip del saldo
// son los del listado de Pedidos, con el hoy del servidor. "Cobrar al
// entregar" no viaja desde el backend: se deduce acá, como en el prototipo.
function TablaEntregas({ pedidos, hoy, onVerPedido }) {
  if (pedidos.length === 0) {
    return (
      <Vacio
        conIcono
        titulo="Estás al día"
        texto="No tenés entregas pendientes. Cuando registres un pedido nuevo, lo vas a ver acá."
      />
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tabla-entregas" style={{ width: '100%', minWidth: 640, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...estiloTh, width: '14%', padding: '10px 20px' }}>PEDIDO</th>
            <th style={{ ...estiloTh, width: '26%' }}>CLIENTE</th>
            <th style={{ ...estiloTh, width: '20%', textAlign: 'center' }}>ENTREGA</th>
            <th style={{ ...estiloTh, width: '18%', textAlign: 'center' }}>ESTADO</th>
            <th style={{ ...estiloTh, width: '22%', padding: '10px 20px', textAlign: 'center' }}>SALDO</th>
          </tr>
        </thead>

        <tbody>
          {pedidos.map((p) => {
            const chip = chipSaldo(p.saldo)

            return (
              <tr key={p.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={{ ...estiloTd, padding: '13px 20px', whiteSpace: 'nowrap' }}>
                  <EnlacePedido id={p.id} onClick={() => onVerPedido(p.id)} />
                </td>

                <td
                  style={{
                    ...estiloTd,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{p.cliente_instagram}
                </td>

                <td
                  title={entregaTitle(p)}
                  style={{ ...estiloTd, textAlign: 'center', whiteSpace: 'nowrap' }}
                >
                  {entregaTexto(p, hoy)}
                </td>

                <td style={{ ...estiloTd, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {p.estado_display}
                </td>

                <td style={{ ...estiloTd, padding: '13px 20px', textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 14,
                      borderRadius: 20,
                      padding: '5px 10px',
                      border: `1px solid ${chip.borde}`,
                      background: chip.fondo,
                      color: chip.color,
                    }}
                  >
                    {chip.texto}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


// La lista MATERIALES POR REPONER: nombre y chip. El backend solo manda los
// materiales en Baja, así que el chip va siempre con los colores del estado
// negativo de la paleta; el texto igual sale del disponibilidad_display,
// que es el que se muestra en todo el proyecto.
function ListaMateriales({ materiales }) {
  if (materiales.length === 0) {
    return (
      <Vacio
        conIcono
        conBorde
        titulo="Tenés todo lo que necesitás"
        texto="Ningún material está en disponibilidad baja."
      />
    )
  }

  return materiales.map((m) => (
    <div
      key={m.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 20px',
        borderBottom: '1px solid #EBE0E2',
      }}
    >
      <span style={{ minWidth: 0, fontSize: 15, lineHeight: 1.35, color: '#3D3238', textWrap: 'pretty' }}>
        {m.nombre}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 13,
          borderRadius: 20,
          padding: '4px 12px',
          border: '1px solid #C0442F',
          background: '#FAEAE8',
          color: '#C0442F',
        }}
      >
        {m.disponibilidad_display}
      </span>
    </div>
  ))
}


// Pantalla de Inicio

export default function Inicio() {
  const navegar = useNavigate()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  // La etapa elegida en PRODUCTOS EN ELABORACIÓN; '' es Todas.
  const [etapa, setEtapa] = useState('')

  // Las tres listas, cada una con la página que se está mirando y lo que
  // mandó el backend para esa página: { results, count } (corrección D3).
  // Cada una se pide sola, así pasar de página en una no recarga las otras.
  const [paginaPiezas, setPaginaPiezas] = useState(1)
  const [piezas, setPiezas] = useState(null)
  const [paginaEntregas, setPaginaEntregas] = useState(1)
  const [entregas, setEntregas] = useState(null)
  const [paginaMateriales, setPaginaMateriales] = useState(1)
  const [materiales, setMateriales] = useState(null)
  // Sube en uno cada vez que hay que volver a pedir las piezas (después de
  // cambiar una etapa o deshacer), aunque la página no haya cambiado.
  const [versionPiezas, setVersionPiezas] = useState(0)

  const [toast, setToast] = useState('')
  const [hayDeshacer, setHayDeshacer] = useState(false)
  const temporizador = useRef(null)

  // El producto que se acaba de marcar Terminado y la etapa que tenía, por
  // si toca Deshacer. Va en un ref y no en estado porque no se dibuja.
  const pendienteDeDeshacer = useRef(null)

  // Al abrir la pantalla: el resumen (las cuatro tarjetas, los números de
  // los chips y los totales de cada lista). Las filas las pide cada lista.
  useEffect(() => {
    obtenerInicio()
      .then((res) => setDatos(res.data))
      .catch(() => setError('No se pudo cargar el inicio.'))
      .finally(() => setCargando(false))
  }, [])

  // Una página de cada lista, cada vez que cambia su página (y, en las
  // piezas, la etapa elegida). Si llegan dos respuestas fuera de orden,
  // vigente descarta la vieja. Una página que dejó de existir (se terminó la
  // última pieza de la última página) responde 404: se vuelve a la anterior.
  useEffect(() => {
    let vigente = true
    const parametros = { pagina: paginaPiezas }
    if (etapa) parametros.etapa = etapa

    listarPiezasEnProduccion(parametros)
      .then((res) => {
        if (vigente) setPiezas(res.data)
      })
      .catch((err) => {
        if (!vigente) return
        if (err.response?.status === 404 && paginaPiezas > 1) setPaginaPiezas(paginaPiezas - 1)
        else setError('No se pudieron cargar los productos en elaboración.')
      })

    return () => {
      vigente = false
    }
  }, [paginaPiezas, etapa, versionPiezas])

  useEffect(() => {
    let vigente = true

    listarProximasEntregas({ pagina: paginaEntregas })
      .then((res) => {
        if (vigente) setEntregas(res.data)
      })
      .catch(() => {
        if (vigente) setError('No se pudieron cargar las próximas entregas.')
      })

    return () => {
      vigente = false
    }
  }, [paginaEntregas])

  useEffect(() => {
    let vigente = true

    listarMaterialesPorReponer({ pagina: paginaMateriales })
      .then((res) => {
        if (vigente) setMateriales(res.data)
      })
      .catch(() => {
        if (vigente) setError('No se pudieron cargar los materiales por reponer.')
      })

    return () => {
      vigente = false
    }
  }, [paginaMateriales])

  // Elegir otra etapa vuelve a la página 1 de las piezas.
  function elegirEtapa(valor) {
    setEtapa(valor)
    setPaginaPiezas(1)
  }

  // Vuelve a pedir el resumen y la página de piezas después de cambiar una
  // etapa. No pasa por cargando: lo que ya está en pantalla se queda hasta
  // que llegan los datos nuevos, así la pantalla no parpadea a "Cargando…".
  function recargar() {
    setVersionPiezas((v) => v + 1)
    return obtenerInicio()
      .then((res) => setDatos(res.data))
      .catch(() => setError('No se pudo actualizar el inicio.'))
  }

  // conDeshacer decide las dos cosas que distinguen a ese aviso: que lleve
  // el botón, y que dure 6 segundos en vez de 2,6. Es el mismo criterio de
  // la ficha del gasto.
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
    }, conDeshacer ? 1500 : 1400)
  }

  // Manda la etapa nueva al backend con el PATCH de Pedidos y, si salió
  // bien, vuelve a pedir el resumen entero para que la tabla y su total
  // queden al día. La respuesta del PATCH es el pedido completo, pero acá no
  // sirve: lo que muestra esta pantalla es el resumen. Devuelve si salió
  // bien, para que quien llama sepa si sigue.
  async function aplicarEtapa(producto, estado) {
    setError('')

    try {
      await modificarProductoDelPedido(producto.pedido, producto.id, { estado })
    } catch (err) {
      // El backend escribe sus mensajes de 400 para que se entiendan, así
      // que se muestran tal cual. Si no hay mensaje, es otra cosa (el
      // servidor caído, la red) y va el texto genérico.
      setError(err.response?.data?.detail || 'No se pudo cambiar la etapa.')
      return false
    }

    await recargar()
    return true
  }

  // Solo Terminado avisa, y con Deshacer: es el único cambio con el que la
  // fila desaparece de la tabla, y después de eso ya no queda selector acá
  // para volver atrás. Las otras etapas no avisan, como en la ficha del
  // pedido: el selector ya muestra el cambio.
  async function cambiarEtapa(producto, estado) {
    const salioBien = await aplicarEtapa(producto, estado)

    if (!salioBien) return

    // Todas las etapas avisan con Deshacer, que vuelve a la etapa que la
    // pieza tenía antes de este cambio.
    pendienteDeDeshacer.current = { producto, estado: producto.estado }

    if (estado === 'TERMINADO') {
      mostrarToast(`${producto.producto_nombre} terminado`, true)
      return
    }

    const etapa = ETAPAS.find((e) => e.valor === estado)
    mostrarToast(`${producto.producto_nombre} pasó a ${etapa.label}`, true)
  }

  // Deshacer no tiene endpoint propio: es el mismo PATCH con la etapa que
  // la pieza tenía antes. La fecha del cambio de estado la vuelve a escribir
  // el backend, así que el "desde" arranca de nuevo.
  async function deshacer() {
    clearTimeout(temporizador.current)
    setToast('')
    setHayDeshacer(false)

    const { producto, estado } = pendienteDeDeshacer.current
    await aplicarEtapa(producto, estado)
  }

  function verPedido(id) {
    navegar(`${BASE_GESTION}/pedidos/${id}`)
  }

  // La línea de abajo del título: la fecha de hoy según el servidor, o
  // "Cargando…" mientras no llegó.
  const subtitulo = cargando ? 'Cargando…' : datos ? fechaDelEncabezado(datos.hoy) : ''


  return (
    <div>
      {/* El encabezado se ve siempre, también cargando: el título y los
          accesos rápidos no dependen de la respuesta. */}
      <div
        className="ancho-pantalla"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          maxWidth: ANCHO_MAXIMO,
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 700, fontSize: 40, color: '#8C5A66' }}>
            Ana Porcelana
          </h1>
          {subtitulo && (
            <p style={{ margin: '6px 0 0', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 20, color: '#857078' }}>
              {subtitulo}
            </p>
          )}
        </div>

        <div className="accesos-rapidos" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <EnlaceCatalogo />
          <AccesoRapido texto="Registrar gasto" onClick={() => navegar(`${BASE_GESTION}/gastos/nuevo`)} />
          <AccesoRapido texto="Nuevo producto" onClick={() => navegar(`${BASE_GESTION}/productos/nuevo`)} />
          <AccesoRapido texto="Nuevo pedido" onClick={() => navegar(`${BASE_GESTION}/pedidos/nuevo`)} principal />
        </div>
      </div>

      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}

      {datos && (
        <>
          <div
            className="ancho-pantalla"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
              maxWidth: ANCHO_MAXIMO,
              marginBottom: 24,
            }}
          >
            {/* Los tres enlaces a pedidos van al listado sin filtro: Pedidos
                todavía no lee filtros de la URL, y "atrasados" y "semana" ni
                existen ahí. Queda como paso aparte. */}
            <Tarjeta
              titulo="PEDIDOS ATRASADOS"
              valor={datos.totales.pedidos_atrasados}
              color={datos.totales.pedidos_atrasados > 0 ? '#C0442F' : '#3D3238'}
              enlace="Ver atrasados"
              onClick={() => navegar(`${BASE_GESTION}/pedidos?entrega=atrasados`)}
            />
            <Tarjeta
              titulo={`ENTREGAS PRÓXIMOS ${DIAS_ENTREGAS_PROXIMAS} DÍAS`}
              valor={datos.totales.entregas_proximas}
              enlace="Ver entregas"
              onClick={() => navegar(`${BASE_GESTION}/pedidos?entrega=proximos`)}
            />
            <Tarjeta
              titulo="MATERIALES POR REPONER"
              valor={datos.totales.materiales_por_reponer}
              enlace="Ver materiales"
              onClick={() => navegar(`${BASE_GESTION}/materiales`)}
            />
            <Tarjeta
              titulo="TE DEBEN"
              valor={formatearPrecio(datos.totales.deuda)}
              enlace="Ver pedidos con saldo"
              onClick={() => navegar(`${BASE_GESTION}/pedidos?saldo=pendiente`)}
            />
          </div>

          <Panel
            titulo="PRODUCTOS EN ELABORACIÓN"
            nota="Se reordenan de la etapa más avanzada a la que recién empieza"
            className="ancho-pantalla"
            estilo={{ maxWidth: ANCHO_MAXIMO, marginBottom: 24 }}
          >
            {datos.en_produccion.total > 0 && (
              <FiltroEtapas
                total={datos.en_produccion.total}
                porEtapa={datos.en_produccion.por_etapa}
                etapa={etapa}
                onElegir={elegirEtapa}
              />
            )}
            {/* Si la etapa elegida se quedó sin piezas (se pasó la última a
                otra), se dice eso y no "No tenés nada en el taller". */}
            {piezas && datos.en_produccion.total > 0 && piezas.count === 0 && etapa !== '' ? (
              <Vacio
                titulo={`Ninguna pieza en ${ETAPAS.find((e) => e.valor === etapa).label}`}
                texto="Elegí otra etapa para ver las demás piezas."
              />
            ) : piezas && (
              <>
                <TablaEnProduccion
                  productos={piezas.results}
                  hoy={datos.hoy}
                  onVerPedido={verPedido}
                  onCambiarEtapa={cambiarEtapa}
                  onVerMateriales={(producto) => navegar(`${BASE_GESTION}/materiales?producto=${producto}`)}
                />
                <PieDePaginas
                  total={piezas.count}
                  pagina={paginaPiezas}
                  porPagina={FILAS_EN_PRODUCCION}
                  onPagina={setPaginaPiezas}
                />
              </>
            )}
            <Pie
              texto={textoVerTodos(
                'Ver todos los pedidos',
                datos.en_produccion.total,
                FILAS_EN_PRODUCCION,
                'productos sin terminar'
              )}
              onClick={() => navegar(`${BASE_GESTION}/pedidos`)}
            />
          </Panel>

          <div className="ancho-pantalla" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, maxWidth: ANCHO_MAXIMO, alignItems: 'flex-start' }}>
            <Panel titulo="PRÓXIMAS ENTREGAS" estilo={{ flex: '2 1 600px' }}>
              {entregas && (
                <>
                  <TablaEntregas pedidos={entregas.results} hoy={datos.hoy} onVerPedido={verPedido} />
                  <PieDePaginas
                    total={entregas.count}
                    pagina={paginaEntregas}
                    porPagina={FILAS_ENTREGAS}
                    onPagina={setPaginaEntregas}
                  />
                </>
              )}
              <Pie
                texto={textoVerTodos(
                  'Ver todos los pedidos',
                  datos.proximas_entregas.total,
                  FILAS_ENTREGAS,
                  'sin entregar'
                )}
                onClick={() => navegar(`${BASE_GESTION}/pedidos`)}
              />
            </Panel>

            <Panel titulo="MATERIALES POR REPONER" estilo={{ flex: '1 1 300px' }}>
              {materiales && (
                <>
                  <ListaMateriales materiales={materiales.results} />
                  <PieDePaginas
                    total={materiales.count}
                    pagina={paginaMateriales}
                    porPagina={FILAS_MATERIALES}
                    onPagina={setPaginaMateriales}
                    borde={false}
                  />
                </>
              )}
              {/* Con el pie de páginas en el medio, el enlace sí lleva su
                  línea: la de la última fila quedó arriba del pie. */}
              <Pie
                texto={textoVerTodos(
                  'Ver todos los materiales',
                  datos.totales.materiales_por_reponer,
                  FILAS_MATERIALES,
                  'por reponer'
                )}
                onClick={() => navegar(`${BASE_GESTION}/materiales`)}
                conBorde={datos.totales.materiales_por_reponer > FILAS_MATERIALES}
              />
            </Panel>
          </div>
        </>
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
