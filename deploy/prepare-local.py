"""Create local-only random credentials without printing or replacing them."""
import os
import secrets
from pathlib import Path

target = Path(__file__).with_name(".env.local")
try:
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    print("Existing deploy/.env.local retained.")
else:
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(
            f"POSTGRES_PASSWORD={secrets.token_hex(24)}\n"
            f"SECRET_KEY={secrets.token_hex(32)}\n"
            "APP_PORT=18080\n"
            "IMAGE_TAG=dev\n"
        )
    print("Created deploy/.env.local with random local-only credentials.")
