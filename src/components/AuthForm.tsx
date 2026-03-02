'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';

function generateChallenge() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { a, b, answer: a + b };
}

export default function AuthForm({
  initialTab = 'signin',
  redirectTo = '/',
}: {
  initialTab?: Tab;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const challenge = useMemo(() => generateChallenge(), []);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirm('');
    setCaptchaInput('');
    setError('');
    setSuccess('');
  }, [tab]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Invalid email or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !confirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (parseInt(captchaInput) !== challenge.answer) {
      setError('Incorrect answer. Please solve the math challenge.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess('Account created! Signing you in...');
      setTimeout(() => router.push(redirectTo), 1200);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not create account.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Tabs */}
      <div className="flex border-b border-zinc-700 mb-6">
        {(['signin', 'signup'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'signin' ? 'Sign In' : 'Register'}
          </button>
        ))}
      </div>

      {tab === 'signin' ? (
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-xs text-zinc-500">
            No account?{' '}
            <button
              type="button"
              onClick={() => setTab('signup')}
              className="text-amber-400 hover:underline"
            >
              Register
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Min. 6 characters"
          />
          <Field
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
          />

          {/* Math captcha */}
          <div className="bg-zinc-800 rounded-lg px-4 py-3 border border-zinc-600">
            <p className="text-zinc-300 text-xs mb-2 font-medium">
              Anti-bot check
            </p>
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-mono">
                What is {challenge.a} + {challenge.b}?
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={captchaInput}
                onChange={e =>
                  setCaptchaInput(e.target.value.replace(/\D/g, ''))
                }
                maxLength={3}
                className="w-16 bg-zinc-700 text-white text-sm text-center rounded-md py-1 px-2 border border-zinc-500 focus:outline-none focus:border-amber-500"
                placeholder="?"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-green-400 text-xs">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <p className="text-center text-xs text-zinc-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setTab('signin')}
              className="text-amber-400 hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-zinc-300 text-xs font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        className="w-full bg-zinc-800 text-white text-sm px-3 py-2.5 rounded-lg border border-zinc-600 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500 transition-colors"
      />
    </div>
  );
}
