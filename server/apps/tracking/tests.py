from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

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
