import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  ActivityIndicator, 
  Platform,
  Dimensions,
  useWindowDimensions,
  Image,
  Share,
  Alert
} from 'react-native';
import { 
  X, 
  Download, 
  Sparkles, 
  Star, 
  Palette, 
  Type, 
  Check, 
  RefreshCw 
} from 'lucide-react-native';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

const screenWidth = Dimensions.get('window').width;

interface QRCodeFrameModalProps {
  visible: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  brandId: string;
}

type TemplateType = 'classic' | 'gradient' | 'minimalist' | 'badge';
const TEMPLATES: TemplateType[] = ['classic', 'gradient', 'minimalist', 'badge'];

const PRESET_COLORS = [
  { name: 'Indigo Royal', value: '#6366f1' },
  { name: 'Sunset Glow', value: '#f97316', gradientEnd: '#db2777' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Dark Slate', value: '#0f172a' },
  { name: 'Rose Petal', value: '#f43f5e' }
];

const HEADLINE_SUGGESTIONS = [
  "Scan & Review Us!",
  "How Did We Do Today?",
  "Love Our Service?",
  "Feed Us Feedback!",
  "Rate Your Experience"
];

const SUBHEADLINE_SUGGESTIONS = [
  "Scan the QR code below to share your experience with us.",
  "Your feedback helps us grow and serve you better.",
  "Help us improve! It takes less than a minute.",
  "Share your thoughts and rate your visit."
];

export default function QRCodeFrameModal({ 
  visible, 
  onClose, 
  branchId, 
  branchName, 
  brandId 
}: QRCodeFrameModalProps) {
  const CUSTOMER_APP_URL = process.env.EXPO_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3000";
  const qrData = `${CUSTOMER_APP_URL}?brandId=${brandId}&branchId=${branchId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;

  // State controls for live editing
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('classic');
  const [themeColor, setThemeColor] = useState('#6366f1');
  const [customColor, setCustomColor] = useState('');
  const [headline, setHeadline] = useState('Scan & Review Us!');
  const [subheadline, setSubheadline] = useState('Your feedback helps us grow and serve you better.');
  const [customBranchLabel, setCustomBranchLabel] = useState(branchName);
  const [showStars, setShowStars] = useState(true);
  const [starColor, setStarColor] = useState('#fbbf24'); // Amber/Gold
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [showShareWindow, setShowShareWindow] = useState(false);
  const [sharePosterUrl, setSharePosterUrl] = useState('');

  // Fetch Brand Logo
  useEffect(() => {
    async function fetchBrandLogo() {
      if (!brandId) return;
      try {
        const brandRef = doc(db, 'brands', brandId);
        const brandSnap = await getDoc(brandRef);
        if (brandSnap.exists()) {
          setBrandLogo(brandSnap.data().logo || '');
        }
      } catch (err) {
        console.error("Error fetching brand logo in modal:", err);
      }
    }
    if (visible) {
      fetchBrandLogo();
    }
  }, [brandId, visible]);

  // Dynamic QR code preview renderer with centered logo
  const renderQrWithLogo = (marginStyle: any = null) => {
    return (
      <View style={[styles.previewQrWrapper, marginStyle]}>
        <Image source={{ uri: qrCodeUrl }} style={styles.realQrImage} />
        {brandLogo ? (
          <Image 
            source={{ uri: brandLogo }} 
            style={{
              position: 'absolute',
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#ffffff',
              borderWidth: 2,
              borderColor: '#ffffff',
              top: '50%',
              left: '50%',
              marginTop: -16,
              marginLeft: -16,
            }} 
          />
        ) : null}
      </View>
    );
  };

  // Ref for the horizontal slider ScrollView
  const carouselRef = useRef<ScrollView>(null);

  // Ensure scroll is correct when modal mounts/becomes visible
  useEffect(() => {
    if (visible) {
      const index = TEMPLATES.indexOf(selectedTemplate);
      if (index !== -1 && carouselRef.current) {
        setTimeout(() => {
          carouselRef.current?.scrollTo({ x: index * 300, animated: false });
        }, 150);
      }
    }
  }, [visible]);

  // Handle manual/gesture scroll snaps
  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / 300);
    if (index >= 0 && index < TEMPLATES.length) {
      const targetTemplate = TEMPLATES[index];
      if (selectedTemplate !== targetTemplate) {
        setSelectedTemplate(targetTemplate);
      }
    }
  };

  // Programmatically slide to target index
  const scrollToTemplate = (index: number) => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ x: index * 300, animated: true });
      setSelectedTemplate(TEMPLATES[index]);
    }
  };

  // Active gradient check
  const activeColorPreset = PRESET_COLORS.find(c => c.value === themeColor);
  const isGradient = activeColorPreset?.name === 'Sunset Glow';
  const themeColorEnd = isGradient ? activeColorPreset?.gradientEnd || '#db2777' : themeColor;

  // Layout-related configurations
  const BodyContainer = isMobile ? ScrollView : View;
  const bodyProps = isMobile ? {
    style: styles.mobileScrollView,
    contentContainerStyle: styles.mobileContentBody,
    showsVerticalScrollIndicator: true
  } : {
    style: styles.contentBody
  };


  const ControlsScrollContainer = isMobile ? View : ScrollView;
  const controlsScrollProps = isMobile 
    ? { style: { paddingBottom: 20 } } 
    : { 
        showsVerticalScrollIndicator: false,
        contentContainerStyle: styles.controlsScroll 
      };

  const containerStyle: any = [
    styles.container,
    isMobile && {
      height: '95%',
      maxHeight: '95%',
      borderRadius: 16,
      margin: 8
    }
  ];

  const overlayStyle: any = [
    styles.overlay,
    isMobile && { padding: 8 }
  ];

  const previewColumnStyle = isMobile ? styles.mobilePreviewColumn : styles.previewColumn;
  const controlsColumnStyle = isMobile ? styles.mobileControlsColumn : styles.controlsColumn;

  useEffect(() => {
    if (branchName) {
      setCustomBranchLabel(branchName);
    }
  }, [branchName]);

  const handlePresetSelect = (color: string) => {
    setThemeColor(color);
    setCustomColor('');
  };

  const handleCustomColorChange = (text: string) => {
    setCustomColor(text);
    if (text.startsWith('#') && (text.length === 4 || text.length === 7)) {
      setThemeColor(text);
    }
  };

  // HTML5 Canvas generation for web downloading
  const handleDownload = async () => {
    if (Platform.OS !== 'web') {
      alert("Download is currently fully supported on Web browsers.");
      return;
    }

    setIsDownloading(true);
    setErrorMessage('');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get 2D context");

      // Draw poster base
      drawPoster(ctx, canvas.width, canvas.height);

      // Load and overlay QR code image
      const img = new (globalThis as any).Image();
      img.crossOrigin = 'anonymous';
      img.src = qrCodeUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Draw QR Code centered inside its white bounding box
          let qrBoxSize = 560;
          let qrSize = 480;
          let x = (canvas.width - qrBoxSize) / 2;
          let y = 580;

          if (selectedTemplate === 'badge') {
            y = 660;
          } else if (selectedTemplate === 'minimalist') {
            y = 540;
          } else if (selectedTemplate === 'gradient') {
            y = 560;
          }

          // Shadow and white wrapper for QR Code
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 30;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 15;
          ctx.fillStyle = '#ffffff';
          
          // Round box rect
          const radius = 24;
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + qrBoxSize - radius, y);
          ctx.quadraticCurveTo(x + qrBoxSize, y, x + qrBoxSize, y + radius);
          ctx.lineTo(x + qrBoxSize, y + qrBoxSize - radius);
          ctx.quadraticCurveTo(x + qrBoxSize, y + qrBoxSize, x + qrBoxSize - radius, y + qrBoxSize);
          ctx.lineTo(x + radius, y + qrBoxSize);
          ctx.quadraticCurveTo(x, y + qrBoxSize, x, y + qrBoxSize - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Draw the QR Code image inside
          const offset = (qrBoxSize - qrSize) / 2;
          ctx.drawImage(img, x + offset, y + offset, qrSize, qrSize);

          // Asynchronously stamp brand logo at the center of the QR code
          const drawLogoIfAny = async () => {
            if (brandLogo) {
              const logoImg = new (globalThis as any).Image();
              logoImg.crossOrigin = 'anonymous';
              logoImg.src = brandLogo;

              await new Promise<void>((resLogo) => {
                logoImg.onload = () => {
                  const logoSize = qrSize * 0.22; // 22% scale is perfect
                  const logoX = x + offset + (qrSize - logoSize) / 2;
                  const logoY = y + offset + (qrSize - logoSize) / 2;
                  const cx = logoX + logoSize / 2;
                  const cy = logoY + logoSize / 2;

                  // Draw circular white box card for the logo
                  ctx.save();
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  const backingRadius = (logoSize / 2) + 6; // 6px padding border
                  ctx.arc(cx, cy, backingRadius, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();

                  // Clip drawing to a circular path for the logo itself
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
                  ctx.clip();
                  ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                  ctx.restore();

                  resLogo();
                };
                logoImg.onerror = () => {
                  resLogo(); // fallback safely
                };
              });
            }
          };

          drawLogoIfAny().then(() => {
            resolve();
          });
        };
        img.onerror = () => {
          reject(new Error("Failed to load QR code image. Please check your network connection."));
        };
      });

      // Trigger file download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${customBranchLabel.replace(/\s+/g, '_')}_QR_Review_Poster.png`;
      link.href = dataUrl;
      link.click();

      // Show sharing options sub-modal
      setSharePosterUrl(dataUrl);
      setShowShareWindow(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to generate framed download.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareSystem = async () => {
    try {
      if (Platform.OS === 'web' && navigator.share) {
        const response = await fetch(sharePosterUrl);
        const blob = await response.blob();
        const file = new File([blob], `${customBranchLabel.replace(/\s+/g, '_')}_QR_Review_Poster.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${customBranchLabel} Review QR Poster`,
            text: `Scan our QR code to review ${customBranchLabel}!`,
          });
        } else {
          await navigator.share({
            title: `${customBranchLabel} Review QR`,
            text: `Review us at ${customBranchLabel}! Link:`,
            url: qrData,
          });
        }
      } else {
        Alert.alert("Sharing is supported on mobile browsers and devices.");
      }
    } catch (err: any) {
      console.error("Error sharing poster:", err);
    }
  };

  const copyImageToClipboard = async () => {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(sharePosterUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        alert("🖼️ Review Poster copied to your clipboard!\n\nYou can now go directly to your WhatsApp or Telegram chat and paste it (Ctrl+V or Cmd+V) to send the actual image file!");
      } else {
        Alert.alert("Clipboard copy is supported on Web browsers.");
      }
    } catch (err: any) {
      console.error("Clipboard write failed:", err);
      alert("Failed to copy image automatically.\n\nAlternative: Please right-click the poster preview image above and select 'Copy Image' or 'Save Image As'!");
    }
  };

  // Drawing template backgrounds and elements onto canvas
  const drawPoster = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // 1. Draw Background
    if (selectedTemplate === 'gradient') {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, themeColor);
      gradient.addColorStop(1, themeColorEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Glassmorphic main card back
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      drawRoundedRect(ctx, 80, 80, w - 160, h - 160, 40, true, false);
    } else if (selectedTemplate === 'badge') {
      ctx.fillStyle = themeColor;
      ctx.fillRect(0, 0, w, h);

      // Top badge card
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 80, 80, w - 160, 520, 40, true, false);

      // Draw bottom brand banner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      drawRoundedRect(ctx, 80, 1420, w - 160, 100, 20, true, false);
    } else if (selectedTemplate === 'minimalist') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Thin elegant inner border
      ctx.lineWidth = 4;
      ctx.strokeStyle = themeColor;
      drawRoundedRect(ctx, 50, 50, w - 100, h - 100, 30, false, true);
    } else {
      // Classic
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Top colored banner header
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, themeColor);
      gradient.addColorStop(1, themeColorEnd);
      ctx.fillStyle = gradient;
      drawRoundedRect(ctx, 40, 40, w - 80, 420, 32, true, false);

      // White inner poster body
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 40, 440, w - 80, h - 480, 32, true, false);
    }

    // 2. Draw Texts & Stars
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (selectedTemplate === 'gradient') {
      // Headline
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(headline, w / 2, 190);

      // Stars
      if (showStars) {
        drawStarsCanvas(ctx, w / 2, 270, 38, starColor);
      }

      // Subheadline
      ctx.font = '500 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#475569';
      wrapText(ctx, subheadline, w / 2, 350, w - 200, 38);

      // Branch details at bottom
      ctx.font = '800 36px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(customBranchLabel, w / 2, 1200);

      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = themeColor;
      ctx.fillText("POWERED BY ANTIGRAVITY", w / 2, 1270);

    } else if (selectedTemplate === 'badge') {
      // Headline (drawn inside white card)
      ctx.font = '800 58px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = themeColor;
      ctx.fillText(headline, w / 2, 200);

      // Subheadline
      ctx.font = '600 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#334155';
      wrapText(ctx, subheadline, w / 2, 290, w - 240, 38);

      // Stars inside white card
      if (showStars) {
        drawStarsCanvas(ctx, w / 2, 400, 38, starColor);
      }

      // Footer texts in white
      ctx.font = '800 36px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(customBranchLabel, w / 2, 1310);

      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText("WE APPRECIATE YOUR SUPPORT", w / 2, 1370);

    } else if (selectedTemplate === 'minimalist') {
      // Headline
      ctx.font = '800 54px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = themeColor;
      ctx.fillText(headline, w / 2, 190);

      // Divider line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 150, 250);
      ctx.lineTo(w / 2 + 150, 250);
      ctx.stroke();

      // Subheadline
      ctx.font = '500 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#475569';
      wrapText(ctx, subheadline, w / 2, 320, w - 200, 38);

      // Stars
      if (showStars) {
        drawStarsCanvas(ctx, w / 2, 420, 36, starColor);
      }

      // Footer
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(customBranchLabel, w / 2, 1180);

      ctx.font = '500 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText("SCAN TO PROVIDE VALUABLE FEEDBACK", w / 2, 1240);

    } else {
      // Classic
      // Headline (Inside Banner)
      ctx.font = '800 54px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(headline, w / 2, 180);

      // Stars (Inside Banner)
      if (showStars) {
        drawStarsCanvas(ctx, w / 2, 260, 38, '#ffffff');
      }

      // Subheadline (Inside Banner)
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      wrapText(ctx, subheadline, w / 2, 1220, w - 200, 34);

      // Brand/Branch Footer
      ctx.font = '800 40px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(customBranchLabel, w / 2, 500);

      ctx.font = '500 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText("Your Opinion Matters to Us", w / 2, 1300);
    }
  };

  // Helper rounded rect canvas utility
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D, 
    x: number, y: number, w: number, h: number, 
    r: number, fill: boolean, stroke: boolean
  ) => {
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
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  // Canvas Star Drawing Function
  const drawStarsCanvas = (
    ctx: CanvasRenderingContext2D, 
    cx: number, cy: number, 
    size: number, color: string
  ) => {
    const numStars = 5;
    const spacing = size * 1.35;
    const startX = cx - (spacing * (numStars - 1)) / 2;

    ctx.fillStyle = color;
    for (let i = 0; i < numStars; i++) {
      const x = startX + i * spacing;
      ctx.save();
      ctx.translate(x, cy);
      ctx.beginPath();
      
      // Draw 5 point star path
      for (let j = 0; j < 10; j++) {
        const angle = (j * Math.PI) / 5 - Math.PI / 2;
        const r = j % 2 === 0 ? size / 2 : size / 4;
        ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  // Text Wrapping on HTML Canvas Helper
  const wrapText = (
    ctx: CanvasRenderingContext2D, 
    text: string, 
    x: number, y: number, 
    maxWidth: number, lineHeight: number
  ) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={overlayStyle}>
        {showShareWindow ? (
          <View style={[styles.container, styles.shareContainer]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Sparkles size={22} color={themeColor} />
                <Text style={styles.headerTitle}>🎉 Review Poster Ready!</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowShareWindow(false)}>
                <X size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.shareBodyContent} showsVerticalScrollIndicator={false}>
              {/* Mini visual preview card */}
              <View style={styles.sharePreviewCard}>
                <Image source={{ uri: sharePosterUrl }} style={styles.sharePreviewImage} />
                <Text style={styles.shareSuccessTitle}>Successfully Generated & Downloaded!</Text>
                <Text style={styles.shareSuccessSub}>A high-resolution poster is saved to your downloads. Send it to your team or display it for customers.</Text>
              </View>

              {/* Share Channels */}
              <Text style={styles.shareSectionHeading}>SEND TO INSTALLED MESSAGING APPS</Text>

              <View style={styles.shareButtonsGrid}>
                {/* System share */}
                {Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share && (
                  <TouchableOpacity style={[styles.shareButtonCard, { backgroundColor: themeColor }]} onPress={handleShareSystem}>
                    <View style={styles.shareButtonIconCircle}>
                      <Sparkles size={18} color="#ffffff" />
                    </View>
                    <View style={styles.shareButtonInfo}>
                      <Text style={[styles.shareButtonText, { color: '#ffffff' }]}>Share via System Apps</Text>
                      <Text style={[styles.shareButtonDesc, { color: 'rgba(255, 255, 255, 0.8)' }]}>Send directly to local WhatsApp, Slack, etc.</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Copy Image to Clipboard */}
                {Platform.OS === 'web' && (
                  <TouchableOpacity style={[styles.shareButtonCard, { borderColor: '#10b981', borderWidth: 2 }]} onPress={copyImageToClipboard}>
                    <View style={[styles.shareButtonIconCircle, { backgroundColor: '#10b981' }]}>
                      <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>📷</Text>
                    </View>
                    <View style={styles.shareButtonInfo}>
                      <Text style={[styles.shareButtonText, { color: '#10b981' }]}>Copy Poster Image File</Text>
                      <Text style={styles.shareButtonDesc}>Copy high-res circular logo poster to paste (Ctrl+V) directly in WhatsApp or Telegram</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Copy Link */}
                <TouchableOpacity 
                  style={styles.shareButtonCard} 
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      navigator.clipboard.writeText(qrData);
                      alert("Direct Review URL copied to clipboard!");
                    }
                  }}
                >
                  <View style={[styles.shareButtonIconCircle, { backgroundColor: '#cbd5e1' }]}>
                    <Check size={16} color="#0f172a" />
                  </View>
                  <View style={styles.shareButtonInfo}>
                    <Text style={styles.shareButtonText}>Copy Review Link</Text>
                    <Text style={styles.shareButtonDesc}>Copy the raw feedback form web address</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.backToEditorButton, { borderColor: themeColor }]}
                onPress={() => setShowShareWindow(false)}
              >
                <Text style={[styles.backToEditorButtonText, { color: themeColor }]}>Back to Design Customizer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          <View style={containerStyle}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={22} color={themeColor} />
              <Text style={styles.headerTitle}>QR Poster Customizer</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          <BodyContainer {...bodyProps}>
            {/* LEFT COLUMN: LIVE INTERACTIVE PREVIEW */}
            <View style={previewColumnStyle}>
              <Text style={styles.sectionLabel}>LIVE PREVIEW</Text>
              
              <View style={styles.carouselContainer}>
                <ScrollView
                  ref={carouselRef}
                  horizontal={true}
                  snapToInterval={300}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={styles.carouselScrollView}
                  contentContainerStyle={styles.carouselContentContainer}
                >
                  {/* Template 1: Classic */}
                  <View style={[styles.posterFrame, { backgroundColor: '#f1f5f9' }]}>
                    <View style={styles.classicInner}>
                      {/* Top Banner */}
                      <View style={[styles.classicHeaderBanner, { backgroundColor: themeColor }]}>
                        <Text style={styles.classicHeadline}>{headline}</Text>
                        {showStars && (
                          <View style={styles.classicStarsContainer}>
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} size={12} fill="#ffffff" color="#ffffff" style={styles.starIcon} />
                            ))}
                          </View>
                        )}
                      </View>

                      {/* White Body */}
                      <View style={styles.classicBody}>
                        <Text style={styles.classicBranchLabel}>{customBranchLabel}</Text>
                        
                        {/* Real QR Container */}
                        {renderQrWithLogo({ marginVertical: 12 })}

                        <Text style={styles.classicSubheadline}>{subheadline}</Text>
                        <Text style={styles.classicFooter}>Your Opinion Matters to Us</Text>
                      </View>
                    </View>
                  </View>

                  {/* Template 2: Gradient */}
                  <View style={[styles.posterFrame, { backgroundColor: themeColor }]}>
                    <View style={styles.gradientGlassCard}>
                      <Text style={[styles.previewHeadline, { color: '#0f172a' }]}>
                        {headline}
                      </Text>
                      
                      {showStars && (
                        <View style={styles.previewStarsContainer}>
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={15} fill={starColor} color={starColor} style={styles.starIcon} />
                          ))}
                        </View>
                      )}

                      <Text style={[styles.previewSubheadline, { color: '#475569' }]}>
                        {subheadline}
                      </Text>

                      {/* Real QR Container */}
                      {renderQrWithLogo()}

                      <Text style={[styles.previewBranchLabel, { color: '#0f172a' }]}>
                        {customBranchLabel}
                      </Text>
                      <Text style={[styles.previewFooterPower, { color: themeColor }]}>
                        POWERED BY ANTIGRAVITY
                      </Text>
                    </View>
                  </View>

                  {/* Template 3: Minimalist */}
                  <View style={[styles.posterFrame, { borderColor: themeColor, borderWidth: 2, backgroundColor: '#ffffff' }]}>
                    <View style={styles.minimalistInner}>
                      <Text style={[styles.previewHeadline, { color: themeColor }]}>
                        {headline}
                      </Text>
                      <View style={[styles.dividerLine, { backgroundColor: '#e2e8f0' }]} />
                      
                      <Text style={[styles.previewSubheadline, { color: '#475569' }]}>
                        {subheadline}
                      </Text>

                      {showStars && (
                        <View style={styles.previewStarsContainer}>
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={14} fill={starColor} color={starColor} style={styles.starIcon} />
                          ))}
                        </View>
                      )}

                      {/* Real QR Container */}
                      {renderQrWithLogo({ marginTop: 16 })}

                      <Text style={styles.minimalistBranchLabel}>
                        {customBranchLabel}
                      </Text>
                      <Text style={styles.minimalistFooter}>
                        SCAN TO SHARE YOUR THOUGHTS
                      </Text>
                    </View>
                  </View>

                  {/* Template 4: Badge */}
                  <View style={[styles.posterFrame, { backgroundColor: themeColor }]}>
                    <View style={styles.badgeLayoutInner}>
                      <View style={styles.badgeTopCard}>
                        <Text style={[styles.previewHeadline, { color: themeColor, fontSize: 18 }]}>
                           {headline}
                        </Text>
                        
                        <Text style={[styles.previewSubheadline, { color: '#475569', marginTop: 4 }]}>
                          {subheadline}
                        </Text>

                        {showStars && (
                          <View style={[styles.previewStarsContainer, { marginTop: 8 }]}>
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} size={14} fill={starColor} color={starColor} style={styles.starIcon} />
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Real QR Container */}
                      {renderQrWithLogo({ marginTop: 24 })}

                      <View style={styles.badgeBottomRow}>
                        <Text style={styles.badgeBranchLabel}>
                          {customBranchLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* SLIDER NAVIGATION & INDICATORS */}
                <View style={styles.sliderControls}>
                  <TouchableOpacity 
                    style={[styles.arrowButton, TEMPLATES.indexOf(selectedTemplate) === 0 && styles.arrowButtonDisabled]}
                    onPress={() => {
                      const idx = TEMPLATES.indexOf(selectedTemplate);
                      if (idx > 0) scrollToTemplate(idx - 1);
                    }}
                    disabled={TEMPLATES.indexOf(selectedTemplate) === 0}
                  >
                    <Text style={[styles.arrowText, TEMPLATES.indexOf(selectedTemplate) === 0 && styles.arrowTextDisabled]}>‹</Text>
                  </TouchableOpacity>

                  <View style={styles.dotsRow}>
                    {TEMPLATES.map((t, idx) => {
                      const isActive = selectedTemplate === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.dot,
                            isActive ? [styles.dotActive, { backgroundColor: themeColor }] : null
                          ]}
                          onPress={() => scrollToTemplate(idx)}
                        />
                      );
                    })}
                  </View>

                  <TouchableOpacity 
                    style={[styles.arrowButton, TEMPLATES.indexOf(selectedTemplate) === TEMPLATES.length - 1 && styles.arrowButtonDisabled]}
                    onPress={() => {
                      const idx = TEMPLATES.indexOf(selectedTemplate);
                      if (idx < TEMPLATES.length - 1) scrollToTemplate(idx + 1);
                    }}
                    disabled={TEMPLATES.indexOf(selectedTemplate) === TEMPLATES.length - 1}
                  >
                    <Text style={[styles.arrowText, TEMPLATES.indexOf(selectedTemplate) === TEMPLATES.length - 1 && styles.arrowTextDisabled]}>›</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sliderCaption}>
                  Active Theme: <Text style={{ fontWeight: '800', color: themeColor }}>{selectedTemplate.toUpperCase()}</Text> (Swipe to switch)
                </Text>
              </View>
            </View>

            {/* RIGHT COLUMN: CONTROLS & SELECTION */}
            <View style={controlsColumnStyle}>
              <ControlsScrollContainer {...controlsScrollProps}>

                {/* 1. THEME COLORS */}
                <Text style={styles.controlHeading}>1. THEME & BRAND COLOR</Text>
                <View style={styles.colorPresetRow}>
                  {PRESET_COLORS.map(preset => (
                    <TouchableOpacity
                      key={preset.name}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: preset.value },
                        themeColor === preset.value && styles.colorCircleActive
                      ]}
                      onPress={() => handlePresetSelect(preset.value)}
                    >
                      {themeColor === preset.value && (
                        <Check size={14} color="#ffffff" strokeWidth={3} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Hex Color Input */}
                <View style={styles.customColorContainer}>
                  <Text style={styles.inputLabel}>Or Enter Custom Brand Hex Code:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="#6366f1"
                    placeholderTextColor="#94a3b8"
                    value={customColor}
                    onChangeText={handleCustomColorChange}
                    maxLength={7}
                  />
                </View>

                {/* 2. HEADLINE TEXT */}
                <Text style={styles.controlHeading}>2. HEADER HEADLINE</Text>
                <TextInput
                  style={styles.textInput}
                  value={headline}
                  onChangeText={setHeadline}
                  placeholder="Scan & Review Us!"
                  placeholderTextColor="#94a3b8"
                />
                
                {/* Quick suggestions */}
                <View style={styles.suggestionsContainer}>
                  {HEADLINE_SUGGESTIONS.map(s => (
                    <TouchableOpacity 
                      key={s} 
                      style={styles.suggestionChip}
                      onPress={() => setHeadline(s)}
                    >
                      <Text style={styles.suggestionChipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 3. SUBHEADLINE TEXT */}
                <Text style={styles.controlHeading}>3. INSTRUCTION SUBTITLE</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={subheadline}
                  onChangeText={setSubheadline}
                  placeholder="Your feedback helps us grow."
                  placeholderTextColor="#94a3b8"
                  multiline={true}
                  numberOfLines={2}
                />
                
                {/* Quick suggestions */}
                <View style={styles.suggestionsContainer}>
                  {SUBHEADLINE_SUGGESTIONS.map((s, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.suggestionChip}
                      onPress={() => setSubheadline(s)}
                    >
                      <Text style={styles.suggestionChipText} numberOfLines={1}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 4. FOOTER / STORE NAME */}
                <Text style={styles.controlHeading}>4. FOOTER LABEL (BRANCH NAME)</Text>
                <TextInput
                  style={styles.textInput}
                  value={customBranchLabel}
                  onChangeText={setCustomBranchLabel}
                  placeholder="Store Location Label"
                  placeholderTextColor="#94a3b8"
                />

                {/* 5. STAR RATING DECORATION */}
                <Text style={styles.controlHeading}>5. DECORATIVE ELEMENTS</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Show 5-Star Graphics Badge</Text>
                  <TouchableOpacity
                    style={[
                      styles.toggleContainer,
                      showStars ? { backgroundColor: themeColor } : styles.toggleContainerInactive
                    ]}
                    onPress={() => setShowStars(!showStars)}
                  >
                    <View style={[
                      styles.toggleBall,
                      showStars ? styles.toggleBallRight : styles.toggleBallLeft
                    ]} />
                  </TouchableOpacity>
                </View>

                {showStars && selectedTemplate !== 'classic' && (
                  <View style={styles.starColorPickContainer}>
                    <Text style={styles.inputLabel}>Star Graphic Color:</Text>
                    <View style={styles.starColorRow}>
                      {['#fbbf24', '#f59e0b', '#dc2626', themeColor, '#0f172a'].map(color => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.starColorCircle,
                            { backgroundColor: color },
                            starColor === color && styles.starColorCircleActive
                          ]}
                          onPress={() => setStarColor(color)}
                        >
                          {starColor === color && (
                            <Check size={12} color={color === '#fbbf24' || color === '#f59e0b' ? '#000000' : '#ffffff'} strokeWidth={3} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {errorMessage ? (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}

                {/* ACTION DOWNLOAD BUTTON */}
                <TouchableOpacity
                  style={[styles.downloadButton, { backgroundColor: themeColor }]}
                  onPress={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Download size={18} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.downloadButtonText}>Download Poster (PNG)</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.downloadHelpText}>
                  Downloads a crisp, high-resolution **1200 x 1600 px** PNG poster optimized for printing and display.
                </Text>

              </ControlsScrollContainer>
            </View>
          </BodyContainer>
        </View>
      )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 960,
    height: '90%',
    maxHeight: 780,
    borderRadius: 24,
    shadowColor: '#09090b',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden'
  },
  mobileScrollView: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  mobileContentBody: {
    flexGrow: 1,
    flexDirection: 'column'
  },
  mobilePreviewColumn: {
    width: '100%',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  mobilePreviewWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%'
  },
  mobileControlsColumn: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 20
  },
  realQrImage: {
    width: 125,
    height: 125,
    borderRadius: 8,
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 10,
    letterSpacing: -0.5
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  contentBody: {
    flex: 1,
    flexDirection: 'row',
    // Fallback for smaller layouts
    flexWrap: 'wrap'
  },
  previewColumn: {
    flex: 1.1,
    minWidth: 320,
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'flex-start'
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16
  },
  carouselContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10
  },
  carouselScrollView: {
    width: 300,
    height: 400,
    alignSelf: 'center'
  },
  carouselContentContainer: {
    alignItems: 'center'
  },
  posterFrame: {
    width: 280,
    height: 380,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    padding: 18,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 10
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  arrowButtonDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.5
  },
  arrowText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
    textAlign: 'center'
  },
  arrowTextDisabled: {
    color: '#cbd5e1'
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1'
  },
  dotActive: {
    width: 18,
    borderRadius: 4
  },
  sliderCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
    letterSpacing: 0.3
  },
  gradientGlassCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  previewHeadline: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16
  },
  previewStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 2
  },
  starIcon: {
    marginHorizontal: 0.5
  },
  previewSubheadline: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 11,
    paddingHorizontal: 4
  },
  previewQrWrapper: {
    padding: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    alignSelf: 'center'
  },
  mockQrGrid: {
    width: 80,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    position: 'relative',
    padding: 2
  },
  qrCornerBlock: {
    width: 22,
    height: 22,
    borderWidth: 4,
    borderColor: '#0f172a',
    borderRadius: 3,
    backgroundColor: '#ffffff'
  },
  qrInnerBlock: {
    position: 'absolute',
    top: 32,
    left: 32,
    width: 16,
    height: 16,
    backgroundColor: '#0f172a',
    borderRadius: 2
  },
  previewBranchLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center'
  },
  previewFooterPower: {
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  
  // Badge Template Preview
  badgeLayoutInner: {
    flex: 1,
    justifyContent: 'space-between'
  },
  badgeTopCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center'
  },
  badgeBottomRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  badgeBranchLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },

  // Minimalist Preview
  minimalistInner: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 4,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dividerLine: {
    height: 2,
    width: 50,
    marginVertical: 2
  },
  minimalistBranchLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4
  },
  minimalistFooter: {
    fontSize: 6,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5
  },

  // Classic Preview
  classicInner: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-start'
  },
  classicHeaderBanner: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  classicHeadline: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center'
  },
  classicStarsContainer: {
    flexDirection: 'row',
    marginTop: 2
  },
  classicBody: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  classicBranchLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  classicSubheadline: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 11
  },
  classicFooter: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#94a3b8'
  },

  // Controls styling
  controlsColumn: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#ffffff',
    padding: 20
  },
  controlsScroll: {
    paddingBottom: 40
  },
  controlHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8
  },
  templateOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  templateGridItem: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  templateGridItemActive: {
    backgroundColor: '#ffffff'
  },
  templateGridText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  templateGridTextActive: {
    fontWeight: '800'
  },
  colorPresetRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  customColorContainer: {
    marginTop: 10
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top'
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  suggestionChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  suggestionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  toggleContainer: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center'
  },
  toggleContainerInactive: {
    backgroundColor: '#cbd5e1'
  },
  toggleBall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff'
  },
  toggleBallLeft: {
    alignSelf: 'flex-start'
  },
  toggleBallRight: {
    alignSelf: 'flex-end'
  },
  starColorPickContainer: {
    marginTop: 8
  },
  starColorRow: {
    flexDirection: 'row',
    gap: 10
  },
  starColorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  starColorCircleActive: {
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center'
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  downloadHelpText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14
  },
  // Sharing Options sub-modal styling
  shareContainer: {
    maxWidth: 500,
    height: 'auto',
    maxHeight: '90%',
    borderRadius: 24,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  shareBodyContent: {
    padding: 24,
    alignItems: 'center',
  },
  sharePreviewCard: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  sharePreviewImage: {
    width: 135,
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  shareSuccessTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 16,
    textAlign: 'center',
  },
  shareSuccessSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  shareSectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
    width: '100%',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  shareButtonsGrid: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  shareButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  shareButtonIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  shareButtonInfo: {
    flex: 1,
    marginLeft: 14,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  shareButtonDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  backToEditorButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: 'transparent',
  },
  backToEditorButtonText: {
    fontSize: 14,
    fontWeight: '800',
  }
});
