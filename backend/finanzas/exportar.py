"""El PDF y el Excel de Finanzas (CU61 y CU62, corrección E10 del tutor).

Recibe el diccionario de calcular_finanzas(), el mismo que ve la pantalla,
así el archivo no puede dar otros números. No calcula nada: lo acomoda en
tablas con las piezas de config/exportar.py, las mismas de los listados.
"""

from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from config.exportar import (
    ANCHO_UTIL,
    DETALLE,
    ROSA_PROFUNDO,
    Columna,
    ajustar_anchos_excel,
    construir_pdf,
    encabezado_pdf,
    escribir_encabezado_excel,
    escribir_fecha,
    escribir_tabla_excel,
    guardar_excel,
    tabla_pdf,
)


# ---------------------------------------------------------------------
# Las columnas de cada tabla
# ---------------------------------------------------------------------
# Las tablas chicas reciben filas ya armadas (listas de valores), así que
# su valor no se usa y va en None. Las de cobros y gastos leen cada
# registro, como las de los listados.

TOTALES = [
    Columna('Concepto', None, 'texto', 10),
    Columna('Importe', None, 'plata', 8),
]

POR_MEDIO = [
    Columna('Medio de pago', None, 'texto', 10),
    Columna('Importe', None, 'plata', 8),
]

POR_TIPO = [
    Columna('Tipo de gasto', None, 'texto', 10),
    Columna('Importe', None, 'plata', 8),
]

EVOLUCION = [
    Columna('Mes', None, 'mes', 10),
    Columna('Ingresos', None, 'plata', 8),
    Columna('Gastos', None, 'plata', 8),
    Columna('Resultado', None, 'plata', 8),
]

COBROS = [
    Columna('Fecha', lambda c: c.fecha, 'fecha', 8),
    Columna('Pedido', lambda c: c.pedido_id, 'numero', 6),
    Columna('Cliente', lambda c: f'@{c.pedido.cliente.instagram}', 'texto', 13),
    Columna('Nombre', lambda c: f'{c.pedido.cliente.nombre} {c.pedido.cliente.apellido}'.strip(), 'texto', 12),
    Columna('Tipo', lambda c: c.get_tipo_display(), 'texto', 9),
    Columna('Medio', lambda c: c.get_medio_display(), 'texto', 9),
    Columna('Monto', lambda c: c.monto, 'plata', 8),
]

GASTOS = [
    Columna('Fecha', lambda g: g.fecha, 'fecha', 8),
    Columna('N.º', lambda g: g.id, 'numero', 5),
    Columna('Tipo', lambda g: g.get_tipo_display(), 'texto', 9),
    Columna('Descripción', lambda g: g.descripcion, 'texto', 28),
    Columna('Monto', lambda g: g.monto, 'plata', 8),
]


# ---------------------------------------------------------------------
# Lo que comparten el PDF y el Excel
# ---------------------------------------------------------------------

def _texto_del_periodo(desde, hasta):
    return f'Período: {escribir_fecha(desde)} – {escribir_fecha(hasta)}'


def _plural(cantidad, singular, plural):
    return f'{cantidad} {singular if cantidad == 1 else plural}'


def _filas(columnas, registros):
    """Una fila por registro, con el valor de cada columna."""
    return [[columna.valor(registro) for columna in columnas] for registro in registros]


def _tablas_del_resumen(datos):
    """Las cuatro tablas chicas, como (título, columnas, filas)."""
    totales = datos['totales']
    return [
        ('Totales', TOTALES, [
            ['Ingresos', totales['ingresos']],
            ['Gastos', totales['gastos']],
            ['Resultado', totales['resultado']],
        ]),
        ('Ingresos por medio de pago', POR_MEDIO, [
            [medio['medio_display'], medio['total']] for medio in datos['ingresos_por_medio']
        ]),
        ('Gastos por tipo', POR_TIPO, [
            [tipo['tipo_display'], tipo['total']] for tipo in datos['gastos_por_tipo']
        ]),
        # La clave del mes viaja como AAAA-MM; para el tipo 'mes' hace falta
        # una fecha, la del día 1.
        ('Evolución', EVOLUCION, [
            [date.fromisoformat(mes['mes'] + '-01'), mes['ingresos'], mes['gastos'], mes['ingresos'] - mes['gastos']]
            for mes in datos['evolucion']
        ]),
    ]


# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

SECCION = ParagraphStyle('seccion', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=ROSA_PROFUNDO)


def _seccion(titulo, columnas, filas, ancho, vacio):
    """El título de la sección y su tabla, o una frase si no hay filas."""
    bloques = [Spacer(1, 14), Paragraph(titulo.upper(), SECCION), Spacer(1, 6)]
    bloques.append(tabla_pdf(columnas, filas, ancho) if filas else Paragraph(vacio, DETALLE))
    return bloques


def armar_pdf_de_finanzas(datos, desde, hasta, hoy):
    """El PDF del período: los totales, los desgloses, la evolución y las dos listas.

    Los dos desgloses van lado a lado, cada uno en una celda de una tabla
    sin bordes que ocupa el ancho de la hoja.
    """
    periodo = _texto_del_periodo(desde, hasta)
    cobros, gastos = list(datos['cobros']), list(datos['gastos'])
    movimientos = f'{_plural(len(cobros), "cobro", "cobros")} · {_plural(len(gastos), "gasto", "gastos")}'

    totales, por_medio, por_tipo, evolucion = _tablas_del_resumen(datos)
    mitad = (ANCHO_UTIL - 24) / 2

    lado_a_lado = Table(
        [[_seccion(*por_medio, mitad, ''), _seccion(*por_tipo, mitad, '')]],
        colWidths=[mitad + 24, mitad],
    )
    lado_a_lado.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    bloques = encabezado_pdf('Finanzas', [periodo, f'Emitido el {escribir_fecha(hoy)} · {movimientos}'])
    bloques += _seccion(*totales, mitad, '')
    bloques.append(lado_a_lado)
    bloques += _seccion(*evolucion, ANCHO_UTIL, '')
    bloques += _seccion('Cobros', COBROS, _filas(COBROS, cobros), ANCHO_UTIL, 'No hubo cobros en el período.')
    bloques += _seccion('Gastos', GASTOS, _filas(GASTOS, gastos), ANCHO_UTIL, 'No hubo gastos en el período.')

    return construir_pdf('Finanzas', bloques, periodo, escribir_fecha(hoy))


# ---------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------

def _hoja_de_lista(libro, titulo, periodo, columnas, filas, singular, plural):
    """Una hoja con una sola tabla, como la de un listado: Cobros o Gastos."""
    hoja = libro.create_sheet(titulo)
    fila_titulos = escribir_encabezado_excel(hoja, titulo, [periodo, _plural(len(filas), singular, plural)])
    escribir_tabla_excel(hoja, fila_titulos, columnas, filas)
    ajustar_anchos_excel(hoja, columnas)
    hoja.freeze_panes = hoja.cell(row=fila_titulos + 1, column=1)


def armar_excel_de_finanzas(datos, desde, hasta, hoy):
    """La planilla del período, en tres hojas: Resumen, Cobros y Gastos.

    Resumen lleva las cuatro tablas chicas una debajo de la otra, cada una
    con su título y una fila vacía entre tablas.
    """
    periodo = _texto_del_periodo(desde, hasta)

    libro = Workbook()
    resumen = libro.active
    resumen.title = 'Resumen'
    fila = escribir_encabezado_excel(resumen, 'Finanzas', [periodo, f'Emitido el {escribir_fecha(hoy)}'])
    for titulo, columnas, filas in _tablas_del_resumen(datos):
        resumen.cell(row=fila, column=1, value=titulo).font = Font(bold=True, color='8C5A66')
        fila = escribir_tabla_excel(resumen, fila + 1, columnas, filas) + 1
    # La evolución es la tabla más ancha: sus anchos sirven para las cuatro.
    ajustar_anchos_excel(resumen, EVOLUCION)

    _hoja_de_lista(libro, 'Cobros', periodo, COBROS, _filas(COBROS, datos['cobros']), 'cobro', 'cobros')
    _hoja_de_lista(libro, 'Gastos', periodo, GASTOS, _filas(GASTOS, datos['gastos']), 'gasto', 'gastos')

    return guardar_excel(libro)
