# PROPOSAL-002: GitHub AutoDoc Workflow

**Date:** January 16, 2026  
**Status:** Draft  
**Author:** Replit Agent  
**Scope:** Automated documentation generation pipeline with multi-audience output

---

## Executive Summary

This proposal outlines a GitHub Actions-based workflow that automatically generates, reviews, and publishes documentation through three phases:

1. **Understanding Phase** - Generate code maps, cliff notes, and rosetta stones
2. **Assessment Phase** - Identify errors, gaps, and improvement areas
3. **Publishing Phase** - Produce developer, academic, and customer documentation as interactive SPA exhibits

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GitHub AutoDoc Pipeline                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   TRIGGER   │───▶│  PHASE 1    │───▶│  PHASE 2    │───▶          │
│  │  (PR/Push)  │    │ UNDERSTAND  │    │   ASSESS    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                            │                  │                       │
│                            ▼                  ▼                       │
│                     ┌─────────────┐    ┌─────────────┐              │
│                     │ Code Maps   │    │ Error Report│              │
│                     │ Cliff Notes │    │ Gap Analysis│              │
│                     │ Rosetta     │    │ Debt Score  │              │
│                     └─────────────┘    └─────────────┘              │
│                                                                       │
│                     ┌─────────────────────────────────┐              │
│                     │          PHASE 3: PUBLISH       │              │
│                     ├─────────┬─────────┬─────────────┤              │
│                     │Developer│Academic │  Customer   │              │
│                     │  Docs   │ Papers  │   Demos     │              │
│                     └────┬────┴────┬────┴──────┬──────┘              │
│                          │         │           │                      │
│                          ▼         ▼           ▼                      │
│                     ┌─────────────────────────────────┐              │
│                     │      SPA Exhibit Generator      │              │
│                     │   (Cheerio + MDX + Vite)        │              │
│                     └─────────────────────────────────┘              │
│                                    │                                  │
│                                    ▼                                  │
│                     ┌─────────────────────────────────┐              │
│                     │    docs-portal (GitHub Pages)   │              │
│                     └─────────────────────────────────┘              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Understanding (Code Review Generation)

### 1.1 Objectives

Generate comprehensive understanding artifacts that serve as the foundation for all downstream documentation.

### 1.2 Artifacts Generated

#### A. Code Map (Dependency Graph)

```typescript
// scripts/generators/code-map.ts
import { Project } from 'ts-morph';
import * as path from 'path';

interface CodeMapNode {
  file: string;
  type: 'module' | 'class' | 'function' | 'component';
  name: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
  loc: number;
  complexity: number;
}

interface CodeMap {
  generated: string;
  rootDir: string;
  nodes: CodeMapNode[];
  edges: { from: string; to: string; type: string }[];
  clusters: { name: string; files: string[] }[];
}

export async function generateCodeMap(srcDir: string): Promise<CodeMap> {
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
  });

  const sourceFiles = project.getSourceFiles();
  const nodes: CodeMapNode[] = [];
  const edges: { from: string; to: string; type: string }[] = [];

  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    const imports = file.getImportDeclarations();
    const exports = file.getExportedDeclarations();

    // Extract node information
    nodes.push({
      file: path.relative(srcDir, filePath),
      type: detectModuleType(file),
      name: path.basename(filePath, '.ts'),
      imports: imports.map(i => i.getModuleSpecifierValue()),
      exports: Array.from(exports.keys()),
      dependencies: extractDependencies(imports),
      loc: file.getEndLineNumber(),
      complexity: calculateComplexity(file),
    });

    // Build edges
    for (const imp of imports) {
      edges.push({
        from: filePath,
        to: imp.getModuleSpecifierValue(),
        type: 'import',
      });
    }
  }

  // Cluster by directory
  const clusters = clusterByDirectory(nodes);

  return {
    generated: new Date().toISOString(),
    rootDir: srcDir,
    nodes,
    edges,
    clusters,
  };
}
```

#### B. Cliff Notes (Directory Summaries)

