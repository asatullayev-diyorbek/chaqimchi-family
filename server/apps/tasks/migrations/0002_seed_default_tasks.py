from django.db import migrations

DEFAULT_TASKS = [
    {
        "type": "channel_join",
        "title": "Kanalga a'zolik",
        "description": "Rasmiy Telegram kanalimizga a'zo bo'ling.",
        "reward_uzs": 1000,
        "channel_username": "",  # TODO: to'ldiring — Django admin > Tasks > Task
    },
    {
        "type": "referral",
        "title": "Do'stni taklif qilish",
        "description": "Do'stingizni taklif qiling — u kanalga a'zo bo'lgach, balansingizga tushadi.",
        "reward_uzs": 1000,
        "channel_username": "",
    },
    {
        "type": "telegram_story",
        "title": "Telegram'da story",
        "description": "Shaxsiy rasmni story'ga qo'ying va screenshot yuboring.",
        "reward_uzs": 1500,
        "channel_username": "",
    },
    {
        "type": "instagram_story",
        "title": "Instagram'da story",
        "description": "Story'da @Spino24 akkauntini belgilang (mention).",
        "reward_uzs": 1500,
        "channel_username": "",
    },
]


def seed_tasks(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    for defaults in DEFAULT_TASKS:
        Task.objects.get_or_create(type=defaults["type"], defaults=defaults)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_tasks, noop),
    ]
