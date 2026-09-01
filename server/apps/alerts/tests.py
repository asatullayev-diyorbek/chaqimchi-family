from unittest import mock

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser
from apps.devices.models import Child, ChildDevice

from .models import Alert


def device_auth_header(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


class AlertTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="parent@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            family=self.parent.family, status=ChildDevice.STATUS_LINKED
        )

    def test_report_alert_via_device_secret_auth(self):
        response = self.client.post(
            reverse("alerts-report"),
            {"alert_type": "blocked_app_opened", "payload": {"app": "steam.exe"}},
            format="json",
            **device_auth_header(self.device),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Alert.objects.count(), 1)
        alert = Alert.objects.first()
        self.assertEqual(alert.device, self.device)
        self.assertEqual(alert.alert_type, "blocked_app_opened")

    @mock.patch("apps.alerts.notifications.send_text")
    def test_settings_panel_access_alert_pushes_telegram_to_family_parents(self, send_text):
        child = Child.objects.create(family=self.parent.family, name="Ali")
        self.device.child = child
        self.device.save(update_fields=["child"])
        self.parent.telegram_id = 555_000_111
        self.parent.save(update_fields=["telegram_id"])

        response = self.client.post(
            reverse("alerts-report"),
            {"alert_type": "settings_panel_access", "payload": {"source": "tray"}},
            format="json",
            **device_auth_header(self.device),
        )
        self.assertEqual(response.status_code, 201)
        send_text.assert_called_once()
        chat_id, text = send_text.call_args[0]
        self.assertEqual(chat_id, 555_000_111)
        self.assertIn("Kattalar", text)

    @mock.patch("apps.alerts.notifications.send_text")
    def test_every_alert_type_pushes_telegram_by_default(self, send_text):
        self.parent.telegram_id = 999
        self.parent.save(update_fields=["telegram_id"])
        self.client.post(
            reverse("alerts-report"),
            {"alert_type": "blocked_app_opened", "payload": {"app": "steam.exe"}},
            format="json",
            **device_auth_header(self.device),
        )
        send_text.assert_called_once()
        self.assertIn("steam.exe", send_text.call_args[0][1])

    @mock.patch("apps.alerts.notifications.send_text")
    def test_parent_opt_out_suppresses_that_alert_type(self, send_text):
        from .models import NotificationPreference

        self.parent.telegram_id = 999
        self.parent.save(update_fields=["telegram_id"])
        NotificationPreference.objects.create(
            parent=self.parent, alert_type="blocked_app_opened", via_telegram=False
        )
        self.client.post(
            reverse("alerts-report"),
            {"alert_type": "blocked_app_opened", "payload": {"app": "steam.exe"}},
            format="json",
            **device_auth_header(self.device),
        )
        send_text.assert_not_called()
        # a different type is still delivered
        self.client.post(
            reverse("alerts-report"),
            {"alert_type": "limit_reached", "payload": {}},
            format="json",
            **device_auth_header(self.device),
        )
        send_text.assert_called_once()

    def test_preferences_get_and_put(self):
        self.client.force_authenticate(user=self.parent)
        r = self.client.get(reverse("notification-preferences"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["alerts"]), 3)
        self.assertTrue(all(a["via_telegram"] for a in r.json()["alerts"]))

        r = self.client.put(
            reverse("notification-preferences"),
            {"alerts": [{"alert_type": "limit_reached", "via_telegram": False}]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        prefs = {a["alert_type"]: a["via_telegram"] for a in r.json()["alerts"]}
        self.assertFalse(prefs["limit_reached"])
        self.assertTrue(prefs["blocked_app_opened"])

    def test_report_alert_requires_device_auth(self):
        response = self.client.post(
            reverse("alerts-report"),
            {"alert_type": "limit_reached", "payload": {}},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_parent_lists_alerts_newest_first(self):
        older = Alert.objects.create(
            device=self.device,
            alert_type="limit_reached",
            payload={},
            triggered_at=timezone.now() - timezone.timedelta(hours=1),
        )
        newer = Alert.objects.create(
            device=self.device,
            alert_type="blocked_app_opened",
            payload={"app": "steam.exe"},
            triggered_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.parent)
        response = self.client.get(reverse("alerts-device-list", kwargs={"device_id": self.device.id}))
        self.assertEqual(response.status_code, 200)
        ids = [a["id"] for a in response.json()]
        self.assertEqual(ids, [str(newer.id), str(older.id)])

    def test_other_family_cannot_list_alerts(self):
        Alert.objects.create(
            device=self.device, alert_type="limit_reached", payload={}, triggered_at=timezone.now()
        )
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.get(reverse("alerts-device-list", kwargs={"device_id": self.device.id}))
        self.assertEqual(response.status_code, 403)

    def test_mark_alert_seen(self):
        alert = Alert.objects.create(
            device=self.device, alert_type="limit_reached", payload={}, triggered_at=timezone.now()
        )
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(reverse("alerts-mark-seen", kwargs={"alert_id": alert.id}))
        self.assertEqual(response.status_code, 200)
        alert.refresh_from_db()
        self.assertTrue(alert.seen)

    def test_other_family_cannot_mark_seen(self):
        alert = Alert.objects.create(
            device=self.device, alert_type="limit_reached", payload={}, triggered_at=timezone.now()
        )
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        response = self.client.post(reverse("alerts-mark-seen", kwargs={"alert_id": alert.id}))
        self.assertEqual(response.status_code, 403)
        alert.refresh_from_db()
        self.assertFalse(alert.seen)
