import "dotenv/config";
import { google } from "googleapis";

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const sheetId = process.env.GOOGLE_SHEET_ID;

if (!email || !key || !sheetId) {
  console.error("❌ Missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SHEET_ID in .env");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const date = new Date().toLocaleDateString("en-US");
const row = [date, "Test Customer", "7345551234", "123 Main St, Detroit MI 48201", "Old couch and boxes", "$150", "", "Pending", "test-token-123"];

const response = await sheets.spreadsheets.values.append({
  spreadsheetId: sheetId,
  range: "Sheet1!A:I",
  valueInputOption: "USER_ENTERED",
  insertDataOption: "INSERT_ROWS",
  requestBody: { values: [row] },
});

const updatedRange = response.data.updates?.updatedRange;
console.log("✅ Row written:", updatedRange);
console.log("Data:", row);
