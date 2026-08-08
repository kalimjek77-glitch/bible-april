import type { VercelRequest, VercelResponse } from "@vercel/node";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  message?: string;
  systemInstruction?: string;
  history?: ChatMessage[];
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // =====================================================
  // ONLY ALLOW POST
  // =====================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  try {
    // =====================================================
    // CHECK API KEY
    // =====================================================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing.");

      return res.status(500).json({
        error:
          "Gemini API key is not configured on the server.",
      });
    }

    // =====================================================
    // GET REQUEST DATA
    // =====================================================

    const body = req.body as RequestBody;

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const systemInstruction =
      typeof body.systemInstruction === "string"
        ? body.systemInstruction
        : "";

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    if (!message) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    // =====================================================
    // BUILD GEMINI CONTENTS
    // =====================================================

    const contents = history
      .filter(
        (item) =>
          item &&
          (item.role === "user" ||
            item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim()
      )
      .map((item) => ({
        role:
          item.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: item.content,
          },
        ],
      }));

    // Make sure current message exists even if
    // the frontend didn't include it in history.

    const lastMessage =
      contents[contents.length - 1];

    const lastMessageText =
      lastMessage?.parts?.[0]?.text;

    if (
      lastMessage?.role !== "user" ||
      lastMessageText !== message
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

    // =====================================================
    // GEMINI API
    // =====================================================

    const model = "gemini-2.5-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  systemInstruction ||
                  "You are April, a helpful AI Bible Assistant.",
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

    // =====================================================
    // READ GEMINI RESPONSE
    // =====================================================

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        data
      );

      const errorMessage =
        data?.error?.message ||
        "Gemini API request failed.";

      return res.status(response.status).json({
        error: errorMessage,
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          (part: { text?: string }) =>
            part.text || ""
        )
        .join("")
        .trim();

    if (!reply) {
      console.error(
        "Gemini returned no text:",
        data
      );

      return res.status(500).json({
        error:
          "April did not return a response.",
      });
    }

    // =====================================================
    // RETURN TO CHAT.TSX
    // =====================================================

    return res.status(200).json({
      reply,
    });
  } catch (error) {
    console.error(
      "API /chat error:",
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