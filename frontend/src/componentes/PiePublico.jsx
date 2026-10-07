import { Link } from 'react-router-dom'
import { INSTAGRAM_URL, INSTAGRAM_USUARIO } from '../constantes'
import IconoInstagram from './IconoInstagram'

// El pie del catálogo público, en todas sus páginas. Son las cuatro
// columnas del diseño: la marca, PRODUCTOS (las categorías de tipo de
// accesorio, que filtran el catálogo igual que el árbol), AYUDA (las dos
// páginas de texto) y CONTACTO (Instagram); y debajo el copyright, con el
// año calculado para que no envejezca.
//
// Recibe los grupos de categorías que arma el layout y alElegir, que sube
// la página al elegir una categoría desde acá abajo.
//
// La grilla es repeat(auto-fit, minmax(200px, 1fr)): una columna en
// celular y cuatro en escritorio sin media query, porque se acomoda sola
// según cuántas de 200px entren.

const QUICKSAND = "'Quicksand', sans-serif"

const estiloTitulo = {
  margin: '0 0 10px',
  fontFamily: QUICKSAND,
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#708085',
}

const estiloEnlace = {
  textDecoration: 'none',
  fontSize: 14,
  color: '#323A3D',
}

export default function PiePublico({ grupos, alElegir }) {
  // Las categorías de tipo de accesorio; mientras el catálogo carga no
  // hay ninguna y la columna no se dibuja.
  const tipos = grupos.find((grupo) => grupo.tipo === 'TIPO')?.categorias ?? []

  return (
    <footer style={{ marginTop: 48, background: 'white', borderTop: '1px solid #E0E8EB' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '36px 16px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 28,
        }}
      >
        <div>
          <p style={{ margin: '0 0 10px', fontFamily: QUICKSAND, fontWeight: 700, fontSize: 18, color: '#5A7A8C' }}>
            Ana Porcelana
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#708085', textWrap: 'pretty' }}>
            Accesorios artesanales en porcelana fría, hechos a mano en Tucumán, Argentina.
          </p>
        </div>

        {tipos.length > 0 && (
          <div>
            <p style={estiloTitulo}>PRODUCTOS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tipos.map((categoria) => (
                <Link
                  key={categoria.id}
                  to={`/?categoria=${categoria.id}`}
                  onClick={alElegir}
                  className="catalogo-item"
                  style={estiloEnlace}
                >
                  {categoria.nombre}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <p style={estiloTitulo}>AYUDA</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Link to="/como-hacer-un-pedido" onClick={alElegir} className="catalogo-item" style={estiloEnlace}>
              Cómo hacer un pedido
            </Link>
            <Link to="/tips" onClick={alElegir} className="catalogo-item" style={estiloEnlace}>
              Tips para tus piezas
            </Link>
          </div>
        </div>

        <div>
          <p style={estiloTitulo}>CONTACTO</p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="catalogo-instagram"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 14,
              color: '#5A7A8C',
            }}
          >
            <IconoInstagram lado={18} />
            @{INSTAGRAM_USUARIO}
          </a>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E0E8EB' }}>
        <p style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 16px', fontSize: 13, color: '#708085' }}>
          © {new Date().getFullYear()} Ana Porcelana
        </p>
      </div>
    </footer>
  )
}
