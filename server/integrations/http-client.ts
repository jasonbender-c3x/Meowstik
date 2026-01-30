/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     HTTP CLIENT INTEGRATION MODULE                        ║
 * ║                   Meowstik - Direct HTTP Access                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides direct HTTP client capabilities for advanced web
 * interactions, API integrations, and automated data exchange.
 * 
 * AVAILABLE OPERATIONS:
 * - httpGet: Perform HTTP GET requests with headers and query params
 * - httpPost: Perform HTTP POST requests with headers and body
 * - httpPut: Perform HTTP PUT requests with headers and body
 * 
 * SECURITY CONSIDERATIONS:
 * - All requests timeout after 30 seconds by default
 * - Response size is limited to prevent memory issues
 * - HTTPS is recommended for sensitive data
 * - Headers are validated to prevent injection attacks
 * 
 * @module http-client
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP
 */

import { Buffer } from 'buffer';

export interface HttpGetOptions {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number; // in milliseconds, default: 30000
}

export interface HttpPostOptions {
  url: string;
  headers?: Record<string, string>;
  body: string | Record<string, unknown>;
  timeout?: number; // in milliseconds, default: 30000
}

export interface HttpPutOptions {
  url: string;
  headers?: Record<string, string>;
  body: string | Record<string, unknown>;
  timeout?: number; // in milliseconds, default: 30000
}

export interface HttpResponse {
  success: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  contentType?: string;
  error?: string;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate URL to ensure it's properly formatted
 */
function validateUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are supported');
    }
  } catch (error: any) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

/**
 * Sanitize headers to prevent injection attacks
 */
function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) return {};
  
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    // Remove control characters and newlines
    const cleanKey = key.replace(/[\r\n\x00-\x1F]/g, '');
    const cleanValue = value.replace(/[\r\n\x00-\x1F]/g, '');
    if (cleanKey && cleanValue) {
      sanitized[cleanKey] = cleanValue;
    }
  }
  return sanitized;
}

/**
 * Build URL with query parameters
 */
function buildUrlWithParams(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }
  
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    urlObj.searchParams.append(key, value);
  }
  return urlObj.toString();
}

/**
 * Parse response based on content type
 */
async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  
  // Check response size
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
    throw new Error(`Response size exceeds maximum allowed (${MAX_RESPONSE_SIZE / 1024 / 1024}MB)`);
  }
  
  if (contentType.includes('application/json')) {
    return await response.json();
  } else if (contentType.includes('text/')) {
    return await response.text();
  } else {
    // For binary data, return base64 encoded string
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error(`Response size exceeds maximum allowed (${MAX_RESPONSE_SIZE / 1024 / 1024}MB)`);
    }
    return Buffer.from(buffer).toString('base64');
  }
}

/**
 * Convert Response headers to plain object
 */
function convertHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Create standardized HTTP response object
 */
function createHttpResponse(response: Response, data: unknown): HttpResponse {
  return {
    success: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: convertHeaders(response.headers),
    contentType: response.headers.get('content-type') || undefined,
    data,
    error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
  };
}

/**
 * Create standardized error response
 */
function createErrorResponse(method: string, errorMessage: string): HttpResponse {
  return {
    success: false,
    status: 0,
    statusText: 'Error',
    headers: {},
    data: null,
    error: `HTTP ${method} failed: ${errorMessage}`
  };
}

/**
 * Check if headers object already has Content-Type set (case-insensitive)
 */
function hasContentType(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(key => key.toLowerCase() === 'content-type');
}

/**
 * Prepare request body and set appropriate Content-Type header if not already set
 * Note: This function modifies the headers object in place, which is safe because
 * the headers have already been sanitized and copied by sanitizeHeaders()
 */
function prepareRequestBody(
  body: string | Record<string, unknown>, 
  headers: Record<string, string>
): string {
  let result: string;
  
  if (typeof body === 'string') {
    result = body;
    if (!hasContentType(headers)) {
      headers['Content-Type'] = 'text/plain';
    }
  } else {
    result = JSON.stringify(body);
    if (!hasContentType(headers)) {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  return result;
}

/**
 * Perform an HTTP GET request
 * 
 * @param options - Request options including URL, headers, and query params
 * @returns HTTP response with status, headers, and parsed data
 */
export async function httpGet(options: HttpGetOptions): Promise<HttpResponse> {
  try {
    validateUrl(options.url);
    
    const url = buildUrlWithParams(options.url, options.params);
    const headers = sanitizeHeaders(options.headers);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await parseResponse(response);
      return createHttpResponse(response, data);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  } catch (error: any) {
    return createErrorResponse('GET', error.message);
  }
}

/**
 * Perform an HTTP POST request
 * 
 * @param options - Request options including URL, headers, and body
 * @returns HTTP response with status, headers, and parsed data
 */
export async function httpPost(options: HttpPostOptions): Promise<HttpResponse> {
  try {
    validateUrl(options.url);
    
    const headers = sanitizeHeaders(options.headers);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    
    // Prepare body and set Content-Type if needed
    const body = prepareRequestBody(options.body, headers);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await parseResponse(response);
      return createHttpResponse(response, data);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  } catch (error: any) {
    return createErrorResponse('POST', error.message);
  }
}

/**
 * Perform an HTTP PUT request
 * 
 * @param options - Request options including URL, headers, and body
 * @returns HTTP response with status, headers, and parsed data
 */
export async function httpPut(options: HttpPutOptions): Promise<HttpResponse> {
  try {
    validateUrl(options.url);
    
    const headers = sanitizeHeaders(options.headers);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    
    // Prepare body and set Content-Type if needed
    const body = prepareRequestBody(options.body, headers);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(options.url, {
        method: 'PUT',
        headers,
        body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await parseResponse(response);
      return createHttpResponse(response, data);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  } catch (error: any) {
    return createErrorResponse('PUT', error.message);
  }
}
