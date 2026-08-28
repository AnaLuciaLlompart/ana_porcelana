import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './contexto/AuthContext'
import Rutas from './rutas'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Rutas />
    </AuthProvider>
  </StrictMode>,
)

