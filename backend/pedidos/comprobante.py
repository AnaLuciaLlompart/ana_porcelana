"""Armado del PDF del comprobante de compra de un pedido (CU60).

El aspecto sale de disenio/Comprobante de compra.dc.html. Este archivo no
decide nada sobre el pedido: recibe uno ya cargado y lo dibuja. Tampoco
calcula importes: todos salen de las propiedades del modelo.

ReportLab arma el documento con una lista de bloques (un párrafo, una
tabla, un espacio) que va apilando de arriba hacia abajo, y cuando una
hoja se llena sigue en la siguiente. Por eso cada sección de acá abajo es
una función que devuelve su lista de bloques, y generar_comprobante las
junta en orden.

El comprobante es para el cliente, así que NO muestra el estado del
pedido, la etapa productiva de cada pieza ni los materiales.
"""

from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .presentacion import plata


# ---------------------------------------------------------------------
# Medidas
# ---------------------------------------------------------------------

def px(pixeles):
    """Pasa una medida del diseño, que está en píxeles, a puntos de PDF."""
    # La hoja del diseño mide 794 x 1123 px, que es una A4 a 96 píxeles
    # por pulgada. El PDF mide en puntos, y hay 72 por pulgada: 72 / 96
    # da 0.75. Gracias a esto los números de este archivo son los mismos
    # que figuran en el HTML del diseño y se pueden comparar a ojo.
    return pixeles * 0.75


ANCHO_HOJA, ALTO_HOJA = A4

MARGEN_LATERAL = px(56)
MARGEN_VERTICAL = px(64)
ANCHO_UTIL = ANCHO_HOJA - 2 * MARGEN_LATERAL

# El lugar que se le reserva al pie al fondo de cada hoja, para que el
# contenido no se le escriba encima. Es la suma de lo que dibuja
# _dibujar_pie, de abajo hacia arriba: dos renglones de 21, 4 entre
# ellos y 28 hasta la raya, más los 28 de aire que el diseño deja entre
# el contenido y la raya. Si se cambia el pie, hay que rehacer esta suma.
ALTO_PIE = px(21 + 4 + 21 + 28 + 28)

# SimpleDocTemplate deja 6 puntos de relleno por dentro de cada margen y
# no ofrece forma de cambiarlo. Se los descuento a los márgenes para que
# el margen que se ve sea exactamente el del diseño.
RELLENO_DEL_MARCO = 6


# ---------------------------------------------------------------------
# Colores: la paleta del sistema
# ---------------------------------------------------------------------

ROSA_PROFUNDO = HexColor('#8C5A66')
ROSA_CLARO = HexColor('#F0E2E4')
TEXTO = HexColor('#3D3238')
TEXTO_SECUNDARIO = HexColor('#857078')
BORDE = HexColor('#EBE0E2')

VERDE = HexColor('#4E8C6A')
VERDE_FONDO = HexColor('#E8F5EF')
AMBAR_TEXTO = HexColor('#8A6320')
AMBAR_BORDE = HexColor('#D9A441')
AMBAR_FONDO = HexColor('#FDF3E0')


# ---------------------------------------------------------------------
# Tipografías
# ---------------------------------------------------------------------
# El diseño usa Quicksand y Nunito Sans, pero ReportLab solo trae
# incorporadas las fuentes estándar de PDF. Se usa Helvetica, que es la
# sans-serif de ese grupo, para no sumar archivos de fuentes al
# repositorio. Donde el diseño pide peso 600 o 700 va la negrita.

NORMAL = 'Helvetica'
NEGRITA = 'Helvetica-Bold'


def _estilo(nombre, tamano, fuente=NORMAL, color=TEXTO,
            alineacion=TA_LEFT, interlineado=1.3):
    """Arma un estilo de párrafo a partir del tamaño en píxeles del diseño."""
    return ParagraphStyle(
        nombre,
        fontName=fuente,
        fontSize=px(tamano),
        # leading es la distancia entre un renglón y el siguiente.
        leading=px(tamano) * interlineado,
        textColor=color,
        alignment=alineacion,
    )


