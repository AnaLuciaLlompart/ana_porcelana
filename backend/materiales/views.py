from django.db.models import Case, Q, Value, When
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from config.exportar import Columna, ExportarMixin
from config.listados import ordenar
from config.paginacion import PaginacionDeListado
from productos.models import Producto

from .models import Material
from .serializers import MaterialSerializer


# Las columnas por las que se puede ordenar el listado (?orden=nombre, o
# ?orden=-nombre para al revés). Disponibilidad y estado van en su orden
# lógico y no en el alfabético: Alta, Media, Baja; Activo, Discontinuado.
ORDENES = {
    'nombre': ['nombre'],
    'disponibilidad': ['orden_disponibilidad'],
    'estado': ['orden_estado'],
}

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model, verifica permisos

class MaterialViewSet(ExportarMixin, viewsets.ModelViewSet): # ModelViewSet es la clase que ya cuenta con las operaciones del CRUD: listar, ver uno, crear, modificar y eliminar
    """CRUD de materiales (CU04 a CU10).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    Devuelve todos los materiales, activos y discontinuados. La
    separación visual entre ambos grupos se resuelve en el frontend,
    dado el volumen acotado de registros.
    """

    queryset = Material.objects.all()
    serializer_class = MaterialSerializer

    # El listado se pagina con ?pagina= (corrección D3), con los filtros y
    # el orden resueltos en la base por _filtrar(). Sin ?pagina= sigue
    # devolviendo todos: así lo piden los desplegables de materiales de un
    # producto y de un gasto. Reemplaza al SearchFilter y al OrderingFilter.
    pagination_class = PaginacionDeListado

    # Lo que necesita ExportarMixin para /exportar/ (corrección E10).
    EXPORTAR_TITULO = 'Materiales'
    EXPORTAR_ARCHIVO = 'materiales'
    EXPORTAR_UNIDAD = ('material', 'materiales')
    COLUMNAS_PARA_EXPORTAR = [
        Columna('Material', lambda m: m.nombre, 'texto', 14),
        Columna('Descripción', lambda m: m.descripcion, 'texto', 24),
        Columna('Disponibilidad', lambda m: m.get_disponibilidad_display(), 'texto', 10),
        Columna('Estado', lambda m: m.get_estado_display(), 'texto', 8),
    ]

    def get_queryset(self):
        """En el listado, los filtros y el orden de la URL; en lo demás, sin filtrar."""
        queryset = super().get_queryset()

        # Exportar trae lo mismo que el listado, con los mismos filtros.
        if self.action in ('list', 'exportar'):
            return self._filtrar(queryset)

        return queryset

    def _filtrar(self, queryset):
        """Aplica al listado los filtros, la búsqueda y el orden de la URL (CU05).

          busqueda=texto           nombre o descripción
          disponibilidad=BAJA      se puede repetir: cualquiera de las elegidas
          estado=ACTIVO            se puede repetir; la pantalla pide los
                                   activos para la lista y los discontinuados
                                   aparte, para su sección
          producto=id              los materiales que usa ese producto
          orden=nombre             una clave de ORDENES; con '-', al revés
        """
        parametros = self.request.query_params

        texto = parametros.get('busqueda', '').strip()
        if texto:
            queryset = queryset.filter(Q(nombre__icontains=texto) | Q(descripcion__icontains=texto))

        disponibilidades = parametros.getlist('disponibilidad')
        if disponibilidades:
            if any(valor not in Material.Disponibilidad.values for valor in disponibilidades):
                raise ParseError('Una de las disponibilidades no existe.')
            queryset = queryset.filter(disponibilidad__in=disponibilidades)

        estados = parametros.getlist('estado')
        if estados:
            if any(valor not in Material.Estado.values for valor in estados):
                raise ParseError('Uno de los estados no existe.')
            queryset = queryset.filter(estado__in=estados)

        producto = parametros.get('producto')
        if producto:
            if not producto.isdigit():
                raise ParseError('El producto tiene que ser un número.')
            # productos es la relación de muchos a muchos con Producto, a
            # través de MaterialProducto. Un material está una sola vez por
            # producto (la UniqueConstraint de MaterialProducto), así que el
            # JOIN no repite filas.
            queryset = queryset.filter(productos__id=int(producto))

        queryset = queryset.annotate(
            orden_disponibilidad=Case(
                When(disponibilidad=Material.Disponibilidad.ALTA, then=Value(0)),
                When(disponibilidad=Material.Disponibilidad.MEDIA, then=Value(1)),
                default=Value(2),
            ),
            orden_estado=Case(
                When(estado=Material.Estado.ACTIVO, then=Value(0)),
                default=Value(1),
            ),
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

        disponibilidades = parametros.getlist('disponibilidad')
        if disponibilidades:
            filtros.append('Disponibilidad: ' + ', '.join(
                Material.Disponibilidad(valor).label for valor in disponibilidades
            ))

        estados = parametros.getlist('estado')
        if estados:
            filtros.append('Estado: ' + ', '.join(Material.Estado(valor).label for valor in estados))

        producto = parametros.get('producto')
        if producto:
            nombre = Producto.objects.filter(id=producto).values_list('nombre', flat=True).first()
            filtros.append(f'Aparece en «{nombre}»' if nombre else f'Aparece en el producto #{producto}')

        return filtros

    def registros_para_exportar(self):
        """Los activos primero y los discontinuados después, como en la pantalla.

        sorted() no cambia de lugar dos registros con la misma clave, así
        que dentro de cada grupo queda el orden que eligió la pantalla.
        """
        registros = super().registros_para_exportar()
        return sorted(registros, key=lambda material: material.estado != Material.Estado.ACTIVO)


    # ----------------------------------------------------------------
    # Sobreescribo update, ya que no puedo modificar materiales discontinuados
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        """Impide modificar un material discontinuado.

        Un material discontinuado queda de solo lectura: sigue
        referenciado en productos y gastos anteriores, por lo que
        alterar su nombre o disponibilidad modificaría cómo se
        interpreta el historial. Para volver a editarlo hay que
        reactivarlo primero.

        Cubre PUT y PATCH: DRF resuelve el PATCH llamando a update. (PATCH es como PUT pero solo con las modificaciones)
        """
        material = self.get_object()

        if material.estado == Material.Estado.DISCONTINUADO:
            return Response(
                {'detail': 'El material está discontinuado. '
                           'Reactivalo para poder modificarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(request, *args, **kwargs)


    # -----------------------------------------------------------------
    # Sobreescribo destroy, para explicar por qué no se puede eliminar
    # -----------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        """Impide eliminar un material que algún producto usa o que figura en algún gasto.

        Las claves foráneas de MaterialProducto y de MaterialDelGasto son
        PROTECT, así que la base rechaza el borrado igual. Pero sin este
        chequeo la excepción sale como un 500 con el traceback, y quien
        está del otro lado no se entera de por qué falló ni en cuántos
        productos y gastos está el material.
        """
        material = self.get_object()

        # Acá sí corresponde .count(): es un solo material y no hay ningún
        # prefetch que respetar, así que conviene una consulta que devuelve
        # un número antes que traerse las filas para contarlas en Python.
        #
        # Se cuentan las dos claves foráneas con PROTECT que apuntan a
        # Material: los productos que lo llevan (MaterialProducto) y los
        # gastos en los que se compró (MaterialDelGasto). Cualquiera de las
        # dos hace que la base rechace el borrado.
        en_productos = material.usos.count()
        en_gastos = material.en_gastos.count()

        if en_productos > 0 or en_gastos > 0:
            # El mensaje nombra solo lo que corresponde: "está usado en 2
            # productos", "figura en 1 gasto", o las dos cosas unidas con
            # una "y".
            motivos = []

            if en_productos > 0:
                motivos.append(
                    'está usado en '
                    + ('1 producto' if en_productos == 1 else f'{en_productos} productos')
                )

            if en_gastos > 0:
                motivos.append(
                    'figura en '
                    + ('1 gasto' if en_gastos == 1 else f'{en_gastos} gastos')
                )

            return Response(
                {'detail': f'No se puede eliminar «{material.nombre}» porque '
                           f'{" y ".join(motivos)}. Si ya no lo conseguís o no '
                           f'lo querés usar más, discontinualo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)


    # -----------------------------------------------------------------
    # Acciones propias, además del CRUD (activar y desactivar)
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def discontinuar(self, request, pk=None):
        """CU09 - Dar de baja un material.

        Baja lógica: el registro se conserva y solo cambia su estado.
        Los materiales discontinuados siguen referenciados en productos
        y gastos anteriores, por lo que eliminarlos rompería el
        historial.
        """
        material = self.get_object()

        if material.estado == Material.Estado.DISCONTINUADO:
            return Response(
                {'detail': 'El material ya está discontinuado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material.estado = Material.Estado.DISCONTINUADO
        material.save(update_fields=['estado'])

        return Response(self.get_serializer(material).data)

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        """Vuelve a poner en uso un material discontinuado.

        Se permite aunque el material esté discontinuado: es la única
        vía para devolverlo a estado editable.
        """
        material = self.get_object()

        if material.estado == Material.Estado.ACTIVO:
            return Response(
                {'detail': 'El material ya está activo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material.estado = Material.Estado.ACTIVO
        material.save(update_fields=['estado'])

        return Response(self.get_serializer(material).data)

