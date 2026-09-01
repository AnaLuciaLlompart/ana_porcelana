import axios from 'axios'

// axios: Es una biblioteca de JavaScript para hacer pedidos HTTP desde el navegador. Es la herramienta con la que React le habla a Django.

const cliente = axios.create({
  baseURL: '/api',
  withCredentials: true, // le dice a axios que incluya las cookies
  xsrfCookieName: 'csrftoken', //cookie de sesion
  xsrfHeaderName: 'X-CSRFToken', //cookie de CSRF
}) // axios lee la cookie csrftoken y copia su valor en la cabecera X-CSRFToken, en cada POST, PUT, PATCH y DELETE


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