# El encabezado
# La marca mide 36 y no los 26 del diseño: otra diferencia deliberada,
# para que sea lo primero que se lee en la hoja.
MARCA = _estilo('marca', 36, NEGRITA, ROSA_PROFUNDO)
TITULO = _estilo('titulo', 17, NEGRITA, TEXTO, TA_RIGHT)
NUMERO = _estilo('numero', 22, NEGRITA, ROSA_PROFUNDO, TA_RIGHT)
FECHA_DEL_ENCABEZADO = _estilo('fecha_del_encabezado', 14, NORMAL,
                               TEXTO_SECUNDARIO, TA_RIGHT)

# Las secciones
# El título de sección mide 22, igual que el número del pedido (NUMERO),
# y no los 13 del diseño: es una diferencia deliberada, a 13 los títulos
# se perdían en la hoja.
SECCION = _estilo('seccion', 22, NEGRITA, ROSA_PROFUNDO)
ETIQUETA = _estilo('etiqueta', 12, NEGRITA, TEXTO_SECUNDARIO)
VALOR = _estilo('valor', 16, interlineado=1.45)
SECUNDARIO = _estilo('secundario', 15, NORMAL, TEXTO_SECUNDARIO)

# Las tablas
COLUMNA = _estilo('columna', 12, NEGRITA, ROSA_PROFUNDO)
COLUMNA_CENTRADA = _estilo('columna_centrada', 12, NEGRITA, ROSA_PROFUNDO,
                           TA_CENTER)
COLUMNA_DERECHA = _estilo('columna_derecha', 12, NEGRITA, ROSA_PROFUNDO,
                          TA_RIGHT)
CELDA = _estilo('celda', 16, interlineado=1.35)
CELDA_CENTRADA = _estilo('celda_centrada', 16, alineacion=TA_CENTER)
CELDA_DERECHA = _estilo('celda_derecha', 16, alineacion=TA_RIGHT)
CELDA_DESCRIPCION = _estilo('celda_descripcion', 14, NORMAL,
                            TEXTO_SECUNDARIO, interlineado=1.4)
IMPORTE = _estilo('importe', 16, NEGRITA, TEXTO, TA_RIGHT)

# Los totales y el saldo
TOTAL_ETIQUETA = _estilo('total_etiqueta', 16, NORMAL, TEXTO_SECUNDARIO,
                         TA_RIGHT)
TOTAL_DEL_PEDIDO_ETIQUETA = _estilo('total_del_pedido_etiqueta', 17, NEGRITA,
                                    TEXTO, TA_RIGHT)
TOTAL_DEL_PEDIDO = _estilo('total_del_pedido', 24, NEGRITA, ROSA_PROFUNDO,
                           TA_RIGHT)
SALDO_ETIQUETA = _estilo('saldo_etiqueta', 17, NEGRITA, TEXTO, TA_RIGHT)

# El pie
PIE = _estilo('pie', 14, NORMAL, TEXTO_SECUNDARIO, interlineado=1.5)


# ---------------------------------------------------------------------
# Textos fijos
# ---------------------------------------------------------------------

# La misma lista que usa fmtFechaLarga en el frontend. No se usa el
# formato de fechas de Django porque con el idioma es-ar abrevia
# septiembre como "set", y el diseño y las pantallas dicen "sep".
MESES = ('ene', 'feb', 'mar', 'abr', 'may', 'jun',
         'jul', 'ago', 'sep', 'oct', 'nov', 'dic')

INSTAGRAM = '@ana.porcelana'

PIE_CONTACTO = (
    f'Cualquier duda sobre tu pedido, escribime a {INSTAGRAM} por Instagram.'
)
PIE_LEYENDA = 'Documento no válido como factura.'


# ---------------------------------------------------------------------
# Piezas chicas que usan todas las secciones
# ---------------------------------------------------------------------

def _fecha_larga(fecha):
    """Una fecha como la escribe el diseño: 5 sep 2026."""
    return f'{fecha.day} {MESES[fecha.month - 1]} {fecha.year}'


