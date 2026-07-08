import "dotenv/config";
import { Infobip, AuthType } from "@infobip-api/sdk";

const infobip = new Infobip({
  baseUrl: process.env.INFOBIP_BASE_URL,
  apiKey: process.env.INFOBIP_API_KEY,
  authType: AuthType.ApiKey,
});

const result = await infobip.channels.sms.send({
  messages: [{
    from: process.env.INFOBIP_FROM_NUMBER,
    destinations: [{ to: "17343417914" }],
    text: "Junk 2 Go test SMS — it's working!",
  }],
});

const status = result.data?.messages?.[0]?.status;
console.log("Status:", status?.groupName, `(groupId: ${status?.groupId})`);
console.log("Description:", status?.description);
if (status?.groupId === 1) {
  console.log("✅ SMS sent successfully");
} else {
  console.log("❌ SMS failed");
}
