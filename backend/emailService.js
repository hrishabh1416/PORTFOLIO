'use strict';

/**
 * emailService.js
 *
 * Configures the Nodemailer SMTP transport and exposes two functions:
 *   - sendContactNotification  : sends the visitor's inquiry to the portfolio owner
 *   - sendVisitorConfirmation  : sends a thank-you confirmation to the visitor
 *
 * All HTML content is escaped before insertion to prevent HTML injection.
 * SMTP credentials are read exclusively from environment variables.
 */

const nodemailer = require('nodemailer');

/* ── SMTP transport ─────────────────────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true', // false for port 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  // Reasonable timeouts to avoid hanging on SMTP failures
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
});

/* ── HTML escape helper ─────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Shared email styles ────────────────────────────────────────────────────── */
const BASE_STYLE = `
  body { margin: 0; padding: 0; background: #0a0a14; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrapper { max-width: 600px; margin: 0 auto; background: #0a0a14; }
  .header  { background: linear-gradient(135deg, #1a1040 0%, #0d1a2e 100%);
              border-bottom: 2px solid #6c47ff; padding: 36px 40px; text-align: center; }
  .header-logo { display: inline-block; width: 52px; height: 52px; line-height: 52px;
                  border-radius: 14px; background: linear-gradient(135deg, #6c47ff, #22d3ee);
                  color: #fff; font-size: 22px; font-weight: 800; margin-bottom: 14px; }
  .header-title { color: #e8e4ff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
  .header-sub   { color: #8b7dcc; font-size: 13px; margin: 6px 0 0; }
  .body    { padding: 36px 40px; background: #11112a; }
  .intro   { color: #c0bce8; font-size: 15px; line-height: 1.7; margin: 0 0 28px; }
  .section { background: #1a1a3a; border: 1px solid #2a2a5a; border-radius: 12px;
              padding: 24px 28px; margin-bottom: 20px; }
  .section-title { color: #9b7dff; font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
                    text-transform: uppercase; margin: 0 0 14px; }
  .field   { margin-bottom: 14px; }
  .field:last-child { margin-bottom: 0; }
  .field-label { color: #6b6896; font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
                  text-transform: uppercase; display: block; margin-bottom: 4px; }
  .field-value { color: #e0deff; font-size: 14px; line-height: 1.6; word-break: break-word; }
  .message-box { background: #0d0d22; border-left: 3px solid #6c47ff; border-radius: 8px;
                  padding: 18px 20px; }
  .message-text { color: #d4d0f5; font-size: 14px; line-height: 1.8; white-space: pre-wrap;
                   word-break: break-word; }
  .footer  { background: #09090f; border-top: 1px solid #1f1f3a; padding: 24px 40px;
              text-align: center; }
  .footer-text { color: #4a476a; font-size: 12px; line-height: 1.7; margin: 0; }
  .footer-link { color: #6c47ff; text-decoration: none; }
  .btn     { display: inline-block; background: linear-gradient(135deg, #6c47ff, #22d3ee);
              color: #fff !important; text-decoration: none; font-weight: 700; font-size: 14px;
              padding: 13px 28px; border-radius: 8px; margin-top: 20px; }
  @media (max-width: 480px) {
    .body, .header, .footer { padding-left: 20px; padding-right: 20px; }
    .section { padding: 18px 16px; }
  }
`;

/* ══════════════════════════════════════════════════════════════════════════════
   sendContactNotification
   Sends the visitor's full inquiry to the portfolio owner's inbox.
   ══════════════════════════════════════════════════════════════════════════════ */
