import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexto/AuthContext'
import Layout from './componentes/Layout'
import Login from './funcionalidades/auth/Login'
import MiCuenta from './funcionalidades/auth/MiCuenta'
import Materiales from './funcionalidades/materiales/Materiales'
import Categorias from './funcionalidades/categorias/Categorias'
import Productos from './funcionalidades/productos/Productos'
import DetalleProducto from './funcionalidades/productos/DetalleProducto'
import Clientes from './funcionalidades/clientes/Clientes'
import Pedidos from './funcionalidades/pedidos/Pedidos'
import DetallePedido from './funcionalidades/pedidos/DetallePedido'
import Gastos from './funcionalidades/gastos/Gastos'
import DetalleGasto from './funcionalidades/gastos/DetalleGasto'
import Finanzas from './funcionalidades/finanzas/Finanzas'



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
            <Route path="/mi-cuenta" element={<MiCuenta />} />
            <Route path="/materiales" element={<Materiales />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/productos/nuevo" element={<DetalleProducto esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /productos/:id para que "nuevo" no se lea como un id. */}
            <Route path="/productos/:id" element={<DetalleProducto />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/pedidos/nuevo" element={<DetallePedido esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /pedidos/:id para que "nuevo" no se lea como un id. */}
            <Route path="/pedidos/:id" element={<DetallePedido />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/gastos/nuevo" element={<DetalleGasto esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /gastos/:id para que "nuevo" no se lea como un id. */}
            <Route path="/gastos/:id" element={<DetalleGasto />} />
            <Route path="/finanzas" element={<Finanzas />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  )
}