from django.db import models

# =====================================================================
# CATEGORÍAS  ·  CU11 a CU16
# =====================================================================

class Categoria(models.Model):
    """Agrupación de productos definida por la emprendedora.

    Se distingue entre agrupaciones por tipo de accesorio (aros,
    collares, llaveros) y agrupaciones temáticas (una serie, una
    película, un libro). La distinción existe porque el catálogo
    público presenta las categorías como filtros, y agruparlas
    facilita la navegación del visitante.

    Al dar de baja una Categoria, esta ni sus productos se muestan 
    en el catálogo publico. Un producto se muestra en el catalogo publico
    si está activo, no es personalizado, y la totalidad de sus
    categorías está activa. 

    Eliminar una categoría suprime únicamente sus asociaciones con
    productos, no los productos. Los que queden sin categorías
    dependen solo de su propio estado.
    """

    class Tipo(models.TextChoices):
        TIPO = 'TIPO', 'Tipo de accesorio'
        TEMATICA = 'TEMATICA', 'Temática'

    class Estado(models.TextChoices):
        ACTIVO = 'ACTIVO', 'Activa'
        BAJA = 'BAJA', 'De baja'

    nombre = models.CharField(
        max_length=30,
        unique=True,
        verbose_name='nombre',
        help_text='Denominación de la categoría. Ej: "Aros", "Harry Potter".',
        error_messages={
            'unique': 'Ya existe una categoría con este nombre.',
        },
    )

    tipo = models.CharField(
        max_length=8,
        choices=Tipo.choices,
        default=Tipo.TIPO,
        verbose_name='tipo',
        help_text='Si agrupa por clase de accesorio o por temática.',
    )

    estado = models.CharField(
        max_length=6,
        choices=Estado.choices,
        default=Estado.ACTIVO,
        verbose_name='estado',
        help_text='Una categoría de baja retira sus productos del catálogo.',
    )

    descripcion = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='descripción',
        help_text='Aclaración sobre qué agrupa, si el nombre no alcanza.',
    )

    class Meta:
        ordering = ['tipo', 'nombre']
        verbose_name = 'categoría'
        verbose_name_plural = 'categorías'

    def __str__(self):
        return self.nombre
