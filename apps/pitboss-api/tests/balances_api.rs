//! Comprehensive integration tests for balance calculation in pitboss-api.
//!
//! All tests make real HTTP calls against a running pitboss-api container
//! (expected at `http://localhost:8080`). Authentication is handled by first
//! exchanging a known API token for a Bearer token via the external-login
//! endpoint.
//!
//! # Run
//! ```shell
//! cargo test --package pitboss-api --test balances_api
//! ```

mod common;

use common::{
    assert_valid_envelope, delete_json_with_auth, get_json_with_auth,
    patch_json_with_auth, post_json, post_json_with_auth, test_client, BASE_URL,
};
use reqwest::StatusCode;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/// Valid external API token configured in the Sentinel auth service.
const VALID_API_TOKEN: &str =
    "sat_e91974dac53da17dd64b0d1bef35049542bd21ffbae0bc68cc7620ce32e5f936";

/// Email of a known seed user who will be the event creator.
const KNOWN_EMAIL: &str = "anayamaster@gmail.com";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Exchange the API token for an access token via external-login redirect.
async fn login_and_get_token() -> String {
    let result = common::post_json_follow_redirect(
        "/v1/auth/external-login",
        &json!({
            "api_token": VALID_API_TOKEN,
            "email": KNOWN_EMAIL,
            "display_name": "Eduardo Anaya",
        }),
    )
    .await
    .expect("external-login setup call failed — is Sentinel running?");

    result
        .get("access_token")
        .cloned()
        .expect("access_token should be in redirect params")
}

/// Generate a unique event name.
fn unique_name(prefix: &str) -> String {
    format!("{} {}", prefix, Uuid::new_v4())
}

// ═══════════════════════════════════════════════════════════════════════════
// ScenarioBuilder — reusable test fixture factory
// ═══════════════════════════════════════════════════════════════════════════

/// Type alias for share amounts in custom/percentage splits.
type ShareMap = HashMap<String, i32>;

/// A member label -> user_id mapping.
type MemberMap = HashMap<String, String>;

/// Builder for creating test scenarios with events, members, expenses,
/// payments, and settlements. After setup, call the `verify_*` methods
/// to assert balance calculations.
struct ScenarioBuilder {
    token: String,
    event_id: String,
    members: MemberMap,
}

impl ScenarioBuilder {
    /// Create a new scenario: login, create event, and capture the creator
    /// as an implicit member labeled "creator".
    async fn new(name: &str) -> Self {
        let token = login_and_get_token().await;

        let (_, body) = post_json_with_auth(
            "/v1/events",
            &json!({"name": name, "currency": "EUR"}),
            &token,
        )
        .await;
        let event_id = body["data"]["id"].as_str().unwrap().to_string();
        let creator_id = body["data"]["created_by"].as_str().unwrap().to_string();

        let mut members = MemberMap::new();
        members.insert("creator".to_string(), creator_id);

        Self {
            token,
            event_id,
            members,
        }
    }

    /// Add a member with the given label. Returns the user_id.
    async fn add_member(&mut self, label: &str) -> String {
        let uid = Uuid::new_v4().to_string();
        let (status, body) = post_json_with_auth(
            &format!("/v1/events/{}/members", self.event_id),
            &json!({"user_id": &uid}),
            &self.token,
        )
        .await;
        assert_eq!(
            status,
            StatusCode::CREATED,
            "add_member failed for {label}"
        );
        assert_valid_envelope(&body, true);
        self.members.insert(label.to_string(), uid.clone());
        uid
    }

    /// Create an equal-split expense.
    async fn add_equal_expense(
        &self,
        title: &str,
        amount_cents: i32,
        paid_by_label: &str,
        participant_labels: &[&str],
    ) {
        let paid_by = self.members[paid_by_label].clone();
        let shares: Vec<String> = participant_labels
            .iter()
            .map(|l| self.members[*l].clone())
            .collect();

        let (status, body) = post_json_with_auth(
            &format!("/v1/events/{}/expenses", self.event_id),
            &json!({
                "title": title,
                "amount_cents": amount_cents,
                "paid_by": paid_by,
                "split_type": "equal",
                "split_data": {"shares": shares}
            }),
            &self.token,
        )
        .await;
        assert_eq!(
            status,
            StatusCode::CREATED,
            "add_equal_expense '{title}' failed"
        );
        assert_valid_envelope(&body, true);
    }

    /// Create a custom-split expense (shares object with label -> amount).
    async fn add_custom_expense(
        &self,
        title: &str,
        amount_cents: i32,
        paid_by_label: &str,
        share_map: &HashMap<String, i32>,
    ) {
        let paid_by = self.members[paid_by_label].clone();
        // Build shares object keyed by UUID
        let mut shares_obj = serde_json::Map::new();
        for (label, amt) in share_map {
            let uid = &self.members[label];
            shares_obj.insert(uid.clone(), json!(amt));
        }

        let (status, body) = post_json_with_auth(
            &format!("/v1/events/{}/expenses", self.event_id),
            &json!({
                "title": title,
                "amount_cents": amount_cents,
                "paid_by": paid_by,
                "split_type": "custom",
                "split_data": {"shares": shares_obj}
            }),
            &self.token,
        )
        .await;
        assert_eq!(
            status,
            StatusCode::CREATED,
            "add_custom_expense '{title}' failed"
        );
        assert_valid_envelope(&body, true);
    }

