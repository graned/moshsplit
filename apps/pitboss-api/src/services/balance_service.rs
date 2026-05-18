//! BalanceService — computes per-user balances and simplifies debts.

use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, DebtTransfer, ExplainBalanceResponse, ExpenseBreakdown, PaymentBreakdown,
    SettlementBreakdown, SimplifiedDebtsResponse, UserBalanceItem, UserBalanceResponse,
};
use crate::domain::repositories::balance_repo::BalanceRepository;
use crate::domain::repositories::event_repo::EventRepository;

pub struct BalanceService {
    event_repo: EventRepository,
    balance_repo: BalanceRepository,
}

impl BalanceService {
    pub fn new(event_repo: EventRepository, balance_repo: BalanceRepository) -> Self {
        Self { event_repo, balance_repo }
    }

    /// Get all user balances for an event.
    pub fn all_balances(&self, event_id: Uuid) -> Result<BalancesResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let rows = self.balance_repo.all_balances_for_event(event_id)?;

        let balances: Vec<UserBalanceItem> = rows
            .into_iter()
            .map(|r| UserBalanceItem {
                user_id: r.user_id,
                paid_cents: r.paid_cents,
                owes_cents: r.owes_cents,
                balance_cents: r.balance_cents,
            })
            .collect();

        Ok(BalancesResponse { balances })
    }

    /// Get balance for a single user.
    pub fn user_balance(&self, event_id: Uuid, user_id: Uuid) -> Result<UserBalanceResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let row = self
            .balance_repo
            .user_balance(event_id, user_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("No balance data for user {}", user_id)))?;

        Ok(UserBalanceResponse {
            user_id: row.user_id,
            paid_cents: row.paid_cents,
            owes_cents: row.owes_cents,
            balance_cents: row.balance_cents,
        })
    }

    /// Compute the minimal set of debt transfers using a greedy algorithm.
    ///
    /// Sorts balances descending, then repeatedly matches the largest
    /// creditor with the largest debtor until all are settled.
    pub fn simplified_debts(&self, event_id: Uuid) -> Result<SimplifiedDebtsResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let rows = self.balance_repo.all_balances_for_event(event_id)?;

        // Separate debtors (negative balance) and creditors (positive balance)
        let mut debtors: Vec<(Uuid, i32)> = Vec::new(); // people who owe money (balance < 0)
        let mut creditors: Vec<(Uuid, i32)> = Vec::new(); // people who are owed money (balance > 0)

        for row in &rows {
            if row.balance_cents > 0 {
                creditors.push((row.user_id, row.balance_cents));
            } else if row.balance_cents < 0 {
                debtors.push((row.user_id, -row.balance_cents)); // positive amount owed
            }
        }

        // Sort by amount descending
        creditors.sort_by(|a, b| b.1.cmp(&a.1));
        debtors.sort_by(|a, b| b.1.cmp(&a.1));

        let mut transfers = Vec::new();
        let mut ci = 0; // creditor index
        let mut di = 0; // debtor index

        while ci < creditors.len() && di < debtors.len() {
            let credit_amount = creditors[ci].1;
            let debt_amount = debtors[di].1;
            let transfer_amount = std::cmp::min(credit_amount, debt_amount);

            if transfer_amount > 0 {
                transfers.push(DebtTransfer {
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

        Ok(SimplifiedDebtsResponse { transfers })
    }

    /// Explain a single user's balance in detail.
    pub fn explain_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<ExplainBalanceResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let balance = self
            .balance_repo
            .user_balance(event_id, user_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("No balance data for user {}", user_id)))?;

        let expense_rows = self.balance_repo.expense_breakdown(event_id, user_id)?;
        let expenses: Vec<ExpenseBreakdown> = expense_rows
            .into_iter()
            .map(|r| ExpenseBreakdown {
                title: r.title,
                amount_cents: r.amount_cents,
                paid_cents: r.paid_cents,
                share_cents: r.share_cents,
                paid_by: r.paid_by,
                expense_type: r.expense_type,
                participants: r.participants,
                created_at: r.created_at,
            })
            .collect();

        let payment_rows = self.balance_repo.payment_breakdown(event_id, user_id)?;
        let payments: Vec<PaymentBreakdown> = payment_rows
            .into_iter()
            .map(|r| PaymentBreakdown {
                id: r.id,
                from_user: r.from_user,
                to_user: r.to_user,
                amount_cents: r.amount_cents,
                recorded_at: r.recorded_at,
                description: r.description,
                payment_method: r.payment_method,
            })
            .collect();

        let settlement_rows = self.balance_repo.settlement_breakdown(event_id, user_id)?;
        let settlements: Vec<SettlementBreakdown> = settlement_rows
            .into_iter()
            .map(|r| SettlementBreakdown {
                id: r.id,
                from_user: r.from_user,
                to_user: r.to_user,
                amount_cents: r.amount_cents,
                status: r.status,
                created_at: r.created_at,
                settled_at: r.settled_at,
                note: r.note,
            })
            .collect();

        Ok(ExplainBalanceResponse {
            user_id: balance.user_id,
            paid_cents: balance.paid_cents,
            owes_cents: balance.owes_cents,
            balance_cents: balance.balance_cents,
            expenses,
            payments,
            settlements,
        })
    }
}
