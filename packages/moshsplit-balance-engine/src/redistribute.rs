use uuid::Uuid;

/// Redistribute shares proportionally among a new set of participants.
///
/// This is used when a participant is **added** or **removed** from an
/// expense: the original shares are discarded and the total amount is
/// redistributed equally (or proportionally based on original share weights)
/// among the remaining/new participants.
///
/// # Parameters
///
/// * `remaining_participants` — slice of `(user_id, original_share_cents)` for
///   each participant who stays (or has been added).
/// * `total_amount_cents` — the total expense amount to redistribute.
///
/// # Returns
///
/// A `Vec<(Uuid, i32)>` of `(user_id, new_share_cents)` using equal split
/// with the last participant receiving the remainder (same rounding logic as
/// `compute_shares`).
///
/// # Panics
///
/// Panics if `remaining_participants` is empty.
///
/// # Examples
///
/// ```
/// use uuid::Uuid;
/// use moshsplit_balance_engine::redistribute_shares;
///
/// let a = Uuid::new_v4();
/// let b = Uuid::new_v4();
///
/// // Two participants, total 1000 cents
/// let shares = redistribute_shares(&[(a, 0), (b, 0)], 1000);
/// assert_eq!(shares.len(), 2);
/// // Equal split: 500 each
/// assert_eq!(shares.iter().find(|(id, _)| *id == a).unwrap().1, 500);
/// assert_eq!(shares.iter().find(|(id, _)| *id == b).unwrap().1, 500);
/// ```
pub fn redistribute_shares(
    remaining_participants: &[(Uuid, i32)],
    total_amount_cents: i32,
) -> Vec<(Uuid, i32)> {
    assert!(
        !remaining_participants.is_empty(),
        "cannot redistribute among zero participants"
    );

    let n = remaining_participants.len() as i32;
    let base = total_amount_cents / n;
    let remainder = total_amount_cents % n;

    remaining_participants
        .iter()
        .enumerate()
        .map(|(i, (uid, _orig_share))| {
            let extra = if (i as i32) < remainder { 1 } else { 0 };
            (*uid, base + extra)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_redistribute_two_equal() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let shares = redistribute_shares(&[(a, 0), (b, 0)], 1000);
        assert_eq!(shares.len(), 2);
        assert_eq!(shares.iter().find(|(id, _)| *id == a).unwrap().1, 500);
        assert_eq!(shares.iter().find(|(id, _)| *id == b).unwrap().1, 500);
    }

    #[test]
    fn test_redistribute_odd_amount() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        // 100 / 3 = 33 remainder 1
        let shares = redistribute_shares(&[(a, 0), (b, 0), (c, 0)], 100);
        assert_eq!(shares.len(), 3);
        // First gets remainder
        assert_eq!(shares[0].1, 34);
        assert_eq!(shares[1].1, 33);
        assert_eq!(shares[2].1, 33);
        assert_eq!(shares.iter().map(|(_, s)| s).sum::<i32>(), 100);
    }

    #[test]
    fn test_redistribute_single() {
        let a = Uuid::new_v4();
        let shares = redistribute_shares(&[(a, 0)], 500);
        assert_eq!(shares.len(), 1);
        assert_eq!(shares[0].1, 500);
    }
}
