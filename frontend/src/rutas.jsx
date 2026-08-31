import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexto/AuthContext'
import Layout from './componentes/Layout'
import Login from './paginas/gestion/Login'
import CambiarPassword from './paginas/gestion/CambiarPassword'
import Materiales from './paginas/gestion/Materiales'
import Categorias from './paginas/gestion/Categorias'



function Protegido() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <p style={{ padding: 32 }}>Cargando…</p>
  if (!usuario) return <Navigate to="/login" replace />

  return <Outlet />
}

function Publico() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <p style={{ padding: 32 }}>Cargando…</p>
  if (usuario) return <Navigate to="/" replace />

  return <Outlet />
}

function Inicio() {
  const { usuario } = useAuth()

  return (
    <h1 style={{
      margin: 0,
      fontFamily: "'Quicksand', sans-serif",
      fontWeight: 600,
      fontSize: 32,
      color: '#3D3238',
    }}>
      Hola, {usuario.nombre}
    </h1>
  )
}

function EnConstruccion() {
  return (
    <p style={{ fontSize: 16, color: '#857078' }}>
      Esta sección todavía no está desarrollada.
    </p>
  )
}

export default function Rutas() {
  return (
    <BrowserRouter>
      <Routes>

        <Route element={<Publico />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<Protegido />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/password" element={<CambiarPassword />} />
            <Route path="/materiales" element={<Materiales />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/productos" element={<EnConstruccion />} />
            <Route path="/clientes" element={<EnConstruccion />} />
            <Route path="/pedidos" element={<EnConstruccion />} />
            <Route path="/gastos" element={<EnConstruccion />} />
            <Route path="/informes" element={<EnConstruccion />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  )
}