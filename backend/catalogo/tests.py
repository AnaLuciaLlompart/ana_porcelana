from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from categorias.models import Categoria
from pruebas.base import PruebaSinSesion, imagen_png, media_temporal
from productos.models import ImagenProducto, Producto

LISTA = '/api/catalogo/productos/'
CATEGORIAS = '/api/catalogo/categorias/'


def detalle(producto_id):
    return f'/api/catalogo/productos/{producto_id}/'


def crear_producto(nombre, **campos):
    """Un producto visible salvo que se diga lo contrario."""
    datos = {'precio_actual': '1500.00', 'dificultad': Producto.Dificultad.MEDIA}
    datos.update(campos)
    return Producto.objects.create(nombre=nombre, **datos)


def ids(respuesta):
    return [producto['id'] for producto in respuesta.data]


class MetodosDelCatalogo(PruebaSinSesion):
    """El catálogo público es de solo lectura."""

    def test_metodos_distintos_de_get_dan_405(self):
        """Solo GET: POST, PUT, PATCH, DELETE y OPTIONS responden 405 en las tres URLs."""
        producto = crear_producto('Aros Hedwig')
        for url in (LISTA, detalle(producto.id), CATEGORIAS):
            for metodo in ('post', 'put', 'patch', 'delete', 'options'):
                with self.subTest(metodo=metodo, url=url):
                    respuesta = getattr(self.client, metodo)(url, {})
                    self.assertEqual(respuesta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


@media_temporal
class DatosQueExponeElCatalogo(PruebaSinSesion):
    """Lo que un visitante puede leer es exactamente lo que dicen los serializers."""

    CAMPOS_LISTA = {
        'id', 'nombre', 'descripcion', 'precio_actual',
        'dificultad', 'dificultad_display', 'categorias', 'imagen_principal',
    }

    def test_el_listado_y_el_detalle_no_exponen_datos_de_gestion(self):
        """CU63 y CU65: sin paso a paso, materiales, estado, es_personalizado ni imágenes de referencia."""
        producto = crear_producto('Aros Hedwig', paso_a_paso='Modelar, secar, pintar.')
        producto.categorias.add(Categoria.objects.create(nombre='Aros'))
        ImagenProducto.objects.create(
            producto=producto, imagen=imagen_png('resultado.png'),
            tipo=ImagenProducto.Tipo.RESULTADO,
        )
        ImagenProducto.objects.create(
            producto=producto, imagen=imagen_png('referencia.png'),
            tipo=ImagenProducto.Tipo.REFERENCIA,
        )

        lista = self.client.get(LISTA)
        self.assertEqual(lista.status_code, status.HTTP_200_OK)
        self.assertEqual(set(lista.data[0].keys()), self.CAMPOS_LISTA)
        self.assertEqual(set(lista.data[0]['categorias'][0].keys()),
                         {'id', 'nombre', 'tipo', 'tipo_display'})

        detalle_ = self.client.get(detalle(producto.id))
        self.assertEqual(detalle_.status_code, status.HTTP_200_OK)
        self.assertEqual(set(detalle_.data.keys()), self.CAMPOS_LISTA | {'imagenes'})

        # De las dos imágenes, al catálogo llega solo la de resultado.
        imagenes = detalle_.data['imagenes']
        self.assertEqual(len(imagenes), 1)
        self.assertEqual(set(imagenes[0].keys()), {'id', 'imagen', 'titulo', 'orden'})
        self.assertIn('resultado', imagenes[0]['imagen'])
        self.assertIn('resultado', detalle_.data['imagen_principal'])


class ReglaDeVisibilidad(PruebaSinSesion):
    """Un producto se muestra si está activo, no es personalizado y
    ninguna de sus categorías está de baja (CU63, CU64)."""

    def setUp(self):
        super().setUp()
        self.visible = crear_producto('Aros Hedwig')

    def test_no_aparece_un_producto_dado_de_baja(self):
        """CU63: un producto de baja no está en el listado."""
        de_baja = crear_producto('Collar Luna', estado=Producto.Estado.BAJA)
        self.assertEqual(ids(self.client.get(LISTA)), [self.visible.id])
        self.assertEqual(self.client.get(detalle(de_baja.id)).status_code,
                         status.HTTP_404_NOT_FOUND)

    def test_no_aparece_un_producto_personalizado(self):
        """CU63: un encargo personalizado no está en el listado aunque esté activo."""
        personalizado = crear_producto('Dije a pedido', es_personalizado=True)
        self.assertEqual(ids(self.client.get(LISTA)), [self.visible.id])
        self.assertEqual(self.client.get(detalle(personalizado.id)).status_code,
                         status.HTTP_404_NOT_FOUND)

    def test_una_categoria_de_baja_retira_al_producto_aunque_tenga_otra_activa(self):
        """Regla de visibilidad: alcanza con UNA categoría de baja."""
        activa = Categoria.objects.create(nombre='Aros')
        de_baja = Categoria.objects.create(nombre='Harry Potter',
                                           estado=Categoria.Estado.BAJA)
        escondido = crear_producto('Aros Snitch')
        escondido.categorias.add(activa, de_baja)
        self.assertEqual(ids(self.client.get(LISTA)), [self.visible.id])

    def test_reactivar_la_categoria_devuelve_al_producto(self):
        """CU15: reactivar la categoría devuelve sus productos al catálogo tal como estaban."""
        de_baja = Categoria.objects.create(nombre='Harry Potter',
                                           estado=Categoria.Estado.BAJA)
        escondido = crear_producto('Aros Snitch')
        escondido.categorias.add(de_baja)
        self.assertNotIn(escondido.id, ids(self.client.get(LISTA)))

        # La reactiva la emprendedora, con sesión, desde la gestión.
        gestion = APIClient()
        gestion.force_login(get_user_model().objects.create_user('ana', password='x'))
        respuesta = gestion.post(f'/api/categorias/{de_baja.id}/reactivar/')
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        self.assertIn(escondido.id, ids(self.client.get(LISTA)))
        self.assertEqual(self.client.get(detalle(escondido.id)).status_code,
                         status.HTTP_200_OK)

    def test_un_producto_sin_categorias_depende_solo_de_su_estado(self):
        """Regla de visibilidad: sin categorías, manda el estado del producto."""
        self.assertEqual(ids(self.client.get(LISTA)), [self.visible.id])
        self.visible.estado = Producto.Estado.BAJA
        self.visible.save()
        self.assertEqual(ids(self.client.get(LISTA)), [])

    def test_las_categorias_del_catalogo_son_solo_las_activas(self):
        """CU64: las opciones del filtro no incluyen categorías de baja."""
        Categoria.objects.create(nombre='Aros')
        Categoria.objects.create(nombre='Harry Potter', estado=Categoria.Estado.BAJA)
        respuesta = self.client.get(CATEGORIAS)
        self.assertEqual([c['nombre'] for c in respuesta.data], ['Aros'])


class DetalleNoVisible(PruebaSinSesion):
    """El visitante no puede distinguir un producto escondido de uno que no existe."""

    def test_detalle_no_visible_da_el_mismo_404_que_inexistente(self):
        """CU65: mismo status y mismo cuerpo para un producto de baja y para un id que no existe."""
        de_baja = crear_producto('Collar Luna', estado=Producto.Estado.BAJA)
        escondido = self.client.get(detalle(de_baja.id))
        inexistente = self.client.get(detalle(999999))
        self.assertEqual(escondido.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(inexistente.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(escondido.data, inexistente.data)


@media_temporal
class RendimientoDelCatalogo(PruebaSinSesion):
    """El listado no hace una consulta por producto."""

    def test_el_listado_hace_una_cantidad_fija_de_consultas(self):
        """Tres consultas haya los productos que haya: productos, categorías e imágenes."""
        categorias = [Categoria.objects.create(nombre=n) for n in ('Aros', 'Dijes')]
        for numero in range(3):
            producto = crear_producto(f'Pieza {numero}')
            producto.categorias.add(*categorias)
            for orden in range(2):
                ImagenProducto.objects.create(
                    producto=producto, imagen=imagen_png(), orden=orden,
                )

        with self.assertNumQueries(3):
            respuesta = self.client.get(LISTA)
        self.assertEqual(len(respuesta.data), 3)


class ListadoDeA20(PruebaSinSesion):
    """El listado se pagina de a 20 y se filtra en la base (CU63, CU64, corrección D3)."""

    def setUp(self):
        super().setUp()
        self.aros = Categoria.objects.create(nombre='Aros', tipo=Categoria.Tipo.TIPO)
        self.dijes = Categoria.objects.create(nombre='Dijes', tipo=Categoria.Tipo.TIPO)
        self.harry = Categoria.objects.create(nombre='Harry Potter', tipo=Categoria.Tipo.TEMATICA)
        self.aros_snitch = crear_producto('Aros Snitch', precio_actual='4000.00')
        self.aros_snitch.categorias.add(self.aros, self.harry)
        self.dije_luna = crear_producto('Dije Luna', precio_actual='2000.00', descripcion='Una luna de José')
        self.dije_luna.categorias.add(self.dijes)
        self.aros_flor = crear_producto('Aros Flor', precio_actual='3000.00')
        self.aros_flor.categorias.add(self.aros)

    def ids_de(self, parametros):
        respuesta = self.client.get(LISTA, {'pagina': 1, **parametros})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        return [producto['id'] for producto in respuesta.data['results']]

    def test_pagina_de_a_20(self):
        """CU63: con 23 productos, la primera página trae 20, el count dice 23 y la segunda trae 3."""
        for numero in range(20):
            crear_producto(f'Pieza {numero:02}')

        respuesta = self.client.get(LISTA, {'pagina': 1})
        self.assertEqual(respuesta.data['count'], 23)
        self.assertEqual(len(respuesta.data['results']), 20)
        self.assertEqual(len(self.client.get(LISTA, {'pagina': 2}).data['results']), 3)

    def test_categorias_o_dentro_del_grupo_y_entre_grupos(self):
        """CU64: Aros o Dijes, y además Harry Potter, deja solo los aros de Harry Potter."""
        self.assertEqual(
            self.ids_de({'categoria': [self.aros.id, self.dijes.id], 'orden': 'nombre-asc'}),
            [self.aros_flor.id, self.aros_snitch.id, self.dije_luna.id],
        )
        self.assertEqual(
            self.ids_de({'categoria': [self.aros.id, self.dijes.id, self.harry.id]}),
            [self.aros_snitch.id],
        )

    def test_busca_sin_acentos_y_ordena_por_precio(self):
        """CU63: "jose" encuentra "José" en la descripción; precio-desc pone primero el más caro."""
        self.assertEqual(self.ids_de({'busqueda': 'jose'}), [self.dije_luna.id])
        self.assertEqual(
            self.ids_de({'orden': 'precio-desc'}),
            [self.aros_snitch.id, self.aros_flor.id, self.dije_luna.id],
        )

    def test_ids_trae_los_de_la_seleccion(self):
        """CU67: ?ids= devuelve solo esos productos, y un id que no es visible no sale."""
        oculto = crear_producto('Collar Oculto', estado=Producto.Estado.BAJA)
        respuesta = self.client.get(LISTA, {'ids': f'{self.dije_luna.id},{oculto.id}'})
        self.assertEqual(ids(respuesta), [self.dije_luna.id])

    def test_las_categorias_traen_cuantos_productos_visibles_tienen(self):
        """CU64: la cantidad cuenta los visibles; un producto de baja no suma."""
        crear_producto('Aros Viejos', estado=Producto.Estado.BAJA).categorias.add(self.aros)
        respuesta = self.client.get(CATEGORIAS)
        cantidades = {c['nombre']: c['cantidad'] for c in respuesta.data}
        self.assertEqual(cantidades, {'Aros': 2, 'Dijes': 1, 'Harry Potter': 1})

    def test_un_orden_que_no_existe_da_400(self):
        """CU63: responde 400 con mensaje; uno que existe pasa."""
        respuesta = self.client.get(LISTA, {'pagina': 1, 'orden': 'color'})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(respuesta.data['detail'], 'No se puede ordenar así.')

        self.assertEqual(len(self.ids_de({'orden': 'nombre-desc'})), 3)
