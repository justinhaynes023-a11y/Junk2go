import "dotenv/config";

const response = await fetch("https://m9wlk2.api.infobip.com/sms/2/text/advanced", {
  method: "POST",
  headers: {
    "Authorization": `App ${process.env.INFOBIP_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body: JSON.stringify({
    messages: [
      {
        from: "15863689496",
        destinations: [{ to: "17343417914" }],
        text: "Junk 2 Go test SMS — it's working!"
      }
    ]
  })
});

const data = await response.json();
console.log("HTTP status:", response.status);
console.log(JSON.stringify(data, null, 2));
