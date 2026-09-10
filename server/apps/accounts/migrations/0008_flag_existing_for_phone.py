from django.db import migrations


def flag(apps, schema_editor):
    """Telegram-linked accounts created before the phone step now owe a
    phone number too. This only sets the flag — the actual prompt goes out
    via the drip reminder / the notify_phone_required command."""
    ParentUser = apps.get_model("accounts", "ParentUser")
    ParentUser.objects.filter(
        telegram_id__isnull=False, phone="", onboarding_required=False
    ).update(onboarding_required=True)


def unflag(apps, schema_editor):
    ParentUser = apps.get_model("accounts", "ParentUser")
    ParentUser.objects.filter(
        telegram_id__isnull=False, phone="", onboarding_required=True,
        onboarding_reminders_sent=0,
    ).update(onboarding_required=False)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_backfill_subscriptions"),
    ]

    operations = [
        migrations.RunPython(flag, unflag),
    ]
