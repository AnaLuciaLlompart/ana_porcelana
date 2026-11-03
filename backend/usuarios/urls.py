from django.urls import path

from . import views

urlpatterns = [
    path('sesion/', views.sesion_actual, name='sesion-actual'),
    path('login/', views.iniciar_sesion, name='login'),
    path('logout/', views.cerrar_sesion, name='logout'),
    path('password/', views.cambiar_password, name='cambiar-password'),
    path('recuperar/', views.recuperar_contrasena, name='recuperar-contrasena'),
    path('restablecer/<str:uidb64>/<str:token>/', views.restablecer_contrasena,
         name='restablecer-contrasena'),
]