def _parrafo(texto, estilo):
    """Un párrafo de ReportLab con el texto protegido.

    Para ReportLab el texto de un párrafo es marcado, parecido a HTML:
    un & o un < sueltos en el nombre de un producto, una descripción o
    una dirección romperían el PDF. escape() los convierte en &amp; y
    &lt;, que se dibujan como el carácter original. Todo texto pasa por
    acá, así no hay que acordarse de cuál viene de la base y cuál no.
    """
    return Paragraph(escape(str(texto)), estilo)


def _espacio(pixeles):
    """Un espacio vertical en blanco, medido en píxeles del diseño."""
    return Spacer(1, px(pixeles))


def _tabla_de_totales(filas):
    """Las filas de etiqueta e importe alineadas a la derecha de la hoja.

    La usan los totales del pedido y el total cobrado, para que los
    importes de los dos queden en la misma vertical que la última
    columna de las tablas.
    """
    ancho_importe = px(170)

    tabla = Table(filas, colWidths=[ANCHO_UTIL - ancho_importe, ancho_importe])

    tabla.setStyle(TableStyle([
        # BOTTOM apoya los dos textos sobre el mismo piso. Es lo más
        # parecido al align-items: baseline del diseño cuando la etiqueta
        # y el importe tienen tamaños distintos.
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('TOPPADDING', (0, 0), (-1, -1), px(8)),
        ('BOTTOMPADDING', (0, 0), (-1, -1), px(8)),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (0, -1), px(20)),
        ('RIGHTPADDING', (1, 0), (1, -1), px(12)),
    ]))

    return tabla


# ---------------------------------------------------------------------
# Las secciones, en el orden en que aparecen en la hoja
# ---------------------------------------------------------------------

def _encabezado(pedido):
    """A la izquierda la marca con su Instagram; a la derecha el título, el número y las fechas."""
    izquierda = [
        _parrafo('Ana Porcelana', MARCA),
        _espacio(6),
        # El mismo usuario que nombra el pie: sale de una sola constante,
        # así que si cambia se corrige en un solo lugar.
        _parrafo(INSTAGRAM, SECUNDARIO),
    ]

    derecha = [
        _parrafo('Comprobante de compra', TITULO),
        _espacio(8),
        _parrafo(f'Pedido #{pedido.id}', NUMERO),
        _espacio(6),
        _parrafo(
            f'Fecha del pedido: {_fecha_larga(pedido.fecha_pedido)}',
            FECHA_DEL_ENCABEZADO,
        ),
        _espacio(3),
        # La fecha de emisión es la de hoy: el comprobante no se guarda,
        # se arma de nuevo cada vez que se lo pide.
        _parrafo(
            f'Emitido el {_fecha_larga(timezone.localdate())}',
            FECHA_DEL_ENCABEZADO,
        ),
    ]

    # Una celda de una tabla puede llevar una lista de bloques, que se
    # apilan adentro. Es la forma de poner dos columnas lado a lado.
    tabla = Table(
        [[izquierda, derecha]],
        colWidths=[ANCHO_UTIL * 0.45, ANCHO_UTIL * 0.55],
    )

    # Cada orden de estilo es (qué, desde qué celda, hasta qué celda,
    # valores). Las celdas van como (columna, fila) y -1 es "la última".
    tabla.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), px(24)),
        ('LINEBELOW', (0, 0), (-1, -1), px(1), BORDE),
    ]))

    return [tabla]


# CLIENTE y ENTREGA son dos secciones, cada una con su título, pero van
# una al lado de la otra y no apiladas: apiladas, un pedido de tres
# productos ya no entraba en una hoja. ENTREGA se lleva más ancho porque
# adentro tiene dos datos y uno es una dirección.
ANCHO_CLIENTE = ANCHO_UTIL * 0.35
ANCHO_ENTREGA = ANCHO_UTIL * 0.65


