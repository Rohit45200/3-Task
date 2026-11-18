import { Upload, X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiClient, extractApiError } from '../api/client';
import type { TaskInput } from '../context/TaskContext';
import type { Task, TaskPriority, TaskStatus, UploadedImage } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  editingTask: Task | null;
  onClose: () => void;
  onSubmit: (payload: TaskInput, editingId?: string) => Promise<void>;
}

const DEFAULT_CATEGORIES = ['General', 'Frontend', 'Backend', 'Database', 'Media', 'Deployment'];
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function TaskModal({ isOpen, editingTask, onClose, onSubmit }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('General');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  const [galleryImages, setGalleryImages] = useState<UploadedImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setStatus(editingTask.status);
      setPriority(editingTask.priority);
      setCategory(editingTask.category || 'General');
      setDueDate(editingTask.dueDate || '');
      setAttachmentUrl(editingTask.attachmentUrl);
    } else {
      setTitle('');
      setDescription('');
      setStatus('pending');
      setPriority('medium');
      setCategory('General');
      setDueDate('');
      setAttachmentUrl(null);
    }
    setFieldErrors({});
    setFormError(null);
    setUploadError(null);

    apiClient
      .get<{ uploads: UploadedImage[] }>('/uploads')
      .then(({ data }) => setGalleryImages(data.uploads))
      .catch(() => {});
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmed = title.trim();
    if (trimmed.length < 2 || trimmed.length > 140) {
      errors.title = 'Task title must be between 2 and 140 characters.';
    }
    if (description.trim().length > 1000) {
      errors.description = 'Description must be 1000 characters or fewer.';
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      errors.dueDate = 'Please select a valid date.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDirectImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError('Only JPG, PNG, WebP, or GIF images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be 5 MB or smaller.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', title.trim() || file.name);

    setUploadingImage(true);
    try {
      const { data } = await apiClient.post<{ upload: UploadedImage }>('/uploads', formData);
      setAttachmentUrl(data.upload.url);
      setGalleryImages((prev) => [data.upload, ...prev]);
    } catch (err) {
      setUploadError(extractApiError(err, 'Failed to upload image.').message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          category: category.trim() || 'General',
          dueDate: dueDate || null,
          attachmentUrl,
        },
        editingTask?.id
      );
      onClose();
    } catch (err) {
      const parsed = extractApiError(err, 'Unable to save task.');
      setFormError(parsed.message);
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="task-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {editingTask ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-slate-700 mb-1.5">
              Task Title <span className="text-red-600">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: '' }));
              }}
              placeholder="e.g. Connect Express upload endpoint to React gallery"
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                fieldErrors.title
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
              }`}
            />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
          </div>

          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add acceptance criteria, notes, or implementation details..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-status" className="block text-sm font-medium text-slate-700 mb-1.5">
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-slate-700 mb-1.5">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-category" className="block text-sm font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <select
                id="task-category"
                value={DEFAULT_CATEGORIES.includes(category) ? category : 'General'}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due-date" className="block text-sm font-medium text-slate-700 mb-1.5">
                Due Date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {fieldErrors.dueDate && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.dueDate}</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Image Attachment (Optional)</span>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload new image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleDirectImageUpload}
                  disabled={uploadingImage}
                  className="sr-only"
                />
              </label>
            </div>

            {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}

            {attachmentUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={attachmentUrl}
                    alt="Selected task attachment"
                    referrerPolicy="no-referrer"
                    className="h-12 w-16 rounded object-cover border border-slate-200 shrink-0"
                  />
                  <span className="text-xs text-slate-600 font-mono truncate">{attachmentUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl(null)}
                  className="text-xs font-medium text-slate-600 hover:text-red-600 px-2 py-1 shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : galleryImages.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {galleryImages.slice(0, 6).map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setAttachmentUrl(img.url)}
                    title={`Attach ${img.title}`}
                    className="group relative h-12 w-16 shrink-0 overflow-hidden rounded border border-slate-200 hover:border-blue-500 transition-colors"
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Upload a screenshot or mockup (PNG, JPG, WebP, GIF up to 5 MB).
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
