// El icono de Instagram, en el color del texto que lo rodea
// (currentColor). Lo usan el encabezado y el panel de LayoutPublico, el
// botón "Consultar por Instagram" de la selección y "Abrir Instagram" del
// mensaje. Son tres trazos y no uno, por eso es un componente y no una
// constante con el path como los demás iconos del catálogo.

export default function IconoInstagram({ lado }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