def _cliente_y_entrega(pedido):
    """Las secciones CLIENTE y ENTREGA, lado a lado en dos columnas."""
    entrega = _entrega(pedido)

    # Si el pedido no tiene nada de entrega cargado, la columna de la
    # derecha queda como una celda vacía y CLIENTE sigue en su lugar.
    if not entrega:
        entrega = ''

    tabla = Table(
        [[_cliente(pedido), entrega]],
        colWidths=[ANCHO_CLIENTE, ANCHO_ENTREGA],
    )

    tabla.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        # El aire entre las dos columnas, para que un nombre largo corte
        # el renglón antes de tocar la sección de al lado.
        ('RIGHTPADDING', (0, 0), (0, 0), px(32)),
        ('RIGHTPADDING', (1, 0), (1, 0), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    return [_espacio(28), tabla]


def _cliente(pedido):
    """El usuario de Instagram del cliente y, debajo, su nombre y apellido."""
    cliente = pedido.cliente

    # El apellido es opcional. strip() saca el espacio que quedaría
    # colgando al final cuando no está cargado.
    nombre_completo = f'{cliente.nombre} {cliente.apellido}'.strip()

    return [
        _parrafo('CLIENTE', SECCION),
        _espacio(12),
        _parrafo(f'@{cliente.instagram}', VALOR),
        _espacio(3),
        _parrafo(nombre_completo, SECUNDARIO),
    ]


def _entrega(pedido):
    """La fecha de entrega estimada y la dirección, cada una solo si está cargada.

    Si no hay ninguna de las dos, la sección entera no aparece: devuelve
    una lista vacía, y _cliente_y_entrega deja esa columna en blanco.
    """
    datos = []

    if pedido.fecha_entrega_estimada:
        datos.append([
            _parrafo('ENTREGA ESTIMADA', ETIQUETA),
            _espacio(5),
            _parrafo(_fecha_larga(pedido.fecha_entrega_estimada), VALOR),
        ])

    if pedido.direccion_entrega:
        datos.append([
            _parrafo('DIRECCIÓN DE ENTREGA', ETIQUETA),
            _espacio(5),
            _parrafo(pedido.direccion_entrega, VALOR),
        ])

    if not datos:
        return []

    # Una columna por dato. Si hay uno solo se queda con todo el ancho,
    # así una dirección larga no corta el renglón sin necesidad. Si están
    # los dos, la dirección se lleva la parte más ancha.
    if len(datos) == 1:
        anchos = [ANCHO_ENTREGA]
    else:
        anchos = [ANCHO_ENTREGA * 0.4, ANCHO_ENTREGA * 0.6]

    # hAlign='LEFT' porque una tabla metida dentro de una celda se
    # centra sola, y esta tiene que arrancar pegada a la izquierda.
    tabla = Table([datos], colWidths=anchos, hAlign='LEFT')

    tabla.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), px(24)),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    return [
        _parrafo('ENTREGA', SECCION),
        _espacio(12),
        tabla,
    ]


