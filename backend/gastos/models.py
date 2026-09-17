from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from materiales.models import Material

# =====================================================================
# GASTOS  ·  CU52 a CU59
# =====================================================================


class Gasto(models.Model):
    """Un egreso del emprendimiento (CU52 a CU55).

    Corresponde a la entidad Gastos del modelo lógico. Hay tres tipos:
    la compra de materiales, la publicidad y cualquier otro gasto.

    El gasto NO tiene baja lógica: se elimina o se deja cargado, igual
    que Pedido y que Cliente.

    El monto se GUARDA, no se calcula al leer, pero quién lo escribe
    depende del tipo:

    - Si es de MATERIALES, lo escribe el ViewSet: es la suma de los
      subtotales de sus materiales del gasto. La usuaria no lo carga, y
      lo que mande en el formulario se ignora. Un gasto de materiales
      recién creado, sin materiales todavía, vale 0.
    - Si es de PUBLICIDAD o de OTRO, lo carga la usuaria y tiene que ser
      mayor a cero.

    Guardarlo en vez de calcularlo cada vez es lo que deja los informes
    como una suma directa de esta columna, sin distinguir tipos.

    Un gasto de materiales no puede cambiar de tipo: sus materiales y su
    monto calculado son datos que dependen del tipo, y no hay forma de
    convertirlos en un monto cargado a mano sin inventarlo. Eso lo
    revisa el ViewSet.

    Los materiales comprados no cuelgan de acá directamente: van en
    MaterialDelGasto, que además guarda cuántos y a qué precio.
    """

    # -----------------------------------------------------------------
    # Conjuntos de valores fijos (los ENUM del modelo lógico)
    # -----------------------------------------------------------------
    class Tipo(models.TextChoices):
        MATERIALES = 'MATERIALES', 'Materiales'
        PUBLICIDAD = 'PUBLICIDAD', 'Publicidad'
        OTRO = 'OTRO', 'Otro'

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    # La clave primaria NO se declara: Django agrega sola una columna
    # 'id', entera y autoincremental, por el DEFAULT_AUTO_FIELD de
    # settings.py. Equivale al IdGasto del modelo lógico, y es el número
    # con el que se identifica al gasto en pantalla.

    # Sin default, a diferencia del tipo de Cobro: no hay un tipo de
    # gasto "habitual" como la seña en los cobros, así que el formulario
    # lo pide siempre.
    tipo = models.CharField(
        max_length=10,                    # alcanza para 'MATERIALES' y 'PUBLICIDAD'
        choices=Tipo.choices,
        verbose_name='tipo',
        help_text='Si es una compra de materiales, publicidad u otro gasto.',
    )

    # DecimalField y no FloatField, por lo mismo que en Producto: guarda
    # el número exacto, sin el error de redondeo de la coma flotante.
    #
    # El default en 0 es lo que hace que un gasto de materiales nazca sin
    # que nadie mande el monto: el ViewSet lo va a escribir a medida que
    # se carguen los materiales. Para los otros dos tipos el serializer
    # exige que venga y que sea mayor a cero.
    monto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(0)],
        verbose_name='monto',
        help_text='Lo que salió. Si el gasto es de materiales lo calcula el sistema '
                  'sumando los subtotales; si no, se carga a mano y tiene que ser mayor a cero.',
    )

    # default recibe la FUNCIÓN timezone.localdate, sin paréntesis, por
    # lo mismo que fecha_pedido en Pedido: si se la llamara acá, la fecha
    # se calcularía una sola vez al arrancar el servidor.
    fecha = models.DateField(
        default=timezone.localdate,
        verbose_name='fecha',
        help_text='Cuándo se hizo el gasto. Nace con la fecha de hoy y se puede corregir.',
    )

    descripcion = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='descripción',
        help_text='Opcional. Qué se compró o para qué fue.',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        # Los gastos más nuevos primero, como los pedidos. El id desempata
        # los del mismo día, y como los dos campos son obligatorios el
        # orden es siempre el mismo ante los mismos datos.
        ordering = ['-fecha', '-id']
        verbose_name = 'gasto'
        verbose_name_plural = 'gastos'

        # Los validators actúan cuando algo se valida (un formulario del
        # admin, un serializer de DRF). Estas restricciones las impone
        # PostgreSQL siempre, incluso ante un .save() directo desde el
        # shell o un update() masivo, donde los validators ni se miran.
        #
        # La segunda es la regla del monto escrita en la base: o el gasto
        # es de materiales, y entonces puede valer 0 mientras no tenga
        # materiales cargados, o el monto es mayor a cero. Va el literal
        # 'MATERIALES' y no Tipo.MATERIALES porque dentro de Meta la clase
        # Gasto todavía no terminó de definirse y no se puede nombrar.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(monto__gte=0),
                name='gasto_monto_no_negativo',
            ),
            models.CheckConstraint(
                condition=models.Q(tipo='MATERIALES') | models.Q(monto__gt=0),
                name='gasto_monto_positivo_salvo_materiales',
            ),
        ]

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    def __str__(self):
        # Es como lo nombra la pantalla: 'Gasto #18'.
        return f'Gasto #{self.id}'




