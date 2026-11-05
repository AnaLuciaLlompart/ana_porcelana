import { useState } from 'react'
import BotonAccion from './BotonAccion'
import { OJO, OJO_TACHADO } from '../funcionalidades/auth/presentacion'
import { estiloCampo, estiloEtiqueta, estiloNombreCampo } from '../funcionalidades/clientes/ModalCliente'

// Un campo de contraseña con el ojo que la muestra y la oculta. Lo usan
// ModalCambiarPassword (Mi cuenta), ModalUsuario (la contraseña del alta y
// la actual de Mis datos) y ModalContrasenaDeUsuario. Nació en la gestión
// de usuarios y vino a componentes/ cuando Mi cuenta pasó a usarlo. Cada
// campo tiene su propio ojo: mostrar uno no muestra los demás.
export default function CampoContrasena({ id, etiqueta, valor, onCambiar, error, ayuda, autoComplete }) {
  const [ver, setVer] = useState(false)

  return (
    <div>
      <label htmlFor={id} style={estiloEtiqueta}>
        <span style={estiloNombreCampo}>{etiqueta}</span>
      </label>

      <div style={{ position: 'relative' }}>
        <input
          id={id}
          // Alternar el type es lo que muestra y oculta el texto.
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          autoComplete={autoComplete}
          style={{
            ...estiloCampo,
            // El padding de la derecha le hace lugar al ojo, que va encima.
            padding: '10px 44px 10px 13px',
            border: error ? '1px solid #C0442F' : '1px solid #EBE0E2',
          }}
        />

        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
          <BotonAccion
            onClick={() => setVer((v) => !v)}
            titulo={ver ? 'Ocultar' : 'Mostrar'}
            color="#857078"
            hover="#F0E2E4"
            icono={ver ? OJO_TACHADO : OJO}
            lado={32}
          />
        </div>
      </div>

      {(error || ayuda) && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: error ? '#C0442F' : '#B08791' }}>
          {error || ayuda}
        </p>
      )}
    </div>
  )
}
