from rest_framework import status
from rest_framework.test import APIClient

from pruebas.base import PruebaConSesion
from productos.models import Producto

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

    def test_dar_de_baja_una_categoria_dada_de_baja_da_400(self):
        """CU14: la baja lógica no se aplica dos veces."""
        categoria = Categoria.objects.create(nombre='Aros', estado=Categoria.Estado.BAJA)
        respuesta = self.client.post(f'{LISTA}{categoria.id}/dar_de_baja/')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'La categoría ya está dada de baja.')


class EliminarCategoria(PruebaConSesion):
    """Eliminar una categoría borra solo sus asociaciones, no sus productos (CU16)."""

    def test_eliminar_una_categoria_no_elimina_sus_productos(self):
        """CU16: después del DELETE el producto sigue, sin esa categoría, y visible en el catálogo."""
        categoria = Categoria.objects.create(nombre='Aros')
        producto = Producto.objects.create(
            nombre='Aros Hedwig', precio_actual='1500.00',
            dificultad=Producto.Dificultad.MEDIA,
        )
        producto.categorias.add(categoria)

        respuesta = self.client.delete(f'{LISTA}{categoria.id}/')
        self.assertEqual(respuesta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Categoria.objects.filter(pk=categoria.pk).exists())

        producto.refresh_from_db()
        self.assertEqual(producto.categorias.count(), 0)

        visitante = APIClient()
        visibles = [p['id'] for p in visitante.get('/api/catalogo/productos/').data]
        self.assertIn(producto.id, visibles)


class BusquedaEnLaBase(PruebaConSesion):
    """El buscador de categorías consulta a la base (CU12, corrección D3)."""

    def test_busca_por_nombre_o_descripcion_sin_paginar(self):
        """CU12: ?busqueda= encuentra por nombre y por descripción, y la respuesta es la lista entera, sin páginas."""
        aros = Categoria.objects.create(nombre='Aros', tipo=Categoria.Tipo.TIPO)
        harry = Categoria.objects.create(
            nombre='Harry Potter', tipo=Categoria.Tipo.TEMATICA, descripcion='Hogwarts y sus casas',
        )

        respuesta = self.client.get(LISTA, {'busqueda': 'hogwarts'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual([c['id'] for c in respuesta.data], [harry.id])

        respuesta = self.client.get(LISTA, {'busqueda': 'aro'})
        self.assertEqual([c['id'] for c in respuesta.data], [aros.id])
