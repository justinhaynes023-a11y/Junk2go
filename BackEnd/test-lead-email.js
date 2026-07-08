import "dotenv/config";

// Tiny 1x1 red JPEG repeated 5 times as stand-in for real photos
const TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAIRAAAQQCAgMAAAAAAAAAAAAAAQACAxEEBRIhMUH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amtq2ktZrpaGQWY43Pa5ga4AtOxB2PkKUpI3GNrnNLHEZaRgg+iilcS1uZHOcS5xyST1JKUoBSlKAUpSgFKUoBSlKAUpSgFKUoD//2Q==";

const fakeMessages = [
  { role: "assistant", text: "Hi! I'm Ava with Junk 2 Go. What do you need removed?" },
  { role: "user", text: "Hi, I need to remove an old couch and some boxes from my basement." },
  { role: "assistant", text: "Got it! Can I get your name?" },
  { role: "user", text: "John Smith" },
  { role: "assistant", text: "Thanks John! What's the best phone number to reach you?" },
  { role: "user", text: "734-341-7914" },
  { role: "assistant", text: "And your email address?" },
  { role: "user", text: "test@example.com" },
  { role: "assistant", text: "What's the address for the pickup?" },
  { role: "user", text: "123 Main St, Detroit MI 48201" },
  { role: "assistant", text: "Based on what you described, your quote is $150. We'll follow up shortly!" },
];

const fakeImages = Array(5).fill({ dataUrl: TINY_JPEG, name: "test-photo.jpg", type: "image/jpeg" });

const res = await fetch("http://localhost:5000/agent/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: fakeMessages,
    images: fakeImages,
    quotedPrice: "150",
  }),
});

const data = await res.json();
console.log("Status:", res.status);
console.log(data);
if (data.submitted) {
  console.log("✅ Email sent — check your inbox");
} else {
  console.log("❌ Failed:", data.error);
}
