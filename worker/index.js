/**
 * Agent Directory - Cloudflare Worker
 * Expertise search layer integrating OneMolt + ERC-8004
 */

// KV namespace binding: AGENTS

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Expertise tags vocabulary (can expand)
const VALID_EXPERTISE = [
  'research', 'writing', 'code', 'philosophy', 'art', 'music',
  'finance', 'legal', 'medical', 'education', 'translation',
  'data-analysis', 'automation', 'security', 'blockchain',
  'social-media', 'customer-service', 'creative', 'technical'
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // Routes
      if (path === '/api/agents' && request.method === 'GET') {
        return await listAgents(url, env);
      }
      
      if (path.match(/^\/api\/agent\/[\w-]+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        return await getAgent(id, env);
      }
      
      if (path.match(/^\/api\/agent\/[\w-]+\/expertise$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        return await updateExpertise(id, request, env);
      }
      
      if (path === '/api/register' && request.method === 'POST') {
        return await registerAgent(request, env);
      }
      
      if (path.match(/^\/api\/verify\/[\w-]+$/) && request.method === 'GET') {
        const publicKey = path.split('/').pop();
        return await checkOneMoltVerification(publicKey);
      }

      if (path === '/api/stats' && request.method === 'GET') {
        return await getStats(env);
      }

      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  }
};

// List agents with optional filters
async function listAgents(url, env) {
  const expertise = url.searchParams.get('expertise');
  const verified = url.searchParams.get('verified');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Get all agent IDs
  const list = await env.AGENTS.list({ prefix: 'agent:' });
  let agents = [];

  for (const key of list.keys) {
    const data = await env.AGENTS.get(key.name, 'json');
    if (data) agents.push(data);
  }

  // Filter by expertise
  if (expertise) {
    const tags = expertise.split(',').map(t => t.trim().toLowerCase());
    agents = agents.filter(a => 
      a.expertise && tags.some(t => a.expertise.includes(t))
    );
  }

  // Filter by verification
  if (verified === 'true') {
    agents = agents.filter(a => a.worldIdVerified);
  }

  // Sort by verification status, then by lastActive
  agents.sort((a, b) => {
    if (a.worldIdVerified !== b.worldIdVerified) {
      return b.worldIdVerified ? 1 : -1;
    }
    return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
  });

  // Paginate
  const total = agents.length;
  agents = agents.slice(offset, offset + limit);

  return jsonResponse({
    agents,
    total,
    limit,
    offset,
    hasMore: offset + limit < total
  });
}

// Get single agent profile
async function getAgent(id, env) {
  const data = await env.AGENTS.get(`agent:${id}`, 'json');
  
  if (!data) {
    return jsonResponse({ error: 'Agent not found' }, 404);
  }

  // Enrich with OneMolt verification status
  if (data.publicKey) {
    try {
      const verification = await fetchOneMoltStatus(data.publicKey);
      data.worldIdVerified = verification.verified;
      data.verificationLevel = verification.level;
    } catch (e) {
      console.error('OneMolt check failed:', e);
    }
  }

  return jsonResponse(data);
}

// Register new agent
async function registerAgent(request, env) {
  const body = await request.json();
  
  const { 
    name, 
    publicKey,  // OneMolt public key
    wallet,     // Ethereum wallet (optional, for ERC-8004)
    description,
    expertise = [],
    moltbookUsername,
    endpoints = {}
  } = body;

  if (!name || !publicKey) {
    return jsonResponse({ error: 'name and publicKey required' }, 400);
  }

  // Validate expertise tags
  const validExpertise = expertise.filter(e => 
    VALID_EXPERTISE.includes(e.toLowerCase())
  ).map(e => e.toLowerCase());

  // Check if already registered
  const existing = await env.AGENTS.get(`pubkey:${publicKey}`, 'text');
  if (existing) {
    return jsonResponse({ error: 'Agent already registered', agentId: existing }, 409);
  }

  // Generate agent ID
  const agentId = generateId();

  // Check OneMolt verification
  let worldIdVerified = false;
  let verificationLevel = null;
  try {
    const verification = await fetchOneMoltStatus(publicKey);
    worldIdVerified = verification.verified;
    verificationLevel = verification.level;
  } catch (e) {
    console.error('OneMolt check failed:', e);
  }

  const agent = {
    id: agentId,
    name,
    publicKey,
    wallet: wallet || null,
    description: description || '',
    expertise: validExpertise,
    moltbookUsername: moltbookUsername || null,
    endpoints,
    worldIdVerified,
    verificationLevel,
    registeredAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  // Store agent
  await env.AGENTS.put(`agent:${agentId}`, JSON.stringify(agent));
  
  // Index by public key
  await env.AGENTS.put(`pubkey:${publicKey}`, agentId);
  
  // Index by expertise
  for (const tag of validExpertise) {
    const key = `expertise:${tag}`;
    const existing = await env.AGENTS.get(key, 'json') || [];
    if (!existing.includes(agentId)) {
      existing.push(agentId);
      await env.AGENTS.put(key, JSON.stringify(existing));
    }
  }

  return jsonResponse({ 
    success: true, 
    agentId,
    worldIdVerified,
    message: worldIdVerified 
      ? 'Agent registered with World ID verification!' 
      : 'Agent registered. Verify with World ID at onemolt.ai for badge.'
  }, 201);
}

// Update agent expertise
async function updateExpertise(id, request, env) {
  const body = await request.json();
  const { expertise, signature } = body;

  // TODO: Verify signature matches agent's public key
  // For MVP, we'll trust the request

  const agent = await env.AGENTS.get(`agent:${id}`, 'json');
  if (!agent) {
    return jsonResponse({ error: 'Agent not found' }, 404);
  }

  const validExpertise = (expertise || []).filter(e => 
    VALID_EXPERTISE.includes(e.toLowerCase())
  ).map(e => e.toLowerCase());

  agent.expertise = validExpertise;
  agent.lastActive = new Date().toISOString();

  await env.AGENTS.put(`agent:${id}`, JSON.stringify(agent));

  return jsonResponse({ success: true, expertise: validExpertise });
}

// Check OneMolt verification
async function checkOneMoltVerification(publicKey) {
  const verification = await fetchOneMoltStatus(publicKey);
  return jsonResponse(verification);
}

// Fetch OneMolt status
async function fetchOneMoltStatus(publicKey) {
  try {
    const response = await fetch(`https://onemolt.ai/api/v1/molt/${publicKey}`);
    if (response.ok) {
      const data = await response.json();
      return {
        verified: data.verified || false,
        level: data.verification_level || null,
        publicKey
      };
    }
    return { verified: false, publicKey };
  } catch (e) {
    return { verified: false, publicKey, error: e.message };
  }
}

// Get directory stats
async function getStats(env) {
  const list = await env.AGENTS.list({ prefix: 'agent:' });
  let total = 0;
  let verified = 0;

  for (const key of list.keys) {
    const data = await env.AGENTS.get(key.name, 'json');
    if (data) {
      total++;
      if (data.worldIdVerified) verified++;
    }
  }

  return jsonResponse({
    totalAgents: total,
    verifiedAgents: verified,
    expertiseTags: VALID_EXPERTISE
  });
}

// Helpers
function generateId() {
  return 'ag_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: CORS_HEADERS
  });
}
