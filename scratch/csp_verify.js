// Simulate the CSP logic from next.config.ts
function buildCsp(isDev) {
  const directives = [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      isDev ? "'unsafe-eval'" : "",
      "https://js.stripe.com",
    ],
    [
      "connect-src",
      "'self'",
      "https://api.stripe.com",
      "https://ipwho.is",
      isDev ? "ws:" : "",
      isDev ? "http://localhost:*" : "",
    ],
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .map((d) => (Array.isArray(d) ? d.filter(Boolean).join(" ") : d))
    .filter(Boolean)
    .join("; ");
  return directives;
}

const devCsp = buildCsp(true);
const prodCsp = buildCsp(false);

console.log("=== DEV CSP ===");
console.log(devCsp);
console.log("\n=== PROD CSP ===");
console.log(prodCsp);

console.log("\n=== Analysis ===");
console.log("unsafe-eval in dev:", devCsp.includes("'unsafe-eval'"));
console.log("unsafe-eval in prod:", prodCsp.includes("'unsafe-eval'"));
console.log("ws: in dev:", devCsp.includes("ws:"));
console.log("ws: in prod:", prodCsp.includes("ws:"));
console.log("localhost in dev:", devCsp.includes("localhost"));
console.log("localhost in prod:", prodCsp.includes("localhost"));
console.log("upgrade-insecure-requests in dev:", devCsp.includes("upgrade-insecure-requests"));
console.log("upgrade-insecure-requests in prod:", prodCsp.includes("upgrade-insecure-requests"));
