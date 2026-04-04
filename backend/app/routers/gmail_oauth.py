"""
Gmail OAuth2 Router
===================
Admin endpoints that drive the "Connect Gmail" flow shown in Settings → Email tab.

Flow
----
1. GET  /api/gmail/authorize  — Frontend calls this to get the Google consent URL
2. (browser) User authorizes at Google
3. GET  /api/gmail/callback   — Google redirects here with ?code=...
4. Backend exchanges code → stores tokens → redirects to /settings?gmail=connected
5. GET  /api/gmail/status     — Frontend polls this to show connection state
6. POST /api/gmail/test       — Send a test email to verify everything works
7. DEL  /api/gmail/disconnect — Remove stored tokens

OAuth2 requirement
------------------
The redirect URI  http://localhost:8002/api/gmail/callback  must be registered
in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.
In production, replace with your actual domain.
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from app.config import settings
from app.middleware.auth import get_current_owner
from app.models.owner import Owner
import app.services.gmail_oauth_service as gmail_svc

# Allow plain http:// in development (OAuth2 normally requires https)
if settings.APP_ENV != 'production':
    os.environ.setdefault('OAUTHLIB_INSECURE_TRANSPORT', '1')

router = APIRouter(prefix='/api/gmail', tags=['gmail'])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_config() -> dict:
    """Build the OAuth2 client config dict from settings."""
    return {
        'web': {
            'client_id': settings.GMAIL_CLIENT_ID,
            'client_secret': settings.GMAIL_CLIENT_SECRET,
            'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
            'token_uri': 'https://oauth2.googleapis.com/token',
            'redirect_uris': [f'{settings.BASE_URL}/api/gmail/callback'],
        }
    }


def _redirect_uri() -> str:
    return f'{settings.BASE_URL}/api/gmail/callback'


def _require_credentials():
    """Raise 503 if Gmail OAuth2 credentials are not configured in .env."""
    if not settings.GMAIL_CLIENT_ID or not settings.GMAIL_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail=(
                'Gmail OAuth2 is not configured. '
                'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env'
            ),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get('/status')
def gmail_status(current_owner: Owner = Depends(get_current_owner)):
    """
    Return the current Gmail connection state.
    Response: { connected: bool, email?: str }
    """
    return gmail_svc.get_status()


@router.get('/authorize')
def gmail_authorize(current_owner: Owner = Depends(get_current_owner)):
    """
    Generate a Google OAuth2 authorization URL and return it to the frontend.
    The frontend will navigate the user's browser to this URL.
    Response: { url: str }
    """
    _require_credentials()
    try:
        from google_auth_oauthlib.flow import Flow

        flow = Flow.from_client_config(
            _client_config(),
            scopes=gmail_svc.SCOPES,
            redirect_uri=_redirect_uri(),
        )
        auth_url, _ = flow.authorization_url(
            access_type='offline',    # Request refresh_token
            prompt='consent',         # Always return refresh_token (even if re-authorizing)
            include_granted_scopes='true',
        )
        return {'url': auth_url}

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail='google-auth-oauthlib is not installed. Run: pip install google-auth-oauthlib',
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/callback')
def gmail_callback(code: str = None, state: str = None, error: str = None):
    """
    OAuth2 redirect endpoint — Google sends the user here after authorization.
    Exchanges the authorization code for tokens, fetches the sender Gmail address,
    saves to gmail_token.json, then redirects the browser back to the frontend.
    """
    if error or not code:
        print(f'[Gmail OAuth] Callback error or denied: {error}')
        return RedirectResponse(f'{settings.FRONTEND_URL}/settings?gmail=denied')

    try:
        from google_auth_oauthlib.flow import Flow
        from googleapiclient.discovery import build

        flow = Flow.from_client_config(
            _client_config(),
            scopes=gmail_svc.SCOPES,
            redirect_uri=_redirect_uri(),
        )
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Fetch the authenticated Gmail address to display in the UI
        service = build('gmail', 'v1', credentials=creds)
        profile = service.users().getProfile(userId='me').execute()
        sender_email = profile.get('emailAddress', '')

        gmail_svc.save_credentials(creds, sender_email=sender_email)
        print(f'[Gmail OAuth] ✓ Connected: {sender_email}')

        return RedirectResponse(
            f'{settings.FRONTEND_URL}/settings?gmail=connected&email={sender_email}'
        )

    except Exception as e:
        print(f'[Gmail OAuth] Callback exception: {e}')
        return RedirectResponse(f'{settings.FRONTEND_URL}/settings?gmail=error')


@router.post('/test')
def send_test_email(current_owner: Owner = Depends(get_current_owner)):
    """
    Send a test email to the currently logged-in owner to verify the connection.
    """
    if not gmail_svc.is_configured():
        raise HTTPException(status_code=400, detail='Gmail is not connected. Connect it first in Settings → Email.')

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="width:64px;height:64px;border-radius:20px;
                    background:linear-gradient(135deg,#d1fae5,#10b981);
                    margin:0 auto 16px;display:flex;align-items:center;
                    justify-content:center;font-size:32px">✅</div>
        <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0">
          Gmail Connected!
        </h1>
        <p style="font-size:14px;color:#6B7280;margin:8px 0 0">
          Your Ringa account is now sending emails via Gmail OAuth2.
        </p>
      </div>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;
                  padding:20px;text-align:center">
        <div style="font-size:13px;color:#166534">
          Sent successfully to <strong>{current_owner.email}</strong>
        </div>
        <div style="font-size:12px;color:#6B7280;margin-top:6px">
          All OTP codes, usage alerts, and plan notifications will now use this connection.
        </div>
      </div>
    </div>
    """
    ok = gmail_svc.send_email(
        current_owner.email,
        'Gmail OAuth2 — Connection Verified ✓',
        html,
    )
    if not ok:
        raise HTTPException(
            status_code=500,
            detail='Test email failed to send. Check the server logs for details.',
        )
    return {'sent': True, 'to': current_owner.email}


@router.delete('/disconnect')
def gmail_disconnect(current_owner: Owner = Depends(get_current_owner)):
    """Remove the stored Gmail token file (disconnect Gmail)."""
    removed = gmail_svc.remove_token()
    return {'disconnected': removed}
