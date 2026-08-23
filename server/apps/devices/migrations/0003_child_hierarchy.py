import uuid

from django.db import migrations, models
import django.db.models.deletion


def assign_existing_devices(apps, schema_editor):
    Child = apps.get_model("devices", "Child")
    Device = apps.get_model("devices", "ChildDevice")
    for device in Device.objects.filter(family__isnull=False, child__isnull=True):
        name = device.child_name or "Farzand"
        child = Child.objects.filter(family_id=device.family_id, name=name).first()
        if child is None:
            child = Child.objects.create(id=uuid.uuid4(), family_id=device.family_id, name=name)
        device.child_id = child.id
        device.save(update_fields=["child"])


class Migration(migrations.Migration):
    dependencies = [("devices", "0002_childdevice_last_sync")]
    operations = [
        migrations.CreateModel(name="Child", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("name", models.CharField(max_length=100)), ("created_at", models.DateTimeField(auto_now_add=True)), ("family", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="children", to="accounts.family"))]),
        migrations.AddField(model_name="childdevice", name="child", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="devices", to="devices.child")),
        migrations.AddField(model_name="childdevice", name="platform", field=models.CharField(choices=[("windows", "Windows"), ("android", "Android"), ("ios", "iOS")], default="windows", max_length=20)),
        migrations.RunPython(assign_existing_devices, migrations.RunPython.noop),
    ]
