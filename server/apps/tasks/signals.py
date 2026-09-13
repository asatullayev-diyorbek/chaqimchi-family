from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import Family

from .models import Wallet


@receiver(post_save, sender=Family)
def _ensure_wallet(sender, instance, created, **kwargs):
    """Every family has exactly one Wallet — mirrors accounts.models'
    _ensure_subscription so no call site has to remember to create one."""
    if created:
        Wallet.objects.get_or_create(family=instance)
