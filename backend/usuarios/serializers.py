from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as ValidacionDeDjango
from rest_framework import serializers

from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer de Usuario para la gestión de usuarios (corrección del tutor).

    Es también lo que responden el login y /api/auth/sesion/: una sola
    forma del usuario en toda la API. El rol y el estado son de solo
    lectura: el rol no se cambia desde la API, y el estado lo cambian
    dar_de_baja y reactivar, que son las que tienen la regla.
    """

    es_superadministradora = serializers.BooleanField(source='is_superuser', read_only=True)

    class Meta:
        model = Usuario
        # date_joined y last_login son de solo lectura: los escribe Django
        # (al crear la cuenta y en cada login) y la pantalla Ver los muestra.
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'es_superadministradora',
            'date_joined',
            'last_login',
        ]
        extra_kwargs = {
            'is_active': {'read_only': True},
            'date_joined': {'read_only': True},
            'last_login': {'read_only': True},
            # El UniqueValidator que DRF arma por el unique=True del campo
            # distingue mayúsculas; acá la unicidad la revisa
            # validate_username sin distinguirlas, y es la única puerta. Se
            # conserva el validador de formato del campo (letras, números y
            # @/./+/-/_).
            'username': {'validators': [UnicodeUsernameValidator()]},
        }

    def _otros_usuarios(self):
        """Todos menos el que se está modificando, para que uno no choque consigo mismo."""
        otros = Usuario.objects.all()
        if self.instance is not None:
            otros = otros.exclude(pk=self.instance.pk)
        return otros

    def validate_username(self, valor):
        if self._otros_usuarios().filter(username__iexact=valor).exists():
            raise serializers.ValidationError('Ya existe un usuario con ese nombre.')
        return valor

    def validate_email(self, valor):
        if self._otros_usuarios().filter(email__iexact=valor).exists():
            raise serializers.ValidationError('Ya hay un usuario con ese correo.')
        return valor


class UsuarioCrearSerializer(UsuarioSerializer):
    """El alta de un administrador: los datos más la contraseña, que no se vuelve a mostrar."""

    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta(UsuarioSerializer.Meta):
        fields = UsuarioSerializer.Meta.fields + ['password']

    def validate(self, datos):
        """La contraseña pasa por los validadores de Django contra el usuario nuevo.

        Va en validate() y no en validate_password() porque necesita los
        otros campos: UserAttributeSimilarityValidator rechaza una
        contraseña parecida al usuario, al nombre o al correo, y para eso
        hay que armar el usuario en memoria con lo que vino.
        """
        usuario = Usuario(**{campo: valor for campo, valor in datos.items() if campo != 'password'})
        try:
            validate_password(datos['password'], user=usuario)
        except ValidacionDeDjango as e:
            raise serializers.ValidationError({'password': e.messages})
        return datos

    def create(self, datos):
        # create_user hashea la contraseña y deja is_staff e is_superuser en
        # False: un administrador no entra al admin de Django ni gestiona
        # usuarios.
        return Usuario.objects.create_user(**datos)


class ContrasenaNuevaSerializer(serializers.Serializer):
    """La contraseña nueva que la superadministradora le pone a un administrador.

    Sin la actual, porque no la cambia él. Se valida contra el usuario al
    que se le cambia, que llega en el contexto.
    """

    password_nueva = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate_password_nueva(self, valor):
        try:
            validate_password(valor, user=self.context['usuario'])
        except ValidacionDeDjango as e:
            raise serializers.ValidationError(e.messages)
        return valor


class ResumenDeUsuariosSerializer(serializers.Serializer):
    """La línea de arriba del listado de usuarios y los números de sus dos chips.

    De solo salida, como los resúmenes de los demás listados.
    """

    usuarios = serializers.IntegerField()
    activos = serializers.IntegerField()
    dados_de_baja = serializers.IntegerField()
