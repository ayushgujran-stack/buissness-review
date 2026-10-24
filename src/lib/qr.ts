import QRCode from 'qrcode';
import crypto from 'crypto';

export function generateSecureToken(): string {
  return `rf_${crypto.randomBytes(16).toString('hex')}`;
}

export async function generateQrDataUrl(text: string, options?: QRCode.QRCodeToDataURLOptions): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: options?.width || 512,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
      ...options?.color,
    },
  });
}

export async function generateQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });
}

export interface QrArtworkParams {
  businessName: string;
  branchName: string;
  category: string;
  description?: string;
  themeColor?: string;
  qrDataUrl: string;
  reviewUrl: string;
}

export function generatePrintableArtworkHtml(params: QrArtworkParams): string {
  const { businessName, branchName, category, description, themeColor = '#4F46E5', qrDataUrl, reviewUrl } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Review Standee - ${businessName} (${branchName})</title>
  <style>
    @page { size: A5; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .standee-card {
      width: 420px;
      background: #ffffff;
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
      text-align: center;
      position: relative;
    }
    .header-banner {
      background: linear-gradient(135deg, ${themeColor}, #1e1b4b);
      color: #ffffff;
      padding: 36px 24px 28px;
      position: relative;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .biz-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .branch-name {
      font-size: 15px;
      opacity: 0.9;
      font-weight: 500;
    }
    .content-area {
      padding: 32px 28px;
    }
    .qr-frame {
      display: inline-block;
      padding: 18px;
      background: #ffffff;
      border-radius: 24px;
      border: 2px dashed ${themeColor}44;
      box-shadow: 0 10px 25px rgba(0,0,0,0.04);
      margin-bottom: 24px;
    }
    .qr-img {
      width: 220px;
      height: 220px;
      display: block;
    }
    .scan-cta {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .scan-subtext {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 20px;
      padding: 0 10px;
    }
    .stars-row {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 16px;
    }
    .star {
      color: #fbbf24;
      font-size: 20px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 16px;
      background: #fafafa;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rf-branding {
      font-weight: 700;
      color: #475569;
    }
    @media print {
      body { padding: 0; background: #ffffff; }
      .standee-card { box-shadow: none; border: none; width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="standee-card">
    <div class="header-banner">
      <div class="badge">${category}</div>
      <h1 class="biz-name">${businessName}</h1>
      <div class="branch-name">${branchName}</div>
    </div>
    <div class="content-area">
      <div class="stars-row">
        <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span>
      </div>
      <div class="qr-frame">
        <img class="qr-img" src="${qrDataUrl}" alt="Review QR Code" />
      </div>
      <div class="scan-cta">How was your experience today?</div>
      <p class="scan-subtext">${description || 'Scan this QR code with your phone camera to share private feedback directly with management.'}</p>
    </div>
    <div class="footer">
      <span>Private & Direct Feedback</span>
      <span class="rf-branding">Powered by ReviewFlow</span>
    </div>
  </div>
</body>
</html>`;
}
