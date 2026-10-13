import os

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from categorias.models import Categoria
from clientes.models import Cliente
from config.pruebas import (
    USUARIA, PruebaConSesion, PruebaSinSesion, imagen_png, media_temporal,
)
from materiales.models import Material
from pedidos.models import Pedido, ProductoDelPedido

from .models import ImagenProducto, MaterialProducto, Producto

LISTA = '/api/productos/'


def crear_producto(nombre='Aros Hedwig', **campos):
    datos = {'precio_actual': '1500.00', 'dificultad': Producto.Dificultad.MEDIA}
    datos.update(campos)
    return Producto.objects.create(nombre=nombre, **datos)


@media_temporal
class SubirImagenSinSesion(PruebaSinSesion):
    """Subir una imagen es una escritura de gestión: exige sesión (CU32)."""

    def test_subir_imagen_sin_sesion_da_403_y_no_guarda_nada(self):
        """CU32: POST /api/productos/<id>/imagenes/ sin sesión responde 403, sin fila ni archivo."""
        producto = crear_producto()
        respuesta = self.client.post(
            f'{LISTA}{producto.id}/imagenes/',
            {'imagen': imagen_png(), 'tipo': ImagenProducto.Tipo.RESULTADO},
            format='multipart',
        )
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(ImagenProducto.objects.count(), 0)
        self.assertEqual(os.listdir(settings.MEDIA_ROOT), [])


class ProductoDadoDeBaja(PruebaConSesion):
    """Un producto de baja queda de solo lectura (CU20)."""

    def test_editar_producto_dado_de_baja_da_400(self):
        """CU19: PUT y PATCH sobre un producto de baja responden 400 y no cambian nada."""
        producto = crear_producto(estado=Producto.Estado.BAJA)
        datos = {'nombre': 'Otro', 'precio_actual': '2000.00',
                 'dificultad': Producto.Dificultad.ALTA}
        for metodo in ('put', 'patch'):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.client, metodo)(f'{LISTA}{producto.id}/', datos)
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(
                    respuesta.data['detail'],
                    'El producto está dado de baja. Reactivalo para poder modificarlo.',
                )
        producto.refresh_from_db()
        self.assertEqual(producto.nombre, 'Aros Hedwig')


@media_temporal
class RendimientoDelListado(PruebaSinSesion):
    """El listado no hace una consulta por producto (CU18).

    Autentica con force_authenticate y no con la cookie de sesión: la
    sesión suma sus propias consultas (leerla, leer la usuaria y
    renovarla por SESSION_SAVE_EVERY_REQUEST), y acá se quieren contar
    solo las del ViewSet.
    """

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(get_user_model().objects.create_user(USUARIA))

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """CU18: con tres productos con categorías, materiales e imágenes, el listado hace 4 consultas.

        Productos, categorías, materiales e imágenes: lo que
        get_queryset trae con prefetch_related.
        """
        categorias = [Categoria.objects.create(nombre=n) for n in ('Aros', 'Dijes')]
        materiales = [Material.objects.create(nombre=n) for n in ('Porcelana', 'Acrílico')]
        for numero in range(3):
            producto = crear_producto(f'Pieza {numero}')
            producto.categorias.add(*categorias)
            for material in materiales:
                MaterialProducto.objects.create(producto=producto, material=material)
            for orden in range(2):
                ImagenProducto.objects.create(producto=producto, imagen=imagen_png(), orden=orden)

        with self.assertNumQueries(4):
            respuesta = self.client.get(LISTA)
        self.assertEqual(len(respuesta.data), 3)


