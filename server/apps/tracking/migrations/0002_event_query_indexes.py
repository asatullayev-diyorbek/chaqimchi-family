from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracking", "0001_initial")]

    operations = [
        migrations.AddIndex(
            model_name="event",
            index=models.Index(
                fields=["device", "event_type", "occurred_at"],
                name="event_device_type_time_idx",
            ),
        ),
    ]
