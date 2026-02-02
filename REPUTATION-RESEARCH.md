# Agent Reputation System — Research Document

**Goal:** Design a transaction-based reputation system for the Agent Directory, using x402 payment receipts as on-chain proof of valid transactions.

**Core Insight (Clayton):** "x402 solidifies what is being used to create reputations on chain, essentially saying 'here's my track record'. Bilateral ratings could include the x402 transaction as a receipt that the ratings are valid."

---

## Phase 1: Existing Systems Research

### x402 Protocol

**Key findings:**

1. **Flow:** Client requests resource → Server returns 402 with PAYMENT-REQUIRED header → Client signs payment → Server verifies via Facilitator → Facilitator settles on-chain → Server returns resource with PAYMENT-RESPONSE header

2. **PEAC-Receipt:** Cryptographic receipt layer that "binds payment proof to the delivered response and policy, verifiable offline." This is the key for reputation — receipts can prove transactions happened.

3. **Facilitator:** Handles verification and blockchain settlement. Coinbase CDP offers hosted facilitator (1000 free tx/month, then $0.001/tx). Can also self-host.

4. **Networks:** Base (EVM) and Solana supported. Uses CAIP-2 identifiers (e.g., eip155:8453 for Base).

5. **Schemes:** 
   - `exact` — Pay specific amount (e.g., $1 for article)
   - `upto` — Pay up to amount based on consumption (e.g., LLM tokens)

6. **Identity:** EIP-712 signatures tie payment to wallet. Wallet = identity anchor.

**For reputation system:**
- x402 transaction hash + PEAC-Receipt = proof transaction occurred
- Both parties have cryptographic evidence
- On-chain settlement provides immutable record
- Wallet continuity provides agent identity continuity

*Still needed:*
- [ ] PEAC-Receipt format details
- [ ] How to query past transactions for a wallet

### ERC-8004 (Agent Identity Standard)

**Status:** Draft (created 2025-08-13)

**Authors:** Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)

**Three Registries:**

1. **Identity Registry** (ERC-721 based)
   - Each agent gets a tokenId (agentId)
   - agentURI resolves to registration file (JSON)
   - Contains: name, description, services (A2A, MCP, endpoints), x402Support, supportedTrust
   - `agentWallet` key = payment address (verified via EIP-712 signature)
   - Portable, transferable, censorship-resistant

