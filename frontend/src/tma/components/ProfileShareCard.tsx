import { FC, useRef, useEffect, useState } from "react";
import { Share2, Download } from "lucide-react";

interface ProfileShareCardProps {
  userName: string;
  userPhotoUrl?: string | null;
  reputationTier: string;
  reputationScore: number;
  totalPredictions: number;
  correctPredictions: number;
  referralId?: string;
}

const BOT_USERNAME = "OroPredictBot";
const CARD_W = 640;
const CARD_H = 360;

function tierLabel(tier: string): string {
  if (tier === "expert") return "Legend";
  if (tier === "reliable") return "Hot Hand";
  if (tier === "regular") return "Sharpshooter";
  return "Rookie";
}

function tierColor(tier: string): string {
  if (tier === "expert") return "#f59e0b";
  if (tier === "reliable") return "#10b981";
  if (tier === "regular") return "#3b82f6";
  return "#a3a3a3";
}

async function renderProfileCard(
  canvas: HTMLCanvasElement,
  opts: ProfileShareCardProps,
): Promise<void> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = CARD_W;
  canvas.height = CARD_H;

  const tier = opts.reputationTier;
  const accent = tierColor(tier);
  const label = tierLabel(tier);
  const acc = opts.totalPredictions > 0
    ? Math.round((opts.correctPredictions / opts.totalPredictions) * 100)
    : 0;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#0f1117");
  bg.addColorStop(1, "#1a1f2e");
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24);
  ctx.fill();

  // Subtle grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
  }

  // Radial glow behind stats
  const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.6, 20, CARD_W / 2, CARD_H * 0.6, 240);
  glow.addColorStop(0, `${accent}28`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // App brand
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  try {
    const logoImg = new Image();
    await new Promise<void>((res, rej) => {
      logoImg.onload = () => res();
      logoImg.onerror = () => rej();
      logoImg.src = "/logo.png";
    });
    ctx.drawImage(logoImg, 32, 24, 26, 26);
    ctx.fillText("Oro Predict", 66, 42);
  } catch {
    ctx.fillText("💠 Oro Predict", 32, 42);
  }

  // Tier badge (top-right)
  const badgeText = label.toUpperCase();
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  const bW = ctx.measureText(badgeText).width + 22;
  const bH = 26;
  const bX = CARD_W - 32 - bW;
  const bY = 22;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(bX, bY, bW, bH, 8);
  ctx.fillStyle = `${accent}22`;
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.fillText(badgeText, CARD_W - 32 - 11, bY + 17);

  // User avatar
  const avatarX = 32;
  const avatarY = 72;
  const avatarR = 36;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
  ctx.clip();

  let avatarDrawn = false;
  if (opts.userPhotoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = opts.userPhotoUrl!;
      });
      ctx.drawImage(img, avatarX, avatarY, avatarR * 2, avatarR * 2);
      avatarDrawn = true;
    } catch {}
  }
  if (!avatarDrawn) {
    ctx.fillStyle = "#2d3748";
    ctx.fillRect(avatarX, avatarY, avatarR * 2, avatarR * 2);
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(
      (opts.userName?.[0] ?? "?").toUpperCase(),
      avatarX + avatarR,
      avatarY + avatarR + 10,
    );
  }
  ctx.restore();

  // Avatar ring in tier color
  ctx.beginPath();
  ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Name
  ctx.textAlign = "left";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.userName, avatarX + avatarR * 2 + 16, avatarY + 24);

  // Tagline
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`I'm a ${label} on Oro. Beat me.`, avatarX + avatarR * 2 + 16, avatarY + 46);

  // Stats row
  const stats = [
    { label: "Win Rate", value: `${acc}%`, color: acc >= 60 ? "#4ade80" : acc >= 40 ? "#f59e0b" : "#f87171" },
    { label: "Predictions", value: String(opts.totalPredictions), color: "#93c5fd" },
    { label: "Correct", value: String(opts.correctPredictions), color: "#6ee7b7" },
  ];

  const statY = 196;
  const statW = (CARD_W - 64) / 3;
  stats.forEach((s, i) => {
    const sx = 32 + i * statW;
    // Card bg
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sx, statY, statW - 12, 70, 12);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // Value
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.fillText(s.value, sx + (statW - 12) / 2, statY + 38);
    // Label
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(s.label.toUpperCase(), sx + (statW - 12) / 2, statY + 58);
  });

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, CARD_H - 52);
  ctx.lineTo(CARD_W - 32, CARD_H - 52);
  ctx.stroke();

  // Referral link footer
  const refUrl = opts.referralId
    ? `t.me/${BOT_USERNAME}?start=ref_${opts.referralId}`
    : `t.me/${BOT_USERNAME}`;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "left";
  ctx.fillText(refUrl, 32, CARD_H - 28);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText("oro.predict.bt", CARD_W - 32, CARD_H - 28);
}

export const ProfileShareCard: FC<ProfileShareCardProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    renderProfileCard(canvas, props)
      .then(() => {
        canvas.toBlob((blob) => {
          if (blob) setBlobUrl(URL.createObjectURL(blob));
        }, "image/png");
      })
      .finally(() => setRendering(false));
  }, [props.userName, props.reputationTier, props.totalPredictions]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "oro-profile.png";
    a.click();
  };

  const handleShare = async () => {
    if (!blobUrl) return;
    const tier = tierLabel(props.reputationTier);
    const shareText = `I'm a ${tier} on Oro Predict. Can you beat my record?\n\nt.me/${BOT_USERNAME}${props.referralId ? `?start=ref_${props.referralId}` : ""}`;
    try {
      const blob = await fetch(blobUrl).then((r) => r.blob());
      const file = new File([blob], "oro-profile.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
    } catch {}
    // Fallback: open Telegram share
    const encoded = encodeURIComponent(shareText);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(`t.me/${BOT_USERNAME}`)}&text=${encoded}`;
    window.open(tgUrl, "_blank");
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Canvas preview — scaled to fit */}
      <div
        style={{
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          background: "#0f1117",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        {rendering && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.15)",
                borderTopColor: "#fff",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleShare}
          disabled={rendering || !blobUrl}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 0",
            borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            border: "none",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: rendering ? "default" : "pointer",
            opacity: rendering ? 0.6 : 1,
          }}
        >
          <Share2 size={16} />
          Share Card
        </button>
        <button
          onClick={handleDownload}
          disabled={rendering || !blobUrl}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            cursor: rendering ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: rendering ? 0.5 : 1,
          }}
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};
