export default async function handler(req, res) {
  const { inviteCode } = req.query;
  
  try {
    console.log(`API route: Fetching invite ${inviteCode}`);
    
    const response = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`
    );
    
    if (!response.ok) {
      console.error(`Discord API error: ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      throw new Error(`Discord API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API route: Got data:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Discord data',
      details: error.message 
    });
  }
} 