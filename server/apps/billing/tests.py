import hashlib

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Family, ParentUser, Subscription
from apps.devices.models import Child, ChildDevice

from . import click, payme
from .models import Invoice


class PlansViewTests(TestCase):
    def test_public_plan_catalogue(self):
        r = APIClient().get(reverse("billing-plans"))
        self.assertEqual(r.status_code, 200)
        plans = {p["plan"]: p for p in r.json()}
        self.assertEqual(plans["mini"]["price_uzs"], 15_000)
        self.assertEqual(plans["max"]["price_uzs"], 25_000)
        self.assertEqual(plans["beta"]["price_uzs"], 0)


class BillingStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)

    def test_status_shows_usage_and_limits(self):
        Child.objects.create(family=self.parent.family, name="Ali")
        r = self.client.get(reverse("billing-status"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["plan"], "beta")
        self.assertEqual(r.json()["usage"]["children"], 1)
        self.assertEqual(r.json()["usage"]["children_limit"], 1)


@override_settings(PAYME_MERCHANT_ID="m1", PAYME_MERCHANT_KEY="key1", CLICK_MERCHANT_ID="", CLICK_SERVICE_ID="", CLICK_SECRET_KEY="")
class CheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)

    def test_checkout_creates_pending_invoice(self):
        r = self.client.post(reverse("billing-checkout"), {"plan": "mini", "provider": "payme"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("checkout.paycom.uz", r.json()["checkout_url"])
        inv = Invoice.objects.get()
        self.assertEqual(inv.amount_uzs, 15_000)
        self.assertEqual(inv.status, Invoice.STATUS_PENDING)

    def test_checkout_rejects_beta(self):
        r = self.client.post(reverse("billing-checkout"), {"plan": "beta", "provider": "payme"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_checkout_503_when_provider_not_configured(self):
        r = self.client.post(reverse("billing-checkout"), {"plan": "mini", "provider": "click"}, format="json")
        self.assertEqual(r.status_code, 503)


@override_settings(PAYME_MERCHANT_ID="m1", PAYME_MERCHANT_KEY="secretkey")
class PaymeProtocolTests(TestCase):
    def setUp(self):
        self.family = Family.objects.create()
        self.invoice = Invoice.objects.create(family=self.family, plan="mini", amount_uzs=15_000, provider="payme")

    def test_check_perform_transaction(self):
        r = payme.handle({
            "id": 1, "method": "CheckPerformTransaction",
            "params": {"amount": 1_500_000, "account": {"order_id": str(self.invoice.id)}},
        })
        self.assertEqual(r["result"], {"allow": True})

    def test_check_perform_wrong_amount(self):
        r = payme.handle({
            "id": 1, "method": "CheckPerformTransaction",
            "params": {"amount": 999, "account": {"order_id": str(self.invoice.id)}},
        })
        self.assertEqual(r["error"]["code"], payme.ERR_INVALID_AMOUNT)

    def test_full_lifecycle_create_perform_check(self):
        create = payme.handle({
            "id": 1, "method": "CreateTransaction",
            "params": {"id": "txn1", "time": 0, "amount": 1_500_000, "account": {"order_id": str(self.invoice.id)}},
        })
        self.assertEqual(create["result"]["state"], payme.STATE_CREATED)

        # idempotent retry
        create2 = payme.handle({
            "id": 2, "method": "CreateTransaction",
            "params": {"id": "txn1", "time": 0, "amount": 1_500_000, "account": {"order_id": str(self.invoice.id)}},
        })
        self.assertEqual(create2["result"]["state"], payme.STATE_CREATED)

        perform = payme.handle({"id": 3, "method": "PerformTransaction", "params": {"id": "txn1"}})
        self.assertEqual(perform["result"]["state"], payme.STATE_COMPLETED)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.STATUS_PAID)
        self.family.subscription.refresh_from_db()
        self.assertEqual(self.family.subscription.plan, "mini")
        self.assertEqual(self.family.subscription.status, Subscription.STATUS_ACTIVE)

        check = payme.handle({"id": 4, "method": "CheckTransaction", "params": {"id": "txn1"}})
        self.assertEqual(check["result"]["state"], payme.STATE_COMPLETED)

    def test_cancel_after_complete_downgrades_family(self):
        payme.handle({
            "id": 1, "method": "CreateTransaction",
            "params": {"id": "txn2", "time": 0, "amount": 1_500_000, "account": {"order_id": str(self.invoice.id)}},
        })
        payme.handle({"id": 2, "method": "PerformTransaction", "params": {"id": "txn2"}})
        cancel = payme.handle({"id": 3, "method": "CancelTransaction", "params": {"id": "txn2", "reason": 1}})
        self.assertEqual(cancel["result"]["state"], payme.STATE_CANCELED_AFTER_COMPLETE)
        self.family.subscription.refresh_from_db()
        self.assertEqual(self.family.subscription.plan, Subscription.PLAN_BETA)

    def test_unknown_transaction(self):
        r = payme.handle({"id": 1, "method": "PerformTransaction", "params": {"id": "nope"}})
        self.assertEqual(r["error"]["code"], payme.ERR_TRANSACTION_NOT_FOUND)


@override_settings(CLICK_MERCHANT_ID="cm1", CLICK_SERVICE_ID="sv1", CLICK_SECRET_KEY="clicksecret")
class ClickProtocolTests(TestCase):
    def setUp(self):
        self.family = Family.objects.create()
        self.invoice = Invoice.objects.create(family=self.family, plan="max", amount_uzs=25_000, provider="click")

    def _prepare_params(self, **overrides):
        p = {
            "click_trans_id": "999", "service_id": "sv1", "merchant_trans_id": str(self.invoice.id),
            "amount": "25000", "action": "0", "sign_time": "2026-01-01 00:00:00",
        }
        p.update(overrides)
        raw = f"{p['click_trans_id']}{p['service_id']}clicksecret{p['merchant_trans_id']}{p['amount']}{p['action']}{p['sign_time']}"
        p["sign_string"] = hashlib.md5(raw.encode()).hexdigest()
        return p

    def test_prepare_success(self):
        r = click.prepare(self._prepare_params())
        self.assertEqual(r["error"], click.ERR_SUCCESS)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.provider_transaction_id, "999")

    def test_prepare_bad_signature(self):
        p = self._prepare_params()
        p["sign_string"] = "wrong"
        r = click.prepare(p)
        self.assertEqual(r["error"], click.ERR_SIGN_FAILED)

    def test_prepare_wrong_amount(self):
        p = self._prepare_params(amount="1")
        # amount is part of the signed payload — recompute after tampering
        raw = f"{p['click_trans_id']}{p['service_id']}clicksecret{p['merchant_trans_id']}{p['amount']}{p['action']}{p['sign_time']}"
        p["sign_string"] = hashlib.md5(raw.encode()).hexdigest()
        r = click.prepare(p)
        self.assertEqual(r["error"], click.ERR_WRONG_AMOUNT)

    def test_complete_after_prepare_activates_plan(self):
        click.prepare(self._prepare_params())
        p = {
            "click_trans_id": "999", "service_id": "sv1", "merchant_trans_id": str(self.invoice.id),
            "merchant_prepare_id": str(self.invoice.id), "amount": "25000", "action": "1",
            "error": "0", "sign_time": "2026-01-01 00:00:01",
        }
        raw = (
            f"{p['click_trans_id']}{p['service_id']}clicksecret{p['merchant_trans_id']}"
            f"{p['merchant_prepare_id']}{p['amount']}{p['action']}{p['sign_time']}"
        )
        p["sign_string"] = hashlib.md5(raw.encode()).hexdigest()
        r = click.complete(p)
        self.assertEqual(r["error"], click.ERR_SUCCESS)
        self.family.subscription.refresh_from_db()
        self.assertEqual(self.family.subscription.plan, "max")
        self.assertTrue(self.family.subscription.is_paid_and_active())


class ExpireSubscriptionsTests(TestCase):
    def test_expired_paid_plan_reverts_to_beta(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.billing.models import expire_subscriptions

        family = Family.objects.create()
        sub = family.subscription
        sub.plan = "mini"
        sub.status = Subscription.STATUS_ACTIVE
        sub.expires_at = timezone.now() - timedelta(days=1)
        sub.save()

        count = expire_subscriptions()
        self.assertEqual(count, 1)
        sub.refresh_from_db()
        self.assertEqual(sub.plan, Subscription.PLAN_BETA)
        self.assertEqual(sub.status, Subscription.STATUS_EXPIRED)


@override_settings(DIGEST_CRON_SECRET="cron-x")
class ExpireEndpointTests(TestCase):
    def test_secret_gate(self):
        client = APIClient()
        r = client.post(reverse("billing-expire"), HTTP_X_DIGEST_SECRET="wrong")
        self.assertEqual(r.status_code, 403)
        r = client.post(reverse("billing-expire"), HTTP_X_DIGEST_SECRET="cron-x")
        self.assertEqual(r.status_code, 200)


class PlanLimitTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client.force_authenticate(user=self.parent)

    def test_beta_blocks_a_second_child(self):
        Child.objects.create(family=self.parent.family, name="Ali")
        r = self.client.post(reverse("children"), {"name": "Vali"}, format="json")
        self.assertEqual(r.status_code, 402)

    def test_beta_allows_two_devices_for_one_child(self):
        # Deliberately generous: one child's laptop + phone must stay free.
        self.assertEqual(self.parent.family.subscription.limit("max_devices"), 2)

    def test_mini_allows_a_second_child(self):
        self.parent.family.subscription.plan = "mini"
        self.parent.family.subscription.save(update_fields=["plan"])
        Child.objects.create(family=self.parent.family, name="Ali")
        r = self.client.post(reverse("children"), {"name": "Vali"}, format="json")
        self.assertEqual(r.status_code, 201)
