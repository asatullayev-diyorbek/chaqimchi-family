from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("devices", "0004_child_profile_fields")]
    operations = [
        migrations.RemoveField(model_name="child", name="photo_url"),
        migrations.AddField(model_name="child", name="photo", field=models.FileField(blank=True, upload_to="children/")),
    ]
