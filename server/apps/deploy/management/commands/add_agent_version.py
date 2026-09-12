from django.core.management.base import BaseCommand

from apps.deploy.models import AgentVersion


class Command(BaseCommand):
    help = "Register a new agent OTA release (see scripts/updates/publish-agent-release.sh)."

    def add_arguments(self, parser):
        parser.add_argument("--agent-version", required=True)
        parser.add_argument("--binary-url", required=True)
        parser.add_argument("--sha256", required=True)
        parser.add_argument("--signature", required=True)
        parser.add_argument("--mandatory", action="store_true")

    def handle(self, *args, **options):
        row, created = AgentVersion.objects.update_or_create(
            version=options["agent_version"],
            defaults={
                "binary_url": options["binary_url"],
                "sha256": options["sha256"],
                "signature": options["signature"],
                "mandatory": options["mandatory"],
                "is_active": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"{'created' if created else 'updated'}: agent {row.version} -> {row.binary_url}"
        ))
