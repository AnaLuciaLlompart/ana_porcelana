from django.apps import AppConfig
from django.db.models.signals import post_delete


class ProductosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'productos'

    def ready(self):
        """Conecta las señales de la app.

        Va acá porque es el momento que Django documenta para
        registrarlas: corre una sola vez y con los modelos ya cargados.
        """
        # Se importa adentro de ready y no arriba: cuando Django lee
        # apps.py los modelos todavía no están disponibles.
        from config.limpieza_archivos import borrar_archivo_al_eliminar

        post_delete.connect(
            borrar_archivo_al_eliminar('imagen'),
            sender='productos.ImagenProducto',
            # weak=False es imprescindible: el receptor lo acaba de crear
            # la fábrica y nadie más lo referencia, así que con la
            # referencia débil que Django usa por defecto el recolector
            # de basura se lo llevaría y la señal dejaría de funcionar.
            weak=False,
            # Si ready() llegara a correr dos veces, esto evita que quede
            # conectado dos veces.
            dispatch_uid='productos.imagenproducto.borrar_archivo',
        )
