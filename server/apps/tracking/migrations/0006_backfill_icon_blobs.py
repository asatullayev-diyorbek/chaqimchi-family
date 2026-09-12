from django.db import migrations


def backfill(apps, schema_editor):
    DeviceAppIcon = apps.get_model("tracking", "DeviceAppIcon")
    IconBlob = apps.get_model("devices", "IconBlob")

    for row in DeviceAppIcon.objects.exclude(sha256="").iterator():
        blob, _ = IconBlob.objects.get_or_create(
            sha256=row.sha256, defaults={"data_b64": row.data_b64}
        )
        row.icon_id = blob.sha256
        row.save(update_fields=["icon"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0005_deviceappicon_icon"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
