import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── System prompt builder ─────────────────────────────────────────────────────
// Builds a personalized prompt if we have profile data, generic if not
function buildSystemPrompt(profile = null) {
  const base = `You are NORA (Navigating Obstetric Resources & Access), an AI maternal health companion built specifically to support Black women across their full reproductive journey — including those trying to conceive, those currently pregnant, and those in the postpartum period.

Your tone is: warm, reassuring, clear, and empowering. Never clinical or cold. Speak like a knowledgeable friend who genuinely cares.

Guidelines:
- Support women at all stages: preconception, pregnancy, and postpartum (up to 2 years after birth)
- Provide accurate, helpful health information tailored to where they are in their journey
- Be culturally aware and sensitive to the unique challenges Black women face in maternal healthcare, including systemic barriers and disparities in care
- Keep responses concise but thorough (3-5 paragraphs max)
- Always recommend consulting their healthcare provider for personalized advice
- When relevant, mention that NORA can connect them with local resources and their care team

You are NOT providing medical diagnosis. You are providing health education and resource navigation.`;

  if (!profile) return base;

  const lines = [];

  if (profile.display_name) lines.push(`The user's name is ${profile.display_name}.`);
  if (profile.zip_code) lines.push(`They are located in zip code ${profile.zip_code}.`);

  const stage = profile.journey_stage;

  if (stage === 'pregnant') {
    lines.push(`This user is currently pregnant.`);
    if (profile.pregnancy_week) lines.push(`They are at week ${profile.pregnancy_week} of their pregnancy.`);
    if (profile.due_date) lines.push(`Their due date is ${profile.due_date}.`);
    lines.push(`Tailor all responses to pregnancy — focus on symptoms, nutrition, baby development, and prenatal care relevant to their week if known.`);
  }

  if (stage === 'preconception') {
    lines.push(`This user is trying to conceive and is not yet pregnant.`);
    if (profile.lmp_date) lines.push(`Their last menstrual period was on ${profile.lmp_date}.`);
    if (profile.cycle_length) lines.push(`Their average cycle length is ${profile.cycle_length} days.`);
    lines.push(`Tailor responses to preconception health — focus on cycle tracking, ovulation, fertility nutrition, preparing the body for pregnancy, and what to expect when trying to conceive.`);
  }

  if (stage === 'postpartum') {
    lines.push(`This user has recently given birth and is in the postpartum period.`);
    if (profile.baby_birth_date) {
      const months = Math.floor((new Date() - new Date(profile.baby_birth_date)) / (1000 * 60 * 60 * 24 * 30.44));
      lines.push(`Their baby was born on ${profile.baby_birth_date}, approximately ${months} month(s) ago.`);
    }
    lines.push(`Tailor responses to postpartum health — focus on recovery, mental health, breastfeeding, newborn care, and the physical and emotional changes after birth.`);
  }

  if (lines.length === 0) return base;

  return `${base}\n\nPersonalization context: ${lines.join(' ')}`;
}

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

// ── Profile endpoints ─────────────────────────────────────────────────────────

// GET /api/profile/:userId — load a user's profile
app.get('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = row not found, that's ok
    return res.status(500).json({ error: error.message });
  }

  res.json({ profile: data || null });
});

// POST /api/profile — create or update a user's profile
app.post('/api/profile', async (req, res) => {
  const { userId, display_name, pregnancy_week, due_date, zip_code, journey_stage, lmp_date, cycle_length, baby_birth_date } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: display_name || null,
      journey_stage: journey_stage || null,
      pregnancy_week: pregnancy_week ? parseInt(pregnancy_week) : null,
      due_date: due_date || null,
      zip_code: zip_code || null,
      lmp_date: lmp_date || null,
      cycle_length: cycle_length ? parseInt(cycle_length) : null,
      baby_birth_date: baby_birth_date || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ profile: data });
});

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { question, questionIndex, userId } = req.body;

  if (!question) return res.status(400).json({ error: 'Question required' });

  // Load profile if userId provided — used to personalize Claude's prompt
  let profile = null;
  if (userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    profile = data || null;
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: buildSystemPrompt(profile),
      messages: [{ role: 'user', content: question }],
    });

    const response = message.content[0].text;

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

  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  if (!message) return res.status(400).json({ error: 'Message required' });

  // Sanitize phone — strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Make sure it has a country code — add +1 for US if missing
  const formatted = cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;

  if (formatted.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body: `💜 NORA: ${message.substring(0, 100)}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formatted,
    });

    console.log(`SMS sent to ${formatted}`);
    res.json({ success: true });

  } catch (err) {
    console.error('Twilio error:', err.message);
    // Surface friendly error for common Twilio issues
    if (err.code === 21608) {
      return res.status(400).json({ error: 'This number is not verified. During trial, only verified numbers can receive texts.' });
    }
    res.status(500).json({ error: err.message || 'Failed to send text message' });
  }
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 NORA server running on http://localhost:${PORT}\n`);
});