def _productos(pedido):
    """La tabla de los productos del pedido y, debajo, los totales."""
    filas = [[
        _parrafo('PRODUCTO', COLUMNA),
        _parrafo('DESCRIPCIÓN', COLUMNA),
        _parrafo('CANT.', COLUMNA_CENTRADA),
        _parrafo('P. UNITARIO', COLUMNA_DERECHA),
        _parrafo('SUBTOTAL', COLUMNA_DERECHA),
    ]]

    # .all() y nada encadenado: son los productos que ya trajo el
    # prefetch del ViewSet. Vienen por id, que es el orden de carga.
    for linea in pedido.productos.all():
        filas.append([
            _parrafo(linea.producto.nombre, CELDA),
            # Sin descripción queda un párrafo vacío, que no dibuja nada.
            _parrafo(linea.descripcion, CELDA_DESCRIPCION),
            _parrafo(linea.cantidad, CELDA_CENTRADA),
            _parrafo(plata(linea.precio), CELDA_DERECHA),
            _parrafo(plata(linea.subtotal), IMPORTE),
        ])

    tabla = Table(
        filas,
        colWidths=[
            ANCHO_UTIL * 0.30,
            ANCHO_UTIL * 0.28,
            ANCHO_UTIL * 0.10,
            ANCHO_UTIL * 0.16,
            ANCHO_UTIL * 0.16,
        ],
        # Si la tabla no entra en la hoja, ReportLab la corta ENTRE dos
        # filas, nunca una fila por la mitad, y sigue en la siguiente.
        # repeatRows=1 hace que ahí vuelva a dibujar la primera fila,
        # que es la de los títulos de las columnas.
        repeatRows=1,
    )

    tabla.setStyle(_estilo_de_tabla())

    totales = [[
        _parrafo('Subtotal', TOTAL_ETIQUETA),
        _parrafo(plata(pedido.subtotal), IMPORTE),
    ]]

    # costo_envio_a_cobrar ya resuelve la regla: vale más que cero solo
    # cuando el envío está a cargo mío y tiene un costo cargado.
    if pedido.costo_envio_a_cobrar > 0:
        totales.append([
            _parrafo('Costo de entrega', TOTAL_ETIQUETA),
            _parrafo(plata(pedido.costo_envio_a_cobrar), IMPORTE),
        ])

    totales.append([
        _parrafo('Total del pedido', TOTAL_DEL_PEDIDO_ETIQUETA),
        _parrafo(plata(pedido.total), TOTAL_DEL_PEDIDO),
    ])

    tabla_de_totales = _tabla_de_totales(totales)

    # setStyle no reemplaza el estilo que ya tenía la tabla: le suma
    # estas órdenes. La raya va arriba de la última fila, la del total.
    tabla_de_totales.setStyle(TableStyle([
        ('LINEABOVE', (0, -1), (-1, -1), px(1), BORDE),
        ('TOPPADDING', (0, -1), (-1, -1), px(18)),
    ]))

    return [
        _espacio(32),
        _parrafo('PRODUCTOS DEL PEDIDO', SECCION),
        _espacio(14),
        tabla,
        _espacio(8),
        # KeepTogether mantiene su contenido en una misma hoja: si los
        # totales no entran enteros al final de esta, pasan todos
        # juntos a la siguiente, en vez de quedar el total solo.
        KeepTogether([tabla_de_totales]),
    ]


def _estilo_de_tabla():
    """El aspecto que comparten la tabla de productos y la de cobros."""
    return TableStyle([
        # La fila 0 es la de los títulos de las columnas.
        ('BACKGROUND', (0, 0), (-1, 0), ROSA_CLARO),
        ('TOPPADDING', (0, 0), (-1, 0), px(10)),
        ('BOTTOMPADDING', (0, 0), (-1, 0), px(10)),

        # De la fila 1 en adelante, los datos.
        ('TOPPADDING', (0, 1), (-1, -1), px(14)),
        ('BOTTOMPADDING', (0, 1), (-1, -1), px(14)),
        ('LINEBELOW', (0, 1), (-1, -1), px(1), BORDE),

        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), px(8)),
        ('RIGHTPADDING', (0, 0), (-1, -1), px(8)),

        # La primera y la última columna se separan un poco más del borde.
        ('LEFTPADDING', (0, 0), (0, -1), px(12)),
        ('RIGHTPADDING', (-1, 0), (-1, -1), px(12)),
    ])


