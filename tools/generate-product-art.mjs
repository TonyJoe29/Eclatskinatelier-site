import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "assets", "product-images");

const products = [
  ["elemis-cleansing-balm", "Elemis", "Cleansing Balm", "#6b2d2d", "#f7e7df"],
  ["biodance-mask", "Biodance", "Deep Mask", "#8a5f7d", "#f0e7f3"],
  ["hero-mighty-patch", "Hero", "Mighty Patch", "#d18542", "#fff0d6"],
  ["elf-halo-glow", "e.l.f.", "Halo Glow", "#a0524a", "#f7e0d7"],
  ["ordinary-glycolic", "The Ordinary", "Glycolic 7%", "#7a6a62", "#ebe6df"],
  ["medicube-jelly", "medicube", "Jelly Cream", "#8a9e8b", "#e8f0e5"],
  ["maybelline-mascara", "Maybelline", "Sky High", "#2c2420", "#ded6cf"],
  ["clean-skin-towels", "Clean Skin", "Towels XL", "#60807c", "#e4f0ef"],
  ["laneige-lip-balm", "LANEIGE", "Lip Balm", "#b85f7b", "#f6dce8"],
  ["grace-stella-eye", "grace & stella", "Eye Patches", "#b8924a", "#f4e9cf"],
  ["eos-lotion", "eos", "Body Lotion", "#8b6d45", "#f6ead5"],
  ["eltamd-spf", "EltaMD", "Tinted SPF", "#5d83a6", "#dfeaf2"],
  ["nizoral-shampoo", "Nizoral", "Scalp Care", "#466785", "#dce8f1"],
];

function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

await mkdir(outDir, { recursive: true });

for (const [slug, brand, label, accent, paper] of products) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100" role="img" aria-label="${escapeText(brand)} ${escapeText(label)} editorial product art">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${paper}"/>
      <stop offset="1" stop-color="#fffaf5"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="26" stdDeviation="22" flood-color="#2c2420" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="900" height="1100" fill="url(#bg)"/>
  <circle cx="720" cy="180" r="170" fill="${accent}" opacity="0.08"/>
  <circle cx="180" cy="920" r="220" fill="${accent}" opacity="0.07"/>
  <g filter="url(#shadow)">
    <rect x="250" y="260" width="400" height="560" rx="38" fill="#fffdf9" stroke="${accent}" stroke-opacity="0.28" stroke-width="3"/>
    <rect x="290" y="310" width="320" height="130" rx="22" fill="${accent}" opacity="0.13"/>
    <rect x="325" y="490" width="250" height="210" rx="26" fill="${accent}" opacity="0.92"/>
    <rect x="354" y="520" width="192" height="28" rx="14" fill="#fffaf5" opacity="0.92"/>
    <rect x="354" y="570" width="192" height="18" rx="9" fill="#fffaf5" opacity="0.75"/>
    <rect x="354" y="604" width="140" height="18" rx="9" fill="#fffaf5" opacity="0.62"/>
  </g>
  <text x="450" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="${accent}" font-weight="600">${escapeText(brand)}</text>
  <text x="450" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" fill="#7a6a62" letter-spacing="5">${escapeText(label.toUpperCase())}</text>
  <text x="450" y="960" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#7a6a62" letter-spacing="4">ECLATSKINATELIER PICK</text>
</svg>
`;
  await writeFile(join(outDir, `${slug}.svg`), svg, "utf8");
}

await writeFile(
  join(outDir, "README.md"),
  "Editorial placeholder art generated for layout use. Replace with your own photos or Amazon SiteStripe/PA-API-compliant images before public launch when exact product imagery is required.\n",
  "utf8",
);
