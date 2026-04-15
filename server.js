import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ── System prompt ─────────────────────────────────────────────────────────────
const NORA_SYSTEM_PROMPT = `You are NORA (Navigating Obstetric Resources & Access), an AI maternal health companion built specifically to support Black women during pregnancy. You provide warm, culturally competent, evidence-based health information.

Your tone is: warm, reassuring, clear, and empowering. Never clinical or cold. Speak like a knowledgeable friend who genuinely cares.

Guidelines:
- Always provide accurate, helpful pregnancy health information
- Be culturally aware and sensitive to the unique challenges Black mothers face
- Keep responses concise but thorough (3-5 paragraphs max)
- Always recommend consulting their healthcare provider for personalized advice
- When relevant, mention that NORA can connect them with local resources and their care team

You are NOT providing medical diagnosis. You are providing health education and resource navigation.`;

// Resources by topic
const RESOURCES = {
  nutrition: [
    'Black Mamas Matter Alliance',
    'WIC Program Resources',
    'CDC Pregnancy Nutrition Guide',
    'March of Dimes – Pregnancy Nutrition',
  ],
  exercise: [
    'ACOG Exercise in Pregnancy Guidelines',
    'Black Women\'s Health Imperative',
    'March of Dimes – Exercise & Pregnancy',
    'BabyCenter Pregnancy Workouts',
  ],
  food_safety: [
    'FDA Pregnancy Food Safety',
    'CDC Listeria Prevention',
    'March of Dimes – Foods to Avoid',
    'Black Mamas Matter Alliance',
  ],
};

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { question, questionIndex } = req.body;

  if (!question) return res.status(400).json({ error: 'Question required' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: NORA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }],
    });

    const response = message.content[0].text;

    // Pick relevant resources based on question index
    let resources = [];
    if (questionIndex === 0) resources = RESOURCES.nutrition;
    else if (questionIndex === 1) resources = RESOURCES.exercise;
    else if (questionIndex === 2) resources = RESOURCES.food_safety;

    res.json({ response, resources });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: 'Failed to get response from NORA' });
  }
});

// ── SMS endpoint ──────────────────────────────────────────────────────────────
app.post('/api/sms', async (req, res) => {
  const { phone, message } = req.body;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: '2149806387@tmomail.net',
      subject: '',
      text: `💜 NORA: ${message.substring(0, 300)}`,
    });

    console.log('Sent via Resend!');
    res.json({ success: true });

  } catch (err) {
    console.error('Resend error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to send' });
  }
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 NORA server running on http://localhost:${PORT}\n`);
});
