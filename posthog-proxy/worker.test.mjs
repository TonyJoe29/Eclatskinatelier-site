import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGa4MeasurementPayload,
  routeAnalyticsRequest,
  routePostHogRequest,
} from "./src/worker.js";

test("routes SDK assets to the US asset host", () => {
  const route = routePostHogRequest(new URL("https://proxy.example/static/array.js?v=1"));
  assert.equal(route.origin, "https://us-assets.i.posthog.com");
  assert.equal(route.pathname, "/static/array.js");
  assert.equal(route.search, "?v=1");
});

test("routes event ingestion to the US API host", () => {
  const route = routePostHogRequest(new URL("https://proxy.example/i/v0/e/?ip=1"));
  assert.equal(route.origin, "https://us.i.posthog.com");
  assert.equal(route.pathname, "/i/v0/e/");
  assert.equal(route.search, "?ip=1");
});

test("routes session replay assets through the asset host", () => {
  const route = routePostHogRequest(new URL("https://proxy.example/array/phc.js"));
  assert.equal(route.origin, "https://us-assets.i.posthog.com");
});

test("routes the Google tag through the first-party gateway", () => {
  const route = routeAnalyticsRequest(
    new URL("https://proxy.example/metrics/client.js?id=G-PEVS2KHDT5"),
  );
  assert.equal(route.origin, "https://www.googletagmanager.com");
  assert.equal(route.pathname, "/gtag/js");
  assert.equal(route.search, "?id=G-PEVS2KHDT5");
});

test("routes GA4 collection through the first-party gateway", () => {
  const route = routeAnalyticsRequest(
    new URL("https://proxy.example/metrics/g/collect?v=2&tid=G-PEVS2KHDT5"),
  );
  assert.equal(route.origin, "https://www.google-analytics.com");
  assert.equal(route.pathname, "/g/collect");
  assert.equal(route.search, "?v=2&tid=G-PEVS2KHDT5");
});

test("builds a GA4 affiliate event without accepting arbitrary event names", () => {
  const payload = buildGa4MeasurementPayload({
    client_id: "qa-client",
    event_name: "affiliate_click",
    params: {
      product_name: "Halo Glow Liquid Filter",
      asin: "B0B5MG6PHQ",
      page_path: "/",
      link_position: "homepage-amazon-01",
      amazon_tracking_id: "eclatwebsite-20",
      qa_test: true,
      utm_source: "codex",
    },
  });

  assert.deepEqual(payload, {
    client_id: "qa-client",
    events: [{
      name: "affiliate_click",
      params: {
        product_name: "Halo Glow Liquid Filter",
        asin: "B0B5MG6PHQ",
        page_path: "/",
        link_position: "homepage-amazon-01",
        amazon_tracking_id: "eclatwebsite-20",
        qa_test: true,
        utm_source: "codex",
      },
    }],
  });

  assert.equal(
    buildGa4MeasurementPayload({
      client_id: "qa-client",
      event_name: "not_allowed",
      params: {},
    }),
    null,
  );
});
