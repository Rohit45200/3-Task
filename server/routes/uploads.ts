import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { newId, readDb, updateDb, UPLOADS_DIR } from '../db.ts';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import type { UploadDoc } from '../types.ts';

const router = Router();

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.png';
    const baseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32);
    const suffix = crypto.randomBytes(4).toString('hex');
    cb(null, `${Date.now()}-${suffix}-${baseName || 'image'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const uploads = db.uploads
    .filter((u) => u.userId === req.user!.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ uploads });
});

router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'Image file size must be 5 MB or smaller.' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: 'Only JPG, PNG, WebP, and GIF images are supported.' });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Please select an image file to upload.' });
      return;
    }

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const fallbackTitle = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const title = (rawTitle || fallbackTitle || 'Uploaded image').slice(0, 100);

    const record = await updateDb((draft) => {
      const doc: UploadDoc = {
        id: newId('upl'),
        userId: req.user!.id,
        title,
        filename: req.file!.filename,
        originalName: req.file!.originalname,
        mimeType: req.file!.mimetype,
        size: req.file!.size,
        url: `/uploads/${req.file!.filename}`,
        createdAt: new Date().toISOString(),
      };
      draft.uploads.push(doc);
      return doc;
    });

    res.status(201).json({ upload: record });
  }
);

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const uploadId = req.params.id;
  const removed = await updateDb((draft) => {
    const idx = draft.uploads.findIndex((u) => u.id === uploadId && u.userId === req.user!.id);
    if (idx === -1) return null;
    const [target] = draft.uploads.splice(idx, 1);
    return target;
  });

  if (!removed) {
    res.status(404).json({ error: 'Uploaded image not found.' });
    return;
  }

  const diskPath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }

  res.json({ deletedId: uploadId });
});

export default router;
