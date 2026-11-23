import * as amplitude from "@amplitude/unified";
import mixpanel from "mixpanel-browser";
import { StatsigClient } from "@statsig/js-client";
import { StatsigSessionReplayPlugin } from "@statsig/session-replay";
import { StatsigAutoCapturePlugin } from "@statsig/web-analytics";

// All of these are public, client-side keys (they ship in every page load).
// Amplitude ingestion key — public by design; move to an env var when you set up environments.
const AMPLITUDE_KEY = "ce53c6e285c66cb68b69f2b08fbde8d2";
const MIXPANEL_TOKEN = "e08ec9f4d85b65e282a035a2f549d97b";
const STATSIG_CLIENT_KEY = "client-tcpB4D3YZqR7LbmBeU61IEpl74SBXsEFojW4gQBOIFX";
// Amplitude Experiment (feature flags) uses a *deployment key*, which is
// different from the analytics key above. Paste it here to turn flags on.
const AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY = "client-IBlYsmJXQuFQW3wo1nW6PWlN1oM4Z6IV";

// Stable anonymous id so Statsig/Mixpanel can recognise a returning browser.
function getAnonId() {
  try {
    let id = localStorage.getItem("sp_anon_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("sp_anon_id", id);
    }
    return id;
  } catch (e) {
    return "anon-session";
  }
}

// How the visitor arrived: utm_source, else referrer domain, else "direct".
function getArrival() {
  const params = new URLSearchParams(location.search);
  let referrerDomain = "";
  let routeContext = "";
  try {
    if (document.referrer) {
      const r = new URL(document.referrer);
      referrerDomain = r.hostname;
      routeContext = r.pathname;
    }
  } catch (e) {}
  const source =
    params.get("utm_source") || params.get("source") || referrerDomain || "direct";
  return { source, route_context: routeContext, referrer_domain: referrerDomain };
}

const arrival = getArrival();
const anonId = getAnonId();
let statsigClient = null;
let ready = null;

function init() {
  // Amplitude: analytics + autocapture + session replay (+ experiment if keyed)
  const amplitudeOptions = {
    analytics: { autocapture: true },
    sessionReplay: { sampleRate: 1 },
  };
  if (AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY) {
    amplitudeOptions.experiment = {
      deploymentKey: AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY,
    };
  }
  const amplitudeReady = amplitude
    .initAll(AMPLITUDE_KEY, amplitudeOptions)
    .catch((e) => console.warn("Amplitude init failed", e));
  amplitude.track("Viewed Home Page", { prompt_version: "BA400.4" }); // helps improve this setup flow — safe to remove once you've verified the event lands

  // Mixpanel
  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: false,
    persistence: "localStorage",
  });
  mixpanel.identify(anonId);

  // Statsig: auto-capture + session replay
  statsigClient = new StatsigClient(
    STATSIG_CLIENT_KEY,
    { userID: anonId },
    {
      plugins: [new StatsigSessionReplayPlugin(), new StatsigAutoCapturePlugin()],
    }
  );
  const statsigReady = statsigClient
    .initializeAsync()
    .catch((e) => console.warn("Statsig init failed", e));

  ready = Promise.all([amplitudeReady, statsigReady]);
}

// Sends one event to Mixpanel and Statsig, always with the arrival source.
function track(name, props = {}) {
  const payload = { source: arrival.source, ...props };
  try {
    mixpanel.track(name, payload);
  } catch (e) {}
  try {
    statsigClient?.logEvent(name, undefined, stringify(payload));
  } catch (e) {}
}

// Statsig event metadata must be string values.
function stringify(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = String(v);
  return out;
}

// Feature flags. Amplitude Experiment first (once keyed), Statsig gate as
// a fallback, otherwise the supplied default.
async function flag(key, defaultValue = false) {
  try {
    await ready;
    const exp = amplitude.experiment?.();
    if (exp) {
      await exp.fetch?.();
      const v = exp.variant(key);
      if (v && v.value !== undefined && v.value !== null && v.value !== "off") {
        return v.value === "on" ? true : v.value;
      }
      if (v && v.value === "off") return false;
    }
    if (statsigClient) return statsigClient.checkGate(key);
  } catch (e) {
    console.warn("flag lookup failed", key, e);
  }
  return defaultValue;
}

init();

window.statusAnalytics = { track, flag, arrival };
track("status_page_viewed", {
  route_context: arrival.route_context,
  referrer_domain: arrival.referrer_domain,
});

// Feature flag "flag1" picks the theme variant: "light" or "dark".
// Anything else (off, missing, error) falls back to light.
flag("flag1", "light").then((value) => {
  const variant = value === "dark" ? "dark" : "light";
  console.info("[flags] flag1 variant =", variant, "(raw:", value, ")");
  document.documentElement.classList.toggle("theme-dark", variant === "dark");
  try {
    localStorage.setItem("sp_theme", variant);
  } catch (e) {}
  track("flag_evaluated", { flag_key: "flag1", flag_value: variant });
});

// Replay anything index.js fired before this bundle finished loading.
(window.__spQueue || []).forEach(([name, props]) => track(name, props));
window.__spQueue = [];
