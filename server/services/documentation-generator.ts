/**
 * =============================================================================
 * DOCUMENTATION GENERATOR SERVICE
 * =============================================================================
 * 
 * AI-powered documentation generation system that analyzes the codebase
 * and creates comprehensive documentation including:
 * - API references
 * - Tutorials
 * - Guides
 * - Architecture overviews
 * 
 * The service uses Google's Gemini AI to understand code and generate
 * clear, concise, and helpful documentation automatically.
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { InsertGeneratedDoc, DocTypes } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Configuration for documentation generation
 */
export interface DocGenerationConfig {
  type: "api-reference" | "tutorial" | "guide" | "overview";
  title: string;
  category?: string;
  sourceFiles?: string[];
  context?: string;
  targetAudience?: "developer" | "user" | "contributor";
}

/**
 * Result of documentation generation
 */
export interface DocGenerationResult {
  success: boolean;
  doc?: InsertGeneratedDoc;
  error?: string;
}

/**
 * Generate a URL-friendly slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Read and analyze source files for documentation generation
 */
async function analyzeSourceFiles(filePaths: string[]): Promise<string> {
  const analyses: string[] = [];
  
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      
      // Get file extension for language context
      const ext = path.extname(filePath);
      const language = ext === ".ts" || ext === ".tsx" ? "TypeScript" :
                      ext === ".js" || ext === ".jsx" ? "JavaScript" :
                      ext === ".md" ? "Markdown" : "Text";
      
      analyses.push(`
## File: ${filePath}
Language: ${language}

\`\`\`${language.toLowerCase()}
${content}
\`\`\`
`);
    } catch (error) {
      console.warn(`Could not read file ${filePath}:`, error);
      analyses.push(`## File: ${filePath}\n(Could not read file)`);
    }
  }
  
  return analyses.join("\n\n");
}

/**
 * Generate API reference documentation
 */
