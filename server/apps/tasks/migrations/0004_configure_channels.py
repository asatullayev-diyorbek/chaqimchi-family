from django.db import migrations

CONFIG = {
    "channel_join": {"channel_username": "@spino24uz"},
    "telegram_story": {
        "target_url": "https://t.me/spino24uz",
        "description": "Kanalimizdan bitta postni story qilib ulashing va story ustiga ID raqamingizni yozing.",
    },
    "instagram_story": {
        "target_url": "https://www.instagram.com/spino24.uz",
        "description": "Instagram sahifamizdan bitta postni story qilib ulashing va story ustiga ID raqamingizni yozing.",
    },
}


def configure(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    for task_type, fields in CONFIG.items():
        Task.objects.filter(type=task_type).update(**fields)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0003_task_target_url"),
    ]

    operations = [
        migrations.RunPython(configure, noop),
    ]
