# Cómo se escriben los datos de un pedido para que los lea una persona.
#
# Lo que está acá lo usan dos archivos de la app: views.py, en los
# mensajes de error de los cobros, y comprobante.py, en los importes del
# PDF. Vive aparte porque views.py importa a comprobante.py: si
# comprobante.py importara a su vez de views.py, Python quedaría leyendo
# los dos archivos en círculo y fallaría al arrancar.


def plata(valor):
    # El formato de Python separa los miles con coma; acá se cambia por
    # el punto, que es como se escribe la plata en Argentina.
    return '$' + f'{valor:,.0f}'.replace(',', '.')
