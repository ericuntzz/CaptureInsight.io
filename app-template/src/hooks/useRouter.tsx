import { useState, useEffect, useCallback } from 'react';

interface RouterState {
  pathname: string;
  search: string;
  hash: string;
}

const listeners = new Set<(state: RouterState) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const state: RouterState = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
    listeners.forEach(listener => listener(state));
  });
}

export function useRouter() {
  const [state, setState] = useState<RouterState>({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  });

  useEffect(() => {
    const listener = (newState: RouterState) => {
      setState(newState);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const push = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    const newState: RouterState = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
    setState(newState);
    listeners.forEach(listener => listener(newState));
  }, []);

  const replace = useCallback((path: string) => {
    window.history.replaceState({}, '', path);
    const newState: RouterState = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
    setState(newState);
    listeners.forEach(listener => listener(newState));
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  const forward = useCallback(() => {
    window.history.forward();
  }, []);

  return {
    pathname: state.pathname,
    search: state.search,
    hash: state.hash,
    push,
    replace,
    back,
    forward,
  };
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  const newState: RouterState = {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
  listeners.forEach(listener => listener(newState));
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    onClick?.(e);
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