def _cobros(pedido):
    """Los cobros del pedido, lo cobrado y el saldo."""
    # El modelo ordena los cobros del más nuevo al más viejo, que es como
    # los muestra la pestaña. El comprobante los lleva al revés, como el
    # diseño: primero la seña y después el resto. Se ordena acá, en
    # Python, y no con .order_by(), que ignoraría lo que ya trajo el
    # prefetch y volvería a consultar la base.
    cobros = sorted(
        pedido.cobros.all(),
        key=lambda cobro: (cobro.fecha, cobro.id),
    )

    bloques = [
        _espacio(36),
        _parrafo('COBROS DEL PEDIDO', SECCION),
        _espacio(14),
    ]

    if cobros:
        filas = [[
            _parrafo('FECHA', COLUMNA),
            _parrafo('TIPO', COLUMNA),
            _parrafo('MEDIO DE PAGO', COLUMNA),
            _parrafo('MONTO', COLUMNA_DERECHA),
        ]]

        for cobro in cobros:
            filas.append([
                _parrafo(_fecha_larga(cobro.fecha), CELDA),
                _parrafo(cobro.get_tipo_display(), CELDA),
                _parrafo(cobro.get_medio_display(), CELDA),
                _parrafo(plata(cobro.monto), IMPORTE),
            ])

        tabla = Table(
            filas,
            colWidths=[
                ANCHO_UTIL * 0.30,
                ANCHO_UTIL * 0.26,
                ANCHO_UTIL * 0.24,
                ANCHO_UTIL * 0.20,
            ],
            repeatRows=1,
        )

        tabla.setStyle(_estilo_de_tabla())
    else:
        # Una tabla de una sola celda, para que el aviso lleve debajo la
        # misma raya que llevaría una fila de cobro.
        tabla = Table(
            [[_parrafo('Sin cobros registrados', SECUNDARIO)]],
            colWidths=[ANCHO_UTIL],
        )

        tabla.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), px(12)),
            ('TOPPADDING', (0, 0), (-1, -1), px(8)),
            ('BOTTOMPADDING', (0, 0), (-1, -1), px(22)),
            ('LINEBELOW', (0, 0), (-1, -1), px(1), BORDE),
        ]))

    bloques.append(tabla)
    bloques.append(_espacio(6))

    bloques.append(_tabla_de_totales([[
        _parrafo('Total cobrado', TOTAL_ETIQUETA),
        _parrafo(plata(pedido.cobrado), IMPORTE),
    ]]))

    bloques.append(_espacio(14))
    bloques.append(_saldo(pedido))

    # Toda la sección junta: así el título no queda solo al pie de una
    # hoja con su tabla en la siguiente. Si algún día fuera más alta que
    # una hoja entera, ReportLab la corta igual.
    return [KeepTogether(bloques)]


def _saldo(pedido):
    """La palabra Saldo y, a su derecha, el chip con una de sus tres caras."""
    saldo = pedido.saldo

    if saldo > 0:
        texto = f'Resta pagar {plata(saldo)}'
        color, fondo, borde = AMBAR_TEXTO, AMBAR_FONDO, AMBAR_BORDE
    elif saldo < 0:
        # El saldo negativo es plata a favor del cliente. Se le cambia el
        # signo para escribir "A favor $5.300" y no "A favor $-5.300".
        texto = f'A favor {plata(-saldo)}'
        color, fondo, borde = VERDE, VERDE_FONDO, VERDE
    else:
        texto = 'Pagado'
        color, fondo, borde = VERDE, VERDE_FONDO, VERDE

    estilo = _estilo('chip', 19, NEGRITA, color, TA_CENTER, interlineado=1.2)

    # ReportLab no tiene un chip: es una tabla de una sola celda con
    # fondo, borde y las esquinas redondeadas. Para que abrace el texto
    # hay que decirle el ancho, así que se mide lo que ocupa el texto con
    # esa fuente y ese tamaño y se le suma el relleno de los costados.
    # Los 2 puntos de más evitan que un redondeo de la cuenta deje el
    # texto sin lugar y lo parta en dos renglones.
    ancho_chip = stringWidth(texto, NEGRITA, px(19)) + 2 * px(18) + 2

    chip = Table([[_parrafo(texto, estilo)]], colWidths=[ancho_chip])

    chip.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fondo),
        ('BOX', (0, 0), (-1, -1), px(1), borde),
        # Un radio por esquina. Con 20 px sobre un chip de unos 40 px de
        # alto, las puntas quedan redondas del todo.
        ('ROUNDEDCORNERS', [px(20), px(20), px(20), px(20)]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), px(18)),
        ('RIGHTPADDING', (0, 0), (-1, -1), px(18)),
        ('TOPPADDING', (0, 0), (-1, -1), px(9)),
        ('BOTTOMPADDING', (0, 0), (-1, -1), px(9)),
    ]))

    # La columna del chip mide justo lo que mide el chip más su margen
    # derecho; la palabra Saldo se queda con todo el resto y se alinea a
    # la derecha, pegada al chip.
    ancho_columna_chip = ancho_chip + px(12)

    tabla = Table(
        [[_parrafo('Saldo', SALDO_ETIQUETA), chip]],
        colWidths=[ANCHO_UTIL - ancho_columna_chip, ancho_columna_chip],
    )

    tabla.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), px(20)),
        ('RIGHTPADDING', (1, 0), (1, 0), px(12)),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    return tabla


