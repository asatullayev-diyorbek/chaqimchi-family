from django.db import migrations


def set_reward(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    Task.objects.filter(type__in=["telegram_story", "instagram_story"]).update(reward_uzs=5000)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0005_remove_taskcompletion_proof_file_id"),
    ]

    operations = [
        migrations.RunPython(set_reward, noop),
    ]
