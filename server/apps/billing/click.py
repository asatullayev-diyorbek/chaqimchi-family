"""Click Merchant API — Prepare (action=0) then Complete (action=1), each a
plain POST with an MD5 signature. Simpler and more stable across
integrations than Payme's JSON-RPC state machine, but — same caveat as
payme.py — built from the documented protocol without a real Click merchant
account to test against. Verify against Click's own docs / test cabinet
before going live.
"""

import hashlib

from django.conf import settings
from django.utils import timezone

from .models import Invoice

ACTION_PREPARE = 0
ACTION_COMPLETE = 1

ERR_SUCCESS = 0
ERR_SIGN_FAILED = -1
ERR_WRONG_AMOUNT = -2
ERR_ACTION_NOT_FOUND = -3
ERR_ALREADY_PAID = -4
ERR_ORDER_NOT_FOUND = -5
ERR_TRANSACTION_NOT_FOUND = -6
ERR_BAD_REQUEST = -8
ERR_TRANSACTION_CANCELLED = -9


def is_configured() -> bool:
    return bool(settings.CLICK_MERCHANT_ID and settings.CLICK_SERVICE_ID and settings.CLICK_SECRET_KEY)


def _sign_prepare(p: dict) -> str:
    raw = (
        f"{p.get('click_trans_id')}{p.get('service_id')}{settings.CLICK_SECRET_KEY}"
        f"{p.get('merchant_trans_id')}{p.get('amount')}{p.get('action')}{p.get('sign_time')}"
    )
    return hashlib.md5(raw.encode()).hexdigest()


def _sign_complete(p: dict) -> str:
    raw = (
        f"{p.get('click_trans_id')}{p.get('service_id')}{settings.CLICK_SECRET_KEY}"
        f"{p.get('merchant_trans_id')}{p.get('merchant_prepare_id')}"
        f"{p.get('amount')}{p.get('action')}{p.get('sign_time')}"
    )
    return hashlib.md5(raw.encode()).hexdigest()


def _base_response(p: dict, error: int, note: str, extra: dict | None = None) -> dict:
    out = {
        "click_trans_id": p.get("click_trans_id"),
        "merchant_trans_id": p.get("merchant_trans_id"),
        "error": error,
        "error_note": note,
    }
    if extra:
        out.update(extra)
    return out


def prepare(params: dict) -> dict:
    if _sign_prepare(params) != params.get("sign_string"):
        return _base_response(params, ERR_SIGN_FAILED, "SIGN CHECK FAILED!")

    invoice = Invoice.objects.filter(id=params.get("merchant_trans_id"), provider=Invoice.PROVIDER_CLICK).first()
    if invoice is None:
        return _base_response(params, ERR_ORDER_NOT_FOUND, "Order not found")
    if invoice.status == Invoice.STATUS_PAID:
        return _base_response(params, ERR_ALREADY_PAID, "Already paid")
    if invoice.status != Invoice.STATUS_PENDING:
        return _base_response(params, ERR_TRANSACTION_CANCELLED, "Order is not payable")
    try:
        if int(params.get("amount", 0)) != invoice.amount_uzs:
            return _base_response(params, ERR_WRONG_AMOUNT, "Incorrect amount")
    except (TypeError, ValueError):
        return _base_response(params, ERR_BAD_REQUEST, "Bad amount")

    invoice.provider_transaction_id = str(params.get("click_trans_id"))
    invoice.last_payload = params
    invoice.save(update_fields=["provider_transaction_id", "last_payload"])
    return _base_response(params, ERR_SUCCESS, "Success", {"merchant_prepare_id": str(invoice.id)})


def complete(params: dict) -> dict:
    if _sign_complete(params) != params.get("sign_string"):
        return _base_response(params, ERR_SIGN_FAILED, "SIGN CHECK FAILED!")

    invoice = Invoice.objects.filter(id=params.get("merchant_prepare_id"), provider=Invoice.PROVIDER_CLICK).first()
    if invoice is None:
        return _base_response(params, ERR_TRANSACTION_NOT_FOUND, "Transaction not found")
    if invoice.provider_transaction_id != str(params.get("click_trans_id")):
        return _base_response(params, ERR_TRANSACTION_NOT_FOUND, "Transaction id mismatch")

    # Click reports its own failure via error != 0 on the Complete call
    # (e.g. the payer cancelled) — cancel our side to match, don't charge.
    if int(params.get("error", 0)) != 0:
        invoice.mark_canceled()
        return _base_response(params, ERR_SUCCESS, "Success", {"merchant_confirm_id": str(invoice.id)})

    if invoice.status == Invoice.STATUS_PAID:
        return _base_response(params, ERR_ALREADY_PAID, "Already paid", {"merchant_confirm_id": str(invoice.id)})

    invoice.mark_paid()
    return _base_response(params, ERR_SUCCESS, "Success", {"merchant_confirm_id": str(invoice.id)})


def checkout_url(invoice: "Invoice") -> str:
    return (
        "https://my.click.uz/services/pay"
        f"?service_id={settings.CLICK_SERVICE_ID}"
        f"&merchant_id={settings.CLICK_MERCHANT_ID}"
        f"&amount={invoice.amount_uzs}"
        f"&transaction_param={invoice.id}"
    )
