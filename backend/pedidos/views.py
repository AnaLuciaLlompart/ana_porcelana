from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from productos.models import Producto

from .models import Pedido
from .serializers import (
    CobroSerializer,
    PedidoDetalleSerializer,
    PedidoListaSerializer,
    ProductoDelPedidoModificarSerializer,
    ProductoDelPedidoSerializer,
)

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


# Las cuatro operaciones del CRUD no llevan docstring con su CU porque
# no están escritas acá: las hereda el ModelViewSet de DRF. La
# correspondencia es esta, para no tener que deducirla:
#
#   list      GET    /pedidos/       CU41 - buscar
#   create    POST   /pedidos/       CU40 - alta
#   update    PUT    /pedidos/{id}/  CU42 - modificar
#   destroy   DELETE /pedidos/{id}/  CU43 - borrar
#
# retrieve (GET /pedidos/{id}/) no implementa un CU propio: devuelve la
# ficha que CU42 usa para cargar el formulario.

class PedidoViewSet(viewsets.ModelViewSet):
    """CRUD de pedidos y de los productos que los componen (CU40 a CU47).

    Hereda IsAuthenticated de la configuración global de DRF, por lo que
    todos los endpoints exigen sesión activa.

    A diferencia de productos y materiales, acá no hay update()
    sobrescrito: Pedido no tiene baja lógica, así que no existe ningún
    estado que deje al registro de solo lectura. Es la misma situación
    que Cliente. Un pedido entregado se sigue pudiendo corregir.

    Además del CRUD expone dos cosas:

    - cambiar_estado, que es parte de CU42
    - los productos del pedido, en /productos/ (CU44 a CU47)
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # Se busca por los datos del cliente y no por los del pedido: el
    # buscador de la pantalla dice "Buscar por cliente", que es como la
    # emprendedora encuentra un encargo.
    search_fields = ['cliente__instagram', 'cliente__nombre', 'cliente__apellido']
    ordering_fields = ['fecha_pedido', 'fecha_entrega_estimada', 'estado']

    # -----------------------------------------------------------------
    # Dos serializers según la acción
    # -----------------------------------------------------------------

    def get_serializer_class(self):
        """El listado usa el serializer liviano; el resto, el completo."""
        if self.action == 'list':
            return PedidoListaSerializer

        return PedidoDetalleSerializer

    # -----------------------------------------------------------------
    # El prefetch también depende de la acción
    # -----------------------------------------------------------------

    def get_queryset(self):
        """Trae de una sola vez las relaciones que el serializer va a leer.

        select_related en las dos acciones, porque los dos serializers
        muestran el instagram y el nombre del cliente. Es select_related
        y no prefetch_related porque el cliente es una clave foránea:
        se resuelve con un JOIN en la misma consulta.

        Los productos van en las dos, y en las dos se llega hasta el
        producto de cada línea: el listado suma el total y muestra los
        nombres en la columna CONTENIDO. Los cobros también van en las
        dos: el listado los necesita para el saldo y la ficha además
        para mostrarlos.

        La ficha necesita una relación más, porque además dibuja las
        líneas una por una y para cada una mira si su producto tiene
        materiales cargados. El doble guión bajo de
        'productos__producto__materiales' es lo que le dice a Django que
        siga la relación un nivel más.
        """
        queryset = Pedido.objects.select_related('cliente')

        if self.action == 'list':
            return queryset.prefetch_related('productos__producto', 'cobros')

        return queryset.prefetch_related('productos__producto__materiales', 'cobros')

    # -----------------------------------------------------------------
    # El estado del pedido, que es parte de CU42
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def cambiar_estado(self, request, pk=None):
        """Cambiar el estado del pedido. Es parte de CU42 - Modificar pedido.

        No es un caso de uso propio, pero va como endpoint aparte por dos
        motivos. En la pantalla el estado se cambia solo, con efecto
        inmediato, sin pasar por el formulario ni por su botón de
        guardar. Y arrastra un efecto lateral que un PUT no tiene:
        completar la fecha de entrega real.

        El estado llega en el cuerpo, en la clave 'estado'.
        """
        pedido = self.get_object()

        estado = request.data.get('estado')

        if not estado:
            return Response(
                {'detail': 'Falta el estado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # .values son los códigos que se guardan: 'PENDIENTE',
        # 'EN_PRODUCCION', 'LISTO', 'ENTREGADO'.
        if estado not in Pedido.Estado.values:
            return Response(
                {'detail': 'Ese no es un estado válido para un pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedido.estado = estado

        # La fecha de entrega real se completa sola al entregar, que es el
        # momento en que se sabe, y se escribe SIEMPRE con la fecha de hoy,
        # aunque el campo ya tuviera una cargada. Tocar el botón Entregado
        # significa "lo entregué hoy", sin excepciones que haya que
        # recordar.
        #
        # Corregirla a mano se sigue pudiendo: el campo es editable en el
        # formulario. Lo que no hace es sobrevivir a un nuevo clic acá.
        #
        # Sacar el pedido de Entregado no borra la fecha: se corrige desde
        # el formulario si hace falta.
        if estado == Pedido.Estado.ENTREGADO:
            pedido.fecha_entrega_real = timezone.localdate()
            pedido.save(update_fields=['estado', 'fecha_entrega_real'])
        else:
            pedido.save(update_fields=['estado'])

        return Response(self.get_serializer(pedido).data)

    # -----------------------------------------------------------------
    # Los productos del pedido (CU44 a CU47)
    # -----------------------------------------------------------------
    # Los productos de un pedido son una colección que cuelga de él, así
    # que las cuatro operaciones son las cuatro operaciones normales
    # sobre una colección, sobre la misma URL base:
    #
    #   GET    /api/pedidos/1/productos/     lista           (CU45)
    #   POST   /api/pedidos/1/productos/     agrega uno      (CU44)
    #   PATCH  /api/pedidos/1/productos/3/   lo modifica     (CU46)
    #   DELETE /api/pedidos/1/productos/3/   lo quita        (CU47)
    #
    # Es la misma forma que los materiales de un producto, y el id de la
    # ruta también es el de la LÍNEA (ProductoDelPedido), no el del
    # producto. Acá eso además es imprescindible: el mismo producto
    # puede figurar dos veces en el mismo pedido, así que su id no
    # alcanzaría para saber de cuál de las dos filas se habla.

    def _buscar_producto_del_pedido(self, pedido, linea_id):
        """Busca una línea ENTRE LAS DE ESTE PEDIDO, o devuelve None.

        Recorre pedido.productos, que get_object() ya trajo con el
        prefetch. Buscar dentro de esa lista, y no en
        ProductoDelPedido.objects, es lo que garantiza que la línea sea
        de este pedido: una línea ajena directamente no está en la
        lista. Sin eso, mandando un id cualquiera se podrían editar los
        productos de otro pedido.

        El \\d+ del url_path ya garantizó que linea_id sean dígitos, así
        que el int() no puede fallar.
        """
        for linea in pedido.productos.all():
            if linea.pk == int(linea_id):
                return linea

        return None

    @action(detail=True, methods=['get'], url_path='productos')
    def productos(self, request, pk=None):
        """CU45 - Listar los productos de un pedido.

        Devuelve las líneas con el nombre de cada producto y su etapa
        productiva, que es lo que dibuja la pestaña de productos de la
        ficha.
        """
        pedido = self.get_object()

        return Response(
            ProductoDelPedidoSerializer(
                pedido.productos.all(), many=True
            ).data
        )

    # El mapping le dice al router: misma URL que 'productos', pero
    # cuando el método sea POST, ejecutá esta otra función. Así cada caso
    # de uso queda en su propio método, sin un if adentro.
    @productos.mapping.post
    def agregar_producto(self, request, pk=None):
        """CU44 - Agregar un producto al pedido.

        En el cuerpo llegan 'producto' (el id) y, opcionalmente,
        'cantidad', 'precio' y 'descripcion'.

        ACÁ SE CONGELA EL PRECIO: si el cuerpo no trae uno, se copia el
        precio_actual del producto. A partir de ese momento la línea
        conserva ese número, aunque el del catálogo cambie mañana.

        No se rechaza un producto que ya figura en el pedido. A
        diferencia de los materiales de un producto, acá no hay
        restricción de unicidad: la misma pieza puede ir en dos filas si
        difieren en variante, precio o etapa productiva.
        """
        pedido = self.get_object()

        producto_id = request.data.get('producto')

        if not producto_id:
            return Response(
                {'detail': 'Falta el id del producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            producto = Producto.objects.get(pk=producto_id)
        except (Producto.DoesNotExist, ValueError):
            return Response(
                {'detail': 'No existe un producto con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Se copia el cuerpo para poder completarlo sin tocar el
        # original. request.data puede ser un QueryDict inmutable, y su
        # .copy() devuelve uno que sí se puede modificar.
        datos = request.data.copy()

        if not datos.get('precio'):
            datos['precio'] = producto.precio_actual

        if not datos.get('cantidad'):
            datos['cantidad'] = 1

        # Se guarda con el serializer y no con .objects.create() porque
        # acá hay números que validar. Sin esto, una cantidad en 0 la
        # rechaza la CheckConstraint de PostgreSQL, Django levanta un
        # IntegrityError y el frontend recibe un 500 en vez de un
        # mensaje que se pueda mostrar.
        serializer = ProductoDelPedidoSerializer(data=datos)
        serializer.is_valid(raise_exception=True)

        # El pedido no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda agregarle un producto a otro
        # pedido mandándolo en el formulario.
        serializer.save(pedido=pedido)

        # create() escribió en la base, pero los productos que trajo el
        # prefetch siguen cacheados en memoria, sin la línea recién
        # agregada. refresh_from_db() vacía esa caché, así el serializer
        # recalcula el total contra la base.
        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @action(detail=True, methods=['patch'],
            url_path=r'productos/(?P<linea_id>\d+)')
    def modificar_producto_del_pedido(self, request, pk=None, linea_id=None):
        """CU46 - Modificar un producto del pedido.

        Se pueden cambiar la cantidad, el precio, la descripción y la
        etapa productiva. El producto no: para encargar otra pieza se
        quita esta línea y se agrega otra.

        Si la etapa cambia, se actualiza la fecha del cambio de estado.
        """
        pedido = self.get_object()

        linea = self._buscar_producto_del_pedido(pedido, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Ese producto no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Se guarda ANTES de escribir, porque después de save() la línea
        # ya tiene el estado nuevo y no habría con qué comparar.
        estado_anterior = linea.estado

        # partial=True: es un PATCH, así que lo que no venga en el
        # cuerpo se deja como está. El serializer valida la cantidad y
        # el precio, por lo mismo que en el alta, y el estado solo: al
        # tener choices, DRF lo convierte en un ChoiceField que rechaza
        # cualquier valor fuera de la lista.
        serializer = ProductoDelPedidoModificarSerializer(
            linea,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        linea = serializer.save()

        # La fecha dice desde cuándo la pieza está en esta etapa, así que
        # solo se toca cuando la etapa efectivamente cambió. Un PATCH que
        # corrige la cantidad no tiene por qué mover el reloj del secado.
        if linea.estado != estado_anterior:
            linea.fecha_cambio_estado = timezone.localdate()
            linea.save(update_fields=['fecha_cambio_estado'])

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @modificar_producto_del_pedido.mapping.delete
    def quitar_producto_del_pedido(self, request, pk=None, linea_id=None):
        """CU47 - Quitar un producto del pedido.

        Borra la línea, no el producto: el producto sigue existiendo en
        el catálogo y puede estar en otros pedidos. Es lo que protege el
        PROTECT de la clave foránea.
        """
        pedido = self.get_object()

        linea = self._buscar_producto_del_pedido(pedido, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Ese producto no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea.delete()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)



    # -----------------------------------------------------------------
    # Los cobros del pedido (CU48 a CU51)
    # -----------------------------------------------------------------
    # Misma forma que los productos del pedido: una colección que cuelga
    # del pedido, con las cuatro operaciones sobre la misma URL base.
    #
    #   GET    /api/pedidos/1/cobros/     lista        (CU49)
    #   POST   /api/pedidos/1/cobros/     registra     (CU48)
    #   PATCH  /api/pedidos/1/cobros/3/   lo modifica  (CU50)
    #   DELETE /api/pedidos/1/cobros/3/   lo borra     (CU51)

    def _buscar_cobro(self, pedido, cobro_id):
        """Busca un cobro ENTRE LOS DE ESTE PEDIDO, o devuelve None.

        Recorre pedido.cobros, que get_object() ya trajo con el prefetch.
        Buscar dentro de esa lista, y no en Cobro.objects, es lo que
        garantiza que el cobro sea de este pedido: uno ajeno
        directamente no está en la lista. Sin eso, mandando un id
        cualquiera se podrían tocar los cobros de otro pedido.

        El \d+ del url_path ya garantizó que cobro_id sean dígitos, así
        que el int() no puede fallar.
        """
        for cobro in pedido.cobros.all():
            if cobro.pk == int(cobro_id):
                return cobro

        return None

    @action(detail=True, methods=['get'], url_path='cobros')
    def cobros(self, request, pk=None):
        """CU49 - Listar los cobros de un pedido.

        Vienen del más reciente al más viejo, que es el ordering del
        modelo y el orden en que los muestra la pestaña.
        """
        pedido = self.get_object()

        return Response(
            CobroSerializer(pedido.cobros.all(), many=True).data
        )

    @cobros.mapping.post
    def registrar_cobro(self, request, pk=None):
        """CU48 - Registrar un cobro del pedido.

        En el cuerpo llegan 'monto' y, opcionalmente, 'tipo', 'fecha' y
        'medio', que tienen valor por defecto en el modelo.

        NO se valida que la suma de los cobros no pase el total del
        pedido, y es a propósito: pasa de verdad cuando un cliente paga
        de más o cuando hay una devolución. El saldo queda negativo y la
        pantalla lo muestra como plata a favor, que es información que
        hace falta para devolvérsela. Lo único que se valida del monto es
        que sea mayor a cero, y de eso se encarga el serializer.
        """
        pedido = self.get_object()

        # Se guarda con el serializer y no con .objects.create() porque
        # hay un número que validar: sin esto, un monto en cero lo
        # rechaza la CheckConstraint de PostgreSQL y el frontend recibe
        # un 500 en vez de un mensaje que se pueda mostrar.
        serializer = CobroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # El pedido no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda registrarle un cobro a otro
        # pedido mandándolo en el formulario.
        serializer.save(pedido=pedido)

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @action(detail=True, methods=['patch'],
            url_path=r'cobros/(?P<cobro_id>\d+)')
    def modificar_cobro(self, request, pk=None, cobro_id=None):
        """CU50 - Modificar un cobro del pedido.

        Se pueden corregir el tipo, el monto, la fecha y el medio: un
        cobro mal anotado se arregla, no se borra y se vuelve a cargar.
        """
        pedido = self.get_object()

        cobro = self._buscar_cobro(pedido, cobro_id)

        if cobro is None:
            return Response(
                {'detail': 'Ese cobro no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # partial=True: es un PATCH, así que lo que no venga en el cuerpo
        # se deja como está. El serializer valida el monto por lo mismo
        # que en el alta.
        serializer = CobroSerializer(cobro, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)

    @modificar_cobro.mapping.delete
    def borrar_cobro(self, request, pk=None, cobro_id=None):
        """CU51 - Borrar un cobro del pedido.

        Se usa cuando el cobro se anotó por error. El pedido queda con
        el saldo que tenía antes de registrarlo.
        """
        pedido = self.get_object()

        cobro = self._buscar_cobro(pedido, cobro_id)

        if cobro is None:
            return Response(
                {'detail': 'Ese cobro no pertenece a este pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cobro.delete()

        pedido.refresh_from_db()

        return Response(self.get_serializer(pedido).data)
