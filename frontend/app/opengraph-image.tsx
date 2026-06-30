import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const alt = "TradeBias — Clarity over prediction";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#0a0c10",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Subtle grid lines background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(#1e2229 1px, transparent 1px), linear-gradient(90deg, #1e2229 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            opacity: 0.4,
            display: "flex",
          }}
        />

        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "#00e5a0",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "#e2e8f0",
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            TradeBias
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "82px",
            fontWeight: 800,
            color: "#e2e8f0",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ display: "flex" }}>Read the market's</span>
          <span style={{ display: "flex", color: "#00e5a0" }}>mood.</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: "36px",
            fontSize: "30px",
            color: "#6b7585",
            letterSpacing: "0.04em",
            display: "flex",
          }}
        >
          CLARITY OVER PREDICTION
        </div>

        {/* Bias chips row */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "48px",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              borderRadius: "8px",
              backgroundColor: "rgba(0,229,160,0.12)",
              border: "1px solid rgba(0,229,160,0.3)",
              color: "#00e5a0",
              fontSize: "24px",
              fontWeight: 600,
            }}
          >
            Bullish ↑
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              borderRadius: "8px",
              backgroundColor: "rgba(245,166,35,0.12)",
              border: "1px solid rgba(245,166,35,0.3)",
              color: "#f5a623",
              fontSize: "24px",
              fontWeight: 600,
            }}
          >
            Neutral →
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              borderRadius: "8px",
              backgroundColor: "rgba(255,77,109,0.12)",
              border: "1px solid rgba(255,77,109,0.3)",
              color: "#ff4d6d",
              fontSize: "24px",
              fontWeight: 600,
            }}
          >
            Bearish ↓
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