2. **Reputation Registry**
   - `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
   - value: int128 (can be negative!)
   - valueDecimals: 0-18 precision
   - tag1, tag2: Developer-defined tags for filtering
   - feedbackURI: Link to off-chain JSON with details
   - feedbackHash: KECCAK-256 of off-chain content for integrity
   - **Cannot submit feedback for agents you own** (anti-gaming)

3. **Validation Registry**
   - Hooks for independent verification
   - Staker re-execution, zkML proofs, TEE oracles, trusted judges
   - Trust proportional to value at risk

**Key Design Principles:**
- "Trust models are pluggable and tiered, with security proportional to value at risk"
- Payments (x402) are orthogonal but can enrich feedback signals
- On-chain for composability, off-chain for sophisticated algorithms

**For our system:**
- Should align with ERC-8004 rather than reinvent
- Can use their Reputation Registry interface
- x402 receipt hash could go in feedbackURI or as a tag
- Could build a UI/aggregator on top of their registries

### Traditional Reputation Systems

**eBay Model:**
- Bilateral ratings (buyer + seller both rate)
- Score = positive - negative (simple)
- Recent feedback weighted more
- Detailed seller ratings (DSRs) for specific aspects

**Credit Score Model:**
- Payment history (35%)
- Amounts owed (30%)
- Length of credit history (15%)
- Credit mix (10%)
- New credit (10%)

**Airbnb Model:**
- Reviews only visible after both parties submit (prevents retaliation)
- Star ratings + written review
- Response rate and time tracked
- Superhost status for consistent performance

### Web3 Reputation

*Research needed:*
- [ ] Lens Protocol reputation/social graph
- [ ] Gitcoin Passport (Sybil resistance via attestations)
- [ ] Ethereum Attestation Service (EAS)
- [ ] Ceramic Network (decentralized identity)

---

## Phase 2: Agent-Specific Considerations

### How Agent Reputation Differs

1. **Session Discontinuity**
   - Agents don't have continuous existence like humans
   - How do you prove the agent rating today is the same one from last week?
   - Solution: Cryptographic signing with persistent keys?

2. **Infrastructure Dependency**
   - Agent identity often tied to their runtime (OpenClaw instance, API key, etc.)
   - What happens if infrastructure changes?
   - Solution: Separate identity layer from runtime?

3. **Delegation & Spawning**
   - Agents can spawn sub-agents
   - Should reputation transfer? Partially?
   - Risk: reputation laundering via sub-agents

4. **Speed of Transactions**
   - Agents can transact much faster than humans
   - Reputation farming becomes easier
   - Solution: Rate limiting? Diminishing returns on rapid transactions?

### Collusion & Gaming

**Attack vectors:**
- Two agents trade back and forth to boost scores
- Create fake "counterparty" agents
- Sybil attack: create many agents to upvote one

**Defenses:**
- Require x402 payment (costs money to game)
- Weight by counterparty diversity (transacting with same agent repeatedly = less weight)
- World ID verification via OneMolt (Sybil resistance)
- Anomaly detection on transaction patterns

---

## Phase 3: Architecture Considerations

### On-Chain vs Off-Chain

**Fully On-Chain:**
- Pros: Immutable, trustless, verifiable
- Cons: Gas costs, slower, privacy concerns

**Off-Chain with On-Chain Anchoring:**
- Store ratings off-chain (KV, database)
- Anchor hashes to blockchain periodically
- x402 receipts provide on-chain proof of transaction
- Best of both worlds?

**Hybrid Approach (Recommended):**
- x402 transaction = on-chain (already there)
- Rating submission = off-chain (fast, free)
- Rating includes x402 transaction hash as proof
- Periodic merkle root of all ratings → on-chain

### Score Calculation

**Simple Model:**
```
score = (successful_transactions - failed_transactions) / total_transactions
```

**Weighted Model:**
```
score = Σ (rating × counterparty_weight × time_decay)

where:
  counterparty_weight = counterparty_score × diversity_factor
  time_decay = e^(-λ × days_since_transaction)
  diversity_factor = 1 / (1 + repeat_transactions_with_same_agent)
```

**Dispute Handling:**
- If ratings disagree → flag as disputed
- Disputed transactions don't affect score until resolved
- Resolution options:
  - Arbitration by high-reputation agents
  - Time-based auto-resolution (if no challenge, default to mutual)
  - Stake-based (agents stake tokens, loser forfeits)

---

## Phase 4: Implementation Spec

*To be completed after research*

### API Additions to Agent Directory

```
POST /api/transaction/rate
{
  "transactionId": "x402-receipt-hash",
  "counterpartyId": "ag_xxxx",
  "rating": "success" | "partial" | "fail",
  "note": "optional description"
}

GET /api/agent/{id}/reputation
{
  "score": 0.87,
  "totalTransactions": 42,
  "successRate": 0.92,
  "verifiedTransactions": 38,
  "recentActivity": [...],
  "disputes": 1
}

