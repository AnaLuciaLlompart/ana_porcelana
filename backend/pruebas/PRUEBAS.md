# Pruebas automatizadas del backend

Corren con `python manage.py test` desde `backend/`, con el venv activo.
Una app sola: `python manage.py test <app>`. Cobertura: `coverage run
manage.py test` y después `coverage report`.

Las pruebas viven en el `tests.py` de cada app. Lo que comparten
(`PruebaSinSesion`, `PruebaConSesion`, los ayudantes de imágenes) está
en `pruebas/base.py`, en esta misma app, que no es una funcionalidad
sino la infraestructura de pruebas y las herramientas de administración.

## Resumen

**78 pruebas**, todas en verde, en once apps (`usuarios` 14, `catalogo`
10, `materiales` 9, `categorias` 4, `productos` 10, `clientes` 3,
`pedidos` 10, `gastos` 10, `finanzas` 2, `inicio` 1, `pruebas` 5).

| Grupo | Pruebas |
|---|---|
| reglas de negocio | 36 |
| permisos | 11 |
| validación | 11 |
| catálogo | 9 |
| seguridad | 7 |
| rendimiento | 4 |

**Cobertura: 82 %** del código del backend (1.792 sentencias, 324 sin
ejecutar), medida con `coverage 7.16.2`. El porcentaje excluye la app
`pruebas` entera (las pruebas y los comandos), las migraciones,
`manage.py`, los settings y los arranques asgi/wsgi (ver `.coveragerc`). Lo que más falta es el dibujo
del PDF (`pedidos/comprobante.py`, 41 %) y las acciones de sub-recursos
de `pedidos/views.py` y `productos/views.py` que no están en este
listado (63 % cada uno).

