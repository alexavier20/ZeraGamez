import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { normalizeOtp } from '@/features/auth/model/auth';
import {
  consumePendingAuthIntent,
  peekPendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';
import { DataError } from '@/shared/supabase/data-error';

type LoginStage = 'email' | 'code';
type Submission = 'idle' | 'request' | 'verify' | 'resend' | 'google';
type LoginField = 'email' | 'code';
type Message = {
  readonly field?: LoginField;
  readonly text: string;
  readonly type: 'error' | 'success';
} | null;

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
    void navigate(intent?.returnTo ?? '/', { replace: true });
  }, [navigate, state.status]);

  useEffect(() => {
    if (stage === 'code') codeInput.current?.focus();
  }, [stage]);

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
      emailInput.current?.focus();
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
      setMessage({
        field: 'code',
        type: 'error',
        text: 'Informe um código numérico de 6 a 10 dígitos.',
      });
      codeInput.current?.focus();
      return;
    }

    setSubmission('verify');
    setMessage(null);
    try {
      await verifyEmailCode(email, normalizedCode);
    } catch {
      setMessage({ field: 'code', type: 'error', text: genericAuthError });
      codeInput.current?.focus();
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
      codeInput.current?.focus();
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
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof DataError && error.code === 'google_provider_disabled'
            ? error.message
            : genericAuthError,
      });
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
    <main className="flex min-h-[calc(100dvh-62px)] items-center justify-center bg-app px-4 pt-8 pb-28 text-text-primary sm:min-h-[calc(100dvh-52px)] sm:pb-12 lg:py-10">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
      >
        <p className="font-heading text-sm font-medium text-text-muted">Zera GameZ</p>
        <h1
          id="login-title"
          className="mt-3 font-heading text-2xl leading-tight font-semibold sm:text-3xl"
        >
          {stage === 'email' ? 'Entrar no Zera GameZ' : 'Verificar acesso'}
        </h1>
        <div className="mt-2 min-h-12 text-sm leading-6 text-text-muted">
          {stage === 'email' ? (
            <p>Receba um código de acesso no seu e-mail</p>
          ) : (
            <>
              <p>Digite o código enviado para</p>
              <p className="break-all font-medium text-content-primary">{email}</p>
            </>
          )}
        </div>

        {stage === 'email' ? (
          <form
            aria-busy={submitting}
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void requestCode();
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="login-email">
                E-mail
              </label>
              <input
                aria-describedby={
                  message?.field === 'email' && message.type === 'error'
                    ? 'login-email-error'
                    : undefined
                }
                aria-invalid={message?.field === 'email' && message.type === 'error'}
                autoComplete="email"
                className="h-12 w-full min-w-0 rounded-lg border border-border bg-app px-3 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                disabled={unavailable}
                id="login-email"
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                ref={setEmailInput}
                type="email"
                value={email}
              />
            </div>
            <button
              className="h-12 w-full rounded-lg bg-brand text-sm font-medium text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted disabled:opacity-100"
              disabled={submitting || unavailable}
              type="submit"
            >
              {submission === 'request' ? 'Enviando código…' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form
            aria-busy={submitting}
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="login-code">
                Código de verificação
              </label>
              <input
                aria-describedby={
                  message?.field === 'code' && message.type === 'error'
                    ? 'login-code-error'
                    : undefined
                }
                aria-invalid={message?.field === 'code' && message.type === 'error'}
                autoComplete="one-time-code"
                className="h-12 w-full min-w-0 rounded-lg border border-border bg-app px-3 text-center font-heading text-xl tracking-[0.16em] tabular-nums outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                disabled={unavailable}
                id="login-code"
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => {
                  setCode(event.target.value);
                }}
                ref={codeInput}
                value={code}
              />
            </div>
            <button
              className="h-12 w-full rounded-lg bg-brand text-sm font-medium text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted disabled:opacity-100"
              disabled={submitting || unavailable}
              type="submit"
            >
              {submission === 'verify' ? 'Confirmando código…' : 'Confirmar código'}
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
        className="min-h-11 w-full rounded-lg text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || unavailable}
                onClick={() => void resendCode()}
                type="button"
              >
                {submission === 'resend' ? 'Reenviando código…' : 'Reenviar código'}
              </button>
              <button
        className="min-h-11 w-full rounded-lg text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || unavailable}
                onClick={changeEmail}
                type="button"
              >
                Alterar e-mail
              </button>
            </div>
          </form>
        )}

        <div className="mt-2 min-h-5 break-words">
          {unavailable ? (
            <p
              className="rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {state.message}
            </p>
          ) : message?.type === 'error' ? (
            <p
              className="rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-2 text-sm text-red-700"
              id={message.field === undefined ? undefined : `login-${message.field}-error`}
              role="alert"
            >
              {message.text}
            </p>
          ) : null}
          {liveMessage === null ? null : (
            <p
              aria-live="polite"
              className={submitting ? 'sr-only' : 'text-sm leading-6 text-text-muted'}
              role="status"
            >
              {liveMessage}
            </p>
          )}
        </div>

        <div
          className="mt-2 mb-6 flex items-center gap-3 text-xs text-text-muted"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>
        <button
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-app text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || unavailable}
          onClick={() => void startGoogleLogin()}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-[18px] shrink-0"
            focusable="false"
            viewBox="0 0 48 48"
          >
            <path
              fill="#FBBC05"
              d="M43.6 20.5H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.4-3.5Z"
            />
            <path
              fill="#EA4335"
              d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691Z"
            />
            <path
              fill="#34A853"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
            />
            <path
              fill="#4285F4"
              d="M43.6 20.5H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.4-3.5Z"
            />
          </svg>
          {submission === 'google' ? 'Conectando ao Google…' : 'Continuar com Google'}
        </button>
      </section>
    </main>
  );
}
