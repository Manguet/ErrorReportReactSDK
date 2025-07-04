import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock fetch
global.fetch = jest.fn();

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    language: 'en-US',
    onLine: true,
  },
  writable: true,
});

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    pathname: '/',
    hostname: 'localhost',
  },
  writable: true,
});

// Mock performance
Object.defineProperty(window, 'performance', {
  value: {
    getEntriesByType: jest.fn().mockReturnValue([
      {
        name: 'navigation',
        domContentLoadedEventStart: 100,
        domContentLoadedEventEnd: 200,
        loadEventStart: 300,
        loadEventEnd: 400,
        domInteractive: 150,
      }
    ]),
  },
  writable: true,
});

// Mock console to avoid noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});