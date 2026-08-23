from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser

from .models import Child, ChildDevice, EnrollmentCode


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


class VerifyCodeDeviceReplacementTests(TestCase):
    def test_new_pairing_retires_previous_device_for_same_child(self):
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
        self.assertEqual(previous.status, ChildDevice.STATUS_UNLINKED)
        self.assertEqual(current.status, ChildDevice.STATUS_LINKED)
