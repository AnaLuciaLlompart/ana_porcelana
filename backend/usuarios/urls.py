from django.urls import path

from . import views

urlpatterns = [
    path('sesion/', views.sesion_actual, name='sesion-actual'),
    path('login/', views.iniciar_sesion, name='login'),
    path('logout/', views.cerrar_sesion, name='logout'),
    path('password/', views.cambiar_password, name='cambiar-password'),
]