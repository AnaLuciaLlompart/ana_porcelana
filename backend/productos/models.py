from django.core.validators import MinValueValidator
from django.db import models

from categorias.models import Categoria
from materiales.models import Material

# =====================================================================
# PRODUCTOS  ·  CU17 a CU35
# =====================================================================


class Producto(models.Model):
    """Pieza que el emprendimiento produce y ofrece (CU17 a CU35).

    El precio que vive acá es el vigente: cambia cuando la emprendedora
    lo actualiza. El de los pedidos ya registrados no se toca, porque se
    copia al momento de registrarlos.

    La baja es LÓGICA y reversible: no se elimina la fila, se cambia el
    estado a BAJA. Un producto de baja queda de solo lectura.

    Un producto personalizado es un encargo puntual de un cliente. Nunca
    se muestra en el catálogo público, aunque esté activo.

    Los materiales no se asocian directo: van a través de
    MaterialProducto, que además guarda cuánto lleva de cada uno.
    """

    class Dificultad(models.TextChoices):
        BAJA = 'BAJA', 'Baja'
        MEDIA = 'MEDIA', 'Media'
        ALTA = 'ALTA', 'Alta'

    class Estado(models.TextChoices):
        ACTIVO = 'ACTIVO', 'Activo'
        BAJA = 'BAJA', 'De baja'

    nombre = models.CharField(
        max_length=80,
        verbose_name='nombre',
        help_text='Denominación de la pieza. Ej: "Aros Hedwig".',
    )

    descripcion = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='descripción',
        help_text='Es el texto que lee el cliente en el catálogo.',
    )

    # DecimalField y no FloatField: guarda el número exacto, sin el error
    # de redondeo de la coma flotante. En dinero eso no se negocia.
    # max_digits cuenta TODOS los dígitos, no solo los enteros: con 10 y
    # 2 decimales, el precio más alto posible es 99.999.999,99.
    precio_actual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='precio actual',
        help_text='Precio vigente. El de los pedidos ya registrados no cambia.',
    )

    dificultad = models.CharField(
        max_length=5,                     # alcanza para 'MEDIA'
        choices=Dificultad.choices,
        verbose_name='dificultad',
        help_text='Cuánto trabajo demanda producir la pieza.',
    )

    # TextField y no CharField: el paso a paso puede ser largo y no
    # tiene un máximo razonable que anticipar.
    paso_a_paso = models.TextField(
        blank=True,
        verbose_name='paso a paso',
        help_text='Descripcion del paso a paso para poder recrear la pieza en el futuro.',
    )

    es_personalizado = models.BooleanField(
        default=False,
        verbose_name='es personalizado',
        help_text='Encargo puntual de un cliente. No se muestra en el catálogo.',
    )

    estado = models.CharField(
        max_length=6,                     # alcanza para 'ACTIVO'
        choices=Estado.choices,
        default=Estado.ACTIVO,
        verbose_name='estado',
        help_text='Un producto de baja se retira del catálogo y queda de solo lectura.',
    )

    categorias = models.ManyToManyField(
        Categoria,
        blank=True,
        related_name='productos',
        verbose_name='categorías',
        help_text='Un producto sin categorías depende solo de su propio estado.',
    )

    # 'MaterialProducto' va entre comillas porque ese modelo se define
    # más abajo en este mismo archivo y todavía no existe acá.
    materiales = models.ManyToManyField(
        Material,
        through='MaterialProducto',
        blank=True,
        related_name='productos',
        verbose_name='materiales',
        help_text='Los materiales que lleva la pieza, con su cantidad.',
    )

    class Meta:
        ordering = ['nombre']
        verbose_name = 'producto'
        verbose_name_plural = 'productos'

        # Los validators actúan cuando algo se valida (un formulario del
        # admin, un serializer de DRF). Esta restricción la impone
        # PostgreSQL siempre, incluso ante un .save() directo desde el
        # shell o un update() masivo, donde los validators ni se miran.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(precio_actual__gte=0),
                name='producto_precio_no_negativo',
            ),
        ]

    def __str__(self):
        return self.nombre

    # -----------------------------------------------------------------
    # Propiedades calculadas
    # -----------------------------------------------------------------
    # No se guardan en la base: se calculan cada vez que se piden, a
    # partir de las relaciones del producto.
    #
    # Todas recorren con .all() y filtran en PYTHON, nunca con .filter()
    # ni .first(). El motivo: estas propiedades se usan en el listado,
    # donde el ViewSet trae todo junto con prefetch_related, y el
    # prefetch guarda en memoria ÚNICAMENTE el resultado de .all().
    # Encadenarle un .filter() o un .first() arma una consulta nueva,
    # que ignora lo ya traído y vuelve a la base. Serían tantas
    # consultas de más como productos tenga el listado: el problema N+1
    # que el prefetch venía a evitar. Recorrer en Python una lista ya
    # cargada no cuesta nada al lado de eso.

    @property
    def categorias_de_baja(self):
        """Las categorías del producto que están dadas de baja.

        Alcanza con una para que el producto no se muestre en el
        catálogo público, aunque las demás estén activas.
        """
        return [
            categoria
            for categoria in self.categorias.all()
            if categoria.estado == Categoria.Estado.BAJA
        ]

    @property
    def oculto_por_categoria(self):
        """El producto se muestra en el catálogo si no fuera por su categoría.

        Sirve para avisarle a la emprendedora que la pieza está bien
        cargada y aun así no se ve: lo que la esconde es la categoría,
        no el producto. Reactivando la categoría vuelve al catálogo.
        """
        return (
            self.estado == Producto.Estado.ACTIVO
            and not self.es_personalizado
            and len(self.categorias_de_baja) > 0
        )

    @property
    def visible_en_catalogo(self):
        """Si la pieza se muestra hoy en el catálogo público.

        Tienen que darse las tres condiciones: el producto activo, que
        no sea un encargo personalizado, y que ninguna de sus
        categorías esté de baja.

        Un producto sin categorías cumple la tercera sin más, así que
        depende solo de su propio estado.
        """
        return (
            self.estado == Producto.Estado.ACTIVO
            and not self.es_personalizado
            and len(self.categorias_de_baja) == 0
        )

    @property
    def materiales_discontinuados(self):
        """Los nombres de los materiales de la receta que ya no se usan.

        La emprendedora necesita saberlo antes de ponerse a producir: la
        receta pide algo que discontinuó y va a tener que reemplazar.
        """
        return [
            material.nombre
            for material in self.materiales.all()
            if material.estado == Material.Estado.DISCONTINUADO
        ]

    @property
    def imagen_principal(self):
        """La foto que representa a la pieza, o None si no tiene ninguna.

        Es la de orden más bajo. No hay un campo que la marque: se
        cambia reordenando las fotos.
        """
        # El ordering de ImagenProducto ya las trae por orden, así que
        # la principal es la primera de la lista.
        imagenes = list(self.imagenes.all())
        return imagenes[0] if imagenes else None




