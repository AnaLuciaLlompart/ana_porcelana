import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api/cliente'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.consultarSesion()
      .then((res) => setUsuario(res.data))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  async function entrar(username, password) {
    const res = await api.iniciarSesion(username, password)
    setUsuario(res.data)
  }

  async function salir() {
    try {
      await api.cerrarSesion()
    } catch {
      // Si el servidor ya no reconoce la sesión o no responde, no hay nada
      // que cerrar allá: igual se sale del lado del navegador.
    }
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, entrar, salir }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
