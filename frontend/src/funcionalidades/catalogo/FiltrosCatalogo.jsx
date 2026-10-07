import { ICONO_TILDE, QUICKSAND } from './presentacion'

// Los filtros por categoría (CU64): los dos grupos de casillas, con la
// cantidad de productos de cada categoría, y "Quitar filtros" cuando hay
// alguno puesto.
//
// Se dibuja en dos lugares con el mismo contenido: a la vista, a la
// izquierda de la grilla, en escritorio; y dentro del panel que sube desde
// abajo, en celular. Por eso no sabe dónde está ni guarda nada: recibe qué
// hay elegido y avisa hacia arriba cada clic.
//
// Las casillas son botones y no enlaces porque no llevan a otra pantalla:
// cambian lo que se ve en esta.

export default function FiltrosCatalogo({ grupos, idsElegidos, onAlternar, onQuitar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {grupos.map((grupo) => (
        <div key={grupo.tipo}>
          <p
            style={{
              margin: '0 0 6px',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#708085',
            }}
          >
            {grupo.titulo}
          </p>

          {grupo.categorias.map((categoria) => {
            const elegida = idsElegidos.includes(categoria.id)

            return (
              <button
                key={categoria.id}
                role="checkbox"
                aria-checked={elegida}
                onClick={() => onAlternar(categoria.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  minHeight: 36,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 15,
                  color: '#323A3D',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 5,
                    border: `1px solid ${elegida ? '#5A7A8C' : '#E0E8EB'}`,
                    background: elegida ? '#5A7A8C' : 'white',
                  }}
                >
                  {elegida && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
                    </svg>
                  )}
                </span>

                <span style={{ flex: 1 }}>{categoria.nombre}</span>

                <span style={{ fontSize: 13, color: '#87A0B0' }}>{categoria.cantidad}</span>
              </button>
            )
          })}
        </div>
      ))}

      {idsElegidos.length > 0 && (
        <button
          onClick={onQuitar}
          className="catalogo-subrayado"
          style={{
            alignSelf: 'flex-start',
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: QUICKSAND,
            fontWeight: 600,
            fontSize: 14,
            color: '#5A7A8C',
          }}
        >
          Quitar filtros
        </button>
      )}
    </div>
  )
}
