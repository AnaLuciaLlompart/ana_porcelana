from rest_framework.pagination import PageNumberPagination


class PaginacionDeListado(PageNumberPagination):
    """La paginación de los listados de la gestión (corrección D3 del tutor).

    Con ?pagina=, el listado devuelve una página en vez de todos los
    registros: { count, next, previous, results }. count es cuántos hay en
    total con los filtros puestos, y results las filas de esta página.

    Sin ?pagina= devuelve la lista entera, como antes. La piden así los
    desplegables de los formularios (el cliente y los productos de un
    pedido, los materiales de un gasto, las categorías de un producto), que
    necesitan todas las opciones para buscar adentro. La pantalla de cada
    listado siempre manda ?pagina=.

    Los nombres de los parámetros van en castellano, como los demás de la
    API: ?pagina=2&por_pagina=24. Las filas por página son las tres del
    selector de la pantalla (12, 24 y 48); max_page_size frena un
    por_pagina=100000 escrito a mano. Una página que no existe responde
    404, que es lo que hace DRF.
    """

    page_size = 12
    page_query_param = 'pagina'
    page_size_query_param = 'por_pagina'
    max_page_size = 48

    def paginate_queryset(self, queryset, request, view=None):
        """Pagina solo si el pedido trae ?pagina=; si no, None, que para DRF es "sin paginar"."""
        if self.page_query_param not in request.query_params:
            return None

        return super().paginate_queryset(queryset, request, view)
