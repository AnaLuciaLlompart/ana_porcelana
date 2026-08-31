from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Material
from .serializers import MaterialSerializer

# Views: aplica las reglas de negocio, verifica permisos, orquesta el serializer y model, verifica permisos

class MaterialViewSet(viewsets.ModelViewSet): # ModelViewSet es la clase que ya cuenta con las operaciones del CRUD: listar, ver uno, crear, modificar y eliminar
    """CRUD de materiales (CU04 a CU10).

    Hereda IsAuthenticated de la configuración global de DRF, por lo
    que todos los endpoints exigen sesión activa.

    Devuelve todos los materiales, activos y discontinuados. La
    separación visual entre ambos grupos se resuelve en el frontend,
    dado el volumen acotado de registros.
    """

    queryset = Material.objects.all()
    serializer_class = MaterialSerializer 

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'descripcion']
    ordering_fields = ['nombre', 'disponibilidad', 'estado']


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

