"""El comprobante de pago de un cobro por correo (CU60; corrección del tutor)."""
from config.correo import armar_correo

from .comprobante import generar_comprobante, nombre_del_archivo


def enviar_comprobante_de_cobro(pedido, cobro, para, asunto, mensaje):
    """Manda el comprobante de un cobro, con el PDF adjunto.

    El asunto y el mensaje son los que la usuaria revisó en el modal. El
    mensaje va tal cual en texto plano y, en el HTML, adentro de la
    tarjeta con el logo, escapado y con sus saltos de línea
    (templates/comprobante.html). Si Gmail falla, la excepción sube y la
    vista responde 503: acá la usuaria tiene que enterarse.
    """
    archivo = nombre_del_archivo(pedido, cobro)
    correo = armar_correo(
        asunto, para, mensaje,
        'comprobante.html', {'mensaje': mensaje, 'archivo': archivo},
    )
    correo.attach(archivo, generar_comprobante(pedido, cobro).getvalue(), 'application/pdf')
    correo.send()