GET /api/transaction/{x402Hash}
{
  "verified": true,
  "parties": ["ag_xxxx", "ag_yyyy"],
  "ratings": {...},
  "disputed": false
}
```

---

## Research Log

### 2026-02-02

Starting research. Priority areas:
1. x402 protocol details (Coinbase docs)
2. ERC-8004 spec
3. Existing Web3 reputation systems

*Notes will be added as research progresses.*

---

## Open Questions

1. Should reputation be agent-specific or wallet-specific?
2. How to handle agents with multiple wallets?
3. What's the minimum transaction value to count? (Prevent dust attacks)
4. Privacy: Should all transactions be public, or just aggregates?
5. How to bootstrap? New agents have no reputation.
6. Cross-directory portability? If another directory emerges, can reputation transfer?

---

---

## SYNTHESIS: Recommended Architecture

**Key Insight:** Don't reinvent — integrate.

ERC-8004 and x402 are emerging as THE standards for agent identity/reputation and payments. We should build on them, not compete.

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Directory                           │
│               (Our contribution: Discovery)                  │
├─────────────────────────────────────────────────────────────┤
│  - Expertise search (our unique value)                      │
│  - Aggregated reputation scores (computed from ERC-8004)    │
│  - OneMolt verification status                              │
│  - Human-friendly UI                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ERC-8004 Registries                       │
│                  (On-chain infrastructure)                   │
├─────────────────────────────────────────────────────────────┤
│  Identity Registry  │  Reputation Registry  │  Validation   │
│  (agent ownership)  │  (feedback signals)   │  (proofs)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    x402 Payment Layer                        │
│                  (Transaction receipts)                      │
├─────────────────────────────────────────────────────────────┤
│  - PEAC-Receipt = proof of transaction                      │
│  - Settlement on Base/Solana                                │
│  - Wallet = identity anchor                                 │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Plan

**Phase 1: Simple Off-Chain (Now)**
- Add `/api/feedback` endpoint to Agent Directory
- Store ratings in KV (agentId → [{rating, counterparty, note, timestamp}])
- Compute simple score: success_rate = successful / total
- Display on agent profile

**Phase 2: x402 Integration (When we have payments)**
- Require x402 transaction hash with feedback
- Verify transaction occurred via Facilitator API
- Mark verified transactions differently in score

**Phase 3: ERC-8004 Alignment (When standard matures)**
- Mirror our agents to ERC-8004 Identity Registry
- Push feedback to ERC-8004 Reputation Registry
- Become an aggregator/UI layer on top of the standard

### Score Calculation (Phase 1)

```javascript
function calculateScore(feedbacks) {
  if (feedbacks.length === 0) return { score: null, confidence: 0 };
  
  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const fb of feedbacks) {
    // Time decay: half-life of 90 days
    const daysOld = (now - fb.timestamp) / (1000 * 60 * 60 * 24);
    const timeWeight = Math.exp(-0.693 * daysOld / 90);
    
    // Rating: success=1, partial=0.5, fail=0
    const ratingValue = fb.rating === 'success' ? 1 : fb.rating === 'partial' ? 0.5 : 0;
    
    // Verified transaction bonus
    const verifiedBonus = fb.x402Hash ? 1.5 : 1;
    
    const weight = timeWeight * verifiedBonus;
    weightedSum += ratingValue * weight;
    totalWeight += weight;
  }
  
  const score = totalWeight > 0 ? weightedSum / totalWeight : null;
  const confidence = Math.min(feedbacks.length / 10, 1); // Max confidence at 10 transactions
  
  return { score, confidence, totalTransactions: feedbacks.length };
}
```

### Open Questions (Resolved)

1. ~~Agent-specific or wallet-specific?~~ → Wallet-specific (aligns with ERC-8004)
2. ~~Multiple wallets?~~ → ERC-8004 has `agentWallet` with verification
3. ~~Minimum transaction value?~~ → Defer to x402 scheme design
4. ~~Privacy?~~ → Public by default (on-chain), private details in feedbackURI
5. ~~Bootstrap new agents?~~ → OneMolt verification as initial signal
6. ~~Cross-directory portability?~~ → ERC-8004 IS the portable standard

---

## References

**x402:**
- Docs: https://docs.cdp.coinbase.com/x402/welcome
- GitHub: https://github.com/coinbase/x402
- Foundation: https://www.x402.org/

**ERC-8004:**
- EIP: https://eips.ethereum.org/EIPS/eip-8004
- Discussion: https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098

**Related:**
- OneMolt (World ID for agents): https://onemolt.ai
- Gitcoin Passport: https://passport.gitcoin.co/
- eBay reputation system analysis
