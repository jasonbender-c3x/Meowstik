import { VoiceStyle } from "../../shared/voice-styles.js";

/**
 * Extracts voice style tags from LLM response text.
 * Tags are in the format [style: <style_name>]
 * 
 * Example: "[style: cheerful] Hello world!" -> { style: VoiceStyle.Cheerful, text: "Hello world!" }
 */
export function parseVoiceStyle(text: string): { style: VoiceStyle; cleanText: string } {
  // Regex to match [style: name] at the start of the string (case insensitive)
  const bracketRegex = /^\[style:\s*([a-zA-Z]+)\]\s*/i;
  // Regex to match "emotion:" prefix (e.g. "cheerfully: Hello")
  const prefixRegex = /^([a-zA-Z]+):\s*/i;
  
  let match = text.match(bracketRegex);
  let styleName = "";
  
  // Check for [style: name]
  if (match && match[1]) {
    styleName = match[1].toLowerCase();
    const cleanText = text.replace(bracketRegex, "").trim();
    
    const matchedStyle = Object.values(VoiceStyle).find(
      s => s.toLowerCase() === styleName
    );

    if (matchedStyle) {
      return { style: matchedStyle, cleanText };
    }
  } 
  
  // Check for "emotion:" prefix if no bracket match
  match = text.match(prefixRegex);
  if (match && match[1]) {
       let potentialStyle = match[1].toLowerCase();
       let cleanText = text;
       
       // Simple normalization: remove 'ly' suffix (cheerfully -> cheerful)
       if (potentialStyle.endsWith('ly')) {
         potentialStyle = potentialStyle.slice(0, -2);
       }
       
       // Verify it's a valid style before stripping
       const matchedStyle = Object.values(VoiceStyle).find(
          s => s.toLowerCase() === potentialStyle
       );

       if (matchedStyle) {
          cleanText = text.replace(prefixRegex, "").trim();
          return { style: matchedStyle, cleanText };
       }
  }
  
  // Return default neutral style if no tag found or invalid tag
  return {
    style: VoiceStyle.Neutral,
    cleanText: text
  };
}
