// El enlace "Ver catálogo" de la gestión: abre el catálogo público en
// otra pestaña. Es un <a> y no un botón con navegar() ni un <Link>, porque
// tiene que abrir OTRA pestaña y dejar la gestión como está; la raíz del
// sitio es el catálogo. Tiene el aspecto de los accesos rápidos
// secundarios de Inicio (borde, fondo blanco) y el mismo hover, con la
// clase btn-reponer. Lo usan Inicio y Productos.

// La flecha saliendo de un cuadrado, de Heroicons outline como el resto.
const ICONO_ABRIR_AFUERA = 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'

export default function EnlaceCatalogo() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      title="Abre el catálogo público en otra pestaña"
      className="btn-reponer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 15,
        border: '1px solid #EBE0E2',
        background: 'white',
        color: '#8C5A66',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ABRIR_AFUERA} />
      </svg>
      Ver catálogo
    </a>
  )
}
