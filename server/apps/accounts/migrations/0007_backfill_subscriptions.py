from django.db import migrations


def create_subscriptions(apps, schema_editor):
    Family = apps.get_model("accounts", "Family")
    Subscription = apps.get_model("accounts", "Subscription")
    for family in Family.objects.filter(subscription__isnull=True):
        Subscription.objects.create(family=family)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_parentuser_last_onboarding_reminder_at_and_more"),
    ]

    operations = [
        migrations.RunPython(create_subscriptions, noop),
    ]
