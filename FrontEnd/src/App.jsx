import { useEffect, useRef, useState } from "react";
import { Star, CheckCircle2, Zap, DollarSign, ShieldCheck, Leaf, Sofa, Refrigerator, Warehouse, Building2, Phone } from "lucide-react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://junk2go.onrender.com";

const HERO_GREETING = "Hi! I'm Ava with Junk 2 Go. What do you need removed?";
const CHAT_STORAGE_KEY = "junk2go_chat";
const GOOGLE_REVIEW_URL =
  "https://www.google.com/maps/place/Junk+To+GO/@42.4400166,-83.4340175,11z/data=!4m8!3m7!1s0x81a34dbe008c7803:0x73f85fa4b8d90e42!8m2!3d42.4400166!4d-83.4340175!9m1!1b1!16s%2Fg%2F11yzlpx790?entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D";

function App() {
  const [assistantMode, setAssistantMode] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: HERO_GREETING }]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [leadImages, setLeadImages] = useState([]);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const chatBodyRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    if (!assistantMode) {
      setDraft("");
      setAttachments([]);
      setLeadImages([]);
      setLeadSubmitted(false);
      setIsSending(false);
      setMessages([{ role: "assistant", text: HERO_GREETING }]);
      return;
    }

    // Restore saved conversation if one exists and is less than 24 hours old
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const { messages: parsed, savedAt } = JSON.parse(saved);
        const ageHours = (Date.now() - savedAt) / (1000 * 60 * 60);
        if (Array.isArray(parsed) && parsed.length > 0 && ageHours < 24) {
          setMessages(parsed);
          return;
        } else {
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }
    } catch {}

    // No saved conversation — fetch fresh greeting
    setMessages([]);
    setIsSending(true);
    fetch(`${API_BASE_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello", history: [] }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.reply) setMessages([{ role: "assistant", text: data.reply }]);
      })
      .catch(() => {})
      .finally(() => setIsSending(false));
  }, [assistantMode]);

  // Persist conversation to localStorage whenever messages change
  useEffect(() => {
    if (assistantMode && messages.length > 0) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, savedAt: Date.now() }));
    }
  }, [messages, assistantMode]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const toJpeg = (file) =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        resolve({
          name: file.name.replace(/\.[^.]+$/, ".jpg"),
          type: "image/jpeg",
          dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Unable to read ${file.name}`));
      };
      img.src = objectUrl;
    });

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const selectedImages = await Promise.all(files.slice(0, 4).map(toJpeg));

    setAttachments((current) => [...current, ...selectedImages].slice(0, 4));
    setLeadImages((current) => [...current, ...selectedImages].slice(0, 4));
    event.target.value = "";
  };

  const submitLeadIfReady = async (conversation, imagesForLead, quotedPrice = null) => {
    if (leadSubmitted) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/agent/lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation,
          images: imagesForLead,
          quotedPrice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit lead.");
      }

      if (data.submitted) {
        setLeadSubmitted(true);
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Lead email failed:", error);
    }
  };

  const sendMessage = async (overrideText = draft) => {
    const text = overrideText.trim();

    if (!text && attachments.length === 0) {
      return;
    }

    const previousMessages = messages;
    const nextMessages = [...previousMessages, { role: "user", text: text || "I uploaded photos for a quote." }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history: previousMessages,
          images: attachments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message.");
      }

      const assistantMessage = { role: "assistant", text: data.reply };
      const conversationWithReply = [...nextMessages, assistantMessage];
      const imagesForLead = [...leadImages, ...attachments].slice(0, 4);

      setMessages(conversationWithReply);
      setAttachments([]);
      if (data.leadReady) {
        await submitLeadIfReady(conversationWithReply, imagesForLead, data.quotedPrice ?? null);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `Sorry, I could not process that right now. ${error.message}`,
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => textInputRef.current?.focus(), 0);
    }
  };

  const assistantCard = (
    <div className="chat-card">
      <div className="chat-header">
        <div className="assistant-header-left">
          <div className="assistant-avatar">A</div>
          <div className="assistant-info">
            <b>Ava</b>
            <div className="assistant-title">Quote Specialist</div>
          </div>
        </div>
        <span>● Online</span>
      </div>

      <div className="chat-body" ref={chatBodyRef}>
        <div className="message-list">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`message ${message.role === "assistant" ? "assistant-message" : "user-message"}`}
            >
              {message.text}
            </div>
          ))}
          {isSending && (
            <div className="message assistant-message typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="attachment-strip">
          {attachments.map((attachment, i) => (
            <div className="attachment-pill" key={attachment.name}>
              <img src={attachment.dataUrl} alt={attachment.name} />
              <button
                className="remove-attachment"
                onClick={() => setAttachments((c) => c.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-footer">
        <label htmlFor="photo-upload" className="attach-btn" title="Add photos">
          📷
        </label>
        <input
          id="photo-upload"
          type="file"
          multiple
          accept="image/*"
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <input
          ref={textInputRef}
          className="chat-text-input"
          placeholder="Message Ava..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isSending) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={isSending}
        />
        <button
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={isSending || (!draft.trim() && attachments.length === 0)}
        >
          ➜
        </button>
      </div>
    </div>
  );

  if (assistantMode) {
    return (
      <div className="app assistant-page">
        <nav className="navbar">
          <div className="brand">
            <div>
              JUNK<span>2</span>GO
            </div>
            <small>FAST. AFFORDABLE. RELIABLE.</small>
          </div>
          <button className="nav-button outline" onClick={() => setAssistantMode(false)}>
            Back
          </button>
        </nav>

        <section className="assistant-only">
          <div className="assistant-intro">
            <span className="assistant-intro-tag">FREE QUOTE</span>
            <h2>Get Your Free Estimate</h2>
            <p>Describe what you need removed and our team will follow up with pricing and scheduling.</p>
          </div>
          {assistantCard}
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="brand">
          <div>
            JUNK<span>2</span>GO
          </div>
          <small>FAST. AFFORDABLE. RELIABLE.</small>
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#services">Services</a>
          <a href="#area">Service Area</a>
          <a href="#how">How It Works</a>
          <a href="#contact">Contact</a>
        </div>

        <button className="nav-button" onClick={() => setAssistantMode(true)}>
          Get Quote
        </button>
      </nav>

      <section className="hero" id="home">
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <p className="badge"><Star size={15} strokeWidth={2.5} /> TOP RATED JUNK REMOVAL SERVICE</p>

          <h1>
            WE TAKE THE JUNK.
            <br />
            YOU GET <span>YOUR SPACE BACK.</span>
          </h1>

          <p className="hero-text">
            Upload photos, get a quote, and let our team handle the heavy lifting.
          </p>

          <div className="hero-points">
            <p><CheckCircle2 size={18} strokeWidth={2} /> Same-Day Service</p>
            <p><CheckCircle2 size={18} strokeWidth={2} /> Upfront Pricing</p>
            <p><CheckCircle2 size={18} strokeWidth={2} /> Eco-Friendly Disposal</p>
          </div>

          <div className="hero-buttons">
            <button className="nav-button" onClick={() => setAssistantMode(true)}>
              Get Quote Now →
            </button>
            <a href="tel:7343087600" className="nav-button outline">
              Call Now
            </a>
          </div>
        </div>

        {assistantCard}
      </section>

      <section className="feature-bar">
        <div>
          <h3><Zap size={18} strokeWidth={2} /> Same-Day Service</h3>
          <p>When available in your area</p>
        </div>
        <div>
          <h3><DollarSign size={18} strokeWidth={2} /> Upfront Pricing</h3>
          <p>No hidden fees. Ever.</p>
        </div>
        <div>
          <h3><ShieldCheck size={18} strokeWidth={2} /> Owner Approved</h3>
          <p>Drafts are reviewed and approved by humans</p>
        </div>
        <div>
          <h3><Leaf size={18} strokeWidth={2} /> Eco-Friendly</h3>
          <p>Donate & recycle when possible</p>
        </div>
      </section>

      <section className="services" id="services">
        <p className="section-label">OUR SERVICES</p>
        <h2>We Remove Almost Anything</h2>
        <p className="section-subtitle">
          From single items to full property cleanouts, we do the heavy lifting.
        </p>

        <div className="service-grid">
          <div className="service-card">
            <div className="icon"><Sofa size={26} strokeWidth={1.5} /></div>
            <h3>Furniture Removal</h3>
            <p>Couches, mattresses, tables, chairs, dressers & more.</p>
          </div>

          <div className="service-card">
            <div className="icon"><Refrigerator size={26} strokeWidth={1.5} /></div>
            <h3>Appliance Removal</h3>
            <p>Refrigerators, washers, dryers, stoves & old appliances.</p>
          </div>

          <div className="service-card">
            <div className="icon"><Warehouse size={26} strokeWidth={1.5} /></div>
            <h3>Garage Cleanouts</h3>
            <p>Old boxes, tools, clutter, and everything in between.</p>
          </div>

          <div className="service-card">
            <div className="icon"><Building2 size={26} strokeWidth={1.5} /></div>
            <h3>Property Cleanouts</h3>
            <p>Basements, rentals, offices, estates, and move-outs.</p>
          </div>
        </div>
      </section>

      <section className="service-area" id="area">
        <div className="service-area-text">
          <p className="section-label">SERVICE AREA</p>
          <h2>We Service Detroit & Surrounding Areas</h2>
          <p>
            Junk 2 Go provides junk removal services across Detroit and nearby cities.
            Start a quote and we’ll confirm availability for your address.
          </p>
          <div className="area-list">
            <span>Detroit</span>
            <span>Dearborn</span>
            <span>Southfield</span>
            <span>Taylor</span>
            <span>Livonia</span>
            <span>Royal Oak</span>
            <span>Allen Park</span>
            <span>Westland</span>
            <span>Northville</span>
            <span>Novi</span>
          </div>
        </div>

        <div className="map-box">
          <iframe
            title="Junk 2 Go Service Area Map"
            src="https://www.google.com/maps?q=Detroit%20Michigan&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </section>

      <section className="how" id="how">
        <p className="section-label">SIMPLE PROCESS</p>
        <h2>How It Works</h2>

        <div className="step-grid">
          <div className="step-card">
            <span>1</span>
            <h3>Chat With Ava</h3>
            <p>The assistant asks questions like a real person.</p>
          </div>

          <div className="step-card">
            <span>2</span>
            <h3>Upload Photos</h3>
            <p>Send pictures of the junk you need removed.</p>
          </div>

          <div className="step-card">
            <span>3</span>
            <h3>Owner Approves</h3>
            <p>The business owner reviews and approves the quote.</p>
          </div>

          <div className="step-card">
            <span>4</span>
            <h3>We Get It Done</h3>
            <p>We show up on time and remove your junk fast.</p>
          </div>
        </div>
      </section>

      <section className="stats">
        <div>
          <h2>2,500+</h2>
          <p>Jobs Completed</p>
        </div>
        <div>
          <h2>2,000+</h2>
          <p>Happy Customers</p>
        </div>
        <div>
          <h2>4.9/5</h2>
          <p>Average Rating</p>
        </div>
        <div>
          <h2>5+</h2>
          <p>Years In Business</p>
        </div>
      </section>
      <section className="reviews" id="reviews">
        <p className="section-label">CUSTOMER REVIEWS</p>
        <h2>Share Your Experience</h2>
        <p className="section-subtitle">
          See what customers say and leave your own review on Google.
        </p>

        <div className="review-actions">
          <a
            className="review-button"
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noreferrer"
          >
            Leave a Google Review
          </a>
        </div>

        <div className="review-grid">
          <div className="review-card">
            <div className="stars">★★★★★</div>
            <p>
              “Fast, friendly service and an easy booking process. Highly
              recommend Junk 2 Go for any cleanout.”
            </p>
            <h4>Jason J.</h4>
            <p className="review-meta">Verified customer</p>
          </div>

          <div className="review-card">
            <div className="stars">★★★★★</div>
            <p>
              “Great pricing and very professional team. They removed all my
              junk quickly and left the place clean.”
            </p>
            <h4>Melissa T.</h4>
            <p className="review-meta">Verified customer</p>
          </div>

          <div className="review-card">
            <div className="stars">★★★★★</div>
            <p>
              “Excellent experience from start to finish. The crew was on time
              and handled everything carefully.”
            </p>
            <h4>Charles H.</h4>
            <p className="review-meta">Verified customer</p>
          </div>
        </div>
      </section>
      <footer id="contact">
  <h2>JUNK<span>2</span>GO</h2>

  <p>
    <a href="tel:7343087600">
      <Phone size={15} strokeWidth={2} /> (734) 308-7600
    </a>
  </p>

  <p>Detroit, Michigan</p>

  <p>
    Open 7 Days A Week
  </p>
</footer>
    </div>
  );
}

export default App;