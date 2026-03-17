# Meowstik Search API Architecture

## Overview

Meowstik provides real-time web search capabilities to the AI model, allowing it to retrieve up-to-date information from the internet.

Historically, this was powered by the Google Custom Search JSON API. However, due to persistent `403 Forbidden` issues and project-level restrictions, we have migrated to **Gemini Search Grounding**.

## Gemini Search Grounding

We now leverage the built-in "Google Search" tool available in Gemini models (specifically `gemini-2.0-flash`). This approach offers several advantages:

1.  **Reliability**: No need for separate Google Cloud Project API keys or Custom Search Engine IDs that can be blocked or misconfigured.
2.  **Integration**: The search is handled natively by the model, which decides when to search and how to synthesize the results.
3.  **Citations**: The response includes `groundingMetadata`, providing inline citations and source links automatically.

### Configuration

The search logic is located in `server/integrations/web-search.ts`.

It defaults to using the `googleSearch` tool:

```typescript
// server/integrations/web-search.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash", 
  tools: [{ googleSearch: {} }] 
});
```

### Fallback Mechanism

The legacy Google Custom Search implementation is preserved as a fallback but is currently bypassed by default. The `performWebSearch` function checks if it should use the legacy method only if explicitly requested or if Gemini Grounding fails (though currently it is the primary path).

### Testing

You can verify the search functionality using the included script:

```bash
npx tsx scripts/test_keys.ts
```

This script will attempt to perform a search using the Gemini model and report success if it receives a grounded response.

## Legacy Custom Search (Deprecated)

*Note: This integration is currently inactive but code remains for reference.*

Requires:
- `GOOGLE_SEARCH_API_KEY`: API Key from Google Cloud Console.
- `GOOGLE_SEARCH_ENGINE_ID`: Custom Search Engine ID (cx).

Endpoints used:
- `https://customsearch.googleapis.com/customsearch/v1`

## Troubleshooting

If search fails:
1.  **Check API Key**: Ensure `GEMINI_API_KEY` is valid and has access to Generative Language API.
2.  **Model Availability**: Ensure `gemini-2.0-flash` is available in your region.
3.  **Logs**: Check server logs for "Gemini Search Grounding error".
