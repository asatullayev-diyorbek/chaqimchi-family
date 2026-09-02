from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from .models import Rule


def device_auth_header(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


class RuleCRUDTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="parent@example.com", password="supersecret123"
        )
        self.device = ChildDevice.objects.create(
            family=self.parent.family, status=ChildDevice.STATUS_LINKED
        )
        self.collection_url = reverse("rules-collection", kwargs={"id": self.device.id})

    def test_create_and_list_rule(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(
            self.collection_url,
            {"rule_type": "blocked_app", "value": {"app": "steam.exe"}},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.get(self.collection_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["value"], {"app": "steam.exe"})

    def test_create_rule_rejects_invalid_value_shape(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(
            self.collection_url,
            {"rule_type": "daily_limit_minutes", "value": {"wrong_key": 1}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_rule_accepts_weekend_minutes(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(
            self.collection_url,
            {"rule_type": "daily_limit_minutes", "value": {"minutes": 120, "weekend_minutes": 240}},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["value"], {"minutes": 120, "weekend_minutes": 240})

    def test_create_rule_rejects_non_int_weekend_minutes(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(
            self.collection_url,
            {"rule_type": "daily_limit_minutes", "value": {"minutes": 120, "weekend_minutes": "lots"}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_blocked_window_rule(self):
        self.client.force_authenticate(user=self.parent)
        response = self.client.post(
            self.collection_url,
            {"rule_type": "blocked_window", "value": {"start": "22:00", "end": "07:00"}},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["value"], {"start": "22:00", "end": "07:00"})

    def test_blocked_window_rejects_bad_time(self):
        self.client.force_authenticate(user=self.parent)
        for value in ({"start": "25:00", "end": "07:00"}, {"start": "22:00"}, {"start": "07:00", "end": "07:00"}):
            response = self.client.post(
                self.collection_url,
                {"rule_type": "blocked_window", "value": value},
                format="json",
            )
            self.assertEqual(response.status_code, 400, value)

    def test_delete_rule(self):
        self.client.force_authenticate(user=self.parent)
        rule = Rule.objects.create(
            device=self.device, rule_type="daily_limit_minutes", value={"minutes": 120}
        )
        delete_url = reverse("rules-collection", kwargs={"id": rule.id})
        response = self.client.delete(delete_url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Rule.objects.filter(id=rule.id).exists())

    def test_other_family_cannot_see_or_modify_rules(self):
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        Rule.objects.create(
            device=self.device, rule_type="blocked_app", value={"app": "steam.exe"}
        )

        self.client.force_authenticate(user=other_parent)
        response = self.client.get(self.collection_url)
        self.assertEqual(response.status_code, 403)

        response = self.client.post(
            self.collection_url,
            {"rule_type": "blocked_app", "value": {"app": "roblox.exe"}},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_other_family_cannot_delete_rule(self):
        rule = Rule.objects.create(
            device=self.device, rule_type="blocked_app", value={"app": "steam.exe"}
        )
        other_parent = ParentUser.objects.create_user(
            email="other@example.com", password="supersecret123"
        )
        self.client.force_authenticate(user=other_parent)
        delete_url = reverse("rules-collection", kwargs={"id": rule.id})
        response = self.client.delete(delete_url)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Rule.objects.filter(id=rule.id).exists())

    def test_device_fetches_its_own_rules_via_device_secret_auth(self):
        Rule.objects.create(
            device=self.device, rule_type="daily_limit_minutes", value={"minutes": 90}
        )
        response = self.client.get(
            reverse("rules-own-device"), **device_auth_header(self.device)
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["value"], {"minutes": 90})

    def test_device_own_rules_requires_auth(self):
        response = self.client.get(reverse("rules-own-device"))
        self.assertEqual(response.status_code, 401)
