# Requirements

## Functional Requirements

**Authentication & Multi-Account Management**
- **FR1:** Users shall authenticate via Google OAuth 2.0 to connect Google Ads accounts
- **FR2:** Users shall connect multiple Google Ads accounts (up to 50)
- **FR3:** Users shall switch between connected accounts via account switcher dropdown
- **FR4:** The system shall securely store and refresh OAuth tokens for all connected accounts
- **FR5:** Users shall disconnect individual accounts at any time
- **FR6:** Users shall connect via MCC (Manager Account) to access client accounts
- **FR7:** The system shall display account name, ID, and health status in the account list

**Smart Grid Interface**
- **FR8:** The primary UI shall be an Airtable-style data grid with sortable, filterable columns
- **FR9:** Grid rows shall represent entities (Campaigns, Ad Groups, Keywords, Ads, Search Terms)
- **FR10:** Grid columns shall include: Name, Status, Type, Spend, Clicks, Conversions, CTR, CPA, ROAS, AI Score
- **FR11:** Users shall filter grid by any column value or combination
- **FR12:** Users shall sort grid by any column (ascending/descending)
- **FR13:** Users shall create and save custom views (filter + sort + column configurations)
- **FR14:** Users shall select multiple rows for bulk actions
- **FR15:** Grid shall support drill-down navigation (Campaign → Ad Groups → Keywords/Ads)
- **FR16:** Grid shall load and display data within 3 seconds
- **FR17:** Grid shall support pagination or virtual scrolling for large datasets (1000+ rows)
- **FR18:** Users shall toggle between Simple Mode and Pro Mode

**Simple Mode vs Pro Mode**
- **FR19:** Simple Mode shall display fewer columns with AI-focused recommendations
- **FR20:** Simple Mode shall show "Fix This" buttons for common issues
- **FR21:** Pro Mode shall display all available columns and metrics
- **FR22:** Pro Mode shall enable advanced filtering and bulk editing
- **FR23:** Mode preference shall persist per user

**AI Score & Recommendations**
- **FR24:** Each campaign/entity shall display an AI Score (0-100) indicating health
- **FR25:** AI Score shall be color-coded: green (70+), yellow (40-69), red (<40)
- **FR26:** Clicking AI Score shall reveal explanation and recommended actions
- **FR27:** AI shall generate prioritized recommendations per entity
- **FR28:** Recommendations shall include: issue description, impact estimate, and action button

**Action Queue & Safety Model**
- **FR29:** All write operations shall be staged in an Action Queue before execution
- **FR30:** Action Queue shall display pending actions with: entity, action type, current value, new value, risk level
- **FR31:** Users shall review and approve/reject individual actions or approve all
- **FR32:** High-risk actions shall require explicit confirmation with impact warning
- **FR33:** The system shall enforce guardrails: budget changes >50% require confirmation
- **FR34:** The system shall enforce guardrails: cannot pause all campaigns simultaneously
- **FR35:** Users shall undo executed actions within 24 hours (where API supports)
- **FR36:** All actions shall be logged with timestamp, user, before/after values

**AI Chat Interface**
- **FR37:** AI chat shall be accessible via collapsible side panel
- **FR38:** Users shall ask natural language questions about their account(s)
- **FR39:** AI responses shall stream in real-time
- **FR40:** AI shall reference actual account data in responses
- **FR41:** AI can suggest actions that populate the Action Queue
- **FR42:** Chat history shall persist during session
- **FR43:** Users shall clear chat history

**Campaign Management (All Types)**
- **FR44:** Users shall view all campaigns in Smart Grid with type indicator
- **FR45:** Users shall filter campaigns by type (Search, PMax, Shopping, etc.)
- **FR46:** Users shall pause/enable campaigns with one click
- **FR47:** Users shall adjust campaign budgets via inline edit or modal
- **FR48:** Users shall adjust bidding strategy targets (CPA, ROAS) where applicable

**Search Campaign Specific**
- **FR49:** Users shall view keywords with QS, match type, status, and metrics
- **FR50:** Users shall pause/enable keywords
- **FR51:** Users shall adjust keyword bids
- **FR52:** Users shall view search terms report with recommendations
- **FR53:** Users shall add negative keywords from recommendations
- **FR54:** Users shall view RSAs with asset-level performance

**Ad Regeneration Workflow**
- **FR55:** For underperforming ads, AI shall offer "Regenerate" option
- **FR56:** AI shall generate new ad copy variants based on top performers
- **FR57:** Generated ads shall be previewed before adding to Action Queue
- **FR58:** Users shall edit AI-generated copy before submission

**Reporting & Insights**
- **FR59:** System shall generate Wasted Spend analysis identifying budget leaks
- **FR60:** System shall provide device performance breakdown
- **FR61:** System shall provide day-of-week and hour-of-day performance heatmaps
- **FR62:** Users shall export grid data to CSV
- **FR63:** Users shall generate PDF reports (Phase 2)

**Audit Trail & Rollback**
- **FR64:** All changes shall be logged in Activity Log with full details
- **FR65:** Activity Log shall show: timestamp, user, action, entity, before/after values
- **FR66:** Users shall filter Activity Log by date, action type, entity
- **FR67:** Users shall rollback changes where Google Ads API supports

## Non-Functional Requirements

**Performance**
- **NFR1:** Smart Grid shall load within 3 seconds on standard broadband
- **NFR2:** AI chat responses shall begin streaming within 2 seconds
- **NFR3:** Account switching shall complete within 1 second
- **NFR4:** System shall handle accounts with up to 500 campaigns and 10,000 keywords
- **NFR5:** Virtual scrolling shall maintain 60fps for grids with 1000+ rows

**Security**
- **NFR6:** All data transmission shall use HTTPS/TLS 1.3
- **NFR7:** OAuth tokens shall be encrypted at rest (AES-256)
- **NFR8:** API keys shall never be exposed to client-side code
- **NFR9:** JWT tokens shall expire after 24 hours with refresh capability
- **NFR10:** Rate limiting: 100 requests/minute per user
- **NFR11:** Action Queue provides defense-in-depth against accidental changes

**Reliability**
- **NFR12:** System shall have 99.5% uptime excluding scheduled maintenance
- **NFR13:** System shall gracefully handle Google Ads API rate limits (15K ops/day)
- **NFR14:** Failed API calls shall retry with exponential backoff
- **NFR15:** System shall queue actions during API outages and retry when available

**Usability**
- **NFR16:** UI shall be responsive from 320px to 4K displays
- **NFR17:** UI shall follow WCAG 2.1 AA accessibility guidelines
- **NFR18:** Error messages shall be user-friendly with suggested actions
- **NFR19:** Keyboard navigation shall be fully supported in Smart Grid

**Data Freshness**
- **NFR20:** Campaign data shall be no more than 4 hours stale
- **NFR21:** Users shall manually trigger data refresh
- **NFR22:** Last sync timestamp shall be visible in UI
- **NFR23:** Critical metrics (spend, conversions) shall update more frequently (1 hour)

**Scalability**
- **NFR24:** Architecture shall support 10,000+ users
- **NFR25:** Database queries shall use proper indexing for sub-100ms response
- **NFR26:** Caching layer shall reduce Google Ads API calls by 80%

**Compliance**
- **NFR27:** System shall comply with Google Ads API Terms of Service
- **NFR28:** User data handling shall comply with GDPR requirements
- **NFR29:** System shall provide data export for user portability
