from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Family, ParentUser
from apps.devices.models import ChildDevice

from .models import ScreenshotCleanupRun, ScreenshotRequest

R2_ON = dict(
    R2_ENDPOINT_URL="https://acct.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID="key",
    R2_SECRET_ACCESS_KEY="secret",
    SCREENSHOTS_CRON_SECRET="cron-secret",
)


def device_auth(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


@override_settings(**R2_ON)
class ScreenshotFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.family = Family.objects.create()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="x", family=self.family
        )
        self.device = ChildDevice.objects.create(
            family=self.family, status=ChildDevice.STATUS_LINKED, last_sync=timezone.now()
        )
        self.other_family = Family.objects.create()
        self.other_parent = ParentUser.objects.create_user(
            email="o@example.com", password="x", family=self.other_family
        )

    def _auth_parent(self, parent=None):
        self.client.force_authenticate(user=parent or self.parent)

    # --- request -----------------------------------------------------------
    def test_parent_queues_request(self):
        self._auth_parent()
        resp = self.client.post(
            reverse("screenshot-request"),
            {"device_id": str(self.device.id), "retention": "day"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["status"], "pending")
        self.assertEqual(resp.data["retention"], "day")
        self.assertTrue(resp.data["device_online"])
        shot = ScreenshotRequest.objects.get()
        self.assertEqual(shot.requested_by, self.parent)

    def test_retention_defaults_to_week(self):
        self._auth_parent()
        resp = self.client.post(
            reverse("screenshot-request"), {"device_id": str(self.device.id)}, format="json"
        )
        self.assertEqual(resp.data["retention"], "week")

    def test_cannot_request_other_familys_device(self):
        self._auth_parent(self.other_parent)
        resp = self.client.post(
            reverse("screenshot-request"), {"device_id": str(self.device.id)}, format="json"
        )
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(ScreenshotRequest.objects.exists())

    def test_rate_limited_after_six_per_hour(self):
        self._auth_parent()
        for _ in range(6):
            ScreenshotRequest.objects.create(device=self.device, requested_by=self.parent)
        resp = self.client.post(
            reverse("screenshot-request"), {"device_id": str(self.device.id)}, format="json"
        )
        self.assertEqual(resp.status_code, 429)

    def test_rate_limit_ignores_old_requests(self):
        # Plan quota is a separate, lower-value gate (see PlanQuotaTests) —
        # put this family on Max so only the hourly throttle under test
        # applies.
        self.family.subscription.plan = "max"
        self.family.subscription.save(update_fields=["plan"])
        self._auth_parent()
        old = ScreenshotRequest.objects.create(device=self.device)
        ScreenshotRequest.objects.filter(id=old.id).update(
            created_at=timezone.now() - timedelta(hours=2)
        )
        for _ in range(5):
            ScreenshotRequest.objects.create(device=self.device)
        resp = self.client.post(
            reverse("screenshot-request"), {"device_id": str(self.device.id)}, format="json"
        )
        self.assertEqual(resp.status_code, 201)

    @override_settings(R2_ENDPOINT_URL="", R2_ACCESS_KEY_ID="", R2_SECRET_ACCESS_KEY="")
    def test_503_when_storage_unconfigured(self):
        self._auth_parent()
        resp = self.client.post(
            reverse("screenshot-request"), {"device_id": str(self.device.id)}, format="json"
        )
        self.assertEqual(resp.status_code, 503)

    # --- agent -----------------------------------------------------------
    def test_agent_pending_only_sees_own_device(self):
        mine = ScreenshotRequest.objects.create(device=self.device)
        other_dev = ChildDevice.objects.create(
            family=self.other_family, status=ChildDevice.STATUS_LINKED
        )
        ScreenshotRequest.objects.create(device=other_dev)
        resp = self.client.get(reverse("screenshot-pending"), **device_auth(self.device))
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in resp.data["results"]]
        self.assertEqual(ids, [str(mine.id)])

    @mock.patch("apps.screenshots.r2.presigned_put", return_value="https://put.example/x")
    def test_upload_url_then_confirm_sets_expiry(self, _presign):
        shot = ScreenshotRequest.objects.create(device=self.device, retention="week")
        resp = self.client.post(
            reverse("screenshot-upload-url", args=[shot.id]), **device_auth(self.device)
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["upload_url"], "https://put.example/x")
        shot.refresh_from_db()
        self.assertEqual(shot.status, "capturing")
        self.assertEqual(shot.r2_key, f"screenshots/{self.device.id}/{shot.id}.jpg")

        captured = timezone.now()
        resp = self.client.post(
            reverse("screenshot-confirm", args=[shot.id]),
            {
                "captured_at": captured.isoformat(),
                "width": 1920,
                "height": 1080,
                "size_bytes": 240_000,
                "sha256": "a" * 64,
            },
            format="json",
            **device_auth(self.device),
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        shot.refresh_from_db()
        self.assertEqual(shot.status, "uploaded")
        self.assertAlmostEqual(
            (shot.expires_at - captured).total_seconds(), 7 * 86400, delta=5
        )

    def test_confirm_rejects_oversized(self):
        shot = ScreenshotRequest.objects.create(device=self.device)
        resp = self.client.post(
            reverse("screenshot-confirm", args=[shot.id]),
            {"size_bytes": 20 * 1024 * 1024},
            format="json",
            **device_auth(self.device),
        )
        self.assertEqual(resp.status_code, 413)

    def test_agent_cannot_touch_other_devices_request(self):
        other_dev = ChildDevice.objects.create(
            family=self.other_family, status=ChildDevice.STATUS_LINKED
        )
        shot = ScreenshotRequest.objects.create(device=other_dev)
        resp = self.client.post(
            reverse("screenshot-upload-url", args=[shot.id]), **device_auth(self.device)
        )
        self.assertEqual(resp.status_code, 403)

    def test_failed_endpoint(self):
        shot = ScreenshotRequest.objects.create(device=self.device)
        resp = self.client.post(
            reverse("screenshot-failed", args=[shot.id]),
            {"error": "no active session"},
            format="json",
            **device_auth(self.device),
        )
        self.assertEqual(resp.status_code, 200)
        shot.refresh_from_db()
        self.assertEqual(shot.status, "failed")
        self.assertEqual(shot.error, "no active session")

    # --- list / delete ---------------------------------------------------
    @mock.patch("apps.screenshots.r2.presigned_get", return_value="https://get.example/x")
    def test_list_presigns_only_viewable_rows(self, _presign):
        uploaded = ScreenshotRequest.objects.create(device=self.device, r2_key="k1")
        uploaded.mark_uploaded(
            captured_at=timezone.now(), width=1, height=1, size_bytes=1, sha256=""
        )
        ScreenshotRequest.objects.create(device=self.device)  # pending, no url
        expired = ScreenshotRequest.objects.create(device=self.device, r2_key="k2")
        expired.mark_uploaded(
            captured_at=timezone.now() - timedelta(days=40),
            width=1, height=1, size_bytes=1, sha256="",
        )

        self._auth_parent()
        resp = self.client.get(reverse("screenshot-list"), {"device_id": str(self.device.id)})
        self.assertEqual(resp.status_code, 200)
        by_id = {r["id"]: r for r in resp.data["results"]}
        self.assertEqual(by_id[str(uploaded.id)]["url"], "https://get.example/x")
        # pending row present but no url
        pending_row = next(r for r in resp.data["results"] if r["status"] == "pending")
        self.assertIsNone(pending_row["url"])
        # expired row filtered out of the list entirely
        self.assertNotIn(str(expired.id), by_id)

    @mock.patch("apps.screenshots.r2.delete_keys")
    def test_delete_removes_object_and_row(self, delete_keys):
        shot = ScreenshotRequest.objects.create(device=self.device, r2_key="k1")
        self._auth_parent()
        resp = self.client.delete(reverse("screenshot-detail", args=[shot.id]))
        self.assertEqual(resp.status_code, 204)
        delete_keys.assert_called_once_with(["k1"])
        self.assertFalse(ScreenshotRequest.objects.filter(id=shot.id).exists())

    def test_delete_other_family_forbidden(self):
        shot = ScreenshotRequest.objects.create(device=self.device)
        self._auth_parent(self.other_parent)
        resp = self.client.delete(reverse("screenshot-detail", args=[shot.id]))
        self.assertEqual(resp.status_code, 403)

    # --- cleanup -------------------------------------------------------
    @mock.patch("apps.screenshots.r2.delete_keys", return_value=2)
    def test_cleanup_deletes_expired_and_expires_unclaimed(self, delete_keys):
        exp = ScreenshotRequest.objects.create(device=self.device, r2_key="old")
        exp.mark_uploaded(
            captured_at=timezone.now() - timedelta(days=40),
            width=1, height=1, size_bytes=1, sha256="",
        )
        stale = ScreenshotRequest.objects.create(device=self.device, r2_key="stale")
        ScreenshotRequest.objects.filter(id=stale.id).update(
            status="capturing", created_at=timezone.now() - timedelta(hours=3)
        )
        fresh = ScreenshotRequest.objects.create(device=self.device)

        resp = self.client.post(
            reverse("screenshot-cleanup"), HTTP_X_SCREENSHOTS_SECRET="cron-secret"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["expired"], 1)
        self.assertEqual(resp.data["unclaimed"], 1)
        self.assertFalse(ScreenshotRequest.objects.filter(id=exp.id).exists())
        stale.refresh_from_db()
        self.assertEqual(stale.status, "expired")
        fresh.refresh_from_db()
        self.assertEqual(fresh.status, "pending")
        self.assertEqual(ScreenshotCleanupRun.objects.count(), 1)
        delete_keys.assert_called_once()

    def test_cleanup_rejects_bad_secret(self):
        resp = self.client.post(
            reverse("screenshot-cleanup"), HTTP_X_SCREENSHOTS_SECRET="wrong"
        )
        self.assertEqual(resp.status_code, 403)
