import axios from 'axios'
import { BASE_GESTION } from '../constantes'

// axios: Es una biblioteca de JavaScript para hacer pedidos HTTP desde el navegador. Es la herramienta con la que React le habla a Django.

const cliente = axios.create({
  baseURL: '/api',
  withCredentials: true, // le dice a axios que incluya las cookies
  xsrfCookieName: 'csrftoken', //cookie de sesion
  xsrfHeaderName: 'X-CSRFToken', //cookie de CSRF
}) // axios lee la cookie csrftoken y copia su valor en la cabecera X-CSRFToken, en cada POST, PUT, PATCH y DELETE

// Un 403 suele significar que la sesión ya no sirve (venció o se cerró del
// lado del servidor): con IsAuthenticated global, el backend responde eso a
// todo pedido sin sesión. Pero desde los dos roles también es 403 "no sos
// superadministradora" (y siempre lo fue un fallo de CSRF), con la sesión
// viva. Para distinguirlos se le pregunta al backend si hay sesión, con un
// axios pelado para no pasar otra vez por acá: si /auth/sesion/ dice 401,
// se vuelve al login recargando la página, que descarta el estado de la
// gestión; si dice 200, el 403 es de permisos y se deja pasar. El error se
// propaga igual, para que cada pantalla lo maneje. Es 403 y no 401: el 401
// lo devuelven el login con credenciales incorrectas y /auth/sesion/ sin
// sesión, y ahí no hay que hacer nada.
async function haySesion() {
  try {
    await axios.get('/api/auth/sesion/', { withCredentials: true })
    return true
  } catch (error) {
    return error.response?.status !== 401
  }
}

cliente.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    if (error.response?.status === 403 && !(await haySesion())) {
      window.location.assign(`${BASE_GESTION}/login`)
    }
    return Promise.reject(error)
  }
)


// Creamos las funciones para el cliente HTTP. Estas las usara React y encapsulan las URL (evito de escribirlas en React). 
// Las 7 devuelven una PROMESA (como Playwright)

export function consultarSesion() {
  return cliente.get('/auth/sesion/')
}

export function iniciarSesion(username, password) {
  return cliente.post('/auth/login/', { username, password })
}

export function cerrarSesion() {
  return cliente.post('/auth/logout/')
}

export function cambiarPassword(passwordActual, passwordNueva) {
  return cliente.post('/auth/password/', {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  })
}

// Recuperar la contraseña por correo (corrección del tutor): pedir el
// enlace, preguntar si el enlace sirve y guardar la contraseña nueva.
export function pedirEnlaceDeRestablecimiento(email) {
  return cliente.post('/auth/recuperar/', { email })
}

export function validarEnlaceDeRestablecimiento(uid, token) {
  return cliente.get(`/auth/restablecer/${uid}/${token}/`)
}

export function restablecerContrasena(uid, token, passwordNueva) {
  return cliente.post(`/auth/restablecer/${uid}/${token}/`, { password_nueva: passwordNueva })
}

// Mis datos (corrección del tutor: dos roles): la superadministradora cambia
// su usuario, nombre, apellido y correo. Si cambia el usuario o el correo,
// datos lleva también password_actual. Un administrador recibe 403.
export function modificarMisDatos(datos) {
  return cliente.patch('/auth/mis_datos/', datos)
}


export default cliente