# AI-Powered Conference Calling System
## Intelligent Phone Operator with Gemini Live + Twilio

**Author**: Copilot  
**Date**: January 31, 2026  
**Domain**: meowstik.com  
**Status**: Proposal  
**Priority**: High

---

## Executive Summary

This proposal outlines an advanced AI-powered phone system that combines Gemini Live API (high-quality expressive audio) with Twilio's conference calling capabilities to create an intelligent hands-free operator. Meowstik will handle incoming calls, conduct natural conversations, add participants to conference calls, perform file operations, web searches, and act as a receptionist for your company.

---

## Requirements (From Problem Statement)

### Core Capabilities

1. **3-Way/Conference Calling**
   - Add multiple participants to a call
   - Merge calls into conferences
   - Control who's on the call

2. **High-Quality AI Conversation (Owner)**
   - Use Gemini Live for expressive, natural audio
   - Low-latency (~100ms) responses
   - Barge-in support (interrupt AI)

3. **Hands-Free Operator**
   - "Call John and add him to this call"
   - "Conference in the support team"
   - Voice-controlled call management

4. **File Operations During Calls**
   - Open files: "Open the Q4 report"
   - Write files: "Create a new meeting notes file"
   - Search files: "Find the contract with Acme Corp"

5. **Web Search During Calls**
   - "Search for the latest sales figures"
   - Real-time information lookup
   - Share findings verbally

6. **Receptionist Mode**
   - Greet callers professionally
   - Look up caller in database
   - Determine intent
   - Route to owner or handle directly
   - Engage in company-related conversations

7. **Conversation Steering**
   - Keep discussions on-topic (me, Meowstik, technology, company)
   - Redirect off-topic conversations politely
   - Professional boundary maintenance

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Incoming Call Flow                           │
└─────────────────────────────────────────────────────────────────┘

Phone Call → Twilio → Webhook → Caller Lookup → Decision Tree
                                       ↓
                        ┌──────────────┴──────────────┐
                        │                             │
                    Is Owner?                    Guest Caller
                        │                             │
                        ↓                             ↓
              ┌─────────────────┐          ┌─────────────────┐
              │  Gemini Live    │          │  Receptionist   │
              │  Full Access    │          │     Mode        │
              │                 │          │                 │
              │ • File ops      │          │ • Screening     │
              │ • Web search    │          │ • Routing       │
              │ • Conference    │          │ • Company info  │
              │ • All tools     │          │ • Limited tools │
              └─────────────────┘          └─────────────────┘
                        │                             │
                        └──────────────┬──────────────┘
                                       ↓
                          ┌────────────────────────┐
                          │  Twilio Conference     │
                          │  • Media Streams       │
                          │  • Add participants    │
                          │  • Mute/unmute         │
                          │  • Recording           │
                          └────────────────────────┘
```

---

## Technical Architecture

### Components

#### 1. Call Router (`server/routes/twilio-voice-ai.ts`)

Handles incoming calls and determines routing:

```typescript
POST /api/twilio/webhooks/voice-ai

- Receive call
- Look up caller in database
- Determine: Owner vs Guest
- Route to appropriate handler
- Initialize Gemini Live session
- Create conference if needed
```

#### 2. Gemini Live Bridge (`server/services/voice-conference-bridge.ts`)

Connects Twilio Media Streams to Gemini Live:

```typescript
- Establish WebSocket with Twilio (Media Streams)
- Connect to Gemini Live session
- Stream audio bidirectionally
- Handle barge-in (user interrupts AI)
- Manage conference participants
```

#### 3. Conference Manager (`server/services/conference-manager.ts`)

Manages Twilio conference rooms:

```typescript
- Create conference rooms
- Add/remove participants
- Dial out to numbers
- Mute/unmute participants
- Record conferences
- Get participant status
```

#### 4. Caller Database (`server/services/caller-database.ts`)

Simple database for caller information:

```typescript
interface CallerInfo {
  phoneNumber: string;
  name: string;
  company?: string;
  relationship: 'owner' | 'employee' | 'client' | 'vendor' | 'unknown';
  notes?: string;
  priority: 'high' | 'normal' | 'low';
  allowedTopics?: string[]; // What they can discuss
}
```

#### 5. Tool Extensions

New tools for voice calls:

```typescript
// Conference calling tools
- conference_add_participant(phoneNumber, name)
- conference_remove_participant(participantId)
- conference_mute_participant(participantId)
- conference_get_participants()

