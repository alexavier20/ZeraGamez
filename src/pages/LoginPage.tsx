import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { normalizeOtp } from '@/features/auth/model/auth';
import {
  consumePendingAuthIntent,
  peekPendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

type LoginStage = 'email' | 'code';
type Submission = 'idle' | 'request' | 'verify' | 'resend' | 'google';
type LoginField = 'email' | 'code';
type Message =
  | { readonly field?: LoginField; readonly text: string; readonly type: 'error' | 'success' }
  | null;

const genericAuthError = 'Não foi possível concluir o acesso. Tente novamente.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingMessages: Record<Exclude<Submission, 'idle'>, string> = {
  request: 'Enviando código…',
  verify: 'Confirmando código…',
  resend: 'Reenviando código…',
  google: 'Conectando ao Google…',
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function LoginPage() {
  const { requestEmailCode, signInWithGoogle, state, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const resumedAuthentication = useRef(false);
  const emailInput = useRef<HTMLInputElement | null>(null);
  const codeInput = useRef<HTMLInputElement | null>(null);
  const focusEmailOnMount = useRef(false);
  const [stage, setStage] = useState<LoginStage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submission, setSubmission] = useState<Submission>('idle');
  const [message, setMessage] = useState<Message>(null);
  const unavailable = state.status === 'unavailable';
  const submitting = submission !== 'idle';
  const liveMessage = submitting
    ? pendingMessages[submission]
    : message?.type === 'success'
      ? message.text
      : null;

  const setEmailInput = useCallback((node: HTMLInputElement | null) => {
    emailInput.current = node;
    if (node !== null && focusEmailOnMount.current) {
      node.focus();
      focusEmailOnMount.current = false;
    }
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated' || resumedAuthentication.current) return;

    resumedAuthentication.current = true;
    const intent = peekPendingAuthIntent(sessionStorage);
    if (intent?.type === 'navigate') consumePendingAuthIntent(sessionStorage);
    navigate(intent?.returnTo ?? '/', { replace: true });
  }, [navigate, state.status]);

  const requestCode = async () => {
    if (submitting || unavailable) return;

    const normalizedEmail = normalizeEmail(email);
    if (!emailPattern.test(normalizedEmail)) {
      setMessage({ field: 'email', type: 'error', text: 'Informe um e-mail válido.' });
      emailInput.current?.focus();
      return;
    }

    setSubmission('request');
    setMessage(null);
    try {
      await requestEmailCode(normalizedEmail);
      setEmail(normalizedEmail);
      setStage('code');
    } catch {
      setMessage({ field: 'email', type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const verifyCode = async () => {
    if (submitting || unavailable) return;

    let normalizedCode: string;
    try {
      normalizedCode = normalizeOtp(code);
    } catch {
      setMessage({ field: 'code', type: 'error', text: 'Informe o código de 6 dígitos.' });
      codeInput.current?.focus();
      return;
    }

    setSubmission('verify');
    setMessage(null);
    try {
      await verifyEmailCode(email, normalizedCode);
    } catch {
      setMessage({ field: 'code', type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const resendCode = async () => {
    if (submitting || unavailable) return;

    setSubmission('resend');
    setMessage(null);
    try {
      await requestEmailCode(email);
      setMessage({ type: 'success', text: `Enviamos um novo código para ${email}.` });
    } catch {
      setMessage({ field: 'code', type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const startGoogleLogin = async () => {
    if (submitting || unavailable) return;

    setSubmission('google');
    setMessage(null);
    try {
      await signInWithGoogle(`${window.location.origin}/entrar`);
    } catch {
      setMessage({ type: 'error', text: genericAuthError });
    } finally {
      setSubmission('idle');
    }
  };

  const changeEmail = () => {
    focusEmailOnMount.current = true;
    setCode('');
    setMessage(null);
    setStage('email');
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

        {unavailable ? (
          <p className="mt-5 rounded-lg border border-brand/50 bg-filter-active px-3 py-2 text-sm" role="alert">
            {state.message}
          </p>
        ) : message?.type === 'error' ? (
          <p
            className="mt-5 rounded-lg border border-brand/50 bg-filter-active px-3 py-2 text-sm"
            id={message.field === undefined ? undefined : `login-${message.field}-error`}
            role="alert"
          >
            {message.text}
          </p>
        ) : null}
        {liveMessage === null ? null : (
          <p aria-live="polite" className="mt-5 text-sm text-text-muted" role="status">
            {liveMessage}
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
                aria-describedby={message?.field === 'email' && message.type === 'error' ? 'login-email-error' : undefined}
                aria-invalid={message?.field === 'email' && message.type === 'error'}
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-white/20 bg-app px-3 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                disabled={unavailable}
                id="login-email"
                onChange={(event) => setEmail(event.target.value)}
                ref={setEmailInput}
                type="email"
                value={email}
              />
            </div>
            <button
              className="h-12 w-full rounded-xl bg-brand font-semibold transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || unavailable}
              type="submit"
            >
              {submission === 'request' ? 'Enviando código…' : 'Enviar código'}
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
                aria-describedby={message?.field === 'code' && message.type === 'error' ? 'login-code-error' : undefined}
                aria-invalid={message?.field === 'code' && message.type === 'error'}
                autoComplete="one-time-code"
                className="h-12 w-full rounded-xl border border-white/20 bg-app px-3 text-center font-heading text-xl tracking-[0.45em] outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                disabled={unavailable}
                id="login-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value)}
                ref={codeInput}
                value={code}
              />
            </div>
            <button
              className="h-12 w-full rounded-xl bg-brand font-semibold transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || unavailable}
              type="submit"
            >
              {submission === 'verify' ? 'Confirmando código…' : 'Confirmar código'}
            </button>
            <button
              className="w-full text-sm font-semibold text-text-muted underline decoration-white/30 underline-offset-4 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || unavailable}
              onClick={() => void resendCode()}
              type="button"
            >
              {submission === 'resend' ? 'Reenviando código…' : 'Reenviar código'}
            </button>
            <button
              className="w-full text-sm font-semibold text-text-muted underline decoration-white/30 underline-offset-4 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || unavailable}
              onClick={changeEmail}
              type="button"
            >
              Alterar e-mail
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
          disabled={submitting || unavailable}
          onClick={() => void startGoogleLogin()}
          type="button"
        >
          {submission === 'google' ? 'Conectando ao Google…' : 'Continuar com Google'}
        </button>
      </section>
    </main>
  );
}
