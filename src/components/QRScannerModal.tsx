import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import {
  X,
  Camera,
  AlertCircle,
  KeyRound,
  Upload,
  RefreshCw,
  SwitchCamera,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title: string;
  instructionText?: string;
  demoTokens?: Array<{ label: string; token: string }>;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title,
  instructionText = 'Point your camera at the QR code, upload a QR image, or choose a registered identity.',
  demoTokens = [
    { label: 'Student (STU-100)', token: 'QR-STU-100-STUDENT' },
    { label: 'Student (Faiza)', token: 'QR-STU-201-FAIZA' },
    { label: 'Driver (K. Murugan)', token: 'QR-DRV-01-MURUGAN' },
    { label: 'Admin (Dharshana)', token: 'QR-ADM-110124149012' },
  ],
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerElementId = 'html5-qrcode-reader-element';

  // Load cameras & start scanner
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);

    const initTimer = setTimeout(async () => {
      try {
        const container = document.getElementById(scannerElementId);
        if (!container || !isMounted) return;

        // Clean previous instance
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            scannerRef.current.clear();
          } catch (_) {}
          scannerRef.current = null;
        }

        const html5QrCode = new Html5Qrcode(scannerElementId);
        scannerRef.current = html5QrCode;

        // 1. Enumerate available video inputs
        let devices: CameraDevice[] = [];
        try {
          devices = await Html5Qrcode.getCameras();
          if (isMounted) setCameras(devices);
        } catch (camErr) {
          console.warn('Could not enumerate cameras:', camErr);
        }

        // 2. Select preferred camera
        let cameraConfig: any = { facingMode: 'environment' };
        if (devices.length > 0) {
          // Prefer back camera if available, otherwise first camera
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          const chosen = backCam || devices[0];
          setSelectedCameraId(chosen.id);
          cameraConfig = chosen.id;
        }

        const scanSuccessCallback = (decodedText: string) => {
          if (isMounted) {
            stopScanner();
            onScanSuccess(decodedText);
          }
        };

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.max(180, Math.floor(minEdge * 0.75));
            return { width: qrEdge, height: qrEdge };
          },
          aspectRatio: 1.0,
        };

        // Try preferred camera first
        try {
          await html5QrCode.start(cameraConfig, config, scanSuccessCallback, () => {});
          if (isMounted) {
            setIsScanning(true);
            setIsInitializing(false);
          }
        } catch (firstErr) {
          console.warn('First camera start failed, attempting user camera fallback:', firstErr);
          // Fallback 1: try user-facing camera (e.g. on laptops/webcams)
          try {
            await html5QrCode.start({ facingMode: 'user' }, config, scanSuccessCallback, () => {});
            if (isMounted) {
              setIsScanning(true);
              setIsInitializing(false);
            }
          } catch (secondErr: any) {
            console.warn('Fallback camera start failed:', secondErr);
            if (isMounted) {
              setIsScanning(false);
              setIsInitializing(false);
              setErrorMsg(
                'Camera could not be started directly (laptop webcam or browser permission). You can use "Upload QR Photo" or choose a pre-registered identity below.'
              );
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setIsScanning(false);
          setIsInitializing(false);
          setErrorMsg(err.message || 'Camera initialization error');
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = () => {
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      try {
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch (_) {}
            })
            .catch(() => {});
        } else {
          try {
            scanner.clear();
          } catch (_) {}
        }
      } catch (_) {}
    }
    setIsScanning(false);
    setIsInitializing(false);
  };

  // Switch camera between front/back
  const handleSwitchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.start(
        nextCam.id,
        { fps: 10, aspectRatio: 1.0 },
        (decodedText) => {
          stopScanner();
          onScanSuccess(decodedText);
        },
        () => {}
      );
      setIsScanning(true);
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg('Failed to switch camera: ' + (e.message || String(e)));
    }
  };

  // Handle uploading / capturing QR image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMsg(null);

    try {
      // Use Html5Qrcode file scan
      let tempScanner = scannerRef.current;
      if (!tempScanner) {
        tempScanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = tempScanner;
      }

      // If active video scanning, pause it
      if (tempScanner.isScanning) {
        try {
          await tempScanner.stop();
          setIsScanning(false);
        } catch (_) {}
      }

      const decodedText = await tempScanner.scanFile(file, true);
      setIsProcessingFile(false);
      stopScanner();
      onScanSuccess(decodedText);
    } catch (fileErr: any) {
      setIsProcessingFile(false);
      setErrorMsg('Could not detect a valid QR code in this image. Please ensure the code is clear and well lit.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      stopScanner();
      onScanSuccess(manualToken.trim());
    }
  };

  const handleDemoSelect = (token: string) => {
    stopScanner();
    onScanSuccess(token);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl transition-all border border-purple-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-700 text-white shadow-md shadow-purple-600/30">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">{title}</h3>
              <p className="text-[11px] text-slate-500 font-medium">Fast, universal scanner &amp; token verification</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder Video Area */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative w-full max-w-[280px] h-[260px] overflow-hidden rounded-2xl bg-slate-950 border-2 border-purple-600 shadow-xl flex items-center justify-center text-white">
            <div id={scannerElementId} className="w-full h-full" />

            {/* Overlay during initialization / standby */}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-center">
                {isInitializing || isProcessingFile ? (
                  <>
                    <RefreshCw className="h-8 w-8 text-purple-400 animate-spin mb-2" />
                    <p className="text-xs font-semibold text-slate-200">
                      {isProcessingFile ? 'Analyzing QR image...' : 'Starting optical camera...'}
                    </p>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-purple-400 mb-2" />
                    <p className="text-xs font-bold text-slate-100">Scanner Ready</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                      Point camera or select an option below
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-2.5 text-xs text-center text-slate-600 font-medium px-2">{instructionText}</p>

          {/* Action Toolbar: Switch Camera & Upload Photo */}
          <div className="mt-3 flex items-center justify-center space-x-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition border border-purple-200"
              >
                <SwitchCamera className="h-3.5 w-3.5" />
                <span>Switch Camera</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition border border-slate-200 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-purple-700" />
              <span>Upload QR Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {errorMsg && (
            <div className="mt-3 w-full flex items-start space-x-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Quick Demo Pre-Registered Identities (1-Click Instant Login) */}
        {demoTokens && demoTokens.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span>Quick Test: Pre-Registered QR</span>
              </span>
              <span className="text-[10px] text-slate-400">1-click test</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {demoTokens.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleDemoSelect(item.token)}
                  className="px-2.5 py-2 text-left rounded-xl bg-purple-50/70 hover:bg-purple-100/90 text-purple-900 border border-purple-200 transition text-[11px] font-semibold flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{item.label}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 opacity-60 group-hover:opacity-100 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Token Input Fallback */}
        <form onSubmit={handleManualSubmit} className="mt-3 pt-3 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <KeyRound className="h-3.5 w-3.5 text-purple-600" />
            <span>Enter Registration Token / ID:</span>
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. QR-STU-100-STUDENT or STU-100"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!manualToken.trim()}
              className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 transition cursor-pointer"
            >
              Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
