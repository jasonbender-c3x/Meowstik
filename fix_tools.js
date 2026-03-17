const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'shared/schema.ts',
  'server/gemini-tools.ts',
  'server/services/rag-dispatcher.ts',
  'server/services/prompt-composer.ts',
  'prompts/core-directives.md',
  'prompts/tools.md'
];

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. Rename tools
  content = content.replace(/\bsend_chat\b/g, 'end_chat');
  content = content.replace(/\bfile_put\b/g, 'put');
  content = content.replace(/\bfile_get\b/g, 'get');
  content = content.replace(/\bfile_append\b/g, 'append');
  content = content.replace(/\blog_append\b/g, 'append');
  
  // 2. Fix Double Escaping in dispatcher
  if (file === 'server/services/rag-dispatcher.ts') {
    // Unescape literal \n in put (formerly file_put)
    content = content.replace(
      /(async executeFilePut\(toolCall: ToolCall\): Promise<unknown> \{[\s\S]*?)(const parsed = parsePathPrefix)/,
      "$1if (typeof params.content === 'string') {\n      params.content = params.content.replace(/\\\\n/g, '\\n');\n    }\n    $2"
    );
    // Unescape literal \n in append (formerly log_append)
    content = content.replace(
      /(async executeLogAppend\(toolCall: ToolCall\): Promise<unknown> \{[\s\S]*?)(const sanitizedName = params\.name)/,
      "$1if (typeof params.content === 'string') {\n      params.content = params.content.replace(/\\\\n/g, '\\n');\n    }\n    $2"
    );
  }

  // 3. Update Prompt Composer Instructions & Add Personal Log
  if (file === 'server/services/prompt-composer.ts') {
    // Fix the one-shot example and add personal log
    content = content.replace(
      /1\.  \*\*Append Execution Log\*\*:[\s\S]*?2\.  \*\*Update Thoughts Forward Cache\*\*:/,
      `1.  **Append Execution Log & Personal Log**:
    *   **Action**: Use the \`append\` tool twice. Once with \`name: "execution"\` to log your actions, and once with \`name: "personal"\` to log personal reflections.
    *   **Content**: Format with actual newlines, do not double-escape them.
    *   **Example**:
        \`\`\`
        append({ name: "execution", content: "### Turn Log\\n- **Tool**: gmail_search\\n- **Result**: Found emails" })
        append({ name: "personal", content: "### Reflection\\nI should ask the user for clarification next." })
        \`\`\`

2.  **Update Thoughts Forward Cache**:`.replace(/\\n/g, '\\n') // Keep literal \n for the markdown output
    );
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
