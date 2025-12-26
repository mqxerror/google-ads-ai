# Epic 5: AI Chat Integration

**Goal:** Add collapsible AI chat panel with streaming responses and action suggestions.

---

## Story 5.1: Chat Panel UI

**As a** user,
**I want** an AI chat panel to ask questions,
**so that** I can get insights naturally.

**Acceptance Criteria:**
1. Collapsible panel on right side of screen
2. Text input at bottom
3. Chat history displayed as bubbles (user/AI)
4. Expand/collapse toggle in header
5. Clear history button

---

## Story 5.2: Streaming AI Responses

**As a** user,
**I want** AI responses to stream in real-time,
**so that** I don't wait for full response.

**Acceptance Criteria:**
1. Responses stream token-by-token via SSE
2. Typing indicator while generating
3. Smooth auto-scroll as content appears
4. Stop button to cancel long responses
5. Retry button on failures

---

## Story 5.3: Account Context in Chat

**As a** user,
**I want** the AI to know my account data,
**so that** responses are specific to me.

**Acceptance Criteria:**
1. AI receives current account summary as context
2. AI can reference specific campaigns by name
3. AI responses include actual numbers from data
4. Context refreshes when account data updates

---

## Story 5.4: Action Suggestions from Chat

**As a** user,
**I want** the AI to suggest actions I can execute,
**so that** recommendations are actionable.

**Acceptance Criteria:**
1. AI responses can include action buttons
2. Clicking button adds action to Action Queue
3. Actions clearly labeled: "Pause Campaign X"
4. Multiple actions can be suggested in one response
5. Actions have context from the conversation