```typescript
// scripts/generators/cliff-notes.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

interface CliffNote {
  directory: string;
  purpose: string;
  keyFiles: { file: string; role: string }[];
  entryPoints: string[];
  patterns: string[];
  dependencies: string[];
  complexity: 'low' | 'medium' | 'high';
}

export async function generateCliffNotes(
  codeMap: CodeMap,
  genai: GoogleGenerativeAI
): Promise<CliffNote[]> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const notes: CliffNote[] = [];

  for (const cluster of codeMap.clusters) {
    const filesInCluster = codeMap.nodes.filter(n => 
      cluster.files.includes(n.file)
    );

    const prompt = `Analyze this code cluster and provide cliff notes:

Directory: ${cluster.name}
Files: ${cluster.files.join(', ')}

File Details:
${filesInCluster.map(f => `- ${f.file}: ${f.exports.join(', ')} (${f.loc} LOC)`).join('\n')}

Provide a JSON response with:
1. purpose: One sentence describing what this directory does
2. keyFiles: Array of {file, role} for the most important files
3. entryPoints: Main files that external code would import
4. patterns: Design patterns or architectural patterns used
5. complexity: 'low', 'medium', or 'high' based on interconnections`;

    const result = await model.generateContent(prompt);
    const note = JSON.parse(result.response.text());
    
    notes.push({
      directory: cluster.name,
      ...note,
      dependencies: extractClusterDependencies(filesInCluster, codeMap),
    });
  }

  return notes;
}
```

#### C. Rosetta Stone (Terminology Glossary)

```typescript
// scripts/generators/rosetta-stone.ts
interface RosettaEntry {
  term: string;
  definition: string;
  context: string;
  aliases: string[];
  relatedTerms: string[];
  codeExamples: { file: string; snippet: string }[];
  category: 'architecture' | 'domain' | 'pattern' | 'api' | 'infrastructure';
}

interface RosettaStone {
  generated: string;
  projectName: string;
  entries: RosettaEntry[];
  categories: { name: string; count: number }[];
}

export async function generateRosettaStone(
  codeMap: CodeMap,
  cliffNotes: CliffNote[],
  genai: GoogleGenerativeAI
): Promise<RosettaStone> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Extract terminology candidates
  const candidates = new Set<string>();
  
  // From exports
  codeMap.nodes.forEach(n => n.exports.forEach(e => candidates.add(e)));
  
  // From file names (PascalCase/camelCase splitting)
  codeMap.nodes.forEach(n => {
    const baseName = path.basename(n.file, path.extname(n.file));
    candidates.add(baseName);
  });

  const prompt = `You are creating a Rosetta Stone glossary for a codebase.

Project Context:
${cliffNotes.map(n => `- ${n.directory}: ${n.purpose}`).join('\n')}

Terminology Candidates:
${Array.from(candidates).slice(0, 100).join(', ')}

For each significant term, provide a JSON array of entries with:
- term: The term itself
- definition: Clear, concise definition
- context: Where/how it's used in this codebase
- aliases: Alternative names or abbreviations
- relatedTerms: Connected concepts
- category: 'architecture', 'domain', 'pattern', 'api', or 'infrastructure'

Focus on the 30-50 most important terms that a new developer needs to understand.`;

  const result = await model.generateContent(prompt);
  const entries = JSON.parse(result.response.text());

  // Enrich with code examples
  for (const entry of entries) {
    entry.codeExamples = findCodeExamples(entry.term, codeMap);
  }

  return {
    generated: new Date().toISOString(),
    projectName: 'Meowstik',
    entries,
    categories: countByCategory(entries),
  };
}
```

### 1.3 Output Storage

```
docs/copilot/generated/
├── code-map.json           # Full dependency graph
├── code-map.md             # Human-readable summary
├── cliff-notes.json        # Directory summaries
├── cliff-notes.md          # Human-readable cliff notes
├── rosetta-stone.json      # Terminology glossary
└── rosetta-stone.md        # Human-readable glossary
```

---

## Phase 2: Assessment (Error Detection & Improvement Analysis)

### 2.1 Objectives

Analyze the codebase for issues, technical debt, and documentation gaps.

### 2.2 Assessment Dimensions

#### A. Code Quality Assessment

```typescript
// scripts/assessors/code-quality.ts
interface CodeQualityReport {
  timestamp: string;
  overallScore: number; // 0-100
  dimensions: {
    linting: { score: number; issues: LintIssue[] };
    typesSafety: { score: number; issues: TypeIssue[] };
    testCoverage: { score: number; uncoveredFiles: string[] };
    documentation: { score: number; undocumented: string[] };
    complexity: { score: number; hotspots: ComplexityHotspot[] };
  };
  recommendations: Recommendation[];
}

interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: string;
}
```

