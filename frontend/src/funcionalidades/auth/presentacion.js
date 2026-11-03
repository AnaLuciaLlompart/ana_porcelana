// Lo que comparten las pantallas de acceso (login, pedir el enlace para
// restablecer la contraseña y elegir la nueva): los estilos de la tarjeta,
// los campos y los botones, y los dos estados del ojo de la contraseña.

export const OJO = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
export const OJO_TACHADO = 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'

// El mismo mínimo que aplica el MinimumLengthValidator de Django, así el
// aviso de acá no puede contradecir al error del servidor.
export const MINIMO_CONTRASENA = 8

export const estiloTarjeta = {
  background: 'white',
  border: '1px solid #EBE0E2',
  borderRadius: 10,
  padding: '28px 26px',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

export const estiloCampo = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #EBE0E2',
  background: '#FAF7F7',
  fontSize: 15,
  color: '#3D3238',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
}

export const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.03em',
}

// El botón grande de la tarjeta; apagado mientras viaja el pedido.
export function estiloBotonPrincipal(ocupado) {
  return {
    width: '100%',
    padding: 12,
    marginTop: 2,
    border: 0,
    background: '#8C5A66',
    color: 'white',
    borderRadius: 6,
    cursor: ocupado ? 'default' : 'pointer',
    opacity: ocupado ? 0.7 : 1,
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 600,
    fontSize: 16,
  }
}

// Un botón que se ve como un enlace: navega con navegar(), como todo lo
// que navega en la gestión.
export const estiloEnlace = {
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#8C5A66',
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}
