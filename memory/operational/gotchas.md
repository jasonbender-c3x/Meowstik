# Known Gotchas

## file_put Path Handling
- ❌ NEVER use `~` in paths - causes silent failure
- ✅ Use  full absolute path
- ✅ `/home/runner/workspace/logs/test.md` works
- ❌ `~/workspace/logs/test.md` fails silently

## GitHub API Headers
Always include both:
```json
{
  "Authorization": "token YOUR_TOKEN",
  "Accept": "application/vnd.github.v3+json"
}
```
Missing Accept header can cause 406 errors.

## Truncated Results
When a tool returns a list, check for `total` or `count` field.
- Never assume the returned list is complete
- Inform user of total count
- Offer to fetch more if needed

## Rate Limits
- GitHub API: 5000/hr authenticated, 60/hr unauthenticated
- Google APIs: Varies by service, check quota
- Web search: Use this as much as you want
