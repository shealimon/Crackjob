import { ImageResponse } from "next/og";
import { PRODUCT_NAME } from "@/lib/constants";

export const runtime = "edge";
export const alt = `${PRODUCT_NAME} — AI interview assistant`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(145deg, #0b0705 0%, #1a120e 45%, #2a1c14 100%)",
          color: "#f5f0ea",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#d4b896",
          }}
        >
          {PRODUCT_NAME}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              maxWidth: 900,
            }}
          >
            AI Interview Assistant for live coding rounds
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "#a2a3a6",
              maxWidth: 820,
            }}
          >
            Real-time answers · Invisible on Zoom, Meet & Teams · Built like ChatGPT for interviews
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#8a8078",
            letterSpacing: "0.04em",
          }}
        >
          www.porpin.com
        </div>
      </div>
    ),
    { ...size },
  );
}
