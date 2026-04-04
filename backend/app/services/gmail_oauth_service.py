"""
Gmail OAuth2 Service
====================
Sends platform emails (OTP codes, usage alerts, plan changes) via the Gmail API
using an OAuth2 refresh token obtained through the admin connect flow in Settings.

Token storage:  backend/gmail_token.json  (never commit this file)
Config:         GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET in .env

First-time setup
----------------
1. Open Settings → Email tab in the dashboard
2. Click "Connect Gmail" and authorize with the Gmail account to send FROM
3. Google redirects back to /settings?gmail=connected — done.
   Emails will now be sent via Gmail OAuth2 instead of plain SMTP.
"""

import os
import json
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Token file lives at <backend_root>/gmail_token.json
_TOKEN_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'gmail_token.json')
)

SCOPES = ['https://www.googleapis.com/auth/gmail.send']


# ── Token helpers ─────────────────────────────────────────────────────────────

def token_path() -> str:
    return _TOKEN_FILE


def is_configured() -> bool:
    """Return True if a valid token file with a refresh_token exists."""
    if not os.path.exists(token_path()):
        return False
    try:
        with open(token_path()) as f:
            data = json.load(f)
        return bool(data.get('refresh_token'))
    except Exception:
        return False


def get_status() -> dict:
    """Return connection metadata for the frontend status endpoint."""
    if not os.path.exists(token_path()):
        return {'connected': False}
    try:
        with open(token_path()) as f:
            data = json.load(f)
        if not data.get('refresh_token'):
            return {'connected': False}
        return {
            'connected': True,
            'email': data.get('sender_email', ''),
        }
    except Exception:
        return {'connected': False}


def load_credentials():
    """Load a google.oauth2.credentials.Credentials object from the token file."""
    from google.oauth2.credentials import Credentials
    from app.config import settings

    with open(token_path()) as f:
        data = json.load(f)

    return Credentials(
        token=data.get('token'),
        refresh_token=data.get('refresh_token'),
        token_uri=data.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=data.get('client_id', settings.GMAIL_CLIENT_ID),
        client_secret=data.get('client_secret', settings.GMAIL_CLIENT_SECRET),
        scopes=data.get('scopes', SCOPES),
    )


def save_credentials(creds, sender_email: str = '') -> None:
    """Persist OAuth2 Credentials + sender_email to the token file."""
    data = {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': list(creds.scopes) if creds.scopes else SCOPES,
        'sender_email': sender_email,
    }
    if creds.expiry:
        data['expiry'] = creds.expiry.isoformat()
    with open(token_path(), 'w') as f:
        json.dump(data, f, indent=2)
    print(f'[Gmail OAuth] Tokens saved — sender: {sender_email}')


def remove_token() -> bool:
    """Delete the token file (disconnect Gmail)."""
    path = token_path()
    if os.path.exists(path):
        os.remove(path)
        print('[Gmail OAuth] Token file removed — disconnected')
        return True
    return False


# ── Email sending ─────────────────────────────────────────────────────────────

def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send an email via the Gmail API using stored OAuth2 credentials.

    - Auto-refreshes the access token if expired (uses refresh_token).
    - Falls back gracefully: returns False and prints the error if sending fails.
    """
    try:
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build

        creds = load_credentials()

        # Refresh expired access token
        if not creds.valid:
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                # Preserve sender_email from stored file, then re-save refreshed token
                with open(token_path()) as f:
                    stored = json.load(f)
                save_credentials(creds, sender_email=stored.get('sender_email', ''))
            else:
                print('[Gmail OAuth] Credentials invalid and cannot be refreshed — reconnect required')
                return False

        service = build('gmail', 'v1', credentials=creds)

        # Read sender email from token file
        with open(token_path()) as f:
            stored = json.load(f)
        sender = stored.get('sender_email', '')

        # Build MIME message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = sender
        msg['To'] = to_email
        msg.attach(MIMEText(html_body, 'html'))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        print(f'[Gmail OAuth] ✓ Sent to {to_email}: {subject}')
        return True

    except Exception as e:
        print(f'[Gmail OAuth] Error sending to {to_email}: {e}')
        return False
