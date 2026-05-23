/// Compute a user's net balance.
///
/// Formula: `balance = paid - owes + payments_out - payments_in`
///
/// - **Positive** balance → the user is a **creditor** (is owed money).
/// - **Negative** balance → the user is a **debtor** (owes money).
///
/// # Sign convention (F6 fix)
///
/// | Term | Effect | Why |
/// |------|--------|-----|
/// | `paid_cents` | + balance | You put money in |
/// | `owes_cents` | − balance | You owe your share |
/// | `payments_out` | + balance | You sent money to someone → your debt decreases |
/// | `payments_in` | − balance | Someone sent you money → what you're owed decreases |
///
/// # Example
///
/// ```
/// use moshsplit_balance_engine::compute_balance;
///
/// // A paid 2000, owes 1000, received 300 payment from B
/// let a_bal = compute_balance(2000, 1000, 0, 300);
/// assert_eq!(a_bal, 700);
///
/// // B paid 0, owes 1000, sent 300 payment to A
/// let b_bal = compute_balance(0, 1000, 300, 0);
/// assert_eq!(b_bal, -700);
/// ```
pub fn compute_balance(
    paid_cents: i32,
    owes_cents: i32,
    payments_out: i32,
    payments_in: i32,
) -> i32 {
    paid_cents - owes_cents + payments_out - payments_in
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_balance_basic() {
        // Simple: paid 1000, no owes, no payments
        assert_eq!(compute_balance(1000, 0, 0, 0), 1000);
        // Simple: owes 1000, no paid, no payments
        assert_eq!(compute_balance(0, 1000, 0, 0), -1000);
    }

    #[test]
    fn test_compute_balance_with_payments() {
        // A paid 2000, owes 1000, received 300 payment
        assert_eq!(compute_balance(2000, 1000, 0, 300), 700);
        // B paid 0, owes 1000, sent 300 payment
        assert_eq!(compute_balance(0, 1000, 300, 0), -700);
    }

    #[test]
    fn test_compute_balance_zero() {
        // All zeros
        assert_eq!(compute_balance(0, 0, 0, 0), 0);
        // Paid exactly what is owed, no payments
        assert_eq!(compute_balance(500, 500, 0, 0), 0);
    }

    #[test]
    fn test_compute_balance_negative_payments() {
        // Edge case: negative amounts should still compute correctly
        assert_eq!(compute_balance(-100, 0, 0, 0), -100);
    }
}
