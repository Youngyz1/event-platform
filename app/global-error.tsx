"use client";

import { useEffect } from "react";

/**
 * app/global-error.tsx — root error boundary (H4).
 *
 * Must render its own <html>/<body> (it replaces the root layout on failure).
 * Never displays raw exception detail: only a generic message plus the Next
 * digest (a correlation id for matching user reports to server logs).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error("[GlobalError]", error.digest ?? "no-digest");
    } catch {
      // ignore logging failures inside the error boundary itself
    }
  }, [error]);

  return (
    <html>
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <p style={{ fontSize: "3.5rem", fontWeight: 900 }}>500</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900 }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: "0.75rem", color: "#71717a" }}>
              An unexpected error occurred. Please try again, or return to the
              home page.
            </p>
            {error.digest && (
              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  color: "#a1a1aa",
                  fontFamily: "monospace",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            <div
              style={{
                marginTop: "2rem",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
              }}
            >
              <button
                onClick={reset}
                style={{
                  borderRadius: "0.75rem",
                  background: "#15803d",
                  padding: "0.75rem 1.5rem",
                  fontWeight: 800,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e4e4e7",
                  padding: "0.75rem 1.5rem",
                  fontWeight: 700,
                  color: "#3f3f46",
                  textDecoration: "none",
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
