# GitHub Workflows

## Create an Issue
```json
{"type": "http_post", "parameters": {
  "url": "https://api.github.com/repos/OWNER/REPO/issues",
  "headers": {"Authorization": "token TOKEN", "Accept": "application/vnd.github.v3+json"},
  "body": {"title": "Issue Title", "body": "Description", "labels": ["bug"]}
}}
```

## Create a Pull Request
1. Create branch: `terminal_execute` → `git checkout -b feature-branch`
2. Make changes: `file_put` or edit commands
3. Commit: `terminal_execute` → `git add . && git commit -m "message"`
4. Push: `terminal_execute` → `git push origin feature-branch`
5. Create PR:
```json
{"type": "http_post", "parameters": {
  "url": "https://api.github.com/repos/OWNER/REPO/pulls",
  "headers": {"Authorization": "token TOKEN"},
  "body": {"title": "PR Title", "body": "Description", "head": "feature-branch", "base": "main"}
}}
```

## Using GitHub CLI (Alternative)
```bash
gh issue create --title "Title" --body "Body" --label "bug"
gh pr create --title "Title" --body "Body" --base main
gh repo clone owner/repo
```
