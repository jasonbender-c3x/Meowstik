const fs = require('fs');
const path = require('path');

const replacements = {
  'send_chat': 'end_chat',
  'file_put': 'put',
  'file_get': 'get',
  'file_append': 'append',
  'log_append': 'append'
};

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file === '.git') {
      continue;
    }
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      filelist = walk(filepath, filelist);
    } else {
      if (filepath.endsWith('.ts') || filepath.endsWith('.tsx') || filepath.endsWith('.md')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walk(process.cwd());

let totalReplaced = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const [oldStr, newStr] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${oldStr}\\b`, 'g');
    content = content.replace(regex, newStr);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
    console.log(`Updated ${file}`);
  }
}
console.log(`Finished updating ${totalReplaced} files.`);
