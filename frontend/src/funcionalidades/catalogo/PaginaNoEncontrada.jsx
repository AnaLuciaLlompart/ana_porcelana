import CajaMensaje from './CajaMensaje'

// La página de cualquier dirección que no es de nadie. Es la ruta "*" de
// rutas.jsx, y acá caen también las direcciones de gestión escritas sin su
// prefijo.

export default function PaginaNoEncontrada() {
  return (
    <CajaMensaje
      titulo="No encontramos esa página"
      textoSalida="Ver el catálogo"
      ruta="/"
    />
  )
}
