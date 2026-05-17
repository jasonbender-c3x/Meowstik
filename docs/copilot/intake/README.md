# Copilot Intake Artifacts

This folder is reserved for Copilot-facing artifacts when a workflow chooses to persist them.

The old auto-generated `copilot_send_report` intake flow has been retired. Current Copilot integration work is centered on persistent SDK sessions managed by `server/services/copilot-service.ts`.

If a future route or workflow stores Copilot prompts, transcripts, or summaries on disk, this directory is the intended home for those artifacts.
