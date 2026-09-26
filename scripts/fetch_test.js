import https from "node:https";

const query = `[out:json][timeout:30];
(
  node["name"~"APMC|Krishi Upaj Mandi|Grain Market",i](11.0,74.0,29.0,79.0);
  way["name"~"APMC|Krishi Upaj Mandi|Grain Market",i](11.0,74.0,29.0,79.0);
);
out center 150;`;

const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

const options = {
  headers: {
    "User-Agent": "KisanSync-APMC-Import/1.0 (hackathon agricultural research; contact: dev@kisansync.in)",
    "Accept": "application/json",
  },
};

console.log("Fetching from Overpass API with headers...");
https.get(url, options, (res) => {
  let data = "";
  console.log("Status:", res.statusCode);
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("Success! Element count:", json.elements?.length);
      if (json.elements && json.elements.length > 0) {
        console.log("Sample 1:", JSON.stringify(json.elements[0], null, 2));
        console.log("Sample 2:", JSON.stringify(json.elements[1], null, 2));
      }
    } catch (e) {
      console.log("Error parsing JSON:", e.message, data.slice(0, 300));
    }
  });
}).on("error", (err) => console.error("Error:", err.message));
