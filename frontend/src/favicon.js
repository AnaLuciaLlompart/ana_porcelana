// Las dos rutas del ícono de la pestaña, una por ámbito. Los archivos
// están en frontend/public/, que Vite sirve en la raíz del sitio. El de
// por defecto en index.html es el del catálogo: Safari no cambia el ícono
// cuando cambia el href, y el catálogo es lo que ve cualquiera.
export const FAVICON_CATALOGO = '/favicon-catalogo.svg'
export const FAVICON_GESTION = '/favicon-gestion.svg'

// Cambia el ícono de la pestaña. Busca la etiqueta <link id="favicon"> de
// index.html y le escribe la ruta; si no está, no hace nada. La llaman los
// dos layouts y el login al montarse, cada uno con el ícono de su ámbito.
export function cambiarFavicon(ruta) {
  const etiqueta = document.getElementById('favicon')
  if (!etiqueta) return
  etiqueta.href = ruta
}
