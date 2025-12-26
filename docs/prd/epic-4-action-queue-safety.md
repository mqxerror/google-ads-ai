# Epic 4: Action Queue & Safety Model

**Goal:** Implement staged write operations with review, guardrails, and audit logging.

---

## Story 4.1: Action Queue UI

**As a** user,
**I want** all my changes staged in a queue before execution,
**so that** I can review before committing.

**Acceptance Criteria:**
1. Action Queue drawer accessible from header (badge shows count)
2. Queue lists pending actions: Entity, Action, Current → New, Risk Level
3. Each action has Approve/Reject buttons
4. "Approve All" and "Clear All" buttons
5. Risk levels: Low (green), Medium (yellow), High (red)

---

## Story 4.2: Action Staging

**As a** user,
**I want** my actions (pause, budget change) to go to queue instead of immediate execution,
**so that** I don't make accidental changes.

**Acceptance Criteria:**
1. Pause/Enable actions add to queue (not immediate)
2. Budget changes add to queue with before/after values
3. Bulk actions add multiple items to queue
4. Toast notification: "Action added to queue (3 pending)"
5. Option to execute immediately for low-risk actions (setting)

---

## Story 4.3: Guardrails

**As a** user,
**I want** the system to warn me about risky changes,
**so that** I don't accidentally hurt my account.

**Acceptance Criteria:**
1. Budget change >50% flagged as High Risk
2. Cannot pause ALL active campaigns (error message)
3. Cannot set budget to $0 (must pause instead)
4. Pausing top-performing campaign (AI Score >80) shows warning
5. Guardrails configurable in Settings (advanced users can disable)

---

## Story 4.4: Action Execution

**As a** user,
**I want** to execute approved actions against Google Ads,
**so that** my changes take effect.

**Acceptance Criteria:**
1. "Execute" button processes approved actions
2. Progress indicator during execution
3. Success/failure status per action
4. Failed actions can be retried
5. Grid refreshes after execution completes

---

## Story 4.5: Audit Logging

**As a** user,
**I want** all changes logged with full details,
**so that** I have a history of what happened.

**Acceptance Criteria:**
1. Every executed action logged to database
2. Log includes: timestamp, user, action, entity, before/after, success/fail
3. Activity Log page shows chronological history
4. Filter by date, action type, entity
5. Export log to CSV

---

## Story 4.6: Rollback Capability

**As a** user,
**I want** to undo a recent change,
**so that** I can recover from mistakes.

**Acceptance Criteria:**
1. "Undo" button on recently executed actions (within 24h)
2. Undo adds reverse action to queue
3. Not all actions are reversible (noted in UI)
4. Rollback logged as separate action
