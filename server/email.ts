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
      console.error("[Email] Resend API error:", error);
      return false;
    }

    const data = await response.json();
    console.log("[Email] Sent successfully:", data.id);
    return true;
  } catch (error: any) {
    console.error("[Email] Error:", error.message);
    return false;
  }
}

/**
 * Send job alert email with new matches - Premium design
 */
export async function sendJobAlertEmail(data: JobAlertData): Promise<boolean> {
  const { recipientEmail, recipientName, jobs, totalJobs, newMatches } = data;

  if (jobs.length === 0) {
    console.log("[Email] No jobs to send, skipping");
    return true;
  }

  // Sort by match score
  const sortedJobs = [...jobs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  const topJob = sortedJobs[0];
  const topMatches = sortedJobs.filter(j => (j.matchScore || 0) >= 70);
  
  // Generate match reason based on score
  const getMatchReason = (job: typeof jobs[0]) => {
    const score = job.matchScore || 0;
    if (score >= 80) return "Erinomainen osuvuus profiiliisi";
    if (score >= 70) return "Vahva osuvuus taitoihisi";
    if (score >= 60) return "Hyvä match kokemukseesi";
    if (score >= 50) return "Potentiaalinen mahdollisuus";
    return "Tutustu tarkemmin";
  };

  // Build job card HTML
  const buildJobCard = (job: typeof jobs[0], isTop: boolean = false) => {
    const score = job.matchScore || 0;
    const scoreColor = score >= 70 ? '#059669' : score >= 50 ? '#d97706' : '#6b7280';
    const scoreBg = score >= 70 ? '#ecfdf5' : score >= 50 ? '#fffbeb' : '#f3f4f6';
    
    return `
    <div style="background: ${isTop ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : 'white'}; border: 1px solid ${isTop ? '#0ea5e9' : '#e5e7eb'}; border-radius: 12px; padding: 20px; margin-bottom: 12px; ${isTop ? 'border-width: 2px;' : ''}">
      ${isTop ? '<div style="color: #0369a1; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">⭐ PARAS OSUMA</div>' : ''}
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top;">
            <a href="${job.url}" style="color: #1e40af; text-decoration: none; font-weight: 600; font-size: 17px; line-height: 1.3;">
              ${job.title}
            </a>
            <div style="color: #374151; margin-top: 6px; font-size: 14px;">
              <strong>${job.company}</strong> · ${job.location}
            </div>
            <div style="color: #6b7280; margin-top: 8px; font-size: 13px; font-style: italic;">
              ${getMatchReason(job)}
            </div>
          </td>
          ${score > 0 ? `
          <td style="vertical-align: top; text-align: right; width: 80px;">
            <div style="background: ${scoreBg}; border-radius: 8px; padding: 8px 12px; display: inline-block; text-align: center;">
              <div style="color: ${scoreColor}; font-weight: 700; font-size: 20px;">${score}%</div>
              <div style="color: ${scoreColor}; font-size: 10px; text-transform: uppercase;">match</div>
            </div>
          </td>
          ` : ''}
        </tr>
      </table>
      <div style="margin-top: 12px;">
        <a href="${job.url}" style="display: inline-block; background: ${isTop ? '#0284c7' : '#2563eb'}; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;">
          Katso työpaikka →
        </a>
      </div>
    </div>
    `;
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #db2777 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
              <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700;">Uudet työpaikkasuositukset</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Löysimme sinulle sopivia mahdollisuuksia</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              
              <!-- Greeting -->
              <p style="color: #111827; font-size: 16px; margin: 0 0 24px 0; line-height: 1.6;">
                Hei${recipientName ? ` <strong>${recipientName}</strong>` : ''}! 👋
              </p>
              
              <!-- Executive Summary Box -->
              <div style="background: linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%); border: 1px solid #c4b5fd; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                <h2 style="color: #5b21b6; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0;">
                  📊 YHTEENVETO
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="text-align: center; width: 33%;">
                      <div style="font-size: 36px; font-weight: 700; color: #7c3aed;">${newMatches}</div>
                      <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Uutta työpaikkaa</div>
                    </td>
                    <td style="width: 1px; background: #c4b5fd;"></td>
                    <td style="text-align: center; width: 33%;">
                      <div style="font-size: 36px; font-weight: 700; color: #059669;">${topMatches.length}</div>
                      <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Erinomaista osumaa</div>
                    </td>
                    <td style="width: 1px; background: #c4b5fd;"></td>
                    <td style="text-align: center; width: 33%;">
                      <div style="font-size: 36px; font-weight: 700; color: #0369a1;">${topJob?.matchScore || 0}%</div>
                      <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Paras match</div>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Recommendation -->
              ${topMatches.length > 0 ? `
              <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin-bottom: 28px; border-radius: 0 8px 8px 0;">
                <div style="color: #166534; font-weight: 600; font-size: 14px; margin-bottom: 4px;">💡 Suositus</div>
                <div style="color: #15803d; font-size: 14px; line-height: 1.5;">
                  ${topMatches.length === 1 
                    ? `<strong>${topJob.title}</strong> yrityksessä ${topJob.company} on erinomainen match profiiliisi. Suosittelemme hakemaan pikaisesti!`
                    : `Löysimme ${topMatches.length} työpaikkaa joissa on yli 70% osuvuus profiiliisi. <strong>${topJob.title}</strong> on näistä paras. Toimi nopeasti!`
                  }
                </div>
              </div>
              ` : ''}
              
              <!-- Job Listings -->
              <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
                🏆 Parhaat matchit sinulle
              </h2>
              
              ${topJob ? buildJobCard(topJob, true) : ''}
              ${sortedJobs.slice(1, 5).map(job => buildJobCard(job, false)).join('')}
              
              ${sortedJobs.length > 5 ? `
              <div style="text-align: center; padding: 16px; color: #6b7280; font-size: 14px;">
                + ${sortedJobs.length - 5} muuta työpaikkaa
              </div>
              ` : ''}
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://jobscout.brandista.eu/jobs" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(37,99,235,0.4);">
                  Katso kaikki työpaikat →
                </a>
              </div>
              
              <!-- Tips Section -->
              <div style="background: #fefce8; border-radius: 10px; padding: 20px; margin-top: 32px;">
                <div style="color: #854d0e; font-weight: 600; font-size: 14px; margin-bottom: 8px;">💡 Vinkki hakemiseen</div>
                <div style="color: #a16207; font-size: 13px; line-height: 1.5;">
                  Mukauta CV:si ja hakemuksesi jokaiseen paikkaan erikseen. Käytä JobScoutin AI-agentteja valmistelemaan täydellinen hakemus!
                </div>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 24px 16px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
                Saat tämän viestin koska olet aktivoinut Auto Scoutin JobScoutissa.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="https://jobscout.brandista.eu/scout" style="color: #6b7280;">Hallinnoi asetuksia</a> · 
                <a href="https://jobscout.brandista.eu" style="color: #6b7280;">JobScout</a>
              </p>
              <div style="margin-top: 16px;">
                <span style="color: #d1d5db; font-size: 11px;">Powered by</span>
                <span style="color: #9ca3af; font-size: 11px; font-weight: 600;"> Brandista Growth Garage</span>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = topMatches.length > 0 
    ? `🎯 ${newMatches} uutta työpaikkaa - paras match ${topJob?.matchScore}%`
    : `🔍 ${newMatches} uutta työpaikkaa sinulle`;

  try {
    return await sendWithResend({
      to: recipientEmail,
      subject: subject,
      html: html,
    });
  } catch (error: any) {
    console.error("[Email] Error sending job alert:", error);
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
  const frequencyText = frequency === "daily" ? "päivittäin" : 
                        frequency === "weekly" ? "viikoittain" : "joka toinen viikko";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Auto Scout aktivoitu!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              
              <p style="color: #111827; font-size: 16px; margin: 0 0 20px 0; line-height: 1.6;">
                Hei${name ? ` <strong>${name}</strong>` : ''}! 👋
              </p>
              
              <p style="color: #374151; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">
                Mahtavaa! Automaattinen työpaikkahaku on nyt käynnissä. JobScout etsii sinulle sopivia työpaikkoja ja lähettää parhaat matchit sähköpostiisi.
              </p>
              
              <!-- Schedule Info -->
              <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%); border: 1px solid #a7f3d0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width: 50px; vertical-align: top;">
                      <div style="font-size: 28px;">📅</div>
                    </td>
                    <td style="vertical-align: top;">
                      <div style="color: #065f46; font-weight: 600; font-size: 15px; margin-bottom: 4px;">Hakutiheys</div>
                      <div style="color: #047857; font-size: 20px; font-weight: 700; text-transform: capitalize;">${frequencyText}</div>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- What happens next -->
              <h2 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">Mitä seuraavaksi?</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top; color: #7c3aed; font-weight: 600;">1.</td>
                        <td style="color: #374151; font-size: 14px; line-height: 1.5;">
                          <strong>Täydennä profiilisi</strong> - Mitä tarkempi profiili, sitä paremmat matchit
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top; color: #7c3aed; font-weight: 600;">2.</td>
                        <td style="color: #374151; font-size: 14px; line-height: 1.5;">
                          <strong>Saat sähköpostin</strong> kun löydämme sinulle sopivia työpaikkoja
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top; color: #7c3aed; font-weight: 600;">3.</td>
                        <td style="color: #374151; font-size: 14px; line-height: 1.5;">
                          <strong>Käytä AI-agentteja</strong> hakemuksen ja haastattelun valmisteluun
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://jobscout.brandista.eu/profile" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(5,150,105,0.4);">
                  Täydennä profiiliasi →
                </a>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 24px 16px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
                Voit muuttaa Auto Scout -asetuksia milloin tahansa.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="https://jobscout.brandista.eu/scout" style="color: #6b7280;">Hallinnoi asetuksia</a> · 
                <a href="https://jobscout.brandista.eu" style="color: #6b7280;">JobScout</a>
              </p>
              <div style="margin-top: 16px;">
                <span style="color: #d1d5db; font-size: 11px;">Powered by</span>
                <span style="color: #9ca3af; font-size: 11px; font-weight: 600;"> Brandista Growth Garage</span>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
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
    console.error("[Email] Error sending welcome email:", error);
    return false;
  }
}
