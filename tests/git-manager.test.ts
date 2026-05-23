import { describe, expect, it } from "vitest";
import {
  createTrackedGitRepositoryId,
  isLikelyGitCloneUrl,
  normalizeGitTargetPath,
  parseGitRemoteList,
  parseGitStatusPorcelainV2,
} from "../server/services/git-manager";

describe("git-manager helpers", () => {
  it("normalizes relative repository paths from the workspace root", () => {
    expect(normalizeGitTargetPath("projects/demo")).toBe(`${process.cwd()}/projects/demo`);
  });

  it("creates stable tracked repository ids from the repo path", () => {
    expect(createTrackedGitRepositoryId("/tmp/demo")).toBe(createTrackedGitRepositoryId("/tmp/demo"));
    expect(createTrackedGitRepositoryId("/tmp/demo")).not.toBe(createTrackedGitRepositoryId("/tmp/demo-two"));
  });

  it("validates supported clone URL formats", () => {
    expect(isLikelyGitCloneUrl("https://github.com/octo/demo.git")).toBe(true);
    expect(isLikelyGitCloneUrl("ssh://git@github.com/octo/demo.git")).toBe(true);
    expect(isLikelyGitCloneUrl("git@github.com:octo/demo.git")).toBe(true);
    expect(isLikelyGitCloneUrl("file:///tmp/demo.git")).toBe(true);
    expect(isLikelyGitCloneUrl("notaurl")).toBe(false);
  });

  it("parses porcelain v2 branch and file state", () => {
    const parsed = parseGitStatusPorcelainV2(`# branch.oid abcdef1234567890
# branch.head main
# branch.upstream origin/main
# branch.ab +2 -1
1 M. N... 100644 100644 100644 abcdef abcdef src/app.ts
2 R. N... 100644 100644 100644 abcdef abcdef R100 src/new-name.ts\tsrc/old-name.ts
? README-draft.md`);

    expect(parsed.branchName).toBe("main");
    expect(parsed.upstream).toBe("origin/main");
    expect(parsed.ahead).toBe(2);
    expect(parsed.behind).toBe(1);
    expect(parsed.stagedCount).toBe(2);
    expect(parsed.unstagedCount).toBe(0);
    expect(parsed.untrackedCount).toBe(1);
    expect(parsed.changedFiles).toEqual([
      {
        path: "src/app.ts",
        originalPath: undefined,
        kind: "tracked",
        statusCode: "M.",
        indexStatus: "M",
        workTreeStatus: "",
        staged: true,
        unstaged: false,
        untracked: false,
      },
      {
        path: "src/new-name.ts",
        originalPath: "src/old-name.ts",
        kind: "renamed",
        statusCode: "R.",
        indexStatus: "R",
        workTreeStatus: "",
        staged: true,
        unstaged: false,
        untracked: false,
      },
      {
        path: "README-draft.md",
        kind: "untracked",
        statusCode: "??",
        indexStatus: "",
        workTreeStatus: "?",
        staged: false,
        unstaged: false,
        untracked: true,
      },
    ]);
  });

  it("parses git remote fetch and push urls", () => {
    expect(
      parseGitRemoteList(`origin\thttps://github.com/octo/demo.git (fetch)
origin\tgit@github.com:octo/demo.git (push)
upstream\thttps://github.com/acme/demo.git (fetch)
upstream\thttps://github.com/acme/demo.git (push)`)
    ).toEqual([
      {
        name: "origin",
        fetchUrl: "https://github.com/octo/demo.git",
        pushUrl: "git@github.com:octo/demo.git",
      },
      {
        name: "upstream",
        fetchUrl: "https://github.com/acme/demo.git",
        pushUrl: "https://github.com/acme/demo.git",
      },
    ]);
  });
});
