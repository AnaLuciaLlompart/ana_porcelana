from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from clientes.models import Cliente
from productos.models import Producto

# =====================================================================
# PEDIDOS  ·  CU40 a CU47
# =====================================================================


class Pedido(models.Model):
    """Encargo confirmado de un cliente (CU40 a CU43).

    Corresponde a la entidad Pedidos del modelo lógico. Se registra
    cuando el cliente ya confirmó el encargo y el precio: una consulta
    que no se concreta no llega a ser un pedido.

    El pedido NO tiene baja lógica: se elimina o se deja cargado. Lo que
    avanza es el estado, que es el recorrido que ve el cliente
    (Pendiente, En producción, Listo, Entregado). La etapa productiva de
    las piezas es otra cosa y vive en ProductoDelPedido.

    El on_delete de cliente es PROTECT: Django impide eliminar un
    cliente que tenga pedidos. Con CASCADE se borraría el historial de
    un cliente por error de tipeo, y SET_NULL contradice el modelo
    lógico, donde el cliente del pedido es obligatorio. Como Cliente no
    tiene baja lógica, la salida ante un cliente con pedidos es dejarlo
    cargado.

    Las fechas de entrega son DOS a propósito. La estimada es la que se
    le comunica al cliente y puede cambiar tantas veces como haga falta;
    la real se completa al pasar el pedido a Entregado. Con un solo
    campo, cada reprogramación pisaría la estimación anterior y se
    perdería la única forma de saber si se entregó a tiempo.

    Los productos no cuelgan de acá directamente: van en
    ProductoDelPedido, que además guarda cuántos, a qué precio y en qué
    etapa productiva están.
    """

    # -----------------------------------------------------------------
    # Conjuntos de valores fijos (los ENUM del modelo lógico)
    # -----------------------------------------------------------------
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        EN_PRODUCCION = 'EN_PRODUCCION', 'En producción'
        LISTO = 'LISTO', 'Listo'
        ENTREGADO = 'ENTREGADO', 'Entregado'

    class EnvioACargo(models.TextChoices):
        MIO = 'MIO', 'A cargo mío'
        CLIENTE = 'CLIENTE', 'A cargo del cliente'

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    # La clave primaria NO se declara: Django agrega sola una columna
    # 'id', entera y autoincremental, por el DEFAULT_AUTO_FIELD de
    # settings.py. Equivale al IdPedido del modelo lógico, y es el
    # número con el que se identifica al pedido en pantalla.

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name='pedidos',
        verbose_name='cliente',
        help_text='Quién hizo el encargo. No se puede eliminar mientras tenga pedidos.',
    )

    estado = models.CharField(
        max_length=20,                   
        choices=Estado.choices,
        default=Estado.PENDIENTE,         # un pedido nace pendiente
        verbose_name='estado',
        help_text='El avance del pedido tal como lo ve el cliente.',
    )

    # default recibe la FUNCIÓN timezone.localdate, sin paréntesis. Si se
    # la llamara acá, la fecha se calcularía una sola vez al arrancar el
    # servidor y todos los pedidos nacerían con ese mismo día. Pasando la
    # función, Django la ejecuta en cada alta.
    fecha_pedido = models.DateField(
        default=timezone.localdate,
        verbose_name='fecha del pedido',
        help_text='Cuándo se confirmó el encargo. Nace con la fecha de hoy y se puede corregir.',
    )

    # Estas dos fechas sí llevan null=True: a diferencia del texto, no
    # existe una "fecha vacía" que sirva de marca de ausencia. blank=True
    # las hace opcionales en los formularios, null=True permite guardar
    # NULL en la base.
    fecha_entrega_estimada = models.DateField(
        blank=True,
        null=True,
        verbose_name='fecha de entrega estimada',
        help_text='Opcional. Es la que se le comunica al cliente y puede cambiar.',
    )

    fecha_entrega_real = models.DateField(
        blank=True,
        null=True,
        verbose_name='fecha de entrega real',
        help_text='Opcional. Se completa al pasar el pedido a Entregado.',
    )

    envio_a_cargo = models.CharField(
        max_length=7,                     # alcanza para 'CLIENTE'
        choices=EnvioACargo.choices,
        default=EnvioACargo.CLIENTE,
        verbose_name='envío a cargo',
        help_text='Quién paga el envío. Solo el que está a cargo mío suma al total del pedido.',
    )

    direccion_entrega = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='dirección de entrega',
        help_text='Opcional. Calle y número, localidad, referencias.',
    )

    costo_entrega = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0)],
        verbose_name='costo de entrega',
        help_text='Opcional. Se cobra cuando el envío está a cargo mío.',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        # Los pedidos más nuevos primero. El id desempata los del mismo
        # día, y como los dos campos son obligatorios el orden es
        # siempre el mismo ante los mismos datos.
        ordering = ['-fecha_pedido', '-id']
        verbose_name = 'pedido'
        verbose_name_plural = 'pedidos'

        # Los validators actúan cuando algo se valida (un formulario del
        # admin, un serializer de DRF). Esta restricción la impone
        # PostgreSQL siempre, incluso ante un .save() directo desde el
        # shell o un update() masivo, donde los validators ni se miran.
        #
        # El campo admite NULL y eso no es un problema: en SQL comparar
        # contra NULL da NULL, y un CHECK que da NULL se acepta. O sea
        # que un pedido sin costo cargado pasa igual; lo único que la
        # restricción rechaza es un costo negativo de verdad.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(costo_entrega__gte=0),
                name='pedido_costo_entrega_no_negativo',
            ),
        ]

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    def __str__(self):
        # Cliente.__str__ ya devuelve el usuario con arroba, así que
        # esto sale como 'Pedido #43 de @martinariosok'.
        return f'Pedido #{self.id} de {self.cliente}'

    # -----------------------------------------------------------------
    # Propiedades calculadas
    # -----------------------------------------------------------------
    # Las tres son plata y no se guardan en la base: se calculan cada vez
    # que se piden, a partir de los productos del pedido. Guardar un
    # total sería tener el mismo dato en dos lugares y arriesgarse a que
    # queden distintos cuando se agrega o se quita una pieza.
    #
    # Todas recorren self.productos.all(), nunca .aggregate() ni
    # .count(). El motivo es el mismo que en Producto: el listado trae
    # los pedidos con prefetch_related, que guarda en memoria únicamente
    # el resultado de .all(). Una consulta encadenada ignora lo ya
    # traído y vuelve a la base una vez por pedido, que es justo el N+1
    # que el prefetch venía a evitar.

    @property
    def subtotal(self):
        """Lo que suman los productos del pedido, sin el envío."""
        # El Decimal('0') del segundo argumento es el valor con el que
        # sum() arranca, y es lo que hace que un pedido sin productos
        # devuelva Decimal('0'). Sin él, sum() empezaría en el entero 0
        # y devolvería un int cuando la lista está vacía, que después no
        # se puede sumar con los Decimal del costo de entrega.
        return sum(
            (linea.subtotal for linea in self.productos.all()),
            Decimal('0'),
        )

    @property
    def costo_envio_a_cobrar(self):
        """El costo de entrega que se le suma al total, o cero.

        El envío solo se cobra cuando está a cargo del emprendimiento. Si
        lo paga el cliente, el costo puede estar cargado igual —sirve
        para saber cuánto le salió— pero no entra en el total.
        """
        if (
            self.envio_a_cargo == Pedido.EnvioACargo.MIO
            and self.costo_entrega is not None
        ):
            return self.costo_entrega

        return Decimal('0')

    @property
    def total(self):
        """Lo que el cliente tiene que pagar por el pedido."""
        return self.subtotal + self.costo_envio_a_cobrar




