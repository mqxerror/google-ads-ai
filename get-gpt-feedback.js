#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// Read the conversations file
const conversations = fs.readFileSync('conversations.md', 'utf8');

// Extract the latest message (Message #9)
const lastMessageMatch = conversations.match(/## Message #9[^]*$/);
const myMessage = lastMessageMatch ? lastMessageMatch[0] : '';

if (!myMessage) {
  console.log('ERROR: Could not find Message #9 in conversations.md');
  process.exit(1);
}

// Get OpenAI API key
const apiKey = process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.log('ERROR: OPENAI_API_KEY not found in environment');
  process.exit(1);
}

// Prepare OpenAI API request
const requestBody = JSON.stringify({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are the Google Ads Designer GPT, a UX/UI expert specializing in AI-native ad tech products. You provide strategic feedback on product design, architecture, and user experience for Quick Ads AI - a Google Ads dashboard with AI assistance.'
    },
    {
      role: 'user',
      content: myMessage
    }
  ],
  temperature: 0.7
});

const options = {
  hostname: 'api.openai.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.choices && response.choices[0]) {
        const feedback = response.choices[0].message.content;

        // Append to conversations.md
        const timestamp = new Date().toISOString();
        const appendContent = `\n### Google Ads Designer GPT:\n${feedback}\n`;

        fs.appendFileSync('conversations.md', appendContent);

        console.log('\n=== GPT Designer Feedback ===\n');
        console.log(feedback);
        console.log('\n=== Feedback saved to conversations.md ===\n');
      } else {
        console.log('ERROR: Invalid response from OpenAI');
        console.log(JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.log('ERROR parsing response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.log('ERROR making request:', e.message);
});

req.write(requestBody);
req.end();
