import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_PLACE_ID = process.env.GOOGLE_PLACE_ID;

app.use(cors());

app.get("/reviews", async (req, res) => {
  if (!GOOGLE_API_KEY || !GOOGLE_PLACE_ID) {
    return res.status(500).json({
      error: "Missing GOOGLE_API_KEY or GOOGLE_PLACE_ID environment variables.",
    });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    GOOGLE_PLACE_ID,
  )}&fields=name,rating,reviews,url&key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(500).json({ error: data.error_message || data.status });
    }

    const reviews = (data.result.reviews || []).slice(0, 6).map((review) => ({
      author_name: review.author_name,
      rating: review.rating,
      text: review.text,
      relative_time_description: review.relative_time_description,
      author_url: review.author_url,
    }));

    return res.json({
      name: data.result.name,
      rating: data.result.rating,
      reviews,
      url: data.result.url,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Google reviews proxy running on http://localhost:${PORT}`);
});
