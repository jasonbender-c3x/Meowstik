import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import twilio from 'twilio';
import { Octokit } from '@octokit/rest';

async function testGemini() {
  console.log('\n--- Testing Gemini API Key ---');
  const keyRaw = process.env.GEMINI_API_KEY;
  if (!keyRaw) {
    console.error('❌ GEMINI_API_KEY is missing');
    return false;
  }

  const keys = keyRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
  let anySuccess = false;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      const result = await model.generateContent('Hello, are you working? Respond with "Yes".');
      const response = await result.response;
      const text = response.text();
      console.log(`✅ Key ${i+1}: Gemini Responded: "${text.trim()}"`);
      anySuccess = true;
    } catch (error: any) {
      console.error(`❌ Key ${i+1}: Gemini Failed: ${error.message}`);
    }
  }
  return anySuccess;
}

async function testGoogleSearch() {
  console.log('\n--- Testing Web Search (via Gemini Grounding) ---');
  const key = process.env.GEMINI_API_KEY;
  
  if (!key) {
    console.error('❌ GEMINI_API_KEY is missing (Required for Search)');
    return false;
  }
  
  const searchKey = key.split(',')[0].trim();

  try {
    const genAI = new GoogleGenerativeAI(searchKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash', 
        tools: [{ googleSearch: {} }] 
    });
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'What is the capital of France?' }] }]
    });
    const response = await result.response;
    const metadata = response.candidates?.[0]?.groundingMetadata;
    
    if (metadata?.searchEntryPoint || metadata?.groundingChunks) {
      console.log(`✅ Web Search Working (Gemini Grounding). Found answer: "${response.text().trim().substring(0, 50)}..."`);
      return true;
    } else {
      console.warn('⚠️ Web Search returned an answer but no search metadata. (Might have used internal knowledge)');
      return true; // Still a pass as long as it didn't error
    }
  } catch (error: any) {
    console.error(`❌ Web Search Failed: ${error.message}`);
    return false;
  }
}

async function testTwilio() {
  console.log('\n--- Testing Twilio Credentials ---');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  
  if (!sid || !token) {
    console.error('❌ Twilio Credentials missing (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)');
    return false;
  }

  try {
    const client = twilio(sid, token);
    const account = await client.api.v2010.accounts(sid).fetch();
    console.log(`✅ Twilio Authenticated. Account Name: ${account.friendlyName}, Status: ${account.status}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Twilio Failed: ${error.message}`);
    return false;
  }
}

async function testGitHub() {
  console.log('\n--- Testing GitHub PAT ---');
  const token = process.env.GITHUB_PAT;
  if (!token) {
    console.error('❌ GITHUB_PAT is missing');
    return false;
  }

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    console.log(`✅ GitHub Authenticated. User: ${data.login}`);
    return true;
  } catch (error: any) {
    console.error(`❌ GitHub Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Starting Comprehensive Key Verification...');
  
  const results = {
    gemini: await testGemini(),
    search: await testGoogleSearch(),
    twilio: await testTwilio(),
    github: await testGitHub()
  };

  console.log('\n\n=== SUMMARY ===');
  const failed = Object.entries(results).filter(([_, passed]) => !passed).map(([name]) => name);
  
  if (failed.length === 0) {
    console.log('🎉 All keys are working correctly!');
    process.exit(0);
  } else {
    console.error(`\n⚠️ The following keys failed verification: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
