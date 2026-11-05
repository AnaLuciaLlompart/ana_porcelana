from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

# La gestión de usuarios, en /api/usuarios/. Las rutas de la sesión
# (login, logout, contraseña, recuperar) siguen en urls.py, en /api/auth/.
router = DefaultRouter()
router.register('', views.UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('', include(router.urls)),
]
