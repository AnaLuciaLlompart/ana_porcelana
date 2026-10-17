from django.core.management.base import BaseCommand
from django.db import connection
from PIL import Image, UnidentifiedImageError

from config.imagenes import achicar_imagen, esta_optimizada
from materiales.models import Material
from productos.models import ImagenProducto

# =====================================================================
# ACHICAR LAS IMÁGENES YA GUARDADAS
# =====================================================================
# Desde que existe config/imagenes.py, toda imagen que se sube se guarda
# achicada. Las que se subieron antes quedaron como llegaron: fotos del
# celular de 2 MB. Este comando las recorre y les aplica el mismo
# achicado, una sola vez.
#
# Recorre FILAS, no la carpeta media/: toca únicamente los archivos a los
# que apunta alguna fila de la base que esté apuntando el .env. Un
# archivo suelto en media/ no se toca.
#
# Se puede correr las veces que haga falta: una imagen que ya está como
# la dejaría achicar_imagen (esta_optimizada) se saltea, así que la
# segunda corrida no procesa ninguna. Reemplazar un archivo no tiene
# vuelta atrás; por eso está --solo-mirar.


def _mb(bytes_):
    return f'{bytes_ / (1024 * 1024):.1f} MB'


class Command(BaseCommand):
    help = (
        'Achica las imágenes ya guardadas (materiales y productos) como se achican '
        'las que se suben ahora. Con --solo-mirar informa qué haría sin tocar nada.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--solo-mirar', action='store_true',
            help='Analiza y cuenta, pero no reemplaza ningún archivo.',
        )

    def handle(self, *args, **opciones):
        self.solo_mirar = opciones['solo_mirar']
        self.procesadas = 0
        self.ya_bien = 0
        self.faltantes = 0
        self.con_error = 0
        self.peso_antes = 0
        self.peso_despues = 0

        base = connection.settings_dict['NAME']
        modo = 'solo mirar: no se escribe nada' if self.solo_mirar else 'se reemplazan los archivos'
        self.stdout.write(f'Base «{base}», {modo}.')

        # Material.url_imagen es opcional: las filas sin imagen se saltean.
        for material in Material.objects.all():
            if material.url_imagen:
                self._revisar(material.url_imagen, f'material «{material.nombre}»')

        for imagen in ImagenProducto.objects.select_related('producto'):
            self._revisar(imagen.imagen, f'imagen de «{imagen.producto.nombre}»')

        self._resumen()

    def _revisar(self, campo, que):
        """Achica la imagen de un campo (un FieldFile) si hace falta.

        Las cuentas se llevan por archivo: el peso de antes es el que
        tiene en disco, el de después es el del archivo nuevo, o el mismo
        si no se tocó.
        """
        storage = campo.storage
        nombre_viejo = campo.name

        # Una fila puede apuntar a un archivo que ya no está (borrado a
        # mano, o una base copiada sin su media/). No es un error del
        # comando: se informa y se sigue.
        if not storage.exists(nombre_viejo):
            self.faltantes += 1
            self.stdout.write(f'  falta en disco: {nombre_viejo} ({que})')
            return

        peso = storage.size(nombre_viejo)
        self.peso_antes += peso

        try:
            with campo.open('rb') as archivo:
                # esta_optimizada mira la imagen recién abierta (necesita
                # su formato) y lee los píxeles para revisar el alfa.
                with Image.open(archivo) as abierta:
                    abierta.load()
                    optimizada = esta_optimizada(abierta)

                if optimizada:
                    self.ya_bien += 1
                    self.peso_despues += peso
                    return

                contenido = achicar_imagen(archivo)
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
            self.con_error += 1
            self.peso_despues += peso
            self.stdout.write(self.style.WARNING(
                f'  no se pudo procesar {nombre_viejo} ({que}): {error}'
            ))
            return

        self.procesadas += 1

        if self.solo_mirar:
            self.peso_despues += contenido.size
            self.stdout.write(f'  achicaría {nombre_viejo}: {_mb(peso)} → {_mb(contenido.size)}')
            return

        # save() del campo escribe el archivo nuevo por el storage (con
        # upload_to y un sufijo si el nombre ya existe) y guarda la fila.
        # El viejo queda huérfano salvo que se borre: para Material lo
        # borra la señal pre_save de config/limpieza_archivos.py al
        # confirmar, y para ImagenProducto no hay señal de reemplazo.
        # storage.delete sobre un archivo que ya no está no hace nada,
        # así que se borra siempre y las dos cosas no chocan.
        campo.save(contenido.name, contenido, save=True)

        if campo.name != nombre_viejo:
            storage.delete(nombre_viejo)

        self.peso_despues += campo.size
        self.stdout.write(f'  achicada {nombre_viejo} → {campo.name}: {_mb(peso)} → {_mb(campo.size)}')

    def _resumen(self):
        revisadas = self.procesadas + self.ya_bien + self.faltantes + self.con_error
        verbo = 'se achicarían' if self.solo_mirar else 'achicadas'

        self.stdout.write(self.style.SUCCESS(f'Imágenes revisadas: {revisadas}'))
        self.stdout.write(f'  {self.procesadas:>6}  {verbo}')
        self.stdout.write(f'  {self.ya_bien:>6}  ya estaban bien')
        self.stdout.write(f'  {self.faltantes:>6}  faltan en disco')
        self.stdout.write(f'  {self.con_error:>6}  con error')

        if self.peso_antes:
            porcentaje = self.peso_despues / self.peso_antes
            self.stdout.write(
                f'Peso total: {_mb(self.peso_antes)} → {_mb(self.peso_despues)} ({porcentaje:.0%})'
            )
