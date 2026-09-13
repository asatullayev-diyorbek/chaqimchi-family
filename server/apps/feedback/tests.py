from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser

from .models import Review


class ReviewViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)
        self.url = reverse("feedback-review")

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.post(self.url).status_code, 401)

    def test_empty_list_when_no_reviews_yet(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), [])

    def test_submits_a_review(self):
        r = self.client.post(self.url, {"rating": 5, "comment": "Juda foydali!"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.json()["rating"], 5)
        self.assertEqual(r.json()["comment"], "Juda foydali!")
        self.assertEqual(Review.objects.count(), 1)

    def test_comment_is_optional(self):
        r = self.client.post(self.url, {"rating": 4}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.json()["comment"], "")

    def test_rejects_out_of_range_rating(self):
        for bad in (0, 6, -1, "5", None, True):
            r = self.client.post(self.url, {"rating": bad}, format="json")
            self.assertEqual(r.status_code, 400, bad)

    def test_multiple_submissions_are_all_kept(self):
        self.client.post(self.url, {"rating": 3, "comment": "Yaxshi"}, format="json")
        self.client.post(self.url, {"rating": 5, "comment": "A'lo!"}, format="json")
        self.assertEqual(Review.objects.count(), 2)
        r = self.client.get(self.url)
        self.assertEqual(len(r.json()), 2)
        # Newest first.
        self.assertEqual(r.json()[0]["rating"], 5)
        self.assertEqual(r.json()[1]["rating"], 3)

    def test_cannot_see_another_parents_reviews(self):
        self.client.post(self.url, {"rating": 5, "comment": "Meniki"}, format="json")
        other = ParentUser.objects.create_user(email="o@example.com", password="supersecret1")
        self.client.force_authenticate(user=other)
        r = self.client.get(self.url)
        self.assertEqual(r.json(), [])
