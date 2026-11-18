import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { readDb, toPublicUser } from '../db.ts';
import type { PublicUser } from '../types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-mern-week3-dev-secret-2026';
const JWT_EXPIRES_IN = '7d';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

interface JwtPayload {
  sub: string;
  email: string;
}

export function signToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Invalid authentication token.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const db = readDb();
    const user = db.users.find((u) => u.id === decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'User account no longer exists.' });
      return;
    }
    req.user = toPublicUser(user);
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
