# Campaign Type Support & Capability Matrix

## Supported Campaign Types (MVP)

All Google Ads campaign types are supported with varying levels of read/write capability:

| Campaign Type | Read Support | Write Support (MVP) | Write Support (Later) |
|---------------|--------------|---------------------|----------------------|
| **Search** | Full | Full | - |
| **Performance Max** | Full | Limited | Full |
| **Shopping** | Full | Moderate | Full |
| **Display** | Full | Limited | Moderate |
| **Video** | Full | Limited | Moderate |
| **Demand Gen** | Full | Limited | Moderate |
| **App** | Full | Minimal | Limited |

## Detailed Capability Matrix

### Search Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Keywords, RSAs, Search Terms | ✅ | - | Full read access |
| **Metrics Fetchable** | | | |
| Impressions, Clicks, CTR, Conversions, Cost, CPA, ROAS | ✅ | - | All standard metrics |
| Quality Score, Impression Share, Search Lost IS | ✅ | - | Advanced metrics |
| **Insights Generatable** | | | |
| Wasted spend analysis | ✅ | - | High-spend, low-conversion keywords |
| Negative keyword recommendations | ✅ | - | From search terms report |
| Ad copy performance comparison | ✅ | - | RSA asset analysis |
| Quality Score improvement suggestions | ✅ | - | Based on QS factors |
| Budget pacing alerts | ✅ | - | Over/under spending |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups, keywords, ads | ✅ | - | Core actions |
| Adjust campaign budgets | ✅ | - | With guardrails |
| Add negative keywords | ✅ | - | Campaign or ad group level |
| Adjust keyword bids | ✅ | - | Manual CPC only |
| Create new RSA variants | - | ✅ | AI-generated copy |
| Add new keywords | - | ✅ | From recommendations |

### Performance Max (PMax) Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Asset Groups, Assets, Listing Groups | ✅ | - | Read-only for most |
| **Metrics Fetchable** | | | |
| Impressions, Clicks, Conversions, Cost, ROAS | ✅ | - | Campaign-level metrics |
| Asset performance labels | ✅ | - | Best/Good/Low |
| Placement reports (where ads showed) | ✅ | - | Limited transparency |
| **Insights Generatable** | | | |
| Asset performance analysis | ✅ | - | Which assets work/don't |
| Audience signal effectiveness | - | ✅ | Limited API data |
| Search category insights | ✅ | - | Where PMax is showing |
| **Actions Executable** | | | |
| Pause/Enable campaigns | ✅ | - | Campaign level only |
| Adjust campaign budgets | ✅ | - | With guardrails |
| Adjust ROAS/CPA targets | ✅ | - | Bidding strategy |
| Add/remove assets | - | ✅ | Images, headlines, descriptions |
| Modify listing groups | - | ✅ | Product targeting |
| **Constraints** | | | |
| Cannot see/modify individual keywords | N/A | N/A | PMax limitation |
| Cannot see exact search terms | N/A | N/A | Google limitation |

### Shopping Campaigns (Standard)

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Product Groups, Products | ✅ | - | Full hierarchy |
| **Metrics Fetchable** | | | |
| All standard metrics + ROAS | ✅ | - | Product-level available |
| Product-level performance | ✅ | - | Via product groups |
| **Insights Generatable** | | | |
| Product performance ranking | ✅ | - | Best/worst sellers |
| Bid optimization suggestions | ✅ | - | Based on ROAS |
| Product group structure analysis | - | ✅ | Optimization suggestions |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups | ✅ | - | Standard actions |
| Adjust budgets | ✅ | - | With guardrails |
| Adjust product group bids | ✅ | - | Manual CPC |
| Exclude products | - | ✅ | Via product groups |
| Restructure product groups | - | ✅ | Advanced |

### Display Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Responsive Display Ads, Audiences, Placements | ✅ | - | |
| **Metrics Fetchable** | | | |
| Standard metrics + View-through conversions | ✅ | - | |
| Placement reports | ✅ | - | Where ads showed |
| **Insights Generatable** | | | |
| Placement quality analysis | ✅ | - | Flag junk placements |
| Audience performance comparison | ✅ | - | Which audiences convert |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups, ads | ✅ | - | |
| Adjust budgets | ✅ | - | |
| Exclude placements | - | ✅ | Block bad sites |
| Adjust audience bids | - | ✅ | |

### Video Campaigns (YouTube)

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Video Ads, Audiences | ✅ | - | |
| **Metrics Fetchable** | | | |
| Views, View Rate, CPV, Conversions | ✅ | - | Video-specific metrics |
| Audience retention (limited) | - | ✅ | Requires YouTube API |
| **Insights Generatable** | | | |
| Video performance comparison | ✅ | - | Which videos work |
| Audience targeting effectiveness | ✅ | - | |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups | ✅ | - | |
| Adjust budgets and bids | ✅ | - | |
| Modify targeting | - | ✅ | Audiences, topics |

### Demand Gen Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Assets | ✅ | - | Similar to PMax |
| **Metrics Fetchable** | | | |
| Standard metrics | ✅ | - | |
| Asset performance | ✅ | - | |
| **Insights Generatable** | | | |
| Asset performance analysis | ✅ | - | |
| **Actions Executable** | | | |
| Pause/Enable, budget adjustments | ✅ | - | |
| Asset modifications | - | ✅ | |

### App Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns (limited control by design) | ✅ | - | Google automates most |
| **Metrics Fetchable** | | | |
| Installs, In-app actions, Cost | ✅ | - | |
| **Insights Generatable** | | | |
| Performance trends | ✅ | - | Limited optimization levers |
| **Actions Executable** | | | |
| Pause/Enable campaigns | ✅ | - | |
| Adjust budgets and CPA targets | ✅ | - | |
| Asset changes | - | ✅ | Very limited |
| **Constraints** | | | |
| Most optimization is automated by Google | N/A | N/A | By design |
