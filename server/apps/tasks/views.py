from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser

from . import service
from .models import Task, TaskCompletion


def _require_parent(request):
    return request.user if isinstance(request.user, ParentUser) else None


class TaskListView(APIView):
    """GET /api/tasks/ — everything the parent-mobile "Vazifalar" screen
    needs in one call: each task's status, the wallet balance, the parent's
    referral link, and the 4-digit id they write on a reposted story."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.conf import settings

        parent = _require_parent(request)
        if parent is None:
            return Response({"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=401)

        completions = {c.task_id: c for c in TaskCompletion.objects.filter(parent=parent)}
        tasks = []
        for task in Task.objects.filter(is_active=True):
            completion = completions.get(task.id)
            target_url = task.target_url
            if task.type == Task.TYPE_CHANNEL_JOIN and task.channel_username:
                target_url = f"https://t.me/{task.channel_username.lstrip('@')}"
            tasks.append({
                "type": task.type,
                "title": task.title,
                "description": task.description,
                "reward_uzs": task.reward_uzs,
                "target_url": target_url,
                "status": completion.status if completion else None,
                "note": completion.note if completion else "",
            })

        return Response({
            "balance_uzs": service.get_wallet(parent.family).balance_uzs,
            "short_id": parent.short_id,
            "referral_link": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=ref_{parent.id}",
            "tasks": tasks,
        })


class ChannelCheckView(APIView):
    """POST /api/tasks/channel/check/ — the PWA's "A'zo bo'ldim, tekshirish"
    button. Auto-approves + credits the wallet (and the referrer, if any)
    the same way the bot's inline button does."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        parent = _require_parent(request)
        if parent is None:
            return Response({"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=401)

        if not service.is_channel_member(parent):
            return Response({"member": False})
        completion = service.complete_channel_join(parent)
        return Response({"member": True, "status": completion.status if completion else None})
