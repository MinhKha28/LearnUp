// Re-export core framework-neutral interfaces and utilities (usable by Next.js & NestJS)
export * from './core';

// Note: NestJS specific adapters can be imported from '@learnup/common-ts/adapters/nestjs'
// or used via direct adapter imports.
export * as NestJsAdapters from './adapters/nestjs';
