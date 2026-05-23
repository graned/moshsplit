use uuid::Uuid;

use crate::types::{SimplifiedTransfer, UserBalance};

/// Compute the minimal set of debt transfers using a greedy algorithm.
///
/// Algorithm:
/// 1. Split users into creditors (balance > 0) and debtors (balance < 0).
/// 2. Sort both lists by absolute amount descending.
/// 3. Repeatedly match the largest creditor with the largest debtor,
///    transferring `min(creditor_balance, debtor_balance)`.
///
/// This produces at most `n-1` transfers where `n` is the number of
/// non-zero-balance users. The algorithm is deterministic (ties broken
/// by user_id order due to stable sort).
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use moshsplit_balance_engine::{UserBalance, simplified_debts};
///
/// let a = Uuid::new_v4();
/// let b = Uuid::new_v4();
/// let c = Uuid::new_v4();
///
/// let balances = vec![
///     UserBalance { user_id: a, paid_cents: 2000, owes_cents: 1000, balance_cents: 1000 },
///     UserBalance { user_id: b, paid_cents: 0, owes_cents: 1000, balance_cents: -1000 },
/// ];
///
/// let transfers = simplified_debts(&balances);
/// assert_eq!(transfers.len(), 1);
/// assert_eq!(transfers[0].from_user, b);
/// assert_eq!(transfers[0].to_user, a);
/// assert_eq!(transfers[0].amount_cents, 1000);
/// ```
pub fn simplified_debts(balances: &[UserBalance]) -> Vec<SimplifiedTransfer> {
    // Separate debtors (negative balance) and creditors (positive balance)
    let mut debtors: Vec<(Uuid, i32)> = Vec::new();
    let mut creditors: Vec<(Uuid, i32)> = Vec::new();

    for row in balances {
        if row.balance_cents > 0 {
            creditors.push((row.user_id, row.balance_cents));
        } else if row.balance_cents < 0 {
            debtors.push((row.user_id, -row.balance_cents));
        }
    }

    // Sort by amount descending
    creditors.sort_by(|a, b| b.1.cmp(&a.1));
    debtors.sort_by(|a, b| b.1.cmp(&a.1));

    let mut transfers = Vec::new();
    let mut ci = 0;
    let mut di = 0;

    while ci < creditors.len() && di < debtors.len() {
        let credit_amount = creditors[ci].1;
        let debt_amount = debtors[di].1;
        let transfer_amount = std::cmp::min(credit_amount, debt_amount);

        if transfer_amount > 0 {
            transfers.push(SimplifiedTransfer {
                from_user: debtors[di].0,
                to_user: creditors[ci].0,
                amount_cents: transfer_amount,
            });
        }

        creditors[ci].1 -= transfer_amount;
        debtors[di].1 -= transfer_amount;

        if creditors[ci].1 == 0 {
            ci += 1;
        }
        if debtors[di].1 == 0 {
            di += 1;
        }
    }

    transfers
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_simplified_single_transfer() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();

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

    #[test]
    fn test_simplified_no_transfers() {
        let a = Uuid::new_v4();
        let balances = vec![
            UserBalance { user_id: a, paid_cents: 0, owes_cents: 0, balance_cents: 0 },
        ];
        let transfers = simplified_debts(&balances);
        assert!(transfers.is_empty());
    }

    #[test]
    fn test_simplified_all_zero() {
        let transfers = simplified_debts(&[]);
        assert!(transfers.is_empty());
    }
}
