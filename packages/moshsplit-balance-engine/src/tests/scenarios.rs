//! Exhaustive unit tests for moshsplit-balance-engine.
//!
//! Every scenario is tested as pure function calls — no DB, no Docker, no I/O.
//! These tests serve as the source of truth for balance formula correctness.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

use crate::balance::compute_balance;
use crate::redistribute::redistribute_shares;
use crate::simplified::simplified_debts;
use crate::types::UserBalance;

// ── Helpers ─────────────────────────────────────────────────────────────────

fn uid(s: &str) -> Uuid {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    let hash = hasher.finish();
    // v4 UUID from the hash (reproducible in this process)
    let mut bytes = [0u8; 16];
    bytes[..8].copy_from_slice(&hash.to_le_bytes());
    bytes[8..].copy_from_slice(&hash.to_le_bytes());
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122
    Uuid::from_bytes(bytes)
}

// ═══════════════════════════════════════════════════════════════════════════
// S1: Basic 2-user formula
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s1_basic_two_user_balance() {
    let a = uid("A");
    let b = uid("B");

    // A pays 2000, split equally 2 ways → each owes 1000.
    // A: paid=2000, owes=1000 → balance = +1000
    // B: paid=0, owes=1000 → balance = -1000
    assert_eq!(compute_balance(2000, 1000, 0, 0), 1000);
    assert_eq!(compute_balance(0, 1000, 0, 0), -1000);

    // Verify using simplified_debts
    let balances = vec![
        UserBalance { user_id: a, paid_cents: 2000, owes_cents: 1000, balance_cents: 1000 },
        UserBalance { user_id: b, paid_cents: 0, owes_cents: 1000, balance_cents: -1000 },
    ];
    let transfers = simplified_debts(&balances);
    assert_eq!(transfers.len(), 1);
    assert_eq!(transfers[0].from_user, b);
    assert_eq!(transfers[0].to_user, a);
    assert_eq!(transfers[0].amount_cents, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// S2: Core 5-user scenario
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s2_core_five_user() {
    let a = uid("A");
    let b = uid("B");
    let c = uid("C");
    let d = uid("D");
    let e = uid("E");

    // Expense 1: A pays 2000 split 5 ways → each share 400
    // Expense 2: B pays 4000 split 5 ways → each share 800
    //
    // A: paid=2000, owes=400+800=1200, bal=+800
    // B: paid=4000, owes=400+800=1200, bal=+2800
    // C: paid=0,    owes=400+800=1200, bal=-1200
    // D: paid=0,    owes=400+800=1200, bal=-1200
    // E: paid=0,    owes=400+800=1200, bal=-1200

    assert_eq!(compute_balance(2000, 1200, 0, 0), 800);
    assert_eq!(compute_balance(4000, 1200, 0, 0), 2800);
    assert_eq!(compute_balance(0, 1200, 0, 0), -1200);

    // Simplified debts: C/D/E (-1200 each) → A (+800) and B (+2800)
    let balances = vec![
        UserBalance { user_id: a, paid_cents: 2000, owes_cents: 1200, balance_cents: 800 },
        UserBalance { user_id: b, paid_cents: 4000, owes_cents: 1200, balance_cents: 2800 },
        UserBalance { user_id: c, paid_cents: 0, owes_cents: 1200, balance_cents: -1200 },
        UserBalance { user_id: d, paid_cents: 0, owes_cents: 1200, balance_cents: -1200 },
        UserBalance { user_id: e, paid_cents: 0, owes_cents: 1200, balance_cents: -1200 },
    ];
    let transfers = simplified_debts(&balances);
    // Greedy: C(1200)→B, D(1200)→B, E(400)→B, E(800)→A
    // Actually: B owes 2800. C owes 1200 -> B gets 1200 (B now owes 1600).
    // D owes 1200 -> B gets 1200 (B now owes 400).
    // E owes 1200 -> B gets 400 (B done), E still owes 800.
    // E owes 800 -> A gets 800 (A done).
    assert_eq!(transfers.len(), 4);
    // Verify total transfer = total positive
    let total: i32 = transfers.iter().map(|t| t.amount_cents).sum();
    assert_eq!(total, 3600); // 800 + 2800
}

// ═══════════════════════════════════════════════════════════════════════════
// S3: Payer not in split
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s3_payer_not_in_split() {
    // Host (H) pays 3000, split between A and B equally.
    // H: paid=3000, owes=0, bal=+3000
    // A: paid=0, owes=1500, bal=-1500
    // B: paid=0, owes=1500, bal=-1500
    assert_eq!(compute_balance(3000, 0, 0, 0), 3000);
    assert_eq!(compute_balance(0, 1500, 0, 0), -1500);

    let balances = vec![
        UserBalance { user_id: uid("H"), paid_cents: 3000, owes_cents: 0, balance_cents: 3000 },
        UserBalance { user_id: uid("A"), paid_cents: 0, owes_cents: 1500, balance_cents: -1500 },
        UserBalance { user_id: uid("B"), paid_cents: 0, owes_cents: 1500, balance_cents: -1500 },
    ];
    let transfers = simplified_debts(&balances);
    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers.iter().map(|t| t.amount_cents).sum::<i32>(), 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// S4: Custom splits
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s4_custom_splits() {
    // A pays 6000, custom split: A=1000, B=2000, C=3000
    assert_eq!(compute_balance(6000, 1000, 0, 0), 5000);
    assert_eq!(compute_balance(0, 2000, 0, 0), -2000);
    assert_eq!(compute_balance(0, 3000, 0, 0), -3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// S5: Percentage splits (rounding)
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s5_percentage_splits_rounding() {
    // A pays 100, split 3 ways: 33.33%, 33.33%, 33.34%
    // This is tested through compute_shares in pitboss-api.
    // At the balance-engine level, we just verify the formula.
    // Shares: A=34, B=33, C=33 (rounding), A paid 100.
    assert_eq!(compute_balance(100, 34, 0, 0), 66);
    assert_eq!(compute_balance(0, 33, 0, 0), -33);
}

// ═══════════════════════════════════════════════════════════════════════════
// S6: Multiple expenses overlapping
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s6_multiple_expenses() {
    // Same as S2 but explicitly testing the formula per-user
    // A pays in exp1(2000) and is in both splits
    // B pays in exp2(4000) and is in both splits
    // C, D, E are in both splits but pay nothing
    // A: paid=2000, owes=(400+800)=1200, bal=+800
    // B: paid=4000, owes=(400+800)=1200, bal=+2800
    assert_eq!(compute_balance(2000, 1200, 0, 0), 800);
    assert_eq!(compute_balance(4000, 1200, 0, 0), 2800);
}

// ═══════════════════════════════════════════════════════════════════════════
// S7: Payments (including the F6 payment sign verification)
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s7_payment_sign_verification() {
    // A pays 2000, split equally between A and B.
    // Before payment:
    //   A: paid=2000, owes=1000, bal=+1000
    //   B: paid=0, owes=1000, bal=-1000

    // B sends 300 to A.
    // A: paid=2000, owes=1000, pmts_in=300 → 2000-1000+0-300 = 700
    // B: paid=0, owes=1000, pmts_out=300 → 0-1000+300-0 = -700
    let a_bal = compute_balance(2000, 1000, 0, 300);
    let b_bal = compute_balance(0, 1000, 300, 0);
    assert_eq!(a_bal, 700, "A should have balance 700 after receiving 300 payment");
    assert_eq!(b_bal, -700, "B should have balance -700 after sending 300 payment");
    assert_eq!(a_bal + b_bal, 0, "balances must conserve (sum to zero)");
}

#[test]
fn s7_payment_multiple() {
    // A owes B 1000. A sends 400 to B, then A sends 300 to B.
    // A (debtor): pmts_out=400+300=700 → 0-1000+700-0 = -300
    // B (creditor): pmts_in=400+300=700 → 0-0+0-700 = -700
    // Wait, this doesn't make sense. Let's redo.
    //
    // Expense: A pays 2000 split equally A/B (each owes 1000).
    //   A: paid=2000, owes=1000 → +1000
    //   B: paid=0, owes=1000 → -1000
    // B sends A 400, then B sends A 300.
    //   A: pmts_in=700 → 2000-1000+0-700 = 300
    //   B: pmts_out=700 → 0-1000+700-0 = -300
    let a_bal = compute_balance(2000, 1000, 0, 700);
    let b_bal = compute_balance(0, 1000, 700, 0);
    assert_eq!(a_bal, 300);
    assert_eq!(b_bal, -300);
    assert_eq!(a_bal + b_bal, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// S8: Simplified debts greedy algorithm
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s8_simplified_debts_complex() {
    // Three users with complex inter-creditor/debtor patterns.
    // A: +500, B: +200, C: -700
    let a = uid("A");
    let b = uid("B");
    let c = uid("C");

    let balances = vec![
        UserBalance { user_id: a, paid_cents: 0, owes_cents: 0, balance_cents: 500 },
        UserBalance { user_id: b, paid_cents: 0, owes_cents: 0, balance_cents: 200 },
        UserBalance { user_id: c, paid_cents: 0, owes_cents: 0, balance_cents: -700 },
    ];

    let transfers = simplified_debts(&balances);
    // C owes 700. Greedy: C(700) → A(500): transfer 500, C still owes 200.
    // C(200) → B(200): transfer 200.
    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers[0].from_user, c);
    assert_eq!(transfers[0].to_user, a);
    assert_eq!(transfers[0].amount_cents, 500);
    assert_eq!(transfers[1].from_user, c);
    assert_eq!(transfers[1].to_user, b);
    assert_eq!(transfers[1].amount_cents, 200);
}

#[test]
fn s8_simplified_debts_all_debtors() {
    // Everyone owes — no creditors, no transfers
    let a = uid("A");
    let b = uid("B");
    let balances = vec![
        UserBalance { user_id: a, paid_cents: 0, owes_cents: 100, balance_cents: -100 },
        UserBalance { user_id: b, paid_cents: 0, owes_cents: 200, balance_cents: -200 },
    ];
    // Sum != 0, but that's an input error. The algorithm still works:
    // no creditors → no transfers
    let transfers = simplified_debts(&balances);
    assert!(transfers.is_empty());
}

// ═══════════════════════════════════════════════════════════════════════════
// S9: Zero-balance user
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s9_zero_balance_user() {
    // User with no expenses at all.
    assert_eq!(compute_balance(0, 0, 0, 0), 0);

    // In the simplified debts algorithm, zero-balance users should be ignored.
    let a = uid("A");
    let b = uid("B");
    let c = uid("C"); // zero balance
    let balances = vec![
        UserBalance { user_id: a, paid_cents: 2000, owes_cents: 1000, balance_cents: 1000 },
        UserBalance { user_id: b, paid_cents: 0, owes_cents: 1000, balance_cents: -1000 },
        UserBalance { user_id: c, paid_cents: 0, owes_cents: 0, balance_cents: 0 },
    ];
    let transfers = simplified_debts(&balances);
    assert_eq!(transfers.len(), 1);
    assert_eq!(transfers[0].from_user, b);
    assert_eq!(transfers[0].to_user, a);
}

// ═══════════════════════════════════════════════════════════════════════════
// S10: Rounding edge cases
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s10_rounding_edge_cases() {
    // 1 cent split 3 ways: 1/3 = 0 remainder 1
    // compute_shares: A=1, B=0, C=0
    // Our engine focuses on balance formula, but we verify the formula works
    // with small numbers
    assert_eq!(compute_balance(1, 1, 0, 0), 0);
    assert_eq!(compute_balance(0, 0, 0, 0), 0);

    // Negative amounts (shouldn't happen in practice but formula handles it)
    assert_eq!(compute_balance(-100, 50, 0, 0), -150);
    assert_eq!(compute_balance(100, -50, 0, 0), 150);
}

// ═══════════════════════════════════════════════════════════════════════════
// S11: Single member
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s11_single_member() {
    let a = uid("A");
    // A pays 1000, owes 1000 (split with self) → 0
    assert_eq!(compute_balance(1000, 1000, 0, 0), 0);

    let balances = vec![
        UserBalance { user_id: a, paid_cents: 1000, owes_cents: 1000, balance_cents: 0 },
    ];
    let transfers = simplified_debts(&balances);
    assert!(transfers.is_empty());
}

// ═══════════════════════════════════════════════════════════════════════════
// S12: Redistribution algorithm
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s12_redistribution_remove_member() {
    let a = uid("A");
    let b = uid("B");
    let _c = uid("C");

    // Original: A, B, C each shared 1000 total → ~333 each
    // C removed. Redistribute 1000 between A and B.
    let shares = redistribute_shares(&[(a, 333), (b, 333)], 1000);
    assert_eq!(shares.len(), 2);
    assert_eq!(shares.iter().map(|(_, s)| s).sum::<i32>(), 1000);
    // Equal split: 500 each
    assert_eq!(shares[0].1, 500);
    assert_eq!(shares[1].1, 500);
}

#[test]
fn s12_redistribution_add_member() {
    let a = uid("A");
    let b = uid("B");
    let c = uid("C");

    // Original: A, B each shared 1000 total → 500 each
    // C added. Redistribute 1000 among A, B, C.
    let shares = redistribute_shares(&[(a, 500), (b, 500), (c, 0)], 1000);
    assert_eq!(shares.len(), 3);
    assert_eq!(shares.iter().map(|(_, s)| s).sum::<i32>(), 1000);
    // 1000/3 = 333 remainder 1
    assert_eq!(shares[0].1, 334);
    assert_eq!(shares[1].1, 333);
    assert_eq!(shares[2].1, 333);
}

// ═══════════════════════════════════════════════════════════════════════════
// S13: Redistribution with existing payments
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn s13_redistribution_with_payments() {
    // Scenario: A pays 30 (split equally A, B, C → each owes 10).
    // B pays A 10 (payment).
    // C is removed. Redistribute 30 between A and B.
    //
    // Before removal:
    //   A: paid=30, owes=10, pmts_in=10 → 30-10+0-10 = 10
    //   B: paid=0, owes=10, pmts_out=10 → 0-10+10-0 = 0
    //   C: paid=0, owes=10 → -10
    //
    // After removal, C's 10 share is redistributed between A and B (5 each).
    //   A: paid=30, owes=15, pmts_in=10 → 30-15+0-10 = 5
    //   B: paid=0, owes=15, pmts_out=10 → 0-15+10-0 = -5
    //
    // Net: A should get 5 from B.
    //
    // The redistribution function just computes new shares:
    let a = uid("A");
    let b = uid("B");
    let shares = redistribute_shares(&[(a, 15), (b, 15)], 30);
    assert_eq!(shares.len(), 2);
    assert_eq!(shares[0].1, 15);
    assert_eq!(shares[1].1, 15);

    // After redistribution:
    assert_eq!(compute_balance(30, 15, 0, 10), 5);
    assert_eq!(compute_balance(0, 15, 10, 0), -5);
}

#[test]
fn s13_redistribution_odd_removal() {
    // A pays 100 split equally A/B/C → ~33 each.
    // B removed, redistribute 100 between A and C.
    let a = uid("A");
    let c = uid("C");
    let shares = redistribute_shares(&[(a, 34), (c, 33)], 100);
    assert_eq!(shares.len(), 2);
    assert_eq!(shares[0].1, 50);
    assert_eq!(shares[1].1, 50);
    assert_eq!(shares.iter().map(|(_, s)| s).sum::<i32>(), 100);
}
