from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from .models import Event, EventBatch


def auth_header(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


class IngestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.linked_device = ChildDevice.objects.create(status=ChildDevice.STATUS_LINKED)
        self.unlinked_device = ChildDevice.objects.create(status=ChildDevice.STATUS_UNLINKED)
        self.url = reverse("ingest")

    def _payload(self, device, batch_id="batch-1"):
        return {
            "device_id": str(device.id),
            "batch_id": batch_id,
            "events": [
                {
                    "type": "app_usage",
                    "app": "chrome.exe",
                    "started_at": "2026-07-28T10:00:00Z",
                    "ended_at": "2026-07-28T10:05:00Z",
                },
                {
                    "type": "device_state",
                    "battery": 87,
                    "online": True,
                    "occurred_at": "2026-07-28T10:05:00Z",
                },
            ],
        }

    def test_ingest_stores_events_for_linked_device(self):
        response = self.client.post(
            self.url,
            self._payload(self.linked_device),
            format="json",
            **auth_header(self.linked_device),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(EventBatch.objects.count(), 1)
        self.assertEqual(Event.objects.count(), 2)
        types = set(Event.objects.values_list("event_type", flat=True))
        self.assertEqual(types, {"app_usage", "device_state"})

    def test_duplicate_batch_id_is_idempotent(self):
        payload = self._payload(self.linked_device, batch_id="dup-batch")
        first = self.client.post(
            self.url, payload, format="json", **auth_header(self.linked_device)
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(EventBatch.objects.count(), 1)
        self.assertEqual(Event.objects.count(), 2)

        second = self.client.post(
            self.url, payload, format="json", **auth_header(self.linked_device)
        )
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()["duplicate"])
        # No new rows were created — DB state unchanged.
        self.assertEqual(EventBatch.objects.count(), 1)
        self.assertEqual(Event.objects.count(), 2)

    def test_unlinked_device_is_rejected(self):
        response = self.client.post(
            self.url,
            self._payload(self.unlinked_device),
            format="json",
            **auth_header(self.unlinked_device),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(EventBatch.objects.count(), 0)

    def test_unknown_event_type_is_skipped_not_fatal(self):
        payload = self._payload(self.linked_device, batch_id="batch-unknown")
        payload["events"].append({"type": "mystery_event", "foo": "bar"})

        response = self.client.post(
            self.url, payload, format="json", **auth_header(self.linked_device)
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["events_saved"], 2)
        self.assertEqual(response.json()["events_skipped"], 1)
        self.assertEqual(Event.objects.count(), 2)

    def test_missing_auth_is_rejected(self):
        response = self.client.post(
            self.url, self._payload(self.linked_device), format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_wrong_device_secret_is_rejected(self):
        response = self.client.post(
            self.url,
            self._payload(self.linked_device),
            format="json",
            HTTP_AUTHORIZATION=f"Device {self.linked_device.id}:wrong-secret",
        )
        self.assertEqual(response.status_code, 401)


def make_app_usage_event(device, batch, app, started_at, ended_at):
    return Event.objects.create(
        batch=batch,
        device=device,
        event_type="app_usage",
        payload={
            "type": "app_usage",
            "app": app,
            "started_at": started_at,
            "ended_at": ended_at,
        },
        occurred_at=started_at,
    )


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class SummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="parent@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            family=self.parent.family, status=ChildDevice.STATUS_LINKED
        )
        self.batch = EventBatch.objects.create(device=self.device, batch_id="b1")

        today = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)

        self.today_str = today.date().isoformat()

        make_app_usage_event(
            self.device, self.batch, "chrome.exe",
            iso(today), iso(today + timedelta(minutes=90)),
        )
        make_app_usage_event(
            self.device, self.batch, "vscode.exe",
            iso(today + timedelta(hours=2)), iso(today + timedelta(hours=2, minutes=45)),
        )
        # A different day — must not be counted in today's summary.
        make_app_usage_event(
            self.device, self.batch, "chrome.exe",
            iso(yesterday), iso(yesterday + timedelta(hours=1)),
        )

        self.url = reverse("summary", kwargs={"device_id": self.device.id})

    def test_summary_computes_total_and_top_apps(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today_str})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_screen_minutes"], 135)
        self.assertEqual(
            data["top_apps"],
            [{"app": "chrome.exe", "minutes": 90}, {"app": "vscode.exe", "minutes": 45}],
        )

    def test_summary_rejects_other_family_device(self):
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.get(self.url, {"date": self.today_str})
        self.assertEqual(response.status_code, 403)

    def test_summary_requires_authentication(self):
        response = self.client.get(self.url, {"date": self.today_str})
        self.assertEqual(response.status_code, 401)

    def test_summary_defaults_to_today_when_date_omitted(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        # Omitting ?date should default to server "today", which is exactly
        # where the 90+45 minute fixtures above live.
        self.assertEqual(response.json()["total_screen_minutes"], 135)

    def test_summary_default_range_day_includes_breakdown_of_one(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today_str})
        self.assertEqual(response.status_code, 200)
        breakdown = response.json()["breakdown"]
        self.assertEqual(len(breakdown), 1)
        self.assertEqual(breakdown[0], {"date": self.today_str, "total_minutes": 135})

    def test_summary_range_week_aggregates_across_days(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today_str, "range": "week"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # today (135) + yesterday (60) = 195; the other 5 days in the
        # trailing week have no events.
        self.assertEqual(data["total_screen_minutes"], 195)
        self.assertEqual(
            data["top_apps"],
            [{"app": "chrome.exe", "minutes": 150}, {"app": "vscode.exe", "minutes": 45}],
        )
        self.assertEqual(len(data["breakdown"]), 7)
        self.assertEqual(data["breakdown"][-1]["total_minutes"], 135)  # today, last entry
        self.assertEqual(data["breakdown"][-2]["total_minutes"], 60)  # yesterday

    def test_summary_rejects_invalid_range(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today_str, "range": "year"})
        self.assertEqual(response.status_code, 400)
