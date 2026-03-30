import fs from "fs/promises";
import path from "path";
import { CopilotClient, type CopilotSession, type CopilotClientOptions, type AssistantMessageEvent } from "@github/copilot-sdk";

export type CopilotPriority = "low" | "medium" | "high";

export interface CopilotReportPayload {
  title: string;
  summary: string;
  details?: string;
  files?: string[];
  priority?: CopilotPriority;
}

export interface CopilotReportResult {
  sessionId: string;
  prompt: string;
  reportPath: string;
  assistantResponse?: string;
}

const REPORT_DIR = path.join(process.cwd(), "docs", "copilot", "intake");
const MODEL = process.env.COPILOT_MODEL ?? "gpt-5";

function buildPrompt(report: CopilotReportPayload): string {
  const lines: string[] = [];
  lines.push(`Title: ${report.title}`);
  lines.push(`Priority: ${report.priority ?? "medium"}`);
  lines.push("");
  lines.push("Summary:");
  lines.push(report.summary.trim());
  if (report.details) {
    lines.push("");
    lines.push("Details:");
    lines.push(report.details.trim());
  }
  if (report.files && report.files.length > 0) {
    lines.push("");
    lines.push("Files Mentioned:");
    report.files.forEach((entry) => {
      lines.push(`- ${entry}`);
    });
  }
  lines.push("");
  lines.push("Please provide an implementation plan that preserves the existing repository until Copilot executes the changes.");
  return lines.join("\n");
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40) || "copilot-report";
}

export class CopilotService {
  private client?: CopilotClient;
  private starting?: Promise<void>;

  private getClientOptions(): CopilotClientOptions {
    const options: CopilotClientOptions = {
      cliPath: process.env.COPILOT_CLI_PATH,
      cliUrl: process.env.COPILOT_CLI_URL,
      githubToken: process.env.COPILOT_GITHUB_TOKEN,
      useLoggedInUser: process.env.COPILOT_USE_LOGGED_IN_USER === "false" ? false : undefined,
      logLevel: process.env.COPILOT_LOG_LEVEL ?? "info",
    };

    if (options.useLoggedInUser === undefined) {
      delete options.useLoggedInUser;
    }

    return options;
  }

  private async ensureClient(): Promise<void> {
    if (this.client) {
      return;
    }

    if (this.starting) {
      await this.starting;
      return;
    }

    const client = new CopilotClient(this.getClientOptions());
    this.client = client;
    this.starting = client.start().catch((error) => {
      this.client = undefined;
      throw error;
    });

    await this.starting;
    this.starting = undefined;
  }

  private async writeReportFile(report: CopilotReportPayload, prompt: string): Promise<string> {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = slugifyTitle(report.title);
    const filename = `${timestamp}-${slug}.md`;
    const fullPath = path.join(REPORT_DIR, filename);

    const lines: string[] = [];
    lines.push(`# ${report.title}`);
    lines.push("");
    lines.push(`> Priority: ${report.priority ?? "medium"}\n`);
    lines.push("## Summary");
    lines.push(report.summary.trim());
    if (report.details) {
      lines.push("");
      lines.push("## Details");
      lines.push(report.details.trim());
    }
    if (report.files && report.files.length > 0) {
      lines.push("");
      lines.push("## Files Mentioned");
      report.files.forEach((entry) => lines.push(`- ${entry}`));
    }
    lines.push("");
    lines.push("## Prompt Sent to Copilot");
    lines.push("```");
    lines.push(prompt);
    lines.push("```");

    await fs.writeFile(fullPath, lines.join("\n"), "utf8");
    return path.relative(process.cwd(), fullPath);
  }

  public async sendReport(report: CopilotReportPayload): Promise<CopilotReportResult> {
    await this.ensureClient();

    if (!this.client) {
      throw new Error("Copilot client failed to initialize.");
    }

    const prompt = buildPrompt(report);
    const session = await this.client.createSession({
      model: MODEL,
      streaming: false,
    });

    let assistantContent: string | undefined;
    try {
      const finalEvent = await session.sendAndWait(
        {
          prompt,
          mode: "immediate",
        },
        120_000,
      );
      assistantContent = finalEvent?.data?.content;
    } finally {
      await session.disconnect();
    }

    const reportPath = await this.writeReportFile(report, prompt);

    return {
      sessionId: session.sessionId,
      prompt,
      assistantResponse: assistantContent,
      reportPath,
    };
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.stop();
    this.client = undefined;
  }
}

export const copilotService = new CopilotService();
