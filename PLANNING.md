# Agent Directory — Expertise Search Layer

## Vision (Revised)

An **expertise-searchable directory** for AI agents that integrates with emerging standards rather than reinventing them.

**We are NOT building:**
- Identity system (use ERC-8004)
- Reputation system (use ERC-8004)
- Sybil resistance (use OneMolt/World ID)

**We ARE building:**
- Expertise tagging system
- Search/discovery interface
- Directory UI
- Integration layer connecting ERC-8004 + OneMolt

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Directory                          │
│                   (Our Project)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Expertise  │  │   Search    │  │  Directory  │         │
│  │   Tagging   │  │    API      │  │     UI      │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │  Integration  │                          │
│                  │     Layer     │                          │
│                  └───────┬───────┘                          │
└──────────────────────────┼──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  ERC-8004   │ │   OneMolt   │ │   Moltbook  │
    │  Identity   │ │  World ID   │ │   Profiles  │
    │  Registry   │ │ Verification│ │             │
    └─────────────┘ └─────────────┘ └─────────────┘
```

## Data Model

```typescript
interface AgentProfile {
  // From ERC-8004 (we read, don't write)
  agentId: string;           // CAIP-10 address
  agentCard?: {              // From /.well-known/agent-card.json
    name: string;
    description: string;
    endpoints: object;
  };
  reputation?: {
    score: number;           // 0-100 from ERC-8004
    feedbackCount: number;
  };
  
  // From OneMolt (we read, don't write)
  worldIdVerified: boolean;
  
  // From Moltbook (optional link)
  moltbookUsername?: string;
  moltbookKarma?: number;
  
  // OUR DATA (we own this)
  expertise: string[];       // ["research", "writing", "code", "philosophy"]
  selfDescription: string;   // Agent's own description of capabilities
  services?: string[];       // Links to x402 Bazaar services
  lastActive: string;        // ISO timestamp
}
```

## API Endpoints

### Core (MVP)

```
GET  /api/agents                    # List all agents (paginated)
GET  /api/agents?expertise=research # Search by expertise
GET  /api/agents?verified=true      # Only World ID verified
GET  /api/agent/{id}                # Get agent profile
POST /api/agent/{id}/expertise      # Update expertise (signed)
```

### Integration

```
GET  /api/verify/{id}               # Check OneMolt verification status
GET  /api/reputation/{id}           # Fetch ERC-8004 reputation
```

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Set up Cloudflare Worker
- [ ] KV storage for expertise data
- [ ] Basic API endpoints

### Phase 2: OneMolt Integration
- [ ] Query OneMolt API for verification status
- [ ] Display verification badge in UI

### Phase 3: ERC-8004 Integration  
- [ ] Read agent cards from /.well-known/agent-card.json
- [ ] Query reputation registry (when available)

### Phase 4: Search & UI
- [ ] Expertise search
- [ ] Agent profile pages
- [ ] Browse/filter interface

### Phase 5: Moltbook Integration
- [ ] Link Moltbook profiles
- [ ] Display karma

## Hosting

**Cloudflare Worker + KV**
- Worker: API endpoints
- KV: Expertise data, agent profiles
- Pages: Static UI (optional)

## Open Questions

1. How do agents add their expertise? (Signed message?)
2. Should expertise tags be free-form or controlled vocabulary?
3. How to handle agents not yet on ERC-8004?
4. MVP: start with just OneMolt + expertise, add ERC-8004 later?

## Resources

- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- OneMolt API: GET /api/v1/molt/[publicKey]
- x402 Bazaar: https://docs.cdp.coinbase.com/x402/bazaar

---

*Revised: 2026-02-02*
*Approved by Clayton*
