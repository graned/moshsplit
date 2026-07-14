//! BalanceService — computes per-user balances and simplifies debts.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use moshsplit_balance_engine::{compute_balance, simplified_debts, UserBalance};
use uuid::Uuid;

use crate::domain::repositories::balance_repo::{BalanceRepository, UserBalanceRow};
use crate::domain::repositories::event_repo::EventRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, DebtTransfer, ExpenseBreakdown, ExplainBalanceBetweenResponse,
    ExplainBalanceResponse, PaymentBreakdown, SettlementBreakdown, SimplifiedDebtsResponse,
    UserBalanceItem, UserBalanceResponse,
};
use crate::infrastructure::http::api::dtos::settlement_dtos::{
    IncomingBalanceItem, IncomingBalancesResponse, OutgoingBalanceItem, OutgoingBalancesResponse,
};

pub struct BalanceService {
    event_repo: EventRepository,
    balance_repo: BalanceRepository,
}

impl BalanceService {
    pub fn new(event_repo: EventRepository, balance_repo: BalanceRepository) -> Self {
        Self {
            event_repo,
            balance_repo,
        }
    }

    /// Compute the net balance for a user balance row.
    fn calculate_balance(row: &UserBalanceRow) -> i32 {
        compute_balance(
            row.paid_cents,
            row.owes_cents,
            row.payments_out_cents + row.settlements_out_cents,
            row.payments_in_cents + row.settlements_in_cents,
        )
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
                balance_cents: Self::calculate_balance(&r),
            })
            .collect();

        Ok(BalancesResponse { balances })
    }

    /// Get balance for a single user.
    pub fn user_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<UserBalanceResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let row = self
            .balance_repo
            .user_balance(event_id, user_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("No balance data for user {}", user_id))
            })?;

        Ok(UserBalanceResponse {
            user_id: row.user_id,
            paid_cents: row.paid_cents,
            owes_cents: row.owes_cents,
            balance_cents: Self::calculate_balance(&row),
        })
    }

    /// Compute the minimal set of debt transfers using a greedy algorithm.
    pub fn simplified_debts(
        &self,
        event_id: Uuid,
    ) -> Result<SimplifiedDebtsResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let rows = self.balance_repo.all_balances_for_event(event_id)?;

        let engine_balances: Vec<UserBalance> = rows
            .iter()
            .map(|r| UserBalance {
                user_id: r.user_id,
                paid_cents: r.paid_cents,
                owes_cents: r.owes_cents,
                balance_cents: Self::calculate_balance(r),
            })
            .collect();

        let transfers = simplified_debts(&engine_balances);

        let debt_transfers: Vec<DebtTransfer> = transfers
            .into_iter()
            .map(|t| DebtTransfer {
                from_user: t.from_user,
                to_user: t.to_user,
                amount_cents: t.amount_cents,
            })
            .collect();

        Ok(SimplifiedDebtsResponse {
            transfers: debt_transfers,
        })
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
            .ok_or_else(|| {
                ServiceError::NotFound(format!("No balance data for user {}", user_id))
            })?;

        let expense_rows = self.balance_repo.expense_breakdown(event_id, user_id)?;
        let expenses: Vec<ExpenseBreakdown> = expense_rows
            .into_iter()
            .map(|r| ExpenseBreakdown {
                expense_id: r.expense_id,
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
            balance_cents: Self::calculate_balance(&balance),
            expenses,
            payments,
            settlements,
        })
    }

    /// Get expense breakdown between two users.
    pub fn explain_balance_between(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        counterparty_id: Uuid,
    ) -> Result<ExplainBalanceBetweenResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let expenses = self
            .balance_repo
            .expense_breakdown_between(event_id, user_id, counterparty_id)?
            .into_iter()
            .map(|r| ExpenseBreakdown {
                expense_id: r.expense_id,
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

        Ok(ExplainBalanceBetweenResponse {
            user_id,
            counterparty_id,
            expenses,
        })
    }

    /// Recalculate a single user's balance (convenience wrapper for cache invalidation).
    pub fn recalculate_user_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<UserBalanceResponse, ServiceError> {
        self.user_balance(event_id, user_id)
    }

    /// Recalculate all event balances (convenience wrapper for cache invalidation).
    pub fn recalculate_event_balances(
        &self,
        event_id: Uuid,
    ) -> Result<BalancesResponse, ServiceError> {
        self.all_balances(event_id)
    }

    /// Get incoming balances — users who owe the current user money.
    pub fn incoming_balances(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<IncomingBalancesResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let explanation = self.explain_balance(event_id, user_id)?;

        let mut balances: HashMap<Uuid, i32> = HashMap::new();
        let mut latest_timestamps: HashMap<Uuid, DateTime<Utc>> = HashMap::new();

        for expense in &explanation.expenses {
            let is_payer = expense.paid_by == user_id;
            let share_cents = expense.share_cents;

            if is_payer {
                for participant in &expense.participants {
                    if *participant != user_id {
                        *balances.entry(*participant).or_insert(0) += share_cents;
                        latest_timestamps
                            .entry(*participant)
                            .and_modify(|t| *t = (*t).max(expense.created_at))
                            .or_insert(expense.created_at);
                    }
                }
            } else {
                // Non-payer owes the payer their share — negative balance
                *balances.entry(expense.paid_by).or_insert(0) -= share_cents;
                latest_timestamps
                    .entry(expense.paid_by)
                    .and_modify(|t| *t = (*t).max(expense.created_at))
                    .or_insert(expense.created_at);
            }
        }

        let incoming: Vec<(Uuid, i32)> = balances
            .into_iter()
            .filter(|(_, balance)| *balance > 0)
            .map(|(user_id, balance)| (user_id, balance))
            .collect();

        let total_cents: i32 = incoming.iter().map(|(_, b)| b).sum();

        let items: Vec<IncomingBalanceItem> = incoming
            .into_iter()
            .map(|(user_id, amount_cents)| IncomingBalanceItem {
                user_id,
                amount_cents,
                created_at: latest_timestamps
                    .remove(&user_id)
                    .unwrap_or_else(chrono::Utc::now),
            })
            .collect();

        Ok(IncomingBalancesResponse { items, total_cents })
    }

    /// Get outgoing balances — users the current user owes money to.
    pub fn outgoing_balances(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<OutgoingBalancesResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let explanation = self.explain_balance(event_id, user_id)?;

        let mut balances: HashMap<Uuid, i32> = HashMap::new();
        let mut latest_timestamps: HashMap<Uuid, DateTime<Utc>> = HashMap::new();

        for expense in &explanation.expenses {
            let is_payer = expense.paid_by == user_id;
            let share_cents = expense.share_cents;

            if is_payer {
                for participant in &expense.participants {
                    if *participant != user_id {
                        *balances.entry(*participant).or_insert(0) += share_cents;
                        latest_timestamps
                            .entry(*participant)
                            .and_modify(|t| *t = (*t).max(expense.created_at))
                            .or_insert(expense.created_at);
                    }
                }
            } else {
                *balances.entry(expense.paid_by).or_insert(0) -= share_cents;
                latest_timestamps
                    .entry(expense.paid_by)
                    .and_modify(|t| *t = (*t).max(expense.created_at))
                    .or_insert(expense.created_at);
            }
        }

        let outgoing: Vec<(Uuid, i32)> = balances
            .into_iter()
            .filter(|(_, balance)| *balance < 0)
            .map(|(user_id, balance)| (user_id, balance.abs()))
            .collect();

        let total_cents: i32 = outgoing.iter().map(|(_, b)| b).sum();

        let items: Vec<OutgoingBalanceItem> = outgoing
            .into_iter()
            .map(|(user_id, amount_cents)| OutgoingBalanceItem {
                user_id,
                amount_cents,
                created_at: latest_timestamps
                    .remove(&user_id)
                    .unwrap_or_else(chrono::Utc::now),
            })
            .collect();

        Ok(OutgoingBalancesResponse { items, total_cents })
    }
}