class ProductoDelPedido(models.Model):
    """Un producto dentro de un pedido: cuál, cuántos y a qué precio (CU44 a CU47).

    Es la tabla intermedia entre Pedido y Producto, pero con datos
    propios (la cantidad, el precio acordado, la etapa productiva), y
    por eso se escribe a mano en vez de dejar que Django la genere sola.

    Los dos on_delete son distintos a propósito:

    - CASCADE en pedido: un producto del pedido no significa nada sin su
      pedido, así que se va con él.
    - PROTECT en producto: Django impide eliminar un producto que figura
      en algún pedido. Es la misma salvaguarda que usa MaterialProducto
      con los materiales: para sacar un producto de circulación está la
      baja lógica, no la eliminación.

    El precio se CONGELA: se copia del producto al registrarlo y no
    vuelve a cambiar. Si mañana sube el precio del catálogo, este pedido
    conserva el que se acordó con el cliente.

    El estado de acá es la etapa productiva de estas piezas (Pendiente,
    Modelado, Secado, Pintura-Barniz, Terminado) y es independiente del
    estado del pedido, que es el avance que ve el cliente.
    """

    # -----------------------------------------------------------------
    # Conjuntos de valores fijos (los ENUM del modelo lógico)
    # -----------------------------------------------------------------
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        MODELADO = 'MODELADO', 'Modelado'
        SECADO = 'SECADO', 'Secado'
        PINTURA_BARNIZ = 'PINTURA_BARNIZ', 'Pintura-Barniz'
        TERMINADO = 'TERMINADO', 'Terminado'

    # -----------------------------------------------------------------
    # Campos
    # -----------------------------------------------------------------
    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='productos',
        verbose_name='pedido',
        help_text='El pedido que incluye esta pieza.',
    )

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='en_pedidos',
        verbose_name='producto',
        help_text='La pieza encargada. No se puede eliminar mientras esté en un pedido.',
    )

    # DecimalField y no FloatField, por lo mismo que en Producto: guarda
    # el número exacto, sin el error de redondeo de la coma flotante.
    precio = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='precio',
        help_text='Se copia del producto al registrarlo. Si después cambia el del catálogo, este no.',
    )

    # PositiveIntegerField y no IntegerField: una cantidad negativa no
    # significa nada, así que la base directamente no la acepta. El
    # validator sube el piso a 1, porque tampoco existe un producto del
    # pedido con cantidad cero.
    cantidad = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='cantidad',
        help_text='Cuántas unidades iguales de esta pieza lleva el pedido.',
    )

    estado = models.CharField(
        max_length=14,                    # alcanza para 'PINTURA_BARNIZ'
        choices=Estado.choices,
        default=Estado.PENDIENTE,
        verbose_name='estado',
        help_text='La etapa productiva de estas piezas. No depende del estado del pedido.',
    )

    fecha_cambio_estado = models.DateField(
        default=timezone.localdate,
        verbose_name='fecha del último cambio de estado',
        help_text='Desde cuándo la pieza está en esta etapa.',
    )

    descripcion = models.CharField(
        max_length=300,
        blank=True,
        verbose_name='descripción',
        help_text='Opcional. Color, medida, lo que acordaron. Ej: "Verde agua, con dorado".',
    )

    # -----------------------------------------------------------------
    # Metadatos: configuración de la TABLA, no de los datos
    # -----------------------------------------------------------------
    class Meta:
        # Por id, que es el orden en que se fueron cargando. Sin esto
        # PostgreSQL devuelve las filas en un orden no garantizado y la
        # lista del pedido podría barajarse sola entre una consulta y
        # otra.
        ordering = ['id']
        verbose_name = 'producto del pedido'
        verbose_name_plural = 'productos del pedido'

        # Acá NO va una UniqueConstraint sobre (pedido, producto), a
        # diferencia de MaterialProducto: el mismo producto puede
        # figurar en dos filas del mismo pedido si difieren en variante,
        # en precio o en etapa productiva. La cantidad agrupa únicamente
        # unidades iguales.
        #
        # Las dos restricciones que sí van son las numéricas, por lo
        # mismo que en Producto: los validators solo actúan al validar,
        # y estas las impone PostgreSQL siempre. La de cantidad no
        # repite lo que ya hace PositiveIntegerField, que impone un
        # mínimo de 0: esta sube ese piso a 1.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(precio__gte=0),
                name='producto_del_pedido_precio_no_negativo',
            ),
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name='producto_del_pedido_cantidad_minima',
            ),
        ]

    # -----------------------------------------------------------------
    # Representación en texto
    # -----------------------------------------------------------------
    def __str__(self):
        return f'{self.producto} en {self.pedido}'

    # -----------------------------------------------------------------
    # Propiedades calculadas
    # -----------------------------------------------------------------
    @property
    def subtotal(self):
        """Lo que suman estas piezas: el precio congelado por la cantidad.

        Decimal por entero da Decimal, así que el resultado conserva la
        precisión exacta del precio.
        """
        return self.precio * self.cantidad
