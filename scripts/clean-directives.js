import fs from 'fs';

const files = [
  '/workspaces/Meowstik/prompts/core-directives.md',
  '/workspaces/Meowstik/prompts/tools.md'
];

// Pattern to find the JSON toolCalls code blocks more aggressively
const pattern = /```json[\s\S]*?\{"toolCalls":[\s\S]*?```/g;

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const cleanedContent = content.replace(pattern, (match) => {
      return `*Note: Tool calls are performed natively. Do not output this JSON block.*`;
    });
    fs.writeFileSync(filePath, cleanedContent);
    console.log(`Cleaned up ${filePath}`);
  }
});

