import { useState } from "react";
import "./App.css";

const GOOGLE_REVIEW_URL =
  "https://maps.app.goo.gl/zipZfV8rJigP4mBM9";

function App() {
  const [assistantMode, setAssistantMode] = useState(false);

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

      <div className="chat-body">
        <p>
          Hi, I’m Ava. I’ll help you get a fast quote for your junk removal.
          What type of junk do you need removed?
        </p>

        <button>🛋️ Furniture</button>
        <button>🧺 Appliances</button>
        <button>🌳 Yard Waste</button>
        <button>🏗️ Construction Debris</button>
        <button>📦 Other Items</button>
      </div>

      <div className="chat-input">
        <input placeholder="Type your answer..." />
        <button>➜</button>
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
          <p className="badge">⭐ TOP RATED JUNK REMOVAL SERVICE</p>

          <h1>
            WE TAKE THE JUNK.
            <br />
            YOU GET <span>YOUR SPACE BACK.</span>
          </h1>

          <p className="hero-text">
            Upload photos, get a quote, and let our team handle the heavy lifting.
          </p>

          <div className="hero-points">
            <p>✅ Same-Day Service</p>
            <p>✅ Upfront Pricing</p>
            <p>✅ Eco-Friendly Disposal</p>
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
          <h3>⚡ Same-Day Service</h3>
          <p>When available in your area</p>
        </div>
        <div>
          <h3>💲 Upfront Pricing</h3>
          <p>No hidden fees. Ever.</p>
        </div>
        <div>
          <h3>🛡️ Owner Approved</h3>
          <p>Drafts are reviewed and approved by humans</p>
        </div>
        <div>
          <h3>🍃 Eco-Friendly</h3>
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
            <div className="icon">🛋️</div>
            <h3>Furniture Removal</h3>
            <p>Couches, mattresses, tables, chairs, dressers & more.</p>
          </div>

          <div className="service-card">
            <div className="icon">🧺</div>
            <h3>Appliance Removal</h3>
            <p>Refrigerators, washers, dryers, stoves & old appliances.</p>
          </div>

          <div className="service-card">
            <div className="icon">🏠</div>
            <h3>Garage Cleanouts</h3>
            <p>Old boxes, tools, clutter, and everything in between.</p>
          </div>

          <div className="service-card">
            <div className="icon">🏢</div>
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
      📞 (734) 308-7600
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