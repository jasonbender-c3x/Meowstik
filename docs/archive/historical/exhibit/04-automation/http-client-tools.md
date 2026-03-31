# HTTP Client Tools Documentation

## Overview

Meowstik now includes direct HTTP client capabilities that enable advanced web interactions, API integrations, and automated data exchange. These tools provide low-level HTTP access beyond the capabilities of `web_search` and `browser_scrape`.

## Available Tools

### 1. `http_get` - HTTP GET Requests

Perform HTTP GET requests to fetch data from any web API or endpoint.

**Parameters:**
- `url` (required): Full URL to request (must start with `http://` or `https://`)
- `headers` (optional): Custom HTTP headers as key-value pairs
- `params` (optional): Query parameters as key-value pairs (automatically appended to URL)
- `timeout` (optional): Request timeout in milliseconds (default: 30000ms)

**Example Usage:**
```json
{
  "type": "http_get",
  "id": "req1",
  "parameters": {
    "url": "https://api.github.com/repos/octocat/Hello-World",
    "headers": {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Meowstik"
    }
  }
}
```

**With Query Parameters:**
```json
{
  "type": "http_get",
  "id": "req2",
  "parameters": {
    "url": "https://api.example.com/search",
    "params": {
      "q": "machine learning",
      "limit": "10"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json"
  },
  "contentType": "application/json",
  "data": { /* parsed response data */ }
}
```

### 2. `http_post` - HTTP POST Requests

Perform HTTP POST requests to submit data to web APIs or services.

**Parameters:**
- `url` (required): Full URL to request
- `body` (required): Request body - can be a string or an object (objects are automatically JSON stringified)
- `headers` (optional): Custom HTTP headers
- `timeout` (optional): Request timeout in milliseconds (default: 30000ms)

