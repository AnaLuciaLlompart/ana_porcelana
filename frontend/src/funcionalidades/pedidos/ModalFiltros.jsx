import { useState } from 'react'
import { FILTROS_VACIOS, candidatos } from './filtros'
import {
  ESTADOS,
  OPCIONES_SALDO,
  TOTAL_MIN,
  TOTAL_MAX,
  formatearPrecio,
} from './presentacion'


// La línea que separa un criterio del siguiente. Va en todos menos el
// primero. El contenedor ya deja 24px de aire entre criterios, así que el
// paddingTop repone esa distancia del otro lado de la línea y queda
// centrada entre los dos.
const separador = {
  borderTop: '1px solid #EBE0E2',
  paddingTop: 24,
}

const estiloTitulo = {
  margin: '0 0 10px',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  letterSpacing: '.06em',
}


function Chip({ label, activo, onClick }) {
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
        border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
        background: activo ? '#F0E2E4' : 'white',
        color: activo ? '#8C5A66' : '#857078',
      }}
    >
      {label}
    </button>
  )
}


export default function ModalFiltros({
  filtros,
  pedidos,
  clientes,
  busqueda,
  onCerrar,
  onAplicar,
}) {
  // El BORRADOR vive acá, no en la pantalla.
  //
  // Solo existe mientras el modal está abierto: marcar opciones no cambia
  // la lista, y cerrar sin aplicar tiene que descartar todo. Como la
  // pantalla monta este componente recién al abrirlo, useState lo
  // inicializa cada vez desde los filtros que están aplicados, y al cerrar
  // el componente se desmonta y el borrador se va solo.
  //
  // El único camino por el que el borrador sale de acá es APLICAR.
  const [borrador, setBorrador] = useState(filtros)

  // El contador en vivo: la MISMA función que usa la pantalla para armar la
  // lista, pero con el borrador en vez de los filtros aplicados. Incluye el
  // texto del buscador, porque si no diría un número distinto del que se va
  // a ver al aplicar.
  const coinciden = candidatos(pedidos, borrador, busqueda).length

  // Vacío significa "sin límite", y en el deslizador eso se dibuja en el
  // extremo que corresponda.
  const desdeValor = borrador.desde === '' ? TOTAL_MIN : Number(borrador.desde)
  const hastaValor = borrador.hasta === '' ? TOTAL_MAX : Number(borrador.hasta)

  const rangoTexto =
    borrador.desde === '' && borrador.hasta === ''
      ? 'Todos'
      : `${formatearPrecio(desdeValor)} – ${formatearPrecio(hastaValor)}`

  // Marca o desmarca un estado.
  function alternarEstado(valor) {
    setBorrador((actual) => ({
      ...actual,
      estados: actual.estados.includes(valor)
        ? actual.estados.filter((v) => v !== valor)
        : actual.estados.concat(valor),
    }))
  }

  // Lo mismo para el saldo. Las dos opciones se pueden marcar juntas,
  // aunque entonces no quede ningún pedido: son exclusiones.
  function alternarSaldo(valor) {
    setBorrador((actual) => ({
      ...actual,
      saldo: actual.saldo.includes(valor)
        ? actual.saldo.filter((v) => v !== valor)
        : actual.saldo.concat(valor),
    }))
  }

  // Los dos deslizadores se corrigen entre sí: arrastrar el de abajo por
  // encima del de arriba empujaría el rango al revés y no mostraría nada.
  //
  // Llevar un extremo hasta el tope lo vacía, que es como se dice "sin
  // límite de este lado". Si no, un rango de 0 a 60000 contaría como filtro
  // puesto sin estar filtrando nada.
  function moverDesde(valor) {
    setBorrador((actual) => ({
      ...actual,
      desde: valor <= TOTAL_MIN ? '' : String(valor),
      hasta:
        actual.hasta !== '' && Number(actual.hasta) < valor ? String(valor) : actual.hasta,
    }))
  }

  function moverHasta(valor) {
    setBorrador((actual) => ({
      ...actual,
      hasta: valor >= TOTAL_MAX ? '' : String(valor),
      desde:
        actual.desde !== '' && Number(actual.desde) > valor ? String(valor) : actual.desde,
    }))
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,50,56,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            flexShrink: 0,
            background: '#8C5A66',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            Filtrar pedidos
          </h2>

          <button
            onClick={onCerrar}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'transparent',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflowY: 'auto',
          }}
        >

          <div>
            <p style={estiloTitulo}>CLIENTE</p>
            <select
              value={borrador.cliente === null ? '' : borrador.cliente}
              onChange={(e) =>
                setBorrador((actual) => ({
                  ...actual,
                  // El value de un select siempre es texto, y el id que
                  // manda el backend es un número: sin el Number, la
                  // comparación del filtro no encontraría nunca.
                  cliente: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              style={{
                width: '100%',
                padding: '10px 13px',
                border: '1px solid #EBE0E2',
                fontSize: 15,
                color: '#3D3238',
                background: 'white',
                borderRadius: 6,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  @{c.instagram} · {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>ESTADO DEL PEDIDO</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ESTADOS.map((e) => (
                <Chip
                  key={e.valor}
                  label={e.label}
                  activo={borrador.estados.includes(e.valor)}
                  onClick={() => alternarEstado(e.valor)}
                />
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#B08791' }}>
              Sin elegir nada se muestran todos.
            </p>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>SALDO</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {OPCIONES_SALDO.map((o) => (
                <Chip
                  key={o.valor}
                  label={o.label}
                  activo={borrador.saldo.includes(o.valor)}
                  onClick={() => alternarSaldo(o.valor)}
                />
              ))}
            </div>
          </div>

          <div style={separador}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <p style={{ ...estiloTitulo, margin: 0 }}>TOTAL DEL PEDIDO</p>
              <span
                style={{
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#8C5A66',
                }}
              >
                {rangoTexto}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, flexShrink: 0, fontSize: 13, color: '#857078' }}>
                  Desde
                </span>
                <input
                  type="range"
                  min={TOTAL_MIN}
                  max={TOTAL_MAX}
                  step={1000}
                  value={desdeValor}
                  onChange={(e) => moverDesde(Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#8C5A66' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, flexShrink: 0, fontSize: 13, color: '#857078' }}>
                  Hasta
                </span>
                <input
                  type="range"
                  min={TOTAL_MIN}
                  max={TOTAL_MAX}
                  step={1000}
                  value={hastaValor}
                  onChange={(e) => moverHasta(Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#8C5A66' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 24px',
            flexShrink: 0,
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <span style={{ fontSize: 14, color: '#857078' }}>
            {coinciden === 1 ? '1 pedido coincide' : `${coinciden} pedidos coinciden`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setBorrador(FILTROS_VACIOS)}
              style={{
                padding: '10px 18px',
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
              Limpiar
            </button>

            <button
              onClick={() => onAplicar(borrador)}
              style={{
                padding: '10px 20px',
                border: 0,
                background: '#8C5A66',
                color: 'white',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
