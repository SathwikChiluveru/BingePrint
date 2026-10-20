import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Sample Autoplayed frame: The Binge Lord, 5,626 titles. Then compare with your friends. Autoplayed is not affiliated with Netflix.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Shared link preview: one sample reel frame, labeled as a sample. */
// Fonts: Inter (SIL OFL, see src/app/fonts/OFL.txt) read from disk, so the hero gets a true black weight.
// Named exception in DESIGN.md (Typography): the renderer has no system sans, so link previews use Inter.
export default async function Image() {
  const [interBlack, interSemiBold] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Inter-900.ttf")),
    readFile(join(process.cwd(), "src/app/fonts/Inter-600.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: "#141414",
          backgroundImage:
            "radial-gradient(ellipse 55% 60% at 50% 50%, rgba(229, 9, 20, 0.38) 0%, rgba(229, 9, 20, 0.08) 45%, rgba(20, 20, 20, 0) 75%)",
          color: "#ffffff",
          fontFamily: "Inter",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900, letterSpacing: "-0.02em" }}>Autoplayed</div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#b3b3b3",
              padding: "8px 18px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.18)",
              background: "rgba(255, 255, 255, 0.06)",
            }}
          >
            Sample
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#8c8c8c",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Your personality
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 136,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            The Binge Lord
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 32, color: "#b3b3b3" }}>
            5,626 titles. One more episode was never a question.
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em" }}>
            Then compare with your friends.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: "#8c8c8c",
          }}
        >
          <div style={{ display: "flex" }}>Your Netflix history, roasted.</div>
          <div style={{ display: "flex" }}>Not affiliated with Netflix.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interBlack, style: "normal", weight: 900 },
        { name: "Inter", data: interSemiBold, style: "normal", weight: 600 },
      ],
    }
  );
}
