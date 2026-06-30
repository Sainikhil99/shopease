// Sends email via Resend's HTTPS API instead of raw SMTP.
// Render's free tier blocks outbound SMTP ports (25/465/587), but HTTPS (443) is never blocked.
// Without a verified domain, Resend only allows sending TO your own account email —
// fine for admin alerts, not for arbitrary shop-owner report addresses.

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'ShopEase <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Resend API error: ${res.status}`);
  }

  return res.json();
}

module.exports = { sendEmail };
