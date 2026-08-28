from django.contrib.auth.models import AbstractUser
from django.db import models


# =====================================================================
# USUARIO
# =====================================================================

class Usuario(AbstractUser):
    """Modelo de usuario propio del proyecto.

    Hereda de AbstractUser, por lo que conserva el sistema completo de
    autenticación de Django: hasheo PBKDF2 de contraseñas, sesiones,
    grupos y permisos.

    Se define desde la primera migración siguiendo la recomendación
    oficial de Django. Cambiar AUTH_USER_MODEL una vez que la base
    tiene datos es una operación sin solución oficial documentada.
    """

    pass


# =====================================================================
# MATERIALES  ·  CU04 a CU10
# =====================================================================

class Material(models.Model):
    """Material de producción del emprendimiento.

    Corresponde a la entidad Materiales del modelo lógico.
    La baja es LÓGICA: no se elimina la fila, se cambia el estado a
    DISCONTINUADO. Esto preserva la integridad del historial, ya que
    los materiales quedan referenciados en productos y en gastos
    anteriores.
    """

    # -----------------------------------------------------------------
    # Conjuntos de valores fijos (los ENUM del modelo lógico)
    # -----------------------------------------------------------------
    # TextChoices es la forma que Django ofrece para valores acotados.
    # Cada línea define DOS cosas:
    #   1. El valor que se guarda en la base      → 'ACTIVO'
    #   2. La etiqueta que se muestra en pantalla → 'Activo'
    # Separarlos permite cambiar el texto visible sin migrar datos.

    class Estado(models.TextChoices):
        ACTIVO = 'ACTIVO', 'Activo'
        DISCONTINUADO = 'DISCONTINUADO', 'Discontinuado'

    class Disponibilidad(models.TextChoices):
        ALTA = 'ALTA', 'Alta'
        MEDIA = 'MEDIA', 'Media'
        BAJA = 'BAJA', 'Baja'

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    # La clave primaria NO se declara: Django agrega sola una columna
    # 'id', entera y autoincremental, por el DEFAULT_AUTO_FIELD de
    # settings.py. Equivale al IdMaterial del modelo lógico.

    nombre = models.CharField(
        max_length=80,
        verbose_name='nombre',
        help_text='Denominación del material. Ej: "Acrílico rojo carmín".',
    )

    estado = models.CharField(
        max_length=15,                    # alcanza para 'DISCONTINUADO'
        choices=Estado.choices,           # restringe los valores posibles
        default=Estado.ACTIVO,            # un material nace activo
        verbose_name='estado',
        help_text='Indica si el material continúa en uso.',
    )

    disponibilidad = models.CharField(
        max_length=5,                     # alcanza para 'MEDIA'
        choices=Disponibilidad.choices,
        default=Disponibilidad.ALTA,
        verbose_name='disponibilidad',
        help_text='Nivel estimado de existencias. Cualitativo, no numérico.',
    )

    # blank=True hace que el campo sea OPCIONAL en los formularios.
    # Para textos no se usa null=True: así hay una sola forma de estar
    # vacío (la cadena vacía) y no dos (cadena vacía y NULL).
    descripcion = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='descripción',
        help_text='Distingue el material de sus variantes: tono, marca, presentación.',
    )

    # ImageField guarda en la base una RUTA de texto, no el archivo.
    # El archivo va al disco, en MEDIA_ROOT/materiales/.
    # Ventaja sobre CharField: Django recibe el archivo, le asigna un
    # nombre sin colisiones y VALIDA que sea una imagen real (con
    # Pillow), no un ejecutable renombrado.
    # Acá sí se usa null=True: "sin archivo" es distinto de "ruta vacía".
    url_imagen = models.ImageField(
        max_length=255,                   # coincide con el modelo lógico
        upload_to='materiales/',          # subcarpeta dentro de MEDIA_ROOT
        blank=True,
        null=True,
        verbose_name='imagen',
        help_text='Opcional. Facilita el reconocimiento visual del material.',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        # Toda consulta viene alfabética sin pedirlo. Sin esto,
        # PostgreSQL devuelve las filas en un orden no garantizado.
        ordering = ['nombre']

        # Nombres legibles para el panel de administración.
        # Sin esto Django pluralizaría como "materials".
        verbose_name = 'material'
        verbose_name_plural = 'materiales'

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    # Define cómo se ve un material cuando Django lo muestra como
    # texto. Sin esto, el admin mostraría "Material object (3)".
    def __str__(self):
        return self.nombre