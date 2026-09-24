from django.urls import path

from . import views

# Sin router, como finanzas/urls.py: no hay ViewSet, es una sola
# función. El prefijo /api/inicio/ lo pone config/urls.py.
urlpatterns = [
    path('', views.resumen_de_hoy, name='inicio'),
]
