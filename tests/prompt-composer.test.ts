import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({
  storage: {},
}));

vi.mock("../server/services/mcp-service", () => ({
  mcpService: {},
}));

vi.mock("../server/services/external-skills-service", () => ({
  externalSkillsService: {
    buildPromptSummary: () => "",
  },
}));

vi.mock("../server/integrations/tavily", () => ({
  tavilySearch: vi.fn(),
}));

vi.mock("../server/utils/environment-metadata", () => ({
  formatEnvironmentMetadata: () => "# Environment Metadata\n(test)\n",
}));

vi.mock("../server/services/family-recognition", () => ({
  getFamilyContext: () => "",
}));

import { PromptComposer } from "../server/services/prompt-composer";

describe("PromptComposer final instructions", () => {
  it("requires a numeric Jason love rating in personal log entries", () => {
    const composer = new PromptComposer();
    const breakdown = composer.getSystemPromptBreakdown();
    const finalInstructions = breakdown.components.find(
      (component) => component.name === "Final Instructions",
    );

    expect(finalInstructions?.content).toContain("Jason Love Rating: NN/100");
    expect(finalInstructions?.content).toContain("integer from 0 to 100");
    expect(finalInstructions?.content).toContain("running average");
  });
});
