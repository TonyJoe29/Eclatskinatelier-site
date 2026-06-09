import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const baseUrl = "https://eclatskinatelier-site.onrender.com";
const realPages = [
  ["index.html", `${baseUrl}/`],
  ["posts/beauty-under-20.html", `${baseUrl}/posts/beauty-under-20.html`],
  ["posts/best-amazon-beauty-finds-2026.html", `${baseUrl}/posts/best-amazon-beauty-finds-2026.html`],
  ["posts/simple-skincare-routine-for-beginners.html", `${baseUrl}/posts/simple-skincare-routine-for-beginners.html`],
];
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: file is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function matches(html, pattern) {
  return pattern.test(html);
}

const titles = new Set();
const descriptions = new Set();

for (const [relativePath, canonical] of realPages) {
  const html = read(relativePath);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)?.[1]?.trim();

  check(Boolean(title), `${relativePath}: missing title`);
  check(Boolean(description), `${relativePath}: missing meta description`);
  check(!titles.has(title), `${relativePath}: title is not unique`);
  check(!descriptions.has(description), `${relativePath}: description is not unique`);
  titles.add(title);
  descriptions.add(description);

  check(
    matches(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*\\/?>`, "i")),
    `${relativePath}: missing exact canonical`,
  );
  check(
    (html.match(/googletagmanager\.com\/gtag\/js\?id=G-PEVS2KHDT5/g) || []).length === 1,
    `${relativePath}: GA4 loader must appear exactly once`,
  );
  check(
    (html.match(/gtag\(['"]config['"],\s*['"]G-PEVS2KHDT5['"]\)/g) || []).length === 1,
    `${relativePath}: GA4 config must appear exactly once`,
  );
  check(
    !matches(html, /gtag\(['"]event['"],\s*['"]page_view['"]/),
    `${relativePath}: must not emit a manual page_view`,
  );
  check(
    matches(html, /<script\s+type=["']module["']\s+src=["'](?:\.{0,2}\/)*assets\/js\/affiliate-analytics\.mjs["']><\/script>/i),
    `${relativePath}: missing affiliate analytics module`,
  );
  check(
    matches(html, /<script\s+src=["'](?:\.{0,2}\/)*assets\/js\/posthog-init\.js["']><\/script>/i),
    `${relativePath}: missing PostHog loader`,
  );
  check(
    matches(html, /<script\s+type=["']module["']\s+src=["'](?:\.{0,2}\/)*assets\/js\/posthog-events\.mjs["']><\/script>/i),
    `${relativePath}: missing PostHog events module`,
  );
}

const homepage = read("index.html");
check(
  matches(homepage, /<meta\s+name=["']google-site-verification["']\s+content=["']LAyBUWWOPhKks_eiv2w8VhruzASve85CBLu3L9hKias["']\s*\/?>/i),
  "index.html: missing Google Search Console verification",
);
check(!homepage.includes("tag=luxeskinateli-20"), "index.html: legacy Amazon tag remains");
check(homepage.includes("tag=eclatwebsite-20"), "index.html: website Amazon tag missing");

const template = read("posts/post-template.html");
check(
  matches(template, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']/i),
  "posts/post-template.html: template must be noindex",
);
check(
  matches(template, /<script\s+type=["']module["']\s+src=["']\.\.\/assets\/js\/affiliate-analytics\.mjs["']><\/script>/i),
  "posts/post-template.html: missing affiliate analytics module",
);
check(
  matches(template, /<script\s+src=["']\.\.\/assets\/js\/posthog-init\.js["']><\/script>/i),
  "posts/post-template.html: missing PostHog loader",
);
check(
  matches(template, /<script\s+type=["']module["']\s+src=["']\.\.\/assets\/js\/posthog-events\.mjs["']><\/script>/i),
  "posts/post-template.html: missing PostHog events module",
);
check(
  (template.match(/googletagmanager\.com\/gtag\/js\?id=G-PEVS2KHDT5/g) || []).length === 1,
  "posts/post-template.html: GA4 loader must appear exactly once",
);

for (const relativePath of ["index.html", ...realPages.slice(1).map(([file]) => file)]) {
  const html = read(relativePath);
  const links = [...html.matchAll(/<a\b([^>]*href=["'](?:https?:\/\/)?(?:www\.)?(?:amazon\.com|amzn\.to)[^"']*["'][^>]*)>/gi)];
  for (const [, attributes] of links) {
    check(/data-product-name=["'][^"']+["']/i.test(attributes), `${relativePath}: Amazon link missing data-product-name`);
    check(/data-asin=["'][^"']*["']/i.test(attributes), `${relativePath}: Amazon link missing data-asin`);
    check(/data-link-position=["'][^"']+["']/i.test(attributes), `${relativePath}: Amazon link missing data-link-position`);
    check(/data-affiliate-network=["']amazon["']/i.test(attributes), `${relativePath}: Amazon link missing data-affiliate-network`);
  }
}

const sitemap = read("sitemap.xml");
for (const [, canonical] of realPages) {
  check(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap.xml: missing ${canonical}`);
}
check(!sitemap.includes("post-template.html"), "sitemap.xml: template must be excluded");

