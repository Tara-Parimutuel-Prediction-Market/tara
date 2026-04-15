import { FC, useRef, useEffect, useState } from "react";
import { Share2, Download } from "lucide-react";

interface BetShareCardProps {
  userName: string;
  userPhotoUrl?: string | null;
  marketTitle: string;
  outcomePicked: string;
  stakeAmount?: number;
  totalPool?: number;
  outcomeColor?: string;
  /** Telegram bot username for deep-link */
  botUsername?: string;
  referralId?: string;
}

const BOT_USERNAME = "OroPredictBot";
const CARD_W = 640;
const CARD_H = 360;

/** Draws the bet card to a canvas and returns a blob URL. */
async function renderCard(
  canvas: HTMLCanvasElement,
  opts: BetShareCardProps,
): Promise<void> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = CARD_W;
  canvas.height = CARD_H;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#0f1117");
  bg.addColorStop(1, "#1a1f2e");
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24);
  ctx.fill();

  // Subtle grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }

  // Glow behind outcome chip
  const glow = ctx.createRadialGradient(
    CARD_W / 2,
    CARD_H * 0.55,
    10,
    CARD_W / 2,
    CARD_H * 0.55,
    200,
  );
  const color = opts.outcomeColor || "#3b82f6";
  glow.addColorStop(0, `${color}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // App logo / brand
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";

  // Load and draw logo image
  try {
    const logoImg = new Image();
    await new Promise<void>((res, rej) => {
      logoImg.onload = () => res();
      logoImg.onerror = () => rej();
      logoImg.src = "/logo.svg";
    });
    ctx.drawImage(logoImg, 32, 24, 28, 28);
    ctx.fillText("Oro Predict", 68, 44);
  } catch {
    ctx.fillText("💠 Oro Predict", 32, 44);
  }

  // User avatar circle
  const avatarX = 32;
  const avatarY = 76;
  const avatarR = 26;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

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
    } catch {
      // fallback: coloured circle with initial
      ctx.fillStyle = color;
      ctx.fillRect(avatarX, avatarY, avatarR * 2, avatarR * 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        (opts.userName?.[0] ?? "?").toUpperCase(),
        avatarX + avatarR,
        avatarY + avatarR,
      );
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(avatarX, avatarY, avatarR * 2, avatarR * 2);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      (opts.userName?.[0] ?? "?").toUpperCase(),
      avatarX + avatarR,
      avatarY + avatarR,
    );
  }
  ctx.restore();

  // User name
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.userName, avatarX + avatarR * 2 + 12, avatarY + 18);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("just called it! ", avatarX + avatarR * 2 + 12, avatarY + 36);

  // Market title (wrapped)
  const maxTitleWidth = CARD_W - 64;
  const titleFontSize = 22;
  ctx.font = `bold ${titleFontSize}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "left";
  const words = opts.marketTitle.split(" ");
  let line = "";
  let titleY = 168;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxTitleWidth && line) {
      ctx.fillText(line, 32, titleY);
      line = word;
      titleY += titleFontSize + 6;
      if (titleY > 220) {
        ctx.fillText(line + "…", 32, titleY);
        line = "";
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 32, titleY);

  // Outcome pill
  const pillY = titleY + 28;
  const pillText = `${opts.outcomePicked}`;
  ctx.font = "bold 15px system-ui";
  const pillW = ctx.measureText(pillText).width + 28;
  ctx.fillStyle = `${color}33`;
  roundRect(ctx, 32, pillY, pillW, 34, 10);
  ctx.fill();
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 32, pillY, pillW, 34, 10);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, 46, pillY + 17);

  // Right-side badge: stake OR total pool
  const badgeAmount = opts.stakeAmount || opts.totalPool;
  const badgeLabel = opts.stakeAmount
    ? "staked"
    : opts.totalPool
      ? "total pool"
      : null;
  if (badgeAmount && badgeLabel) {
    const badgeText = `Nu ${badgeAmount.toLocaleString()}`;
    ctx.font = "bold 28px system-ui";
    ctx.fillStyle = opts.stakeAmount ? "#f59e0b" : "#a78bfa";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(badgeText, CARD_W - 32, pillY + 22);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(badgeLabel, CARD_W - 32, pillY + 36);
  }

  // CTA / reflink
  const refLink = `t.me/${opts.botUsername ?? BOT_USERNAME}/app?startapp=ref_${opts.referralId ?? ""}`;
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`🔗 ${refLink}`, 32, CARD_H - 20);

  // Watermark divider
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, CARD_H - 36);
  ctx.lineTo(CARD_W - 32, CARD_H - 36);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const BetShareCard: FC<BetShareCardProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    setRendering(true);
    renderCard(canvasRef.current, props)
      .then(() => {
        canvasRef.current!.toBlob((b) => {
          if (b) {
            setBlob(b);
            setBlobUrl(URL.createObjectURL(b));
          }
          setRendering(false);
        }, "image/png");
      })
      .catch(() => setRendering(false));
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.marketTitle,
    props.outcomePicked,
    props.stakeAmount,
    props.totalPool,
  ]);

  const refLink = `https://t.me/${props.botUsername ?? BOT_USERNAME}/app?startapp=ref_${props.referralId ?? ""}`;
  const shareText = props.stakeAmount
    ? `🏆 I'm calling it! Nu ${props.stakeAmount.toLocaleString()} on "${props.outcomePicked}" in:\n"${props.marketTitle}"\n\nCan you predict better? Join 👇\n${refLink}`
    : `🔥 Check this out: "${props.outcomePicked}" in\n"${props.marketTitle}"\n\nJoin Oro Predict 👇\n${refLink}`;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    try {
      // ── Strategy 1: Native share sheet with image file (works inside Telegram mobile) ──
      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], "oro-bet.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Oro Bet",
            text: shareText,
          });
          return;
        }
      }

      // ── Strategy 2: Native share without file (text + url) ──
      if (navigator.share) {
        await navigator.share({ text: shareText, url: refLink });
        return;
      }

      // ── Strategy 3: Telegram WebApp openTelegramLink (text-only fallback) ──
      const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(shareText)}`;
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(telegramShareUrl);
        return;
      }

      // ── Strategy 4: Open in new tab ──
      window.open(telegramShareUrl, "_blank");
    } catch (err: any) {
      // User cancelled or share failed — silently ignore AbortError
      if (err?.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "oro-bet.png";
    a.click();
  };

  // Whether native file sharing is likely supported (heuristic)
  const canShareImage =
    typeof navigator !== "undefined" &&
    !!navigator.share &&
    !!navigator.canShare;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Card preview */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#0f1117",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            opacity: rendering ? 0 : 1,
            transition: "opacity 0.3s ease",
          }}
        />
        {rendering && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0f1117",
              minHeight: 100,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: "#f59e0b",
                borderRadius: "50%",
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
          disabled={rendering || sharing}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px",
            background:
              rendering || sharing
                ? "rgba(37,99,235,0.5)"
                : "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: rendering || sharing ? "not-allowed" : "pointer",
            boxShadow:
              rendering || sharing ? "none" : "0 4px 14px rgba(37,99,235,0.35)",
            transition: "all 0.15s ease",
          }}
        >
          {sharing ? (
            <div
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          ) : (
            <Share2 size={16} />
          )}
          {canShareImage ? "Share Image" : "Share Card"}
        </button>
        <button
          onClick={handleDownload}
          disabled={!blobUrl}
          title="Save image"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-main)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: blobUrl ? "pointer" : "not-allowed",
            opacity: blobUrl ? 1 : 0.4,
          }}
        >
          <Download size={16} />
        </button>
      </div>

      {/* Hint text */}
      {!rendering && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {canShareImage
            ? `Tap "Share Image" to send the card directly in Telegram`
            : "Save the image first, then send it in Telegram"}
        </p>
      )}
    </div>
  );
};
