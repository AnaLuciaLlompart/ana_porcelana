import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexto/AuthContext'
import { BASE_GESTION } from './constantes'
import Layout from './componentes/Layout'
import LayoutPublico from './componentes/LayoutPublico'
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
import Catalogo from './funcionalidades/catalogo/Catalogo'
import DetalleCatalogo from './funcionalidades/catalogo/DetalleCatalogo'
import MiSeleccion from './funcionalidades/catalogo/MiSeleccion'
import Mensaje from './funcionalidades/catalogo/Mensaje'
import ComoHacerUnPedido from './funcionalidades/catalogo/ComoHacerUnPedido'
import Tips from './funcionalidades/catalogo/Tips'
import PaginaNoEncontrada from './funcionalidades/catalogo/PaginaNoEncontrada'



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

        {/* El catálogo público, sin sesión (CU63 a CU70). LayoutPublico no
            lleva path: envuelve a todas. El asterisco atrapa cualquier
            dirección que no sea de nadie, también las de gestión escritas
            sin el prefijo. */}
        <Route element={<LayoutPublico />}>
          <Route path="/" element={<Catalogo />} />
          <Route path="/productos/:id" element={<DetalleCatalogo />} />
          <Route path="/seleccion" element={<MiSeleccion />} />
          <Route path="/mensaje" element={<Mensaje />} />
          <Route path="/como-hacer-un-pedido" element={<ComoHacerUnPedido />} />
          <Route path="/tips" element={<Tips />} />
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>

        {/* Toda la gestión cuelga de esta ruta. El prefijo se escribe acá
            una sola vez y las de adentro son relativas a él: sin barra
            adelante, y con index para la que coincide con el prefijo solo.
            AuthProvider envuelve solo esta rama: es la única que necesita
            saber quién tiene la sesión, y así el catálogo no la consulta.
            El Outlet de adentro es donde se dibujan las rutas hijas. */}
        <Route path={BASE_GESTION} element={<AuthProvider><Outlet /></AuthProvider>}>

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