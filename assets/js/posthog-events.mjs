const UTM_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

function campaignProperties() {
  const search = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    UTM_PARAMETERS.map((parameter) => [parameter, search.get(parameter) || ""]),
  );
}

function isQaTest() {
  const hostname = window.location.hostname;
  const requested = new URLSearchParams(window.location.search).get("qa_test");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    requested === "1" ||
    requested === "true"
  );
}

function capture(eventName, properties) {
  if (typeof window.posthog?.capture !== "function") return;
  window.posthog.capture(eventName, properties);
}

function contentType() {
  if (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html")) {
    return "homepage";
  }
  if (window.location.pathname.includes("/posts/")) return "article";
  return "page";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productContext(link) {
  const container = link.closest(".product-card, .drop-card, .card, article, section, li");
  const productName =
    link.dataset.productName?.trim() ||
    container?.querySelector("h1, h2, h3, h4, strong")?.textContent?.trim() ||
    "Unknown product";
  const categories = container?.dataset.category?.trim().split(/\s+/).filter(Boolean) || [];

  return {
    container: container || link,
    properties: {
      product_name: productName,
      asin: link.dataset.asin?.trim().toUpperCase() || "",
      category: categories[0] || contentType(),
      page_path: window.location.pathname,
      content_id: container?.dataset.productId?.trim() || slugify(productName),
      product_position: link.dataset.linkPosition?.trim() || "",
      qa_test: isQaTest(),
      ...campaignProperties(),
    },
  };
}

capture("$pageview", {
  "$current_url": window.location.href,
  page_path: window.location.pathname,
  page_title: document.title,
  content_type: contentType(),
  qa_test: isQaTest(),
  ...campaignProperties(),
});

const observed = new WeakSet();
const captured = new WeakSet();
const visibilityTimers = new WeakMap();
const products = [];

for (const link of document.querySelectorAll(
  'a[data-affiliate-network="amazon"][data-product-name]',
)) {
  const context = productContext(link);
  if (observed.has(context.container)) continue;
  observed.add(context.container);
  products.push(context);
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const context = products.find((product) => product.container === entry.target);
      if (!context || captured.has(entry.target)) continue;

      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
        window.clearTimeout(visibilityTimers.get(entry.target));
        visibilityTimers.delete(entry.target);
        continue;
      }

      const timer = window.setTimeout(() => {
        if (captured.has(entry.target)) return;
        captured.add(entry.target);
        capture("product_viewed", context.properties);
        observer.unobserve(entry.target);
      }, 500);
      visibilityTimers.set(entry.target, timer);
    }
  },
  { threshold: [0.5] },
);

for (const product of products) observer.observe(product.container);
