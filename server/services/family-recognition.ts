/**
 * =============================================================================
 * FAMILY RECOGNITION SERVICE
 * =============================================================================
 * 
 * Single-user auth with family member catch-phrase recognition.
 * Per v2 philosophy (01-core-philosophy.md):
 * 
 * - Creator: Jason (implicit, always authed)
 * - Family (6): Catch phrase recognition for personalization
 * - Everyone else: No access (self-enforcing via OAuth)
 * 
 * Family members can say their secret phrase to be recognized by name.
 * This provides personalization without elevated privileges.
 * 
 * =============================================================================
 */

export interface FamilyMember {
  name: string;
  catchPhrases: string[];
  relationship: string;
  greeting?: string;
}

/**
 * Family member definitions with their catch phrases
 * Phrases are case-insensitive and matched as substrings
 */
const FAMILY_MEMBERS: FamilyMember[] = [
  {
    name: "Jason",
    catchPhrases: ["compiler mode", "the compiler", "system admin"],
    relationship: "creator",
    greeting: "Welcome back, Jason.",
  },
  {
    name: "Amy",
    catchPhrases: ["sunshine girl", "amy here"],
    relationship: "wife",
    greeting: "Hello Amy! How can I help you today?",
  },
  {
    name: "Ethan",
    catchPhrases: ["player one", "ethan speaking"],
    relationship: "son",
    greeting: "Hey Ethan! What's up?",
  },
  {
    name: "Emma",
    catchPhrases: ["sparkle princess", "emma here"],
    relationship: "daughter",
    greeting: "Hi Emma! Nice to see you!",
  },
  {
    name: "Grandma",
    catchPhrases: ["cookie time", "grandma calling"],
    relationship: "grandmother",
    greeting: "Hello! How are you today?",
  },
  {
    name: "Grandpa",
    catchPhrases: ["workshop mode", "grandpa here"],
    relationship: "grandfather",
    greeting: "Good to hear from you! What can I help with?",
  },
];

/**
 * Current recognized family member for the session
 * Default to Jason (creator) - per v2 philosophy: "implicit, always authed"
 */
let currentFamilyMember: FamilyMember | null = FAMILY_MEMBERS[0]; // Jason is always the default

/**
 * Check if a message contains a family member's catch phrase
 * @param message - The message to check
 * @returns The recognized family member or null
 */
export function recognizeFamilyMember(message: string): FamilyMember | null {
  const lowerMessage = message.toLowerCase();
  
  for (const member of FAMILY_MEMBERS) {
    for (const phrase of member.catchPhrases) {
      if (lowerMessage.includes(phrase.toLowerCase())) {
        currentFamilyMember = member;
        console.log(`[family] Recognized: ${member.name} (${member.relationship})`);
        return member;
      }
    }
  }
  
  return null;
}

/**
 * Get the currently recognized family member
 */
export function getCurrentFamilyMember(): FamilyMember | null {
  return currentFamilyMember;
}

/**
 * Reset family member to default (Jason)
 * Per v2 philosophy: Jason is always the implicit default
 */
export function resetFamilyMember(): void {
  currentFamilyMember = FAMILY_MEMBERS[0]; // Reset to Jason
}

/**
 * Get personalization context for the AI prompt
 * @returns Personalization string for system prompt or empty string
 */
export function getFamilyContext(): string {
  if (!currentFamilyMember) {
    return "";
  }
  
  return `
[FAMILY MEMBER RECOGNIZED]
Name: ${currentFamilyMember.name}
Relationship: ${currentFamilyMember.relationship}
Personalize responses for ${currentFamilyMember.name}. Use a friendly, appropriate tone for this ${currentFamilyMember.relationship}.
`;
}

/**
 * Check if the current user is the creator (Jason)
 */
export function isCreator(): boolean {
  return currentFamilyMember?.name === "Jason";
}

/**
 * Get all family members (for admin/debug purposes)
 */
export function getAllFamilyMembers(): FamilyMember[] {
  return [...FAMILY_MEMBERS];
}

/**
 * Add a new catch phrase for a family member
 * @param name - Family member name
 * @param phrase - New catch phrase to add
 */
export function addCatchPhrase(name: string, phrase: string): boolean {
  const member = FAMILY_MEMBERS.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (member) {
    member.catchPhrases.push(phrase.toLowerCase());
    console.log(`[family] Added phrase "${phrase}" for ${member.name}`);
    return true;
  }
  return false;
}

export default {
  recognizeFamilyMember,
  getCurrentFamilyMember,
  resetFamilyMember,
  getFamilyContext,
  isCreator,
  getAllFamilyMembers,
  addCatchPhrase,
};
