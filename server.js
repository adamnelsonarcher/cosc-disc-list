const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

app.use(cors());

app.get('/api/discord-invite/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;
    console.log(`Fetching invite data for: ${inviteCode}`);
    
    const response = await fetch(`https://discord.com/api/v9/invites/${inviteCode}`, {
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`Discord API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return res.status(response.status).json({ 
        error: 'Discord API error',
        status: response.status,
        details: text
      });
    }
    
    const data = await response.json();
    console.log(`Successfully fetched data for ${inviteCode}`);
    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Discord data',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bot Token length:', BOT_TOKEN?.length || 0);
  console.log('Bot Token prefix:', BOT_TOKEN?.substring(0, 10) || 'missing');
}); 