    /// Record a payment from one member to another.
    async fn add_payment(&self, from_label: &str, to_label: &str, amount_cents: i32) {
        let from_user = self.members[from_label].clone();
        let to_user = self.members[to_label].clone();

        let (status, body) = post_json_with_auth(
            &format!("/v1/events/{}/payments", self.event_id),
            &json!({
                "from_user": from_user,
                "to_user": to_user,
                "amount_cents": amount_cents,
                "currency": "EUR"
            }),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "add_payment failed");
        assert_valid_envelope(&body, true);
    }

    /// Propose a settlement (defaults to pending).
    async fn propose_settlement(
        &self,
        from_label: &str,
        to_label: &str,
        amount_cents: i32,
    ) -> String {
        let from_user = self.members[from_label].clone();
        let to_user = self.members[to_label].clone();

        let (status, body) = post_json_with_auth(
            &format!("/v1/events/{}/settlements", self.event_id),
            &json!({
                "from_user": from_user,
                "to_user": to_user,
                "amount_cents": amount_cents,
            }),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "propose_settlement failed");
        assert_valid_envelope(&body, true);
        body["data"]["id"].as_str().unwrap().to_string()
    }

    /// Confirm a settlement (status -> "confirmed").
    async fn confirm_settlement(&self, settlement_id: &str) {
        let (status, body) = patch_json_with_auth(
            &format!(
                "/v1/events/{}/settlements/{}",
                self.event_id, settlement_id
            ),
            &json!({"status": "confirmed"}),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "confirm_settlement failed");
        assert_valid_envelope(&body, true);
        assert_eq!(body["data"]["status"], "confirmed");
    }

    /// Update an expense's amount by creating a new version.
    async fn update_expense(
        &self,
        expense_id: &str,
        title: &str,
        amount_cents: i32,
        paid_by_label: &str,
        participant_labels: &[&str],
    ) {
        let paid_by = self.members[paid_by_label].clone();
        let shares: Vec<String> = participant_labels
            .iter()
            .map(|l| self.members[*l].clone())
            .collect();

        let (status, body) = patch_json_with_auth(
            &format!("/v1/events/{}/expenses/{}", self.event_id, expense_id),
            &json!({
                "title": title,
                "amount_cents": amount_cents,
                "paid_by": paid_by,
                "split_type": "equal",
                "split_data": {"shares": shares}
            }),
            &self.token,
        )
        .await;
        assert_eq!(
            status,
            StatusCode::OK,
            "update_expense '{title}' failed"
        );
        assert_valid_envelope(&body, true);
    }

    // ── Verification helpers ─────────────────────────────────────────

