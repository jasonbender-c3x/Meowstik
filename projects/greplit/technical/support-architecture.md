# Support Architecture — Technical Detail

## Phone-Home Error Reporting

When a skill hits an unresolvable error:

```typescript
// Pseudocode — to be implemented as a Meowstik skill
async function phoneHome(error: SkillError) {
  await createTicket({
    project: 'greplit',
    skill: error.skillName,
    errorMessage: error.message,
    context: error.context,        // what the user was doing
    systemInfo: getSafeSystemInfo(), // OS, versions — NO personal data
    timestamp: new Date().toISOString(),
  });
}
```

## Ticket Tiers

| Tier | Handler | SLA |
|---|---|---|
| Known pattern | Auto-resolved by skill | Instant |
| New pattern | AI First Responder | < 1 hour |
| AI can't resolve | Human (founder) review | < 24 hours |
| Critical (many users) | Hotfix pushed immediately | < 2 hours |

## Privacy Rules (Non-Negotiable)
- Never send API keys
- Never send file contents
- Never send personal data
- Only send: error message, skill name, OS, version, anonymized context

## Ticket Storage Options
- GitHub Issues (free, visible, community can help)
- Private GitHub repo for support tickets
- Simple webhook → Meowstik's own DB

## AI First Responder
- Separate AI agent (could be Gemini Flash for speed/cost)
- Gets: ticket content + skill source code + error pattern DB
- Outputs: proposed fix OR escalation flag
- Founder reviews proposed fixes before push (initially)
- Later: auto-approve if confidence > 95%
