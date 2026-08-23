from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("devices", "0003_child_hierarchy")]
    operations = [
        migrations.AddField(model_name="child", name="birth_date", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="child", name="photo_url", field=models.URLField(blank=True)),
    ]
