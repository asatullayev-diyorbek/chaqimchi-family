"""Payme Merchant API (Cash Register API) — the single JSON-RPC endpoint
Payme calls to move an Invoice through pending -> paid/canceled.

⚠️ Built from the publicly documented protocol shape, WITHOUT access to a
real Payme sandbox/merchant account (none exists for this project yet — see
apps.accounts settings comment). The method dispatch and state machine below
follow the standard flow (CheckPerformTransaction -> CreateTransaction ->
PerformTransaction, with CancelTransaction/CheckTransaction/GetStatement for
the rest of the lifecycle), but the exact numeric error codes should be
diffed against Payme's current official docs and exercised in their test
merchant cabinet before this goes live. Treat this file the way
agent/internal/service/windows_service.go treats "never run on a real
Windows machine": highest-value thing to verify by hand first.

Auth: Payme signs every call with HTTP Basic, login "Paycom", password the
merchant key from the Payme cabinet (settings.PAYME_MERCHANT_KEY) — checked
in the view, not here.
"""

from django.conf import settings
from django.utils import timezone

from apps.accounts.models import Subscription

from .models import Invoice

# Standard Payme JSON-RPC error codes.
ERR_INVALID_AMOUNT = -31001
ERR_TRANSACTION_NOT_FOUND = -31003
ERR_UNABLE_TO_PERFORM = -31008
ERR_ORDER_NOT_FOUND = -31050
ERR_METHOD_NOT_FOUND = -32601

STATE_CREATED = 1
STATE_COMPLETED = 2
STATE_CANCELED = -1
STATE_CANCELED_AFTER_COMPLETE = -2


def is_configured() -> bool:
    return bool(settings.PAYME_MERCHANT_ID and settings.PAYME_MERCHANT_KEY)


def _ms(dt) -> int:
    return int(dt.timestamp() * 1000) if dt else 0