// File operation tools (voice-activated)
- voice_open_file(filename, description)
- voice_write_file(filename, content)
- voice_search_files(query)
- voice_read_file_snippet(filename, section)

// Call management tools
- voice_transfer_call(toNumber, reason)
- voice_take_message(message)
- voice_schedule_callback(time, notes)
```

---

## Call Workflows

### Workflow 1: Owner Calls In

```
1. Owner calls Twilio number
2. System recognizes owner (caller ID)
3. TwiML creates conference
4. Gemini Live connects via Media Streams
5. AI: "Hi Jason! How can I help you today?"
6. Owner: "Open the Q4 sales report"
7. AI: [Opens file] "I've opened Q4_Sales_Report.pdf. What would you like to know?"
8. Owner: "What were total sales?"
9. AI: [Reads file] "Total Q4 sales were $2.3 million, up 15% from Q3."
10. Owner: "Great! Call John Smith and add him to this call"
11. AI: [Dials John] "Calling John Smith now..."
12. [John answers, joins conference]
13. AI: "John has joined the call."
14. [Three-way conversation begins]
```

### Workflow 2: Client Calls In

```
1. Client calls Twilio number
2. System looks up number in database
3. Finds: "Acme Corp - Client - High Priority"
4. TwiML creates conference in receptionist mode
5. Gemini Live connects with receptionist persona
6. AI: "Good afternoon! Thank you for calling Meowstik Technologies. 
      This is your AI assistant. How may I help you today?"
7. Caller: "Hi, I'm calling about our project timeline"
8. AI: [Recognizes: Acme Corp client, project-related]
      "Of course! Let me pull up your project details. 
      You're currently in Phase 2 of the implementation, 
      scheduled for completion February 15th. 
      How can I assist you with the timeline?"
9. Caller: "Can we move the deadline up a week?"
10. AI: [Knows this requires owner approval]
      "That's an important decision. Let me connect you 
      with Jason who can discuss timeline adjustments."
11. [Transfers or adds owner to conference]
```

### Workflow 3: Unknown Caller

```
1. Unknown number calls
2. System has no database record
3. Gemini Live in screening mode
4. AI: "Thank you for calling Meowstik Technologies. 
      May I ask who's calling and the reason for your call?"
5. Caller: "This is Sarah from TechNews. We'd like to interview you about AI."
6. AI: [Evaluates: Media request, potentially relevant]
      "Thank you, Sarah. I'll take a message for Jason. 
      What's the best number to reach you?"
7. [Takes detailed message]
8. AI: "I've noted your request. Jason will review this and 
      get back to you within 24 hours. Thank you!"
9. [Sends SMS/email to owner with details]
```

### Workflow 4: Spam/Sales Call

```
1. Spam number calls
2. Gemini Live in screening mode
3. AI: "Thank you for calling. May I ask the purpose of your call?"
4. Caller: "I'm calling about your business's Google listing..."
5. AI: [Detects: Unsolicited sales pitch]
      "We're not interested in third-party services at this time. 
      If you have a specific business proposal, please email 
      hello@meowstik.com. Thank you for your call."
6. [Politely ends call]
7. [Logs call for review]
```

---

## Database Schema

### Callers Table

```sql
CREATE TABLE callers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  company VARCHAR,
  relationship VARCHAR NOT NULL, -- 'owner' | 'employee' | 'client' | 'vendor' | 'unknown'
  priority VARCHAR DEFAULT 'normal', -- 'high' | 'normal' | 'low'
  notes TEXT,
  allowed_topics TEXT[], -- Topics they can discuss
  auto_accept BOOLEAN DEFAULT FALSE, -- Bypass screening
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Owner's number
INSERT INTO callers (phone_number, name, relationship, priority, auto_accept, allowed_topics)
VALUES ('+15551234567', 'Jason (Owner)', 'owner', 'high', TRUE, ['*']);

