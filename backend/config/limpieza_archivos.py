from django.db import transaction

# =====================================================================
# LIMPIEZA DE ARCHIVOS HUÉRFANOS
# =====================================================================
# Cuando se borra una fila que tiene un archivo, Django borra la fila
# pero NO el archivo: queda en media/ para siempre, sin que nada lo
# referencie. Acá está lo que se encarga de eso.
#
# Vive en config y no dentro de una app porque lo usan dos: materiales
# y productos. Ninguna de las dos debería importar de la otra.


def borrar_archivo_al_eliminar(campo):
    """Arma un receptor de post_delete que borra el archivo de ese campo.

    Es una fábrica porque el campo se llama distinto en cada modelo
    ('imagen' en ImagenProducto, 'url_imagen' en Material), y así el
    nombre queda escrito en la conexión, que es donde se lee mejor.

    Hasta Django 1.2 los FileField borraban su archivo solos al eliminar
    la fila. Se sacó en 1.3 a propósito, porque causaba pérdida de datos
    en dos casos:

    1. Si la transacción se revertía después del delete, la fila volvía
       pero el archivo ya no estaba.
    2. Si dos filas apuntaban al mismo archivo, borrar una se llevaba el
       archivo de la otra.

    El primero lo resuelve el transaction.on_commit de abajo. El segundo
    no puede pasar en este proyecto, porque ningún archivo se comparte
    entre filas: cada subida pasa por el storage de Django, que le da un
    nombre sin colisiones, y en ningún lado se copia la ruta de una fila
    a otra. OJO: si algún día se duplica un producto copiando la ruta de
    sus fotos, esto se vuelve peligroso.
    """

    def receptor(sender, instance, **kwargs):
        archivo = getattr(instance, campo)

        if not archivo:
            return

        # on_commit no ejecuta: AGENDA para cuando la transacción se
        # confirme. Si se revierte, la función nunca corre y el archivo
        # sigue estando, que es lo que corresponde porque la fila vuelve.
        #
        # Se captura 'archivo' ahora, no después: el FieldFile ya lleva
        # adentro el nombre y el storage, y para cuando esto corra la
        # instancia no sirve de nada.
        #
        # save=False porque la fila ya no existe: no hay qué guardar.
        transaction.on_commit(lambda: archivo.delete(save=False))

    return receptor


def borrar_archivo_al_reemplazar(campo):
    """Arma un receptor de pre_save que borra el archivo que se reemplaza.

    El otro receptor cubre el borrado de la fila. Este cubre el otro
    camino por el que un archivo queda huérfano: la fila sigue estando
    pero se le cambia la foto por otra, o se la deja sin ninguna. Ahí no
    hay ningún delete, hay un UPDATE, así que post_delete no se entera.

    Para saber cuál era el archivo anterior hay que leerlo de la base:
    la instancia que llega ya trae el valor nuevo encima. Es una
    consulta más por cada guardado, y es el precio de no dejar basura.
    """

    def receptor(sender, instance, **kwargs):
        # Un alta no tiene archivo previo. Sin pk no hay nada que buscar,
        # y salir acá evita la consulta.
        if not instance.pk:
            return

        try:
            anterior = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            # Se está guardando con un pk elegido a mano que todavía no
            # existe en la base: es un alta, aunque tenga pk.
            return

        archivo_viejo = getattr(anterior, campo)

        if not archivo_viejo:
            return

        # Se comparan los nombres y no los objetos: dos FieldFile
        # distintos pueden apuntar al mismo archivo.
        if archivo_viejo.name == getattr(instance, campo).name:
            return

        # Mismo motivo que en el otro receptor, y acá todavía más
        # importante: pre_save corre ANTES de que el guardado se
        # confirme. Si el guardado falla después, la fila se queda con el
        # archivo viejo, así que no hay que haberlo borrado.
        transaction.on_commit(lambda: archivo_viejo.delete(save=False))

    return receptor
