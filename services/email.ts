/**
 * Email provider abstraction (server side).
 *
 * Used exclusively by the command executor in /api/commands/confirm —
 * sending email is HIGH risk and ONLY happens after manual confirmation.
 *
 * Activates with RESEND_API_KEY + EMAIL_FROM (a verified sender on Resend).
 */
export interface EmailProvider {
  readonly name: string;
  send(params: { to: string; subject: string; text: string }): Promise<{ id: string | null }>;
}

const resendProvider: EmailProvider = {
  name: 'resend',
  async send({ to, subject, text }) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error('RESEND_API_KEY / EMAIL_FROM not configured');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? null };
  },
};

export function getEmail(): EmailProvider | null {
  return process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? resendProvider : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
