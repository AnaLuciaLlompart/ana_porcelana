from django.urls import path

from . import views

# Sin router, como usuarios/urls.py: no hay ViewSet, es una
# sola función. El prefijo /api/finanzas/ lo pone config/urls.py.
urlpatterns = [
    path('', views.finanzas_del_periodo, name='finanzas'),
]
