"""
Email Service
Sends usage alerts, OTP codes, and plan change notifications.
In dev mode, emails are logged to console. In production, integrate SMTP/SendGrid/SES.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send an email using the best available provider (priority order):

    1. Gmail OAuth2  — if gmail_token.json exists with a valid refresh_token
    2. Plain SMTP    — if SMTP_HOST + SMTP_USER are configured in .env
    3. Console log   — dev fallback, always succeeds (returns True)
    """
    # ── Priority 1: Gmail OAuth2 ──────────────────────────────────────────────
    try:
        from app.services.gmail_oauth_service import is_configured, send_email as gmail_send
        if is_configured():
            return gmail_send(to_email, subject, html_body)
    except ImportError:
        pass  # google-auth not installed yet — fall through to SMTP

    # ── Priority 2: Plain SMTP ────────────────────────────────────────────────
    if settings.SMTP_HOST and settings.SMTP_USER:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_PORT != 25:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            print(f"[Email] Sent via SMTP to {to_email}: {subject}")
            return True
        except Exception as e:
            print(f"[Email] SMTP error sending to {to_email}: {e}")
            return False

    # ── Priority 3: Dev console fallback ──────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"[Email - DEV MODE] To: {to_email}")
    print(f"[Email - DEV MODE] Subject: {subject}")
    print(f"[Email - DEV MODE] Body preview: {html_body[:200]}...")
    print(f"{'='*60}\n")
    return True


def send_otp_email(to_email: str, otp_code: str, purpose: str = "plan change") -> bool:
    """Send an OTP verification code via email."""
    subject = f"Your verification code: {otp_code}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1d1d1f; margin: 0;">Verification Code</h1>
            <p style="font-size: 14px; color: #86868b; margin: 8px 0 0;">For {purpose} verification</p>
        </div>
        <div style="background: #f5f5f7; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d1d1f; font-family: monospace;">
                {otp_code}
            </div>
            <p style="font-size: 13px; color: #86868b; margin: 12px 0 0;">This code expires in 5 minutes</p>
        </div>
        <p style="font-size: 13px; color: #86868b; text-align: center; line-height: 1.5;">
            If you didn't request this code, you can safely ignore this email.
        </p>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_usage_alert(to_email: str, restaurant_name: str, calls_used: int, calls_limit: int, percentage: int) -> bool:
    """Send an 80% usage threshold alert email."""
    subject = f"Usage Alert: {percentage}% of your AI call limit reached"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #fff3cd, #ffc107); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 28px;">
                &#9888;
            </div>
            <h1 style="font-size: 22px; font-weight: 700; color: #1d1d1f; margin: 0;">Usage Alert</h1>
            <p style="font-size: 14px; color: #86868b; margin: 8px 0 0;">{restaurant_name}</p>
        </div>
        <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 48px; font-weight: 800; color: #f59e0b; line-height: 1;">{percentage}%</div>
            <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0;">of your monthly call limit used</p>
            <div style="margin-top: 16px; font-size: 14px; color: #374151;">
                <strong>{calls_used}</strong> of <strong>{calls_limit}</strong> calls used this period
            </div>
        </div>
        <div style="background: #f5f5f7; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0; line-height: 1.6;">
                You're approaching your monthly AI call limit. Consider upgrading your plan to avoid any service interruptions.
                Additional calls beyond your limit are billed at $0.50 each.
            </p>
        </div>
        <div style="text-align: center;">
            <a href="{settings.FRONTEND_URL}/subscription"
               style="display: inline-block; background: #0071e3; color: white; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">
                Upgrade Plan
            </a>
        </div>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_plan_change_confirmation(to_email: str, restaurant_name: str, old_plan: str, new_plan: str) -> bool:
    """Send a confirmation email after a plan change."""
    action = "upgraded" if _plan_rank(new_plan) > _plan_rank(old_plan) else "changed"
    subject = f"Plan {action}: You're now on the {new_plan.title()} plan"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #d6e8ff, #0071e3); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: white;">
                &#10003;
            </div>
            <h1 style="font-size: 22px; font-weight: 700; color: #1d1d1f; margin: 0;">Plan {action.title()}!</h1>
            <p style="font-size: 14px; color: #86868b; margin: 8px 0 0;">{restaurant_name}</p>
        </div>
        <div style="background: #f0f7ff; border: 1px solid #b3d4fc; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.05em;">
                {old_plan.title()} &rarr; {new_plan.title()}
            </div>
            <div style="font-size: 28px; font-weight: 800; color: #0071e3; margin-top: 8px;">
                {new_plan.title()} Plan
            </div>
        </div>
        <p style="font-size: 13px; color: #86868b; text-align: center; line-height: 1.6;">
            Your new plan is now active. You can manage your subscription anytime from your dashboard.
        </p>
    </div>
    """
    return _send_email(to_email, subject, html)


def _plan_rank(plan: str) -> int:
    return {"essential": 0, "pro": 1, "enterprise": 2}.get(plan, 0)
