from django.urls import path

from . import views

# Sin router, como finanzas/urls.py: no hay ViewSet, es una sola
# función. El prefijo /api/inicio/ lo pone config/urls.py.
urlpatterns = [
    path('', views.resumen_de_hoy, name='inicio'),
    # Las tres listas de la pantalla, de a una página (corrección D3).
    path('en_produccion/', views.en_produccion, name='inicio-en-produccion'),
    path('entregas/', views.entregas, name='inicio-entregas'),
    path('materiales/', views.materiales, name='inicio-materiales'),
]
