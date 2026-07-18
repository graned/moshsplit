//! BalanceService — computes per-user balances and simplifies debts.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use moshsplit_balance_engine::{compute_balance, simplified_debts, UserBalance};
use uuid::Uuid;

use crate::domain::repositories::balance_repo::{BalanceRepository, UserBalanceRow};
use crate::domain::repositories::event_repo::EventRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, BalancesSection, CategoryGrossTotals, CategoryTotals, CounterpartyBalance,
    DebtTransfer, ExpenseBreakdown, ExplainBalanceBetweenResponse, ExplainBalanceResponse,
    PaymentBreakdown, ReimbursementBreakdown, SettlementBreakdown, SimplifiedDebtsResponse,
    TotalsSection, UserBalanceItem, UserBalanceResponse,
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
        ) + row.reimbursements_in_cents - row.reimbursements_out_cents
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
            .map(|r| {
                let direction = if r.paid_by == user_id {
                    "incoming"
                } else {
                    "outgoing"
                };
                ExpenseBreakdown {
                    expense_id: r.expense_id,
                    title: r.title,
                    amount_cents: r.amount_cents,
                    paid_cents: r.paid_cents,
                    share_cents: r.share_cents,
                    paid_by: r.paid_by,
                    expense_type: r.expense_type,
                    participants: r.participants,
                    created_at: r.created_at,
                    direction: direction.to_string(),
                }
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

        let reimbursement_rows = self
            .balance_repo
            .reimbursement_breakdown(event_id, user_id)?;
        let reimbursements: Vec<ReimbursementBreakdown> = reimbursement_rows
            .into_iter()
            .map(|r| ReimbursementBreakdown {
                id: r.id,
                ref_expense_id: r.ref_expense_id,
                settlement_id: r.settlement_id,
                from_user: r.from_user,
                to_user: r.to_user,
                amount_cents: r.amount_cents,
                original_expense_title: r.original_expense_title,
                created_at: r.created_at,
            })
            .collect();

        let totals = calculate_totals(&expenses, &payments, &settlements, &reimbursements, user_id);
        let balances =
            calculate_balances(&expenses, &payments, &settlements, &reimbursements, user_id);

        Ok(ExplainBalanceResponse {
            user_id: balance.user_id,
            paid_cents: balance.paid_cents,
            owes_cents: balance.owes_cents,
            balance_cents: Self::calculate_balance(&balance),
            expenses,
            payments,
            settlements,
            reimbursements,
            totals,
            balances,
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
            .map(|r| {
                let direction = if r.paid_by == user_id {
                    "incoming"
                } else {
                    "outgoing"
                };
                ExpenseBreakdown {
                    expense_id: r.expense_id,
                    title: r.title,
                    amount_cents: r.amount_cents,
                    paid_cents: r.paid_cents,
                    share_cents: r.share_cents,
                    paid_by: r.paid_by,
                    expense_type: r.expense_type,
                    participants: r.participants,
                    created_at: r.created_at,
                    direction: direction.to_string(),
                }
            })
            .collect();

        let reimbursement_rows = self
            .balance_repo
            .reimbursement_breakdown_between(event_id, user_id, counterparty_id)?;

        let reimbursements: Vec<ReimbursementBreakdown> = reimbursement_rows
            .into_iter()
            .map(|r| ReimbursementBreakdown {
                id: r.id,
                ref_expense_id: r.ref_expense_id,
                settlement_id: r.settlement_id,
                from_user: r.from_user,
                to_user: r.to_user,
                amount_cents: r.amount_cents,
                original_expense_title: r.original_expense_title,
                created_at: r.created_at,
            })
            .collect();

        Ok(ExplainBalanceBetweenResponse {
            user_id,
            counterparty_id,
            expenses,
            reimbursements,
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
                *balances.entry(expense.paid_by).or_insert(0) -= share_cents;
                latest_timestamps
                    .entry(expense.paid_by)
                    .and_modify(|t| *t = (*t).max(expense.created_at))
                    .or_insert(expense.created_at);
            }
        }

        for reimb in &explanation.reimbursements {
            if reimb.to_user == user_id {
                *balances.entry(reimb.from_user).or_insert(0) += reimb.amount_cents;
                latest_timestamps
                    .entry(reimb.from_user)
                    .and_modify(|t| *t = (*t).max(reimb.created_at))
                    .or_insert(reimb.created_at);
            }
        }

        for settlement in &explanation.settlements {
            if settlement.status != "confirmed" {
                continue;
            }
            if settlement.to_user == user_id {
                *balances.entry(settlement.from_user).or_insert(0) -= settlement.amount_cents;
                latest_timestamps
                    .entry(settlement.from_user)
                    .and_modify(|t| *t = (*t).max(settlement.created_at))
                    .or_insert(settlement.created_at);
            } else if settlement.from_user == user_id {
                *balances.entry(settlement.to_user).or_insert(0) += settlement.amount_cents;
                latest_timestamps
                    .entry(settlement.to_user)
                    .and_modify(|t| *t = (*t).max(settlement.created_at))
                    .or_insert(settlement.created_at);
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
        let mut reimb_reasons: HashMap<Uuid, String> = HashMap::new();

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

        for reimb in &explanation.reimbursements {
            if reimb.from_user == user_id {
                *balances.entry(reimb.to_user).or_insert(0) -= reimb.amount_cents;
                latest_timestamps
                    .entry(reimb.to_user)
                    .and_modify(|t| *t = (*t).max(reimb.created_at))
                    .or_insert(reimb.created_at);
                reimb_reasons.insert(reimb.to_user, "You owe for deleted expense".to_string());
            } else if reimb.to_user == user_id {
                *balances.entry(reimb.from_user).or_insert(0) += reimb.amount_cents;
                latest_timestamps
                    .entry(reimb.from_user)
                    .and_modify(|t| *t = (*t).max(reimb.created_at))
                    .or_insert(reimb.created_at);
            }
        }

        for settlement in &explanation.settlements {
            if settlement.status != "confirmed" {
                continue;
            }
            if settlement.to_user == user_id {
                *balances.entry(settlement.from_user).or_insert(0) += settlement.amount_cents;
                latest_timestamps
                    .entry(settlement.from_user)
                    .and_modify(|t| *t = (*t).max(settlement.created_at))
                    .or_insert(settlement.created_at);
            } else if settlement.from_user == user_id {
                *balances.entry(settlement.to_user).or_insert(0) -= settlement.amount_cents;
                latest_timestamps
                    .entry(settlement.to_user)
                    .and_modify(|t| *t = (*t).max(settlement.created_at))
                    .or_insert(settlement.created_at);
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
                reason: reimb_reasons.get(&user_id).cloned(),
                created_at: latest_timestamps
                    .remove(&user_id)
                    .unwrap_or_else(chrono::Utc::now),
            })
            .collect();

        Ok(OutgoingBalancesResponse { items, total_cents })
    }
}

fn calculate_totals(
    expenses: &[ExpenseBreakdown],
    payments: &[PaymentBreakdown],
    settlements: &[SettlementBreakdown],
    reimbursements: &[ReimbursementBreakdown],
    user_id: Uuid,
) -> TotalsSection {
    let exp_incoming: i32 = expenses
        .iter()
        .filter(|e| e.paid_by == user_id && e.direction == "incoming")
        .map(|e| e.amount_cents - e.share_cents)
        .sum();

    let exp_outgoing: i32 = expenses
        .iter()
        .filter(|e| e.paid_by != user_id && e.direction == "outgoing")
        .map(|e| e.share_cents)
        .sum();

    let pay_incoming: i32 = payments
        .iter()
        .filter(|p| p.to_user == user_id)
        .map(|p| p.amount_cents)
        .sum();

    let pay_outgoing: i32 = payments
        .iter()
        .filter(|p| p.from_user == user_id)
        .map(|p| p.amount_cents)
        .sum();

    let stl_incoming: i32 = settlements
        .iter()
        .filter(|s| s.to_user == user_id && s.status == "confirmed")
        .map(|s| s.amount_cents)
        .sum();

    let stl_outgoing: i32 = settlements
        .iter()
        .filter(|s| s.from_user == user_id && s.status == "confirmed")
        .map(|s| s.amount_cents)
        .sum();

    let reimb_incoming: i32 = reimbursements
        .iter()
        .filter(|r| r.to_user == user_id)
        .map(|r| r.amount_cents)
        .sum();

    let reimb_outgoing: i32 = reimbursements
        .iter()
        .filter(|r| r.from_user == user_id)
        .map(|r| r.amount_cents)
        .sum();

    TotalsSection {
        expenses: CategoryTotals {
            gross: CategoryGrossTotals {
                incoming: exp_incoming,
                outgoing: exp_outgoing,
            },
            net: exp_incoming - exp_outgoing,
        },
        payments: CategoryTotals {
            gross: CategoryGrossTotals {
                incoming: pay_incoming,
                outgoing: pay_outgoing,
            },
            net: pay_incoming - pay_outgoing,
        },
        settlements: CategoryTotals {
            gross: CategoryGrossTotals {
                incoming: stl_incoming,
                outgoing: stl_outgoing,
            },
            net: stl_incoming - stl_outgoing,
        },
        reimbursements: CategoryTotals {
            gross: CategoryGrossTotals {
                incoming: reimb_incoming,
                outgoing: reimb_outgoing,
            },
            net: reimb_incoming - reimb_outgoing,
        },
    }
}

fn calculate_balances(
    expenses: &[ExpenseBreakdown],
    payments: &[PaymentBreakdown],
    settlements: &[SettlementBreakdown],
    reimbursements: &[ReimbursementBreakdown],
    user_id: Uuid,
) -> BalancesSection {
    let mut by_counterparty: HashMap<Uuid, CounterpartyBalance> = HashMap::new();

    for expense in expenses {
        if expense.paid_by == user_id {
            for participant in &expense.participants {
                if *participant != user_id {
                    let cp = by_counterparty
                        .entry(*participant)
                        .or_insert_with(CounterpartyBalance::default);
                    cp.expenses.incoming += expense.share_cents;
                    cp.incoming += expense.share_cents;
                }
            }
        } else {
            let cp = by_counterparty
                .entry(expense.paid_by)
                .or_insert_with(CounterpartyBalance::default);
            cp.expenses.outgoing += expense.share_cents;
            cp.outgoing += expense.share_cents;
        }
    }

    for payment in payments {
        if payment.to_user == user_id {
            let cp = by_counterparty
                .entry(payment.from_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.payments.incoming += payment.amount_cents;
            cp.incoming += payment.amount_cents;
        } else if payment.from_user == user_id {
            let cp = by_counterparty
                .entry(payment.to_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.payments.outgoing += payment.amount_cents;
            cp.outgoing += payment.amount_cents;
        }
    }

    for settlement in settlements {
        if settlement.status != "confirmed" {
            continue;
        }
        if settlement.to_user == user_id {
            let cp = by_counterparty
                .entry(settlement.from_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.settlements.incoming += settlement.amount_cents;
            cp.incoming += settlement.amount_cents;
        } else if settlement.from_user == user_id {
            let cp = by_counterparty
                .entry(settlement.to_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.settlements.outgoing += settlement.amount_cents;
            cp.outgoing += settlement.amount_cents;
        }
    }

    for reimbursement in reimbursements {
        if reimbursement.to_user == user_id {
            let cp = by_counterparty
                .entry(reimbursement.from_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.reimbursements.incoming += reimbursement.amount_cents;
            cp.incoming += reimbursement.amount_cents;
        } else if reimbursement.from_user == user_id {
            let cp = by_counterparty
                .entry(reimbursement.to_user)
                .or_insert_with(CounterpartyBalance::default);
            cp.reimbursements.outgoing += reimbursement.amount_cents;
            cp.outgoing += reimbursement.amount_cents;
        }
    }

    for cp in by_counterparty.values_mut() {
        cp.expenses.net = cp.expenses.incoming - cp.expenses.outgoing;
        cp.payments.net = cp.payments.incoming - cp.payments.outgoing;
        cp.settlements.net = cp.settlements.incoming - cp.settlements.outgoing;
        cp.reimbursements.net = cp.reimbursements.incoming - cp.reimbursements.outgoing;
        cp.net = cp.expenses.net + cp.settlements.net + cp.reimbursements.net;
    }

    let total_incoming: i32 = by_counterparty.values().map(|cp| cp.incoming).sum();
    let total_outgoing: i32 = by_counterparty.values().map(|cp| cp.outgoing).sum();
    let total_net: i32 = by_counterparty.values().map(|cp| cp.net).sum();

    BalancesSection {
        net: total_net,
        incoming: total_incoming,
        outgoing: total_outgoing,
        by_counterparty,
    }
}
