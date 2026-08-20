"use client";

import { Camera, ScanBarcode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };

export function BarcodeScanner({ onScan, placeholder = "Scan or enter barcode" }: { onScan: (value: string) => void; placeholder?: string }) {
  const [value, setValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    let frame = 0;
    async function start() {
      try {
        const DetectorConstructor = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => Detector }).BarcodeDetector;
        if (!DetectorConstructor) throw new Error("Camera barcode detection is not supported by this browser. You can still use a USB/Bluetooth scanner or type the code.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = stream;
        if (!videoRef.current || cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new DetectorConstructor({ formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"] });
        const scanFrame = async () => {
          if (cancelled || !videoRef.current) return;
          const results = await detector.detect(videoRef.current).catch(() => []);
          const code = results[0]?.rawValue?.trim();
          if (code) {
            setValue(code);
            onScan(code);
            setCameraOpen(false);
            return;
          }
          frame = window.requestAnimationFrame(() => { void scanFrame(); });
        };
        void scanFrame();
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : "Unable to open the camera.");
        setCameraOpen(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen, onScan]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value.trim()) onScan(value.trim());
  }

  return <div className="grid gap-2">
    <form className="flex gap-2" onSubmit={submit}>
      <Input autoComplete="off" placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
      <Button aria-label="Use entered barcode" size="icon" type="submit" variant="outline"><ScanBarcode className="h-4 w-4" /></Button>
      <Button aria-label="Scan with camera" onClick={() => { setCameraError(null); setCameraOpen(true); }} size="icon" type="button" variant="outline"><Camera className="h-4 w-4" /></Button>
    </form>
    {cameraError ? <p className="text-xs text-warning">{cameraError}</p> : null}
    {cameraOpen ? <div className="relative overflow-hidden rounded-md bg-black"><video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} /><Button aria-label="Close camera" className="absolute right-2 top-2" onClick={() => setCameraOpen(false)} size="icon" type="button" variant="secondary"><X className="h-4 w-4" /></Button></div> : null}
  </div>;
}
