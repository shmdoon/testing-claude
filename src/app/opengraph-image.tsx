import { ImageResponse } from "next/og";
import { t } from "@/i18n";

export const alt = t("marketing.heroTitle");
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image for WhatsApp/Facebook/LinkedIn/X previews (generated, no asset to maintain). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#4338ca", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#fbbf24", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e1b4b", fontSize: 30 }}>AI</div>
          {t("common.appName")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>{t("marketing.heroTitle")}</div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>{`${t("marketing.eyebrow")} · ${t("marketing.trustNoAds")} · ${t("marketing.trustConsent")}`}</div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["#f97366", "#14b8a6", "#a5b4fc", "#22c55e"].map((c) => (
            <div key={c} style={{ height: 14, flex: 1, borderRadius: 8, background: c }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