#### B. Documentation Gap Analysis

```typescript
// scripts/assessors/doc-gaps.ts
interface DocGapReport {
  timestamp: string;
  coverage: {
    overall: number;
    byDirectory: { dir: string; coverage: number }[];
  };
  gaps: {
    missingReadme: string[];
    undocumentedExports: { file: string; exports: string[] }[];
    staleDocuments: { doc: string; lastModified: string; staleDays: number }[];
    orphanedDocs: string[]; // Docs referencing deleted code
  };
  priorities: {
    criticalGaps: string[];
    quickWins: string[];
  };
}
```

#### C. Technical Debt Scoring

```typescript
// scripts/assessors/tech-debt.ts
interface TechDebtReport {
  timestamp: string;
  totalDebtScore: number;
  categories: {
    codeSmells: { count: number; examples: CodeSmell[] };
    todoComments: { count: number; items: TodoItem[] };
    deprecatedUsage: { count: number; items: DeprecationWarning[] };
    outdatedDependencies: { count: number; packages: OutdatedPackage[] };
    securityVulnerabilities: { count: number; items: SecurityIssue[] };
  };
  trendData: { date: string; score: number }[];
  payoffPriorities: DebtPayoffItem[];
}
```

### 2.3 Assessment Workflow

```yaml
# .github/workflows/autodoc-assess.yml
name: AutoDoc Assessment

on:
  schedule:
    - cron: '0 6 * * 1' # Weekly on Mondays
  workflow_dispatch:

jobs:
  assess:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for trend analysis

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Code Quality Assessment
        run: npm run assess:quality
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

      - name: Run Documentation Gap Analysis
        run: npm run assess:doc-gaps

      - name: Run Technical Debt Scoring
        run: npm run assess:tech-debt

      - name: Generate Combined Report
        run: npm run assess:report

      - name: Upload Assessment Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: assessment-reports
          path: docs/copilot/generated/assessments/

      - name: Create/Update Issue with Summary
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('docs/copilot/generated/assessments/summary.json'));
            
            const body = `## Weekly AutoDoc Assessment Report
            
            **Overall Health Score:** ${report.overallScore}/100
            
            ### Key Findings
            ${report.criticalFindings.map(f => `- ⚠️ ${f}`).join('\n')}
            
            ### Recommendations
            ${report.topRecommendations.map(r => `- ${r.priority}: ${r.title}`).join('\n')}
            
            [View Full Report](./docs/copilot/generated/assessments/full-report.md)
            `;
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `AutoDoc Assessment - ${new Date().toISOString().split('T')[0]}`,
              body,
              labels: ['documentation', 'automated']
            });
```

---

## Phase 3: Publishing (Multi-Audience Documentation)

### 3.1 Audience Matrix

| Audience | Purpose | Tone | Format | Artifacts |
|----------|---------|------|--------|-----------|
| **Developer** | Implementation reference | Technical, precise | MDX, code-heavy | API docs, architecture guides |
| **Academic** | Research & analysis | Formal, thorough | LaTeX-style MD | Whitepapers, technical reports |
| **Customer** | Demos & tutorials | Friendly, visual | Interactive SPA | Feature showcases, how-tos |

### 3.2 Developer Documentation Generator

```typescript
// scripts/publishers/developer-docs.ts
interface DeveloperDoc {
  id: string;
  title: string;
  type: 'architecture' | 'api' | 'guide' | 'reference';
  content: string; // MDX
  metadata: {
    lastUpdated: string;
    contributors: string[];
    reviewedBy: string[]; // Model names that reviewed
    groundTruthVersion: number;
    confidence: number; // 0-1, based on review consensus
  };
  codeBlocks: { language: string; code: string; explanation: string }[];
  relatedDocs: string[];
}

export async function generateDeveloperDoc(
  topic: string,
  codeMap: CodeMap,
  cliffNotes: CliffNote[],
  rosettaStone: RosettaStone
): Promise<DeveloperDoc> {
  // Multi-model review process
  const models = [
    { name: 'gemini-2.0-flash-exp', provider: 'google' },
    { name: 'gemini-1.5-pro', provider: 'google' },
  ];

  const drafts: string[] = [];
  
  for (const model of models) {
    const draft = await generateWithModel(model, topic, context);
    drafts.push(draft);
  }

  // Consensus merge
  const mergedContent = await mergeWithConsensus(drafts);
  
  // Confidence scoring
  const confidence = calculateConfidence(drafts, mergedContent);

  return {
    id: slugify(topic),
    title: topic,
    type: detectDocType(topic),
    content: mergedContent,
    metadata: {
      lastUpdated: new Date().toISOString(),
      contributors: ['AutoDoc'],
      reviewedBy: models.map(m => m.name),
      groundTruthVersion: 1,
      confidence,
    },
    codeBlocks: extractCodeBlocks(mergedContent),
    relatedDocs: findRelatedDocs(topic, rosettaStone),
  };
}
```

