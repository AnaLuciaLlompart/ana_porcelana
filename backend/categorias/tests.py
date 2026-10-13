from rest_framework import status

from config.pruebas import PruebaConSesion

from .models import Categoria

LISTA = '/api/categorias/'


class NombreDeCategoria(PruebaConSesion):
    """El nombre de la categoría es único (CU11)."""

    def test_nombre_repetido_da_400(self):
        """CU11: un nombre que ya existe responde 400 con el mensaje del modelo."""
        Categoria.objects.create(nombre='Aros')
        respuesta = self.client.post(LISTA, {'nombre': 'Aros', 'tipo': Categoria.Tipo.TIPO})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['nombre'], ['Ya existe una categoría con este nombre.'])
        self.assertEqual(Categoria.objects.count(), 1)


class CategoriaDadaDeBaja(PruebaConSesion):
    """Una categoría de baja queda de solo lectura (CU14)."""

    def test_editar_categoria_dada_de_baja_da_400(self):
        """CU13: PUT y PATCH sobre una categoría de baja responden 400 y no cambian nada."""
        categoria = Categoria.objects.create(nombre='Aros', estado=Categoria.Estado.BAJA)
        for metodo in ('put', 'patch'):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.client, metodo)(
                    f'{LISTA}{categoria.id}/', {'nombre': 'Aritos', 'tipo': Categoria.Tipo.TIPO},
                )
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(
                    respuesta.data['detail'],
                    'La categoría está dada de baja. Reactivala para poder modificarla.',
                )
        categoria.refresh_from_db()
        self.assertEqual(categoria.nombre, 'Aros')
