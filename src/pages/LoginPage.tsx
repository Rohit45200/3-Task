import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { extractApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const performLogin = async (targetEmail: string, targetPassword: string) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await login(targetEmail.trim(), targetPassword);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setFormError(extractApiError(err, 'Unable to sign in.').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await performLogin(email, password);
  };

  const handleDemoLogin = async () => {
    setEmail('alex@taskflow.dev');
    setPassword('Demo@1234');
    setFieldErrors({});
    await performLogin('alex@taskflow.dev', 'Demo@1234');
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2">
      {/* Left Architectural Summary */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-slate-100 p-12 xl:p-16">
        <div>
          <span className="font-display text-xl font-bold tracking-tight text-white">TaskFlow</span>
        </div>

        <div className="max-w-lg space-y-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Track tasks, manage uploads, and ship full-stack workflows.
          </h1>
          <p className="text-base leading-relaxed text-slate-300">
            A unified task management workspace powered by React, Express REST endpoints, JWT authentication, and persistent Multer media storage.
          </p>

          <dl className="grid grid-cols-1 gap-5 pt-4 border-t border-slate-800">
            <div>
              <dt className="text-sm font-semibold text-white">01. Protected Task Workspace</dt>
              <dd className="mt-1 text-sm text-slate-400">
                Create, filter, prioritize, and update tasks across real authenticated user accounts.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-white">02. Multer Image Upload Studio</dt>
              <dd className="mt-1 text-sm text-slate-400">
                Preview images before uploading, track transfer progress, and attach visual assets to tasks.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-white">03. Validated End-to-End API</dt>
              <dd className="mt-1 text-sm text-slate-400">
                Axios interceptors and Express validation keep client and server state synchronized.
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-slate-400">Full Stack Web Development Workspace</p>
      </div>

      {/* Right Sign-In Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-8">
          <div className="mb-6">
            <p className="lg:hidden font-display text-lg font-bold text-slate-900 mb-4">TaskFlow</p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sign in to your account
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Enter your credentials to access your task board and media gallery.
            </p>
          </div>

          {formError && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                }}
                placeholder="you@example.com"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                }`}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
                  }}
                  placeholder="Enter your password"
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    fieldErrors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Sign in with Demo Account
            </button>
            <p className="mt-2 text-center text-xs text-slate-500 font-mono">
              alex@taskflow.dev · Demo@1234
            </p>
          </div>

          <p className="mt-6 pt-5 border-t border-slate-200 text-center text-sm text-slate-600">
            New to TaskFlow?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