    /// Assert conservation invariant: sum of all balance_cents == 0.
    async fn assert_conservation(&self) {
        let (status, body) = get_json_with_auth(
            &format!("/v1/events/{}/balances", self.event_id),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let balances = body["data"]["balances"].as_array().unwrap();
        let total: i64 = balances
            .iter()
            .map(|b| b["balance_cents"].as_i64().unwrap_or(0))
            .sum();
        assert_eq!(total, 0, "balances should sum to zero (conservation)");
    }

    /// Assert a specific user's balance fields.
    async fn assert_user_balance(
        &self,
        label: &str,
        expected_paid: i32,
        expected_owes: i32,
        expected_balance: i32,
    ) {
        let uid = &self.members[label];
        let (status, body) = get_json_with_auth(
            &format!("/v1/events/{}/balances/{}", self.event_id, uid),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_valid_envelope(&body, true);
        let data = &body["data"];
        assert_eq!(
            data["paid_cents"].as_i64().unwrap() as i32,
            expected_paid,
            "{label}: paid_cents mismatch"
        );
        assert_eq!(
            data["owes_cents"].as_i64().unwrap() as i32,
            expected_owes,
            "{label}: owes_cents mismatch"
        );
        assert_eq!(
            data["balance_cents"].as_i64().unwrap() as i32,
            expected_balance,
            "{label}: balance_cents mismatch"
        );
    }

    /// Assert simplified debts — expects a slice of (from_label, to_label, amount_cents).
    async fn assert_simplified_debts(&self, expected: &[(&str, &str, i32)]) {
        let (status, body) = get_json_with_auth(
            &format!("/v1/events/{}/balances/simplified", self.event_id),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_valid_envelope(&body, true);

        let transfers = body["data"]["transfers"].as_array().unwrap();

        // Check count
        assert_eq!(
            transfers.len(),
            expected.len(),
            "simplified debts: expected {} transfers, got {}",
            expected.len(),
            transfers.len()
        );

        // Build a lookup from expected: (from_uid, to_uid) -> amount
        let mut expected_map: HashMap<(String, String), i32> = HashMap::new();
        for (from_label, to_label, amt) in expected {
            let from_uid = self.members[*from_label].clone();
            let to_uid = self.members[*to_label].clone();
            expected_map.insert((from_uid, to_uid), *amt);
        }

        for transfer in transfers {
            let from = transfer["from_user"].as_str().unwrap();
            let to = transfer["to_user"].as_str().unwrap();
            let amount = transfer["amount_cents"].as_i64().unwrap() as i32;

            let key = (from.to_string(), to.to_string());
            let expected_amt = expected_map.remove(&key).unwrap_or_else(|| {
                panic!(
                    "Unexpected transfer: {} -> {} ({} cents)",
                    from, to, amount
                )
            });
            assert_eq!(
                amount, expected_amt,
                "Transfer {} -> {}: expected {} cents, got {}",
                from, to, expected_amt, amount
            );
        }

        assert!(
            expected_map.is_empty(),
            "Missing expected transfers: {:?}",
            expected_map
        );

        // Verify sum of transfers == total positive balance
        let total_transfer_amount: i64 = transfers
            .iter()
            .map(|t| t["amount_cents"].as_i64().unwrap_or(0))
            .sum();

        // Get all balances to compute total owed
        let (_, bal_body) = get_json_with_auth(
            &format!("/v1/events/{}/balances", self.event_id),
            &self.token,
        )
        .await;
        let balances = bal_body["data"]["balances"].as_array().unwrap();
        let total_positive: i64 = balances
            .iter()
            .map(|b| b["balance_cents"].as_i64().unwrap_or(0))
            .filter(|&b| b > 0)
            .sum();

        assert_eq!(
            total_transfer_amount, total_positive,
            "sum of transfer amounts ({}) should equal total positive balance ({})",
            total_transfer_amount, total_positive
        );
    }

    /// Assert explain balance for a user — verifies per-expense breakdown.
    /// Matches by title (order-independent).
    /// expected_expenses: slice of (title, expected_paid, expected_share)
    async fn assert_explain_balance(
        &self,
        label: &str,
        expected_balance: i32,
        expected_expenses: &[(&str, i32, i32)],
    ) {
        let uid = &self.members[label];
        let (status, body) = get_json_with_auth(
            &format!(
                "/v1/events/{}/balances/{}/explain",
                self.event_id, uid
            ),
            &self.token,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_valid_envelope(&body, true);

        let data = &body["data"];
        assert_eq!(
            data["balance_cents"].as_i64().unwrap() as i32,
            expected_balance,
            "{label}: explain balance_cents mismatch"
        );

        let expenses = data["expenses"].as_array().unwrap();
        assert_eq!(
            expenses.len(),
            expected_expenses.len(),
            "{label}: expected {} expenses in explain, got {}",
            expected_expenses.len(),
            expenses.len()
        );

        // Build a lookup by title for order-independent matching
        let mut expected_map: HashMap<&str, (i32, i32)> = HashMap::new();
        for (title, paid, share) in expected_expenses {
            expected_map.insert(title, (*paid, *share));
        }

        for exp in expenses {
            let title = exp["title"].as_str().unwrap();
            let (exp_paid, exp_share) = expected_map.remove(title).unwrap_or_else(|| {
                panic!("{label}: unexpected expense '{title}' in explain breakdown")
            });
            assert_eq!(
                exp["paid_cents"].as_i64().unwrap() as i32,
                exp_paid,
                "{label}: expense '{title}' paid_cents mismatch"
            );
            assert_eq!(
                exp["share_cents"].as_i64().unwrap() as i32,
                exp_share,
                "{label}: expense '{title}' share_cents mismatch"
            );
        }

        assert!(
            expected_map.is_empty(),
            "{label}: missing expected expenses in explain: {:?}",
            expected_map.keys()
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// P0 — Must-have tests
// ═══════════════════════════════════════════════════════════════════════════

/// P0.1: Basic 2-user scenario.
/// A pays 2000, split equally between A and B.
/// Expected: A: paid=2000, owes=1000, bal=+1000; B: paid=0, owes=1000, bal=-1000.
#[tokio::test]
async fn test_p0_basic_two_user_balance() {
    let mut s = ScenarioBuilder::new(&unique_name("p0-basic-2")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;

    s.add_equal_expense("Dinner", 2000, "A", &["A", "B"]).await;

    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;
    s.assert_conservation().await;
}

/// P0.2: Multi-expense with overlapping (the core 5-user scenario).
/// Expense 1: A pays 2000, split equally 5 ways → each share 400
/// Expense 2: B pays 4000, split equally 5 ways → each share 800
/// Net: A=+800, B=+2800, C=-1200, D=-1200, E=-1200
#[tokio::test]
async fn test_p0_multi_expense_overlapping() {
    let mut s = ScenarioBuilder::new(&unique_name("p0-core-5")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;
    let _d = s.add_member("D").await;
    let _e = s.add_member("E").await;

    // Expense 1: A pays 2000, split equally among all 5
    s.add_equal_expense("Groceries", 2000, "A", &["A", "B", "C", "D", "E"])
        .await;
    // Expense 2: B pays 4000, split equally among all 5
    s.add_equal_expense("Gas", 4000, "B", &["A", "B", "C", "D", "E"])
        .await;

    // Each share: exp1=400, exp2=800
    // A: paid=2000, owes=400+800=1200, bal=+800
    s.assert_user_balance("A", 2000, 1200, 800).await;
    // B: paid=4000, owes=400+800=1200, bal=+2800
    s.assert_user_balance("B", 4000, 1200, 2800).await;
    // C: paid=0, owes=400+800=1200, bal=-1200
    s.assert_user_balance("C", 0, 1200, -1200).await;
    // D: paid=0, owes=400+800=1200, bal=-1200
    s.assert_user_balance("D", 0, 1200, -1200).await;
    // E: paid=0, owes=400+800=1200, bal=-1200
    s.assert_user_balance("E", 0, 1200, -1200).await;

    s.assert_conservation().await;
}

/// P0.3: Conservation invariant — sum of all balances is always zero.
/// Already verified in every test via assert_conservation(), but
/// this is a dedicated test with multiple scenarios.
#[tokio::test]
async fn test_p0_conservation_invariant() {
    // Scenario: A pays 3000 split 3 ways, B pays 1500 split 3 ways
    let mut s = ScenarioBuilder::new(&unique_name("p0-conservation")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    s.add_equal_expense("E1", 3000, "A", &["A", "B", "C"]).await;
    s.add_equal_expense("E2", 1500, "B", &["A", "B", "C"]).await;

    s.assert_conservation().await;
}

/// P0.4: Simplified debts correctness.
/// Uses custom splits to create deterministic balances (no ties),
/// so the greedy algorithm's output is predictable.
///
/// Custom expense: A pays 1500, split B=500, C=1000
/// Custom expense: B pays 800, split A=300, C=500
///
/// Balances:
///   A: paid=0, owes=300 → -300
///   B: paid=800, owes=500 → +300 (wait, that's not right since A didn't pay...)
///   Actually: A pays nothing in this scenario, B pays 800
///
/// Let's re-do:
///   Expense 1: A pays 1500, custom split: A=200, B=500, C=800
///   Expense 2: B pays 700, custom split: A=100, B=200, C=400
///
/// Balances:
///   A: paid=1500, owes=200+100=300  → +1200
///   B: paid=700,  owes=500+200=700  → 0
///   C: paid=0,    owes=800+400=1200 → -1200
///
/// Only C is a debtor, only A is a creditor:
///   C → A 1200
#[tokio::test]
async fn test_p0_simplified_debts_correctness() {
    let mut s = ScenarioBuilder::new(&unique_name("p0-simplified")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    let mut shares1 = ShareMap::new();
    shares1.insert("A".to_string(), 200);
    shares1.insert("B".to_string(), 500);
    shares1.insert("C".to_string(), 800);
    s.add_custom_expense("E1", 1500, "A", &shares1).await;

    let mut shares2 = ShareMap::new();
    shares2.insert("A".to_string(), 100);
    shares2.insert("B".to_string(), 200);
    shares2.insert("C".to_string(), 400);
    s.add_custom_expense("E2", 700, "B", &shares2).await;

    s.assert_user_balance("A", 1500, 300, 1200).await;
    s.assert_user_balance("B", 700, 700, 0).await;
    s.assert_user_balance("C", 0, 1200, -1200).await;
    s.assert_conservation().await;

    // C owes 1200 to A
    s.assert_simplified_debts(&[("C", "A", 1200)]).await;
}

/// P0.5: Explain balance for the core scenario.
#[tokio::test]
async fn test_p0_explain_balance() {
    let mut s = ScenarioBuilder::new(&unique_name("p0-explain")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;
    let _d = s.add_member("D").await;
    let _e = s.add_member("E").await;

    s.add_equal_expense("Groceries", 2000, "A", &["A", "B", "C", "D", "E"])
        .await;
    s.add_equal_expense("Gas", 4000, "B", &["A", "B", "C", "D", "E"])
        .await;

    // A's explain:
    //   Groceries: paid=2000, share=400  → net +1600
    //   Gas:       paid=0,    share=800  → net -800
    //   Total: +800
    s.assert_explain_balance(
        "A",
        800,
        &[("Groceries", 2000, 400), ("Gas", 0, 800)],
    )
    .await;

    // B's explain:
    //   Groceries: paid=0,    share=400  → net -400
    //   Gas:       paid=4000, share=800  → net +3200
    //   Total: +2800
    s.assert_explain_balance(
        "B",
        2800,
        &[("Groceries", 0, 400), ("Gas", 4000, 800)],
    )
    .await;

    // C's explain (debtor):
    //   Groceries: paid=0, share=400  → net -400
    //   Gas:       paid=0, share=800  → net -800
    //   Total: -1200
    s.assert_explain_balance(
        "C",
        -1200,
        &[("Groceries", 0, 400), ("Gas", 0, 800)],
    )
    .await;
}

// ═══════════════════════════════════════════════════════════════════════════
// P1 — Important tests
// ═══════════════════════════════════════════════════════════════════════════

/// P1.1: Payer NOT in split — F4 fix allows payer outside the split member list.
/// This now succeeds instead of returning an error.
#[tokio::test]
async fn test_p1_payer_not_in_split_now_allowed() {
    let mut s = ScenarioBuilder::new(&unique_name("p1-payer-not-in-split")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    let paid_by = s.members["A"].clone();
    // Only B and C are in the split, A pays but is excluded
    let shares: Vec<String> = vec![s.members["B"].clone(), s.members["C"].clone()];

    let (status, body) = post_json_with_auth(
        &format!("/v1/events/{}/expenses", s.event_id),
        &json!({
            "title": "Payer excluded",
            "amount_cents": 3000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": shares}
        }),
        &s.token,
    )
    .await;

    assert!(
        status.is_success(),
        "F4: payer not in split should now be allowed, got status {}",
        status
    );
    assert_valid_envelope(&body, true);

    // Verify balances: A paid 3000, split B=1500, C=1500
    // A: paid=3000, owes=0, bal=+3000
    // B: paid=0, owes=1500, bal=-1500
    // C: paid=0, owes=1500, bal=-1500
    s.assert_user_balance("A", 3000, 0, 3000).await;
    s.assert_user_balance("B", 0, 1500, -1500).await;
    s.assert_user_balance("C", 0, 1500, -1500).await;
    s.assert_conservation().await;
}

/// P1.2: Expense versioning — create expense, update amount, verify balance recomputes.
#[tokio::test]
async fn test_p1_expense_versioning_affects_balance() {
    let mut s = ScenarioBuilder::new(&unique_name("p1-versioning")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;

    // Create expense: A pays 2000, split equally
    let (_, create_body) = post_json_with_auth(
        &format!("/v1/events/{}/expenses", s.event_id),
        &json!({
            "title": "Original",
            "amount_cents": 2000,
            "paid_by": s.members["A"],
            "split_type": "equal",
            "split_data": {"shares": [s.members["A"], s.members["B"]]}
        }),
        &s.token,
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    // Verify initial balance: A=+1000, B=-1000
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;

    // Update expense to 4000
    s.update_expense(
        &expense_id,
        "Updated",
        4000,
        "A",
        &["A", "B"],
    )
    .await;

    // Verify updated balance: A=+2000, B=-2000
    s.assert_user_balance("A", 4000, 2000, 2000).await;
    s.assert_user_balance("B", 0, 2000, -2000).await;
    s.assert_conservation().await;
}

/// P1.3: Soft-deleted expense — create expense, delete it, verify excluded.
#[tokio::test]
async fn test_p1_soft_deleted_expense_excluded() {
    let mut s = ScenarioBuilder::new(&unique_name("p1-soft-delete")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;

    // Create expense 1: A pays 2000
    s.add_equal_expense("E1", 2000, "A", &["A", "B"]).await;
    // Create expense 2: A pays 1000 (to be deleted)
    let (_, create_body) = post_json_with_auth(
        &format!("/v1/events/{}/expenses", s.event_id),
        &json!({
            "title": "ToDelete",
            "amount_cents": 1000,
            "paid_by": s.members["A"],
            "split_type": "equal",
            "split_data": {"shares": [s.members["A"], s.members["B"]]}
        }),
        &s.token,
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    // With both: A=+1500, B=-1500
    s.assert_user_balance("A", 3000, 1500, 1500).await;
    s.assert_user_balance("B", 0, 1500, -1500).await;

    // Delete expense 2
    let (del_status, _) = delete_json_with_auth(
        &format!(
            "/v1/events/{}/expenses/{}",
            s.event_id, expense_id
        ),
        &s.token,
    )
    .await;
    assert_eq!(del_status, StatusCode::NO_CONTENT);

    // After delete: A=+1000, B=-1000
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;
    s.assert_conservation().await;
}

/// P1.4: Payment impact — record payment and verify balance adjusts.
#[tokio::test]
async fn test_p1_payment_impacts_balance() {
    let mut s = ScenarioBuilder::new(&unique_name("p1-payment")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;

    // A pays 2000, split equally
    s.add_equal_expense("Dinner", 2000, "A", &["A", "B"]).await;

    // Before payment: A=+1000, B=-1000
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;

    // B sends 300 to A
    s.add_payment("B", "A", 300).await;

    // After payment (F6 fixed formula):
    // A: paid=2000, owes=1000, pmts_in=300 → bal = 2000-1000+0-300 = +700
    // B: paid=0, owes=1000, pmts_out=300 → bal = 0-1000+300-0 = -700
    s.assert_user_balance("A", 2000, 1000, 700).await;
    s.assert_user_balance("B", 0, 1000, -700).await;
    s.assert_conservation().await;
}

// ═══════════════════════════════════════════════════════════════════════════
// P2 — Edge cases
// ═══════════════════════════════════════════════════════════════════════════

/// P2.1: Settlement — create settlement, confirm it, verify balance adjusts.
#[tokio::test]
async fn test_p2_settlement_impacts_balance() {
    let mut s = ScenarioBuilder::new(&unique_name("p2-settlement")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;

    // A pays 2000, split equally
    s.add_equal_expense("Dinner", 2000, "A", &["A", "B"]).await;

    // Before settlement: A=+1000, B=-1000
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;

    // Propose settlement B→A 500 (pending — should NOT affect balance yet)
    let settlement_id = s.propose_settlement("B", "A", 500).await;

    // Still A=+1000, B=-1000 (pending settlement excluded)
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;

    // Confirm settlement
    s.confirm_settlement(&settlement_id).await;

    // After confirmed settlement (F6 fixed formula):
    // A: 2000 - 1000 + 0 - 500 = +500
    // B: 0 - 1000 + 500 - 0 = -500
    s.assert_user_balance("A", 2000, 1000, 500).await;
    s.assert_user_balance("B", 0, 1000, -500).await;
    s.assert_conservation().await;
}

/// P2.2: Zero-balance user — member with no expenses.
#[tokio::test]
async fn test_p2_zero_balance_user() {
    let mut s = ScenarioBuilder::new(&unique_name("p2-zero-bal")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await; // C has no expenses

    // A pays 2000 split between A and B only (C is excluded)
    s.add_equal_expense("Dinner", 2000, "A", &["A", "B"]).await;

    // A: +1000, B: -1000, C: 0
    s.assert_user_balance("A", 2000, 1000, 1000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;
    s.assert_user_balance("C", 0, 0, 0).await;
    s.assert_conservation().await;

    // C's explain should show expense (non-participant: paid=0, share=0) and zero balance
    let uid = &s.members["C"];
    let (status, body) = get_json_with_auth(
        &format!(
            "/v1/events/{}/balances/{}/explain",
            s.event_id, uid
        ),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["balance_cents"].as_i64().unwrap(), 0);
    // C appears in the expense breakdown with paid=0, share=0 (not a participant)
    let expenses = body["data"]["expenses"].as_array().unwrap();
    assert_eq!(expenses.len(), 1, "expenses should include the event's expense");
    assert_eq!(expenses[0]["paid_cents"].as_i64().unwrap(), 0, "C paid nothing");
    assert_eq!(expenses[0]["share_cents"].as_i64().unwrap(), 0, "C has no share");
}

/// P2.3: Custom splits — different amounts per participant.
#[tokio::test]
async fn test_p2_custom_splits() {
    let mut s = ScenarioBuilder::new(&unique_name("p2-custom")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // A pays 6000, custom split: A=1000, B=2000, C=3000
    let mut shares = ShareMap::new();
    shares.insert("A".to_string(), 1000);
    shares.insert("B".to_string(), 2000);
    shares.insert("C".to_string(), 3000);
    s.add_custom_expense("Custom Dinner", 6000, "A", &shares)
        .await;

    // A: paid=6000, owes=1000, bal=+5000
    // B: paid=0, owes=2000, bal=-2000
    // C: paid=0, owes=3000, bal=-3000
    s.assert_user_balance("A", 6000, 1000, 5000).await;
    s.assert_user_balance("B", 0, 2000, -2000).await;
    s.assert_user_balance("C", 0, 3000, -3000).await;
    s.assert_conservation().await;
}

/// P2.4: Rounding — odd amount split equally 3 ways.
/// 100 cents / 3 = 33.33... The equal-split algorithm gives
/// first member the remainder: 34, 33, 33.
#[tokio::test]
async fn test_p2_rounding_odd_split() {
    let mut s = ScenarioBuilder::new(&unique_name("p2-rounding")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // A pays 100, split equally 3 ways
    // Base = 33, remainder = 1 → A=34, B=33, C=33
    s.add_equal_expense("Odd amount", 100, "A", &["A", "B", "C"])
        .await;

    s.assert_user_balance("A", 100, 34, 66).await;
    s.assert_user_balance("B", 0, 33, -33).await;
    s.assert_user_balance("C", 0, 33, -33).await;
    s.assert_conservation().await;
}

/// P2.5: Single member — only creator in event, no expenses.
#[tokio::test]
async fn test_p2_single_member_no_expenses() {
    let s = ScenarioBuilder::new(&unique_name("p2-single")).await;

    // Only the creator is a member
    let (status, body) = get_json_with_auth(
        &format!("/v1/events/{}/balances", s.event_id),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let balances = body["data"]["balances"].as_array().unwrap();
    assert_eq!(balances.len(), 1, "only the creator should be in balances");
    assert_eq!(
        balances[0]["balance_cents"].as_i64().unwrap(),
        0,
        "single member with no expenses should have zero balance"
    );
    assert_eq!(balances[0]["paid_cents"].as_i64().unwrap(), 0);
    assert_eq!(balances[0]["owes_cents"].as_i64().unwrap(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// P2 — Explain balance between two users
// ═══════════════════════════════════════════════════════════════════════════

/// P2.6: Explain balance between two users.
/// Scenario: 3 users (A, B, C), A pays 3000 equal split A/B/C.
///   - A→B: 1 expense where A paid 3000 and share is 1000
///   - A→C: 1 expense where A paid 3000 and share is 1000
///   - B→A: 1 expense where B paid 0 and share is 1000
///   - B→C: 0 expenses (no shared expense between B and C)
#[tokio::test]
async fn test_p2_explain_balance_between() {
    let mut s = ScenarioBuilder::new(&unique_name("p2-explain-between")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // A pays 3000, split equally among A, B, C
    s.add_equal_expense("Dinner", 3000, "A", &["A", "B", "C"])
        .await;

    // Helper to call explain-between endpoint
    async fn explain_between(
        event_id: &str,
        user_id: &str,
        counterparty_id: &str,
        token: &str,
    ) -> serde_json::Value {
        let (status, body) = get_json_with_auth(
            &format!(
                "/v1/events/{}/balances/{}/explain/{}",
                event_id, user_id, counterparty_id
            ),
            token,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_valid_envelope(&body, true);
        body["data"].clone()
    }

    // A→B: A paid 3000, share is 1000
    let data = explain_between(&s.event_id, &s.members["A"], &s.members["B"], &s.token).await;
    assert_eq!(data["user_id"], s.members["A"]);
    assert_eq!(data["counterparty_id"], s.members["B"]);
    let expenses = data["expenses"].as_array().unwrap();
    assert_eq!(expenses.len(), 1, "A→B should have 1 expense");
    assert_eq!(expenses[0]["paid_cents"].as_i64().unwrap(), 3000);
    assert_eq!(expenses[0]["share_cents"].as_i64().unwrap(), 1000);
    assert_eq!(expenses[0]["title"], "Dinner");

    // A→C: A paid 3000, share is 1000
    let data = explain_between(&s.event_id, &s.members["A"], &s.members["C"], &s.token).await;
    assert_eq!(data["user_id"], s.members["A"]);
    assert_eq!(data["counterparty_id"], s.members["C"]);
    let expenses = data["expenses"].as_array().unwrap();
    assert_eq!(expenses.len(), 1, "A→C should have 1 expense");
    assert_eq!(expenses[0]["paid_cents"].as_i64().unwrap(), 3000);
    assert_eq!(expenses[0]["share_cents"].as_i64().unwrap(), 1000);
    assert_eq!(expenses[0]["title"], "Dinner");

    // B→A: B paid 0, share is 1000
    let data = explain_between(&s.event_id, &s.members["B"], &s.members["A"], &s.token).await;
    assert_eq!(data["user_id"], s.members["B"]);
    assert_eq!(data["counterparty_id"], s.members["A"]);
    let expenses = data["expenses"].as_array().unwrap();
    assert_eq!(expenses.len(), 1, "B→A should have 1 expense");
    assert_eq!(expenses[0]["paid_cents"].as_i64().unwrap(), 0);
    assert_eq!(expenses[0]["share_cents"].as_i64().unwrap(), 1000);
    assert_eq!(expenses[0]["title"], "Dinner");

    // B→C: no shared expense between B and C
    let data = explain_between(&s.event_id, &s.members["B"], &s.members["C"], &s.token).await;
    assert_eq!(data["user_id"], s.members["B"]);
    assert_eq!(data["counterparty_id"], s.members["C"]);
    let expenses = data["expenses"].as_array().unwrap();
    assert_eq!(expenses.len(), 0, "B→C should have 0 expenses");
}

/// P2.7: Explain balance between nonexistent users/events — should return 404.
#[tokio::test]
async fn test_p2_explain_balance_between_nonexistent() {
    let s = ScenarioBuilder::new(&unique_name("p2-explain-between-nonexistent")).await;

    let fake_id = "00000000-0000-0000-0000-000000000000";
    let real_user_id = &s.members["creator"];

    // Bad event_id → 404
    let (status, _) = get_json_with_auth(
        &format!(
            "/v1/events/{}/balances/{}/explain/{}",
            fake_id, real_user_id, real_user_id
        ),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

// ═══════════════════════════════════════════════════════════════════════════
// F5: Reject min split
// ═══════════════════════════════════════════════════════════════════════════

/// F5: Amount too small to split equally — should return validation error.
#[tokio::test]
async fn test_f5_min_split_rejected() {
    let mut s = ScenarioBuilder::new(&unique_name("f5-min-split")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // 2 cents split 3 ways: 2 < 3, should be rejected
    let shares: Vec<String> = vec![
        s.members["A"].clone(),
        s.members["B"].clone(),
        s.members["C"].clone(),
    ];

    let (status, body) = post_json_with_auth(
        &format!("/v1/events/{}/expenses", s.event_id),
        &json!({
            "title": "Too small",
            "amount_cents": 2,
            "paid_by": s.members["A"],
            "split_type": "equal",
            "split_data": {"shares": shares}
        }),
        &s.token,
    )
    .await;

    assert!(!status.is_success(), "F5: min split should be rejected");
    assert_valid_envelope(&body, false);
    assert_eq!(
        body["error"]["code"], "VALIDATION_ERROR",
        "F5: should return VALIDATION_ERROR"
    );
}

/// F5: Amount equal to number of people should succeed (1¢ each).
#[tokio::test]
async fn test_f5_min_split_boundary_succeeds() {
    let mut s = ScenarioBuilder::new(&unique_name("f5-min-boundary")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // 3 cents split 3 ways: 3 >= 3, should succeed → each gets 1¢
    s.add_equal_expense("Boundary", 3, "A", &["A", "B", "C"])
        .await;

    s.assert_user_balance("A", 3, 1, 2).await;
    s.assert_user_balance("B", 0, 1, -1).await;
    s.assert_user_balance("C", 0, 1, -1).await;
    s.assert_conservation().await;
}

// ═══════════════════════════════════════════════════════════════════════════
// F2: Member removal → redistribute expenses
// ═══════════════════════════════════════════════════════════════════════════

/// F2: When a member is removed, their share should be redistributed
/// among the remaining participants.
#[tokio::test]
async fn test_f2_member_removal_redistributes_expenses() {
    let mut s = ScenarioBuilder::new(&unique_name("f2-removal")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // A pays 3000, split equally among A, B, C → each owes 1000
    s.add_equal_expense("Dinner", 3000, "A", &["A", "B", "C"])
        .await;

    // Before removal: A=+2000, B=-1000, C=-1000
    s.assert_user_balance("A", 3000, 1000, 2000).await;
    s.assert_user_balance("B", 0, 1000, -1000).await;
    s.assert_user_balance("C", 0, 1000, -1000).await;
    s.assert_conservation().await;

    // C is removed, their 1000 share is redistributed equally to A and B
    let (del_status, _) = delete_json_with_auth(
        &format!("/v1/events/{}/members/{}", s.event_id, s.members["C"]),
        &s.token,
    )
    .await;
    assert_eq!(del_status, StatusCode::NO_CONTENT);

    // After removal: 3000 split between A and B → each owes 1500
    // A: paid=3000, owes=1500, bal=+1500
    // B: paid=0, owes=1500, bal=-1500
    s.assert_user_balance("A", 3000, 1500, 1500).await;
    s.assert_user_balance("B", 0, 1500, -1500).await;
    s.assert_conservation().await;
}

/// F2: Redistribution with existing payment — A pays 30 split A/B/C,
/// B pays A 10, then C removed.
#[tokio::test]
async fn test_f2_member_removal_with_payment() {
    let mut s = ScenarioBuilder::new(&unique_name("f2-removal-pmt")).await;
    let _a = s.add_member("A").await;
    let _b = s.add_member("B").await;
    let _c = s.add_member("C").await;

    // A pays 30, split equally A/B/C → each owes 10
    s.add_equal_expense("Snacks", 30, "A", &["A", "B", "C"])
        .await;

    // Before payment: A=+20, B=-10, C=-10
    s.assert_user_balance("A", 30, 10, 20).await;
    s.assert_user_balance("B", 0, 10, -10).await;
    s.assert_user_balance("C", 0, 10, -10).await;

    // B pays A 10
    s.add_payment("B", "A", 10).await;

    // After payment (F6 formula):
    // A: paid=30, owes=10, pmts_in=10 → 30-10+0-10 = 10
    // B: paid=0, owes=10, pmts_out=10 → 0-10+10-0 = 0
    // C: paid=0, owes=10 → -10
    s.assert_user_balance("A", 30, 10, 10).await;
    s.assert_user_balance("B", 0, 10, 0).await;
    s.assert_user_balance("C", 0, 10, -10).await;

    // C is removed, their 10 share is redistributed equally to A and B (5 each)
    let (del_status, _) = delete_json_with_auth(
        &format!("/v1/events/{}/members/{}", s.event_id, s.members["C"]),
        &s.token,
    )
    .await;
    assert_eq!(del_status, StatusCode::NO_CONTENT);

    // After removal: 30 split between A and B → each owes 15
    // A: paid=30, owes=15, pmts_in=10 → 30-15+0-10 = 5
    // B: paid=0, owes=15, pmts_out=10 → 0-15+10-0 = -5
    s.assert_user_balance("A", 30, 15, 5).await;
    s.assert_user_balance("B", 0, 15, -5).await;
    s.assert_conservation().await;
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy tests (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/// Legacy: smoke-test that GET /v1/events/:id/balances returns 200.
#[tokio::test]
async fn test_get_balances_returns_200() {
    let mut s = ScenarioBuilder::new(&unique_name("bal-legacy-all")).await;
    let _payer = s.add_member("payer").await;
    let _other = s.add_member("other").await;

    s.add_equal_expense("Test", 3000, "payer", &["payer", "other"])
        .await;

    let (status, body) = get_json_with_auth(
        &format!("/v1/events/{}/balances", s.event_id),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["balances"].is_array());
}

/// Legacy: smoke-test that GET /v1/events/:id/balances/:uid returns 200.
#[tokio::test]
async fn test_get_user_balance_returns_200() {
    let mut s = ScenarioBuilder::new(&unique_name("bal-legacy-user")).await;
    let payer = s.add_member("payer").await;
    let _other = s.add_member("other").await;

    s.add_equal_expense("Test", 3000, "payer", &["payer", "other"])
        .await;

    let (status, body) = get_json_with_auth(
        &format!("/v1/events/{}/balances/{}", s.event_id, payer),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["user_id"], payer);
    assert!(data["balance_cents"].is_i64());
}

/// Legacy: smoke-test that GET /v1/events/:id/balances/simplified returns 200.
#[tokio::test]
async fn test_get_simplified_debts_returns_200() {
    let mut s = ScenarioBuilder::new(&unique_name("bal-legacy-simp")).await;
    let _payer = s.add_member("payer").await;
    let _other = s.add_member("other").await;

    s.add_equal_expense("Test", 3000, "payer", &["payer", "other"])
        .await;

    let (status, body) = get_json_with_auth(
        &format!("/v1/events/{}/balances/simplified", s.event_id),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["transfers"].is_array());
}

/// Legacy: smoke-test that GET /v1/events/:id/balances/:uid/explain returns 200.
#[tokio::test]
async fn test_explain_balance_returns_200() {
    let mut s = ScenarioBuilder::new(&unique_name("bal-legacy-expl")).await;
    let payer = s.add_member("payer").await;
    let _other = s.add_member("other").await;

    s.add_equal_expense("Test", 3000, "payer", &["payer", "other"])
        .await;
    s.add_payment("other", "payer", 500).await;

    let (status, body) = get_json_with_auth(
        &format!("/v1/events/{}/balances/{}/explain", s.event_id, payer),
        &s.token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["user_id"], payer);
    assert!(data["balance_cents"].is_i64());
    assert!(data["expenses"].is_array());
    assert!(data["payments"].is_array());
    assert!(data["settlements"].is_array());
}
