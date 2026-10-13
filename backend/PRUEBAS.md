# Pruebas automatizadas del backend

Corren con `python manage.py test` desde `backend/`, con el venv activo.
Una app sola: `python manage.py test <app>`. Cobertura: `coverage run
manage.py test` y después `coverage report`.

Grupos: permisos, seguridad, catálogo, reglas de negocio, validación,
rendimiento.

| App | Prueba | Qué verifica | CU o regla | Grupo |
|---|---|---|---|---|
| usuarios | test_materiales_sin_sesion_da_403 | GET, POST, PUT, PATCH y DELETE a /api/materiales/ sin sesión responden 403 | Denegación por defecto (IsAuthenticated global) | permisos |
| usuarios | test_categorias_sin_sesion_da_403 | Lo mismo sobre /api/categorias/ | Denegación por defecto | permisos |
| usuarios | test_productos_sin_sesion_da_403 | Lo mismo sobre /api/productos/ | Denegación por defecto | permisos |
| usuarios | test_clientes_sin_sesion_da_403 | Lo mismo sobre /api/clientes/ | Denegación por defecto | permisos |
| usuarios | test_pedidos_sin_sesion_da_403 | Lo mismo sobre /api/pedidos/ | Denegación por defecto | permisos |
| usuarios | test_gastos_sin_sesion_da_403 | Lo mismo sobre /api/gastos/ | Denegación por defecto | permisos |
| usuarios | test_finanzas_sin_sesion_da_403 | GET a /api/finanzas/ con un período válido sin sesión responde 403 | Denegación por defecto (CU61, CU62) | permisos |
| usuarios | test_inicio_sin_sesion_da_403 | GET a /api/inicio/ sin sesión responde 403 | Denegación por defecto | permisos |
| usuarios | test_admin_sin_sesion_redirige_al_login | GET a /admin/ sin sesión redirige (302) a /admin/login/ | El admin es herramienta de desarrollo y también exige sesión | permisos |
| usuarios | test_post_sin_token_csrf_da_403 | Con sesión pero sin token CSRF, un POST responde 403 | Protección CSRF de SessionAuthentication | seguridad |
| usuarios | test_cookie_de_sesion_lleva_httponly | La cookie sessionid del login lleva HttpOnly y Max-Age de 24 horas | Autenticación por sesión con cookie HttpOnly; sesión de 24 h | seguridad |
| usuarios | test_login_bloqueado_tras_intentos_fallidos | Al quinto fallo el login responde 429 con mensaje, y la contraseña correcta tampoco entra | Bloqueo por intentos fallidos (django-axes, CU01) | seguridad |
| catalogo | test_metodos_distintos_de_get_dan_405 | POST, PUT, PATCH, DELETE y OPTIONS a las tres URLs del catálogo responden 405 | El catálogo es solo GET (http_method_names) | catálogo |
| catalogo | test_el_listado_y_el_detalle_no_exponen_datos_de_gestion | Las claves del listado y del detalle son exactamente las de los serializers; sin paso a paso, materiales, estado ni es_personalizado; en imagenes solo las de resultado | Serializers propios del catálogo (CU63, CU65) | catálogo |
| catalogo | test_no_aparece_un_producto_dado_de_baja | Un producto de baja no está en el listado y su detalle da 404 | Regla de visibilidad (CU63) | catálogo |
| catalogo | test_no_aparece_un_producto_personalizado | Un producto personalizado activo no está en el listado y su detalle da 404 | Regla de visibilidad (CU63) | catálogo |
| catalogo | test_una_categoria_de_baja_retira_al_producto_aunque_tenga_otra_activa | Con una categoría de baja y otra activa, el producto no se muestra | Regla de visibilidad: alcanza con una categoría de baja | catálogo |
| catalogo | test_reactivar_la_categoria_devuelve_al_producto | Reactivar la categoría por la API de gestión devuelve el producto al listado y al detalle | El estado de la categoría se evalúa al consultar (CU15, CU63) | catálogo |
| catalogo | test_un_producto_sin_categorias_depende_solo_de_su_estado | Sin categorías, el producto se muestra activo y desaparece al darlo de baja | Regla de visibilidad | catálogo |
| catalogo | test_las_categorias_del_catalogo_son_solo_las_activas | /api/catalogo/categorias/ no incluye categorías de baja | CU64 | catálogo |
| catalogo | test_detalle_no_visible_da_el_mismo_404_que_inexistente | El detalle de un producto de baja y el de un id inexistente devuelven el mismo status y el mismo cuerpo | El visitante no distingue un producto escondido de uno que no existe (CU65) | catálogo |
| catalogo | test_el_listado_hace_una_cantidad_fija_de_consultas | Con tres productos, cada uno con categorías e imágenes, el listado hace 3 consultas | productos_del_catalogo(): productos, categorías e imágenes prefetcheadas | rendimiento |
| materiales | test_editar_material_discontinuado_da_400 | PUT y PATCH sobre un material discontinuado responden 400 con mensaje y no cambian nada | Una entidad de baja queda de solo lectura (CU06, CU07) | reglas de negocio |
| materiales | test_discontinuar_un_material_discontinuado_da_400 | POST discontinuar sobre uno ya discontinuado responde 400 con mensaje | Baja lógica (CU07) | reglas de negocio |
| materiales | test_eliminar_material_usado_en_un_producto_da_400 | DELETE de un material con MaterialProducto responde 400 "está usado en 1 producto" y el material sigue | Discontinuar ≠ eliminar; FK PROTECT explicada (CU09) | reglas de negocio |
| materiales | test_eliminar_material_que_figura_en_un_gasto_da_400 | DELETE de un material con MaterialDelGasto responde 400 "figura en 1 gasto" | FK PROTECT de MaterialDelGasto (CU09) | reglas de negocio |
| materiales | test_eliminar_material_usado_y_en_gasto_nombra_los_dos_motivos | Con las dos referencias, el mensaje dice "está usado en 1 producto y figura en 1 gasto" | Mensaje de MaterialViewSet.destroy (CU09) | reglas de negocio |
| materiales | test_una_imagen_valida_se_guarda | Control: un PNG real da 201 y la ruta queda bajo /media/materiales/ | ImageField (CU04) | validación |
| materiales | test_un_archivo_que_no_es_imagen_da_400 | Un archivo con extensión .png que no es imagen responde 400 y no deja fila ni archivo | Pillow valida que sea una imagen real | validación |
| materiales | test_una_imagen_de_mas_de_15_mb_da_400 | Un PNG válido de 16 MB responde 400 "La imagen pesa 16.0 MB y el máximo son 15 MB." | validar_tamano_archivo | validación |
| materiales | test_una_bomba_de_descompresion_da_400 | Un PNG que declara 30.000 × 30.000 píxeles responde 400, no 500 | Pillow rechaza la bomba al abrir; ImageField la convierte en 400 | seguridad |
| categorias | test_nombre_repetido_da_400 | POST con un nombre que ya existe responde 400 "Ya existe una categoría con este nombre." y no crea la fila | nombre unique=True con mensaje propio (CU11) | validación |
| categorias | test_editar_categoria_dada_de_baja_da_400 | PUT y PATCH sobre una categoría de baja responden 400 con mensaje y no cambian nada | Una entidad de baja queda de solo lectura (CU13, CU14) | reglas de negocio |
| productos | test_subir_imagen_sin_sesion_da_403_y_no_guarda_nada | POST /api/productos/<id>/imagenes/ sin sesión responde 403, sin ImagenProducto y sin archivo en media | Denegación por defecto (CU32) | permisos |
| productos | test_editar_producto_dado_de_baja_da_400 | PUT y PATCH sobre un producto de baja responden 400 con mensaje y no cambian nada | Una entidad de baja queda de solo lectura (CU19, CU20) | reglas de negocio |
| productos | test_el_listado_hace_una_cantidad_fija_de_consultas | Con tres productos con categorías, materiales e imágenes, el listado hace 4 consultas (sin contar la sesión) | prefetch_related en ProductoViewSet.get_queryset (CU18) | rendimiento |
| productos | test_publicar_y_quitar_del_catalogo_cambian_la_visibilidad | Un personalizado no está en el catálogo público; POST publicar lo muestra; POST quitar_del_catalogo lo esconde | es_personalizado y la regla de visibilidad (CU23, CU24) | reglas de negocio |
| productos | test_dar_de_baja_un_producto_dado_de_baja_da_400 | POST dar_de_baja sobre uno ya de baja responde 400 "El producto ya está dado de baja." | Baja lógica (CU20) | reglas de negocio |
| productos | test_asignar_la_misma_categoria_dos_veces_da_400 | La segunda asignación de la misma categoría responde 400 con mensaje y el producto sigue con una | Categorías del producto sin repetidos (CU25) | reglas de negocio |
| productos | test_asignar_el_mismo_material_dos_veces_da_400 | La segunda asignación del mismo material responde 400 con mensaje, no el IntegrityError de material_producto_unico | UniqueConstraint (producto, material) explicada (CU28) | reglas de negocio |
| productos | test_la_cantidad_acepta_texto_libre | La cantidad "dos gotas" se guarda al asignar y "media plancha" al modificar | Cantidad en texto libre (CU28, CU30) | reglas de negocio |
| productos | test_eliminar_producto_que_figura_en_un_pedido_da_400 | DELETE de un producto con ProductoDelPedido responde 400 "está en 1 pedido" y el producto sigue | Discontinuar ≠ eliminar; FK PROTECT explicada (CU22) | reglas de negocio |
| productos | test_borrar_una_imagen_borra_el_archivo_de_media | Después del DELETE de la imagen no queda la fila ni el archivo en media | Señal post_delete de productos/apps.py (CU35) | reglas de negocio |
| clientes | test_instagram_repetido_con_distintas_mayusculas_da_400 | POST con ' @Sofi.Delgado' cuando existe 'sofi.delgado' responde 400 "Ya tenés un cliente con ese usuario." y no crea la fila | Instagram único y normalizado en to_internal_value (CU36) | validación |
| clientes | test_el_instagram_se_guarda_normalizado | POST con ' @Sofi.Delgado ' guarda y devuelve 'sofi.delgado' | Normalización en Model.save() y en el serializer (CU36) | validación |
| clientes | test_eliminar_cliente_con_pedidos_da_400 | DELETE de un cliente con un pedido responde 400 con el mensaje que no ofrece baja lógica, y el cliente sigue | FK PROTECT de Pedido explicada; Cliente no tiene baja lógica (CU39) | reglas de negocio |
