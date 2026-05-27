import fs from "fs";

const logs = JSON.parse(fs.readFileSync("logs.1779921798351.json", "utf8"));
logs.reverse();

function extractAll(key) {
  const out = [];
  for (const e of logs) {
    const m = e.message || "";
    if (m.includes(key)) out.push({ t: e.timestamp, m: m.slice(0, 400) });
  }
  return out;
}

console.log("=== Messages containing product question ===");
for (const x of extractAll("comme produit")) console.log(x.t, x.m.replace(/\n/g, " "));

console.log("\n=== social_only / strategy ===");
for (const x of extractAll("social_only")) console.log(x.t, x.m.slice(0, 200));

console.log("\n=== BUSINESS_INTENT ===");
for (const x of extractAll("BUSINESS_INTENT")) console.log(x.t, x.m.slice(0, 300));

console.log("\n=== catalog / brain ===");
for (const x of extractAll("BUSINESS_BRAIN")) console.log(x.t, x.m.slice(0, 300));
for (const x of extractAll("AUTO_BUSINESS")) console.log(x.t, x.m.slice(0, 300));
for (const x of extractAll("catalog_search")) console.log(x.t, x.m.slice(0, 200));

console.log("\n=== delivery timing ===");
const delivery = logs.filter((e) => /totalBeforeSendMs|DELIVERY_SIMULATION/.test(e.message || ""));
for (const x of delivery.slice(0, 8)) console.log(x.timestamp, x.message?.trim());

console.log("\n=== startup ===");
for (const x of extractAll("OPTIMA_BACKEND")) console.log(x.t, x.m.slice(0, 200));