## Listado

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
| usuarios | test_cerrar_sesion_deja_sin_acceso_a_la_gestion | Antes del logout la gestión responde 200; después del POST a /api/auth/logout/, 403 | Cerrar sesión (CU02) | seguridad |
| usuarios | test_cambiar_contrasena_exige_la_actual_y_la_nueva_sirve_para_entrar | Con la actual incorrecta 400 con mensaje; con la correcta 200, la sesión sigue viva, la vieja ya no entra y la nueva sí | Modificar contraseña y update_session_auth_hash (CU03) | seguridad |
| finanzas | test_desde_posterior_a_hasta_da_400 | GET con desde 2026-02-01 y hasta 2026-01-01 responde 400 con mensaje | Validación del período (CU61, CU62) | validación |
| finanzas | test_los_totales_del_periodo_son_correctos | Un cobro de $4.000 y un gasto de $1.500 en marzo dan ingresos, gastos y resultado $2.500 con una fila de cada; un cobro de abril y un gasto de febrero quedan afuera | Ingresos = cobros del período; fecha__range inclusivo (CU61, CU62) | reglas de negocio |
| inicio | test_el_resumen_cuenta_pedidos_atrasados_y_materiales_en_baja | Un pedido sin entregar con fecha vencida y un material activo en Baja se cuentan; un Entregado vencido y un discontinuado en Baja no | Resumen de Inicio: atrasados y materiales por reponer | reglas de negocio |
| pruebas | test_una_foto_grande_se_achica_a_1600_y_pesa_menos | Un JPEG de 3000×2000 subido por POST /api/materiales/ queda guardado en 1600×1067, JPEG, .jpg, y pesa menos que el subido | Achicado al subir: LADO_MAXIMO y CALIDAD_JPEG en config/imagenes.py (CU04) | reglas de negocio |
| pruebas | test_una_imagen_chica_conserva_sus_dimensiones | Un PNG de 800×600 se guarda de 800×600 | Achicar solo si el lado mayor supera 1600 (CU04) | validación |
| pruebas | test_la_transparencia_se_conserva_en_png | Un PNG RGBA de 2000×2000 con alfa real queda en 1600×1600, PNG, RGBA y con píxeles transparentes | usa_transparencia mira los píxeles, no el modo (CU04) | reglas de negocio |
| pruebas | test_las_imagenes_de_producto_tambien_se_achican | Un JPEG de 2000×3000 subido por POST /api/productos/<id>/imagenes/ queda en 1067×1600, JPEG, y pesa menos | El segundo campo de imagen pasa por el mismo achicado (CU32) | reglas de negocio |
| pruebas | test_ip_de_origen_toma_la_cabecera_del_proxy_o_la_de_la_conexion | Sin cabecera devuelve REMOTE_ADDR; con X-Forwarded-For devuelve su último valor, también si trae varios | La IP real detrás de nginx: config/ip.py, AXES_CLIENT_IP_CALLABLE y NUM_PROXIES en produccion.py (despliegue) | seguridad |
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
| categorias | test_dar_de_baja_una_categoria_dada_de_baja_da_400 | POST dar_de_baja sobre una ya de baja responde 400 "La categoría ya está dada de baja." | Baja lógica (CU14) | reglas de negocio |
| categorias | test_eliminar_una_categoria_no_elimina_sus_productos | Después del DELETE (204) la categoría no existe, el producto sigue sin categorías y aparece en el catálogo público | Eliminar una categoría borra solo las asociaciones (CU16) | reglas de negocio |
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
| pedidos | test_cambiar_el_precio_del_producto_no_altera_los_pedidos | Después de subir precio_actual del producto por PUT, el precio de la línea y el total del pedido siguen en $5.000 | Precio congelado al registrar el producto del pedido (CU44) | reglas de negocio |
| pedidos | test_el_saldo_se_calcula_con_varios_cobros | Dos señas de $3.000 y $2.000 sobre $10.000 dan cobrado $5.000 y saldo $5.000; el pago restante deja saldo $0 y esta_al_dia | Propiedades cobrado y saldo de Pedido (CU48) | reglas de negocio |
| pedidos | test_no_se_puede_cobrar_mas_que_el_total | Un cobro de $12.000 sobre $10.000 responde 400 con las tres cifras y no se registra | No se puede cobrar más que el total (CU48) | reglas de negocio |
| pedidos | test_una_sena_no_puede_dejar_el_pedido_saldado | Una seña de $10.000 sobre $10.000 responde 400 con mensaje; el mismo monto como Pago restante entra y salda | Una seña no puede dejar el pedido saldado (CU48) | reglas de negocio |
| pedidos | test_no_pasa_a_listo_con_piezas_sin_terminar | Sin productos y con una pieza sin terminar, cambiar_estado a Listo responde 400 con mensaje; con todo terminado pasa | _revisar_estado (CU42) | reglas de negocio |
| pedidos | test_agregar_una_pieza_a_un_pedido_listo_lo_baja_a_en_produccion | Agregar un producto a un pedido Listo lo devuelve a En producción | _bajar_si_quedo_incompleto (CU44) | reglas de negocio |
| pedidos | test_la_fecha_de_entrega_real_solo_la_escribe_entregado | Un PUT con fecha_entrega_real la ignora; pasar a Entregado escribe hoy; volver a Listo la borra | fecha_entrega_real read_only; _guardar_estado (CU42) | reglas de negocio |
| pedidos | test_un_id_de_producto_que_es_lista_u_objeto_da_400 | POST {"producto": [1]} y {"producto": {"id": 1}} responden 400 "No existe un producto con ese id." y no crean la línea | TypeError atrapado en agregar_producto (CU44) | validación |
| pedidos | test_comprobante_sin_sesion_da_403 | GET /api/pedidos/<id>/comprobante/ sin sesión responde 403 | Denegación por defecto (CU60) | permisos |
| pedidos | test_el_listado_hace_una_cantidad_fija_de_consultas | Con tres pedidos con productos y cobros, el listado hace 4 consultas (sin contar la sesión) | select_related y prefetch_related en PedidoViewSet.get_queryset (CU41) | rendimiento |
| gastos | test_el_monto_es_la_suma_de_sus_filas_y_un_put_no_lo_pisa | Con 3 × $800 y 2 × $150 el monto es $2.700, en la respuesta y en la base; un PUT con monto 99999 lo deja en $2.700 y sí guarda la descripción | _recalcular_monto es la única puerta al monto; GastoSerializer.validate descarta el monto si es de materiales (CU54, CU56) | reglas de negocio |
| gastos | test_un_gasto_de_materiales_no_puede_cambiar_de_tipo | PUT y PATCH con otro tipo responden 400 con mensaje y el gasto sigue siendo de materiales | GastoViewSet.update (CU54) | reglas de negocio |
| gastos | test_publicidad_u_otro_con_monto_cero_o_negativo_da_400 | Publicidad u otro con monto 0 o negativo responden 400 en 'monto' y no crean la fila; con $500 se crea | GastoSerializer.validate: monto mayor a cero salvo materiales (CU52) | validación |
| gastos | test_un_gasto_de_materiales_nuevo_vale_cero | POST de un gasto de materiales sin materiales responde 201 con monto 0.00 y lista vacía | Un gasto de materiales recién creado vale 0 y es válido (CU52) | reglas de negocio |
| gastos | test_un_gasto_de_publicidad_puede_pasar_a_materiales | PATCH de un gasto de publicidad de $500 a tipo materiales responde 200 con monto 0.00 | El camino inverso se permite; perform_update recalcula (CU54) | reglas de negocio |
| gastos | test_registrar_el_mismo_material_dos_veces_da_400 | La segunda fila del mismo material responde 400 con mensaje y queda una sola fila | UniqueConstraint (gasto, material) explicada (CU56) | reglas de negocio |
| gastos | test_un_id_de_material_que_es_lista_u_objeto_da_400 | POST {"material": [1]} y {"material": {"id": 1}} responden 400 "No existe un material con ese id." y no crean la fila | TypeError atrapado en registrar_material (CU56) | validación |
| gastos | test_modificar_y_quitar_un_material_recalculan_el_monto | 3 × $800 = $2.400; cantidad 5 → $4.000; precio $100 → $500; quitar la fila → $0, en la respuesta y en la base | _recalcular_monto desde modificar y quitar (CU58, CU59) | reglas de negocio |
| gastos | test_marcar_alta_cambia_solo_los_activos_que_no_estaban_en_alta | Marcar todos: solo el activo en Baja pasa a Alta y figura en materiales_cambiados; el que ya estaba en Alta y el discontinuado se ignoran; de a uno sobre el que ya está en Alta devuelve lista vacía | _marcar_disponibilidad_alta (parte de CU58) | reglas de negocio |
| gastos | test_el_listado_hace_una_cantidad_fija_de_consultas | Con tres gastos de dos materiales cada uno, el listado hace 3 consultas (sin contar la sesión) | prefetch_related('materiales__material') en GastoViewSet (CU53) | rendimiento |
