from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser

from .models import AppInfo

FAKE_RESULT = {
    "display_name": "Roblox",
    "category": "O'yin",
    "description": "Roblox — foydalanuvchilar o'zlari o'yin yaratadigan platforma.",
    "benefits": ["Ijodkorlik va dasturlashga qiziqish uyg'otadi"],
    "risks": ["Notanish odamlar bilan onlayn muloqot xavfi bor"],
    "age_note": "13 yoshdan katta bolalar uchun tavsiya etiladi",
}


class AppInfoViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        r = self.client.get(reverse("appinfo", kwargs={"key": "roblox.exe"}))
        self.assertEqual(r.status_code, 401)

    def test_404_when_not_cached(self):
        r = self.client.get(reverse("appinfo", kwargs={"key": "roblox.exe"}))
        self.assertEqual(r.status_code, 404)

    def test_returns_cached_info(self):
        AppInfo.objects.create(key="roblox.exe", display_name="Roblox", description="...")
        r = self.client.get(reverse("appinfo", kwargs={"key": "ROBLOX.EXE"}))
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.json()["display_name"], "Roblox")


class AppInfoSubmitViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)

    def test_stores_valid_result(self):
        r = self.client.post(reverse("appinfo-submit", kwargs={"key": "Roblox.exe"}), FAKE_RESULT, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(AppInfo.objects.get().key, "roblox.exe")

    def test_rejects_malformed_result(self):
        r = self.client.post(reverse("appinfo-submit", kwargs={"key": "x.exe"}), {"description": ""}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_resubmitting_same_key_updates_in_place(self):
        self.client.post(reverse("appinfo-submit", kwargs={"key": "x.exe"}), FAKE_RESULT, format="json")
        self.client.post(
            reverse("appinfo-submit", kwargs={"key": "x.exe"}),
            {**FAKE_RESULT, "description": "Yangilangan"},
            format="json",
        )
        self.assertEqual(AppInfo.objects.count(), 1)
        self.assertEqual(AppInfo.objects.get().description, "Yangilangan")


class AppInfoBulkViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)
        AppInfo.objects.create(key="roblox.exe", display_name="Roblox", category="O'yin", description="...")
        AppInfo.objects.create(key="chrome.exe", display_name="Google Chrome", category="Brauzer", description="...")

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        r = self.client.get(reverse("appinfo-bulk"), {"keys": "roblox.exe"})
        self.assertEqual(r.status_code, 401)

    def test_returns_only_cached_keys(self):
        r = self.client.get(reverse("appinfo-bulk"), {"keys": "Roblox.exe,unknown.exe"})
        self.assertEqual(r.status_code, 200, r.data)
        body = r.json()
        self.assertEqual(set(body.keys()), {"roblox.exe"})
        self.assertEqual(body["roblox.exe"]["category"], "O'yin")

    def test_empty_keys_returns_empty(self):
        r = self.client.get(reverse("appinfo-bulk"))
        self.assertEqual(r.json(), {})