def _dibujar_pie(canvas, documento):
    """Dibuja el pie al fondo de la hoja. ReportLab la llama una vez por hoja.

    En el diseño el pie queda pegado abajo con margin-top: auto. ReportLab
    no tiene nada parecido: los bloques se apilan desde arriba y no saben
    dónde termina la hoja. Por eso el pie no es un bloque más, sino que se
    dibuja directo sobre la hoja en una posición fija. El lugar se lo
    reserva el margen inferior del documento, que incluye ALTO_PIE.

    Como se llama en todas las hojas, en un comprobante de dos hojas el pie
    sale en las dos.
    """
    # saveState y restoreState guardan y devuelven la configuración del
    # lápiz (color, grosor), para que lo que se cambie acá no afecte al
    # resto de la hoja.
    canvas.saveState()

    contacto = _parrafo(PIE_CONTACTO, PIE)
    leyenda = _parrafo(PIE_LEYENDA, PIE)

    # wrap le dice al párrafo cuánto ancho tiene disponible y devuelve
    # cuánto terminó ocupando. Solo interesa el alto.
    _, alto_contacto = contacto.wrap(ANCHO_UTIL, ALTO_PIE)
    _, alto_leyenda = leyenda.wrap(ANCHO_UTIL, ALTO_PIE)

    # En un PDF el cero de la altura está ABAJO y los números crecen
    # hacia arriba, al revés que en una página web. Por eso se dibuja de
    # abajo hacia arriba: la leyenda, encima el contacto y encima la raya.
    altura = MARGEN_VERTICAL

    leyenda.drawOn(canvas, MARGEN_LATERAL, altura)
    altura += alto_leyenda + px(4)

    contacto.drawOn(canvas, MARGEN_LATERAL, altura)
    altura += alto_contacto + px(28)

    canvas.setStrokeColor(BORDE)
    canvas.setLineWidth(px(1))
    canvas.line(MARGEN_LATERAL, altura, ANCHO_HOJA - MARGEN_LATERAL, altura)

    canvas.restoreState()


# ---------------------------------------------------------------------
# Lo único que se usa desde afuera
# ---------------------------------------------------------------------

def generar_comprobante(pedido):
    """Devuelve el PDF del comprobante de compra del pedido (CU60).

    El pedido tiene que venir con el cliente, los productos y los cobros
    ya cargados, que es como lo entrega get_object() en el ViewSet. Que
    tenga al menos un producto lo revisa la acción antes de llamar acá.

    El PDF se arma en memoria y no en el disco: BytesIO se comporta como
    un archivo pero vive en la RAM, así que no queda nada que limpiar
    después de responder.
    """
    archivo = BytesIO()

    documento = SimpleDocTemplate(
        archivo,
        pagesize=A4,
        leftMargin=MARGEN_LATERAL - RELLENO_DEL_MARCO,
        rightMargin=MARGEN_LATERAL - RELLENO_DEL_MARCO,
        topMargin=MARGEN_VERTICAL - RELLENO_DEL_MARCO,
        bottomMargin=MARGEN_VERTICAL + ALTO_PIE - RELLENO_DEL_MARCO,
        # Lo que el navegador muestra en la pestaña y en las propiedades
        # del archivo.
        title=f'Comprobante de compra - Pedido #{pedido.id}',
        author='Ana Porcelana',
    )

    bloques = []
    bloques += _encabezado(pedido)
    bloques += _cliente_y_entrega(pedido)
    bloques += _productos(pedido)
    bloques += _cobros(pedido)

    documento.build(
        bloques,
        onFirstPage=_dibujar_pie,
        onLaterPages=_dibujar_pie,
    )

    # Después de escribir, el cursor del archivo quedó al final. Hay que
    # volverlo al principio, porque quien lo lea arranca desde donde esté
    # el cursor y si no leería cero bytes.
    archivo.seek(0)

    return archivo
