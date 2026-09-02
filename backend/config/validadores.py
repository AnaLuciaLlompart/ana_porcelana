from django.core.exceptions import ValidationError

# =====================================================================
# VALIDADORES COMPARTIDOS
# =====================================================================
# Acá van las validaciones que usa más de una app. No pueden vivir
# dentro de 'materiales' ni de 'productos', porque una app no debería
# importar de otra: cada una es una funcionalidad independiente.


# 15 MB, medido contra las fotos que saca la emprendedora con el
# celular. Se escribe como multiplicación para que se lea de dónde
# sale el número, en vez de un 15728640 suelto.
TAMANO_MAXIMO_MB = 15
TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024


def validar_tamano_archivo(archivo):
    """Rechaza los archivos que superen el tamaño máximo.

    Se controla solo el PESO. No hay límite de ancho ni de alto: son
    fotos de piezas artesanales y recortarlas por dimensiones no aporta
    nada.

    El mensaje dice las dos cifras, cuánto pesa y cuánto se permite,
    para que quien lo lea sepa cuánto tiene que bajar. Un "archivo
    demasiado grande" a secas obliga a adivinar.

    archivo.size viene en bytes, y dividir dos veces por 1024 es lo que
    lo pasa a MB.

    Tiene que ser una función a nivel de módulo, no una anidada ni una
    lambda: Django guarda en la migración la RUTA de importación del
    validador (config.validadores.validar_tamano_archivo), no su
    código, y una función anidada no tiene una ruta que se pueda
    escribir. Por lo mismo, renombrarla o moverla de archivo rompe las
    migraciones ya escritas.
    """
    if archivo.size > TAMANO_MAXIMO_BYTES:
        raise ValidationError(
            f'La imagen pesa {archivo.size / (1024 * 1024):.1f} MB '
            f'y el máximo son {TAMANO_MAXIMO_MB} MB.'
        )
