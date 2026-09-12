from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser

from . import geoip
from .models import Child, ChildDevice, EnrollmentCode, InstalledApp


def _device_auth(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


class DeviceDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="parent@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            family=self.parent.family, status=ChildDevice.STATUS_LINKED, child_name="Old name"
        )
        self.url = reverse("device-detail", kwargs={"id": self.device.id})

    def test_rename_device(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.patch(self.url, {"child_name": "Ali"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["child_name"], "Ali")
        self.device.refresh_from_db()
        self.assertEqual(self.device.child_name, "Ali")

    def test_reassign_device_to_another_child(self):
        child = Child.objects.create(family=self.parent.family, name="Laylo")
        self.client.force_authenticate(user=self.parent)
        response = self.client.patch(self.url, {"child_id": str(child.id)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["child_id"], str(child.id))
        self.device.refresh_from_db()
        self.assertEqual(self.device.child_id, child.id)
        self.assertEqual(self.device.child_name, "Laylo")

    def test_reassign_rejects_child_from_another_family(self):
        other = ParentUser.objects.create_user(email="o@example.com", password="supersecret123")
        foreign_child = Child.objects.create(family=other.family, name="NotYours")
        self.client.force_authenticate(user=self.parent)
        response = self.client.patch(self.url, {"child_id": str(foreign_child.id)}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_unlink_device_soft_deletes(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 204)
        self.device.refresh_from_db()
        self.assertIsNone(self.device.family)
        self.assertEqual(self.device.status, ChildDevice.STATUS_UNLINKED)
        # Soft delete — the row itself must still exist.
        self.assertTrue(ChildDevice.objects.filter(id=self.device.id).exists())

    def test_other_family_cannot_rename(self):
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.patch(self.url, {"child_name": "Hacker"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.device.refresh_from_db()
        self.assertEqual(self.device.child_name, "Old name")

    def test_other_family_cannot_unlink(self):
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 403)
        self.device.refresh_from_db()
        self.assertEqual(self.device.status, ChildDevice.STATUS_LINKED)

    def test_requires_authentication(self):
        response = self.client.patch(self.url, {"child_name": "x"}, format="json")
        self.assertEqual(response.status_code, 401)


class VerifyCodeDeviceReplacementTests(TestCase):
    def test_new_pairing_keeps_the_child_s_existing_devices_linked(self):
        parent = ParentUser.objects.create_user(
            email="pairing@example.com", password="supersecret123"
        )
        child = Child.objects.create(family=parent.family, name="Ali")
        previous = ChildDevice.objects.create(
            family=parent.family,
            child=child,
            child_name=child.name,
            status=ChildDevice.STATUS_LINKED,
        )
        current = ChildDevice.objects.create()
        EnrollmentCode.objects.create(
            device=current,
            code="123456",
            qr_payload="chaqimchi://enroll?token=123456",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        client = APIClient()
        client.force_authenticate(user=parent)
        response = client.post(
            reverse("verify-code"), {"code": "123456", "child_id": str(child.id)}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        previous.refresh_from_db()
        current.refresh_from_db()
        # A child can own a laptop and a phone at once. Pairing the second one
        # used to retire the first, so the parent saw it vanish from the
        # dashboard together with its history.
        self.assertEqual(previous.status, ChildDevice.STATUS_LINKED)
        self.assertEqual(current.status, ChildDevice.STATUS_LINKED)
        self.assertEqual(
            ChildDevice.objects.filter(child=child, status=ChildDevice.STATUS_LINKED).count(), 2
        )

    def test_each_device_keeps_its_own_activity(self):
        """Data stays device-scoped — a second device must not absorb the first's."""
        parent = ParentUser.objects.create_user(
            email="two-devices@example.com", password="supersecret123"
        )
        child = Child.objects.create(family=parent.family, name="Ali")
        laptop = ChildDevice.objects.create(
            family=parent.family, child=child, child_name=child.name,
            status=ChildDevice.STATUS_LINKED,
        )
        phone = ChildDevice.objects.create(
            family=parent.family, child=child, child_name=child.name,
            status=ChildDevice.STATUS_LINKED, platform=ChildDevice.PLATFORM_ANDROID,
        )

        client = APIClient()
        for device, app, minutes in ((laptop, "chrome.exe", 30), (phone, "telegram", 10)):
            client.post(
                reverse("ingest"),
                {
                    "device_id": str(device.id),
                    "batch_id": f"batch-{device.id}",
                    "events": [{
                        "type": "app_usage", "app_id": app,
                        "started_at": "2026-08-30T10:00:00Z",
                        "ended_at": f"2026-08-30T10:{minutes:02d}:00Z",
                        "duration_seconds": minutes * 60,
                    }],
                },
                format="json",
                HTTP_AUTHORIZATION=f"Device {device.id}:{device.device_secret}",
            )

        client.force_authenticate(user=parent)
        laptop_summary = client.get(reverse("summary", kwargs={"device_id": laptop.id}), {"date": "2026-08-30"}).json()
        phone_summary = client.get(reverse("summary", kwargs={"device_id": phone.id}), {"date": "2026-08-30"}).json()

        self.assertEqual([a["app"] for a in laptop_summary["top_apps"]], ["chrome.exe"])
        self.assertEqual([a["app"] for a in phone_summary["top_apps"]], ["telegram"])
        self.assertEqual(laptop_summary["total_screen_minutes"], 30)
        self.assertEqual(phone_summary["total_screen_minutes"], 10)


class GenerateCodeFingerprintTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("generate-code")

    def test_first_enrollment_creates_a_device_with_the_fingerprint(self):
        r = self.client.post(self.url, {"device_hint": "PC-1", "hardware_id": "fp-aaa"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.json()["previously_linked"])
        self.assertEqual(ChildDevice.objects.filter(hardware_id="fp-aaa").count(), 1)

    def test_reinstall_on_an_unlinked_device_reuses_the_row(self):
        first = self.client.post(self.url, {"hardware_id": "fp-bbb"}, format="json").json()
        # parent never links it (row stays unlinked); re-run the installer
        second = self.client.post(self.url, {"hardware_id": "fp-bbb"}, format="json").json()
        self.assertEqual(first["device_id"], second["device_id"])
        self.assertNotEqual(first["device_secret"], second["device_secret"])  # rotated
        self.assertEqual(ChildDevice.objects.filter(hardware_id="fp-bbb").count(), 1)

    def test_reinstall_on_a_linked_device_gets_a_fresh_row_and_a_flag(self):
        parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret123")
        linked = ChildDevice.objects.create(
            family=parent.family, status=ChildDevice.STATUS_LINKED, hardware_id="fp-ccc"
        )
        r = self.client.post(self.url, {"hardware_id": "fp-ccc"}, format="json").json()
        self.assertTrue(r["previously_linked"])
        self.assertNotEqual(r["device_id"], str(linked.id))
        self.assertEqual(ChildDevice.objects.filter(hardware_id="fp-ccc").count(), 2)

    def test_no_fingerprint_always_creates_a_new_row(self):
        a = self.client.post(self.url, {}, format="json").json()
        b = self.client.post(self.url, {}, format="json").json()
        self.assertNotEqual(a["device_id"], b["device_id"])


class InstalledAppsSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p2@example.com", password="supersecret123")
        self.device = ChildDevice.objects.create(family=self.parent.family, status=ChildDevice.STATUS_LINKED)
        self.sync_url = reverse("installed-apps-sync", kwargs={"id": self.device.id})
        self.list_url = reverse("installed-apps-list", kwargs={"id": self.device.id})

    def test_sync_creates_entries(self):
        payload = {"apps": [{"name": "Discord", "version": "1.0"}, {"name": "Chrome"}]}
        response = self.client.post(self.sync_url, payload, format="json", **_device_auth(self.device))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(InstalledApp.objects.filter(device=self.device).count(), 2)

    def test_sync_removes_uninstalled_apps(self):
        InstalledApp.objects.create(device=self.device, name="OldApp")
        payload = {"apps": [{"name": "NewApp"}]}
        response = self.client.post(self.sync_url, payload, format="json", **_device_auth(self.device))
        self.assertEqual(response.status_code, 200)
        names = list(InstalledApp.objects.filter(device=self.device).values_list("name", flat=True))
        self.assertEqual(names, ["NewApp"])

    def test_sync_upserts_existing_entry(self):
        InstalledApp.objects.create(device=self.device, name="Discord", version="1.0")
        payload = {"apps": [{"name": "Discord", "version": "2.0"}]}
        self.client.post(self.sync_url, payload, format="json", **_device_auth(self.device))
        app = InstalledApp.objects.get(device=self.device, name="Discord")
        self.assertEqual(app.version, "2.0")

    def test_sync_requires_device_auth(self):
        response = self.client.post(self.sync_url, {"apps": []}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_sync_rejects_unlinked_device(self):
        self.device.status = ChildDevice.STATUS_UNLINKED
        self.device.save(update_fields=["status"])
        response = self.client.post(self.sync_url, {"apps": []}, format="json", **_device_auth(self.device))
        self.assertEqual(response.status_code, 403)

    def test_parent_can_list_installed_apps(self):
        InstalledApp.objects.create(device=self.device, name="Discord")
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["name"], "Discord")

    def test_other_family_cannot_list(self):
        other = ParentUser.objects.create_user(email="o2@example.com", password="supersecret123")
        self.client.force_authenticate(user=other)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 403)


class GeoIpTests(TestCase):
    def setUp(self):
        self.device = ChildDevice.objects.create(status=ChildDevice.STATUS_LINKED)

    def _request(self, ip):
        request = type("R", (), {"META": {"REMOTE_ADDR": ip}})()
        return request

    def test_skips_local_ip(self):
        geoip.update_device_geo_from_ip(self.device, self._request("127.0.0.1"))
        self.device.refresh_from_db()
        self.assertIsNone(self.device.geo_updated_at)

    @patch.object(geoip, "_lookup")
    def test_successful_lookup_updates_device(self, mock_lookup):
        mock_lookup.return_value = {
            "lat": 41.3, "lon": 69.2, "city": "Tashkent", "regionName": "Tashkent", "country": "Uzbekistan",
        }
        geoip.update_device_geo_from_ip(self.device, self._request("8.8.8.8"))
        self.device.refresh_from_db()
        self.assertEqual(self.device.geo_source, ChildDevice.GEO_SOURCE_IP)
        self.assertIn("Tashkent", self.device.geo_location_label)
        self.assertEqual(self.device.last_ip, "8.8.8.8")

    @patch.object(geoip, "_lookup")
    def test_failed_lookup_still_records_ip(self, mock_lookup):
        mock_lookup.return_value = None
        geoip.update_device_geo_from_ip(self.device, self._request("8.8.8.8"))
        self.device.refresh_from_db()
        self.assertEqual(self.device.last_ip, "8.8.8.8")
        self.assertIsNone(self.device.geo_updated_at)

    @patch.object(geoip, "_lookup")
    def test_fresh_gps_is_not_overwritten_by_ip(self, mock_lookup):
        self.device.geo_source = ChildDevice.GEO_SOURCE_GPS
        self.device.geo_updated_at = timezone.now()
        self.device.geo_location_label = "Precise spot"
        self.device.save()
        geoip.update_device_geo_from_ip(self.device, self._request("8.8.8.8"))
        self.device.refresh_from_db()
        self.assertEqual(self.device.geo_source, ChildDevice.GEO_SOURCE_GPS)
        self.assertEqual(self.device.geo_location_label, "Precise spot")
        mock_lookup.assert_not_called()
