import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import * as QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function QRPage() {
  const [, setLocation] = useLocation();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Get query parameters from URL
  const params = new URLSearchParams(window.location.search);
  const shortCode = params.get("code") || "";
  const originalUrl = params.get("url") || "";
  const description = params.get("desc") || "";

  const fullUrl = `${window.location.origin}/s/${shortCode}`;

  useEffect(() => {
    if (shortCode) {
      // Generate QR code
      const generateQR = async () => {
        try {
          const url = await QRCode.toDataURL(fullUrl, {
            errorCorrectionLevel: "H",
            type: "image/png",
            margin: 1,
            width: 300,
            color: {
              dark: "#111827",
              light: "#f9fafb",
            },
          });
          setQrDataUrl(url);
          setLoading(false);
        } catch (error: any) {
          console.error("Error generating QR code:", error);
          setLoading(false);
        }
      };
      generateQR();
    }
  }, [shortCode, fullUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied to clipboard!");
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qrcode-${shortCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QR code downloaded!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Scan to Open</h1>
          <p className="text-sm text-muted-foreground">
            Use your phone camera to scan the QR code below
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          {loading ? (
            <div className="w-72 h-72 bg-secondary rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Generating QR code...</p>
              </div>
            </div>
          ) : qrDataUrl ? (
            <div className="p-4 bg-white rounded-lg shadow-sm border border-border">
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>
          ) : (
            <div className="w-72 h-72 bg-secondary rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Failed to generate QR code</p>
            </div>
          )}
        </div>

        {/* Short Code Display */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Short Link</p>
          <p className="font-mono text-lg font-semibold text-accent-blue break-all">
            {fullUrl}
          </p>
        </div>

        {/* Description */}
        {description && (
          <div className="p-3 bg-secondary/50 rounded-lg border border-border">
            <p className="text-sm text-foreground">{description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="w-full gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>

          <Button
            onClick={handleDownloadQR}
            variant="outline"
            className="w-full gap-2"
            disabled={!qrDataUrl}
          >
            <Download className="w-4 h-4" />
            Download QR
          </Button>

          {originalUrl && (
            <Button
              onClick={() => {
                if (originalUrl) window.open(originalUrl, "_blank");
              }}
              className="w-full gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Open Link
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          <p>This QR code will redirect to your link</p>
        </div>
      </Card>
    </div>
  );
}
