import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly user: AuthenticatedUser }
  | { readonly status: 'unavailable'; readonly message: string };

export interface AuthContextValue {
  readonly state: AuthState;
  readonly logoutNavigationPending: boolean;
  readonly beginLogoutNavigation: () => () => void;
  readonly requestEmailCode: AuthService['requestEmailCode'];
  readonly verifyEmailCode: AuthService['verifyEmailCode'];
  readonly signInWithGoogle: AuthService['signInWithGoogle'];
  readonly signOut: AuthService['signOut'];
}

interface AuthProviderProps {
  readonly children: React.ReactNode;
  readonly service: AuthService | null;
}

const unavailableState: AuthState = {
  status: 'unavailable',
  message: 'A autenticação ainda não está configurada.',
};

const unavailableAuthError = new Error(unavailableState.message);

function createState(user: AuthenticatedUser | null): AuthState {
  return user === null ? { status: 'anonymous' } : { status: 'authenticated', user };
}

function unavailableAction(): Promise<never> {
  return Promise.reject(unavailableAuthError);
}

const defaultAuthContext: AuthContextValue = {
  state: unavailableState,
  logoutNavigationPending: false,
  beginLogoutNavigation: () => () => undefined,
  requestEmailCode: unavailableAction,
  verifyEmailCode: unavailableAction,
  signInWithGoogle: unavailableAction,
  signOut: unavailableAction,
};

const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

export function AuthProvider({ children, service }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [logoutNavigationPending, setLogoutNavigationPending] = useState(false);
  const serviceRef = useRef(service);
  const logoutNavigationRef = useRef({ active: true, tokens: new Set<symbol>() });
  // eslint-disable-next-line react-hooks/refs -- stable callbacks must follow the latest injected service.
  serviceRef.current = service;

  useEffect(() => {
    const logoutNavigation = logoutNavigationRef.current;
    logoutNavigation.active = true;
    return () => {
      logoutNavigation.active = false;
      logoutNavigation.tokens.clear();
    };
  }, []);

  useEffect(() => {
    if (service === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auth state mirrors the external service.
      setState(unavailableState);
      return;
    }

    let active = true;
    let receivedAuthStateChange = false;
    setState({ status: 'loading' });

    const unsubscribe = service.onAuthStateChange((user) => {
      receivedAuthStateChange = true;
      if (active) setState(createState(user));
    });

    void service
      .getCurrentUser()
      .then((user) => {
        if (active && !receivedAuthStateChange) setState(createState(user));
      })
      .catch(() => {
        if (active && !receivedAuthStateChange) {
          setState({ status: 'unavailable', message: 'Não foi possível verificar sua sessão.' });
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  const requestEmailCode = useCallback<AuthService['requestEmailCode']>((email) => {
    const currentService = serviceRef.current;
    return currentService === null ? unavailableAction() : currentService.requestEmailCode(email);
  }, []);
  const verifyEmailCode = useCallback<AuthService['verifyEmailCode']>((email, token) => {
    const currentService = serviceRef.current;
    return currentService === null
      ? unavailableAction()
      : currentService.verifyEmailCode(email, token);
  }, []);
  const signInWithGoogle = useCallback<AuthService['signInWithGoogle']>((redirectTo) => {
    const currentService = serviceRef.current;
    return currentService === null
      ? unavailableAction()
      : currentService.signInWithGoogle(redirectTo);
  }, []);
  const signOut = useCallback<AuthService['signOut']>(() => {
    const currentService = serviceRef.current;
    return currentService === null ? unavailableAction() : currentService.signOut();
  }, []);

  const beginLogoutNavigation = useCallback(() => {
    const logoutNavigation = logoutNavigationRef.current;
    if (!logoutNavigation.active) return () => undefined;

    const token = Symbol('logout-navigation');
    logoutNavigation.tokens.add(token);
    setLogoutNavigationPending(true);

    return () => {
      if (!logoutNavigation.active || !logoutNavigation.tokens.delete(token)) return;
      if (logoutNavigation.tokens.size === 0) setLogoutNavigationPending(false);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      beginLogoutNavigation,
      logoutNavigationPending,
      requestEmailCode,
      signInWithGoogle,
      signOut,
      state,
      verifyEmailCode,
    }),
    [
      beginLogoutNavigation,
      logoutNavigationPending,
      requestEmailCode,
      signInWithGoogle,
      signOut,
      state,
      verifyEmailCode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
