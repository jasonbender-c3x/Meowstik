/**
 * Type definitions for NotebookLM Puppeteer Integration
 */

import { Browser, Page } from 'playwright';
import { EventEmitter } from 'events';

// ============================================================================
// Configuration Types
// ============================================================================

export interface NotebookLMOptions {
  headless?: boolean;
  cookiePath?: string;
  timeout?: number;
  userDataDir?: string;
  proxyServer?: string;
  debug?: boolean;
}

export interface AuthOptions {
  email: string;
  password: string;
  totpSecret?: string; // For 2FA
}

export interface LaunchOptions {
  headless?: boolean;
  userDataDir?: string;
  args?: string[];
}

// ============================================================================
// Source Types
// ============================================================================

export interface Source {
  type: 'file' | 'url' | 'text' | 'youtube';
  path?: string;
  url?: string;
  text?: string;
  title?: string;
}

export interface SourceInfo {
  id: string;
  type: string;
  title: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  size?: number;
  uploadedAt: Date;
}

// ============================================================================
// Notebook Types
// ============================================================================

export interface NotebookInfo {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  sourceCount: number;
}

export interface NotebookMetadata {
  id: string;
  name: string;
  sources: SourceInfo[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Content Types
// ============================================================================

export interface Answer {
  text: string;
  citations: Citation[];
  confidence?: number;
}

export interface Citation {
  source: string;
  page?: number;
  quote: string;
}

export interface Summary {
  text: string;
  keyPoints: string[];
  generatedAt: Date;
}

export interface StudyGuide {
  sections: StudySection[];
  generatedAt: Date;
}

export interface StudySection {
  title: string;
  content: string;
  subsections?: StudySection[];
}

export interface FAQ {
  question: string;
  answer: string;
  sources?: string[];
}

export interface AudioOverview {
  url: string;
  duration?: number;
  generatedAt: Date;
}

export interface Timeline {
  events: TimelineEvent[];
  generatedAt: Date;
}

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

// ============================================================================
// Selector Configuration
// ============================================================================

export interface SelectorConfig {
  primary: string;
  fallbacks: string[];
  dataTestId?: string;
  ariaLabel?: string;
}

export type SelectorMap = Record<string, SelectorConfig>;

// ============================================================================
// Error Types
// ============================================================================

export class NotebookLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'NotebookLMError';
  }
}

export class AuthenticationError extends NotebookLMError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', false);
  }
}

export class NetworkError extends NotebookLMError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', true);
  }
}

export class SelectorNotFoundError extends NotebookLMError {
  constructor(selector: string) {
    super(`Selector not found: ${selector}`, 'SELECTOR_ERROR', true);
  }
}

export class TimeoutError extends NotebookLMError {
  constructor(operation: string) {
    super(`Operation timed out: ${operation}`, 'TIMEOUT_ERROR', true);
  }
}

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  shouldRetry: (error: Error) => boolean;
}

// ============================================================================
// Conversation Context
// ============================================================================

export interface ConversationContext {
  previousQuestions: string[];
  previousAnswers: Answer[];
}

// ============================================================================
// Event Types
// ============================================================================

export interface NotebookLMEvents {
  'upload:start': (file: string) => void;
  'upload:progress': (percent: number) => void;
  'upload:complete': (source: SourceInfo) => void;
  'upload:error': (error: Error) => void;
  'query:start': (question: string) => void;
  'query:response': (answer: Answer) => void;
  'query:error': (error: Error) => void;
  'generation:start': (type: string) => void;
  'generation:complete': (content: any) => void;
  'generation:error': (error: Error) => void;
}
