from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("devices", "0005_child_photo_file")]
    operations = [migrations.AlterField(model_name="child", name="photo", field=models.FileField(blank=True, null=True, upload_to="children/"))]
