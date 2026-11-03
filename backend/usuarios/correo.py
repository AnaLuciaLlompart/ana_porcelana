"""El correo con el enlace para restablecer la contraseña (corrección del tutor)."""
import logging
import smtplib

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from config.correo import armar_correo

logger = logging.getLogger(__name__)

ASUNTO = 'Ana Porcelana · Restablecer tu contraseña'


def enlace_de_restablecimiento(usuaria):
    """La dirección del enlace: URL_SITIO más el uid en base64 y el token.

    El token lo arma el generador de Django con la clave de la usuaria,
    su contraseña y la hora: vence a los PASSWORD_RESET_TIMEOUT segundos y
    deja de servir cuando la contraseña cambia.
    """
    uid = urlsafe_base64_encode(force_bytes(usuaria.pk))
    token = default_token_generator.make_token(usuaria)
    return f'{settings.URL_SITIO}/gestion/restablecer/{uid}/{token}'


def enviar_enlace_de_restablecimiento(usuaria):
    """Manda el correo con el enlace, en HTML (con el logo) y en texto plano.

    Devuelve si se pudo mandar. Si Gmail falla, lo registra y devuelve
    False: la vista responde igual, para no revelar qué correos existen.
    """
    contexto = {
        'nombre': usuaria.first_name or usuaria.username,
        'usuario': usuaria.username,
        'enlace': enlace_de_restablecimiento(usuaria),
        'minutos': settings.PASSWORD_RESET_TIMEOUT // 60,
    }
    try:
        armar_correo(
            ASUNTO,
            usuaria.email,
            render_to_string('usuarios/restablecer.txt', contexto),
            'usuarios/restablecer.html',
            contexto,
        ).send()
    except (smtplib.SMTPException, OSError):
        logger.exception('No se pudo mandar el correo de restablecimiento (usuaria %s).',
                         usuaria.pk)
        return False
    return True
