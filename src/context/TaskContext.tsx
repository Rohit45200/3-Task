import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient, extractApiError } from '../api/client';
import type { Task, TaskFilters, TaskPriority, TaskStats, TaskStatus } from '../types';
import { useAuth } from './AuthContext';

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate: string | null;
  attachmentUrl: string | null;
}

interface TaskContextValue {
  tasks: Task[];
  stats: TaskStats;
  categories: string[];
  filters: TaskFilters;
  isLoading: boolean;
  error: string | null;
  setFilters: (updater: Partial<TaskFilters> | ((prev: TaskFilters) => TaskFilters)) => void;
  resetFilters: () => void;
  fetchTasks: () => Promise<void>;
  createTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, input: Partial<TaskInput>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  cycleTaskStatus: (task: Task) => Promise<void>;
}

const DEFAULT_FILTERS: TaskFilters = {
  status: 'all',
  priority: 'all',
  category: 'all',
  search: '',
  sort: 'newest',
};

const EMPTY_STATS: TaskStats = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>(EMPTY_STATS);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFiltersState] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const setFilters = useCallback(
    (updater: Partial<TaskFilters> | ((prev: TaskFilters) => TaskFilters)) => {
      setFiltersState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([]);
      setStats(EMPTY_STATS);
      setCategories([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<{
        tasks: Task[];
        stats: TaskStats;
        categories: string[];
      }>('/tasks', {
        params: {
          status: filters.status,
          priority: filters.priority,
          category: filters.category,
          search: filters.search,
          sort: filters.sort,
        },
      });
      setTasks(data.tasks);
      setStats(data.stats);
      setCategories(data.categories);
    } catch (err) {
      setError(extractApiError(err, 'Unable to load tasks.').message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(
    async (input: TaskInput) => {
      const { data } = await apiClient.post<{ task: Task }>('/tasks', input);
      await fetchTasks();
      return data.task;
    },
    [fetchTasks]
  );

  const updateTask = useCallback(
    async (id: string, input: Partial<TaskInput>) => {
      const { data } = await apiClient.patch<{ task: Task }>(`/tasks/${id}`, input);
      await fetchTasks();
      return data.task;
    },
    [fetchTasks]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
      await fetchTasks();
    },
    [fetchTasks]
  );

  const cycleTaskStatus = useCallback(
    async (task: Task) => {
      const nextStatus: TaskStatus =
        task.status === 'pending'
          ? 'in_progress'
          : task.status === 'in_progress'
            ? 'completed'
            : 'pending';
      await updateTask(task.id, { status: nextStatus });
    },
    [updateTask]
  );

  return (
    <TaskContext.Provider
      value={{
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
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return ctx;
}
