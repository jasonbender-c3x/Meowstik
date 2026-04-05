// Stub for tavily search integration
export async function tavilySearch(query: string, options?: Record<string, unknown>): Promise<any> {
  console.warn("[Tavily] Tavily integration not configured");
  return { results: [] };
}
