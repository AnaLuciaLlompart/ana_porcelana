from django.db import models

# =====================================================================
# CLIENTES  ·  CU36 a CU39
# =====================================================================


class Cliente(models.Model):
    """Persona que le hace pedidos al emprendimiento.

    Corresponde a la entidad Clientes del modelo lógico. Se identifica
    por su usuario de Instagram, porque esa es la vía real por la que
    llegan los pedidos: muchos clientes no dejan ni apellido ni email.

    A diferencia de materiales, categorías y productos, Cliente NO
    tiene baja lógica: no hay campo estado. Las únicas operaciones son
    alta, búsqueda, modificación y eliminación. Un cliente con pedidos
    registrados no se va a poder eliminar, así que en ese caso la
    salida es dejarlo cargado.
    """

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    # La clave primaria NO se declara: Django agrega sola una columna
    # 'id', entera y autoincremental, por el DEFAULT_AUTO_FIELD de
    # settings.py. Equivale al IdCliente del modelo lógico.

    instagram = models.CharField(
        max_length=30,                    # el largo máximo de un usuario de Instagram
        unique=True,                      # un usuario, un cliente
        verbose_name='usuario de Instagram',
        help_text='Sin el @ y en minúscula. Identifica al cliente.',
        error_messages={
            'unique': 'Ya tenés un cliente con ese usuario.',
        },
    )

    nombre = models.CharField(
        max_length=50,
        verbose_name='nombre',
        help_text='Nombre de pila del cliente. Ej: "Sofía".',
    )

    # blank=True hace que el campo sea OPCIONAL en los formularios.
    # Para textos no se usa null=True: así hay una sola forma de estar
    # vacío (la cadena vacía) y no dos (cadena vacía y NULL).
    apellido = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='apellido',
        help_text='Opcional. Muchos clientes solo dejan el nombre.',
    )

    # EmailField es un CharField que ADEMÁS valida el formato de la
    # dirección. 254 es el largo máximo que admite el estándar.
    email = models.EmailField(
        max_length=254,
        blank=True,
        verbose_name='email',
        help_text='Opcional. Sirve para mandarle el comprobante.',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        ordering = ['instagram']
        verbose_name = 'cliente'
        verbose_name_plural = 'clientes'

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    def __str__(self):
        return f'@{self.instagram}'

    # -----------------------------------------------------------------
    # Normalización del usuario de Instagram
    # -----------------------------------------------------------------
    # En Instagram 'Sofi.Delgado' y 'sofi.delgado' son la MISMA cuenta,
    # pero unique=True sobre un CharField en PostgreSQL distingue
    # mayúsculas y dejaría entrar las dos como clientes distintos. Por
    # eso el usuario se guarda siempre normalizado.
    def save(self, *args, **kwargs):
        # removeprefix saca UN solo '@' del principio, y si no hay
        # ninguno devuelve el texto igual. lstrip('@') no serviría: se
        # comería todos los arrobas seguidos.
        self.instagram = self.instagram.strip().removeprefix('@').lower()
        super().save(*args, **kwargs)
