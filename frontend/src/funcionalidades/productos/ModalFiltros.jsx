import { useState } from 'react'
import { ICONO_TIPO, ICONO_TEMA, formatearPrecio } from './presentacion'
import { FILTROS_VACIOS, candidatos, rangoDePrecios } from './filtros'


const ESTADOS = [
  { valor: 'ACTIVO', label: 'Activos' },
  { valor: 'BAJA', label: 'Dados de baja' },
]

const DIFICULTADES = [
  { valor: 'BAJA', label: 'Baja' },
  { valor: 'MEDIA', label: 'Media' },
  { valor: 'ALTA', label: 'Alta' },
]

const CATALOGO = ['En catálogo', 'Personalizado']

const GRUPOS_CATEGORIA = [
  { tipo: 'TIPO', titulo: 'Por tipo de accesorio', icono: ICONO_TIPO, fondo: '#F0E2E4', color: '#8C5A66' },
  { tipo: 'TEMATICA', titulo: 'Por temática', icono: ICONO_TEMA, fondo: '#FDF3E0', color: '#D9A441' },
]

const PASO = 500


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
  productos,
  busqueda,
  categorias,
  onCerrar,
  onAplicar,
}) {
  // El BORRADOR vive acá, no en la pantalla.
  //
  // Solo existe mientras el modal está abierto: marcar opciones no cambia
  // la grilla, y cerrar sin aplicar tiene que descartar todo. Como la
  // pantalla monta este componente recién al abrirlo, useState lo
  // inicializa cada vez desde los filtros que están aplicados, y al cerrar
  // el componente se desmonta y el borrador se va solo.
  //
  // El único camino por el que el borrador sale de acá es APLICAR.
  const [borrador, setBorrador] = useState(filtros)

  const rango = rangoDePrecios(productos)
  const desdeValor = borrador.desde === null ? rango.min : borrador.desde
  const hastaValor = borrador.hasta === null ? rango.max : borrador.hasta

  // El contador en vivo: la MISMA función que usa la pantalla para armar la
  // grilla, pero con el borrador en vez de los filtros aplicados. Incluye el
  // texto del buscador, porque si no diría un número distinto del que se va
  // a ver al aplicar.
  const coinciden = candidatos(productos, borrador, busqueda).length

  // Marca o desmarca un valor dentro de uno de los criterios de lista.
  function alternar(campo, valor) {
    setBorrador((actual) => ({
      ...actual,
      [campo]: actual[campo].includes(valor)
        ? actual[campo].filter((v) => v !== valor)
        : actual[campo].concat(valor),
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
            Filtrar productos
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
            <p style={{ ...estiloTitulo, marginBottom: 12 }}>CATEGORÍAS</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {GRUPOS_CATEGORIA.map((grupo) => {
                const opciones = categorias.filter((c) => c.tipo === grupo.tipo)
                if (opciones.length === 0) return null

                return (
                  <div key={grupo.tipo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          flexShrink: 0,
                          borderRadius: 6,
                          background: grupo.fondo,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={grupo.color} strokeWidth="1.9">
                          <path strokeLinecap="round" strokeLinejoin="round" d={grupo.icono} />
                        </svg>
                      </div>
                      <span
                        style={{
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                          color: '#3D3238',
                        }}
                      >
                        {grupo.titulo}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {opciones.map((c) => (
                        <Chip
                          key={c.id}
                          label={c.nombre}
                          activo={borrador.categorias.includes(c.id)}
                          onClick={() => alternar('categorias', c.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>DIFICULTAD</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {DIFICULTADES.map((d) => (
                <Chip
                  key={d.valor}
                  label={d.label}
                  activo={borrador.dificultades.includes(d.valor)}
                  onClick={() => alternar('dificultades', d.valor)}
                />
              ))}
            </div>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>CATÁLOGO</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {CATALOGO.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  activo={borrador.tipo.includes(c)}
                  onClick={() => alternar('tipo', c)}
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
              <p style={{ ...estiloTitulo, margin: 0 }}>RANGO DE PRECIO</p>
              <span
                style={{
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#8C5A66',
                }}
              >
                {formatearPrecio(desdeValor)} – {formatearPrecio(hastaValor)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, flexShrink: 0, fontSize: 13, color: '#857078' }}>
                  Desde
                </span>
                <input
                  type="range"
                  min={rango.min}
                  max={rango.max}
                  step={PASO}
                  value={desdeValor}
                  onChange={(e) =>
                    setBorrador((actual) => ({
                      ...actual,
                      // Nunca pasa de "Hasta".
                      desde: Math.min(Number(e.target.value), hastaValor),
                    }))
                  }
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#8C5A66' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, flexShrink: 0, fontSize: 13, color: '#857078' }}>
                  Hasta
                </span>
                <input
                  type="range"
                  min={rango.min}
                  max={rango.max}
                  step={PASO}
                  value={hastaValor}
                  onChange={(e) =>
                    setBorrador((actual) => ({
                      ...actual,
                      // Nunca baja de "Desde".
                      hasta: Math.max(Number(e.target.value), desdeValor),
                    }))
                  }
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#8C5A66' }}
                />
              </div>
            </div>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>ESTADO DEL PRODUCTO</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ESTADOS.map((e) => (
                <Chip
                  key={e.valor}
                  label={e.label}
                  activo={borrador.estados.includes(e.valor)}
                  onClick={() => alternar('estados', e.valor)}
                />
              ))}
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
            {coinciden === 1 ? '1 producto coincide' : `${coinciden} productos coinciden`}
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
