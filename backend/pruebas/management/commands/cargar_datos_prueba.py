import random
import time
import unicodedata
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from PIL import Image

from categorias.models import Categoria
from clientes.models import Cliente
from gastos.models import Gasto, MaterialDelGasto
from gastos.views import GastoViewSet
from materiales.models import Material
from pedidos.models import Cobro, Pedido, ProductoDelPedido
from pedidos.views import PedidoViewSet, _revisar_estado
from productos.models import ImagenProducto, MaterialProducto, Producto

# =====================================================================
# DATOS DE PRUEBA PARA MEDIR RENDIMIENTO
# =====================================================================
# Llena una base con datos inventados en los volúmenes que salen de la
# entrevista con la emprendedora: 40 pedidos por mes y 2 productos por
# pedido. Sirve para medir cuánto tardan y cuánto pesan los listados con
# 1 y con 3 años de uso.
#
# Corre SOLO contra una base cuyo nombre termina en "_prueba". Es la red
# de seguridad contra un descuido: la base real nunca se toca.
#
# Todo se crea por los modelos. Donde una regla vive en el ViewSet y no
# en el modelo, se llama a la misma función del ViewSet
# (_revisar_estado, _revisar_cobro, _recalcular_monto) o se replica con
# un comentario que dice de dónde sale.
#
# Con --fotos-reales, cada imagen es una copia de una foto real que ya
# está en media/productos/ (una al azar entre las que no empiezan con
# "prueba-"), con el prefijo "prueba-" en el nombre. Las originales no
# se tocan. Sin la opción, cada imagen es un PNG chico de un color.

PEDIDOS_POR_MES = 40

ESCENARIOS = {
    # 40 pedidos por mes, redondeados a 500 por año como en la entrevista.
    '1anio': {'meses': 12, 'productos': 150, 'pedidos': 500, 'gastos': 250, 'clientes': 100},
    '3anios': {'meses': 36, 'productos': 300, 'pedidos': 1500, 'gastos': 750, 'clientes': 250},
}

# Categorías: las de tipo son el accesorio, las temáticas la serie o el
# motivo. Navidad nace de baja para que el catálogo tenga productos
# escondidos por su categoría.
CATEGORIAS_TIPO = ['Aros', 'Collares', 'Dijes', 'Llaveros', 'Prendedores',
                   'Pulseras', 'Anillos', 'Imanes']
CATEGORIAS_TEMATICA = ['Harry Potter', 'Studio Ghibli', 'Flores', 'Animales',
                       'Navidad', 'Espacio', 'Hongos']
CATEGORIA_DE_BAJA = 'Navidad'

# Materiales: cada base por cada variante, 10 × 6 = 60.
BASES_MATERIAL = ['Porcelana fría', 'Acrílico', 'Barniz', 'Alambre', 'Argolla',
                  'Base de aro', 'Cadena', 'Pigmento', 'Pincel', 'Esmalte']
VARIANTES_MATERIAL = ['blanco', 'negro', 'rojo', 'azul', 'verde', 'dorado']
MATERIALES_DISCONTINUADOS = 8

CANTIDADES_DE_MATERIAL = ['dos gotas', 'media plancha', 'un trozo', 'a ojo',
                          'una pizca', '']

NOMBRES = ['Sofía', 'Martina', 'Lucía', 'Valentina', 'Camila', 'Julieta',
           'Florencia', 'Agustina', 'Micaela', 'Carolina', 'Mateo', 'Santiago',
           'Joaquín', 'Nicolás', 'Tomás', 'Franco', 'Lautaro', 'Ramiro']
APELLIDOS = ['Delgado', 'Pérez', 'Gómez', 'Rodríguez', 'Fernández', 'López',
             'Díaz', 'Ríos', 'Juárez', 'Castro', 'Molina', 'Herrera', 'Suárez',
             'Vega', 'Paz', 'Luna', 'Soria', 'Nieva']

DESCRIPCIONES_PRODUCTO = ['', '', 'Pieza modelada a mano, pintada con acrílicos.',
                          'Con terminación brillante.', 'Se puede pedir en otro color.']
