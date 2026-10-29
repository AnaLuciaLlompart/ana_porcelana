# Escrita a mano: makemigrations pregunta en la terminal si el campo se
# renombró, y así queda explícito. RenameField solo renombra la columna
# (ALTER TABLE ... RENAME COLUMN) y no toca ninguna fila; AlterField cambia
# choices y textos, que viven en el código y no generan SQL. Los pedidos
# guardados tienen MIO o CLIENTE, que siguen siendo válidos.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0002_cobro'),
    ]

    operations = [
        migrations.RenameField(
            model_name='pedido',
            old_name='envio_a_cargo',
            new_name='forma_entrega',
        ),
        migrations.AlterField(
            model_name='pedido',
            name='forma_entrega',
            field=models.CharField(choices=[('RETIRO', 'Retiro'), ('MIO', 'Envío a cargo mío'), ('CLIENTE', 'Envío a cargo del cliente')], default='CLIENTE', help_text='Retiro, o envío a cargo mío o del cliente. Solo el envío a cargo mío suma su costo al total del pedido.', max_length=7, verbose_name='forma de entrega'),
        ),
    ]
