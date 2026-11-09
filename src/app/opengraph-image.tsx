import { ImageResponse } from "next/og";

// The link-preview image for every page (WhatsApp, Facebook, X, Slack,
// search results). Next attaches it to all routes under app/ automatically;
// a page can still override it with its own opengraph-image. Generated once
// at build time — no request data, so it's statically optimized.

export const alt = "Ratnavue — Ceylon gemstones and fine jewelry from Sri Lanka";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0c1220";
const GOLD = "#e3b562";
const CREAM = "#f4efe6";
const SAPPHIRE = "#5b7cc9";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: `radial-gradient(60% 80% at 78% 45%, #1f2e5a 0%, ${NAVY} 70%)`,
          color: CREAM,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: GOLD, textTransform: "uppercase" }}>Ceylon Gemstones</div>
          <div style={{ fontSize: 104, letterSpacing: 10, marginTop: 18 }}>RATNAVUE</div>
          <div style={{ width: 160, height: 3, background: GOLD, marginTop: 28 }} />
          <div style={{ fontSize: 32, lineHeight: 1.4, marginTop: 32, color: "#cfc8bb" }}>
            Sapphires, rubies and fine jewelry — sourced and quoted with care from Sri Lanka.
          </div>
        </div>
        {/* The site's stylised gem mark (see StylizedGem). */}
        <svg width="340" height="290" viewBox="0 0 200 170">
          <ellipse cx="100" cy="156" rx="66" ry="7" fill="#000000" fillOpacity="0.35" />
          <ellipse cx="100" cy="72" rx="80" ry="58" fill={SAPPHIRE} />
          <polygon points="100,14 180,72 100,130 20,72" fill="#7c96d4" />
          <ellipse cx="100" cy="72" rx="38" ry="28" fill="#9db0df" />
        </svg>
      </div>
    ),
    size,
  );
}