### 3.3 Ground Truth Architecture Document

The developer documentation includes a special "Ground Truth" document that represents the current authoritative understanding of the codebase:

```typescript
// scripts/publishers/ground-truth.ts
interface GroundTruthDoc {
  version: number;
  lastUpdated: string;
  reviewHistory: ReviewEvent[];
  sections: {
    systemOverview: string;
    architecture: {
      layers: ArchitectureLayer[];
      dataFlow: DataFlowDiagram;
      integrations: Integration[];
    };
    coreComponents: ComponentDoc[];
    dataModel: DataModelDoc;
    apiSurface: APISurfaceDoc;
    deploymentTopology: DeploymentDoc;
  };
  openQuestions: string[];
  knownLimitations: string[];
}

interface ReviewEvent {
  timestamp: string;
  reviewer: string; // Model or human
  changes: string[];
  confidence: number;
}

export async function updateGroundTruth(
  current: GroundTruthDoc,
  newAnalysis: AnalysisResult
): Promise<GroundTruthDoc> {
  // Compare new analysis with current understanding
  const deltas = detectDeltas(current, newAnalysis);
  
  if (deltas.length === 0) {
    return current; // No changes needed
  }

  // Multi-agent review of proposed changes
  const reviewers = ['gemini-2.0-flash-exp', 'gemini-1.5-pro'];
  const approvals: { reviewer: string; approved: boolean; comments: string }[] = [];

  for (const reviewer of reviewers) {
    const review = await reviewChanges(reviewer, current, deltas);
    approvals.push(review);
  }

  // Require majority approval for ground truth updates
  const approved = approvals.filter(a => a.approved).length > reviewers.length / 2;

  if (!approved) {
    // Log for human review
    await flagForHumanReview(current, deltas, approvals);
    return current;
  }

  // Apply approved changes
  const updated = applyDeltas(current, deltas);
  updated.version = current.version + 1;
  updated.lastUpdated = new Date().toISOString();
  updated.reviewHistory.push({
    timestamp: new Date().toISOString(),
    reviewer: reviewers.join(', '),
    changes: deltas.map(d => d.description),
    confidence: calculateAverageConfidence(approvals),
  });

  return updated;
}
```

### 3.4 Academic Documentation Generator

```typescript
// scripts/publishers/academic-docs.ts
interface AcademicDoc {
  id: string;
  title: string;
  abstract: string;
  sections: {
    introduction: string;
    background: string;
    methodology: string;
    implementation: string;
    evaluation: string;
    discussion: string;
    conclusion: string;
    references: Reference[];
  };
  figures: Figure[];
  metadata: {
    keywords: string[];
    acmCategories: string[];
    wordCount: number;
  };
}

export async function generateAcademicDoc(
  topic: string,
  groundTruth: GroundTruthDoc
): Promise<AcademicDoc> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `Generate an academic-style technical document about: ${topic}

Context from the codebase:
${JSON.stringify(groundTruth.sections, null, 2)}

Write in formal academic style suitable for a technical report or whitepaper.
Include proper section structure: Abstract, Introduction, Background, Methodology,
Implementation Details, Evaluation (if applicable), Discussion, Conclusion.

Use formal language, cite architectural decisions, and include technical depth
appropriate for a computer science audience.`;

  const result = await model.generateContent(prompt);
  return parseAcademicStructure(result.response.text());
}
```

### 3.5 Customer/Demo Documentation Generator