-- Example client
INSERT INTO callers (phone_number, name, company, relationship, priority, allowed_topics)
VALUES ('+15559876543', 'Alice Johnson', 'Acme Corp', 'client', 'high', 
        ['projects', 'billing', 'support', 'technology']);
```

### Voice Conferences Table

```sql
CREATE TABLE voice_conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_sid VARCHAR UNIQUE NOT NULL,
  friendly_name VARCHAR,
  status VARCHAR NOT NULL, -- 'active' | 'completed'
  owner_user_id VARCHAR REFERENCES users(id),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration INTEGER, -- seconds
  recording_url TEXT,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conference_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID REFERENCES voice_conferences(id),
  call_sid VARCHAR NOT NULL,
  phone_number VARCHAR,
  name VARCHAR,
  role VARCHAR, -- 'owner' | 'guest' | 'ai'
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  duration INTEGER, -- seconds
  was_muted BOOLEAN DEFAULT FALSE
);
```

### Call Transcripts Table

```sql
CREATE TABLE call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID REFERENCES voice_conferences(id),
  speaker VARCHAR NOT NULL, -- 'owner' | 'ai' | phone number
  text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  confidence FLOAT,
  was_final BOOLEAN DEFAULT TRUE
);
```

---

## Implementation Plan

### Phase 1: Conference Calling Foundation (Week 1-2)

**Goal**: Basic 3-way calling with Twilio

**Tasks**:
- [ ] Set up Twilio Media Streams
- [ ] Create conference manager service
- [ ] Implement basic conference creation
- [ ] Add participant management
- [ ] Test 3-way calling

**Deliverable**: Working conference calls without AI

---

### Phase 2: Gemini Live Integration (Week 2-3)

**Goal**: Connect AI to voice calls

**Tasks**:
- [ ] Create voice-conference bridge
- [ ] Connect Gemini Live to Media Streams
- [ ] Implement audio streaming pipeline
- [ ] Add barge-in support
- [ ] Test AI conversation quality

**Deliverable**: AI can participate in calls

---

### Phase 3: Caller Database & Routing (Week 3-4)

**Goal**: Intelligent call routing

**Tasks**:
- [ ] Create caller database schema
- [ ] Implement lookup service
- [ ] Build routing logic (owner vs guest)
- [ ] Add receptionist persona
- [ ] Create screening logic

**Deliverable**: Different handling for different callers

---

### Phase 4: Voice-Activated Tools (Week 4-5)

**Goal**: File operations and web search

**Tasks**:
- [ ] Add conference calling tools
- [ ] Implement voice file operations
- [ ] Add voice-activated web search
- [ ] Create file search capability
- [ ] Test tool execution during calls

**Deliverable**: Full tool access via voice

---

### Phase 5: Advanced Features (Week 5-6)

**Goal**: Polish and optimize

**Tasks**:
- [ ] Add call recording
- [ ] Implement transcription
- [ ] Create conversation steering logic
- [ ] Add message taking
- [ ] Build callback scheduling
- [ ] Optimize latency

**Deliverable**: Production-ready system

---

### Phase 6: Testing & Documentation (Week 6-7)

**Goal**: Ready for deployment

**Tasks**:
- [ ] End-to-end testing
- [ ] Load testing
- [ ] Security audit
- [ ] Write user documentation
- [ ] Create admin dashboard

**Deliverable**: Documented, tested system

**Total Timeline**: 6-7 weeks

---

## Technical Specifications

### Twilio Media Streams

**Audio Format**:
- Codec: μ-law (G.711)
- Sample rate: 8kHz
- Mono channel
- Streaming: Base64-encoded chunks

**Connection**:
```xml
<Response>
  <Start>
    <Stream url="wss://meowstik.com/voice-stream" />
  </Start>
  <Dial>
    <Conference>room-${conferenceId}</Conference>
  </Dial>
