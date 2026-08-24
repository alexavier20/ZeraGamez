import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import {
  consumePendingAuthIntent,
  peekPendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

type LoginStage = 'email' | 'code';
type Submission = 'idle' | 'submitting';
type Message = { readonly text: string; readonly type: 'error' | 'success' } | null;

const genericAuthError = 'Não foi possível concluir o acesso. Tente novamente.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function LoginPage() {
  const { requestEmailCode, signInWithGoogle, state, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const resumedAuthentication = useRef(false);
  const [stage, setStage] = useState<LoginStage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submission, setSubmission] = useState<Submission>('idle');
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (state.status !== 'authenticated' || resumedAuthentication.current) return;

    resumedAuthentication.current = true;
    const intent = peekPendingAuthIntent(sessionStorage);
    if (intent?.type === 'navigate') consumePendingAuthIntent(sessionStorage);
    navigate(intent?.returnTo ?? '/', { replace: true });
  }, [navigate, state.status]);

  const requestCode = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!emailPattern.test(normalizedEmail)) {
      setMessage({ type: 'error', text: 'Informe um e-mail válido.' });
      return;
    }

    setSubmission('submitting');
    setMessage(null);
    try {
      await requestEmailCode(normalizedEmail);
      setEmail(normalizedEmail);
      setStage('code');
    } catch {
      setMessage({ type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setMessage({ type: 'error', text: 'Informe o código de 6 dígitos.' });
      return;
    }

    setSubmission('submitting');
    setMessage(null);
    try {
      await verifyEmailCode(email, code);
    } catch {
      setMessage({ type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const resendCode = async () => {
    setSubmission('submitting');
    setMessage(null);
    try {
      await requestEmailCode(email);
      setMessage({ type: 'success', text: `Enviamos um novo código para ${email}.` });
    } catch {
      setMessage({ type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const startGoogleLogin = async () => {
    setSubmission('submitting');
    setMessage(null);
    try {
      await signInWithGoogle(`${window.location.origin}/entrar`);
    } catch {
      setMessage({ type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-10 text-text-primary">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl sm:p-8">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-brand-bright">
          Zera GameZ
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold">Entre para continuar</h1>
        <p className="mt-2 text-text-muted">
          {stage === 'email'
            ? 'Receba um código de acesso no seu e-mail.'
            : `Digite o código enviado para ${email}.`}
        </p>

        {message === null ? null : message.type === 'error' ? (
          <p className="mt-5 rounded-lg border border-brand/50 bg-filter-active px-3 py-2 text-sm" role="alert">
            {message.text}
          </p>
        ) : (
          <p className="mt-5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm" role="status">
            {message.text}
          </p>
        )}

        {stage === 'email' ? (
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void requestCode();
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="login-email">
                E-mail
              </label>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-white/20 bg-app px-3 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                id="login-email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <button
              className="h-12 w-full rounded-xl bg-brand font-semibold transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submission === 'submitting'}
              type="submit"
            >
              Enviar código
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="login-code">
                Código de verificação
              </label>
              <input
                autoComplete="one-time-code"
                className="h-12 w-full rounded-xl border border-white/20 bg-app px-3 text-center font-heading text-xl tracking-[0.45em] outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                id="login-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                value={code}
              />
            </div>
            <button
              className="h-12 w-full rounded-xl bg-brand font-semibold transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submission === 'submitting'}
              type="submit"
            >
              Confirmar código
            </button>
            <button
              className="w-full text-sm font-semibold text-text-muted underline decoration-white/30 underline-offset-4 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submission === 'submitting'}
              onClick={() => void resendCode()}
              type="button"
            >
              Reenviar código
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-white/15" />
          ou
          <span className="h-px flex-1 bg-white/15" />
        </div>
        <button
          className="h-12 w-full rounded-xl border border-white/25 bg-app font-semibold transition-colors hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submission === 'submitting'}
          onClick={() => void startGoogleLogin()}
          type="button"
        >
          Continuar com Google
        </button>
      </section>
    </main>
  );
}
