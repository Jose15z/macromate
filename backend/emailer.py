"""Transactional email via Resend (https://resend.com), enabled by RESEND_API_KEY.

Without a key the send functions report unavailability and the endpoints
degrade with a clear message instead of failing silently.
"""

import os

import requests

RESEND_URL = "https://api.resend.com/emails"


def is_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def send_email(to: str, subject: str, html: str) -> bool:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return False

    sender = os.environ.get("MAIL_FROM", "MacroMate <onboarding@resend.dev>")
    try:
        resp = requests.post(
            RESEND_URL,
            json={"from": sender, "to": [to], "subject": subject, "html": html},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
    except requests.RequestException:
        return False
    return resp.status_code in (200, 201)
