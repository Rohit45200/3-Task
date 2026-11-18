import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ImageLightbox } from '../components/ImageLightbox';
import { TaskModal } from '../components/TaskModal';
import { useTasks, type TaskInput } from '../context/TaskContext';
import type { Task, TaskPriority, TaskSortOption, TaskStatus } from '../types';

const STATUS_TABS: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-amber-700' },
  in_progress: { label: 'In Progress', className: 'text-blue-700' },
  completed: { label: 'Completed', className: 'text-emerald-700' },
};

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  high: { label: 'High priority', className: 'text-red-700 font-medium' },
  medium: { label: 'Medium priority', className: 'text-slate-600' },
  low: { label: 'Low priority', className: 'text-slate-500' },
};

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  if (status === 'in_progress') {
    return <Clock className="h-4 w-4 text-blue-600 shrink-0" />;
  }
  return <Circle className="h-4 w-4 text-amber-600 shrink-0" />;
}

export function TasksPage() {
  const location = useLocation();
  const {
    tasks,
    stats,
    categories,
    filters,
    isLoading,
    error,
    setFilters,
    resetFilters,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    cycleTaskStatus,
  } = useTasks();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { openNewTask?: boolean } | null;
    if (state?.openNewTask) {
      setEditingTask(null);
      setModalOpen(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const openCreateModal = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleSaveTask = async (payload: TaskInput, editingId?: string) => {
    setActionError(null);
    if (editingId) {
      await updateTask(editingId, payload);
    } else {
      await createTask(payload);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setActionError(null);
    try {
      await deleteTask(id);
      setConfirmDeleteId(null);
    } catch {
      setActionError('Unable to delete task. Please try again.');
    }
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.category !== 'all' ||
    filters.search.trim() !== '';

  return (
    <AppLayout onCreateTask={openCreateModal}>
      <div className="space-y-6">
        {/* Page Heading */}
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Task Manager
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Track milestones, filter priorities, and attach visual artifacts across your workflow.
          </p>
        </div>

        {/* Summary Metric Strip (Single flat elevation, hairline dividers, tabular numbers) */}
        <section
          aria-label="Task summary metrics"
          className="grid grid-cols-2 sm:grid-cols-4 bg-white rounded-xl border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
        >
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Total Tasks</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {stats.total}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Pending</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
              {stats.pending}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">In Progress</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
              {stats.inProgress}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
              {stats.completed}
            </p>
          </div>
        </section>

        {/* Filter & Search Toolbar */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Segmented Status Tabs */}
            <div
              role="tablist"
              aria-label="Filter tasks by status"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
            >
              {STATUS_TABS.map((tab) => {
                const active = filters.status === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilters({ status: tab.value })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search & Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search tasks"
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  placeholder="Search tasks..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                aria-label="Filter by priority"
                value={filters.priority}
                onChange={(e) =>
                  setFilters({ priority: e.target.value as 'all' | TaskPriority })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              <select
                aria-label="Filter by category"
                value={filters.category}
                onChange={(e) => setFilters({ category: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort tasks"
                value={filters.sort}
                onChange={(e) => setFilters({ sort: e.target.value as TaskSortOption })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Highest Priority</option>
                <option value="dueDate">Earliest Due Date</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {(error || actionError) && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError || error}</span>
            </div>
            <button
              type="button"
              onClick={fetchTasks}
              className="text-xs font-medium underline hover:no-underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Task List Container */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-200">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="p-5 animate-pulse flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {hasActiveFilters ? 'No tasks match your filters' : 'No tasks created yet'}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
                {hasActiveFilters
                  ? 'Try adjusting your search query, status tab, or category filter.'
                  : 'Create your first task to start organizing deliverables and attaching project images.'}
              </p>
              <div className="mt-5">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create First Task</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {tasks.map((task) => {
                const statusInfo = STATUS_META[task.status];
                const priorityInfo = PRIORITY_META[task.priority];
                const isCompleted = task.status === 'completed';

                return (
                  <article
                    key={task.id}
                    className="px-5 py-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => cycleTaskStatus(task)}
                        title={`Cycle status (currently ${statusInfo.label})`}
                        aria-label={`Change status of ${task.title}`}
                        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 shrink-0"
                      >
                        <StatusIcon status={task.status} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-sm font-semibold leading-snug ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h3>

                        {task.description && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                          <span className={`font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className={priorityInfo.className}>{priorityInfo.label}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-600">{task.category}</span>
                          {task.dueDate && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className="font-mono text-slate-500 tabular-nums">
                                Due {task.dueDate}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:shrink-0 pl-9 sm:pl-0">
                      {task.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({ url: task.attachmentUrl!, title: task.title })
                          }
                          title="View attached image"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                          <span>Image</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(task)}
                        aria-label={`Edit ${task.title}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      {confirmDeleteId === task.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(task.id)}
                          aria-label={`Delete ${task.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <TaskModal
        isOpen={modalOpen}
        editingTask={editingTask}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSaveTask}
      />

      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />
    </AppLayout>
  );
}
