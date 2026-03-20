import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function parseSection(text: string, heading: string): string {
  const regex = new RegExp(`${heading}[:\\s]*([\\s\\S]*?)(?=\\n[A-Z]{3,}[\\s\\n]|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function formatSignals(reportText: string): string {
  const signalRegex = /(🟢|🟡|🔴)\s+(\w[\w\s]+?)\s+\[(\d+)\/(\d+)\]\s*[–-]\s*([^\n]+)/g;
  let html = '';
  let match;
  while ((match = signalRegex.exec(reportText)) !== null) {
    const [, emoji, name, score, max, reason] = match;
    const color = emoji === '🟢' ? '#16a34a' : emoji === '🟡' ? '#ca8a04' : '#dc2626';
    const bg = emoji === '🟢' ? '#f0fdf4' : emoji === '🟡' ? '#fefce8' : '#fef2f2';
    const border = emoji === '🟢' ? '#bbf7d0' : emoji === '🟡' ? '#fef08a' : '#fecaca';
    html += `
      <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:700;color:${color};font-size:13px;">${emoji} ${name.trim()}</span>
          <span style="font-weight:700;color:${color};font-size:13px;">${score}/${max}</span>
        </div>
        <p style="margin:0;font-size:12px;color:#374151;line-height:1.5;">${reason.trim()}</p>
      </div>`;
  }
  return html;
}

function formatQuickWins(reportText: string): string {
  const section = parseSection(reportText, 'QUICK WINS');
  if (!section) return '';
  const lines = section.split('\n').filter((l) => l.trim().match(/^\d+\./));
  if (!lines.length) return '';
  return lines
    .map(
      (l) =>
        `<li style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.5;">${l.replace(/^\d+\.\s*/, '')}</li>`
    )
    .join('');
}

export async function POST(request: NextRequest) {
  const { to, reportText, geoScore, url } = await request.json();

  if (!to || !reportText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const scoreEmoji = geoScore >= 80 ? '🟢' : geoScore >= 50 ? '🟡' : '🔴';
  const scoreLabel = geoScore >= 80 ? 'GEO Ready' : geoScore >= 50 ? 'Needs Work' : 'Not Optimized';
  const scoreColor = geoScore >= 80 ? '#16a34a' : geoScore >= 50 ? '#ca8a04' : '#dc2626';
  const signalsHtml = formatSignals(reportText);
  const quickWinsHtml = formatQuickWins(reportText);

  try {
    await resend.emails.send({
      from: 'GEO Analyzer <onboarding@resend.dev>',
      to,
      subject: `GEO Report: ${geoScore}/100 ${scoreEmoji} ${url ? `— ${new URL(url).hostname}` : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:620px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 6px -1px rgba(0,0,0,0.07);">

            <!-- Header -->
            <div style="background:#4f46e5;padding:28px 32px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-weight:900;font-size:16px;">G</span>
                </div>
                <div>
                  <h1 style="margin:0;color:white;font-size:18px;font-weight:700;">GEO Analyzer Report</h1>
                  <p style="margin:2px 0 0;color:#c7d2fe;font-size:12px;">The Yoast SEO of the AI Era</p>
                </div>
              </div>
            </div>

            <!-- Score -->
            <div style="padding:28px 32px;text-align:center;border-bottom:1px solid #f3f4f6;">
              <div style="font-size:72px;font-weight:900;color:${scoreColor};line-height:1;">${geoScore}</div>
              <div style="font-size:14px;color:#6b7280;margin-top:4px;">/ 100 &nbsp;${scoreEmoji}&nbsp; <strong style="color:${scoreColor};">${scoreLabel}</strong></div>
              ${url ? `<div style="margin-top:12px;"><a href="${url}" style="font-size:12px;color:#4f46e5;word-break:break-all;">${url}</a></div>` : ''}
            </div>

            <!-- Signal Breakdown -->
            ${
              signalsHtml
                ? `
            <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6;">
              <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Signal Breakdown</h2>
              ${signalsHtml}
            </div>`
                : ''
            }

            <!-- Quick Wins -->
            ${
              quickWinsHtml
                ? `
            <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6;">
              <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Quick Wins</h2>
              <ol style="margin:0;padding-left:20px;">${quickWinsHtml}</ol>
            </div>`
                : ''
            }

            <!-- Full Report -->
            <div style="padding:24px 32px;">
              <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Full Report</h2>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;">
                <pre style="margin:0;font-family:'Courier New',monospace;font-size:11px;line-height:1.7;color:#334155;white-space:pre-wrap;word-break:break-word;">${reportText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </div>
              <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
                💡 Tip: To save as PDF, open this email in your browser and use Print → Save as PDF
              </p>
            </div>

            <!-- Footer -->
            <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Generated by <strong>GEO Analyzer</strong> · Powered by AI</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
