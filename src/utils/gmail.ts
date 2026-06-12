/**
 * Gmail notification sending helper utilizing Google OAuth access token.
 */

/**
 * Builds standard MIME multipart/alternative string and encodes it into Safe Base64Url format.
 */
function makeMimeEmail(to: string, subject: string, htmlContent: string): string {
  const emailLines = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "",
    htmlContent,
  ];
  const emailStr = emailLines.join("\r\n");

  // UTF-8 safe base64 encoding (unescape/encodeURIComponent ensures special accent characters behave correctly)
  const base64 = btoa(unescape(encodeURIComponent(emailStr)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sends a real email on behalf of the logged-in google account to client's email box.
 */
export async function sendGmailNotification(
  accessToken: string,
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ id: string; threadId: string }> {
  try {
    const rawEmail = makeMimeEmail(to, subject, htmlContent);

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: rawEmail,
        }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Gmail send notification triggered error:", errText);
      throw new Error(`Gmail API report failed: ${sendRes.statusText}`);
    }

    return await sendRes.json();
  } catch (error) {
    console.error("Error inside sendGmailNotification helper:", error);
    throw error;
  }
}
