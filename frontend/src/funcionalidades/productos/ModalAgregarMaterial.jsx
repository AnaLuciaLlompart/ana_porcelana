import SelectorBuscable from '../../componentes/SelectorBuscable'

export default function ModalAgregarMaterial({ materiales, onCerrar, onElegir }) {
  // Filtrado local sobre la lista que ya llegó por props, así que no lleva
  // debounce: no hay ningún pedido al servidor que esperar.
  //
  // Se busca solo por nombre, que es lo único que se ve en cada fila. Si
  // buscara también en la descripción aparecerían materiales sin ninguna
  // coincidencia visible, y no se entendería por qué están.

  return (
    <div
      className="modal-fondo"
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
        className="modal-caja"
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
          <div style={{ padding: '16px 24px 24px', overflowY: 'auto' }}>
            <SelectorBuscable
              siempreAbierto
              opciones={materiales.map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))}
              onElegir={(valor) => onElegir(materiales.find((m) => String(m.id) === valor))}
              placeholderBusqueda="Buscar material..."
            />
          </div>
        )}

        {materiales.length === 0 && (
          <div style={{ padding: '36px 24px', textAlign: 'center', fontSize: 15, color: '#857078' }}>
            Ya asignaste todos los materiales activos.
          </div>
        )}
      </div>
    </div>
  )
}
