module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: false,
        strictNullChecks: false,
        noImplicitAny: false,
        noImplicitReturns: false,
        noImplicitThis: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        exactOptionalPropertyTypes: false,
        noImplicitOverride: false,
        noPropertyAccessFromIndexSignature: false,
        noUncheckedIndexedAccess: false,
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts', // Исключаем главный файл приложения
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/bot/(.*)$': '<rootDir>/src/bot/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
