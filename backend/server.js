'use strict';

/**
 * server.js
 *
 * Express server for the portfolio email backend.
 *
 * Responsibilities:
 *   - Load environment variables from .env
 *   - Configure CORS, JSON body parsing, and security middleware
 *   - Expose POST /api/contact for contact form submissions
 *   - Validate and sanitize all incoming request data
 *   - Delegate email delivery to emailService.js
 *   - Return clear JSON responses; never leak SMTP details
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { sendContactNotification, sendVisitorConfirmation } = require('./emailService');

/* ── Validate required environment variables on startup ─────────────────────── */
const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_EMAIL', 'SMTP_PASSWORD'];
const missingEnv   = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('[FATAL] Copy .env.example to .env and fill in your credentials.');
  process.exit(1);
}

/* ── Express setup ──────────────────────────────────────────────────────────── */
const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

/* Allowed frontend origins — configurable via FRONTEND_ORIGIN env var.
   Falls back to common local-dev origins for convenience. */
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://portfolio-82iw.onrender.com',
  'null', // file:// origin (open-file dev mode)
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman) and configured origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

/* Limit request body to 50 KB — prevents large payload abuse */
app.use(express.json({ limit: '50kb' }));

/* ── Validation helpers ─────────────────────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateContactPayload(body) {
  const errors = [];

  const name    = (body.name    || '').trim();
  const email   = (body.email   || '').trim();
  const message = (body.message || '').trim();

  if (!name || name.length < 2)    errors.push('Name must be at least 2 characters.');
  if (name.length > 120)           errors.push('Name must be 120 characters or fewer.');

  if (!email)                      errors.push('Email address is required.');
  else if (!EMAIL_RE.test(email))  errors.push('Please provide a valid email address.');
  else if (email.length > 254)     errors.push('Email address is too long.');

  if (!message || message.length < 10) errors.push('Message must be at least 10 characters.');
  if (message.length > 5000)           errors.push('Message must be 5000 characters or fewer.');

  return { errors, name, email, message };
}

/* ── Simple in-memory rate-limit to prevent duplicate/spam submissions ──────── */
/* Tracks the last submission timestamp per IP. 
   A real production deployment should use Redis or a similar persistent store. */
const lastSubmit = new Map();
const COOLDOWN_MS = 60_000; // 60 seconds per IP

function checkRateLimit(ip) {
  const now  = Date.now();
  const last = lastSubmit.get(ip);
  if (last && (now - last) < COOLDOWN_MS) {
    return Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
  }
  lastSubmit.set(ip, now);
  // Housekeeping: prune stale entries
  if (lastSubmit.size > 500) {
    for (const [k, v] of lastSubmit) {
      if (now - v > COOLDOWN_MS) lastSubmit.delete(k);
    }
  }
  return 0; // 0 = not rate-limited
}

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/contact
   ══════════════════════════════════════════════════════════════════════════════ */
app.post('/api/contact', async (req, res) => {
  /* ─ Content-type check ─ */
  if (!req.is('application/json')) {
    return res.status(415).json({
      success: false,
      message: 'Request must use Content-Type: application/json.',
    });
  }

  /* ─ Rate-limit check ─ */
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  const waitSec = checkRateLimit(clientIp);
  if (waitSec > 0) {
    return res.status(429).json({
      success: false,
      message: `Please wait ${waitSec} second${waitSec !== 1 ? 's' : ''} before sending another message.`,
    });
  }

  /* ─ Validate & sanitize ─ */
  const { errors, name, email, message } = validateContactPayload(req.body);
  if (errors.length) {
    return res.status(422).json({ success: false, message: errors[0] });
  }

  /* ─ Format submission timestamp (IST-aware) ─ */
  const submittedAt = new Date().toLocaleString('en-IN', {
    timeZone:  'Asia/Kolkata',
    dateStyle: 'long',
    timeStyle: 'medium',
  }) + ' IST';

  /* ─ Step 1: Send notification email to portfolio owner ─ */
  try {
    await sendContactNotification({ name, email, message, submittedAt });
  } catch (notifyErr) {
    console.error('[EMAIL] Failed to send notification email:', notifyErr.message);
    return res.status(502).json({
      success: false,
      message: 'Unable to send your message right now. Please try again later.',
    });
  }

  /* ─ Step 2: Send confirmation email to visitor (best-effort) ─ */
  try {
    await sendVisitorConfirmation({ name, email, message });
  } catch (confirmErr) {
    /* The notification was delivered; log the confirmation failure but
       still respond with success so the visitor is not incorrectly informed. */
    console.error('[EMAIL] Notification delivered, but confirmation email failed:', confirmErr.message);
  }

  /* ─ Success response ─ */
  return res.status(200).json({
    success: true,
    message: 'Your message has been received successfully.',
  });
});

/* ── Health-check endpoint ──────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── 404 handler ────────────────────────────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

/* ── Global error handler ───────────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[SERVER] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
  });
});

/* ── Start server ───────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[SERVER] Portfolio email backend running on http://localhost:${PORT}`);
  console.log(`[SERVER] CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