class MaterialProducto(models.Model):
    """Receta del producto: qué material lleva y cuánto (CU17 a CU35).

    Es la tabla intermedia entre Producto y Material, pero con un dato
    propio (la cantidad), y por eso se escribe a mano en vez de dejar
    que Django la genere sola.

    Los dos on_delete son distintos a propósito:

    - CASCADE en producto: si se elimina el producto, su receta ya no
      tiene sentido y se va con él.
    - PROTECT en material: Django impide eliminar un material que está
      usado en alguna receta. Es la salvaguarda para no vaciar una
      receta sin darse cuenta. Para dejar de usar un material está la
      baja lógica (estado DISCONTINUADO), no la eliminación.
    """

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='materiales_usados',
        verbose_name='producto',
        help_text='La pieza a la que pertenece esta línea de la receta.',
    )

    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name='usos',
        verbose_name='material',
        help_text='El material que se usa. No se puede eliminar mientras esté acá.',
    )

    # Texto libre y no un número: la emprendedora mide en "dos gotas" o
    # "media plancha". Obligar a un número perdería esa información.
    cantidad = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='cantidad',
        help_text='Cuánto lleva, en palabras. Ej: "dos gotas".',
    )

    class Meta:
        verbose_name = 'material del producto'
        verbose_name_plural = 'materiales del producto'

        # El modelo lógico define la clave primaria compuesta
        # (producto, material). Acá la PK sigue siendo el id automático
        # y la unicidad del par se garantiza con esta restricción: un
        # mismo material no puede aparecer dos veces en la misma receta.
        constraints = [
            models.UniqueConstraint(
                fields=['producto', 'material'],
                name='material_producto_unico',
            ),
        ]

    def __str__(self):
        return f'{self.material} en {self.producto}'




class ImagenProducto(models.Model):
    """Foto asociada a un producto (CU17 a CU35).

    Un producto puede tener varias. Se distinguen dos clases: las de
    REFERENCIA son las que manda el cliente al hacer un encargo, las de
    RESULTADO son de la pieza ya terminada.

    No hay campo para marcar la imagen principal: es la de orden más
    bajo. Reordenar las fotos alcanza para cambiarla.
    """

    class Tipo(models.TextChoices):
        REFERENCIA = 'REFERENCIA', 'Referencia'
        RESULTADO = 'RESULTADO', 'Resultado'

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='imagenes',
        verbose_name='producto',
        help_text='La pieza que muestra esta imagen.',
    )

    # Igual que en Material: en la base va la RUTA, el archivo va al
    # disco en MEDIA_ROOT/productos/. max_length limita el largo de esa
    # ruta, no el peso del archivo.
    imagen = models.ImageField(
        max_length=255,
        upload_to='productos/',
        verbose_name='imagen',
        help_text='Archivo de la foto. Pillow valida que sea una imagen real.',
    )

    titulo = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='título',
        help_text='Opcional. Aclara qué muestra la foto. Ej: "Detalle del broche".',
    )

    tipo = models.CharField(
        max_length=10,                    # alcanza para 'REFERENCIA'
        choices=Tipo.choices,
        default=Tipo.RESULTADO,
        verbose_name='tipo',
        help_text='Referencia la manda el cliente; resultado es la pieza terminada.',
    )

    # PositiveIntegerField y no IntegerField: un orden negativo no
    # significa nada, así que la base directamente no lo acepta.
    orden = models.PositiveIntegerField(
        default=0,
        verbose_name='orden',
        help_text='Posición en la galería. La de orden más bajo es la principal.',
    )

    class Meta:
        ordering = ['orden', 'id']
        verbose_name = 'imagen del producto'
        verbose_name_plural = 'imágenes del producto'

    def __str__(self):
        return self.titulo or f'Imagen de {self.producto}'
