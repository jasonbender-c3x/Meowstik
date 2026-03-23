
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { computerUseService, ComputerAction } from './computer-use';
import { desktopRelayService } from './desktop-relay-service';

export interface PlaybookStep {
  id: string;
  goal: string;
  description: string;
  validation_criteria?: string;
  action_type?: 'click' | 'type' | 'key' | 'scroll' | 'move';
  requires_confirmation?: boolean;
  parameters?: Record<string, any>;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
}

export interface PlaybookSession {
  id: string;
  playbookId: string;
  currentStepIndex: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  variables: Record<string, any>;
  history: {
    stepId: string;
    action?: ComputerAction;
    result: string;
    timestamp: number;
  }[];
}

class PlaybookExecutorService {
  private playbooks = new Map<string, Playbook>();
  private sessions = new Map<string, PlaybookSession>();
  private playbooksDir = path.join(process.cwd(), 'server', 'playbooks');

  constructor() {
    this.loadPlaybooks();
  }

  private loadPlaybooks() {
    if (!fs.existsSync(this.playbooksDir)) {
      return;
    }

    const files = fs.readdirSync(this.playbooksDir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = fs.readFileSync(path.join(this.playbooksDir, file), 'utf-8');
          const playbook = yaml.parse(content) as Playbook;
          this.playbooks.set(playbook.id, playbook);
          console.log(`[Playbook] Loaded: ${playbook.name} (${playbook.id})`);
        } catch (error) {
          console.error(`[Playbook] Failed to load ${file}:`, error);
        }
      }
    }
  }

  getPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  getPlaybook(id: string): Playbook | undefined {
    return this.playbooks.get(id);
  }

  startSession(playbookId: string, variables: Record<string, any> = {}): PlaybookSession {
    const playbook = this.playbooks.get(playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${playbookId}`);
    }

    const sessionId = `pb_session_${Date.now()}`;
    const session: PlaybookSession = {
      id: sessionId,
      playbookId,
      currentStepIndex: 0,
      status: 'running',
      variables,
      history: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): PlaybookSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Execute the current step of the session
   */
  async executeCurrentStep(sessionId: string, desktopSessionId: string): Promise<{
    step: PlaybookStep;
    action?: ComputerAction;
    requiresConfirmation: boolean;
    message: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    
    const playbook = this.playbooks.get(session.playbookId);
    if (!playbook) throw new Error("Playbook not found");

    if (session.currentStepIndex >= playbook.steps.length) {
      session.status = 'completed';
      return { 
        step: {} as PlaybookStep, 
        requiresConfirmation: false, 
        message: "Playbook completed" 
      };
    }

    const step = playbook.steps[session.currentStepIndex];
    
    // Resolve variables in step parameters
    const goal = this.resolveVariables(step.goal, session.variables);
    
    // Get current screenshot from desktop session
    const desktopSession = desktopRelayService.getSession(desktopSessionId);
    if (!desktopSession || !desktopSession.lastFrame) {
      throw new Error("No active desktop session or frame available");
    }
    const screenshot = `data:image/png;base64,${desktopSession.lastFrame.data}`;

    // If step requires manual confirmation, pause here
    if (step.requires_confirmation) {
      return {
        step,
        requiresConfirmation: true,
        message: `Step '${step.id}' requires confirmation: ${goal}`
      };
    }

    // Use Computer Use service to plan the action for this specific step
    const result = await computerUseService.planActionsWithComputerUse(
      goal,
      { screenshot },
      [] // No conversation history needed for single step, usually
    );

    if (result.actions.length > 0) {
      // Record intended action
      return {
        step,
        action: result.actions[0],
        requiresConfirmation: result.requiresConfirmation || false,
        message: `Planned action for step '${step.id}'`
      };
    } else {
      return {
        step,
        requiresConfirmation: false,
        message: `No action planned for step '${step.id}'. AI may think it's already done.`
      };
    }
  }

  /**
   * Confirm and proceed to next step
   */
  async confirmStep(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    
    session.currentStepIndex++;
    session.history.push({
      stepId: "confirmed",
      result: "User confirmed step",
      timestamp: Date.now()
    });
  }

  private resolveVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
  }
}

export const playbookService = new PlaybookExecutorService();
