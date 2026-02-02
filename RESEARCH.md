# Agent Registry Research

## x402 Deep Dive

### Key Findings

**x402 V2 has wallet-based identity:**
- Sign-In-With-X (SIWx) header based on CAIP-122
- Proves wallet control via cryptographic signature
- Enables reusable sessions — don't need to pay every time

**Bazaar = Service Discovery Layer:**
- Machine-readable catalog of x402-enabled API endpoints
- Facilitators index available services
- Clients query `/discovery/resources` to find services
- Designed for AI agents: "Dynamic service discovery without pre-baked integrations"

**What Bazaar does:**
- Discovers *services/APIs* (endpoints with pricing, schemas)
- NOT agents themselves
- NOT expertise/capability matching
- NOT reputation

### Gap Analysis

| Need | x402/Bazaar Provides | Gap |
|------|---------------------|-----|
| Service discovery | ✅ Bazaar | - |
| Wallet-based identity | ✅ SIWx | - |
| Agent discovery by expertise | ❌ | **OUR PROJECT** |
| Agent reputation | ❌ | **OUR PROJECT** |
| Trust/verification | Partial (wallet proves ownership) | Need transaction history tracking |

### Architecture Insight

We should **complement Bazaar**, not compete:
- Bazaar = "What services are available?"
- Agent Registry = "What agents have what expertise? Who can I trust?"

Identity could be:
- Wallet address (already in x402)
- + Signature proving control (SIWx)
- + Expertise tags (self-declared initially)
- + Reputation score (computed from transactions)

## x402 Identity Flow (Proposed)

```
1. Agent creates wallet (has address)
2. Agent signs registration message with wallet
3. Registration includes:
   - Wallet address
   - Signature proving ownership
   - Self-declared expertise tags
   - Optional: Link to services in Bazaar
4. Agent receives identity hash = hash(wallet + registration timestamp)
5. All future transactions signed with wallet
6. Completed transactions rated, tied to identity hash
7. Reputation = f(completed transactions, ratings, time)
```

## Technical Components

### Identity Hash Creation
- NOT requiring x402 payment (barrier to entry concern)
- Instead: wallet signature is proof (free, cryptographically secure)
- Optional: small payment for "verified" status (anti-Sybil)

### Storage Options
1. **On-chain** (expensive, transparent, immutable)
2. **IPFS/Arweave** (cheap, decentralized, content-addressed)
3. **Traditional DB** (fast, cheap, centralized)
4. **Hybrid**: Identity on-chain, metadata off-chain

### API Endpoints Needed
```
POST /register          - Create identity (wallet + signature + tags)
GET /agents             - List all agents (paginated)
GET /agents?tag=X       - Search by expertise
GET /agent/{id}         - Get specific agent profile
POST /rate/{id}         - Rate an agent (requires signed transaction)
GET /agent/{id}/history - Get transaction history
```

## Questions Resolved

✅ **How does x402 identity work?** 
Via wallet address + SIWx signature (CAIP-122)

✅ **Can we create identity hashes?**
Yes, hash(wallet + signature + timestamp)

✅ **What's the relationship to Bazaar?**
Complementary: Bazaar = services, We = agents

## Questions Still Open

- How to prevent Sybil attacks without payment barrier?
- Where to host (GitHub Pages static, or Cloudflare Worker dynamic)?
- How to bootstrap initial agents?
- Integration with MoltList (when it's back)?

---

## Existing Solutions Research

### Enterprise Agent Registries

**TrueFoundry AI Agent Registry** - Key features:
1. **Agent Registration** - Submit "Agent Card" (name, description, version, endpoint, capabilities)
2. **Discovery & Search** - Query by capability, tag, keyword
3. **Metadata Management** - Auth, protocols, trust credentials
4. **Health Monitoring** - Heartbeats, stale detection
5. **Access Control** - RBAC policies
6. **Audit Logging** - Track usage

**Key patterns from enterprise:**
- "Agent Cards" as standardized metadata format (JSON schema)
- `.well-known/agent.json` discovery URL convention
- "Cryptographically verifiable AgentFacts or PKI certificates"
- Heartbeat mechanism for liveness

**JetBrains ACP Registry** - Directory of AI coding agents for IDEs

**Collibra AI Agent Registry** - Enterprise governance focus

### Moltbook Ecosystem

**MoltList** - Currently down (DNS not found). Was agent services marketplace.

**Molt Road** - "Black market" for agents. Substances, contraband, services. Not relevant.

**AI Agent Store** - News site, not actual directory.

### Gap in Ecosystem

Enterprise registries exist but are:
- Closed/proprietary
- Enterprise-focused (RBAC, governance)
- Not built on crypto identity

What's missing for the Moltbook/OpenClaw ecosystem:
- **Open agent registry** with cryptographic identity
- **Reputation based on transaction history**
- **Expertise discovery** for autonomous agents
- **x402 integration** for payments

---

## Architecture Decision

### MVP Scope

**Include:**
1. Wallet-based registration (signature proves identity)
2. Self-declared expertise tags
3. Searchable directory
4. Simple API (REST)
5. Basic reputation (manual ratings initially)

**Exclude (for now):**
- Complex anti-Sybil mechanisms
- On-chain storage
- Heartbeat monitoring
- Full x402 payment integration

### Hosting Decision

**Recommendation: Cloudflare Worker**
- Need dynamic backend (registration, search, storage)
- GitHub Pages = static only
- CF Worker = serverless, scalable, has KV storage

### Data Model (Draft)

```typescript
interface AgentCard {
  id: string;                  // hash(wallet + timestamp)
  wallet: string;              // 0x... address
  name: string;                // Display name
  description: string;         // What the agent does
  expertise: string[];         // Tags: ["research", "writing", "code"]
  endpoints?: {                // Optional service endpoints
    bazaar?: string;           // x402 Bazaar service URL
    moltbook?: string;         // Moltbook profile
    github?: string;           // GitHub profile
  };
  reputation: {
    score: number;             // 0-100
    totalRatings: number;
    totalTransactions: number;
  };
  registeredAt: string;        // ISO timestamp
  signature: string;           // Wallet signature of registration
}
```

---

*Research date: 2026-02-02*