</Response>
```

### Gemini Live Configuration

**Owner Mode**:
```typescript
{
  systemInstruction: `You are Meowstik, Jason's AI assistant in a voice call.
    
    You have full access to:
    - File operations (open, read, write, search)
    - Web searches
    - Conference calling (add/remove participants)
    - Calendar and contacts
    - All company information
    
    Be natural, concise, and helpful. You're having a conversation, 
    not writing an essay. Respond as if talking to a friend.
    
    When Jason asks you to call someone or add them to the call, 
    use the conference tools to dial them.`,
    
  voiceName: 'Kore',
  responseModalities: [Modality.AUDIO, Modality.TEXT],
  tools: [...allTools] // Full access
}
```

**Receptionist Mode**:
```typescript
{
  systemInstruction: `You are the AI receptionist for Meowstik Technologies.
    
    Your role:
    - Greet callers professionally
    - Determine their purpose
    - Screen calls appropriately
    - Route important calls to Jason
    - Handle inquiries about the company
    - Take messages when needed
    
    Topics you can discuss:
    - Meowstik (our AI platform)
    - Our technology and capabilities
    - General company information
    - Scheduling and contact information
    
    If the conversation goes off-topic (personal matters, unrelated 
    business, sales pitches), politely redirect or conclude the call.
    
    Always be professional, friendly, and helpful.`,
    
  voiceName: 'Aoede', // Different voice for receptionist
  responseModalities: [Modality.AUDIO, Modality.TEXT],
  tools: [...receptionistTools] // Limited access
}
```

---

## Cost Estimation

### Twilio Costs

```
Service                          Cost
────────────────────────────────────────
Incoming call (per minute)      $0.013
Outgoing call (per minute)      $0.013-0.026
Conference (per participant)    $0.013/min
Media Streams                   $0.004/min
Recording                       $0.0025/min
```

**Example Scenario** (100 hours/month):
```
Incoming calls: 3,000 min × $0.013 = $39.00
Conference (3-way avg): 1,000 min × $0.013 × 3 = $39.00
Media Streams: 4,000 min × $0.004 = $16.00
Recording: 4,000 min × $0.0025 = $10.00
────────────────────────────────────────
TOTAL: ~$104/month
```

### Gemini API Costs

Gemini Live is currently in preview - pricing TBD. Estimated:
- Audio input: ~$0.05 per 1000 characters equivalent
- Audio output: ~$0.10 per 1000 characters equivalent

**Estimated**: $20-40/month for moderate use

### Total Estimated Cost

**$120-150/month** for full AI phone system with conference calling

---

## Security & Privacy

### Call Recording

**Compliance**:
- Must announce recording at call start
- Store encrypted recordings
- Automatic deletion after 90 days
- Export capability for compliance

**Implementation**:
```typescript
AI: "This call may be recorded for quality and training purposes. 
     Do you consent to recording?"
```

### Data Protection

**Caller Information**:
- Encrypted phone numbers in database
- PII access limited to owner
- Audit logging for all lookups

**Transcripts**:
- End-to-end encryption
- User-controlled retention
- Export and delete capability

### Authentication

**Owner Verification**:
- Caller ID matching
- Optional PIN for verification
- Multi-factor for sensitive operations

**Guest Access**:
- Limited tool access
- Information boundaries
- Activity logging

---

## User Interface

### Web Dashboard

New page: `meowstik.com/voice-calls`

**Features**:
- Active calls display
- Conference participant list
- Call history
- Recordings & transcripts
- Caller database management
- Call analytics

### Call Controls

**During Call**:
```
┌─────────────────────────────────────┐
│  Active Call with Jason              │
│  Duration: 5:32                      │
├─────────────────────────────────────┤
│  🎤 Mute    📞 Add    🔴 End        │
│                                     │
│  Participants:                      │
│  • Jason (Owner)                    │
│  • Meowstik AI                      │
│  • John Smith (+1-555-0123)         │
│                                     │
│  [Transcript]                       │
│  Jason: "Call John Smith"           │
│  AI: "Calling John Smith now..."    │
│  [Ringing...]                       │
│  AI: "John has joined the call."    │
└─────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('ConferenceManager', () => {
  it('creates conference room');
  it('adds participant to conference');
  it('removes participant from conference');
  it('mutes/unmutes participant');
});

