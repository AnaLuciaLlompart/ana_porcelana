from django.apps import AppConfig


class PruebasConfig(AppConfig):
    """La app de todo lo relacionado con pruebas.

    No es una funcionalidad del sistema: no tiene modelos, vistas ni
    urls. Tiene la base compartida de los tests.py de todas las apps
    (base.py), el listado de pruebas (PRUEBAS.md) y los management
    commands de administración (management/commands/). Está en
    INSTALLED_APPS porque Django solo busca comandos en apps instaladas.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pruebas'
    verbose_name = 'pruebas'
