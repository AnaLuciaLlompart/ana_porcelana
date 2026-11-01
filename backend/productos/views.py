from decimal import Decimal

from django.db.models import Case, Count, Exists, Max, Min, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from categorias.models import Categoria
from categorias.serializers import CategoriaSerializer
from config.exportar import Columna, ExportarMixin, describir_rango
from config.hijos import error_de_fila, es_fila_nueva, fila_guardada, ids_que_vienen
from config.listados import leer_importe, ordenar
from config.paginacion import PaginacionDeListado
from materiales.models import Material

from .models import MaterialProducto, Producto
from .serializers import (
    ImagenProductoCrearSerializer,
    ImagenProductoModificarSerializer,
    ImagenProductoSerializer,
    ListasDeHijosDeProducto,
    MaterialProductoSerializer,
    ProductoDetalleSerializer,
    ProductoListaSerializer,
    ResumenDeProductosSerializer,
)

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model


# Las columnas por las que se puede ordenar el listado (?orden=precio, o
# ?orden=-precio para al revés). Son las del desplegable de orden y las de
# la tabla. Dificultad va en su orden lógico, Baja, Media, Alta, y no en el
# alfabético.
ORDENES = {
    'nombre': ['nombre'],
    'precio': ['precio_actual'],
    'dificultad': ['orden_dificultad'],
    'categorias': ['cantidad_categorias'],
}

# Los dos valores del filtro "Tipo" del modal, con lo que es_personalizado
# tiene que valer para cada uno.
TIPOS = {'personalizado': True, 'catalogo': False}


def _catalogo_para_exportar(producto):
    """El texto de la columna CATÁLOGO del listado, como estadoCatalogo()
    de productos/presentacion.js en el frontend."""
    if producto.estado != Producto.Estado.ACTIVO:
        return 'Dado de baja'
    if producto.es_personalizado:
        return 'Personalizado'
    if producto.visible_en_catalogo:
        return 'En catálogo'
    if producto.oculto_por_categoria:
        return 'Categoría de baja'
    return 'Sin publicar'


# De las cuatro operaciones del CRUD, list es la única que se hereda tal
# cual del ModelViewSet de DRF y por eso no lleva docstring con su CU;
# create, update y destroy están escritas más abajo. La correspondencia
# es esta, para no tener que deducirla:
#
#   list      GET    /productos/       CU18 - buscar
#   create    POST   /productos/       CU17 - alta
#   update    PUT    /productos/{id}/  CU19 - modificar
#   destroy   DELETE /productos/{id}/  CU22 - eliminar
#
# retrieve (GET /productos/{id}/) no implementa un CU propio: devuelve
# la ficha que CU19 usa para cargar el formulario.

