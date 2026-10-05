from django.urls import path

from . import views

# Sin router, como finanzas e inicio: no hay ViewSet. Cada ruta va a una
# vista genérica, y estas tres son todo lo que el catálogo expone. El
# prefijo /api/catalogo/ lo pone config/urls.py.
#
# <int:pk> solo acepta dígitos: una URL con letras no coincide con ninguna
# ruta y Django devuelve 404 sin entrar a la vista.
urlpatterns = [
    path(
        'productos/',
        views.ListaDeProductosView.as_view(),
        name='catalogo-productos',
    ),
    path(
        'productos/<int:pk>/',
        views.DetalleDeProductoView.as_view(),
        name='catalogo-producto',
    ),
    path(
        'categorias/',
        views.ListaDeCategoriasView.as_view(),
        name='catalogo-categorias',
    ),
]
