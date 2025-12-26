/**
 * GPT Advisor Message Template
 *
 * Based on feedback from Google Ads Designer GPT (Message #3)
 * Use this template when presenting work for review
 */

export type FeedbackCategory =
  | 'UI Design'
  | 'AI Strategy'           // Renamed from AI Integration per GPT feedback
  | 'User Experience'
  | 'System Architecture'   // Renamed from Architecture per GPT feedback
  | 'Product Strategy'
  | 'Data Analysis'         // Added per GPT feedback
  | 'User Feedback Integration'; // Added per GPT feedback

export interface GPTMessageTemplate {
  objective: string;
  category: FeedbackCategory[];
  implementation: string;
  expectedOutcomes?: string;  // Added per GPT feedback: What success looks like
  challengesAndScope: {       // Merged per GPT feedback
    challenges: string[];
    openToFeedback: string[];
    alreadyDecided: string[];
  };
  questions: {
    priority: 'high' | 'medium' | 'low';
    question: string;
  }[];
  screenshots?: string[];     // Added per GPT feedback: Include for UI work
}

/**
 * Format a structured message for the GPT advisor
 */
export function formatGPTMessage(template: GPTMessageTemplate): string {
  const categoryList = template.category.map(c => `[x] ${c}`).join('  ');

  const questionsFormatted = template.questions
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .map((q, i) => `${i + 1}. [${q.priority.toUpperCase()}] ${q.question}`)
    .join('\n');

  const { challenges, openToFeedback, alreadyDecided } = template.challengesAndScope;

  let message = `## Objective
${template.objective}

## Category
${categoryList}

## Current Implementation
${template.implementation}
`;

  if (template.expectedOutcomes) {
    message += `
## Expected Outcomes
${template.expectedOutcomes}
`;
  }

  message += `
## Challenges & Scope
${challenges.length > 0 ? `**Challenges:**\n${challenges.map(c => `- ${c}`).join('\n')}\n` : ''}
**Open to feedback:**
${openToFeedback.map(s => `- ${s}`).join('\n')}

**Already decided:**
${alreadyDecided.map(s => `- ${s}`).join('\n')}

## Specific Questions (Priority Order)
${questionsFormatted}`;

  if (template.screenshots && template.screenshots.length > 0) {
    message += `\n\n## Screenshots\n${template.screenshots.map(s => `- ${s}`).join('\n')}`;
  }

  return message;
}

/**
 * Example usage for reference
 */
export const exampleMessage: GPTMessageTemplate = {
  objective: 'Add What-If scenario tool to AI Score drawer',
  category: ['UI Design', 'AI Strategy'],
  implementation: `Created sliders for CTR, Conversion Rate, CPC, and Quality Score.
Added dynamic chart showing projected AI Score changes.
Claude provides narrative explanations as user adjusts values.`,
  expectedOutcomes: 'Users can experiment with metric changes and see projected impact before taking action',
  challengesAndScope: {
    challenges: [
      'Edge cases where projected values are unrealistic',
      'Performance with real-time chart updates'
    ],
    openToFeedback: [
      'Slider ranges and defaults',
      'Chart visualization style',
      'Claude narrative tone'
    ],
    alreadyDecided: [
      'Will live in expandable drawer (not separate page)',
      'Uses existing AI Score formula'
    ]
  },
  questions: [
    { priority: 'high', question: 'Should we cap projected values to realistic ranges?' },
    { priority: 'medium', question: 'Should the chart show historical comparison?' },
    { priority: 'low', question: 'Any micro-interaction ideas for the sliders?' }
  ],
  screenshots: ['screenshots/ai-score-drawer-mockup.png']
};
