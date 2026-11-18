import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import type { DatabaseSchema, PublicUser, TaskDoc, UploadDoc, UserDoc } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

let writeQueue: Promise<void> = Promise.resolve();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateSamplePng(
  filePath: string,
  width: number,
  height: number,
  palette: { bg: [number, number, number]; accent: [number, number, number]; grid: [number, number, number] }
): void {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter None
    for (let x = 0; x < width; x += 1) {
      const idx = rowStart + 1 + x * 3;
      const onGrid = x % 40 === 0 || y % 40 === 0;
      const inCard = x >= 48 && x <= width - 48 && y >= 42 && y <= height - 42;
      const inAccentBar = x >= 68 && x <= 188 && y >= 68 && y <= 84;
      const inBlock = x >= 68 && x <= width - 68 && y >= 104 && y <= height - 68 && (x + y) % 18 < 9;

      let rgb = palette.bg;
      if (inAccentBar) {
        rgb = palette.accent;
      } else if (inBlock) {
        rgb = [226, 232, 240];
      } else if (inCard) {
        rgb = [255, 255, 255];
      } else if (onGrid) {
        rgb = palette.grid;
      }
      raw[idx] = rgb[0];
      raw[idx + 1] = rgb[1];
      raw[idx + 2] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function createSeedData(): DatabaseSchema {
  const now = new Date();
  const isoOffset = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
  const dateOnlyOffset = (days: number) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);

  const demoUserId = 'usr_demo_01';
  const passwordHash = bcrypt.hashSync('Demo@1234', 10);

  const sample1Name = 'sample-wireframe-architecture.png';
  const sample2Name = 'sample-sprint-roadmap.png';

  const sample1Path = path.join(UPLOADS_DIR, sample1Name);
  const sample2Path = path.join(UPLOADS_DIR, sample2Name);

  if (!fs.existsSync(sample1Path)) {
    generateSamplePng(sample1Path, 480, 300, {
      bg: [241, 245, 249],
      accent: [37, 99, 235],
      grid: [226, 232, 240],
    });
  }

  if (!fs.existsSync(sample2Path)) {
    generateSamplePng(sample2Path, 480, 300, {
      bg: [248, 250, 252],
      accent: [22, 163, 74],
      grid: [226, 232, 240],
    });
  }

  const sample1Stat = fs.statSync(sample1Path);
  const sample2Stat = fs.statSync(sample2Path);

  const users: UserDoc[] = [
    {
      id: demoUserId,
      name: 'Alex Morgan',
      email: 'alex@taskflow.dev',
      passwordHash,
      role: 'Full Stack Developer',
      avatarUrl: null,
      createdAt: isoOffset(-10),
      updatedAt: isoOffset(-1),
    },
  ];

  const uploads: UploadDoc[] = [
    {
      id: 'upl_seed_01',
      userId: demoUserId,
      title: 'API Integration Blueprint',
      filename: sample1Name,
      originalName: 'api-integration-blueprint.png',
      mimeType: 'image/png',
      size: sample1Stat.size,
      url: `/uploads/${sample1Name}`,
      createdAt: isoOffset(-3),
    },
    {
      id: 'upl_seed_02',
      userId: demoUserId,
      title: 'Sprint Milestone Schedule',
      filename: sample2Name,
      originalName: 'sprint-milestone-schedule.png',
      mimeType: 'image/png',
      size: sample2Stat.size,
      url: `/uploads/${sample2Name}`,
      createdAt: isoOffset(-1),
    },
  ];

  const tasks: TaskDoc[] = [
    {
      id: 'tsk_seed_01',
      userId: demoUserId,
      title: 'Configure JWT authentication middleware and protected API routes',
      description: 'Verify Bearer tokens on all task and upload endpoints, returning structured 401 responses for expired sessions.',
      status: 'completed',
      priority: 'high',
      category: 'Backend',
      dueDate: dateOnlyOffset(-1),
      attachmentUrl: null,
      createdAt: isoOffset(-5),
      updatedAt: isoOffset(-2),
    },
    {
      id: 'tsk_seed_02',
      userId: demoUserId,
      title: 'Wire Axios client interceptors to React Context state',
      description: 'Attach auth headers automatically on outgoing requests and synchronize task state across dashboard views.',
      status: 'completed',
      priority: 'high',
      category: 'Frontend',
      dueDate: dateOnlyOffset(0),
      attachmentUrl: `/uploads/${sample1Name}`,
      createdAt: isoOffset(-4),
      updatedAt: isoOffset(-1),
    },
    {
      id: 'tsk_seed_03',
      userId: demoUserId,
      title: 'Build Multer image upload endpoint with MIME type and size validation',
      description: 'Restrict uploads to JPEG, PNG, WebP, and GIF under 5 MB and persist metadata alongside disk filenames.',
      status: 'in_progress',
      priority: 'high',
      category: 'Media',
      dueDate: dateOnlyOffset(1),
      attachmentUrl: `/uploads/${sample2Name}`,
      createdAt: isoOffset(-3),
      updatedAt: isoOffset(0),
    },
    {
      id: 'tsk_seed_04',
      userId: demoUserId,
      title: 'Implement client-side form validation on registration and task forms',
      description: 'Display inline field validation messages for email syntax, password complexity, and required task titles.',
      status: 'in_progress',
      priority: 'medium',
      category: 'Frontend',
      dueDate: dateOnlyOffset(2),
      attachmentUrl: null,
      createdAt: isoOffset(-2),
      updatedAt: isoOffset(0),
    },
    {
      id: 'tsk_seed_05',
      userId: demoUserId,
      title: 'Add multi-criteria task filtering and sorting controls',
      description: 'Support combined status tabs, priority filters, category selection, and keyword search across tasks.',
      status: 'pending',
      priority: 'medium',
      category: 'Database',
      dueDate: dateOnlyOffset(4),
      attachmentUrl: null,
      createdAt: isoOffset(-1),
      updatedAt: isoOffset(-1),
    },
    {
      id: 'tsk_seed_06',
      userId: demoUserId,
      title: 'Verify production Vite build and Express static asset serving',
      description: 'Run full TypeScript check and ensure uploaded images remain accessible from /uploads in production mode.',
      status: 'pending',
      priority: 'low',
      category: 'Deployment',
      dueDate: dateOnlyOffset(6),
      attachmentUrl: null,
      createdAt: isoOffset(-1),
      updatedAt: isoOffset(-1),
    },
  ];

  return { users, tasks, uploads };
}

export function ensureStorageInitialized(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

export function readDb(): DatabaseSchema {
  ensureStorageInitialized();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw) as DatabaseSchema;
}

export async function updateDb<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
  let result!: T;
  const run = async () => {
    const db = readDb();
    result = await mutator(db);
    const tmpFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  };
  writeQueue = writeQueue.then(run, run);
  await writeQueue;
  return result;
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
