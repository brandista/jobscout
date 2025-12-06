/**
 * Email Service for JobScout
 * Uses Resend for sending job alerts and notifications
 */

interface JobAlertData {
  recipientEmail: string;
  recipientName?: string;
  jobs: Array<{
    title: string;
    company: string;
    location: string;
    url: string;
    matchScore?: number;
  }>;
  totalJobs: number;
  newMatches: number;
}

async function sendWithResend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'JobScout <noreply@brandista.eu>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] Resend API error:', response.status, error);
      return false;
    }

    const result = await response.json();
    console.log('[Email] Sent successfully:', result.id);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

/**
 * Send job alert email with new matches
 */
export async function sendJobAlertEmail(data: JobAlertData): Promise<boolean> {
  const { recipientEmail, recipientName, jobs, totalJobs, newMatches } = data;

  if (jobs.length === 0) {
    console.log("[Email] No jobs to send, skipping");
    return true;
  }

  // Build job list HTML
  const jobListHtml = jobs.slice(0, 10).map(job => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #eee;">
        <a href="${job.url}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${job.title}
        </a>
        <div style="color: #666; margin-top: 4px;">
          ${job.company} • ${job.location}
          ${job.matchScore ? `<span style="color: #16a34a; margin-left: 8px;">Match: ${job.matchScore}%</span>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🔍 JobScout</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Uudet työpaikkamatchit sinulle</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #333; font-size: 16px; margin: 0 0 24px 0;">
        Hei${recipientName ? ` ${recipientName}` : ''}! 👋
      </p>
      
      <p style="color: #333; font-size: 16px; margin: 0 0 24px 0;">
        JobScout löysi sinulle <strong>${newMatches} uutta työpaikkaa</strong> jotka sopivat profiiliisi.
      </p>
      
      <!-- Stats -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-around; text-align: center;">
        <div>
          <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${totalJobs}</div>
          <div style="color: #666; font-size: 14px;">Haettua</div>
        </div>
        <div>
          <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${newMatches}</div>
          <div style="color: #666; font-size: 14px;">Uutta matchia</div>
        </div>
      </div>
      
      <!-- Job List -->
      <h2 style="color: #333; font-size: 18px; margin: 0 0 16px 0;">📋 Parhaat matchit:</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${jobListHtml}
      </table>
      
      ${jobs.length > 10 ? `
        <p style="color: #666; font-size: 14px; margin-top: 16px; text-align: center;">
          ...ja ${jobs.length - 10} muuta työpaikkaa
        </p>
      ` : ''}
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://jobscout.brandista.eu/jobs" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Katso kaikki matchit →
        </a>
      </div>
      
      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          Sait tämän viestin koska olet aktivoinut automaattisen työpaikkahaun JobScoutissa.
        </p>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">
          <a href="https://jobscout.brandista.eu/scout" style="color: #2563eb;">Muuta asetuksia</a> •
          <a href="https://jobscout.brandista.eu" style="color: #2563eb;">JobScout</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
JobScout - Uudet työpaikkamatchit

Hei${recipientName ? ` ${recipientName}` : ''}!

JobScout löysi sinulle ${newMatches} uutta työpaikkaa jotka sopivat profiiliisi.

Parhaat matchit:
${jobs.slice(0, 10).map(job => `- ${job.title} @ ${job.company} (${job.location})`).join('\n')}

Katso kaikki matchit: https://jobscout.brandista.eu/jobs

---
JobScout - Älykkäät Työpaikka-Haut
  `;

  try {
    return await sendWithResend({
      to: recipientEmail,
      subject: `🔍 ${newMatches} uutta työpaikkaa sinulle - JobScout`,
      html: html,
      text: textContent,
    });
  } catch (error: any) {
    console.error("[Email] Error:", error);
    return false;
  }
}

/**
 * Send welcome email when user enables auto scout
 */
export async function sendAutoScoutWelcomeEmail(
  email: string, 
  name?: string,
  frequency: string = "weekly"
): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error("[Email] SENDGRID_API_KEY not configured");
    return false;
  }

  const frequencyText = frequency === "daily" ? "päivittäin" : 
                        frequency === "weekly" ? "viikoittain" : "joka toinen viikko";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Auto Scout aktivoitu!</h1>
    </div>
    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px;">
      <p style="color: #333; font-size: 16px;">
        Hei${name ? ` ${name}` : ''}!
      </p>
      <p style="color: #333; font-size: 16px;">
        Automaattinen työpaikkahaku on nyt aktivoitu. Saat ${frequencyText} sähköpostiin uudet työpaikat jotka sopivat profiiliisi.
      </p>
      <p style="color: #666; font-size: 14px;">
        Voit muuttaa asetuksia milloin tahansa JobScoutin Scout-sivulla.
      </p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://jobscout.brandista.eu/profile" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
          Täydennä profiiliasi →
        </a>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    return await sendWithResend({
      to: email,
      subject: "🎉 Auto Scout aktivoitu - JobScout",
      html: html,
    });
  } catch (error: any) {
    console.error("[Email] Error:", error);
    return false;
  }
}
