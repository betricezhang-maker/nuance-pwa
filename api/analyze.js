export const config = {
  maxDuration: 30
};

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);

  const systemPrompt = `
You are Nuance, a fast and precise English lexical assistant.

Return only genuinely close substitutes for the target expression in the supplied context.

Rules:
- Distinguish TRUE NEAR-SYNONYMS from merely related concepts.
- A candidate should be usable as a realistic replacement in at least one closely matching sentence.
- Do not rank a merely related word above a genuine synonym.
- Preserve idioms, collocations, phrasal verbs, and multi-word meanings.
- Be concise. This is a dictionary lookup, not an essay.
- Return JSON only.
`;

  const userPrompt = `
INPUT:
${text}

USER SETTINGS:
Intensity target: ${intensity}/5
Situation: ${situation}

Return exactly this JSON structure:

{
  "target": "word or phrase being analyzed",
  "part_of_speech": "noun/verb/adjective/adverb/idiom/collocation/phrase/etc",
  "meaning_in_context": "one short sentence",
  "original_context": "original sentence if supplied, otherwise empty string",
  "simpler_rewrite": "one short plain-English rewrite",
  "detected_intensity": 1,
  "register": "short register label",
  "synonyms": [
    {
      "word": "true near-synonym or close substitute",
      "intensity": 1,
      "tone": "very short label",
      "situation_fit": "very short fit description",
      "fit_score": 0,
      "key_difference": "one concise sentence explaining the difference",
      "examples": ["one natural example sentence"]
    }
  ],
  "related_but_not_synonyms": [
    {
      "word": "related term",
      "why_not_synonym": "one short explanation"
    }
  ]
}

STRICT RULES:
- Return ONLY the 3 BEST genuine near-synonyms/substitutes.
- Do NOT pad the list if fewer than 3 are genuinely close.
- Put related but non-substitutable words in related_but_not_synonyms.
- fit_score must reflect BOTH lexical closeness and the requested situation/intensity.
- Exactly ONE example sentence per synonym.
- All intensity values are integers 1-5.
- fit_score is integer 0-100.
- Keep the entire response compact.
`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 1200,
        stream: false
      })
    });

    clearTimeout(timeout);
    const raw = await response.json();

    if (!response.ok) {
      console.error("DeepSeek error:", raw);
      return res.status(response.status || 500).json({
        error: raw?.error?.message || raw?.message || "DeepSeek API request failed."
      });
    }

    const textOutput = raw?.choices?.[0]?.message?.content;
    if (!textOutput) {
      return res.status(500).json({ error: "DeepSeek returned no response content." });
    }

    let data;
    try {
      data = JSON.parse(textOutput);
    } catch {
      return res.status(500).json({ error: "DeepSeek returned invalid JSON. Please try again." });
    }

    if (!data.target || !Array.isArray(data.synonyms)) {
      return res.status(500).json({ error: "The AI response was missing required vocabulary fields." });
    }

    data.synonyms = data.synonyms
      .filter(x => x && x.word)
      .sort((a,b) => (b.fit_score || 0) - (a.fit_score || 0))
      .slice(0,3);

    data.related_but_not_synonyms = Array.isArray(data.related_but_not_synonyms)
      ? data.related_but_not_synonyms.slice(0,4)
      : [];

    return res.status(200).json(data);

  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      return res.status(504).json({
        error: "DeepSeek took too long to respond. Please try again."
      });
    }
    console.error(error);
    return res.status(500).json({
      error: "Could not contact DeepSeek. Please try again."
    });
  }
}