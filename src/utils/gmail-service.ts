/**
 * Google Workspace Gmail integration service for Fleet Bill 3.0.
 * Supports sending transactional invoice summaries, payment receipts, and password reset notifications.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  accessToken?: string;
}

/**
 * Encodes an RFC 2822 email message to base64url format required by the Gmail REST API.
 */
function createBase64Message(to: string, subject: string, body: string, htmlBody?: string): string {
  const boundary = `__boundary_${Date.now()}__`;
  const messageParts = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
  ];

  if (htmlBody) {
    messageParts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      ''
    );
  }

  messageParts.push(`--${boundary}--`);
  const rawMessage = messageParts.join('\r\n');

  // Convert to base64url
  return btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email via the Gmail REST API using OAuth Bearer Token.
 */
export async function sendGmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, body, htmlBody, accessToken } = payload;

  if (!accessToken) {
    // If no access token is active in this turn, provide mailto link fallback
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    return { success: true, messageId: 'mailto_fallback' };
  }

  try {
    const raw = createBase64Message(to, subject, body, htmlBody);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Gmail API HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (err: any) {
    console.error('Gmail API send failure:', err);
    return { success: false, error: err.message || 'Failed to dispatch email via Gmail API' };
  }
}
