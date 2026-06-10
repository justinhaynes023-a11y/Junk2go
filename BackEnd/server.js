import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { Resend } from "resend";
import twilio from "twilio";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 5000;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

const PROMPT_ID = "pmpt_6a286324c7c88195ac05ac6d187ec75b0fafcc8c03f2a96d";

// Pending approvals: token -> leadData
const pendingLeads = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeImages(images = []) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img?.dataUrl?.startsWith("data:image/"))
    .slice(0, 4)
    .map((img) => img.dataUrl);
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
  if (message?.trim()) content.push({ type: "input_text", text: message.trim() });
  normalizeImages(images).forEach((url) => content.push({ type: "input_image", image_url: url }));
  if (content.length > 0) input.push({ role: "user", content });
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
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function buildImageAttachments(images = []) {
  return normalizeImages(images)
    .map((dataUrl, i) => {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return null;
      const ext = parsed.mimeType.split("/")[1] || "jpg";
      return { filename: `junk-photo-${i + 1}.${ext}`, content: parsed.buffer.toString("base64") };
    })
    .filter(Boolean);
}

function extractPhone(transcript) {
  const match = transcript.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0] : null;
}

// ── Page builders ─────────────────────────────────────────────────────────────

function approvalPage(lead, token, errorMsg) {
  const price = lead?.quotedPrice ?? "";
  const phone = lead?.clientPhone || "Not captured";
  const transcript = lead?.transcript || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Approve Quote — Junk 2 Go</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#0d0d0d;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px}
    .card{background:white;border-radius:20px;max-width:500px;width:100%;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5)}
    .card-top{background:#111;padding:22px 28px}
    .card-top h1{color:#ffc400;font-size:20px;letter-spacing:1px;font-weight:900}
    .card-top p{color:#999;font-size:13px;margin-top:4px}
    .card-body{padding:28px}
    .price-display{font-size:46px;font-weight:900;line-height:1;margin-bottom:6px}
    .meta{color:#777;font-size:13px;margin-bottom:24px}
    .error{background:#fff3f3;color:#c00;border:1px solid #f5c6c6;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:14px}
    label{display:block;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;color:#555}
    input[type=number]{width:100%;border:2px solid #e0e0e0;border-radius:10px;padding:13px 14px;font-size:22px;font-weight:800;outline:none;transition:border .15s}
    input[type=number]:focus{border-color:#ffc400}
    button{width:100%;background:#22c55e;color:white;border:none;padding:16px;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;margin-top:14px;transition:background .15s}
    button:hover{background:#16a34a}
    details{margin-top:22px}
    details summary{color:#999;font-size:13px;cursor:pointer}
    details pre{margin-top:10px;background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;line-height:1.6;max-height:280px;overflow-y:auto}
  </style>
</head>
<body>
  <div class="card">
    <div class="card-top">
      <h1>JUNK 2 GO</h1>
      <p>Quote Approval Dashboard</p>
    </div>
    <div class="card-body">
      ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ""}
      ${price !== "" ? `<div class="price-display">$${escapeHtml(String(price))}</div>` : ""}
      <p class="meta">AI quoted price &nbsp;·&nbsp; Client phone: <strong>${escapeHtml(phone)}</strong></p>
      <form method="POST" action="/agent/approve">
        <input type="hidden" name="token" value="${escapeHtml(token || "")}" />
        <label for="price">Confirm price or enter a different amount</label>
        <input type="number" id="price" name="price" value="${escapeHtml(String(price))}" min="1" step="0.01" placeholder="e.g. 150" required />
        <button type="submit">✅ Approve &amp; Send to Client</button>
      </form>
      ${transcript ? `<details><summary>View full conversation transcript</summary><pre>${escapeHtml(transcript)}</pre></details>` : ""}
    </div>
  </div>
</body>
</html>`;
}

function resultPage(title, bodyHtml, accentColor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#0d0d0d;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:white;border-radius:20px;max-width:420px;width:100%;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);text-align:center}
    .card-top{padding:32px 28px 20px;border-top:6px solid ${accentColor}}
    h2{font-size:22px;font-weight:900}
    .body{padding:20px 28px 28px;color:#444;font-size:15px;line-height:1.6}
    .brand{background:#111;padding:16px;color:#ffc400;font-weight:900;font-size:13px;letter-spacing:1px}
  </style>
</head>
<body>
  <div class="card">
    <div class="card-top"><h2>${title}</h2></div>
    <div class="body">${bodyHtml}</div>
    <div class="brand">JUNK 2 GO</div>
  </div>
</body>
</html>`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("Junk2Go AI backend is running."));

app.post("/agent/chat", async (req, res) => {
  try {
    const { message = "", images = [], history = [] } = req.body;

    if (!message.trim() && (!images || images.length === 0)) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    const response = await client.responses.create({
      prompt: { id: PROMPT_ID },
      input: buildInput(history, message, images),
    });

    const rawReply = response.output_text || "";
    const leadReady = rawReply.includes("[[LEAD_READY]]");
    const priceMatch = rawReply.match(/\[\[PRICE:([\d.,]+)\]\]/);
    const quotedPrice = priceMatch ? priceMatch[1] : null;
    const reply = rawReply
      .replace("[[LEAD_READY]]", "")
      .replace(/\[\[PRICE:[^\]]*\]\]/g, "")
      .trim();

    return res.json({ reply, leadReady, quotedPrice });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Failed to get AI response." });
  }
});

app.post("/agent/lead", async (req, res) => {
  try {
    const { messages = [], images = [], quotedPrice = null } = req.body;

    if (!resend) return res.status(500).json({ error: "Missing RESEND_API_KEY." });
    if (!process.env.OWNER_EMAIL) return res.status(500).json({ error: "Missing OWNER_EMAIL." });

    const transcript = buildTranscript(messages);
    const attachments = buildImageAttachments(images);
    const clientPhone = extractPhone(transcript);

    const token = crypto.randomBytes(24).toString("hex");
    const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

    pendingLeads.set(token, {
      token,
      quotedPrice,
      transcript,
      clientPhone,
      images,
      createdAt: Date.now(),
    });

    const approveUrl = `${BACKEND_URL}/agent/approve?token=${token}`;
    const priceDisplay = quotedPrice ? `$${quotedPrice}` : "Not extracted";

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;line-height:1.5;">
  <div style="background:#111;padding:24px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#ffc400;margin:0;font-size:22px;letter-spacing:1px;">JUNK 2 GO</h1>
    <p style="color:#aaa;margin:4px 0 0;font-size:13px;">New Quote Request from Ava</p>
  </div>

  <div style="background:#f9f9f9;padding:28px 32px;border:1px solid #e8e8e8;border-top:none;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px;">AI Quoted Price</p>
    <div style="font-size:52px;font-weight:900;color:#111;line-height:1;margin-bottom:12px;">${priceDisplay}</div>
    ${clientPhone
      ? `<p style="color:#555;font-size:14px;margin:0 0 24px;">📞 Client phone: <strong>${escapeHtml(clientPhone)}</strong></p>`
      : `<p style="color:#999;font-size:14px;margin:0 0 24px;">Phone not captured in conversation</p>`
    }
    <a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:white;padding:16px 36px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;">
      ✅ Review &amp; Approve Quote
    </a>
    <p style="color:#aaa;font-size:12px;margin-top:12px;">Opens a page where you can confirm or change the price before the client is notified.</p>
  </div>

  <div style="background:white;padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;">
    <h3 style="margin:0 0 14px;font-size:15px;">Conversation Transcript</h3>
    <pre style="white-space:pre-wrap;background:#f5f5f5;padding:14px;border-radius:8px;font-size:13px;line-height:1.6;overflow-x:auto;">${escapeHtml(transcript)}</pre>
    <p style="color:#888;font-size:13px;margin:12px 0 0;"><strong>Photos attached:</strong> ${attachments.length}</p>
  </div>
</div>`;

    const email = await resend.emails.send({
      from: process.env.FROM_EMAIL || "Junk2Go Leads <onboarding@resend.dev>",
      to: process.env.OWNER_EMAIL,
      subject: `New Junk2Go Quote — ${priceDisplay}`,
      html,
      attachments,
    });

    return res.json({ submitted: true, emailId: email.data?.id });
  } catch (error) {
    console.error("Lead error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit lead." });
  }
});

// Manager clicks the approval link from email
app.get("/agent/approve", (req, res) => {
  const { token } = req.query;
  const lead = pendingLeads.get(token);

  if (!lead) {
    return res.status(404).send(
      resultPage("Link Invalid", "This approval link is invalid or has already been used.", "#ef4444")
    );
  }

  return res.send(approvalPage(lead, token, null));
});

// Manager submits the approval form
app.post("/agent/approve", async (req, res) => {
  const { token, price } = req.body;
  const lead = pendingLeads.get(token);

  if (!lead) {
    return res.status(404).send(
      resultPage("Link Invalid", "This approval link is invalid or has already been used.", "#ef4444")
    );
  }

  const finalPrice = parseFloat(String(price).replace(/[^0-9.]/g, ""));
  if (!finalPrice || isNaN(finalPrice)) {
    return res.send(approvalPage(lead, token, "Please enter a valid price amount."));
  }

  pendingLeads.delete(token);

  const phone = lead.clientPhone;
  console.log(`✅ Quote approved — $${finalPrice} | Phone: ${phone || "N/A"}`);

  let smsStatus = "not_sent";
  let smsError = null;

  if (phone && twilioClient && process.env.TWILIO_FROM_NUMBER) {
    try {
      await twilioClient.messages.create({
        to: phone,
        from: process.env.TWILIO_FROM_NUMBER,
        body:
          `Hi! This is Junk 2 Go. Your junk removal quote has been approved at $${finalPrice.toFixed(2)}. ` +
          `Reply YES to confirm your appointment or call us at (734) 308-7600.`,
      });
      smsStatus = "sent";
      console.log(`📱 SMS sent to ${phone}`);
    } catch (err) {
      smsError = err.message;
      console.error("SMS failed:", err.message);
    }
  }

  let phoneNote;
  if (!phone) {
    phoneNote = "No client phone was captured in the conversation.";
  } else if (!twilioClient) {
    phoneNote = `Client phone: <strong>${escapeHtml(phone)}</strong> — Twilio is not configured (add credentials to .env).`;
  } else if (smsStatus === "sent") {
    phoneNote = `SMS confirmation sent to <strong>${escapeHtml(phone)}</strong>.`;
  } else {
    phoneNote = `SMS failed for <strong>${escapeHtml(phone)}</strong>: ${escapeHtml(smsError || "unknown error")}.`;
  }

  return res.send(
    resultPage(
      "✅ Quote Approved",
      `<p style="margin-bottom:12px;">Final price set to <strong style="font-size:26px;">$${finalPrice.toFixed(2)}</strong></p><p>${phoneNote}</p>`,
      "#22c55e"
    )
  );
});

app.listen(PORT, () => {
  console.log(`Junk2Go AI backend running on http://localhost:${PORT}`);
});
