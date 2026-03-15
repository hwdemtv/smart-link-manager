import "dotenv/config";
import { apiKeyService } from "./server/apiKeyService";
import { getDb } from "./server/db";
import http from "http";

async function testOpenApi() {
  console.log("=== OpenAPI (API Key) Verification (Native HTTP) ===");
  
  await getDb();

  try {
    const keyData = await apiKeyService.generateKey(1, 1, "Native Test Key");
    console.log("Generated Key:", keyData.rawKey);

    const baseUrl = "localhost";
    const port = 3000;

    const request = (options: any, postData?: string) => {
      return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = "";
          res.on("data", chunk => data += chunk);
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        });
        req.on("error", reject);
        if (postData) req.write(postData);
        req.end();
      });
    };

    console.log("Step 1: Testing List Links API...");
    const listRes: any = await request({
      hostname: baseUrl,
      port,
      path: "/api/v1/links",
      method: "GET",
      headers: { "Authorization": `Bearer ${keyData.rawKey}` }
    });
    console.log("List Response Status:", listRes.status);
    console.log("Body:", listRes.body);

    console.log("Step 2: Testing Create Link API...");
    const shortCode = `api-native-${Math.random().toString(36).substring(7)}`;
    const createData = JSON.stringify({
      originalUrl: "https://example.com/native",
      shortCode,
      description: "Created via Native HTTP API"
    });

    const createRes: any = await request({
      hostname: baseUrl,
      port,
      path: "/api/v1/links",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyData.rawKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(createData)
      }
    }, createData);

    console.log("Create Response Status:", createRes.status);
    console.log("Body:", createRes.body);

    if (createRes.status === 201) {
      console.log("✅ SUCCESS: OpenAPI flow verified!");
    } else {
      console.log("❌ FAILURE");
    }

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit(0);
  }
}

testOpenApi();
