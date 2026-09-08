import { useState } from 'react'
import { FILTROS_VACIOS, candidatos } from './filtros'


const DISPONIBILIDADES = [
  { valor: 'ALTA', label: 'Alta' },
  { valor: 'MEDIA', label: 'Media' },
  { valor: 'BAJA', label: 'Baja' },
]

const ESTADOS = [
  { valor: 'ACTIVO', label: 'Activo' },
  { valor: 'DISCONTINUADO', label: 'Discontinuado' },
]


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
  materiales,
  productos,
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

  // El texto del buscador de productos es aparte del borrador: no es un
  // filtro, es la forma de encontrar el producto que sí lo es.
  const [buscaProducto, setBuscaProducto] = useState('')

  // El contador en vivo: la MISMA función que usa la pantalla para armar la
  // lista, pero con el borrador en vez de los filtros aplicados. Incluye el
  // texto del buscador, porque si no diría un número distinto del que se va
  // a ver al aplicar.
  const coinciden = candidatos(materiales, borrador, busqueda, productos).length

  const elegido = productos.find((p) => p.id === borrador.producto)

  const texto = buscaProducto.trim().toLowerCase()

  // Con el campo vacío no se lista nada: son hasta un centenar de
  // productos y mostrarlos todos sería una pared.
  const coincidencias = texto
    ? productos.filter((p) => p.nombre.toLowerCase().includes(texto))
    : []

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
            Filtrar materiales
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
            <p style={estiloTitulo}>DISPONIBILIDAD</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {DISPONIBILIDADES.map((d) => (
                <Chip
                  key={d.valor}
                  label={d.label}
                  activo={borrador.disponibilidades.includes(d.valor)}
                  onClick={() => alternar('disponibilidades', d.valor)}
                />
              ))}
            </div>
          </div>

          <div style={separador}>
            <p style={estiloTitulo}>ESTADO</p>
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

          <div style={separador}>
            <p style={estiloTitulo}>APARECE EN EL PRODUCTO</p>

            {/* Con uno elegido no hace falta el buscador: se muestra cuál
                es, y la cruz lo saca sin cerrar el modal. */}
            {elegido ? (
              <button
                onClick={() => setBorrador((actual) => ({ ...actual, producto: null }))}
                title="Quitar el filtro por producto"
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
                {elegido.nombre}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
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
                    value={buscaProducto}
                    onChange={(e) => setBuscaProducto(e.target.value)}
                    placeholder="Buscar producto..."
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

                {texto && (
                  <div
                    style={{
                      marginTop: 10,
                      border: '1px solid #EBE0E2',
                      borderRadius: 6,
                      maxHeight: 190,
                      overflowY: 'auto',
                    }}
                  >
                    {coincidencias.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setBorrador((actual) => ({ ...actual, producto: p.id }))
                          setBuscaProducto('')
                        }}
                        className="fila-material"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '11px 14px',
                          border: 0,
                          borderBottom: '1px solid #EBE0E2',
                          background: 'white',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 15,
                          color: '#3D3238',
                        }}
                      >
                        {p.nombre}
                      </button>
                    ))}

                    {coincidencias.length === 0 && (
                      <div style={{ padding: '18px 14px', fontSize: 15, color: '#857078' }}>
                        Ningún producto coincide.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
            {coinciden === 1 ? '1 material coincide' : `${coinciden} materiales coinciden`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => {
                setBorrador(FILTROS_VACIOS)
                setBuscaProducto('')
              }}
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
