import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  token: string;
  refreshSecondsLeft?: number;
  onRefresh?: () => void;
  isDynamic?: boolean;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  token,
  refreshSecondsLeft,
  onRefresh,
  isDynamic = false,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      QRCode.toDataURL(token, {
        width: 320,
        margin: 2,
        color: {
          dark: '#3B1E78',
          light: '#FFFFFF',
        },
      })
        .then((url) => setDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [token]);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl transition-all border border-purple-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-5 flex flex-col items-center justify-center">
          <div className="rounded-xl border-4 border-purple-500/30 p-2 shadow-inner bg-white">
            {dataUrl ? (
              <img src={dataUrl} alt="QR Code" className="h-60 w-60 object-contain rounded-lg" />
            ) : (
              <div className="flex h-60 w-60 items-center justify-center text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          {isDynamic && refreshSecondsLeft !== undefined && (
            <div className="mt-3 flex items-center space-x-2 text-xs font-medium text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Token refreshes in {refreshSecondsLeft}s</span>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="ml-1 text-purple-900 font-semibold underline hover:text-purple-600"
                >
                  Refresh now
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-600 truncate max-w-[210px]">{token}</span>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          {isDynamic
            ? 'Students scan this QR using their mobile camera to mark boarding attendance.'
            : 'Pre-registered secure identity QR for authentication.'}
        </p>
      </div>
    </div>
  );
};
