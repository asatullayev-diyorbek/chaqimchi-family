from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser

from .models import ChildDevice


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