**Example Usage:**
```json
{
  "type": "http_post",
  "id": "req3",
  "parameters": {
    "url": "https://api.example.com/users",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_TOKEN"
    },
    "body": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**With String Body:**
```json
{
  "type": "http_post",
  "id": "req4",
  "parameters": {
    "url": "https://api.example.com/webhook",
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": "Hello from Meowstik!"
  }
}
```

### 3. `http_put` - HTTP PUT Requests

Perform HTTP PUT requests to update resources via RESTful APIs.

**Parameters:**
- `url` (required): Full URL to request
- `body` (required): Request body - can be a string or an object
- `headers` (optional): Custom HTTP headers
- `timeout` (optional): Request timeout in milliseconds (default: 30000ms)

**Example Usage:**
```json
{
  "type": "http_put",
  "id": "req5",
  "parameters": {
    "url": "https://api.example.com/users/123",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_TOKEN"
    },
    "body": {
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
}
```

## Use Cases

### 1. API Integration
```json
{
  "type": "http_get",
  "parameters": {
    "url": "https://api.weather.gov/points/39.7456,-97.0892"
  }
}
```

### 2. Webhook Integration
```json
{
  "type": "http_post",
  "parameters": {
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "body": {
      "text": "Automated notification from Meowstik"
    }
  }
}
```

### 3. RESTful API Operations
```json
{
  "type": "http_put",
  "parameters": {
    "url": "https://api.example.com/tasks/456",
    "body": {
      "status": "completed",
      "completedAt": "2024-01-14T12:00:00Z"
    }
  }
}
```

### 4. File Downloads
```json
{
  "type": "http_get",
  "parameters": {
    "url": "https://example.com/data.json"
  }
}
```

## Security Features

1. **URL Validation**: Only HTTP and HTTPS protocols are allowed
2. **Header Sanitization**: Control characters and newlines are removed from headers
3. **Timeout Protection**: All requests timeout after 30 seconds by default (configurable)
4. **Size Limits**: Response size limited to 10MB to prevent memory issues
5. **Error Handling**: Comprehensive error handling with descriptive messages

## Response Format

All HTTP client tools return a standardized response:

```typescript
{
  success: boolean;        // true if HTTP status is 2xx
  status: number;          // HTTP status code (200, 404, 500, etc.)
  statusText: string;      // HTTP status text ("OK", "Not Found", etc.)
  headers: object;         // Response headers as key-value pairs
  contentType?: string;    // Content-Type header value
  data: unknown;           // Parsed response body (JSON, text, or base64)
  error?: string;          // Error message if request failed
}
```

## Content Type Handling

The HTTP client automatically handles different content types:

- **JSON** (`application/json`): Automatically parsed into objects
- **Text** (`text/*`): Returned as strings
- **Binary**: Returned as base64-encoded strings

## Error Handling

Errors are returned in the response object:

```json
{
  "success": false,
  "status": 0,
  "statusText": "Error",
  "headers": {},
  "data": null,
  "error": "HTTP GET failed: Request timeout after 30000ms"
}
```

Common error scenarios:
- Network timeouts
- Invalid URLs
- DNS resolution failures
- SSL/TLS errors
- Server errors (5xx)
- Authentication failures (401, 403)

## Best Practices

1. **Always set appropriate headers** for the content you're sending
2. **Use authentication headers** when accessing protected APIs
3. **Handle errors gracefully** - check the `success` field in responses
4. **Set reasonable timeouts** for long-running requests
5. **Validate response data** before processing
6. **Use HTTPS** for sensitive data transmission

## Comparison with Existing Tools

| Feature | `http_get/post/put` | `web_search` | `browser_scrape` |
|---------|---------------------|--------------|------------------|
| **Direct API Access** | ✅ Yes | ❌ No | ❌ No |
| **Custom Headers** | ✅ Yes | ❌ No | ❌ No |
| **POST/PUT Data** | ✅ Yes | ❌ No | ❌ No |
| **Raw Response** | ✅ Yes | ❌ No | ❌ No |
| **JavaScript Execution** | ❌ No | ❌ No | ✅ Yes |
| **Search Engine** | ❌ No | ✅ Yes | ❌ No |

## Examples

### Weather API
```json
{
  "type": "http_get",
  "parameters": {
    "url": "https://api.openweathermap.org/data/2.5/weather",
    "params": {
      "q": "London",
      "appid": "YOUR_API_KEY"
    }
  }
}
```

### GitHub API
```json
{
  "type": "http_post",
  "parameters": {
    "url": "https://api.github.com/repos/owner/repo/issues",
    "headers": {
      "Authorization": "token YOUR_GITHUB_TOKEN",
      "Accept": "application/vnd.github.v3+json"
    },
    "body": {
      "title": "Bug report",
      "body": "Description of the issue"
    }
  }
}
```

### Airtable Integration
```json
{
  "type": "http_put",
  "parameters": {
    "url": "https://api.airtable.com/v0/BASE_ID/TABLE_NAME/RECORD_ID",
    "headers": {
      "Authorization": "Bearer YOUR_AIRTABLE_KEY",
      "Content-Type": "application/json"
    },
    "body": {
      "fields": {
        "Name": "Updated Name",
        "Status": "Complete"
      }
    }
  }
}
```

## Troubleshooting

### "Invalid URL" error
- Ensure URL starts with `http://` or `https://`
- Check for typos in the URL

### Timeout errors
- Increase the `timeout` parameter
- Check if the server is responsive
- Verify network connectivity

### 401/403 errors
- Check authentication headers
- Verify API keys are correct
- Ensure proper permissions

### CORS errors
- CORS is handled server-side, not by the client
- Use server-side proxy if needed

## Implementation Details

- **Module**: `server/integrations/http-client.ts`
- **Validation**: Zod schemas in `shared/schema.ts`
- **Tool Declarations**: `server/gemini-tools.ts`
- **Handlers**: `server/services/rag-dispatcher.ts`
- **JIT Protocol**: `server/services/jit-tool-protocol.ts`
