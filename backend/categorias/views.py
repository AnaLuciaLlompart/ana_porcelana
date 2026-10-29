from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Categoria
from .serializers import CategoriaSerializer

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model, verifica permisos

class CategoriaViewSet(viewsets.ModelViewSet):
    """CRUD de categorías (CU11 a CU16).

    Devuelve todas las categorías, activas y de baja. La separación
    visual entre ambos grupos se resuelve en el frontend.

    """

    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

    # La búsqueda se hace en la base (corrección D3), pero el listado no se
    # pagina: son pocas decenas, repartidas en dos secciones de tarjetas y
    # la de las dadas de baja, y partir cada sección en páginas no ayuda a
    # leerlas (decidido por la usuaria). Reemplaza al SearchFilter de DRF.
    def get_queryset(self):
        """En el listado, la búsqueda de la URL (CU12): ?busqueda= en el nombre o la descripción."""
        queryset = super().get_queryset()

        texto = self.request.query_params.get('busqueda', '').strip()
        if self.action == 'list' and texto:
            queryset = queryset.filter(Q(nombre__icontains=texto) | Q(descripcion__icontains=texto))

        return queryset

    # -----------------------------------------------------------------
    # Sobreescribo update, ya que no puedo modificar categorias dadas de baja
    # -----------------------------------------------------------------

    def update(self, request, *args, **kwargs):
        categoria = self.get_object()

        if categoria.estado == Categoria.Estado.BAJA:
            return Response(
                {'detail': 'La categoría está dada de baja. '
                           'Reactivala para poder modificarla.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(request, *args, **kwargs)

    # -----------------------------------------------------------------
    # Casos de uso además del CRUD
    # -----------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def dar_de_baja(self, request, pk=None):
        """CU14 - Dar de baja una categoría.

        Retira del catálogo público todos sus productos, incluso los
        que pertenezcan además a otras categorías activas. No modifica
        el estado de los productos: la visibilidad se evalúa al
        consultar, por lo que la operación es reversible.
        """
        categoria = self.get_object()

        if categoria.estado == Categoria.Estado.BAJA:
            return Response(
                {'detail': 'La categoría ya está dada de baja.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        categoria.estado = Categoria.Estado.BAJA
        categoria.save(update_fields=['estado'])

        return Response(self.get_serializer(categoria).data)


    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        """CU15 - Reactivar una categoría.

        Sus productos vuelven al catálogo exactamente como estaban,
        ya que nunca se modificó su estado.
        """
        categoria = self.get_object()

        if categoria.estado == Categoria.Estado.ACTIVO:
            return Response(
                {'detail': 'La categoría ya está activa.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        categoria.estado = Categoria.Estado.ACTIVO
        categoria.save(update_fields=['estado'])

        return Response(self.get_serializer(categoria).data)