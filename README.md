# 🌸 NORA MVP — Setup Guide

**Navigating Obstetric Resources & Access**  
AI-powered maternal health support for Black women.

---

## What's Included

```
nora-mvp/
├── public/
│   ├── index.html     ← Landing page
│   └── demo.html      ← Judge demo (chatbot + SMS)
├── server.js          ← Express API (Claude + Twilio)
├── package.json
├── vercel.json        ← Vercel deployment config
└── .env.example       ← Copy to .env and fill in
```

---

## Local Setup (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `TWILIO_ACCOUNT_SID` | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Buy a number in Twilio (e.g. `+15045550123`) |

### 3. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Twilio Setup (SMS)

1. Sign up at [twilio.com](https://www.twilio.com) (free trial works for demos)
2. Go to **Console → Phone Numbers → Buy a Number**
3. Pick any US number with SMS capability (~$1/month)
4. Copy your **Account SID**, **Auth Token**, and **phone number** into `.env`
5. On a free trial, you can only send SMS to **verified numbers** — verify the judges' numbers in the Twilio console under **Verified Caller IDs**

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Then in your **Vercel dashboard → Project → Settings → Environment Variables**, add all four env vars from `.env`.

---

## For the Pitch Demo (iPad Setup)

1. Deploy to Vercel and get your live URL (e.g. `nora-demo.vercel.app`)
2. Open `nora-demo.vercel.app/demo.html` on each iPad
3. Judges tap one of the 3 preset questions
4. NORA responds with health guidance
5. Judges enter their phone number and tap **"Send via Text Message"**
6. They receive the response as an SMS on their phone ✨

---

## The 3 Demo Questions

| # | Question | Resources Shown |
|---|---|---|
| 1 | Nutrition during pregnancy | WIC, CDC, March of Dimes, BMMA |
| 2 | Safe exercises + baby size | ACOG Guidelines, Black Women's Health Imperative |
| 3 | Can I eat deli meat? | FDA Food Safety, CDC Listeria, March of Dimes |

---

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework — fast, iPad-friendly)
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude (claude-opus-4-5)
- **SMS**: Twilio Programmable SMS
- **Hosting**: Vercel