describe('CallerDatabase', () => {
  it('looks up caller by phone number');
  it('determines caller relationship');
  it('respects allowed topics');
});

describe('VoiceConferenceBridge', () => {
  it('streams audio from Twilio to Gemini');
  it('streams audio from Gemini to Twilio');
  it('handles barge-in');
  it('manages multiple participants');
});
```

### Integration Tests

```typescript
describe('Full Call Flow', () => {
  it('owner calls in, AI answers, conducts conversation');
  it('AI adds participant to conference via voice command');
  it('AI opens file and reads content during call');
  it('AI performs web search and reports findings');
  it('receptionist mode screens unknown caller');
  it('receptionist routes important call to owner');
});
```

### Load Tests

- 10 concurrent conferences
- 50 participants total
- Audio streaming performance
- Latency measurements

---

## Success Metrics

### Performance

- **Latency**: <200ms AI response time
- **Uptime**: 99.9% availability
- **Call Quality**: MOS score >4.0
- **Accuracy**: <5% transcription errors

### User Experience

- **First-call resolution**: >80%
- **Call screening accuracy**: >95%
- **User satisfaction**: >4.5/5
- **Feature adoption**: >70% of calls use AI

### Business Impact

- **Time saved**: 10+ hours/week
- **Missed calls**: Reduced by 90%
- **Response time**: <2 minutes average
- **ROI**: Positive within 3 months

---

## Risks & Mitigation

### Technical Risks

**Risk**: Audio quality issues
**Mitigation**: Extensive testing, fallback to standard TTS, quality monitoring

**Risk**: Latency exceeds acceptable limits
**Mitigation**: Optimize pipeline, use dedicated servers, CDN for audio

**Risk**: Gemini Live API changes
**Mitigation**: Abstract API layer, maintain fallback options

### Business Risks

**Risk**: Regulatory compliance (call recording)
**Mitigation**: Legal review, consent management, compliant storage

**Risk**: Privacy concerns
**Mitigation**: Transparent data handling, user controls, encryption

**Risk**: AI makes errors in important calls
**Mitigation**: Human oversight option, confidence thresholds, escalation

---

## Future Enhancements

### Phase 2 Features

1. **Video Conferencing** (Gemini 3.0)
   - Add video to conferences
   - Screen sharing
   - Visual cues to AI

2. **Multi-language Support**
   - Automatic language detection
   - Real-time translation
   - 24+ language support

3. **Advanced Screening**
   - ML-based spam detection
   - Caller verification
   - Fraud prevention

4. **CRM Integration**
   - Sync with Salesforce
   - Update deal stages
   - Log call notes automatically

5. **Analytics Dashboard**
   - Call patterns
   - Topic analysis
   - Performance metrics
   - Cost tracking

6. **Mobile App**
   - Make/receive calls on mobile
   - Push notifications
   - Call management on-the-go

---

## Conclusion

This AI-powered conference calling system transforms Meowstik into an intelligent phone operator that can:

✅ Handle incoming calls professionally
✅ Conduct natural, expressive conversations
✅ Manage 3-way and conference calls
✅ Perform file operations and web searches
✅ Act as a receptionist and screener
✅ Route calls appropriately
✅ Take messages and schedule callbacks

**Key Advantages**:
- 24/7 availability
- Never misses a call
- Consistent professional experience
- Reduces admin burden
- Scales effortlessly

**Recommended Next Step**: Start with **Phase 1** (conference calling foundation) to validate the architecture, then expand to AI integration in Phase 2.

---

## Ready to Build?

Let me know if you want to:
1. ✏️ **Adjust the proposal** (features, timeline, etc.)
2. 🚀 **Start implementation** (Phase 1: Conference calling)
3. 🎨 **See detailed specs** (API design, data flows)
4. 📊 **Get cost breakdown** (detailed Twilio pricing)
5. ❓ **Ask questions** (anything unclear?)

**Next Step**: Say "Let's build it!" and I'll start with Phase 1! 🎉

