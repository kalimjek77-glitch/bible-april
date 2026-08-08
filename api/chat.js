```js
// api/chat.js

export default async function handler(req, res) {
  // Allow POST only
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const {
      message,
      systemInstruction,
      history = [],
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is not configured."
      );

      return res.status(500).json({
        error:
          "Gemini API key is not configured on the server.",
      });
    }

    // Build conversation for Gemini
    const contents = [];

    // Previous conversation
    if (Array.isArray(history)) {
      for (const item of history) {
        if (
          !item ||
          typeof item.content !== "string"
        ) {
          continue;
        }

        contents.push({
          role:
            item.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text: item.content,
            },
          ],
        });
      }
    }

    // Make sure the current message is included
    const lastMessage =
      contents[contents.length - 1];

    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.parts?.[0]?.text !== message
    ) {
      contents.push({
        role: "user",
        parts: [
          {
            text: message,
          },
        ],
      });
    }

    // Gemini API
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
                  "You are April, a helpful AI assistant.",
              },
            ],
          },

          contents,

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        data
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed.",
      });
    }

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

    return res.status(200).json({
      reply,
    });
  } catch (error) {
    console.error(
      "API /api/chat error:",
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
```
