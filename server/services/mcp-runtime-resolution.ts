const PLACEHOLDER_PATTERN = /\$\{([^}]+)\}/g;

export function resolveRuntimeString(value: string): string {
  return value.replace(PLACEHOLDER_PATTERN, (match, key: string) => process.env[key] ?? match);
}

export function resolveRuntimeArgs(value: string[]): string[] {
  return value.map((entry) => resolveRuntimeString(entry));
}

export function resolveRuntimeMap(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, resolveRuntimeString(entryValue)]),
  );
}
