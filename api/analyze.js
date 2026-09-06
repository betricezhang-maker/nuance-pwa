export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { text, intensity, situation } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text." });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({
      error: "DEEPSEEK_API_KEY is not configured on the server."
    });
  }

  const systemPrompt = `
You are the language engine for Nuance, a context-aware vocabulary learning app.

Analyze a pasted word, phrase, idiom, collocation, or sentence.

Your goal is to:
1. identify the most useful target vocabulary item or expression,
2. explain its meaning in the supplied context,
3. compare nearby alternatives,
4. rank alternatives based on BOTH:
   - requested intensity
   - requested situation/register,
5. produce practical example sentences for a learner.

Return valid JSON only.
`;

  const userPrompt = `
User input:
${text}

Requested intensity: ${intensity}/5
Requested situation: ${situation}

Return exactly this JSON structure:

{
  "target": "target word or phrase",
  "part_of_speech": "noun/verb/adjective/adverb/idiom/collocation/phrase/etc",
  "meaning_in_context": "short, precise explanation",
  "original_context": "original sentence if supplied, otherwise empty string",
  "simpler_rewrite": "plain-English rewrite",
  "detected_intensity": 1,
  "register": "formal / neutral / informal / literary / journalistic / etc",
  "synonyms": [
    {
      "word": "alternative word or phrase",
      "intensity": 1,
      "tone": "short tone/register description",
      "situation_fit": "how suitable it is for ${situation}",
      "fit_score": 0,
      "key_difference": "precise nuance difference",
      "examples": [
        "natural example sentence 1",
        "natural example sentence 2",
        "natural example sentence 3"
      ]
    }
  ]
}

Rules:
- detected_intensity and synonym intensity must be integers from 1 to 5.
- fit_score must be an integer from 0 to 100.
- Give 5 to 8 alternatives when linguistically appropriate.
- The best score must reflect BOTH intensity and situation.
- For multi-word expressions, preserve the phrase-level meaning.
- Do not list false synonyms merely to fill the table.
- If the input is a sentence, interpret the target in that exact context.
- Keep explanations concise but meaningful.
`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        stream: false
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      console.error("DeepSeek error:", raw);
      const detail =
        raw?.error?.message ||
        raw?.message ||
        "DeepSeek API request failed.";
      return res.status(response.status || 500).json({ error: detail });
    }

    const textOutput = raw?.choices?.[0]?.message?.content;

    if (!textOutput) {
      return res.status(500).json({
        error: "DeepSeek returned no response content."
      });
    }

    let data;
    try {
      data = JSON.parse(textOutput);
    } catch (parseError) {
      console.error("JSON parse error:", textOutput);
      return res.status(500).json({
        error: "DeepSeek returned an unexpected response. Please try again."
      });
    }

    if (!data.target || !Array.isArray(data.synonyms)) {
      return res.status(500).json({
        error: "The AI response was missing required vocabulary fields."
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Could not contact DeepSeek. Please try again."
    });
  }
}