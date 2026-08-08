export default async function handler(req, res) {
  // =====================================================
  // CORS / METHOD
  // =====================================================

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    // ===================================================
    // CHECK API KEY
    // ===================================================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is not configured in Vercel.",
      });
    }

    // ===================================================
    // REQUEST BODY
    // ===================================================

    const {
      message,
      systemInstruction,
      history = [],
    } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    // ===================================================
    // CONVERSATION
    // ===================================================

    const contents = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (
          !item ||
          typeof item.content !== "string"
        ) {
          continue;
        }

        const role =
          item.role === "assistant"
            ? "model"
            : "user";

        contents.push({
          role,
          parts: [
            {
              text: item.content,
            },
          ],
        });
      }
    }

    // ===================================================
    // GEMINI API
    // ===================================================

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey,
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  systemInstruction ||
                  "You are a helpful AI assistant.",
              },
            ],
          },

          contents: [
            ...contents,
            {
              role: "user",
              parts: [
                {
                  text: message,
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    // ===================================================
    // GEMINI RESPONSE
    // ===================================================

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        data
      );

      return res.status(
        response.status
      ).json({
        error:
          data?.error?.message ||
          "Gemini API request failed.",
      });
    }

    // ===================================================
    // EXTRACT TEXT
    // ===================================================

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      console.error(
        "Gemini returned no text:",
        data
      );

      return res.status(500).json({
        error:
          "Gemini returned an empty response.",
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    return res.status(200).json({
      reply,
    });
  } catch (error) {
    console.error(
      "API error:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Internal server error.",
    });
  }
}