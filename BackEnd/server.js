import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { Resend } from "resend";

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PROMPT_ID = "pmpt_6a286324c7c88195ac05ac6d187ec75b0fafcc8c03f2a96d";

function normalizeImages(images = []) {
  if (!Array.isArray(images)) return [];

  return images
    .filter((image) => image?.dataUrl?.startsWith("data:image/"))
    .slice(0, 4)
    .map((image) => image.dataUrl);
}

function buildInput(history = [], message, images = []) {
  const input = [];

  for (const msg of history) {
    if (!msg?.text) continue;
    if (msg.role === "assistant") {
      input.push({ role: "assistant", content: msg.text });
    } else {
      input.push({ role: "user", content: [{ type: "input_text", text: msg.text }] });
    }
  }

  const content = [];
  if (message?.trim()) {
    content.push({ type: "input_text", text: message.trim() });
  }
  normalizeImages(images).forEach((imageUrl) => {
    content.push({ type: "input_image", image_url: imageUrl });
  });

  if (content.length > 0) {
    input.push({ role: "user", content });
  }

  return input;
}


function buildTranscript(messages = []) {
  return messages
    .filter((msg) => msg?.text)
    .map((msg) => `${msg.role === "assistant" ? "Ava" : "Customer"}: ${msg.text}`)
    .join("\n\n");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseDataUrl(dataUrl) {
  const match = dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function buildImageAttachments(images = []) {
  return normalizeImages(images)
    .map((dataUrl, index) => {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return null;

      const extension = parsed.mimeType.split("/")[1] || "jpg";

      return {
        filename: `junk-photo-${index + 1}.${extension}`,
        content: parsed.buffer.toString("base64"),
      };
    })
    .filter(Boolean);
}

app.get("/", (req, res) => {
  res.send("Junk2Go AI backend is running.");
});

app.post("/agent/chat", async (req, res) => {
  try {
    const { message = "", images = [], history = [] } = req.body;

    if (!message.trim() && (!images || images.length === 0)) {
      return res.status(400).json({
        error: "Message or image is required.",
      });
    }

    const response = await client.responses.create({
      prompt: {
        id: PROMPT_ID,
      },
      input: buildInput(history, message, images),
    });

    const rawReply = response.output_text || "";
    const leadReady = rawReply.includes("[[LEAD_READY]]");
    const reply = rawReply.replace("[[LEAD_READY]]", "").trim();

    return res.json({ reply, leadReady });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: error.message || "Failed to get AI response.",
    });
  }
});

app.post("/agent/lead", async (req, res) => {
  try {
    const { messages = [], images = [] } = req.body;

    if (!resend) {
      return res.status(500).json({
        error: "Missing RESEND_API_KEY.",
      });
    }

    if (!process.env.OWNER_EMAIL) {
      return res.status(500).json({
        error: "Missing OWNER_EMAIL.",
      });
    }

    const transcript = buildTranscript(messages);
    const attachments = buildImageAttachments(images);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
        <h2>New Junk2Go AI Quote Request</h2>

        <p>A customer completed a chat with Ava, the Junk2Go AI assistant.</p>

        <h3>Conversation Transcript</h3>
        <pre style="white-space:pre-wrap;background:#f5f5f5;padding:14px;border-radius:8px;">${escapeHtml(
          transcript
        )}</pre>

        <p><strong>Photos attached:</strong> ${attachments.length}</p>
      </div>
    `;

    const email = await resend.emails.send({
      from:
        process.env.FROM_EMAIL ||
        "Junk2Go Leads <onboarding@resend.dev>",
      to: process.env.OWNER_EMAIL,
      subject: "New Junk2Go AI Quote Request",
      html,
      attachments,
    });

    return res.json({
      submitted: true,
      emailId: email.data?.id,
    });
  } catch (error) {
    console.error("Lead error:", error);
    return res.status(500).json({
      error: error.message || "Failed to submit lead.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Junk2Go AI backend running on http://localhost:${PORT}`);
});