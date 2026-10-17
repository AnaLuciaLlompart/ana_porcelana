from io import BytesIO
from pathlib import PurePath

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

# =====================================================================
# ACHICADO DE IMÁGENES
# =====================================================================
# Las fotos llegan del celular tal como salen de la cámara: 4032×3024 y
# más de 2 MB cada una. Guardarlas así hacía que el catálogo pesara 18 MB
# por visita. Acá se reguardan a un tamaño que alcanza para cualquier
# pantalla y pesa unas seis veces menos.
#
# Vive en config por el mismo motivo que validadores.py: lo usan los dos
# campos de imagen del sistema (Material.url_imagen e
# ImagenProducto.imagen), y ninguna app debería importar de otra.
#
# Lo llaman los serializers, en el gancho validate_<campo>, que DRF corre
# DESPUÉS de las validaciones del campo: primero Pillow confirma que es
# una imagen real, después el validador de 15 MB, y recién entonces esto
# recibe el archivo y devuelve el que se va a guardar. Por eso no está en
# el modelo: ahí correría en cada save() de la fila, sin esas
# validaciones delante, y habría que distinguir un archivo recién subido
# de uno ya guardado con atributos privados de Django.

# 1600 píxeles de lado mayor: más que el ancho de cualquier celular y que
# la tarjeta del catálogo, y suficiente para ver el detalle de una pieza
# en pantalla completa. Una foto de 4032 no aporta nada más a esa escala.
LADO_MAXIMO = 1600

# 90 es indistinguible del original a simple vista. A 80 ya se notan
# bloques en los degradados suaves de la porcelana pintada.
CALIDAD_JPEG = 90


def usa_transparencia(imagen):
    """Si la imagen tiene algún píxel que no sea totalmente opaco.

    Se miran los píxeles y no el modo: una captura de pantalla viene en
    RGBA con el canal alfa en 255 en todos lados, y eso no es
    transparencia, es un canal de más. Tratarla como transparente la
    dejaría en PNG, que pesa ocho veces más que el JPEG equivalente.
    """
    if imagen.mode == 'P':
        return 'transparency' in imagen.info

    if imagen.mode in ('RGBA', 'LA'):
        # getextrema() devuelve (mínimo, máximo) por banda; la última
        # banda es el alfa. Si su mínimo es 255, nada es transparente.
        return imagen.getextrema()[-1][0] < 255

    return False


def esta_optimizada(imagen):
    """Si la imagen ya está como la dejaría achicar_imagen.

    Es lo que usa el comando achicar_imagenes para decir "ya estaba
    bien" y no tocarla: el lado mayor no pasa el máximo y el formato es
    el que le corresponde a su transparencia. No se vuelve a codificar un
    JPEG que ya cumple, porque recodificar JPEG lo degrada cada vez.

    Recibe la imagen recién abierta, porque imagen.format solo existe
    ahí: cualquier transformación lo pierde.
    """
    if max(imagen.size) > LADO_MAXIMO:
        return False

    formato_esperado = 'PNG' if usa_transparencia(imagen) else 'JPEG'
    return imagen.format == formato_esperado


def achicar_imagen(archivo):
    """Devuelve el archivo que se guarda en lugar del que llegó.

    Cuatro pasos, en este orden:

    1. exif_transpose endereza la foto según la orientación EXIF. Las
       fotos del celular se guardan acostadas con una etiqueta que dice
       "girar 90°", y el visor las endereza al mostrarlas. Al reguardar
       con Pillow esa etiqueta se pierde: sin este paso la foto quedaría
       de costado. De paso se va el resto del EXIF, que trae el modelo
       del teléfono y, a veces, la ubicación.
    2. Si el lado mayor pasa LADO_MAXIMO, thumbnail la reduce
       manteniendo la proporción. Una imagen chica conserva sus
       dimensiones.
    3. Con transparencia de verdad se guarda PNG, que la conserva. Si
       no, JPEG a CALIDAD_JPEG, que es lo que pesa poco en una foto.
    4. El nombre conserva el del archivo original y cambia la extensión
       al formato elegido; el storage le agrega su sufijo si ya existe.
    """
    if hasattr(archivo, 'seek'):
        archivo.seek(0)

    imagen = ImageOps.exif_transpose(Image.open(archivo))

    # Un solo modo con alfa (RGBA) y uno sin (RGB), para que lo que sigue
    # no tenga que contemplar paletas, escala de grises ni CMYK.
    if imagen.mode == 'P':
        imagen = imagen.convert('RGBA' if 'transparency' in imagen.info else 'RGB')
    elif imagen.mode == 'LA':
        imagen = imagen.convert('RGBA')
    elif imagen.mode != 'RGBA':
        imagen = imagen.convert('RGB')

    if max(imagen.size) > LADO_MAXIMO:
        imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.Resampling.LANCZOS)

    buffer = BytesIO()

    if usa_transparencia(imagen):
        imagen.save(buffer, format='PNG', optimize=True)
        extension = '.png'
    else:
        imagen.convert('RGB').save(buffer, format='JPEG', quality=CALIDAD_JPEG, optimize=True)
        extension = '.jpg'

    nombre = PurePath(archivo.name).stem + extension

    return ContentFile(buffer.getvalue(), name=nombre)
