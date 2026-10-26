// Server-only. Sends email through Resend (RESEND_API_KEY).

const FROM = () => process.env.EMAIL_FROM?.trim() || "Pathway Online <signin@pathway.rockc3.com>";
const REPLY_TO = () => process.env.EMAIL_REPLY_TO?.trim() || "info@rockc3.com";

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error("RESEND_API_KEY is not set; no email was sent.");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [to], reply_to: REPLY_TO(), subject, text }),
      cache: "no-store",
    });
    if (!res.ok) console.error("Resend refused the email:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Could not reach Resend:", err);
    return false;
  }
}
