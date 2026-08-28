from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views, views_auth

router = DefaultRouter()
router.register('materiales', views.MaterialViewSet, basename='material')

urlpatterns = [
    path('auth/sesion/', views_auth.sesion_actual, name='sesion-actual'),
    path('auth/login/', views_auth.iniciar_sesion, name='login'),
    path('auth/logout/', views_auth.cerrar_sesion, name='logout'),
    path('auth/password/', views_auth.cambiar_password, name='cambiar-password'),

    path('', include(router.urls)),
]