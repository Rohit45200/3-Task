import { Router, type Response } from 'express';
import { newId, readDb, updateDb } from '../db.ts';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import type { TaskDoc, TaskPriority, TaskStatus } from '../types.ts';

const router = Router();

const VALID_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const userTasks = db.tasks.filter((t) => t.userId === req.user!.id);

  const stats = {
    total: userTasks.length,
    pending: userTasks.filter((t) => t.status === 'pending').length,
    inProgress: userTasks.filter((t) => t.status === 'in_progress').length,
    completed: userTasks.filter((t) => t.status === 'completed').length,
  };

  const categories = Array.from(new Set(userTasks.map((t) => t.category))).sort();

  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const priority = typeof req.query.priority === 'string' ? req.query.priority : 'all';
  const category = typeof req.query.category === 'string' ? req.query.category : 'all';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

  let filtered = [...userTasks];

  if (status !== 'all' && VALID_STATUSES.includes(status as TaskStatus)) {
    filtered = filtered.filter((t) => t.status === status);
  }
  if (priority !== 'all' && VALID_PRIORITIES.includes(priority as TaskPriority)) {
    filtered = filtered.filter((t) => t.priority === priority);
  }
  if (category !== 'all') {
    filtered = filtered.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search)
    );
  }

  filtered.sort((a, b) => {
    if (sort === 'oldest') {
      return a.createdAt.localeCompare(b.createdAt);
    }
    if (sort === 'priority') {
      return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || b.createdAt.localeCompare(a.createdAt);
    }
    if (sort === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  res.json({ tasks: filtered, stats, categories });
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, status, priority, category, dueDate, attachmentUrl } = req.body ?? {};
  const fieldErrors: Record<string, string> = {};

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedDesc = typeof description === 'string' ? description.trim() : '';
  const taskStatus: TaskStatus = VALID_STATUSES.includes(status) ? status : 'pending';
  const taskPriority: TaskPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
  const trimmedCategory = typeof category === 'string' && category.trim() ? category.trim().slice(0, 40) : 'General';
  const normalizedDueDate = typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim().slice(0, 10) : null;
  const normalizedAttachment =
    typeof attachmentUrl === 'string' && attachmentUrl.trim() ? attachmentUrl.trim() : null;

  if (trimmedTitle.length < 2 || trimmedTitle.length > 140) {
    fieldErrors.title = 'Task title must be between 2 and 140 characters.';
  }
  if (trimmedDesc.length > 1000) {
    fieldErrors.description = 'Description must be 1000 characters or fewer.';
  }
  if (normalizedDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDueDate)) {
    fieldErrors.dueDate = 'Due date must be in YYYY-MM-DD format.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: 'Please fix the highlighted task fields.', fieldErrors });
    return;
  }

  const now = new Date().toISOString();
  const created = await updateDb((draft) => {
    const doc: TaskDoc = {
      id: newId('tsk'),
      userId: req.user!.id,
      title: trimmedTitle,
      description: trimmedDesc,
      status: taskStatus,
      priority: taskPriority,
      category: trimmedCategory,
      dueDate: normalizedDueDate,
      attachmentUrl: normalizedAttachment,
      createdAt: now,
      updatedAt: now,
    };
    draft.tasks.push(doc);
    return doc;
  });

  res.status(201).json({ task: created });
});

async function handleUpdateTask(req: AuthenticatedRequest, res: Response) {
  const taskId = req.params.id;
  const { title, description, status, priority, category, dueDate, attachmentUrl } = req.body ?? {};
  const fieldErrors: Record<string, string> = {};

  if (title !== undefined) {
    const trimmed = typeof title === 'string' ? title.trim() : '';
    if (trimmed.length < 2 || trimmed.length > 140) {
      fieldErrors.title = 'Task title must be between 2 and 140 characters.';
    }
  }
  if (description !== undefined && typeof description === 'string' && description.length > 1000) {
    fieldErrors.description = 'Description must be 1000 characters or fewer.';
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    fieldErrors.status = 'Invalid task status.';
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    fieldErrors.priority = 'Invalid task priority.';
  }
  if (dueDate !== undefined && dueDate !== null && dueDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate))) {
    fieldErrors.dueDate = 'Due date must be in YYYY-MM-DD format.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: 'Please fix the highlighted task fields.', fieldErrors });
    return;
  }

  const updated = await updateDb((draft) => {
    const task = draft.tasks.find((t) => t.id === taskId && t.userId === req.user!.id);
    if (!task) return null;

    if (typeof title === 'string') task.title = title.trim();
    if (typeof description === 'string') task.description = description.trim();
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (typeof category === 'string' && category.trim()) task.category = category.trim().slice(0, 40);
    if (dueDate !== undefined) {
      task.dueDate = typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim().slice(0, 10) : null;
    }
    if (attachmentUrl !== undefined) {
      task.attachmentUrl = typeof attachmentUrl === 'string' && attachmentUrl.trim() ? attachmentUrl.trim() : null;
    }
    task.updatedAt = new Date().toISOString();
    return task;
  });

  if (!updated) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  res.json({ task: updated });
}

router.put('/:id', handleUpdateTask);
router.patch('/:id', handleUpdateTask);

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const taskId = req.params.id;
  const deleted = await updateDb((draft) => {
    const idx = draft.tasks.findIndex((t) => t.id === taskId && t.userId === req.user!.id);
    if (idx === -1) return false;
    draft.tasks.splice(idx, 1);
    return true;
  });

  if (!deleted) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  res.json({ deletedId: taskId });
});

export default router;
