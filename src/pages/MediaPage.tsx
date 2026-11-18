import { Check, Copy, Maximize2, Trash2, Upload } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { apiClient, extractApiError } from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { ImageLightbox } from '../components/ImageLightbox';
import type { UploadedImage } from '../types';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MediaPage() {
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await apiClient.get<{ uploads: UploadedImage[] }>('/uploads');
      setUploads(data.uploads);
    } catch (err) {
      setFetchError(extractApiError(err, 'Unable to load uploaded images.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectCandidateFile = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError('Only JPG, PNG, WebP, and GIF images are supported.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('Image exceeds the 5 MB maximum upload limit.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    selectCandidateFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    selectCandidateFile(e.dataTransfer.files?.[0]);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setTitle('');
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select an image file first.');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('title', title.trim() || selectedFile.name);

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const { data } = await apiClient.post<{ upload: UploadedImage }>('/uploads', formData, {
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      });
      setUploads((prev) => [data.upload, ...prev]);
      clearSelection();
    } catch (err) {
      setUploadError(extractApiError(err, 'Image upload failed.').message);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUrl = async (item: UploadedImage) => {
    const absoluteUrl = `${window.location.origin}${item.url}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/uploads/${id}`);
      setUploads((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setFetchError(extractApiError(err, 'Unable to delete image.').message);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Media Gallery
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload, preview, and manage image assets stored via the Express Multer endpoint.
          </p>
        </div>

        {/* Upload Zone */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
              }`}
            >
              <input
                id="media-upload-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="sr-only"
              />

              {previewUrl && selectedFile ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5">
                    <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={previewUrl}
                        alt="Local preview before upload"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-7 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Selected File · {formatBytes(selectedFile.size)} · {selectedFile.type}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="upload-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Image Title
                      </label>
                      <input
                        id="upload-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Describe this uploaded image"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    {uploading && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Uploading to Express server...</span>
                          <span className="font-mono tabular-nums">{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-blue-600 transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={uploading}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="media-upload-input"
                  className="flex flex-col items-center justify-center text-center cursor-pointer py-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 mb-3">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Click to select an image or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    PNG, JPG, WebP, or GIF up to 5 MB · Instant client preview before upload
                  </p>
                </label>
              )}
            </div>

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}
          </form>
        </section>

        {fetchError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* Gallery Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Uploaded Assets
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {uploads.length} {uploads.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse space-y-3">
                  <div className="aspect-[16/10] w-full rounded-lg bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
              <h4 className="font-display text-base font-semibold text-slate-900">
                No uploaded images yet
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                Select an image above to preview it and save it to the server.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {uploads.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-200 overflow-hidden group">
                    <img
                      src={item.url}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxImage({ url: item.url, title: item.title })}
                      aria-label={`Preview ${item.title}`}
                      className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 border border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums truncate">
                        {formatBytes(item.size)} · {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied URL</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Delete ${item.title}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />
    </AppLayout>
  );
}