async function sendContactNotification({ name, email, message, submittedAt }) {
  const safeName    = escapeHtml(name);
  const safeEmail   = escapeHtml(email);
  const safeMessage = escapeHtml(message);
  const safeDate    = escapeHtml(submittedAt);

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>New Portfolio Contact Form Submission</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">HS</div>
    <h1 class="header-title">New Portfolio Inquiry</h1>
    <p class="header-sub">Someone has submitted your portfolio contact form</p>
  </div>

  <!-- BODY -->
  <div class="body">
    <p class="intro">
      Hi Hrishabh,<br/><br/>
      You've received a new message through your portfolio website contact form.
      The full submission details are listed below.
    </p>

    <!-- Visitor Info -->
    <div class="section">
      <p class="section-title">Visitor Information</p>
      <div class="field">
        <span class="field-label">Name</span>
        <span class="field-value">${safeName}</span>
      </div>
      <div class="field">
        <span class="field-label">Email</span>
        <span class="field-value">
          <a href="mailto:${safeEmail}" style="color:#22d3ee;text-decoration:none;">${safeEmail}</a>
        </span>
      </div>
      <div class="field">
        <span class="field-label">Submitted At</span>
        <span class="field-value">${safeDate}</span>
      </div>
    </div>

    <!-- Message -->
    <div class="section">
      <p class="section-title">Message</p>
      <div class="message-box">
        <p class="message-text">${safeMessage}</p>
      </div>
    </div>

    <p style="color:#8b7dcc;font-size:13px;margin-top:24px;line-height:1.7;">
      To reply directly to ${safeName}, simply reply to this email —
      the Reply-To address is set to their submitted email address.
    </p>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p class="footer-text">
      This notification was sent automatically by your portfolio backend.<br/>
      &copy; ${new Date().getFullYear()} Hrishabh Shrivastava &mdash; Portfolio Website
    </p>
  </div>

</div>
</body>
</html>`;

  const textBody = `New Portfolio Inquiry — Contact Form Submission
================================================

You've received a new message through your portfolio website.

VISITOR INFORMATION
-------------------
Name:         ${name}
Email:        ${email}
Submitted At: ${submittedAt}

MESSAGE
-------
${message}

---
Reply to this email to respond directly to ${name} at ${email}.
This notification was sent automatically by your portfolio backend.
`;

  await transporter.sendMail({
    from:    `"Hrishabh Shrivastava — Portfolio" <${process.env.SMTP_EMAIL}>`,
    to:      'hrishabhshrivastava16@gmail.com',
    replyTo: email,
    subject: `New Portfolio Contact Form Submission — ${name}`,
    html:    htmlBody,
    text:    textBody,
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   sendVisitorConfirmation
   Sends a personalised thank-you email to the visitor after successful submission.
   ══════════════════════════════════════════════════════════════════════════════ */
async function sendVisitorConfirmation({ name, email, message }) {
  const safeName    = escapeHtml(name);
  const safeMessage = escapeHtml(message);

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Thank You for Visiting My Portfolio</title>
  <style>
    ${BASE_STYLE}
    .greeting { color: #c0bce8; font-size: 16px; line-height: 1.8; margin: 0 0 20px; }
    .para     { color: #b0acda; font-size: 14px; line-height: 1.85; margin: 0 0 16px; }
    .signature{ color: #e0deff; font-size: 15px; font-weight: 600; margin: 28px 0 4px; }
    .sig-role { color: #6c6896; font-size: 13px; margin: 0; }
    .divider  { border: none; border-top: 1px solid #2a2a5a; margin: 28px 0; }
  </style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">HS</div>
    <h1 class="header-title">Thank You for Reaching Out!</h1>
    <p class="header-sub">Your message has been received</p>
  </div>

  <!-- BODY -->
  <div class="body">
    <p class="greeting">Dear ${safeName},</p>

    <p class="para">
      Thank you for taking the time to visit my portfolio and for reaching out to me.
      I truly appreciate your interest, valuable feedback, and the time you have taken
      to share your thoughts, suggestions, or queries.
    </p>

    <p class="para">
      Your feedback and recommendations mean a great deal to me. They help me identify
      areas for improvement, learn new perspectives, and continuously enhance my skills,
      projects, and overall work.
    </p>

    <p class="para">
      I have successfully received your message and will carefully review your query,
      feedback, or recommendations. I will do my best to get back to you with a thoughtful
      and relevant response as soon as possible.
    </p>

    <!-- Message summary -->
    <div class="section">
      <p class="section-title">Your Submitted Message</p>
      <div class="message-box">
        <p class="message-text">${safeMessage}</p>
      </div>
    </div>

    <p class="para">
      In the meantime, thank you once again for visiting my portfolio and taking the
      initiative to connect with me. I genuinely value your time, support, and interest
      in my work.
    </p>

    <p class="para">
      I look forward to staying connected and hopefully having a meaningful conversation
      with you.
    </p>

    <hr class="divider"/>

    <p class="signature">Best regards,<br/>Hrishabh Shrivastava</p>
    <p class="sig-role">
      Full‑Stack Developer &mdash; MERN Stack<br/>
      <a href="https://github.com/hrishabh1416" class="footer-link" style="color:#6c47ff;">
        Github
      </a>
      <a href="https://www.linkedin.com/in/hrishabh-shrivastava-5a45a4219/" class="footer-link" style="color:#6c47ff;">
      Linkedin
      </a>
    </p>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p class="footer-text">
      This is an automated confirmation. To get in touch, reply to this email or contact
      <a href="mailto:hrishabhshrivastava16@gmail.com" class="footer-link">
        hrishabhshrivastava16@gmail.com
      </a>.<br/>
      &copy; ${new Date().getFullYear()} Hrishabh Shrivastava &mdash; Portfolio Website
    </p>
  </div>

</div>
</body>
</html>`;

  const textBody = `Thank You for Reaching Out!
===========================

Dear ${name},

Thank you for taking the time to visit my portfolio and for reaching out to me.
I truly appreciate your interest, valuable feedback, and the time you have taken
to share your thoughts, suggestions, or queries.

Your feedback and recommendations mean a great deal to me. They help me identify
areas for improvement, learn new perspectives, and continuously enhance my skills,
projects, and overall work.

I have successfully received your message and will carefully review your query,
feedback, or recommendations. I will do my best to get back to you with a thoughtful
and relevant response as soon as possible.

YOUR SUBMITTED MESSAGE
----------------------
${message}

In the meantime, thank you once again for visiting my portfolio and taking the
initiative to connect with me. I genuinely value your time, support, and interest
in my work.

I look forward to staying connected and hopefully having a meaningful conversation
with you.

Best regards,
Hrishabh Shrivastava
Full-Stack Developer — MERN Stack
https://github.com/hrishabh1416

---
This is an automated confirmation email.
To get in touch, reply to this email or contact hrishabhshrivastava16@gmail.com
`;

  await transporter.sendMail({
    from:    `"Hrishabh Shrivastava" <${process.env.SMTP_EMAIL}>`,
    to:      email,
    replyTo: 'hrishabhshrivastava16@gmail.com',
    subject: 'Thank You for Visiting My Portfolio — Your Message Has Been Received',
    html:    htmlBody,
    text:    textBody,
  });
}

/* ── Export ─────────────────────────────────────────────────────────────────── */
module.exports = { sendContactNotification, sendVisitorConfirmation };
