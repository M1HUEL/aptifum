import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getInitialTheme } from './theme';

describe('theme', () => {
  let matchMediaMock: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    matchMediaMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => matchMediaMock),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns light when no preference is stored and the system prefers light', () => {
    expect(getInitialTheme()).toBe('light');
  });

  it('returns dark when no preference is stored and the system prefers dark', () => {
    matchMediaMock.matches = true;
    expect(getInitialTheme()).toBe('dark');
  });

  it('prefers the stored theme over the system preference', () => {
    matchMediaMock.matches = false;
    localStorage.setItem('aptifum.theme', 'dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('falls back to the system preference for invalid stored values', () => {
    matchMediaMock.matches = true;
    localStorage.setItem('aptifum.theme', 'blue');
    expect(getInitialTheme()).toBe('dark');
  });

  it('applyTheme dark adds the dark class to the root element', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applyTheme light removes the dark class from the root element', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
