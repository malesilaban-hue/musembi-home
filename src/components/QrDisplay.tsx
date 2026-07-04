import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrDisplay({ value, size = 160 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    void QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }, [value, size]);
  return <canvas ref={ref} className="rounded bg-white p-1" />;
}