class MaterialDelGasto(models.Model):
    """Un material comprado en un gasto: cuál, cuántos y a qué precio (CU56 a CU59).

    Corresponde a la tabla MaterialesDelGasto del modelo lógico. Es la
    tabla intermedia entre Gasto y Material, pero con datos propios (la
    cantidad y el precio pagado), y por eso se escribe a mano en vez de
    dejar que Django la genere sola.

    Los dos on_delete son distintos a propósito, igual que en
    ProductoDelPedido:

    - CASCADE en gasto: un material del gasto no significa nada sin su
      gasto, así que se va con él.
    - PROTECT en material: Django impide eliminar un material que figura
      en algún gasto. Es la misma salvaguarda que usa MaterialProducto:
      para dejar de usar un material está la baja lógica, no la
      eliminación.

    El precio unitario NO se copia de ningún lado: Material no tiene
    precio. Es lo que se pagó por cada unidad en esa compra, y es lo que
    permite seguir cómo cambia el costo de cada insumo de un gasto al
    siguiente.
    """

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    gasto = models.ForeignKey(
        Gasto,
        on_delete=models.CASCADE,
        related_name='materiales',
        verbose_name='gasto',
        help_text='La compra en la que se pagó este material.',
    )

    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name='en_gastos',
        verbose_name='material',
        help_text='El material comprado. No se puede eliminar mientras figure en un gasto.',
    )

    # PositiveIntegerField y no IntegerField: una cantidad negativa no
    # significa nada, así que la base directamente no la acepta. El
    # validator sube el piso a 1, porque tampoco existe una compra de
    # cero unidades.
    cantidad = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='cantidad',
        help_text='Cuántas unidades se compraron.',
    )

    # DecimalField y no FloatField, por lo mismo que en Producto: guarda
    # el número exacto, sin el error de redondeo de la coma flotante.
    #
    # El validator exige 0.01 y no 0 por lo mismo que el monto de Cobro:
    # la restricción de la base pide un precio MAYOR a cero, y las dos
    # capas tienen que frenar lo mismo. Con MinValueValidator(0) un
    # precio en cero pasaría la validación y lo rechazaría recién
    # PostgreSQL: un 500 en lugar de un mensaje.
    precio_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='precio unitario',
        help_text='Cuánto se pagó por cada unidad en esta compra. Tiene que ser mayor a cero.',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        # Por id, que es el orden en que se fueron cargando, igual que
        # los productos del pedido.
        ordering = ['id']
        verbose_name = 'material del gasto'
        verbose_name_plural = 'materiales del gasto'

        # El modelo lógico define la clave primaria compuesta
        # (IdMaterial, IdGasto). Acá la PK sigue siendo el id automático
        # y la unicidad del par se garantiza con la primera restricción:
        # un mismo material no puede aparecer dos veces en el mismo
        # gasto. Es el mismo criterio que MaterialProducto.
        #
        # Las otras dos son las numéricas, por lo mismo que en
        # ProductoDelPedido: los validators solo actúan al validar, y
        # estas las impone PostgreSQL siempre. La de cantidad no repite
        # lo que ya hace PositiveIntegerField, que impone un mínimo de 0:
        # esta sube ese piso a 1.
        constraints = [
            models.UniqueConstraint(
                fields=['gasto', 'material'],
                name='material_del_gasto_unico',
            ),
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name='material_del_gasto_cantidad_minima',
            ),
            models.CheckConstraint(
                condition=models.Q(precio_unitario__gt=0),
                name='material_del_gasto_precio_unitario_positivo',
            ),
        ]

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    def __str__(self):
        return f'{self.material} en {self.gasto}'

    # -----------------------------------------------------------------
    # Propiedades calculadas
    # -----------------------------------------------------------------
    @property
    def subtotal(self):
        """Lo que costaron estas unidades: el precio unitario por la cantidad.

        Decimal por entero da Decimal, así que el resultado conserva la
        precisión exacta del precio. Es lo que el ViewSet suma para
        escribir el monto del gasto.
        """
        return self.precio_unitario * self.cantidad
