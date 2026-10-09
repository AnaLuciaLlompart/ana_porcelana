import axios from 'axios'
import { BASE_GESTION } from '../constantes'

// axios: Es una biblioteca de JavaScript para hacer pedidos HTTP desde el navegador. Es la herramienta con la que React le habla a Django.

const cliente = axios.create({
  baseURL: '/api',
  withCredentials: true, // le dice a axios que incluya las cookies
  xsrfCookieName: 'csrftoken', //cookie de sesion
  xsrfHeaderName: 'X-CSRFToken', //cookie de CSRF
}) // axios lee la cookie csrftoken y copia su valor en la cabecera X-CSRFToken, en cada POST, PUT, PATCH y DELETE

// Un 403 significa que la sesión ya no sirve (venció o se cerró del lado
// del servidor): con IsAuthenticated global, el backend responde eso a todo
// pedido sin sesión. Se vuelve al login recargando la página, que descarta
// el estado de la gestión. Es 403 y no 401: el 401 lo devuelven el login
// con credenciales incorrectas y /auth/sesion/ sin sesión, y ahí no hay que
// hacer nada. El error se propaga igual, para que cada pantalla lo maneje.
cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 403) {
      window.location.assign(`${BASE_GESTION}/login`)
    }
    return Promise.reject(error)
  }
)


// Creamos las funciones para el cliente HTTP. Estas las usara React y encapsulan las URL (evito de escribirlas en React). 
// Las 4 devuelven una PROMESA (como Playwright)

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


export default cliente