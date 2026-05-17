import { CopilotClient, type AssistantMessageEvent, type CopilotClientOptions, type CopilotSession } from "@github/copilot-sdk";

const DEFAULT_MODEL = process.env.COPILOT_MODEL ?? "gpt-5";
const DEFAULT_TIMEOUT_MS = 120_000;

export interface CopilotAttachment {
  type: "file";
  path: string;
  displayName?: string;
}

export interface CopilotSessionOptions {
  sessionId?: string;
  model?: string;
  streaming?: boolean;
  instructions?: string;
}

export interface CopilotMessageOptions {
  prompt: string;
  attachments?: CopilotAttachment[];
  mode?: "enqueue" | "immediate";
  timeoutMs?: number;
}

export interface CopilotQueuedMessageResult {
  sessionId: string;
  messageId: string;
}

export interface CopilotMessageResult {
  sessionId: string;
  assistantResponse?: string;
}

export interface CopilotSessionSummary {
  sessionId: string;
  model: string;
  streaming: boolean;
  workspacePath?: string;
  createdAt: string;
  updatedAt: string;
}

export type CopilotSessionEvents = Awaited<ReturnType<CopilotSession["getMessages"]>>;

interface ManagedSession {
  session: CopilotSession;
  model: string;
  streaming: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CopilotService {
  private client?: CopilotClient;
  private starting?: Promise<void>;
  private readonly sessions = new Map<string, ManagedSession>();

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

  private rememberSession(session: CopilotSession, options: CopilotSessionOptions, createdAt = new Date()): ManagedSession {
    const managed: ManagedSession = {
      session,
      model: options.model ?? DEFAULT_MODEL,
      streaming: options.streaming ?? true,
      createdAt,
      updatedAt: createdAt,
    };
    this.sessions.set(session.sessionId, managed);
    return managed;
  }

  private getManagedSession(sessionId: string): ManagedSession {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`Unknown Copilot session: ${sessionId}`);
    }
    return managed;
  }

  private touchSession(managed: ManagedSession): void {
    managed.updatedAt = new Date();
  }

  private summarizeSession(managed: ManagedSession): CopilotSessionSummary {
    return {
      sessionId: managed.session.sessionId,
      model: managed.model,
      streaming: managed.streaming,
      workspacePath: managed.session.workspacePath,
      createdAt: managed.createdAt.toISOString(),
      updatedAt: managed.updatedAt.toISOString(),
    };
  }

  public async createSession(options: CopilotSessionOptions = {}): Promise<CopilotSessionSummary> {
    await this.ensureClient();

    if (!this.client) {
      throw new Error("Copilot client failed to initialize.");
    }

    const session = await this.client.createSession({
      sessionId: options.sessionId,
      model: options.model ?? DEFAULT_MODEL,
      streaming: options.streaming ?? true,
      systemMessage: options.instructions ? { content: options.instructions } : undefined,
    });

    return this.summarizeSession(this.rememberSession(session, options));
  }

  public async resumeSession(sessionId: string, options: CopilotSessionOptions = {}): Promise<CopilotSessionSummary> {
    await this.ensureClient();

    if (!this.client) {
      throw new Error("Copilot client failed to initialize.");
    }

    const session = await this.client.resumeSession(sessionId, {
      model: options.model ?? DEFAULT_MODEL,
      streaming: options.streaming ?? true,
      systemMessage: options.instructions ? { content: options.instructions } : undefined,
    });

    return this.summarizeSession(this.rememberSession(session, { ...options, sessionId }, new Date()));
  }

  public listActiveSessions(): CopilotSessionSummary[] {
    return Array.from(this.sessions.values()).map((managed) => this.summarizeSession(managed));
  }

  public getActiveSession(sessionId: string): CopilotSessionSummary {
    return this.summarizeSession(this.getManagedSession(sessionId));
  }

  public async queueMessage(sessionId: string, options: CopilotMessageOptions): Promise<CopilotQueuedMessageResult> {
    const managed = this.getManagedSession(sessionId);
    const messageId = await managed.session.send({
      prompt: options.prompt,
      attachments: options.attachments,
      mode: options.mode ?? "immediate",
    });
    this.touchSession(managed);
    return { sessionId, messageId };
  }

  public async sendMessage(sessionId: string, options: CopilotMessageOptions): Promise<CopilotMessageResult> {
    const managed = this.getManagedSession(sessionId);
    const finalEvent = await managed.session.sendAndWait(
      {
        prompt: options.prompt,
        attachments: options.attachments,
        mode: options.mode ?? "immediate",
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    this.touchSession(managed);

    return {
      sessionId,
      assistantResponse: this.extractAssistantContent(finalEvent),
    };
  }

  public async getMessages(sessionId: string): Promise<CopilotSessionEvents> {
    const managed = this.getManagedSession(sessionId);
    return managed.session.getMessages();
  }

  public async disconnectSession(sessionId: string): Promise<void> {
    const managed = this.getManagedSession(sessionId);
    await managed.session.disconnect();
    this.sessions.delete(sessionId);
  }

  public async stop(): Promise<void> {
    const disconnects = Array.from(this.sessions.keys()).map(async (sessionId) => {
      const managed = this.sessions.get(sessionId);
      if (!managed) {
        return;
      }
      await managed.session.disconnect();
    });

    await Promise.all(disconnects);
    this.sessions.clear();

    if (!this.client) {
      return;
    }

    await this.client.stop();
    this.client = undefined;
  }

  private extractAssistantContent(finalEvent: AssistantMessageEvent | undefined): string | undefined {
    return finalEvent?.data?.content;
  }
}

export const copilotService = new CopilotService();
