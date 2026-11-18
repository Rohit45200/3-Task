import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import { newId, readDb, toPublicUser, updateDb } from '../db.ts';
import { type AuthenticatedRequest, requireAuth, signToken } from '../middleware/auth.ts';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res: Response) => {
  const { name, email, password, role } = req.body ?? {};
  const fieldErrors: Record<string, string> = {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const rawPassword = typeof password === 'string' ? password : '';
  const trimmedRole = typeof role === 'string' && role.trim() ? role.trim().slice(0, 60) : 'Developer';

  if (trimmedName.length < 2 || trimmedName.length > 80) {
    fieldErrors.name = 'Name must be between 2 and 80 characters.';
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    fieldErrors.email = 'Please enter a valid email address.';
  }
  if (rawPassword.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters.';
  } else if (!/[A-Za-z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) {
    fieldErrors.password = 'Password must include at least one letter and one number.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: 'Please fix the highlighted fields.', fieldErrors });
    return;
  }

  const db = readDb();
  const existing = db.users.find((u) => u.email === trimmedEmail);
  if (existing) {
    res.status(409).json({
      error: 'An account with this email already exists.',
      fieldErrors: { email: 'This email is already registered.' },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const now = new Date().toISOString();

  const createdUser = await updateDb((draft) => {
    const user = {
      id: newId('usr'),
      name: trimmedName,
      email: trimmedEmail,
      passwordHash,
      role: trimmedRole,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    draft.users.push(user);
    return user;
  });

  const token = signToken(createdUser);
  res.status(201).json({ token, user: toPublicUser(createdUser) });
});

router.post('/login', async (req, res: Response) => {
  const { email, password } = req.body ?? {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const rawPassword = typeof password === 'string' ? password : '';

  if (!EMAIL_REGEX.test(trimmedEmail) || !rawPassword) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const db = readDb();
  const user = db.users.find((u) => u.email === trimmedEmail);
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const matches = await bcrypt.compare(rawPassword, user.passwordHash);
  if (!matches) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const userId = req.user!.id;
  const userTasks = db.tasks.filter((t) => t.userId === userId);
  const userUploads = db.uploads.filter((u) => u.userId === userId);

  res.json({
    user: req.user,
    counts: {
      totalTasks: userTasks.length,
      completedTasks: userTasks.filter((t) => t.status === 'completed').length,
      uploads: userUploads.length,
    },
  });
});

router.patch('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, role, avatarUrl } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedRole = typeof role === 'string' ? role.trim() : '';

  if (name !== undefined && (trimmedName.length < 2 || trimmedName.length > 80)) {
    res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    return;
  }
  if (role !== undefined && trimmedRole.length > 60) {
    res.status(400).json({ error: 'Role must be 60 characters or fewer.' });
    return;
  }
  if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== 'string') {
    res.status(400).json({ error: 'Invalid avatar URL.' });
    return;
  }

  const updated = await updateDb((draft) => {
    const user = draft.users.find((u) => u.id === req.user!.id);
    if (!user) return null;
    if (name !== undefined) user.name = trimmedName;
    if (role !== undefined) user.role = trimmedRole || 'Developer';
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    user.updatedAt = new Date().toISOString();
    return toPublicUser(user);
  });

  if (!updated) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({ user: updated });
});

router.patch('/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'Current and new passwords are required.' });
    return;
  }
  if (newPassword.length < 6 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    res.status(400).json({
      error: 'New password must be at least 6 characters and include both letters and numbers.',
    });
    return;
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = await bcrypt.hash(newPassword, 10);
  await updateDb((draft) => {
    const target = draft.users.find((u) => u.id === req.user!.id);
    if (target) {
      target.passwordHash = nextHash;
      target.updatedAt = new Date().toISOString();
    }
  });

  res.json({ message: 'Password updated successfully.' });
});

export default router;
