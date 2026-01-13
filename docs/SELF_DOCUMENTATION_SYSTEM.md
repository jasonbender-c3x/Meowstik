# Self-Documentation System

## Overview

The Self-Documentation System is an AI-powered feature that allows Meowstik to automatically generate comprehensive documentation for the codebase, including:

- **API References**: Detailed documentation of endpoints, methods, parameters, and responses
- **Tutorials**: Step-by-step guides for learning specific features
- **Guides**: Comprehensive how-to documents and best practices
- **Overviews**: High-level architecture and system design documentation

## Architecture

### Components

1. **Database Schema** (`shared/schema.ts`)
   - `generatedDocs` table stores all AI-generated documentation
   - Includes metadata like title, slug, type, category, and publication status

2. **Documentation Generator Service** (`server/services/documentation-generator.ts`)
   - Uses Google Gemini AI to analyze code and generate documentation
   - Supports multiple documentation types
   - Can analyze source files to create context-aware documentation

3. **API Routes** (`server/routes/documentation.ts`)
   - `POST /api/documentation/generate` - Generate new documentation
   - `GET /api/documentation/generated` - List all generated docs
   - `GET /api/documentation/generated/:id` - Get specific doc
   - `PATCH /api/documentation/generated/:id` - Update doc
   - `POST /api/documentation/generated/:id/publish` - Publish doc
   - `DELETE /api/documentation/generated/:id` - Delete doc

4. **UI Integration** (`client/src/pages/docs.tsx`)
   - "Generate Documentation" button in the docs page sidebar
   - Dialog for configuring documentation generation
   - Display of AI-generated docs alongside static docs

## Database Schema

### generatedDocs Table

```typescript
{
  id: string (UUID, PK)
  title: string
  slug: string (unique, URL-friendly)
  type: 'api-reference' | 'tutorial' | 'guide' | 'overview'
  category?: string
  content: string (Markdown)
  summary?: string
  generatedBy: string (default: 'Meowstik AI')
  sourceFiles?: string[]
  version: string (default: '1.0.0')
  published: boolean (default: false)
  featured: boolean (default: false)
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Setup Instructions

### 1. Apply Database Schema

**In Replit environment** (where DATABASE_URL is available):

```bash
npm run db:push
```

This will create the `generated_docs` table in your PostgreSQL database.

### 2. Verify Installation

Start the application:

```bash
npm run dev
```

Navigate to `/docs` and you should see a "Generate Documentation" button in the sidebar.

## Usage

### Generating Documentation

1. Go to the Documentation page (`/docs`)
2. Click the "Generate Documentation" button
3. Fill in the form:
   - **Type**: Choose API Reference, Tutorial, Guide, or Overview
   - **Title**: Enter a descriptive title
   - **Category** (optional): Categorize the doc (e.g., "API", "Database")
   - **Context** (optional): Provide additional information or requirements
4. Click "Generate"

The AI will analyze the codebase and generate comprehensive documentation based on your specifications.

### Publishing Documentation

Generated documentation starts as unpublished (draft). To make it visible:

```bash
# Using the API
curl -X POST http://localhost:5000/api/documentation/generated/{id}/publish
```

Or implement a publish button in the UI.

### Example: Generate API Reference

```typescript
// POST /api/documentation/generate
{
  "type": "api-reference",
  "title": "Chat API Reference",
  "category": "API",
  "sourceFiles": ["server/routes.ts", "shared/schema.ts"],
  "context": "Focus on the chat and messaging endpoints",
  "targetAudience": "developer",
  "saveToDb": true
}
```

## Features

### Automatic Source Analysis

The system can analyze source files to create context-aware documentation:

```typescript
{
  "sourceFiles": [
    "server/routes.ts",
    "server/storage.ts",
    "shared/schema.ts"
  ]
}
```

### Smart Slug Generation

Titles are automatically converted to URL-friendly slugs:
- "Getting Started Guide" → `getting-started-guide`
- "API Reference: Chat" → `api-reference-chat`

### Search Integration

Generated docs are automatically included in the documentation search, making them discoverable alongside static documentation.

### Version Management

Each document has a version field for tracking iterations and updates.

## API Documentation

### Generate Documentation

**POST** `/api/documentation/generate`

Request body:
```json
{
  "type": "api-reference" | "tutorial" | "guide" | "overview",
  "title": "string",
  "category": "string (optional)",
  "sourceFiles": ["string"] (optional),
  "context": "string (optional)",
  "targetAudience": "developer" | "user" | "contributor" (optional),
  "saveToDb": boolean (optional, default: true)
}
```

Response:
```json
{
  "success": true,
  "doc": { /* GeneratedDoc object */ }
}
```

### List Generated Docs

**GET** `/api/documentation/generated`

Query parameters:
- `published`: Filter by publication status (true/false)
- `type`: Filter by document type
- `category`: Filter by category

### Get Document

**GET** `/api/documentation/generated/:id`

**GET** `/api/documentation/generated/slug/:slug`

### Update Document

**PATCH** `/api/documentation/generated/:id`

Request body: Partial `GeneratedDoc` object

### Publish/Unpublish

**POST** `/api/documentation/generated/:id/publish`

**POST** `/api/documentation/generated/:id/unpublish`

### Delete Document

**DELETE** `/api/documentation/generated/:id`

## Best Practices

1. **Start with Context**: Provide clear context when generating docs to get better results
2. **Review Before Publishing**: Generated docs should be reviewed for accuracy before publishing
3. **Categorize Consistently**: Use consistent categories for better organization
4. **Update Regularly**: Regenerate docs when code changes significantly
5. **Version Control**: Track document versions for major updates

## Future Enhancements

- [ ] Automatic regeneration when source files change
- [ ] Multi-language support
- [ ] Integration with version control (GitHub)
- [ ] Documentation quality metrics
- [ ] AI-powered doc suggestions based on codebase analysis
- [ ] Collaborative editing of generated docs
- [ ] Export to external formats (PDF, HTML)

## Troubleshooting

### Database Connection Issues

If you get database errors:
1. Ensure you're running in an environment with `DATABASE_URL` set
2. Run `npm run db:push` to apply schema changes
3. Check PostgreSQL logs for connection issues

### Generation Failures

If documentation generation fails:
1. Verify `GEMINI_API_KEY` is set in environment
2. Check API quotas and limits
3. Reduce the size of `sourceFiles` if analyzing many files
4. Check server logs for detailed error messages

### UI Not Showing Generated Docs

1. Ensure documents are published (`published: true`)
2. Check browser console for API errors
3. Verify the API route is properly registered
4. Clear browser cache and reload

## Contributing

To extend the self-documentation system:

1. Add new documentation types in `shared/schema.ts` (`DocTypes`)
2. Implement generator functions in `server/services/documentation-generator.ts`
3. Update the UI dropdown in `client/src/pages/docs.tsx`
4. Test thoroughly with various codebase scenarios

## Security Considerations

- Documentation generation requires Gemini API access
- Source file analysis is restricted to the project directory
- Generated content should be reviewed before publishing
- Consider rate limiting the generation endpoint
- Implement proper authentication for sensitive documentation
