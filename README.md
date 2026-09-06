# Nuance V2 — DeepSeek Edition

This version uses the DeepSeek API instead of the OpenAI API.

## What it can analyze
- single words
- phrases
- phrasal verbs
- idioms
- collocations
- complete sentences from newspapers, magazines, books, papers, etc.

Examples:
- `flurry of`
- `bear out`
- `gain traction`
- `come under scrutiny`
- `A flurry of announcements followed the meeting.`

## Security
Do NOT put your API key inside `index.html` or `api/analyze.js`.

The server reads the key from this environment variable:

DEEPSEEK_API_KEY

Optional model variable:

DEEPSEEK_MODEL=deepseek-v4-flash

## Deploy on Vercel

1. Unzip this folder.
2. Upload/import it into Vercel.
3. Open the Vercel project.
4. Go to Settings → Environment Variables.
5. Add:

Name:
DEEPSEEK_API_KEY

Value:
your DeepSeek API key

6. Optional second variable:

Name:
DEEPSEEK_MODEL

Value:
deepseek-v4-flash

7. Redeploy the project.
8. Open the Vercel HTTPS URL.
9. Test a phrase such as:
   `flurry of`
10. On iPhone/iPad Safari:
    Share → Add to Home Screen.

## Important
Opening index.html directly on Windows will show the interface but the AI call will not work.
The AI endpoint runs on the hosted Vercel server.

## Saved vocabulary
V2 currently saves vocabulary locally in the browser.
Automatic iPhone ↔ iPad ↔ Windows sync will be added in a later version.
