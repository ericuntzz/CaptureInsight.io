// Custom lightweight router hook using browser History API
// This provides routing without external dependencies
// Can be replaced with React Router in production if needed

import { useState, useEffect, useCallback } from 'react';

interface RouterState {
  pathname: string;
  search: string;
  hash: string;
}

// Global listeners for popstate events
const listeners = new Set<(state: RouterState) => void>();

// Listen to browser back/forward
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

/**
 * Custom router hook that syncs with browser URL
 */
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

/**
 * Parse query string into object
 */
export function useSearchParams() {
  const { search } = useRouter();
  
  const params = new URLSearchParams(search);
  const paramsObject: Record<string, string> = {};
  
  params.forEach((value, key) => {
    paramsObject[key] = value;
  });
  
  return paramsObject;
}

/**
 * Get specific URL parameter
 */
export function useParam(paramName: string): string | null {
  const { pathname } = useRouter();
  
  // Simple parameter extraction
  // For example: /insights/:insightId would extract the ID
  const parts = pathname.split('/').filter(Boolean);
  
  // This is a simplified implementation
  // In production, use a proper routing library
  return null;
}

/**
 * Navigate to a path
 */
export function navigate(path: string) {
  window.history.pushState({}, '', path);
  const newState: RouterState = {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
  listeners.forEach(listener => listener(newState));
}

/**
 * Link component that uses pushState
 */
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
    // Allow Ctrl/Cmd+Click to open in new tab
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