DESCRIPCIONES_LINEA = ['', '', '', 'Verde agua, con dorado', 'Con cadena larga',
                       'Sin brillo', 'Para regalo, con caja']
DIRECCIONES = ['', 'Av. Mate de Luna 1500', 'Lavalle 820, Yerba Buena',
               'San Martín 450', 'Pasaje Vélez Sársfield 30']
DESCRIPCIONES_GASTO = {
    Gasto.Tipo.MATERIALES: ['Compra en la mercería', 'Pedido por internet',
                            'Reposición mensual', ''],
    Gasto.Tipo.PUBLICIDAD: ['Pauta en Instagram', 'Flyers para la feria',
                            'Sorteo con influencer'],
    Gasto.Tipo.OTRO: ['Envíos', 'Puesto en la feria', 'Cajas y bolsas',
                      'Reparación del horno'],
}

# Para que una regla con porcentajes se lea como tal: "el 8 % son
# personalizados" y no "random() < 0.08" suelto.
def una_de_cada(porcentaje):
    return random.random() < porcentaje / 100


class Command(BaseCommand):
    help = (
        'Llena una base de PRUEBA con datos inventados para medir rendimiento. '
        'Se niega a correr si el nombre de la base no termina en "_prueba".'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--escenario', required=True, choices=sorted(ESCENARIOS),
            help='1anio: 150 productos, 500 pedidos, 250 gastos. 3anios: el triple.',
        )
        parser.add_argument(
            '--semilla', type=int, default=None,
            help='Fija el azar: dos corridas con la misma semilla dan los mismos datos.',
        )
        parser.add_argument(
            '--fotos-reales', action='store_true',
            help='Copia fotos reales de media/productos/ en vez de generar PNG de un color. '
                 'Pesan unos 400 KB cada una: con 3anios son unos 375 MB.',
        )

    # -----------------------------------------------------------------
    # Entrada
    # -----------------------------------------------------------------

    def handle(self, *args, **opciones):
        nombre_base = connection.settings_dict['NAME']

        # La red de seguridad. Va antes que cualquier otra cosa, así un
        # .env apuntando a la base real no llega ni a abrir la transacción.
        if not nombre_base.endswith('_prueba'):
            raise CommandError(
                f'La base apuntada es «{nombre_base}» y este comando solo corre '
                f'contra una base cuyo nombre termine en "_prueba". No se tocó nada.'
            )

        # Una corrida arriba de otra duplicaría todo. Se pide la base
        # vacía: python manage.py flush --no-input la deja así.
        if Producto.objects.exists() or Pedido.objects.exists():
            raise CommandError(
                f'«{nombre_base}» ya tiene productos o pedidos. Vaciala primero con '
                f'"python manage.py flush --no-input" (y borrá media/productos/prueba-*).'
            )

        if opciones['semilla'] is not None:
            random.seed(opciones['semilla'])

        # Antes de la transacción: si se pidieron fotos reales y no hay
        # ninguna, se frena acá sin haber creado nada.
        self.fotos_reales = self._fotos_reales_disponibles() if opciones['fotos_reales'] else []

        escenario = ESCENARIOS[opciones['escenario']]
        self.hoy = timezone.localdate()
        self.inicio_del_periodo = self.hoy - timedelta(days=escenario['meses'] * 30)

        arranque = time.perf_counter()

        # Todo en una transacción: si algo falla a mitad, la base queda
        # como estaba. Los archivos de imagen ya escritos no, porque el
        # disco no es transaccional: por eso el aviso.
        try:
            with transaction.atomic():
                categorias = self._crear_categorias()
                materiales = self._crear_materiales()
                productos = self._crear_productos(escenario['productos'], categorias, materiales)
                clientes = self._crear_clientes(escenario['clientes'])
                self._crear_pedidos(escenario['pedidos'], clientes, productos)
                self._crear_gastos(escenario['gastos'], materiales)
        except Exception:
            self.stderr.write(
                'Falló a mitad: la base quedó como estaba, pero las imágenes ya '
                'escritas quedan en media/productos/prueba-*. Borralas a mano.'
            )
            raise

        self._resumen(opciones['escenario'], time.perf_counter() - arranque)

    # -----------------------------------------------------------------
    # Ayudantes de azar y fechas
    # -----------------------------------------------------------------

    def _fecha_en_el_periodo(self):
        """Un día cualquiera entre el inicio del período y hoy."""
        dias = (self.hoy - self.inicio_del_periodo).days
        return self.inicio_del_periodo + timedelta(days=random.randint(0, dias))

    @staticmethod
    def _plata(desde, hasta, paso=100):
        """Un importe al azar en múltiplos de paso, como Decimal."""
        return Decimal(random.randrange(desde, hasta + 1, paso))

    @staticmethod
    def _usuario_de_instagram(nombre, apellido, numero):
        """sofia.delgado12: minúsculas y sin acentos, que es lo que Instagram acepta."""
        texto = f'{nombre}.{apellido}{numero}'.lower()
        # NFKD separa cada letra acentuada en letra + acento; al pasar a
        # ASCII ignorando lo que no entra, el acento se va y la letra queda.
        return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode()

    def _fotos_reales_disponibles(self):
        """Las fotos reales de media/productos/: todas las que no empiezan con "prueba-".

        La carpeta sale del upload_to del campo, no de un texto repetido
        acá. Se devuelven rutas; el archivo se lee recién al copiarlo.
        """
        carpeta = Path(settings.MEDIA_ROOT) / ImagenProducto._meta.get_field('imagen').upload_to
        fotos = sorted(
            ruta for ruta in carpeta.glob('*')
            if ruta.is_file()
            and not ruta.name.startswith('prueba-')
            and ruta.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')
        )
        if not fotos:
            raise CommandError(
                f'--fotos-reales necesita fotos en {carpeta} que no empiecen con "prueba-", '
                f'y no hay ninguna.'
            )
        return fotos

    # -----------------------------------------------------------------
    # Categorías y materiales
    # -----------------------------------------------------------------

    def _crear_categorias(self):
        """Devuelve {'tipo': [...], 'tematica': [...]}, con Navidad de baja."""
        categorias = {'tipo': [], 'tematica': []}

        for nombre in CATEGORIAS_TIPO:
            categorias['tipo'].append(
                Categoria.objects.create(nombre=nombre, tipo=Categoria.Tipo.TIPO)
            )

        for nombre in CATEGORIAS_TEMATICA:
            estado = (Categoria.Estado.BAJA if nombre == CATEGORIA_DE_BAJA
                      else Categoria.Estado.ACTIVO)
            categorias['tematica'].append(
                Categoria.objects.create(nombre=nombre, tipo=Categoria.Tipo.TEMATICA,
                                         estado=estado)
            )

        return categorias

    def _crear_materiales(self):
        """60 materiales con disponibilidad variada y algunos discontinuados."""
        materiales = []

        for base in BASES_MATERIAL:
            for variante in VARIANTES_MATERIAL:
                # Alta 60 %, Media 25 %, Baja 15 %.
                disponibilidad = random.choices(
                    [Material.Disponibilidad.ALTA, Material.Disponibilidad.MEDIA,
                     Material.Disponibilidad.BAJA],
                    weights=[60, 25, 15],
                )[0]
                materiales.append(Material.objects.create(
                    nombre=f'{base} {variante}',
                    disponibilidad=disponibilidad,
                ))

        for material in random.sample(materiales, MATERIALES_DISCONTINUADOS):
            material.estado = Material.Estado.DISCONTINUADO
            material.save(update_fields=['estado'])

        return materiales

    # -----------------------------------------------------------------
    # Productos, con sus categorías, materiales e imágenes
    # -----------------------------------------------------------------

    def _crear_productos(self, cantidad, categorias, materiales):
        productos = []

        for numero in range(1, cantidad + 1):
            tipo = random.choice(categorias['tipo'])
            tematicas = random.sample(categorias['tematica'], k=random.choice([0, 1, 1, 2]))
            tema = tematicas[0].nombre if tematicas else 'lisos'

            producto = Producto.objects.create(
                nombre=f'{tipo.nombre} {tema} {numero}',
                descripcion=random.choice(DESCRIPCIONES_PRODUCTO),
                precio_actual=self._plata(1500, 25000),
                dificultad=random.choice(Producto.Dificultad.values),
                es_personalizado=una_de_cada(8),
                estado=Producto.Estado.BAJA if una_de_cada(5) else Producto.Estado.ACTIVO,
            )
            producto.categorias.add(tipo, *tematicas)

            # 2 a 5 materiales distintos: la UniqueConstraint (producto,
            # material) no deja repetir, y sample() no repite.
            for material in random.sample(materiales, k=random.randint(2, 5)):
                MaterialProducto.objects.create(
                    producto=producto, material=material,
                    cantidad=random.choice(CANTIDADES_DE_MATERIAL),
                )

            for orden in range(random.randint(1, 3)):
                self._crear_imagen(producto, orden)

            productos.append(producto)

        return productos

    def _crear_imagen(self, producto, orden):
        """Una imagen de resultado: copia de una foto real o PNG de un color.

        El archivo se llama prueba-<producto>-<orden> más la extensión,
        para poder borrarlos todos juntos de media/productos/: MEDIA_ROOT
        no depende de la base, así que conviven con las fotos reales.
        """
        if self.fotos_reales:
            # Una foto real al azar. read_bytes() solo lee: la original
            # queda donde está y como está.
            origen = random.choice(self.fotos_reales)
            datos, extension = origen.read_bytes(), origen.suffix.lower()
        else:
            color = (random.randint(60, 220), random.randint(60, 220), random.randint(60, 220))
            buffer = BytesIO()
            Image.new('RGB', (300, 300), color).save(buffer, format='PNG')
            datos, extension = buffer.getvalue(), '.png'

        imagen = ImagenProducto(producto=producto, tipo=ImagenProducto.Tipo.RESULTADO,
                                orden=orden)
        # save() del campo escribe el archivo por el storage (que respeta
        # upload_to='productos/') y después guarda la fila.
        imagen.imagen.save(f'prueba-{producto.id}-{orden}{extension}',
                           ContentFile(datos), save=True)

    # -----------------------------------------------------------------
    # Clientes
    # -----------------------------------------------------------------

    def _crear_clientes(self, cantidad):
        clientes = []

        for numero in range(1, cantidad + 1):
            nombre = random.choice(NOMBRES)
            apellido = random.choice(APELLIDOS)
            instagram = self._usuario_de_instagram(nombre, apellido, numero)
            clientes.append(Cliente.objects.create(
                instagram=instagram,
                nombre=nombre,
                # Muchos clientes dejan solo el nombre, como dice el modelo.
                apellido=apellido if una_de_cada(70) else '',
                email=f'{instagram}@gmail.com' if una_de_cada(50) else '',
            ))

        return clientes

    # -----------------------------------------------------------------
    # Pedidos, con sus productos y sus cobros
    # -----------------------------------------------------------------

    def _crear_pedidos(self, cantidad, clientes, productos):
        # Unos pocos clientes concentran muchos pedidos, como en la
        # realidad: cada cliente recibe un peso y los pedidos se reparten
        # según ese peso.
        pesos = [random.choice([1, 1, 1, 1, 2, 3, 8]) for _ in clientes]

        # Un pedido se arma con productos activos. Los personalizados
        # entran igual: son encargos, y un encargo es justamente un pedido.
        activos = [p for p in productos if p.estado == Producto.Estado.ACTIVO]

        for _ in range(cantidad):
            fecha = self._fecha_en_el_periodo()
            antiguedad = (self.hoy - fecha).days

            # Los viejos ya se entregaron casi todos; los recientes están
            # en curso.
            if antiguedad > 45:
                estado = random.choices(
                    [Pedido.Estado.ENTREGADO, Pedido.Estado.LISTO], weights=[90, 10],
                )[0]
            else:
                estado = random.choices(
                    [Pedido.Estado.PENDIENTE, Pedido.Estado.EN_PRODUCCION, Pedido.Estado.LISTO],
                    weights=[40, 45, 15],
                )[0]

            estimada = None if una_de_cada(10) else fecha + timedelta(days=random.randint(7, 30))

            # Regla de _guardar_estado en PedidoViewSet: un pedido tiene
            # fecha de entrega real si y solo si está Entregado.
            if estado == Pedido.Estado.ENTREGADO:
                base = estimada or fecha + timedelta(days=15)
                real = base + timedelta(days=random.randint(-3, 3))
            else:
                real = None

            envio_mio = una_de_cada(30)
            pedido = Pedido.objects.create(
                cliente=random.choices(clientes, weights=pesos)[0],
                estado=estado,
                fecha_pedido=fecha,
                fecha_entrega_estimada=estimada,
                fecha_entrega_real=real,
                envio_a_cargo=Pedido.EnvioACargo.MIO if envio_mio else Pedido.EnvioACargo.CLIENTE,
                direccion_entrega=random.choice(DIRECCIONES) if envio_mio else '',
                costo_entrega=self._plata(1500, 6000) if envio_mio else None,
            )

            self._crear_productos_del_pedido(pedido, activos, antiguedad)

            # La misma comprobación que hace cambiar_estado: un pedido no
            # puede estar Listo ni Entregado con piezas sin terminar. Si
            # el generador la rompiera, acá se frena.
            error = _revisar_estado(pedido, pedido.estado)
            if error:
                raise CommandError(f'Un pedido generado rompería una regla del sistema: {error}')

            self._crear_cobros(pedido)

    def _crear_productos_del_pedido(self, pedido, activos, antiguedad):
        # 1 a 4 productos por pedido, con el 2 como lo más común: es el
        # promedio de la entrevista.
        cuantos = random.choices([1, 2, 3, 4], weights=[35, 40, 15, 10])[0]
        etapas = self._etapas_para(pedido.estado, cuantos)

        for producto, etapa in zip(random.sample(activos, k=cuantos), etapas):
            # El precio se CONGELA al registrar. En los pedidos de más de
            # seis meses se baja un poco: así se ve que el catálogo subió
            # y el pedido conserva lo que se acordó.
            precio = producto.precio_actual
            if antiguedad > 180:
                precio = precio * Decimal(random.choice(['0.80', '0.85', '0.90', '0.95', '1.00']))
                precio = max(precio - precio % 100, Decimal(100))

            ProductoDelPedido.objects.create(
                pedido=pedido,
                producto=producto,
                precio=precio,
                cantidad=random.choices([1, 2, 3], weights=[70, 20, 10])[0],
                estado=etapa,
                fecha_cambio_estado=pedido.fecha_pedido + timedelta(
                    days=random.randint(0, min(30, antiguedad))
                ),
                descripcion=random.choice(DESCRIPCIONES_LINEA),
            )

    @staticmethod
    def _etapas_para(estado_del_pedido, cuantos):
        """Las etapas productivas de las piezas, coherentes con el estado del pedido.

        Es la regla de _revisar_estado: Listo y Entregado exigen todas
        las piezas Terminadas. En producción tiene etapas mezcladas, pero
        no todas terminadas (si lo estuvieran, la emprendedora lo habría
        pasado a Listo). Pendiente no empezó.
        """
        if estado_del_pedido in (Pedido.Estado.LISTO, Pedido.Estado.ENTREGADO):
            return [ProductoDelPedido.Estado.TERMINADO] * cuantos

        if estado_del_pedido == Pedido.Estado.PENDIENTE:
            return [ProductoDelPedido.Estado.PENDIENTE] * cuantos

        etapas = random.choices(ProductoDelPedido.Estado.values,
                                weights=[20, 25, 25, 20, 10], k=cuantos)
        if all(etapa == ProductoDelPedido.Estado.TERMINADO for etapa in etapas):
            etapas[-1] = ProductoDelPedido.Estado.PINTURA_BARNIZ
        return etapas

    def _crear_cobros(self, pedido):
        """Cobros coherentes con el estado: los entregados están pagos casi todos."""
        total = pedido.total

        if pedido.estado == Pedido.Estado.ENTREGADO:
            forma = random.choices(['completo', 'sena_y_resto', 'solo_sena'],
                                   weights=[60, 30, 10])[0]
            fecha_del_pago = pedido.fecha_entrega_real
        elif pedido.estado == Pedido.Estado.PENDIENTE:
            forma = 'solo_sena' if una_de_cada(40) else 'nada'
        else:
            forma = 'solo_sena' if una_de_cada(70) else 'nada'

        if forma == 'nada':
            return

        if forma == 'completo':
            self._registrar_cobro(pedido, Cobro.Tipo.PAGO_COMPLETO, total, fecha_del_pago)
            return

        # Una seña es el 30 a 50 % del total, en múltiplos de 100, y nunca
        # el total entero: la regla dice que una seña no puede dejar el
        # pedido saldado.
        sena = total * Decimal(random.choice(['0.30', '0.35', '0.40', '0.45', '0.50']))
        sena -= sena % 100
        if sena >= total:
            sena = total - 100
        if sena <= 0:
            return

        self._registrar_cobro(pedido, Cobro.Tipo.SENA, sena, pedido.fecha_pedido)

        if forma == 'sena_y_resto':
            self._registrar_cobro(pedido, Cobro.Tipo.PAGO_RESTANTE, total - sena, fecha_del_pago)

    def _registrar_cobro(self, pedido, tipo, monto, fecha):
        # Las mismas dos reglas que revisa registrar_cobro en el ViewSet:
        # no se puede cobrar más que el total, y una seña no salda.
        # _revisar_cobro no usa self, así que alcanza con un ViewSet vacío.
        error = PedidoViewSet()._revisar_cobro(pedido, tipo, monto)
        if error:
            raise CommandError(f'Un cobro generado rompería una regla del sistema: {error}')

        Cobro.objects.create(
            pedido=pedido, tipo=tipo, monto=monto, fecha=fecha,
            medio=random.choice(Cobro.Medio.values),
        )

    # -----------------------------------------------------------------
    # Gastos, con sus materiales
    # -----------------------------------------------------------------

    def _crear_gastos(self, cantidad, materiales):
        for _ in range(cantidad):
            tipo = random.choices(
                [Gasto.Tipo.MATERIALES, Gasto.Tipo.PUBLICIDAD, Gasto.Tipo.OTRO],
                weights=[60, 20, 20],
            )[0]
            gasto = Gasto.objects.create(
                tipo=tipo,
                fecha=self._fecha_en_el_periodo(),
                descripcion=random.choice(DESCRIPCIONES_GASTO[tipo]),
                # Publicidad y otro llevan el monto cargado a mano; el de
                # materiales nace en 0 y lo escribe _recalcular_monto.
                monto=self._plata(500, 50000) if tipo != Gasto.Tipo.MATERIALES else Decimal('0'),
            )

            if tipo != Gasto.Tipo.MATERIALES:
                continue

            # 1 a 5 materiales distintos; pueden ser discontinuados, porque
            # una compra vieja de algo que después se dejó de usar es
            # historia válida.
            for material in random.sample(materiales, k=random.randint(1, 5)):
                MaterialDelGasto.objects.create(
                    gasto=gasto, material=material,
                    cantidad=random.randint(1, 10),
                    precio_unitario=self._plata(200, 8000, paso=50),
                )

            # La única puerta al monto de un gasto de materiales.
            GastoViewSet()._recalcular_monto(gasto)

    # -----------------------------------------------------------------
    # Resumen
    # -----------------------------------------------------------------

    def _resumen(self, escenario, segundos):
        filas = [
            ('categorías', Categoria.objects.count()),
            ('materiales', Material.objects.count()),
            ('productos', Producto.objects.count()),
            ('imágenes de producto', ImagenProducto.objects.count()),
            ('clientes', Cliente.objects.count()),
            ('pedidos', Pedido.objects.count()),
            ('productos del pedido', ProductoDelPedido.objects.count()),
            ('cobros', Cobro.objects.count()),
            ('gastos', Gasto.objects.count()),
            ('materiales del gasto', MaterialDelGasto.objects.count()),
        ]
        self.stdout.write(self.style.SUCCESS(
            f'Escenario «{escenario}» cargado en {segundos:.1f} s:'
        ))
        for nombre, cuantos in filas:
            self.stdout.write(f'  {cuantos:>6}  {nombre}')
        origen = 'copias de fotos reales' if self.fotos_reales else 'PNG generados de un color'
        self.stdout.write(f'  Imágenes: {origen}, en media/productos/prueba-*.')