class ProductoViewSet(ExportarMixin, viewsets.ModelViewSet):
    """CRUD de productos y sus relaciones (CU17 a CU35).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    Devuelve todos los productos, activos y de baja. La separación
    visual entre ambos grupos se resuelve en el frontend.

    Además del CRUD y de los cambios de estado (CU17 a CU24), expone
    como sub-recursos las dos colecciones que cuelgan de un producto:

    - sus categorías, en /categorias/ (CU25 a CU27)
    - los materiales que necesita, en /materiales/ (CU28 a CU31)
    - sus imágenes, en /imagenes/ (CU32 a CU35)
    """

    # El listado se pagina con ?pagina= (corrección D3), con los filtros y
    # el orden resueltos en la base por _filtrar(). Sin ?pagina= y sin
    # filtros sigue devolviendo todos: así lo piden los desplegables de
    # productos de un pedido y el alta de producto, que revisa que el
    # nombre no exista. Reemplaza al SearchFilter y al OrderingFilter.
    pagination_class = PaginacionDeListado

    # Lo que necesita ExportarMixin para /exportar/ (corrección E10).
    EXPORTAR_TITULO = 'Productos'
    EXPORTAR_ARCHIVO = 'productos'
    EXPORTAR_UNIDAD = ('producto', 'productos')
    COLUMNAS_PARA_EXPORTAR = [
        Columna('Producto', lambda p: p.nombre, 'texto', 16),
        Columna('Precio', lambda p: p.precio_actual, 'plata', 7),
        Columna('Dificultad', lambda p: p.get_dificultad_display(), 'texto', 7),
        Columna('Categorías', lambda p: ', '.join(c.nombre for c in p.categorias.all()), 'texto', 20),
        Columna('Catálogo', _catalogo_para_exportar, 'texto', 9),
        Columna('Estado', lambda p: p.get_estado_display(), 'texto', 6),
    ]

    # Los tres formatos en los que puede llegar el cuerpo de un pedido.
    # JSON es el de siempre; los otros dos hacen falta para subir
    # imágenes (CU32), porque un archivo no viaja dentro de un JSON:
    # el navegador lo manda como multipart/form-data, que es el formato
    # de los formularios con adjuntos.
    #
    # Coincide con lo que DRF trae por defecto, así que no cambia el
    # comportamiento: se escribe para dejarlo a la vista y para que
    # siga valiendo aunque mañana se toque la configuración global.
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    # -----------------------------------------------------------------
    # Dos serializers según la acción
    # -----------------------------------------------------------------

    def get_serializer_class(self):
        """El listado usa el serializer liviano; el resto, el completo.

        self.action es el nombre de la operación en curso: 'list',
        'retrieve', 'create', 'update', o el nombre de una @action.
        """
        if self.action == 'list':
            return ProductoListaSerializer

        return ProductoDetalleSerializer

    # -----------------------------------------------------------------
    # El prefetch también depende de la acción
    # -----------------------------------------------------------------

    def get_queryset(self):
        """Trae de una sola vez las relaciones que el serializer va a leer.

        La ficha pide una relación más que el listado, y el motivo es
        cuál de las dos vías a los materiales usa cada una:

        - El listado solo cuenta materiales y mira cuáles están
          discontinuados. Las dos cosas leen producto.materiales, que
          ya devuelve objetos Material.
        - La ficha además dibuja los materiales del producto con
          MaterialProductoSerializer, que por cada línea salta de la
          fila de MaterialProducto a su Material para sacarle el nombre
          y el estado. Sin prefetch ese salto es una consulta por línea.

        El doble guión bajo de 'materiales_usados__material' es lo que
        le dice a Django que siga la relación un nivel más y traiga
        también los materiales de cada línea.
        """
        queryset = Producto.objects.all()

        # Exportar trae lo mismo que el listado, con los mismos filtros.
        if self.action in ('list', 'exportar'):
            return self._filtrar(queryset.prefetch_related(
                'categorias',
                'materiales',
                'imagenes',
            ))

        return queryset.prefetch_related(
            'categorias',
            'materiales',
            'imagenes',
            'materiales_usados__material',
        )

    def _filtrar(self, queryset):
        """Aplica al listado los filtros, la búsqueda y el orden de la URL (CU18).

          busqueda=texto           nombre del producto
          estado=ACTIVO            se puede repetir; ver abajo
          categoria=id             se puede repetir: los que tienen alguna
          dificultad=MEDIA         se puede repetir
          tipo=personalizado       o catalogo; se puede repetir
          precio_desde, precio_hasta   el rango de precio, inclusive
          orden=precio             una clave de ORDENES; con '-', al revés

        El estado tiene una regla más, la misma que tenía la grilla: un
        producto con una categoría de baja no va a la grilla, va a la
        sección de bajas agrupado bajo su categoría. Así que con ?estado=
        quedan los de esos estados SIN categorías de baja, y si entre los
        estados está BAJA, también los que tienen una categoría de baja,
        sea cual sea su estado: con "Dados de baja" elegido la sección de
        abajo se esconde, y si no, no se verían en ningún lado. La grilla
        sin filtro de estado pide estado=ACTIVO.

        Sin ?estado= no se filtra por estado: son todos los productos, que
        es lo que necesitan los desplegables.
        """
        parametros = self.request.query_params

        texto = parametros.get('busqueda', '').strip()
        if texto:
            queryset = queryset.filter(nombre__icontains=texto)

        estados = parametros.getlist('estado')
        if estados:
            if any(estado not in Producto.Estado.values for estado in estados):
                raise ParseError('Uno de los estados no existe.')
            # Exists y no un filtro sobre categorias__estado: con un JOIN,
            # un producto con dos categorías de baja saldría dos veces.
            tiene_categoria_de_baja = Exists(
                Producto.categorias.through.objects.filter(
                    producto=OuterRef('pk'), categoria__estado=Categoria.Estado.BAJA,
                )
            )
            condicion = Q(estado__in=estados) & ~Q(tiene_categoria_de_baja)
            if Producto.Estado.BAJA in estados:
                condicion |= Q(tiene_categoria_de_baja)
            queryset = queryset.filter(condicion)

        categorias = parametros.getlist('categoria')
        if categorias:
            if not all(categoria.isdigit() for categoria in categorias):
                raise ParseError('Las categorías tienen que ser números.')
            queryset = queryset.filter(Exists(
                Producto.categorias.through.objects.filter(
                    producto=OuterRef('pk'), categoria_id__in=[int(c) for c in categorias],
                )
            ))

        dificultades = parametros.getlist('dificultad')
        if dificultades:
            if any(valor not in Producto.Dificultad.values for valor in dificultades):
                raise ParseError('Una de las dificultades no existe.')
            queryset = queryset.filter(dificultad__in=dificultades)

        tipos = parametros.getlist('tipo')
        if tipos:
            if any(tipo not in TIPOS for tipo in tipos):
                raise ParseError('El tipo tiene que ser personalizado o catalogo.')
            queryset = queryset.filter(es_personalizado__in=[TIPOS[tipo] for tipo in tipos])

        precio_desde = leer_importe(parametros, 'precio_desde')
        if precio_desde is not None:
            queryset = queryset.filter(precio_actual__gte=precio_desde)

        precio_hasta = leer_importe(parametros, 'precio_hasta')
        if precio_hasta is not None:
            queryset = queryset.filter(precio_actual__lte=precio_hasta)

        cuenta_categorias = (
            Producto.categorias.through.objects
            .filter(producto=OuterRef('pk'))
            .order_by()
            .values('producto')
            .annotate(cuenta=Count('id'))
            .values('cuenta')
        )
        queryset = queryset.annotate(
            orden_dificultad=Case(
                When(dificultad=Producto.Dificultad.BAJA, then=Value(0)),
                When(dificultad=Producto.Dificultad.MEDIA, then=Value(1)),
                default=Value(2),
            ),
            cantidad_categorias=Coalesce(Subquery(cuenta_categorias), 0),
        )
        # Sin orden elegido queda el del modelo, por nombre.
        return ordenar(queryset, parametros, ORDENES, ['nombre', 'id'])

    def describir_filtros(self, parametros):
        """Los filtros de _filtrar() en palabras, para el PDF y el Excel (corrección E10).

        Con los textos de los chips de la pantalla. No valida: exportar lo
        llama después de get_queryset(), que ya rechazó lo que no se entiende.
        """
        filtros = []

        texto = parametros.get('busqueda', '').strip()
        if texto:
            filtros.append(f'Búsqueda: {texto}')

        estados = parametros.getlist('estado')
        if estados:
            nombres = {Producto.Estado.ACTIVO: 'Activos', Producto.Estado.BAJA: 'Dados de baja'}
            filtros.append('Estado: ' + ', '.join(nombres[estado] for estado in estados))

        categorias = parametros.getlist('categoria')
        if categorias:
            nombres = Categoria.objects.filter(id__in=categorias).order_by('nombre').values_list('nombre', flat=True)
            filtros.append('Categoría: ' + ', '.join(nombres))

        dificultades = parametros.getlist('dificultad')
        if dificultades:
            filtros.append('Dificultad: ' + ', '.join(
                Producto.Dificultad(valor).label.lower() for valor in dificultades
            ))

        tipos = parametros.getlist('tipo')
        if tipos:
            nombres = {'personalizado': 'Personalizado', 'catalogo': 'En catálogo'}
            filtros.append('Tipo: ' + ', '.join(nombres[tipo] for tipo in tipos))

        rango = describir_rango(
            'Precio', leer_importe(parametros, 'precio_desde'), leer_importe(parametros, 'precio_hasta'),
        )
        if rango:
            filtros.append(rango)

        return filtros

    def registros_para_exportar(self):
        """Primero los de la grilla y después los de la sección de bajas, como en la pantalla.

        La grilla muestra los activos sin categorías de baja; abajo van los
        dados de baja y los que tienen una categoría de baja. sorted() no
        cambia de lugar dos del mismo grupo: queda el orden elegido.
        """
        registros = super().registros_para_exportar()
        return sorted(registros, key=lambda producto: not (
            producto.estado == Producto.Estado.ACTIVO and not producto.categorias_de_baja
        ))

    # -----------------------------------------------------------------
    # Los números del encabezado del listado
    # -----------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """La línea de arriba del listado y el rango del deslizador de precio. Es parte de CU18.

        Cuentan sobre TODOS los productos, no sobre los filtrados:

        - activos: los activos que están en la grilla, es decir, sin una
          categoría de baja (los otros van en la sección de abajo)
        - visibles_en_catalogo: los que hoy se ven en el catálogo público
        - precio_minimo y precio_maximo: los extremos del deslizador, que
          tienen que alcanzar a la pieza más barata y a la más cara
        - de_baja y por_categoria: los dos números del botón de la sección
          de dados de baja, que arranca cerrada; la lista se pide recién al
          abrirla (con ?estado=BAJA), así no demora la entrada

        Son cinco consultas, siempre las mismas.
        """
        tiene_categoria_de_baja = Exists(
            Producto.categorias.through.objects.filter(
                producto=OuterRef('pk'), categoria__estado=Categoria.Estado.BAJA,
            )
        )
        precios = Producto.objects.aggregate(minimo=Min('precio_actual'), maximo=Max('precio_actual'))

        datos = {
            'activos': Producto.objects.filter(estado=Producto.Estado.ACTIVO)
                                       .exclude(tiene_categoria_de_baja).count(),
            'de_baja': Producto.objects.filter(estado=Producto.Estado.BAJA).count(),
            'por_categoria': Producto.objects.filter(estado=Producto.Estado.ACTIVO)
                                             .filter(tiene_categoria_de_baja).count(),
            'visibles_en_catalogo': Producto.objects.visibles_en_catalogo().count(),
            # Sin productos, Min y Max devuelven None: cero.
            'precio_minimo': precios['minimo'] or Decimal('0'),
            'precio_maximo': precios['maximo'] or Decimal('0'),
        }

        return Response(ResumenDeProductosSerializer(datos).data)

    # -----------------------------------------------------------------
    # El alta y el guardado de la ficha: el producto con sus materiales,
    # fotos y categorías en un solo pedido a la API
    # -----------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        """CU17 - Registrar un producto, con sus materiales, fotos y categorías, en un solo pedido a la API.

        Además de los datos del producto, el cuerpo puede traer tres
        listas: 'materiales' ([{material, cantidad}]), 'categorias' ([id,
        id]) e 'imagenes' ([{archivo, titulo, tipo, orden}], donde
        'archivo' es el nombre del campo del multipart que trae la foto:
        foto_0, foto_1…). Como van fotos, el cuerpo es multipart y las
        listas llegan como texto JSON (ListasDelAltaDeProducto las parsea).
        Todo se guarda en la misma transacción (ATOMIC_REQUESTS): si una
        fila falla, la respuesta es 400 con la clave de su lista y el
        número de la fila, y no queda nada. Sin listas es el alta de
        siempre.

        Las fotos se validan TODAS antes de escribir nada (imagen real, 15
        MB y el achicado, en memoria): la transacción deshace las filas
        pero no sabe de archivos, así que lo que puede fallar por una foto
        tiene que fallar antes de guardarla. Y si algo falla después de
        escribir alguna (una categoría repetida, un error de la base), el
        except borra del disco las que se alcanzaron a guardar y relanza:
        la señal post_delete no interviene porque no hubo DELETE, y Django
        no tiene un on_rollback.

        Corrección del tutor: antes el frontend creaba el producto y
        después mandaba un pedido por material, foto y categoría. Las
        reglas de cada fila siguen en _asignar_material,
        _asignar_categoria e ImagenProductoCrearSerializer, los mismos que
        usan las acciones de a una fila.
        """
        listas = ListasDeHijosDeProducto(data=request.data)
        listas.is_valid(raise_exception=True)
        materiales = listas.validated_data.get('materiales', [])
        imagenes = listas.validated_data.get('imagenes', [])
        categorias = listas.validated_data.get('categorias', [])

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fotos = []
        for numero, datos in enumerate(imagenes, start=1):
            try:
                fotos.append(self._validar_foto(datos))
            except (ParseError, ValidationError) as error:
                raise error_de_fila('imagenes', numero, self._nombre_de_la_foto(datos), error)

        producto = serializer.save()
        guardadas = []

        # En el orden de los pasos del alta: materiales, fotos, categorías.
        try:
            for numero, datos in enumerate(materiales, start=1):
                try:
                    self._asignar_material(producto, datos)
                except (ParseError, ValidationError) as error:
                    raise error_de_fila('materiales', numero, self._nombre_del_material(datos), error)

            for foto in fotos:
                guardadas.append(foto.save(producto=producto).imagen)

            for numero, categoria_id in enumerate(categorias, start=1):
                try:
                    self._asignar_categoria(producto, categoria_id)
                except (ParseError, ValidationError) as error:
                    raise error_de_fila('categorias', numero, self._nombre_de_la_categoria(categoria_id), error)
        except Exception:
            for archivo in guardadas:
                archivo.storage.delete(archivo.name)
            raise

        return Response(self.get_serializer(producto).data, status=status.HTTP_201_CREATED)

    def _validar_foto(self, datos):
        """Un ImagenProductoCrearSerializer ya validado para una foto nueva, sin guardarla.

        'archivo' dice en qué campo del multipart viene la foto; 'titulo',
        'tipo' y 'orden' son opcionales, como en subir_imagen. Validar acá y
        guardar después es lo que deja validar todas las fotos antes de
        escribir la primera, en el alta y en el guardado de la ficha.
        """
        if not isinstance(datos, dict):
            raise ParseError('El cuerpo tiene que ser un objeto JSON.')

        clave = datos.get('archivo')

        if not isinstance(clave, str) or clave not in self.request.FILES:
            raise ParseError('Falta el archivo de la foto.')

        campos = {'imagen': self.request.FILES[clave]}
        for campo in ('titulo', 'tipo', 'orden'):
            if campo in datos:
                campos[campo] = datos[campo]

        serializer = ImagenProductoCrearSerializer(data=campos)
        serializer.is_valid(raise_exception=True)
        return serializer

    # Los tres nombres son para el mensaje de error ("Fila 2 (Porcelana): …"),
    # o '' si la fila no llegó a tener uno.

    @staticmethod
    def _nombre_del_material(datos):
        material_id = datos.get('material') if isinstance(datos, dict) else None

        if not isinstance(material_id, int):
            return ''

        return Material.objects.filter(pk=material_id).values_list('nombre', flat=True).first() or ''

    @staticmethod
    def _nombre_de_la_categoria(categoria_id):
        if not isinstance(categoria_id, int):
            return ''

        return Categoria.objects.filter(pk=categoria_id).values_list('nombre', flat=True).first() or ''

    def _nombre_de_la_foto(self, datos):
        """El nombre del archivo de una foto nueva, o el título de una guardada, o ''."""
        if not isinstance(datos, dict):
            return ''

        clave = datos.get('archivo')
        if isinstance(clave, str) and clave in self.request.FILES:
            return self.request.FILES[clave].name

        titulo = datos.get('titulo')
        return titulo if isinstance(titulo, str) else ''

    # -----------------------------------------------------------------
    # Sobreescribo update: un producto de baja no se modifica, y el
    # guardado de la ficha trae los hijos en el mismo pedido
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        """CU19 - Modificar un producto, con sus materiales, fotos y categorías, en un solo pedido a la API.

        Impide modificar un producto dado de baja: queda de solo lectura, y
        para volver a editarlo hay que reactivarlo primero. Cubre PUT y
        PATCH: DRF resuelve el PATCH llamando a update.

        Además de los datos, el cuerpo (multipart, como el alta) puede traer
        las tres listas COMPLETAS tal como quedaron en la ficha:
        'materiales' ([{id, material, cantidad}]), 'categorias' ([id, id]) e
        'imagenes' ([{id, archivo, titulo, tipo, orden}]: las guardadas con
        su id, las nuevas con el campo del multipart que trae la foto).
        Cada lista se compara con lo guardado y se quita, modifica y agrega
        lo que haga falta, en la misma transacción que los datos
        (ATOMIC_REQUESTS): si una fila falla, 400 con la clave de su lista y
        el número de la fila, y el producto queda como estaba. Una lista que
        no viene no se toca; sin listas es el PUT de siempre.

        Con los archivos, lo mismo que en create(): las fotos nuevas se
        validan todas antes de escribir nada, y si algo falla después de
        guardar alguna se borran del disco. Las guardadas que no vienen se
        borran de la base acá, y su archivo lo borra la señal post_delete
        recién al confirmar: si la transacción revierte, la fila vuelve y
        el archivo sigue estando.

        Corrección del tutor: antes la ficha mandaba el PUT de los datos y
        después un pedido por material, foto y categoría, y un fallo a
        mitad dejaba lo anterior guardado.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        listas = ListasDeHijosDeProducto(data=request.data)
        listas.is_valid(raise_exception=True)
        materiales = listas.validated_data.get('materiales')
        imagenes = listas.validated_data.get('imagenes')
        categorias = listas.validated_data.get('categorias')

        serializer = self.get_serializer(producto, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)

        # Las fotos nuevas, validadas antes de escribir nada, por número de
        # fila: _sincronizar_imagenes las guarda cuando llega a esa fila.
        fotos_nuevas = {}
        for numero, datos in enumerate(imagenes or [], start=1):
            if es_fila_nueva(datos):
                try:
                    fotos_nuevas[numero] = self._validar_foto(datos)
                except (ParseError, ValidationError) as error:
                    raise error_de_fila('imagenes', numero, self._nombre_de_la_foto(datos), error)

        serializer.save()

        # Lo que trajo el prefetch de get_object() quedó atrás de las
        # escrituras: se vacía para que las comparaciones lean la base.
        producto.refresh_from_db()

        escritas = []
        try:
            if materiales is not None:
                self._sincronizar_materiales(producto, materiales)

            if imagenes is not None:
                self._sincronizar_imagenes(producto, imagenes, fotos_nuevas, escritas)

            if categorias is not None:
                self._sincronizar_categorias(producto, categorias)
        except Exception:
            for archivo in escritas:
                archivo.storage.delete(archivo.name)
            raise

        return Response(self.get_serializer(producto).data)

    def _sincronizar_materiales(self, producto, lineas):
        """Deja los materiales del producto como dice la lista completa de la ficha.

        La línea guardada cuyo id no viene se quita; la que viene con el id
        de una guardada cambia su cantidad con _modificar_cantidad, como el
        PATCH; la nueva se agrega con _asignar_material. Un id que no es de
        este producto responde 400, como las acciones. Las quitadas van
        primero, así un material que se sacó y se volvió a agregar no cuenta
        como repetido. Un error en una fila sale con su número en la lista.
        """
        guardadas = {linea.pk: linea for linea in producto.materiales_usados.all()}
        conservadas = ids_que_vienen(lineas)

        for linea_id, linea in guardadas.items():
            if linea_id not in conservadas:
                linea.delete()

        for numero, datos in enumerate(lineas, start=1):
            try:
                if es_fila_nueva(datos):
                    self._asignar_material(producto, datos)
                else:
                    guardada = fila_guardada(datos, guardadas)
                    if guardada is None:
                        raise ParseError('Esa línea no pertenece a los materiales de este producto.')
                    self._modificar_cantidad(guardada, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('materiales', numero, self._nombre_del_material(datos), error)

    def _sincronizar_imagenes(self, producto, filas, fotos_nuevas, escritas):
        """Deja las fotos del producto como dice la lista completa de la ficha.

        La guardada cuyo id no viene se borra (su archivo lo borra la señal
        post_delete al confirmar); la que viene con el id de una guardada
        cambia título, tipo u orden con _modificar_imagen, como el PATCH; la
        nueva se guarda con el serializer que update() ya validó para esa
        fila (fotos_nuevas, por número), y su archivo se anota en escritas
        para que update() lo borre del disco si algo falla después. Un id
        que no es de este producto responde 400, como las acciones.
        """
        guardadas = {imagen.pk: imagen for imagen in producto.imagenes.all()}
        conservadas = ids_que_vienen(filas)

        for imagen_id, imagen in guardadas.items():
            if imagen_id not in conservadas:
                imagen.delete()

        for numero, datos in enumerate(filas, start=1):
            try:
                if numero in fotos_nuevas:
                    escritas.append(fotos_nuevas[numero].save(producto=producto).imagen)
                else:
                    guardada = fila_guardada(datos, guardadas)
                    if guardada is None:
                        raise ParseError('Esa imagen no pertenece a este producto.')
                    self._modificar_imagen(guardada, datos)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('imagenes', numero, self._nombre_de_la_foto(datos), error)

    def _sincronizar_categorias(self, producto, ids):
        """Deja las categorías del producto como dice la lista completa de ids de la ficha.

        La guardada cuyo id no viene se quita; la que ya está se deja; la
        que no estaba se asigna con _asignar_categoria, que rechaza un id
        que no existe. Un error en una fila sale con su número en la lista.
        """
        guardadas = {categoria.pk: categoria for categoria in producto.categorias.all()}

        for categoria_id, categoria in guardadas.items():
            if categoria_id not in ids:
                producto.categorias.remove(categoria)

        for numero, categoria_id in enumerate(ids, start=1):
            if isinstance(categoria_id, int) and categoria_id in guardadas:
                continue
            try:
                self._asignar_categoria(producto, categoria_id)
            except (ParseError, ValidationError) as error:
                raise error_de_fila('categorias', numero, self._nombre_de_la_categoria(categoria_id), error)

    # -----------------------------------------------------------------
    # Sobreescribo destroy, para explicar por qué no se puede eliminar
    # -----------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        """Impide eliminar un producto que figura en algún pedido.

        La clave foránea de ProductoDelPedido es PROTECT, así que la base
        rechaza el borrado igual. Pero sin este chequeo la excepción sale
        como un 500 con el traceback, y quien está del otro lado no se
        entera de por qué falló ni en cuántos pedidos está la pieza.

        Es la misma salvaguarda que ya tenían los materiales, y por el
        mismo motivo: eliminar el producto borraría lo que el cliente
        encargó de los pedidos donde aparece.
        """
        producto = self.get_object()

        # Acá sí corresponde .count(): es un solo producto y no hay
        # ningún prefetch que respetar, así que conviene una consulta que
        # devuelve un número antes que traerse las filas para contarlas
        # en Python.
        # Pedidos DISTINTOS: el mismo producto puede figurar dos veces en un
        # pedido (otra variante u otro precio), y eso es un solo pedido.
        cantidad = producto.en_pedidos.values('pedido').distinct().count()

        if cantidad > 0:
            en_pedidos = '1 pedido' if cantidad == 1 else f'{cantidad} pedidos'

            return Response(
                {'detail': f'No se puede eliminar «{producto.nombre}» porque está '
                           f'en {en_pedidos}. Si ya no lo hacés más, dalo de baja.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)

    # -----------------------------------------------------------------
    # Casos de uso además del CRUD (CU20 a CU24)
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def dar_de_baja(self, request, pk=None):
        """CU20 - Dar de baja un producto.

        Baja lógica: el registro se conserva y solo cambia su estado. Se
        retira del catálogo público y queda de solo lectura, pero sigue
        referenciado en los pedidos anteriores.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto ya está dado de baja.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.estado = Producto.Estado.BAJA
        producto.save(update_fields=['estado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        """CU21 - Reactivar un producto dado de baja.

        Se permite aunque el producto esté de baja: es la única vía para
        devolverlo a estado editable.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.ACTIVO:
            return Response(
                {'detail': 'El producto ya está activo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.estado = Producto.Estado.ACTIVO
        producto.save(update_fields=['estado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def publicar(self, request, pk=None):
        """CU23 - Dejar de tratar el producto como pedido personalizado.

        Un producto personalizado es un encargo puntual de un cliente y
        nunca se muestra en el catálogo. Publicarlo lo convierte en una
        pieza del catálogo general.

        No alcanza con esto para que se vea: la regla del catálogo pide
        además que el producto esté activo y que ninguna de sus
        categorías esté de baja. Por eso se rechaza publicar un producto
        dado de baja, que quedaría igual de invisible.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo antes de publicarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not producto.es_personalizado:
            return Response(
                {'detail': 'El producto ya no es un pedido personalizado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.es_personalizado = False
        producto.save(update_fields=['es_personalizado'])

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['post'])
    def quitar_del_catalogo(self, request, pk=None):
        """CU24 - Marcar el producto como pedido personalizado.

        Lo saca del catálogo público sin darlo de baja: la pieza se
        sigue gestionando normalmente, pero deja de ofrecerse a los
        clientes.

        No mira el estado: marcarlo como personalizado es igual de
        válido esté activo o de baja.
        """
        producto = self.get_object()

        if producto.es_personalizado:
            return Response(
                {'detail': 'El producto ya es un pedido personalizado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.es_personalizado = True
        producto.save(update_fields=['es_personalizado'])

        return Response(self.get_serializer(producto).data)


    # -----------------------------------------------------------------
    # Las categorías del producto (CU25 a CU27)
    # -----------------------------------------------------------------
    # Las categorías de un producto son una colección que cuelga de él,
    # así que las tres operaciones son las tres operaciones normales
    # sobre una colección, sobre la misma URL base:
    #
    #   GET    /api/productos/1/categorias/     lista        (CU26)
    #   POST   /api/productos/1/categorias/     agrega una   (CU25)
    #   DELETE /api/productos/1/categorias/5/   borra esa    (CU27)
    #
    # El id del DELETE va en la URL y no en el cuerpo: así la ruta
    # nombra exactamente el recurso que se borra, que es para lo que
    # sirve una URL. Un DELETE con cuerpo es legal pero varios
    # intermediarios lo descartan.

    @action(detail=True, methods=['get'], url_path='categorias')
    def categorias(self, request, pk=None):
        """CU26 - Listar las categorías de un producto.

        No mira el estado del producto: consultar uno dado de baja está
        permitido, lo que no se permite es modificarlo.
        """
        producto = self.get_object()

        return Response(
            CategoriaSerializer(producto.categorias.all(), many=True).data
        )

    def _asignar_categoria(self, producto, categoria_id):
        """Asigna una categoría al producto con las reglas de CU25.

        Es la única puerta para asignar una categoría: la usan
        asignar_categoria (una por pedido a la API) y create() (todas las
        del alta, en una transacción). Rechaza con ParseError y no con una
        respuesta: es lo que hace que la transacción revierta
        (ATOMIC_REQUESTS), y la respuesta es la misma, {'detail': …}.

        Se permite asignar una categoría dada de baja: el producto
        simplemente queda fuera del catálogo mientras eso dure. La
        visibilidad se evalúa al consultar, nunca se propaga por
        escritura.
        """
        if not categoria_id:
            raise ParseError('Falta el id de la categoría.')

        try:
            categoria = Categoria.objects.get(pk=categoria_id)
        # TypeError: el id llegó como lista u objeto JSON, y Django no lo
        # convierte a número.
        except (Categoria.DoesNotExist, ValueError, TypeError):
            raise ParseError('No existe una categoría con ese id.')

        # En Python y no con .filter().exists(): desde la acción,
        # get_object() ya trajo las categorías con el prefetch, y un
        # .filter() encima armaría una consulta nueva que ignora lo ya
        # traído. Desde el alta no hay prefetch y esta misma línea consulta
        # la base, que es lo que detecta una repetida dentro del mismo cuerpo.
        if categoria in producto.categorias.all():
            raise ParseError(
                f'El producto ya tiene asignada la categoría «{categoria.nombre}».'
            )

        producto.categorias.add(categoria)

    # El mapping le dice al router: misma URL que 'categorias', pero
    # cuando el método sea POST, ejecutá esta otra función. Así cada
    # caso de uso queda en su propio método, sin un if adentro.
    @categorias.mapping.post
    def asignar_categoria(self, request, pk=None):
        """CU25 - Asignar una categoría al producto.

        El id de la categoría llega en el cuerpo, en la clave
        'categoria'. Las reglas están en _asignar_categoria, que comparte
        con el alta.
        """
        producto = self.get_object()

        # El estado va primero porque es la regla más general: si el
        # producto es de solo lectura, no importa qué id mandaron.
        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus categorías.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._asignar_categoria(producto, request.data.get('categoria'))

        # add() escribió en la base, pero las categorías que trajo el
        # prefetch siguen cacheadas en memoria, sin la recién agregada.
        # refresh_from_db() vacía esa caché, así el serializer recalcula
        # visible_en_catalogo y compañía contra la base.
        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)


    @action(detail=True, methods=['delete'], url_path=r'categorias/(?P<categoria_id>\d+)')
    def quitar_categoria(self, request, pk=None, categoria_id=None):
        """CU27 - Quitar una categoría del producto.

        Borra solo la fila de la tabla intermedia: ni el producto ni la
        categoría se tocan. Si el producto queda sin categorías, pasa a
        depender solo de su propio estado.

        El \\d+ del url_path restringe el id a dígitos, así que una URL
        con letras no coincide con ninguna ruta y Django devuelve 404
        sin entrar acá.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus categorías.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            categoria = Categoria.objects.get(pk=categoria_id)
        except Categoria.DoesNotExist:
            return Response(
                {'detail': 'No existe una categoría con ese id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if categoria not in producto.categorias.all():
            return Response(
                {'detail': f'El producto no tiene asignada la categoría '
                           f'«{categoria.nombre}».'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.categorias.remove(categoria)
        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)



    # -----------------------------------------------------------------
    # Los materiales del producto (CU28 a CU31)
    # -----------------------------------------------------------------
    # Misma forma que las categorías, con una diferencia importante: el
    # id de la ruta es el de la LÍNEA (MaterialProducto), no el del
    # material.
    #
    #   GET    /api/productos/1/materiales/     lista            (CU29)
    #   POST   /api/productos/1/materiales/     agrega una línea (CU28)
    #   PATCH  /api/productos/1/materiales/3/   cambia cantidad  (CU30)
    #   DELETE /api/productos/1/materiales/3/   quita la línea   (CU31)
    #
    # Se usa el id de la línea y no el del material porque la línea es
    # la que tiene la cantidad, que es lo único editable.

    def _buscar_linea_de_materiales(self, producto, linea_id):
        """Busca una línea ENTRE LAS DE ESTE PRODUCTO, o devuelve None.

        Recorre producto.materiales_usados, que get_object() ya trajo
        con el prefetch. Buscar dentro de esa lista, y no en
        MaterialProducto.objects, es lo que garantiza que la línea sea
        de este producto: una línea ajena directamente no está en la
        lista. Sin eso, mandando un id cualquiera se podrían editar los
        materiales de otro producto.

        El \\d+ del url_path ya garantizó que linea_id sean dígitos, así
        que el int() no puede fallar.
        """
        for linea in producto.materiales_usados.all():
            if linea.pk == int(linea_id):
                return linea

        return None



    @action(detail=True, methods=['get'], url_path='materiales')
    def materiales(self, request, pk=None):
        """CU29 - Listar los materiales de un producto.

        Devuelve las líneas con el nombre y el estado de cada material,
        para que la pantalla pueda marcar los discontinuados.

        No mira el estado del producto: consultar uno dado de baja está
        permitido.
        """
        producto = self.get_object()

        return Response(
            MaterialProductoSerializer(
                producto.materiales_usados.all(), many=True
            ).data
        )



    def _asignar_material(self, producto, datos):
        """Crea una línea de MaterialProducto con las reglas de CU28 y la devuelve.

        Es la única puerta para agregar un material: la usan
        asignar_material (una línea por pedido a la API) y create() (todas
        las del alta, en una transacción). Rechaza con ParseError y no con
        una respuesta: es lo que hace que la transacción revierta
        (ATOMIC_REQUESTS), y la respuesta es la misma, {'detail': …}.

        En datos llegan 'material' (el id) y 'cantidad' (texto libre,
        opcional: "dos gotas", "media plancha").

        Se permite agregar un material discontinuado: los materiales
        del producto son el registro de cómo se hace la pieza, y la
        propiedad materiales_discontinuados es la que después avisa.
        """
        # Un cuerpo que no sea un objeto JSON (una lista, por ejemplo) no
        # tiene .get(): se rechaza con 400 en vez de dejar que explote en 500.
        if not isinstance(datos, dict):
            raise ParseError('El cuerpo tiene que ser un objeto JSON.')

        material_id = datos.get('material')

        if not material_id:
            raise ParseError('Falta el id del material.')

        try:
            material = Material.objects.get(pk=material_id)
        # TypeError: el id llegó como lista u objeto JSON, y Django no lo
        # convierte a número.
        except (Material.DoesNotExist, ValueError, TypeError):
            raise ParseError('No existe un material con ese id.')

        # Este chequeo es el que evita el IntegrityError crudo del
        # UniqueConstraint (producto, material). Sin él, PostgreSQL
        # rechaza la fila, Django levanta la excepción y el frontend
        # recibe un 500 en vez de un mensaje que se pueda mostrar. Desde el
        # alta no hay prefetch y la línea consulta la base: así detecta un
        # material repetido dentro del mismo cuerpo.
        if material in producto.materiales.all():
            raise ParseError(
                f'El producto ya tiene «{material.nombre}» entre sus materiales.'
            )

        # Se guarda con el serializer y no con .objects.create(), para que
        # la cantidad pase por la validación del modelo (texto de hasta 50
        # caracteres): sin eso, una más larga la rechaza PostgreSQL y el
        # frontend recibe un 500 en vez de un mensaje.
        serializer = MaterialProductoSerializer(data={
            'material': material.pk,
            'cantidad': datos.get('cantidad') or '',
        })
        serializer.is_valid(raise_exception=True)
        return serializer.save(producto=producto)

    @materiales.mapping.post
    def asignar_material(self, request, pk=None):
        """CU28 - Agregar un material al producto.

        En el cuerpo llegan 'material' (el id) y 'cantidad'. Las reglas
        están en _asignar_material, que comparte con el alta.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._asignar_material(producto, request.data)

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)



    def _modificar_cantidad(self, linea, datos):
        """Cambia la cantidad de una línea de materiales con las reglas de CU30 y la devuelve.

        Es la única puerta para modificar una línea: la usan
        modificar_cantidad (el PATCH de una) y _sincronizar_materiales (el
        guardado de la ficha). Rechaza con ParseError, como las demás.
        """
        # Se exige que la clave venga, aunque su valor pueda ser vacío:
        # mandar un PATCH sin 'cantidad' es un error de quien llama, no
        # una forma de borrar la cantidad.
        if 'cantidad' not in datos:
            raise ParseError('Falta la cantidad.')

        # Igual que al asignar: por el serializer, con partial=True porque
        # solo viaja la cantidad, así la valida el modelo y no la base.
        serializer = MaterialProductoSerializer(
            linea,
            data={'cantidad': datos.get('cantidad') or ''},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    @action(detail=True, methods=['patch'],
            url_path=r'materiales/(?P<linea_id>\d+)')
    def modificar_cantidad(self, request, pk=None, linea_id=None):
        """CU30 - Cambiar la cantidad de una línea de materiales.

        Solo se cambia la cantidad. El material de una línea no se
        cambia: se quita la línea y se agrega otra, porque cambiarlo
        serían otros materiales. Las reglas están en _modificar_cantidad,
        que comparte con el guardado de la ficha.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea = self._buscar_linea_de_materiales(producto, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Esa línea no pertenece a los materiales de este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._modificar_cantidad(linea, request.data)

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)



    @modificar_cantidad.mapping.delete
    def quitar_material(self, request, pk=None, linea_id=None):
        """CU31 - Quitar un material del producto.

        Borra la línea, no el material: el material sigue existiendo y
        puede estar entre los materiales de otros productos. Es lo
        que protege el PROTECT de la clave foránea.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus materiales.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea = self._buscar_linea_de_materiales(producto, linea_id)

        if linea is None:
            return Response(
                {'detail': 'Esa línea no pertenece a los materiales de este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linea.delete()

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    # -----------------------------------------------------------------
    # Las imágenes del producto (CU32 a CU35)
    # -----------------------------------------------------------------
    # Misma forma que las otras dos colecciones:
    #
    #   GET    /api/productos/1/imagenes/     lista           (CU33)
    #   POST   /api/productos/1/imagenes/     sube una        (CU32)
    #   PATCH  /api/productos/1/imagenes/3/   edita los datos (CU34)
    #   DELETE /api/productos/1/imagenes/3/   la borra        (CU35)
    #
    # El POST es el único endpoint de todo el ViewSet que no recibe
    # JSON: el archivo llega como multipart/form-data, por eso los
    # parser_classes de más arriba.

    def _buscar_imagen_del_producto(self, producto, imagen_id):
        """Busca una imagen ENTRE LAS DE ESTE PRODUCTO, o devuelve None.

        Mismo criterio que el buscador de materiales: recorre
        producto.imagenes, que get_object() ya trajo con el prefetch.
        Buscar dentro de esa lista es lo que garantiza que la imagen sea
        de este producto y no de otro.
        """
        for imagen in producto.imagenes.all():
            if imagen.pk == int(imagen_id):
                return imagen

        return None

    @action(detail=True, methods=['get'], url_path='imagenes')
    def imagenes(self, request, pk=None):
        """CU33 - Listar las imágenes de un producto.

        Vienen ordenadas por el campo orden, así que la primera de la
        lista es la principal.

        No mira el estado del producto: consultar uno dado de baja está
        permitido.
        """
        producto = self.get_object()

        return Response(
            ImagenProductoSerializer(producto.imagenes.all(), many=True).data
        )

    @imagenes.mapping.post
    def subir_imagen(self, request, pk=None):
        """CU32 - Subir una imagen a un producto.

        El archivo llega en 'imagen' y es obligatorio. 'titulo', 'tipo'
        y 'orden' son opcionales.

        Se usa ImagenProductoCrearSerializer y no el de lectura, porque
        este tiene el ImageField de verdad: valida que sea una imagen y
        que no pase de 15 MB, y guarda el archivo en media/productos/.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ImagenProductoCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # El producto no viene en el cuerpo: sale de la URL, y se lo
        # pasamos acá para que nadie pueda subirle una imagen a otro
        # producto mandándolo en el formulario.
        serializer.save(producto=producto)

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    def _modificar_imagen(self, imagen, datos):
        """Cambia el título, el tipo o el orden de una imagen con las reglas de CU34 y la devuelve.

        Es la única puerta para modificar una imagen: la usan
        modificar_imagen (el PATCH de una) y _sincronizar_imagenes (el
        guardado de la ficha). El archivo no se cambia: para eso se borra
        la imagen y se sube otra. La garantía es estructural, porque
        ImagenProductoModificarSerializer no tiene el campo del archivo.
        """
        serializer = ImagenProductoModificarSerializer(
            imagen,
            data=datos,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    @action(detail=True, methods=['patch'],
            url_path=r'imagenes/(?P<imagen_id>\d+)')
    def modificar_imagen(self, request, pk=None, imagen_id=None):
        """CU34 - Cambiar el título, el tipo o el orden de una imagen.

        Las reglas están en _modificar_imagen, que comparte con el guardado
        de la ficha.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen = self._buscar_imagen_del_producto(producto, imagen_id)

        if imagen is None:
            return Response(
                {'detail': 'Esa imagen no pertenece a este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._modificar_imagen(imagen, request.data)

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)

    @modificar_imagen.mapping.delete
    def borrar_imagen(self, request, pk=None, imagen_id=None):
        """CU35 - Borrar una imagen de un producto.

        Si era la principal, pasa a serlo la siguiente por orden.

        El archivo del disco lo borra la señal post_delete que conecta
        productos/apps.py (config/limpieza_archivos.py), recién cuando la
        transacción confirma.
        """
        producto = self.get_object()

        if producto.estado == Producto.Estado.BAJA:
            return Response(
                {'detail': 'El producto está dado de baja. '
                           'Reactivalo para poder modificar sus imágenes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen = self._buscar_imagen_del_producto(producto, imagen_id)

        if imagen is None:
            return Response(
                {'detail': 'Esa imagen no pertenece a este producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        imagen.delete()

        producto.refresh_from_db()

        return Response(self.get_serializer(producto).data)
