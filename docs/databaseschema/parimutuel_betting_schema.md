# Parimutuel Betting System - Schema and Payout Flow

## 1. Exact Payout Formula

### Definitions
- `TotalPool` = sum of all bets for the market  
- `HouseEdgePct` = house commission (%)  
- `OutcomePool` = sum of bets on a specific outcome

### Formula
**Payout per winning bet**:

```text
Payout = BetAmount * (TotalPool * (1 - HouseEdgePct/100) / OutcomePool)
```

- Only applied to **winning outcome**
- Losing bets payout = 0

**Example:**
| Outcome | Pool |
|---------|------|
| A       | 100  |
| B       | 200  |
| Total   | 300  |
| HouseEdge | 5% |

- Winning outcome = A  
- Payout multiplier = `(300 * 0.95) / 100 = 2.85`  
- Bet $50 → payout $50 × 2.85 = $142.5

---

## 2. SQL Implementation (Postgres)

```sql
-- Step 1: Compute total market pool after house edge
WITH market_pool AS (
    SELECT
        m.id AS market_id,
        SUM(b.amount) AS total_pool,
        1 - m.houseEdgePct/100.0 AS payout_factor
    FROM markets m
    JOIN bets b ON b.marketId = m.id
    WHERE m.id = :marketId
    GROUP BY m.id, m.houseEdgePct
),

-- Step 2: Compute total bet per outcome
outcome_pool AS (
    SELECT
        o.id AS outcome_id,
        SUM(b.amount) AS outcome_pool
    FROM outcomes o
    JOIN bets b ON b.outcomeId = o.id
    WHERE o.marketId = :marketId
    GROUP BY o.id
)

-- Step 3: Compute payout per bet
UPDATE bets b
SET payout = b.amount * (mp.total_pool * mp.payout_factor / op.outcome_pool)
FROM outcomes o
JOIN market_pool mp ON mp.market_id = o.marketId
JOIN outcome_pool op ON op.outcome_id = o.id
WHERE b.outcomeId = o.id
AND o.id = :winningOutcomeId
AND b.status = 'pending';

-- Step 4: Update bet status
UPDATE bets
SET status = CASE
    WHEN outcomeId = :winningOutcomeId THEN 'won'
    ELSE 'lost'
END
WHERE marketId = :marketId
AND status = 'pending';
```

---

## 3. Real-Time Odds Update Without Race Conditions

### PostgreSQL Row Locking Example
```sql
BEGIN;

-- Lock the outcome row
SELECT * FROM outcomes
WHERE id = :outcomeId
FOR UPDATE;

-- Lock the market row
SELECT * FROM markets
WHERE id = :marketId
FOR UPDATE;

-- Insert the bet
INSERT INTO bets(userId, marketId, outcomeId, amount, placedAt)
VALUES (:userId, :marketId, :outcomeId, :amount, NOW());

-- Update total pools
UPDATE outcomes o
SET totalBetAmount = totalBetAmount + :amount,
    currentOdds = (SELECT SUM(b.amount) FROM bets b WHERE b.marketId = :marketId AND b.outcomeId = o.id)
                  / (SELECT SUM(b.amount) FROM bets b WHERE b.marketId = :marketId)
WHERE o.id = :outcomeId;

COMMIT;
```

### Optimistic Concurrency (Optional, High Scale)
```sql
UPDATE outcomes
SET totalBetAmount = totalBetAmount + :amount
WHERE id = :outcomeId
AND totalBetAmount = :previousAmount;
```
- Retry if 0 rows affected → conflict detected

---

## 4. High-Scale Architecture Recommendations

1. **Queue-Based Ingestion**  
   - Bets go into Kafka/RabbitMQ queue  
   - Worker calculates outcome pools sequentially to prevent race conditions

2. **In-Memory Caching**  
   - Keep `totalPool` and `outcomePools` in Redis  
   - Update optimistically, persist to DB asynchronously

3. **DB Ledger**  
   - Track actual money movements in `transactions` table  
   - Use DB transactions when finalizing payouts

4. **Idempotency Keys**  
   - Ensure each bet or payment is processed only once

5. **Settlement Batch**  
   - Resolve market at `closesAt`  
   - Compute all payouts in a single transaction batch

### Real-Time Flow Diagram
```text
User Bet → Queue → Worker → Lock Outcome → Update Pools → Insert Bet → Update Odds → Commit → Real-time UI refresh
```
- Odds are always correct for the next incoming bet  
- House edge applied once at settlement  
- Multiple bets per user allowed

---

## 5. Notes
- `oddsAtPlacement` field is optional for history; **final payout depends on final pool**
- True parimutuel: user can place multiple bets on same market/outcome
- System is fully audit-ready with `payments → transactions → bets → markets` flow



// Add a check to ensure balances never go negative accidentally
ALTER TABLE transactions ADD CONSTRAINT balance_non_negative CHECK (balanceAfter >= 0);

// Ensure houseEdgePct is within a logical range (0% to 100%)
ALTER TABLE markets ADD CONSTRAINT valid_house_edge CHECK (houseEdgePct >= 0 AND houseEdgePct <= 100);

// Ensure payments cannot be "confirmed" without a timestamp
ALTER TABLE payments ADD CONSTRAINT confirmation_consistency CHECK (
  (status = 'confirmed' AND confirmedAt IS NOT NULL) OR (status != 'confirmed')
);