```typescript
// scripts/publishers/customer-docs.ts
interface CustomerDoc {
  id: string;
  title: string;
  tagline: string;
  sections: {
    hero: { headline: string; subheadline: string; cta: string };
    features: Feature[];
    howItWorks: Step[];
    useCases: UseCase[];
    faq: FAQ[];
  };
  visualAssets: {
    screenshots: string[];
    diagrams: string[];
    animations: string[];
  };
  interactiveElements: {
    demos: Demo[];
    tryItNow: TryItConfig;
  };
}

export async function generateCustomerDoc(
  feature: string,
  groundTruth: GroundTruthDoc
): Promise<CustomerDoc> {
  // Generate customer-friendly content
  const content = await generateCustomerContent(feature, groundTruth);
  
  // Generate visual assets
  const visuals = await generateVisualAssets(feature);
  
  // Configure interactive elements
  const interactive = await configureInteractive(feature);

  return {
    id: slugify(feature),
    title: content.title,
    tagline: content.tagline,
    sections: content.sections,
    visualAssets: visuals,
    interactiveElements: interactive,
  };
}
```

---

## Phase 4: SPA Exhibit Generation

### 4.1 Exhibit Architecture

Each document becomes an interactive SPA exhibit:

```typescript
// scripts/exhibit-generator/index.ts
import * as cheerio from 'cheerio';
import { marked } from 'marked';
import { compile } from '@mdx-js/mdx';

interface Exhibit {
  id: string;
  type: 'developer' | 'academic' | 'customer';
  title: string;
  description: string;
  htmlContent: string;
  interactiveComponents: ComponentConfig[];
  navigation: NavItem[];
  metadata: ExhibitMetadata;
}

export async function generateExhibit(
  doc: DeveloperDoc | AcademicDoc | CustomerDoc
): Promise<Exhibit> {
  // Convert MDX to HTML
  const mdxResult = await compile(doc.content, {
    jsx: true,
    development: false,
  });

  // Parse with Cheerio for enhancements
  const $ = cheerio.load(mdxResult.value);

  // Add interactive enhancements
  enhanceCodeBlocks($);
  addTableOfContents($);
  addCopyButtons($);
  addSearchHighlighting($);
  addDiagramRendering($);

  // Extract navigation
  const navigation = extractNavigation($);

  // Identify interactive components needed
  const components = identifyComponents($);

  return {
    id: doc.id,
    type: detectDocType(doc),
    title: doc.title,
    description: extractDescription($),
    htmlContent: $.html(),
    interactiveComponents: components,
    navigation,
    metadata: generateMetadata(doc),
  };
}

function enhanceCodeBlocks($: cheerio.CheerioAPI): void {
  $('pre code').each((i, el) => {
    const $code = $(el);
    const language = $code.attr('class')?.replace('language-', '') || 'text';
    
    // Wrap in interactive container
    $code.parent().wrap(`
      <div class="code-exhibit" data-language="${language}">
        <div class="code-header">
          <span class="language-badge">${language}</span>
          <button class="copy-btn" data-copy>Copy</button>
          <button class="expand-btn" data-expand>Expand</button>
        </div>
      </div>
    `);

    // Add line numbers
    const lines = $code.text().split('\n');
    const numbered = lines.map((line, i) => 
      `<span class="line" data-line="${i + 1}">${escapeHtml(line)}</span>`
    ).join('\n');
    $code.html(numbered);
  });
}
```

### 4.2 Docs Portal Structure

```
docs-portal/
├── src/
│   ├── exhibits/           # Generated SPA exhibits
│   │   ├── developer/
│   │   ├── academic/
│   │   └── customer/
│   ├── components/
│   │   ├── ExhibitShell.tsx    # Common exhibit wrapper
│   │   ├── CodeExhibit.tsx     # Interactive code viewer
│   │   ├── DiagramExhibit.tsx  # Mermaid/D3 diagrams
│   │   ├── SearchOverlay.tsx   # Global search
│   │   └── NavSidebar.tsx      # Navigation
│   ├── pages/
│   │   ├── index.tsx           # Landing with curated cards
│   │   ├── developer/          # Developer doc routes
│   │   ├── academic/           # Academic doc routes
│   │   └── customer/           # Customer doc routes
│   └── lib/
│       ├── cheerio-transforms.ts
│       ├── exhibit-loader.ts
│       └── search-index.ts
├── public/
│   └── exhibits/           # Pre-built static exhibits
└── scripts/
    ├── build-exhibits.ts   # Main build script
    └── watch-docs.ts       # Dev mode watcher
```

