import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cambiarPassword } from '../../api/cliente'

export default function CambiarPassword() {
  const navegar = useNavigate()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    setExito('')

    if (nueva !== repetida) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setEnviando(true)

    try {
      await cambiarPassword(actual, nueva)
      setExito('Contraseña actualizada.')
      setActual('')
      setNueva('')
      setRepetida('')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar la contraseña.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={manejarEnvio}>
      <h1>Modificar contraseña</h1>

      <label htmlFor="actual">Contraseña actual</label>
      <input
        id="actual"
        type="password"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        autoComplete="current-password"
      />

      <label htmlFor="nueva">Contraseña nueva</label>
      <input
        id="nueva"
        type="password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        autoComplete="new-password"
      />

      <label htmlFor="repetida">Repetir la nueva</label>
      <input
        id="repetida"
        type="password"
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        autoComplete="new-password"
      />

      {error && <p role="alert">{error}</p>}
      {exito && <p role="status">{exito}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>

      <button type="button" onClick={() => navegar('/')}>
        Volver
      </button>
    </form>
  )
}