def _rpc_error(request_id, code, message):
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _rpc_result(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _find_invoice(account: dict):
    order_id = (account or {}).get("order_id")
    if not order_id:
        return None
    return Invoice.objects.filter(id=order_id, provider=Invoice.PROVIDER_PAYME).first()


def handle(body: dict) -> dict:
    method = body.get("method")
    params = body.get("params") or {}
    request_id = body.get("id")

    if method == "CheckPerformTransaction":
        return _check_perform(request_id, params)
    if method == "CreateTransaction":
        return _create(request_id, params)
    if method == "PerformTransaction":
        return _perform(request_id, params)
    if method == "CancelTransaction":
        return _cancel(request_id, params)
    if method == "CheckTransaction":
        return _check(request_id, params)
    if method == "GetStatement":
        return _statement(request_id, params)
    return _rpc_error(request_id, ERR_METHOD_NOT_FOUND, "Method not found")


def _check_perform(request_id, params):
    invoice = _find_invoice(params.get("account"))
    if invoice is None or invoice.status != Invoice.STATUS_PENDING:
        return _rpc_error(request_id, ERR_ORDER_NOT_FOUND, "Order not found")
    if int(params.get("amount", 0)) != invoice.amount_uzs * 100:
        return _rpc_error(request_id, ERR_INVALID_AMOUNT, "Invalid amount")
    return _rpc_result(request_id, {"allow": True})


def _create(request_id, params):
    txn_id = params.get("id")
    invoice = _find_invoice(params.get("account"))
    if invoice is None:
        return _rpc_error(request_id, ERR_ORDER_NOT_FOUND, "Order not found")
    if int(params.get("amount", 0)) != invoice.amount_uzs * 100:
        return _rpc_error(request_id, ERR_INVALID_AMOUNT, "Invalid amount")

    if invoice.provider_transaction_id and invoice.provider_transaction_id != txn_id:
        # Someone already started a different Payme transaction for this
        # exact order — Payme's own retry guarantees are per transaction id.
        return _rpc_error(request_id, ERR_UNABLE_TO_PERFORM, "Order already has a transaction")

    if invoice.provider_transaction_id == txn_id:
        # Idempotent retry of an already-created transaction.
        state = STATE_COMPLETED if invoice.status == Invoice.STATUS_PAID else STATE_CREATED
        return _rpc_result(
            request_id,
            {"create_time": _ms(invoice.created_at), "transaction": str(invoice.id), "state": state},
        )

    if invoice.status != Invoice.STATUS_PENDING:
        return _rpc_error(request_id, ERR_UNABLE_TO_PERFORM, "Order is not payable")

    invoice.provider_transaction_id = txn_id
    invoice.last_payload = params
    invoice.save(update_fields=["provider_transaction_id", "last_payload"])
    return _rpc_result(
        request_id, {"create_time": _ms(invoice.created_at), "transaction": str(invoice.id), "state": STATE_CREATED}
    )


def _by_txn(txn_id):
    return Invoice.objects.filter(provider=Invoice.PROVIDER_PAYME, provider_transaction_id=txn_id).first()


def _perform(request_id, params):
    invoice = _by_txn(params.get("id"))
    if invoice is None:
        return _rpc_error(request_id, ERR_TRANSACTION_NOT_FOUND, "Transaction not found")
    if invoice.status == Invoice.STATUS_PAID:
        return _rpc_result(
            request_id, {"transaction": str(invoice.id), "perform_time": _ms(invoice.paid_at), "state": STATE_COMPLETED}
        )
    if invoice.status != Invoice.STATUS_PENDING:
        return _rpc_error(request_id, ERR_UNABLE_TO_PERFORM, "Order is not payable")

    invoice.mark_paid()
    return _rpc_result(
        request_id, {"transaction": str(invoice.id), "perform_time": _ms(invoice.paid_at), "state": STATE_COMPLETED}
    )


def _cancel(request_id, params):
    invoice = _by_txn(params.get("id"))
    if invoice is None:
        return _rpc_error(request_id, ERR_TRANSACTION_NOT_FOUND, "Transaction not found")

    was_paid = invoice.status == Invoice.STATUS_PAID
    if invoice.status in (Invoice.STATUS_PENDING, Invoice.STATUS_PAID):
        invoice.mark_canceled()
    return _rpc_result(
        request_id,
        {
            "transaction": str(invoice.id),
            "cancel_time": _ms(invoice.canceled_at),
            "state": STATE_CANCELED_AFTER_COMPLETE if was_paid else STATE_CANCELED,
        },
    )


def _check(request_id, params):
    invoice = _by_txn(params.get("id"))
    if invoice is None:
        return _rpc_error(request_id, ERR_TRANSACTION_NOT_FOUND, "Transaction not found")
    state = {
        Invoice.STATUS_PENDING: STATE_CREATED,
        Invoice.STATUS_PAID: STATE_COMPLETED,
        Invoice.STATUS_CANCELED: STATE_CANCELED,
        Invoice.STATUS_FAILED: STATE_CANCELED,
    }[invoice.status]
    return _rpc_result(
        request_id,
        {
            "create_time": _ms(invoice.created_at),
            "perform_time": _ms(invoice.paid_at),
            "cancel_time": _ms(invoice.canceled_at),
            "transaction": str(invoice.id),
            "state": state,
            "reason": None,
        },
    )


def _statement(request_id, params):
    from_ms, to_ms = params.get("from", 0), params.get("to", 0)
    from_dt = timezone.datetime.fromtimestamp(from_ms / 1000, tz=timezone.utc)
    to_dt = timezone.datetime.fromtimestamp(to_ms / 1000, tz=timezone.utc)
    rows = Invoice.objects.filter(
        provider=Invoice.PROVIDER_PAYME, created_at__gte=from_dt, created_at__lte=to_dt,
    ).exclude(provider_transaction_id="")
    return _rpc_result(
        request_id,
        {
            "transactions": [
                {
                    "id": inv.provider_transaction_id,
                    "time": _ms(inv.created_at),
                    "amount": inv.amount_uzs * 100,
                    "account": {"order_id": str(inv.id)},
                    "create_time": _ms(inv.created_at),
                    "perform_time": _ms(inv.paid_at),
                    "cancel_time": _ms(inv.canceled_at),
                    "transaction": str(inv.id),
                    "state": {
                        Invoice.STATUS_PENDING: STATE_CREATED,
                        Invoice.STATUS_PAID: STATE_COMPLETED,
                        Invoice.STATUS_CANCELED: STATE_CANCELED,
                        Invoice.STATUS_FAILED: STATE_CANCELED,
                    }[inv.status],
                    "reason": None,
                }
                for inv in rows
            ]
        },
    )


def checkout_url(invoice: "Invoice") -> str:
    """The https://checkout.paycom.uz/<base64> link the parent is sent to."""
    import base64

    payload = f"m={settings.PAYME_MERCHANT_ID};ac.order_id={invoice.id};a={invoice.amount_uzs * 100}"
    encoded = base64.b64encode(payload.encode()).decode()
    return f"https://checkout.paycom.uz/{encoded}"
