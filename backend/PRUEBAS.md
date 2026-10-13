# Pruebas automatizadas del backend

Corren con `python manage.py test` desde `backend/`, con el venv activo.
Una app sola: `python manage.py test <app>`. Cobertura: `coverage run
manage.py test` y después `coverage report`.

Grupos: permisos, seguridad, catálogo, reglas de negocio, validación,
rendimiento.

| App | Prueba | Qué verifica | CU o regla | Grupo |
|---|---|---|---|---|
| usuarios | test_materiales_sin_sesion_da_403 | GET, POST, PUT, PATCH y DELETE a /api/materiales/ sin sesión responden 403 | Denegación por defecto (IsAuthenticated global) | permisos |
| usuarios | test_categorias_sin_sesion_da_403 | Lo mismo sobre /api/categorias/ | Denegación por defecto | permisos |
| usuarios | test_productos_sin_sesion_da_403 | Lo mismo sobre /api/productos/ | Denegación por defecto | permisos |
| usuarios | test_clientes_sin_sesion_da_403 | Lo mismo sobre /api/clientes/ | Denegación por defecto | permisos |
| usuarios | test_pedidos_sin_sesion_da_403 | Lo mismo sobre /api/pedidos/ | Denegación por defecto | permisos |
| usuarios | test_gastos_sin_sesion_da_403 | Lo mismo sobre /api/gastos/ | Denegación por defecto | permisos |
| usuarios | test_finanzas_sin_sesion_da_403 | GET a /api/finanzas/ con un período válido sin sesión responde 403 | Denegación por defecto (CU61, CU62) | permisos |
| usuarios | test_inicio_sin_sesion_da_403 | GET a /api/inicio/ sin sesión responde 403 | Denegación por defecto | permisos |
| usuarios | test_admin_sin_sesion_redirige_al_login | GET a /admin/ sin sesión redirige (302) a /admin/login/ | El admin es herramienta de desarrollo y también exige sesión | permisos |
| usuarios | test_post_sin_token_csrf_da_403 | Con sesión pero sin token CSRF, un POST responde 403 | Protección CSRF de SessionAuthentication | seguridad |
| usuarios | test_cookie_de_sesion_lleva_httponly | La cookie sessionid del login lleva HttpOnly y Max-Age de 24 horas | Autenticación por sesión con cookie HttpOnly; sesión de 24 h | seguridad |
| usuarios | test_login_bloqueado_tras_intentos_fallidos | Al quinto fallo el login responde 429 con mensaje, y la contraseña correcta tampoco entra | Bloqueo por intentos fallidos (django-axes, CU01) | seguridad |
