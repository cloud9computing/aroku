import React, { useRef, useState, useEffect, useCallback } from 'react';
import { IconCamera, IconFileUpload, IconRefresh, IconSwitchHorizontal, IconX } from '@tabler/icons-react';

interface LiveCameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export const LiveCameraCapture: React.FC<LiveCameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setCameraError(null);
    setIsStreaming(false);

    // Progressive fallback constraint list
    const constraintTiers: MediaStreamConstraints[] = [
      // Tier 1: Ideal facingMode and high res
      {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      // Tier 2: Just facingMode
      {
        video: {
          facingMode: facing,
        },
        audio: false,
      },
      // Tier 3: Any available video camera (laptop webcam, fallback)
      {
        video: true,
        audio: false,
      },
    ];

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintTiers) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (activeStream) {
      streamRef.current = activeStream;
      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play().catch(() => {});
        setIsStreaming(true);
      }

      // Check for torch capability
      try {
        const track = activeStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities && 'torch' in capabilities) {
          setFlashSupported(true);
        }
      } catch (e) {}
    } else {
      console.warn('All camera constraint tiers failed:', lastError);
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was blocked. You can grant access in browser settings or use the system camera below.');
      } else {
        setCameraError('Direct video stream is unavailable on this device. Use your device camera below.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode, startCamera]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !flashOn }],
      });
      setFlashOn(!flashOn);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    onCapture(base64);
  };

  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      onCapture(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between overflow-hidden">
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),16px)] pb-3 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-all"
        >
          <IconX size={20} />
        </button>

        <span className="text-white text-xs font-medium tracking-wide uppercase">
          Align Document in Frame
        </span>

        {flashSupported ? (
          <button
            onClick={toggleTorch}
            className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md active:scale-95 transition-all ${
              flashOn ? 'bg-ochre text-white' : 'bg-white/20 text-white'
            }`}
          >
            ⚡
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Live Video Feed / Viewfinder */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        {cameraError ? (
          <div className="p-6 text-center text-white max-w-xs space-y-4 z-20">
            <div className="w-12 h-12 rounded-full bg-white/10 text-ochre flex items-center justify-center mx-auto">
              <IconCamera size={24} />
            </div>
            <p className="text-xs leading-relaxed text-gray-200">{cameraError}</p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => fallbackInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-terracotta text-white text-xs font-medium rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <IconCamera size={16} /> Open Native Camera
              </button>

              <button
                onClick={onCancel}
                className="w-full py-2 px-4 bg-white/20 text-white text-xs rounded-xl hover:bg-white/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Document Guide Frame Overlay */}
            <div className="absolute inset-x-8 inset-y-16 border-2 border-white/60 rounded-2xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex flex-col justify-between p-3">
              <div className="flex justify-between">
                <span className="w-4 h-4 border-t-2 border-l-2 border-white" />
                <span className="w-4 h-4 border-t-2 border-r-2 border-white" />
              </div>
              <div className="flex justify-between">
                <span className="w-4 h-4 border-b-2 border-l-2 border-white" />
                <span className="w-4 h-4 border-b-2 border-r-2 border-white" />
              </div>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          type="file"
          ref={fallbackInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraFile}
          className="hidden"
        />
      </div>

      {/* Bottom Controls */}
      {!cameraError && (
        <div className="w-full flex items-center justify-around px-8 pb-[max(env(safe-area-inset-bottom,0px),24px)] pt-4 z-10 bg-gradient-to-t from-black/80 to-transparent">
          {/* Native photo picker fallback */}
          <button
            onClick={() => fallbackInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-all"
            title="Upload from gallery or take native photo"
          >
            <IconFileUpload size={20} />
          </button>

          {/* Shutter Button */}
          <button
            onClick={takePhoto}
            disabled={!isStreaming}
            className="w-18 h-18 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-90 transition-transform shadow-lg disabled:opacity-50"
            aria-label="Capture photo"
          >
            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
              <IconCamera size={26} className="text-ink-900" />
            </div>
          </button>

          {/* Flip Camera Button */}
          <button
            onClick={toggleCamera}
            className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-all"
            title="Flip camera"
          >
            <IconSwitchHorizontal size={22} />
          </button>
        </div>
      )}
    </div>
  );
};