---

## GitHub Workflow: Complete Pipeline

```yaml
# .github/workflows/autodoc-full.yml
name: AutoDoc Complete Pipeline

on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - 'client/**'
      - 'shared/**'
      - 'docs/**'
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      phase:
        description: 'Phase to run'
        required: false
        default: 'all'
        type: choice
        options:
          - all
          - understand
          - assess
          - publish

env:
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

jobs:
  # ========================================
  # Phase 1: Understanding
  # ========================================
  understand:
    if: inputs.phase == 'all' || inputs.phase == 'understand' || github.event_name == 'push'
    runs-on: ubuntu-latest
    outputs:
      code-map-hash: ${{ steps.artifacts.outputs.code-map-hash }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Generate Code Map
        run: npm run autodoc:code-map
      
      - name: Generate Cliff Notes
        run: npm run autodoc:cliff-notes
      
      - name: Generate Rosetta Stone
        run: npm run autodoc:rosetta-stone
      
      - name: Upload Understanding Artifacts
        id: artifacts
        uses: actions/upload-artifact@v4
        with:
          name: understanding-artifacts
          path: docs/copilot/generated/
          retention-days: 30

  # ========================================
  # Phase 2: Assessment
  # ========================================
  assess:
    needs: understand
    if: inputs.phase == 'all' || inputs.phase == 'assess'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download Understanding Artifacts
        uses: actions/download-artifact@v4
        with:
          name: understanding-artifacts
          path: docs/copilot/generated/
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run Assessments
        run: |
          npm run autodoc:assess-quality
          npm run autodoc:assess-gaps
          npm run autodoc:assess-debt
      
      - name: Generate Assessment Report
        run: npm run autodoc:assessment-report
      
      - name: Comment on PR (if applicable)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('docs/copilot/generated/assessments/pr-summary.md', 'utf8');
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: report
            });

  # ========================================
  # Phase 3: Publishing
  # ========================================
  publish:
    needs: [understand, assess]
    if: inputs.phase == 'all' || inputs.phase == 'publish'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download All Artifacts
        uses: actions/download-artifact@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      # Developer Documentation
      - name: Generate Developer Docs
        run: npm run autodoc:developer-docs
      
      # Academic Documentation  
      - name: Generate Academic Docs
        run: npm run autodoc:academic-docs
      
      # Customer Documentation
      - name: Generate Customer Docs
        run: npm run autodoc:customer-docs
      
      # Ground Truth Update
      - name: Update Ground Truth
        run: npm run autodoc:ground-truth
      
      # SPA Exhibit Generation
      - name: Generate Exhibits
        run: npm run autodoc:exhibits
      
      # Build Portal
      - name: Build Docs Portal
        run: |
          cd docs-portal
          npm ci
          npm run build
      
      # Deploy
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-portal/dist
          cname: docs.meowstik.dev

  # ========================================
  # Approval Gate (for production)
  # ========================================
  approve:
    needs: publish
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Notify Approval Required
        run: echo "Documentation updates require approval before going live"
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Set up `docs/copilot/` directory structure
- [ ] Implement code-map generator
- [ ] Implement cliff-notes generator
- [ ] Implement rosetta-stone generator

### Week 2: Assessment
- [ ] Implement code quality assessor
- [ ] Implement documentation gap analyzer
- [ ] Implement technical debt scorer
- [ ] Create assessment report generator

### Week 3: Publishing
- [ ] Implement developer doc generator
- [ ] Implement academic doc generator
- [ ] Implement customer doc generator
- [ ] Set up ground truth system

### Week 4: SPA & Automation
- [ ] Build exhibit generator with Cheerio
- [ ] Create docs-portal Vite app
- [ ] Implement GitHub Actions workflow
- [ ] Deploy to GitHub Pages

---

## Open Questions

1. Should ground truth updates require human approval or just multi-model consensus?
2. What's the desired update frequency for automated assessments?
3. Should customer docs be generated on-demand or pre-built?
4. Integration with existing RAG system for doc search?

---

*End of Proposal*
