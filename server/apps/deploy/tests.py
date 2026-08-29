from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.devices.models import ChildDevice

from .models import AgentVersion


def device_auth_header(device):
    return {"HTTP_AUTHORIZATION": f"Device {device.id}:{device.device_secret}"}


class LatestVersionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.device = ChildDevice.objects.create(status=ChildDevice.STATUS_LINKED)
        self.url = reverse("deploy-latest")

    def test_returns_latest_active_version_with_manifest(self):
        AgentVersion.objects.create(
            version="0.3.0",
            binary_url="https://example.com/agent-0.3.0.exe",
            is_active=True,
        )
        latest = AgentVersion.objects.create(
            version="0.4.0",
            binary_url="https://example.com/agent-0.4.0.exe",
            sha256="a" * 64,
            signature="c2ln",
            mandatory=True,
            is_active=True,
        )

        response = self.client.get(self.url, **device_auth_header(self.device))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "version": "0.4.0",
                "binary_url": latest.binary_url,
                "sha256": "a" * 64,
                "signature": "c2ln",
                "mandatory": True,
            },
        )

    def test_ignores_inactive_versions(self):
        AgentVersion.objects.create(
            version="0.5.0-broken",
            binary_url="https://example.com/agent-0.5.0-broken.exe",
            is_active=False,
        )
        active = AgentVersion.objects.create(
            version="0.4.0",
            binary_url="https://example.com/agent-0.4.0.exe",
            is_active=True,
        )

        response = self.client.get(self.url, **device_auth_header(self.device))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], active.version)

    def test_no_versions_returns_404(self):
        response = self.client.get(self.url, **device_auth_header(self.device))
        self.assertEqual(response.status_code, 404)

    def test_requires_device_auth(self):
        AgentVersion.objects.create(
            version="0.4.0", binary_url="https://example.com/agent-0.4.0.exe"
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)
