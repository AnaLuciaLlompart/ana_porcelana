import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexto/AuthContext'
import { BASE_GESTION } from './constantes'
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
import Inicio from './funcionalidades/inicio/Inicio'



function Protegido() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <p style={{ padding: 32 }}>Cargando…</p>
  if (!usuario) return <Navigate to={`${BASE_GESTION}/login`} replace />

  return <Outlet />
}

function Publico() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <p style={{ padding: 32 }}>Cargando…</p>
  if (usuario) return <Navigate to={BASE_GESTION} replace />

  return <Outlet />
}

export default function Rutas() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Provisoria: mientras el catálogo público no exista, la raíz del
            sitio lleva a la gestión. La etapa C reemplaza esta línea por
            las rutas del catálogo. */}
        <Route path="/" element={<Navigate to={BASE_GESTION} replace />} />

        {/* Toda la gestión cuelga de esta ruta. El prefijo se escribe acá
            una sola vez y las de adentro son relativas a él: sin barra
            adelante, y con index para la que coincide con el prefijo solo.
            No lleva element, así que dibuja directamente a sus hijas. */}
        <Route path={BASE_GESTION}>

          <Route element={<Publico />}>
            <Route path="login" element={<Login />} />
          </Route>

          <Route element={<Protegido />}>
            <Route element={<Layout />}>
              <Route index element={<Inicio />} />
              <Route path="mi-cuenta" element={<MiCuenta />} />
              <Route path="materiales" element={<Materiales />} />
              <Route path="categorias" element={<Categorias />} />
              <Route path="productos" element={<Productos />} />
              <Route path="productos/nuevo" element={<DetalleProducto esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /productos/:id para que "nuevo" no se lea como un id. */}
              <Route path="productos/:id" element={<DetalleProducto />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="pedidos/nuevo" element={<DetallePedido esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /pedidos/:id para que "nuevo" no se lea como un id. */}
              <Route path="pedidos/:id" element={<DetallePedido />} />
              <Route path="gastos" element={<Gastos />} />
              <Route path="gastos/nuevo" element={<DetalleGasto esAlta />} />  {/* El alta usa la misma ficha que la edición. Va ANTES que /gastos/:id para que "nuevo" no se lea como un id. */}
              <Route path="gastos/:id" element={<DetalleGasto />} />
              <Route path="finanzas" element={<Finanzas />} />
            </Route>
          </Route>

        </Route>

      </Routes>
    </BrowserRouter>
  )
}