export async function generateApiReference(config: DocGenerationConfig): Promise<DocGenerationResult> {
  try {
    const sourceAnalysis = config.sourceFiles && config.sourceFiles.length > 0
      ? await analyzeSourceFiles(config.sourceFiles)
      : "";
    
    const prompt = `You are a technical documentation expert. Generate comprehensive API reference documentation.

Title: ${config.title}
Category: ${config.category || "General"}
Target Audience: ${config.targetAudience || "developer"}

${config.context ? `Additional Context:\n${config.context}\n` : ""}

${sourceAnalysis ? `Source Code Analysis:\n${sourceAnalysis}\n` : ""}

Generate a complete API reference document in Markdown format that includes:
1. Overview of the API
2. Authentication (if applicable)
3. Endpoints or methods
4. Request/response formats
5. Examples
6. Error handling
7. Best practices

The documentation should be clear, comprehensive, and include practical examples.`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const content = result.text;
    
    const slug = generateSlug(config.title);
    const doc: InsertGeneratedDoc = {
      title: config.title,
      slug,
      type: DocTypes.API_REFERENCE,
      category: config.category,
      content,
      summary: `API reference documentation for ${config.title}`,
      generatedBy: "Meowstik AI Documentation Generator",
      sourceFiles: config.sourceFiles || [],
      version: "1.0.0",
      published: false,
      featured: false,
    };
    
    return { success: true, doc };
  } catch (error) {
    console.error("Error generating API reference:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate tutorial documentation
 */
export async function generateTutorial(config: DocGenerationConfig): Promise<DocGenerationResult> {
  try {
    const sourceAnalysis = config.sourceFiles && config.sourceFiles.length > 0
      ? await analyzeSourceFiles(config.sourceFiles)
      : "";
    
    const prompt = `You are a technical documentation expert specializing in tutorials. Generate a step-by-step tutorial.

Title: ${config.title}
Category: ${config.category || "General"}
Target Audience: ${config.targetAudience || "developer"}

${config.context ? `Additional Context:\n${config.context}\n` : ""}

${sourceAnalysis ? `Reference Code:\n${sourceAnalysis}\n` : ""}

Generate a complete tutorial in Markdown format that includes:
1. Introduction and learning objectives
2. Prerequisites
3. Step-by-step instructions with explanations
4. Code examples
5. Expected output/results
6. Common pitfalls and troubleshooting
7. Next steps or related tutorials

The tutorial should be beginner-friendly, well-structured, and include all necessary code examples.`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const content = result.text;
    
    const slug = generateSlug(config.title);
    const doc: InsertGeneratedDoc = {
      title: config.title,
      slug,
      type: DocTypes.TUTORIAL,
      category: config.category,
      content,
      summary: `Step-by-step tutorial: ${config.title}`,
      generatedBy: "Meowstik AI Documentation Generator",
      sourceFiles: config.sourceFiles || [],
      version: "1.0.0",
      published: false,
      featured: false,
    };
    
    return { success: true, doc };
  } catch (error) {
    console.error("Error generating tutorial:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate guide documentation
 */
export async function generateGuide(config: DocGenerationConfig): Promise<DocGenerationResult> {
  try {
    const sourceAnalysis = config.sourceFiles && config.sourceFiles.length > 0
      ? await analyzeSourceFiles(config.sourceFiles)
      : "";
    
    const prompt = `You are a technical documentation expert specializing in guides. Generate a comprehensive guide.

Title: ${config.title}
Category: ${config.category || "General"}
Target Audience: ${config.targetAudience || "developer"}

${config.context ? `Additional Context:\n${config.context}\n` : ""}

${sourceAnalysis ? `Reference Material:\n${sourceAnalysis}\n` : ""}

Generate a complete guide in Markdown format that includes:
1. Introduction and overview
2. Key concepts
3. How to use/implement
4. Best practices and patterns
5. Common use cases
6. Examples
7. Tips and recommendations
8. Related resources

The guide should be thorough, practical, and help users master the topic.`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const content = result.text;
    
    const slug = generateSlug(config.title);
    const doc: InsertGeneratedDoc = {
      title: config.title,
      slug,
      type: DocTypes.GUIDE,
      category: config.category,
      content,
      summary: `Comprehensive guide: ${config.title}`,
      generatedBy: "Meowstik AI Documentation Generator",
      sourceFiles: config.sourceFiles || [],
      version: "1.0.0",
      published: false,
      featured: false,
    };
    
    return { success: true, doc };
  } catch (error) {
    console.error("Error generating guide:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate overview/architecture documentation
 */
export async function generateOverview(config: DocGenerationConfig): Promise<DocGenerationResult> {
  try {
    const sourceAnalysis = config.sourceFiles && config.sourceFiles.length > 0
      ? await analyzeSourceFiles(config.sourceFiles)
      : "";
    
    const prompt = `You are a technical documentation expert specializing in architecture documentation. Generate a system overview.

Title: ${config.title}
Category: ${config.category || "General"}
Target Audience: ${config.targetAudience || "developer"}

${config.context ? `Additional Context:\n${config.context}\n` : ""}

${sourceAnalysis ? `Codebase Analysis:\n${sourceAnalysis}\n` : ""}

Generate a complete overview document in Markdown format that includes:
1. High-level system overview
2. Architecture diagram (described in text/ASCII)
3. Key components and their responsibilities
4. Data flow
5. Technology stack
6. Design patterns used
7. Scalability considerations
8. Related documentation

The overview should give readers a clear understanding of the system architecture and design.`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const content = result.text;
    
    const slug = generateSlug(config.title);
    const doc: InsertGeneratedDoc = {
      title: config.title,
      slug,
      type: DocTypes.OVERVIEW,
      category: config.category,
      content,
      summary: `System overview: ${config.title}`,
      generatedBy: "Meowstik AI Documentation Generator",
      sourceFiles: config.sourceFiles || [],
      version: "1.0.0",
      published: false,
      featured: false,
    };
    
    return { success: true, doc };
  } catch (error) {
    console.error("Error generating overview:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Main documentation generation function that routes to the appropriate generator
 */
export async function generateDocumentation(config: DocGenerationConfig): Promise<DocGenerationResult> {
  switch (config.type) {
    case "api-reference":
      return generateApiReference(config);
    case "tutorial":
      return generateTutorial(config);
    case "guide":
      return generateGuide(config);
    case "overview":
      return generateOverview(config);
    default:
      return { success: false, error: `Unknown documentation type: ${config.type}` };
  }
}

/**
 * Save generated documentation to the database
 */
export async function saveGeneratedDoc(doc: InsertGeneratedDoc): Promise<string> {
  const created = await storage.createGeneratedDoc(doc);
  return created.id;
}

/**
 * Generate and save documentation in one step
 */
export async function generateAndSave(config: DocGenerationConfig): Promise<{ success: boolean; docId?: string; error?: string }> {
  const result = await generateDocumentation(config);
  
  if (!result.success || !result.doc) {
    return { success: false, error: result.error };
  }
  
  try {
    const docId = await saveGeneratedDoc(result.doc);
    return { success: true, docId };
  } catch (error) {
    console.error("Error saving generated doc:", error);
    return { success: false, error: String(error) };
  }
}
