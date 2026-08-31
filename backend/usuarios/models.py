from django.contrib.auth.models import AbstractUser


class Usuario(AbstractUser):
    """Modelo de usuario propio del proyecto.

    Hereda de AbstractUser, por lo que conserva el sistema completo de
    autenticación de Django: hasheo PBKDF2 de contraseñas, sesiones,
    grupos y permisos.

    Por el momento no implementa otra funcionalidad, pero se hace esta clase Usuario
    en caso de que se necesite agregar, por ejempo, mas roles.
    """

    pass