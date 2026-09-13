"""Task completion + wallet crediting logic — shared by the bot
(botmenu.py, telegram.py) and the parent-mobile "Vazifalar" API views.
Kept out of the model classes themselves so the reward-chaining rules
(referral only pays out once the referred friend joins the channel) live in
one obvious place.

The two story tasks (Task.STORY_TYPES) have no submission step at all: a
parent just posts the story, and an admin who spots it approves the task by
hand in Django admin (see apps.tasks.admin.TaskCompletionAdmin) — there is
deliberately no bot/PWA "submit proof" flow to keep in sync with that.
"""

from apps.accounts import tg_api

from .models import Task, TaskCompletion, Wallet


def get_task(task_type: str) -> Task | None:
    return Task.objects.filter(type=task_type, is_active=True).first()


def get_wallet(family) -> Wallet:
    return Wallet.objects.get_or_create(family=family)[0]


def is_channel_member(parent) -> bool:
    task = get_task(Task.TYPE_CHANNEL_JOIN)
    if task is None or not task.channel_username or not parent.telegram_id:
        return False
    result = tg_api.call(
        "getChatMember", {"chat_id": task.channel_username, "user_id": parent.telegram_id}
    )
    if not result or not result.get("ok"):
        return False
    status = (result.get("result") or {}).get("status")
    return status in ("member", "administrator", "creator")


def complete_channel_join(parent) -> TaskCompletion | None:
    """Auto-verified: called when the user taps "tekshirish" and
    is_channel_member() confirms it. Idempotent — re-checking an
    already-approved completion never re-credits the wallet or the
    referrer."""
    task = get_task(Task.TYPE_CHANNEL_JOIN)
    if task is None:
        return None
    completion, created = TaskCompletion.objects.get_or_create(task=task, parent=parent)
    already_approved = not created and completion.status == TaskCompletion.STATUS_APPROVED
    if not already_approved:
        completion.approve(reviewed_by="auto:getChatMember")
        _credit_referrer_if_any(parent)
    return completion


def _credit_referrer_if_any(referred_parent):
    """The referral reward is unlimited per referrer (one per friend who
    joins the channel), so it's posted directly as a wallet transaction
    rather than a one-per-parent TaskCompletion row."""
    referrer = referred_parent.referred_by
    if referrer is None:
        return
    referral_task = get_task(Task.TYPE_REFERRAL)
    if referral_task is None:
        return
    who = referred_parent.full_name or referred_parent.telegram_username or f"id{referred_parent.id}"
    get_wallet(referrer.family).credit(referral_task.reward_uzs, f"Referral: {who} kanalga a'zo bo'ldi")
