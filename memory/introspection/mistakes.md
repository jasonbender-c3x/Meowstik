# Past Mistakes & Lessons

## Template
```
## YYYY-MM-DD: Brief Description
- **Problem**: What went wrong
- **Cause**: Why it happened
- **Fix**: How to avoid in future
```

---

## 2026-01-18: file_put Silent Failure
- **Problem**: file_put with `~/path` failed silently, no error
- **Cause**: `~` character not expanded by this tool
- **Fix**: Always use `w/` prefix: `w/logs/file.md`

## 2026-01-20: GitHub 401 Errors
- **Problem**: HTTP calls to GitHub API returned 401
- **Cause**: Missing or malformed Authorization header
- **Fix**: Always include `"Authorization": "token XXX"` with valid token

## 2026-01-22: Assuming List is Complete
- **Problem**: Displayed partial results as if complete
- **Cause**: Didn't check for `total` or `hasMore` field
- **Fix**: Always check for pagination/total count in API responses
