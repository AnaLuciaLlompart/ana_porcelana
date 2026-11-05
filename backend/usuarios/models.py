from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class Usuario(AbstractUser):
    """Modelo de usuario propio del proyecto.

    Hereda de AbstractUser, por lo que conserva el sistema completo de
    autenticación de Django: hasheo PBKDF2 de contraseñas, sesiones,
    grupos y permisos.

    Por el momento no implementa otra funcionalidad, pero se hace esta clase Usuario
    en caso de que se necesite agregar, por ejempo, mas roles.
    """

    # Dos roles (corrección del tutor, noviembre de 2026), sin campo nuevo:
    # la superadministradora es la que tiene is_superuser, y los
    # administradores que ella da de alta nacen con is_staff e is_superuser
    # en False (create_user). La baja es is_active en False.

    # Los tres campos vienen de AbstractUser con blank=True; acá se vuelven
    # a declarar sin eso, así son obligatorios al validar. La base no cambia:
    # un texto vacío sigue siendo '' y la usuaria ya cargada no se rompe.
    first_name = models.CharField(
        max_length=150,
        verbose_name='nombre',
        help_text='Nombre de pila. Obligatorio.',
    )

    last_name = models.CharField(
        max_length=150,
        verbose_name='apellido',
        help_text='Obligatorio.',
    )

    email = models.EmailField(
        max_length=254,
        verbose_name='correo',
        help_text='Obligatorio y único sin distinguir mayúsculas. Es adonde '
                  'llega el enlace para recuperar la contraseña.',
    )

    # Lo que createsuperuser pide además del usuario y la contraseña.
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    class Meta(AbstractUser.Meta):
        ordering = ['username']

        # La garantía en la base de que "Ana" y "ana" no conviven, ni dos
        # correos que difieran solo en mayúsculas. El mensaje amable lo da
        # el serializer, que compara con iexact antes de llegar acá. El
        # correo vacío queda afuera de la regla: los usuarios de las
        # pruebas se crean sin correo y no tienen que chocar entre sí.
        constraints = [
            models.UniqueConstraint(
                Lower('username'),
                name='usuario_username_unico_sin_mayusculas',
            ),
            models.UniqueConstraint(
                Lower('email'),
                condition=~Q(email=''),
                name='usuario_email_unico_sin_mayusculas',
            ),
        ]
