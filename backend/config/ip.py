# =====================================================================
# IP DE ORIGEN DETRÁS DEL PROXY INVERSO
# =====================================================================
# En producción Django no habla con el navegador: habla con nginx, que
# recibe cada pedido y lo reenvía. Para Django, entonces, TODOS los
# pedidos vienen de la IP del contenedor de nginx (REMOTE_ADDR). La IP
# del visitante viaja en la cabecera X-Forwarded-For, que nginx escribe
# con la IP que él ve y descartando lo que el cliente haya mandado con
# ese nombre (frontend/nginx/sitio.conf). Por eso la cabecera trae un
# solo valor y no se puede falsificar desde afuera.
#
# Lo usa django-axes, a través de AXES_CLIENT_IP_CALLABLE en
# produccion.py, para bloquear por usuario + IP. Los throttles de DRF
# hacen lo mismo por su cuenta con NUM_PROXIES = 1, también en
# produccion.py. En desarrollo no se usa: no hay proxy y REMOTE_ADDR ya
# es la IP real.
#
# Vive en config como validadores.py e imagenes.py: no es de ninguna app.


def ip_de_origen(request):
    """La IP del visitante: el último valor de X-Forwarded-For, o REMOTE_ADDR.

    Se toma el ÚLTIMO valor y no el primero por si la cabecera llegara
    con varios: el último es el que agregó el proxy más cercano, el único
    de confianza; los anteriores pudo escribirlos cualquiera. Sin la
    cabecera, queda la IP de la conexión, que es lo que Django usa solo.
    """
    reenviada = request.META.get('HTTP_X_FORWARDED_FOR')
    if reenviada:
        return reenviada.split(',')[-1].strip()
    return request.META.get('REMOTE_ADDR')