class PublicarYQuitarDelCatalogo(PruebaConSesion):
    """Publicar y quitar del catálogo cambian es_personalizado, y con eso
    la visibilidad pública (CU23, CU24)."""

    def test_publicar_y_quitar_del_catalogo_cambian_la_visibilidad(self):
        """CU23 y CU24: un personalizado no se ve; publicarlo lo muestra; quitarlo lo esconde."""
        producto = crear_producto(es_personalizado=True)
        visitante = APIClient()  # el catálogo lo mira alguien sin sesión
        catalogo = '/api/catalogo/productos/'

        def ids_visibles():
            return [p['id'] for p in visitante.get(catalogo).data]

        self.assertNotIn(producto.id, ids_visibles())

        respuesta = self.client.post(f'{LISTA}{producto.id}/publicar/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(respuesta.data['es_personalizado'])
        self.assertIn(producto.id, ids_visibles())

        respuesta = self.client.post(f'{LISTA}{producto.id}/quitar_del_catalogo/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertTrue(respuesta.data['es_personalizado'])
        self.assertNotIn(producto.id, ids_visibles())


class BajaDelProducto(PruebaConSesion):
    """La baja lógica no se aplica dos veces (CU20)."""

    def test_dar_de_baja_un_producto_dado_de_baja_da_400(self):
        """CU20: POST dar_de_baja sobre uno ya de baja responde 400 con mensaje."""
        producto = crear_producto(estado=Producto.Estado.BAJA)
        respuesta = self.client.post(f'{LISTA}{producto.id}/dar_de_baja/')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'El producto ya está dado de baja.')


class CategoriasDelProducto(PruebaConSesion):
    """Las categorías de un producto no se repiten (CU25)."""

    def test_asignar_la_misma_categoria_dos_veces_da_400(self):
        """CU25: la segunda asignación responde 400 con mensaje y el producto sigue con una."""
        producto = crear_producto()
        categoria = Categoria.objects.create(nombre='Aros')
        url = f'{LISTA}{producto.id}/categorias/'

        self.assertEqual(self.client.post(url, {'categoria': categoria.id}).status_code,
                         status.HTTP_200_OK)
        respuesta = self.client.post(url, {'categoria': categoria.id})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'],
                         'El producto ya tiene asignada la categoría «Aros».')
        self.assertEqual(producto.categorias.count(), 1)


class MaterialesDelProducto(PruebaConSesion):
    """Los materiales de un producto: sin repetidos y con cantidad en texto libre (CU28, CU30)."""

    def setUp(self):
        super().setUp()
        self.producto = crear_producto()
        self.material = Material.objects.create(nombre='Porcelana')
        self.url = f'{LISTA}{self.producto.id}/materiales/'

    def test_asignar_el_mismo_material_dos_veces_da_400(self):
        """CU28: la segunda asignación responde 400 con mensaje, en vez del IntegrityError de la UniqueConstraint."""
        self.assertEqual(self.client.post(self.url, {'material': self.material.id}).status_code,
                         status.HTTP_200_OK)
        respuesta = self.client.post(self.url, {'material': self.material.id})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'],
                         'El producto ya tiene «Porcelana» entre sus materiales.')
        self.assertEqual(MaterialProducto.objects.count(), 1)

    def test_la_cantidad_acepta_texto_libre(self):
        """CU28 y CU30: la cantidad es texto ("dos gotas"), al asignar y al modificar."""
        respuesta = self.client.post(self.url, {'material': self.material.id,
                                                'cantidad': 'dos gotas'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        linea = MaterialProducto.objects.get(producto=self.producto, material=self.material)
        self.assertEqual(linea.cantidad, 'dos gotas')

        respuesta = self.client.patch(f'{self.url}{linea.id}/', {'cantidad': 'media plancha'})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        linea.refresh_from_db()
        self.assertEqual(linea.cantidad, 'media plancha')


class EliminarProductoEnPedido(PruebaConSesion):
    """Discontinuar ≠ eliminar: un producto que figura en un pedido no se elimina (CU22)."""

    def test_eliminar_producto_que_figura_en_un_pedido_da_400(self):
        """CU22: la FK PROTECT de ProductoDelPedido se explica con un mensaje y el producto sigue."""
        producto = crear_producto()
        cliente = Cliente.objects.create(instagram='sofi.delgado', nombre='Sofía')
        pedido = Pedido.objects.create(cliente=cliente)
        ProductoDelPedido.objects.create(pedido=pedido, producto=producto,
                                         precio=producto.precio_actual, cantidad=1)

        respuesta = self.client.delete(f'{LISTA}{producto.id}/')
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            respuesta.data['detail'],
            'No se puede eliminar «Aros Hedwig» porque está en 1 pedido. '
            'Si ya no lo hacés más, dalo de baja.',
        )
        self.assertTrue(Producto.objects.filter(pk=producto.pk).exists())


@media_temporal
class BorrarImagen(PruebaConSesion):
    """Borrar una imagen borra también su archivo (CU35).

    El archivo lo borra la señal post_delete de productos/apps.py, que lo
    agenda con transaction.on_commit. En un TestCase la transacción se
    revierte al final y ese gancho no correría: captureOnCommitCallbacks
    con execute=True lo ejecuta al salir del bloque, como haría el commit.
    """

    def test_borrar_una_imagen_borra_el_archivo_de_media(self):
        """CU35: después del DELETE no queda ni la fila ni el archivo en media."""
        producto = crear_producto()
        imagen = ImagenProducto.objects.create(producto=producto, imagen=imagen_png())
        ruta = imagen.imagen.path
        self.assertTrue(os.path.exists(ruta))

        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.client.delete(f'{LISTA}{producto.id}/imagenes/{imagen.id}/')

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertFalse(ImagenProducto.objects.filter(pk=imagen.pk).exists())
        self.assertFalse(os.path.exists(ruta))
