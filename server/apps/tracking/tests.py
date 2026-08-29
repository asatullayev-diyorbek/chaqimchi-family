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
        self.assertEqual(response.json()["batch_id"], "batch-1")
        self.assertTrue(response.json()["acknowledged"])
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
        self.assertEqual(second.json()["batch_id"], "dup-batch")
        self.assertTrue(second.json()["acknowledged"])
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
            [{"app": app["app"], "minutes": app["minutes"]} for app in data["top_apps"]],
            [{"app": "chrome.exe", "minutes": 90}, {"app": "vscode.exe", "minutes": 45}],
        )
        self.assertTrue(data["top_apps"][0]["last_used_at"])

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
            [{"app": app["app"], "minutes": app["minutes"]} for app in data["top_apps"]],
            [{"app": "chrome.exe", "minutes": 150}, {"app": "vscode.exe", "minutes": 45}],
        )
        self.assertEqual(len(data["breakdown"]), 7)
        self.assertEqual(data["breakdown"][-1]["total_minutes"], 135)  # today, last entry
        self.assertEqual(data["breakdown"][-2]["total_minutes"], 60)  # yesterday

    def test_summary_rejects_invalid_range(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today_str, "range": "year"})
        self.assertEqual(response.status_code, 400)

    def test_summary_battery_is_null_without_device_state(self):
        self.client.force_authenticate(user=self.parent)
        data = self.client.get(self.url, {"date": self.today_str}).json()
        self.assertIsNone(data["battery_percent"])
        self.assertIsNone(data["battery_updated_at"])

    def test_summary_reports_latest_battery_from_device_state(self):
        now = timezone.now()
        Event.objects.create(
            batch=self.batch, device=self.device, event_type="device_state",
            payload={"type": "device_state", "battery_percent": 61},
            occurred_at=now - timedelta(minutes=5),
        )
        Event.objects.create(
            batch=self.batch, device=self.device, event_type="device_state",
            payload={"type": "device_state", "battery_percent": 58},
            occurred_at=now,
        )
        self.client.force_authenticate(user=self.parent)
        data = self.client.get(self.url, {"date": self.today_str}).json()
        self.assertEqual(data["battery_percent"], 58)
        self.assertIsNotNone(data["battery_updated_at"])

    def test_summary_ignores_unavailable_battery(self):
        Event.objects.create(
            batch=self.batch, device=self.device, event_type="device_state",
            payload={"type": "device_state", "battery_percent": -1},
            occurred_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.parent)
        data = self.client.get(self.url, {"date": self.today_str}).json()
        self.assertIsNone(data["battery_percent"])


class ActivityHistoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="history-parent@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            family=self.parent.family, status=ChildDevice.STATUS_LINKED
        )
        self.batch = EventBatch.objects.create(device=self.device, batch_id="history-b1")
        today = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)
        self.today = today.date().isoformat()
        for index in range(3):
            started = today + timedelta(minutes=index * 10)
            event = make_app_usage_event(
                self.device, self.batch, f"app-{index}.exe", iso(started), iso(started + timedelta(minutes=2))
            )
            event.payload["duration_seconds"] = 120
            event.save(update_fields=["payload"])
        self.url = reverse("history", kwargs={"device_id": self.device.id})

    def test_history_returns_app_usage_with_pagination(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": self.today, "limit": 2})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(len(data["results"]), 2)
        self.assertEqual(data["results"][0]["app_name"], "app-2.exe")
        self.assertEqual(data["results"][0]["duration_seconds"], 120)
        self.assertEqual(data["next_offset"], 2)

    def test_history_date_filter_and_empty_result(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.url, {"date": "2000-01-01"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
        self.assertEqual(response.json()["count"], 0)

    def test_history_rejects_other_family(self):
        other_parent = ParentUser.objects.create_user(
            email="other-history@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_history_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_history_rejects_invalid_pagination(self):
        self.client.force_authenticate(user=self.parent)
        self.assertEqual(self.client.get(self.url, {"limit": 0}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {"offset": -1}).status_code, 400)


# A real 1x1 PNG — enough to pass the magic-byte + base64 checks.
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


class AppIconIngestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="icon@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            status=ChildDevice.STATUS_LINKED, family=self.parent.family
        )
        self.ingest_url = reverse("ingest")
        self.summary_url = reverse("summary", kwargs={"device_id": self.device.id})

    def _icon_event(self, app_id="chrome.exe", b64=_PNG_B64):
        import base64
        import hashlib

        return {
            "type": "app_icon",
            "app_id": app_id,
            "sha256": hashlib.sha256(base64.b64decode(b64)).hexdigest(),
            "png_b64": b64,
        }

    def _ingest(self, events, batch_id="b-icon"):
        return self.client.post(
            self.ingest_url,
            {"device_id": str(self.device.id), "batch_id": batch_id, "events": events},
            format="json",
            **auth_header(self.device),
        )

    def test_app_icon_event_is_stored_not_as_event_row(self):
        from .models import DeviceAppIcon

        response = self._ingest([self._icon_event()])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["icons_updated"], 1)
        self.assertEqual(Event.objects.filter(event_type="app_icon").count(), 0)
        self.assertEqual(DeviceAppIcon.objects.filter(device=self.device, app_id="chrome.exe").count(), 1)

    def test_resending_same_icon_is_a_noop(self):
        self._ingest([self._icon_event()], batch_id="b1")
        response = self._ingest([self._icon_event()], batch_id="b2")
        self.assertEqual(response.json()["icons_updated"], 0)

    def test_invalid_icon_payload_is_skipped(self):
        bad = {"type": "app_icon", "app_id": "x.exe", "sha256": "nothex", "png_b64": "zzzz"}
        response = self._ingest([bad])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["icons_updated"], 0)
        self.assertEqual(response.json()["events_skipped"], 1)

    def test_oversized_icon_is_rejected(self):
        response = self._ingest([self._icon_event(b64="A" * (200 * 1024))])
        self.assertEqual(response.json()["icons_updated"], 0)

    def test_summary_top_apps_include_icon_data_uri(self):
        self._ingest(
            [
                {
                    "type": "app_usage",
                    "app_id": "chrome.exe",
                    "started_at": "2026-07-28T10:00:00Z",
                    "ended_at": "2026-07-28T10:10:00Z",
                    "duration_seconds": 600,
                },
                self._icon_event(),
            ]
        )
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.summary_url, {"date": "2026-07-28"})
        self.assertEqual(response.status_code, 200)
        top = response.json()["top_apps"][0]
        self.assertEqual(top["app"], "chrome.exe")
        self.assertTrue(top["icon"].startswith("data:image/png;base64,"))

    def test_summary_icon_is_null_when_unknown(self):
        self._ingest(
            [
                {
                    "type": "app_usage",
                    "app_id": "mystery.exe",
                    "started_at": "2026-07-28T10:00:00Z",
                    "ended_at": "2026-07-28T10:10:00Z",
                    "duration_seconds": 600,
                }
            ]
        )
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.summary_url, {"date": "2026-07-28"})
        self.assertIsNone(response.json()["top_apps"][0]["icon"])


class AgentVersionAndLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="ver@example.com", password="supersecret123")
        self.device = ChildDevice.objects.create(status=ChildDevice.STATUS_LINKED, family=self.parent.family)
        self.ingest_url = reverse("ingest")

    def _ingest(self, events, agent=None, batch_id="v-b1"):
        body = {"device_id": str(self.device.id), "batch_id": batch_id, "events": events}
        if agent is not None:
            body["agent"] = agent
        return self.client.post(self.ingest_url, body, format="json", **auth_header(self.device))

    def test_ingest_records_reported_agent_version(self):
        self._ingest(
            [{"type": "device_state", "occurred_at": "2026-08-30T10:00:00Z"}],
            agent={"version": "0.5.0", "platform": "windows"},
        )
        self.device.refresh_from_db()
        self.assertEqual(self.device.agent_version, "0.5.0")

    def test_agent_lifecycle_events_are_stored(self):
        response = self._ingest(
            [
                {"type": "agent_updated", "detail": "0.4.0 -> 0.5.0", "occurred_at": "2026-08-30T10:00:00Z"},
                {"type": "agent_update_failed", "detail": "0.4.0 -> 0.6.0: crash", "occurred_at": "2026-08-30T10:05:00Z"},
            ]
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["events_saved"], 2)
        self.assertEqual(
            set(Event.objects.values_list("event_type", flat=True)),
            {"agent_updated", "agent_update_failed"},
        )

    def test_summary_exposes_agent_version(self):
        self._ingest(
            [{"type": "device_state", "occurred_at": "2026-08-30T10:00:00Z"}],
            agent={"version": "0.5.0", "platform": "windows"},
        )
        self.client.force_authenticate(user=self.parent)
        url = reverse("summary", kwargs={"device_id": self.device.id})
        self.assertEqual(self.client.get(url).json()["agent_version"], "0.5.0")
