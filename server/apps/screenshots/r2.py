"""Thin Cloudflare R2 (S3-compatible) helper for the screenshot feature.

R2 is used instead of the local media dir because PythonAnywhere Free's disk
is tiny and screenshots are large and short-lived. Objects live in a private
bucket; the agent uploads with a presigned PUT and the parent views with a
short-TTL presigned GET, so the bucket is never public.

boto3 is imported lazily so the rest of the app (migrations, tests that don't
touch storage) works even where boto3 isn't installed. ``is_configured()``
is false until the R2_* env vars are set, and every endpoint checks it and
returns 503 rather than 500 when storage isn't wired up yet.
"""

from django.conf import settings

_PUT_TTL = 300      # 5 min — the agent captures and uploads immediately
_GET_TTL = 600      # 10 min — long enough for the parent to open the image


def is_configured() -> bool:
    return bool(
        getattr(settings, "R2_ENDPOINT_URL", "")
        and getattr(settings, "R2_ACCESS_KEY_ID", "")
        and getattr(settings, "R2_SECRET_ACCESS_KEY", "")
    )


def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 2}),
    )


def presigned_put(key: str, content_type: str = "image/jpeg") -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_SCREENSHOT_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=_PUT_TTL,
    )


def presigned_get(key: str) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_SCREENSHOT_BUCKET, "Key": key},
        ExpiresIn=_GET_TTL,
    )


def delete_keys(keys) -> int:
    """Delete objects in batches of 1000. Missing keys are ignored by S3.
    Returns the number of keys submitted for deletion."""
    keys = [k for k in keys if k]
    if not keys:
        return 0
    client = _client()
    bucket = settings.R2_SCREENSHOT_BUCKET
    for start in range(0, len(keys), 1000):
        chunk = keys[start : start + 1000]
        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True},
        )
    return len(keys)
