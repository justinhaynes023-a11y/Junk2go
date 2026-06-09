import "dotenv/config";
import express from "express";
import cors from "cors";
import { Resend } from "resend";

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || "Junk2Go Leads <onboarding@resend.dev>";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text", text: item.text.trim() }],
    }));
}

function parseDataUrl(dataUrl) {
  const match = typeof dataUrl === "string" && dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function openAiRequest(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    ...(options.headers || {}),
  };

  if (typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`https://api.openai.com${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI request failed.");
  }

  return data;
}

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter((image) => {
      return (
        image &&
        typeof image.dataUrl === "string" &&
        image.dataUrl.startsWith("data:image/")
      );
    })
    .slice(0, 4)
    .map((image) => image.dataUrl);
}

function buildSystemPrompt() {
  return [
    "You are Ava, Junk2Go's AI scheduling and quote assistant.",
    "Your job is to qualify junk removal leads, collect the minimum details needed for a useful quote, and keep the conversation short and friendly.",
    "Always ask for the next missing piece of information rather than giving a long explanation.",
    "When needed, collect: junk type, approximate volume, pickup address or service area, stairs/elevator/access constraints, preferred timeframe, name, and phone number.",
    "If the customer asks for pricing, give a careful estimate range only when enough details are available and clearly note that final pricing is reviewed by the owner.",
    "If the request is outside the service area or unclear, ask a clarifying question.",
    "Keep replies concise, helpful, and ready to continue the chat.",
  ].join(" ");
}


function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTranscript(messages = []) {
  if (!Array.isArray(messages)) return "";
  return messages
    .filter((message) => message && typeof message.text === "string")
    .map((message) => `${message.role === "assistant" ? "Ava" : "Customer"}: ${message.text.trim()}`)
    .join("\n\n");
}

async function extractLead(messages = []) {
  const transcript = buildTranscript(messages);

  const response = await openAiRequest("/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "Extract a junk removal lead from the transcript.",
            "Return ONLY valid JSON with this exact shape:",
            "{\"hasEnoughInfo\":boolean,\"missingFields\":string[],\"name\":string,\"phone\":string,\"address\":string,\"junkDescription\":string,\"preferredTimeframe\":string,\"accessNotes\":string,\"summary\":string}",
            "Required fields for hasEnoughInfo=true: name, phone, address, and junkDescription.",
            "Use empty strings when unknown. Do not invent details.",
          ].join(" "),
        },
        {
          role: "user",
          content: transcript || "No transcript provided.",
        },
      ],
      temperature: 0,
      max_tokens: 450,
    }),
  });

  const raw = response.choices?.[0]?.message?.content;
  const parsed = JSON.parse(stripCodeFence(raw));

  return {
    hasEnoughInfo: Boolean(parsed.hasEnoughInfo),
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
    name: parsed.name || "",
    phone: parsed.phone || "",
    address: parsed.address || "",
    junkDescription: parsed.junkDescription || "",
    preferredTimeframe: parsed.preferredTimeframe || "",
    accessNotes: parsed.accessNotes || "",
    summary: parsed.summary || "",
  };
}

function buildLeadEmailHtml(lead, transcript, imageCount) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2>New Junk2Go Lead</h2>
      <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(lead.phone)}</p>
      <p><strong>Address:</strong> ${escapeHtml(lead.address)}</p>
      <p><strong>Junk Description:</strong> ${escapeHtml(lead.junkDescription)}</p>
      <p><strong>Preferred Timeframe:</strong> ${escapeHtml(lead.preferredTimeframe || "Not provided")}</p>
      <p><strong>Access Notes:</strong> ${escapeHtml(lead.accessNotes || "Not provided")}</p>
      <p><strong>Photos Attached:</strong> ${imageCount}</p>
      <h3>AI Summary</h3>
      <p>${escapeHtml(lead.summary || "No summary available.")}</p>
      <h3>Conversation Transcript</h3>
      <pre style="white-space:pre-wrap;background:#f5f5f5;padding:14px;border-radius:8px;">${escapeHtml(transcript)}</pre>
    </div>
  `;
}

function buildImageAttachments(images = []) {
  return normalizeImages(images).map((dataUrl, index) => {
    const parsed = parseDataUrl(dataUrl);
    const extension = parsed?.mimeType?.split("/")[1]?.split(";")[0] || "jpg";

    return {
      filename: `junk-photo-${index + 1}.${extension}`,
      content: parsed.buffer.toString("base64"),
    };
  });
}

app.post("/agent/chat", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENAI_API_KEY environment variable.",
    });
  }

  const { message, history = [], images = [] } = req.body ?? {};
  const hasText = typeof message === "string" && message.trim();
  const hasImages = Array.isArray(images) && images.length > 0;

  if (!hasText && !hasImages) {
    return res.status(400).json({ error: "message or images are required." });
  }

  const normalizedMessage = typeof message === "string" ? message.trim() : "";
  const userText = normalizedMessage || "I uploaded photos for a junk removal quote. Please review them and tell me what other details you need.";

  const assistantHistory = normalizeHistory(history);
  const imageUrls = normalizeImages(images);

  try {
    const response = await openAiRequest("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          ...assistantHistory,
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userText,
              },
              ...imageUrls.map((url) => ({
                type: "image_url",
                image_url: {
                  url,
                  detail: "auto",
                },
              })),
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    const reply = response.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({ error: "Agent response was empty." });
    }

    return res.json({
      reply,
      model: OPENAI_MODEL,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


app.post("/agent/lead", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY environment variable." });
  }

  const { messages = [], images = [] } = req.body ?? {};

  try {
    const lead = await extractLead(messages);

    if (!lead.hasEnoughInfo) {
      return res.json({
        submitted: false,
        missingFields: lead.missingFields,
        lead,
      });
    }

    if (!resend || !RESEND_API_KEY) {
      return res.status(500).json({ error: "Missing RESEND_API_KEY environment variable." });
    }

    if (!OWNER_EMAIL) {
      return res.status(500).json({ error: "Missing OWNER_EMAIL environment variable." });
    }

    const transcript = buildTranscript(messages);
    const attachments = buildImageAttachments(images);

    const email = await resend.emails.send({
      from: FROM_EMAIL,
      to: OWNER_EMAIL,
      subject: `New Junk Removal Lead - ${lead.name || lead.phone || "Website Chat"}`,
      html: buildLeadEmailHtml(lead, transcript, attachments.length),
      attachments,
    });

    return res.json({
      submitted: true,
      lead,
      emailId: email.data?.id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`OpenAI chat proxy running on http://localhost:${PORT}`);
});
