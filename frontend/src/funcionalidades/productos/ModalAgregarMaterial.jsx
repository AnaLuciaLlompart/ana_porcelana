import { useState } from 'react'

const ICONO_MATERIAL = 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'

export default function ModalAgregarMaterial({ materiales, onCerrar, onElegir }) {
  const [busqueda, setBusqueda] = useState('')

  // Filtrado local sobre la lista que ya llegó por props, así que no lleva
  // debounce: no hay ningún pedido al servidor que esperar.
  //
  // Se busca solo por nombre, que es lo único que se ve en cada fila. Si
  // buscara también en la descripción aparecerían materiales sin ninguna
  // coincidencia visible, y no se entendería por qué están.
  const texto = busqueda.trim().toLowerCase()

  const filtrados = materiales.filter(
    (material) => !texto || material.nombre.toLowerCase().includes(texto)
  )

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
          maxWidth: 450,
          maxHeight: '82vh',
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
            Agregar material
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

        {/* Sin materiales para elegir no hay nada que buscar, así que el
            buscador solo aparece cuando la lista tiene algo. */}
        {materiales.length > 0 && (
          <div style={{ padding: '14px 24px', flexShrink: 0, borderBottom: '1px solid #EBE0E2' }}>
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
          </div>
        )}

        <div style={{ overflowY: 'auto' }}>
          {filtrados.map((material) => (
            <button
              key={material.id}
              onClick={() => onElegir(material)}
              className="fila-material"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '13px 24px',
                border: 0,
                borderBottom: '1px solid #EBE0E2',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: 8,
                  background: '#FAF7F7',
                  border: '1px solid #EBE0E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.6">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_MATERIAL} />
                </svg>
              </div>

              <span style={{ flex: 1, fontSize: 15, color: '#3D3238' }}>{material.nombre}</span>
            </button>
          ))}

          {materiales.length === 0 && (
            <div style={{ padding: '36px 24px', textAlign: 'center', fontSize: 15, color: '#857078' }}>
              Ya asignaste todos los materiales activos.
            </div>
          )}

          {materiales.length > 0 && filtrados.length === 0 && (
            <div style={{ padding: '36px 24px', textAlign: 'center', fontSize: 15, color: '#857078' }}>
              Ningún material coincide con esa búsqueda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
