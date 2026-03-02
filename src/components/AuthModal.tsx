'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';

function generateChallenge() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { a, b, answer: a + b };
}

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

export default function AuthModal({ initialTab = 'signin', onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const challenge = useMemo(() => generateChallenge(), []);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirm('');
    setCaptchaInput('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirm(false);
  }, [tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
      onClose();
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
      setSuccess('Account created! You can now sign in.');
      setTimeout(() => setTab('signin'), 1600);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not create account.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '26rem',
          background:
            'linear-gradient(160deg, #1c1917 0%, #18181b 60%, #1a1a1f 100%)',
          border: '1px solid #44403c',
          borderRadius: '1.25rem',
          boxShadow:
            '0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,191,36,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Amber glow top accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent, #f59e0b, transparent)',
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'transparent',
            border: '1px solid #3f3f46',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#27272a';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
          }}
          title="Close"
        >
          ✕
        </button>

        {/* Logo + heading */}
        <div style={{ padding: '2rem 2rem 1.25rem', textAlign: 'center' }}>
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.875rem',
              boxShadow: '0 0 20px rgba(245,158,11,0.35)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <h2
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.2rem',
              margin: 0,
            }}
          >
            OSRS Road
          </h2>
          <p
            style={{
              color: '#71717a',
              fontSize: '0.75rem',
              marginTop: '0.3rem',
            }}
          >
            {tab === 'signin'
              ? 'Welcome back, adventurer'
              : 'Begin your journey'}
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #27272a',
            margin: '0 1.5rem',
            gap: '0.25rem',
          }}
        >
          {(['signin', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '0.65rem 0',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t ? '#f59e0b' : '#71717a',
                borderBottom:
                  tab === t ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all .2s',
                marginBottom: '-1px',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div style={{ padding: '1.5rem 1.5rem 2rem' }}>
          {tab === 'signin' ? (
            <form
              onSubmit={handleSignIn}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                icon="✉"
              />
              <InputField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                icon="🔒"
                toggleVisible={() => setShowPassword(v => !v)}
                visible={showPassword}
              />

              {error && <ErrorMsg msg={error} />}

              <SubmitButton
                loading={loading}
                label="Sign In"
                loadingLabel="Signing in..."
              />

              <p
                style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: '#71717a',
                  marginTop: '0.25rem',
                }}
              >
                No account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  Register
                </button>
              </p>
            </form>
          ) : (
            <form
              onSubmit={handleSignUp}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                icon="✉"
              />
              <InputField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="Min. 6 characters"
                icon="🔒"
                toggleVisible={() => setShowPassword(v => !v)}
                visible={showPassword}
              />
              <InputField
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••"
                icon="🔒"
                toggleVisible={() => setShowConfirm(v => !v)}
                visible={showConfirm}
              />

              {/* Captcha */}
              <div
                style={{
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '0.75rem',
                  padding: '0.875rem 1rem',
                }}
              >
                <p
                  style={{
                    color: '#a1a1aa',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}
                >
                  🛡 Anti-bot check
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      color: '#e4e4e7',
                      fontSize: '0.95rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                    }}
                  >
                    {challenge.a} + {challenge.b} =
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={captchaInput}
                    onChange={e =>
                      setCaptchaInput(e.target.value.replace(/\D/g, ''))
                    }
                    maxLength={3}
                    placeholder="?"
                    style={{
                      width: '3.5rem',
                      background: '#27272a',
                      color: '#fff',
                      border: '1px solid #52525b',
                      borderRadius: '0.5rem',
                      padding: '0.4rem 0.5rem',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: 700,
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#f59e0b';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = '#52525b';
                    }}
                  />
                </div>
              </div>

              {error && <ErrorMsg msg={error} />}
              {success && (
                <div
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.875rem',
                  }}
                >
                  <p
                    style={{ color: '#4ade80', fontSize: '0.75rem', margin: 0 }}
                  >
                    ✓ {success}
                  </p>
                </div>
              )}

              <SubmitButton
                loading={loading}
                label="Create Account"
                loadingLabel="Creating account..."
              />

              <p
                style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: '#71717a',
                  marginTop: '0.25rem',
                }}
              >
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  Sign In
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Sub-components ─────────────────────────────────── */

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  toggleVisible,
  visible,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
  toggleVisible?: () => void;
  visible?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label
        style={{
          color: '#a1a1aa',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#27272a',
          border: `1px solid ${focused ? '#f59e0b' : '#3f3f46'}`,
          borderRadius: '0.625rem',
          overflow: 'hidden',
          transition: 'border-color .15s',
          boxShadow: focused ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
        }}
      >
        {icon && (
          <span
            style={{
              padding: '0 0 0 0.875rem',
              fontSize: '0.85rem',
              opacity: 0.5,
            }}
          >
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={type === 'password' ? 'current-password' : 'email'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.875rem',
            padding: '0.7rem 0.875rem',
          }}
        />
        {toggleVisible && (
          <button
            type="button"
            onClick={toggleVisible}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0.875rem',
              color: '#71717a',
              fontSize: '0.8rem',
            }}
          >
            {visible ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '0.5rem',
        padding: '0.6rem 0.875rem',
      }}
    >
      <p style={{ color: '#f87171', fontSize: '0.75rem', margin: 0 }}>
        ⚠ {msg}
      </p>
    </div>
  );
}

function SubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '0.75rem',
        background: loading ? '#92400e' : hovered ? '#fbbf24' : '#f59e0b',
        border: 'none',
        borderRadius: '0.625rem',
        color: '#1c1917',
        fontWeight: 700,
        fontSize: '0.875rem',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background .15s',
        boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
        letterSpacing: '0.02em',
      }}
    >
      {loading ? (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              width: '0.875rem',
              height: '0.875rem',
              borderRadius: '50%',
              border: '2px solid #1c1917',
              borderTopColor: 'transparent',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