const robots = read("robots.txt");
check(/^User-agent:\s*\*/m.test(robots), "robots.txt: missing User-agent");
check(/^Allow:\s*\/$/m.test(robots), "robots.txt: missing Allow");
check(
  robots.includes(`Sitemap: ${baseUrl}/sitemap.xml`),
  "robots.txt: missing sitemap URL",
);

const analyticsPath = path.join(root, "assets/js/affiliate-analytics.mjs");
check(fs.existsSync(analyticsPath), "affiliate analytics module is missing");
if (fs.existsSync(analyticsPath)) {
  const source = read("assets/js/affiliate-analytics.mjs");
  for (const field of [
    "product_name",
    "asin",
    "page_path",
    "link_url",
    "link_position",
    "affiliate_network",
    "amazon_tracking_id",
    "transport_type",
  ]) {
    check(source.includes(field), `affiliate analytics: missing ${field}`);
  }
  check(source.includes("affiliate_click"), "affiliate analytics: missing event name");
  check(!/page_view/.test(source), "affiliate analytics: must not emit page_view");
  for (const utm of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    check(source.includes(utm), `affiliate analytics: missing ${utm} preservation`);
  }

  const syntaxCheck = spawnSync(process.execPath, ["--check", analyticsPath], {
    encoding: "utf8",
  });
  check(
    syntaxCheck.status === 0,
    `affiliate analytics: invalid syntax (${syntaxCheck.stderr.trim()})`,
  );
}

const posthogInitPath = path.join(root, "assets/js/posthog-init.js");
check(fs.existsSync(posthogInitPath), "PostHog loader is missing");
if (fs.existsSync(posthogInitPath)) {
  const source = read("assets/js/posthog-init.js");
  check(source.includes("phc_panyUJfgjcE2z8dMouBxGxziSbta8Fe8R8aiFHqLin7v"), "PostHog loader: project token missing");
  check(source.includes("https://us.i.posthog.com"), "PostHog loader: US API host missing");
  check(/autocapture:\s*false/.test(source), "PostHog loader: autocapture must be disabled");
  check(/capture_pageview:\s*false/.test(source), "PostHog loader: automatic pageview must be disabled");
  check(/capture_pageleave:\s*false/.test(source), "PostHog loader: pageleave must be disabled");
  check(/person_profiles:\s*"identified_only"/.test(source), "PostHog loader: identified-only profiles missing");
  check(/maskAllInputs:\s*true/.test(source), "PostHog loader: input masking missing");

  const syntaxCheck = spawnSync(process.execPath, ["--check", posthogInitPath], {
    encoding: "utf8",
  });
  check(syntaxCheck.status === 0, `PostHog loader: invalid syntax (${syntaxCheck.stderr.trim()})`);
}

const posthogEventsPath = path.join(root, "assets/js/posthog-events.mjs");
check(fs.existsSync(posthogEventsPath), "PostHog events module is missing");
if (fs.existsSync(posthogEventsPath)) {
  const source = read("assets/js/posthog-events.mjs");
  for (const eventName of ["$pageview", "product_viewed"]) {
    check(source.includes(eventName), `PostHog events: missing ${eventName}`);
  }
  for (const field of [
    "$current_url",
    "page_path",
    "page_title",
    "content_type",
    "product_name",
    "asin",
    "category",
    "content_id",
    "product_position",
  ]) {
    check(source.includes(field), `PostHog events: missing ${field}`);
  }
  for (const utm of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    check(source.includes(utm), `PostHog events: missing ${utm}`);
  }

  const syntaxCheck = spawnSync(process.execPath, ["--check", posthogEventsPath], {
    encoding: "utf8",
  });
  check(syntaxCheck.status === 0, `PostHog events: invalid syntax (${syntaxCheck.stderr.trim()})`);
}

if (failures.length) {
  console.error(`Analytics/SEO validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Analytics/SEO validation passed for ${realPages.length} indexable pages.`);
