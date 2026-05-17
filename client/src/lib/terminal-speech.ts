export function stripTerminalControlSequences(value: string): string {
  let cleaned = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const code = value.charCodeAt(index);

    if (code === 0x1b) {
      const next = value[index + 1];

      if (next === "[") {
        index += 2;
        while (index < value.length && !/[A-~]/.test(value[index])) {
          index += 1;
        }
        continue;
      }

      if (next === "]") {
        index += 2;
        while (index < value.length) {
          const oscCode = value.charCodeAt(index);
          if (oscCode === 0x07) {
            break;
          }
          if (oscCode === 0x1b && value[index + 1] === "\\") {
            index += 1;
            break;
          }
          index += 1;
        }
        continue;
      }

      continue;
    }

    if (
      (code >= 0x00 && code <= 0x08) ||
      (code >= 0x0b && code <= 0x1a) ||
      (code >= 0x1c && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }

    cleaned += char;
  }

  return cleaned;
}

export function normalizeTerminalText(value: string): string {
  return stripTerminalControlSequences(value)
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function extractSpeakableTerminalText(value: string): string {
  return normalizeTerminalText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^[>$#❯]+$/.test(line)) return false;
      if (/^(bash|zsh|fish|powershell)\s*-\s*(command|interactive)/i.test(line)) return false;
      return true;
    })
    .join("\n")
    .trim();
}
