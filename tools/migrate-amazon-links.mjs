import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const trackingId = "eclatwebsite-20";
const products = new Map([
  ["https://amzn.to/3Rod1qI", "B0F9JKJ614"],
  ["https://amzn.to/3RrZSg6", "B0CZP757GC"],
  ["https://amzn.to/3RZk4WO", "B074PVTPBW"],
  ["https://amzn.to/40Ukuz3", "B0CM2PPNMW"],
  ["https://amzn.to/42UwKRk", "B08KT2Z93D"],
  ["https://amzn.to/49AN39J", "B0D97Y5KLH"],
  ["https://amzn.to/49NiX2C", "B0GX5HSX47"],
  ["https://amzn.to/49ZGpcX", "B0D84WSNQK"],
  ["https://amzn.to/4a5EgfT", "B0GZ5Z99VP"],
  ["https://amzn.to/4dZTCVF", "B0DDQ4MSXS"],
  ["https://amzn.to/4ljx1FN", "B0B5MG6PHQ"],
  ["https://amzn.to/4riJdaX", "B0CPT8W3RV"],
  ["https://amzn.to/4rVCG7n", "B071914GGL"],
  ["https://amzn.to/4s0F90e", "B07DY2QRF6"],
  ["https://amzn.to/4tRt1Ph", "B08H3JPH74"],
  ["https://amzn.to/4u5PSHe", "B09W18N3GT"],
  ["https://amzn.to/4unB2fV", "B07PBXXNCY"],
  ["https://amzn.to/4uoa5sB", "B0BLRGCTS1"],
  ["https://amzn.to/4v90o1g", "B09V7Z4TJG"],
]);

const pages = [
  "index.html",
  "posts/beauty-under-20.html",
  "posts/best-amazon-beauty-finds-2026.html",
  "posts/simple-skincare-routine-for-beginners.html",
];

function migrateAnchor(anchor) {
  const href = anchor.match(/\shref="([^"]+)"/)?.[1];
  let asin = products.get(href);

  if (!asin && href?.includes("Nizoral+Anti-Dandruff+Shampoo")) {
    asin = "B00AINMFAC";
  }
  if (!asin) return anchor;

  const destination = `https://www.amazon.com/dp/${asin}?tag=${trackingId}`;
  const withTrackingId = anchor.includes("data-amazon-tracking-id=")
    ? anchor.replace(
        /\sdata-amazon-tracking-id="[^"]*"/,
        ` data-amazon-tracking-id="${trackingId}"`,
      )
    : anchor.replace(
        /\sdata-affiliate-network="amazon"/,
        ` data-affiliate-network="amazon" data-amazon-tracking-id="${trackingId}"`,
      );

  return withTrackingId
    .replace(/\sdata-asin="[^"]*"/, ` data-asin="${asin}"`)
    .replace(/\shref="[^"]+"/, ` href="${destination}"`);
}

for (const relativePath of pages) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, "utf8");
  const migrated = original.replace(
    /<a\b[^>]*data-affiliate-network="amazon"[^>]*>/g,
    migrateAnchor,
  );
  fs.writeFileSync(filePath, migrated);
}
