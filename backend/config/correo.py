"""Lo que comparten los correos que manda el sistema (usuarios y pedidos).

Todos van en HTML sobre la plantilla correo_base.html (el fondo, la
tarjeta, el logo y "Ana Porcelana"), con una versión en texto plano como
alternativa para el lector que no muestre HTML. Las plantillas van
directo en el templates/ de cada app, sin la subcarpeta con el nombre de
la app que Django sugiere para evitar choques: acá los nombres son únicos
(pedido de la usuaria).

El logo va pegado adentro del correo como imagen en línea (un adjunto con
Content-ID que el HTML nombra como cid:logo), y no como un enlace al
sitio: así se ve aunque el correo se abra sin llegar al servidor. Es un
PNG porque Gmail no muestra SVG: logo_correo.png es el favicon de la
gestión dibujado a 192 px, para verse nítido a 48 en pantallas de alta
resolución.
"""
from email.mime.image import MIMEImage

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

LOGO = settings.BASE_DIR / 'config' / 'logo_correo.png'


def armar_correo(asunto, para, texto, plantilla_html, contexto):
    """Un correo con texto plano, HTML sobre la plantilla base y el logo en línea.

    Lo devuelve sin mandar: quien lo arma puede sumarle adjuntos (el PDF
    del comprobante) antes de send(). El remitente es DEFAULT_FROM_EMAIL.
    """
    correo = EmailMultiAlternatives(asunto, texto, None, [para])
    correo.attach_alternative(render_to_string(plantilla_html, contexto), 'text/html')
    # Con adjuntos, Django arma un multipart "mixed"; "related" es el que
    # dice que la imagen forma parte del HTML y no es un archivo aparte.
    correo.mixed_subtype = 'related'
    logo = MIMEImage(LOGO.read_bytes(), _subtype='png')
    logo.add_header('Content-ID', '<logo>')
    logo.add_header('Content-Disposition', 'inline', filename='logo.png')
    correo.attach(logo)
    return correo
