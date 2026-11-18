import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, title, onClose }: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <p className="text-sm font-medium text-slate-900 truncate">{title || 'Image Preview'}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-slate-100 flex items-center justify-center p-4 max-h-[80vh]">
          <img
            src={imageUrl}
            alt={title || 'Uploaded preview'}
            referrerPolicy="no-referrer"
            className="max-h-[72vh] w-auto max-w-full rounded object-contain"
          />
        </div>
      </div>
    </div>
  );
}
