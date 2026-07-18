//! BalanceService — computes per-user balances and simplifies debts.

use std::collections::HashMap;

use moshsplit_balance_engine::{compute_balance, simplified_debts, UserBalance};
use uuid::Uuid;

use crate::domain::repositories::balance_repo::{BalanceRepository, UserBalanceRow};
use crate::domain::repositories::event_repo::EventRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, BalancesSection, CategoryGrossTotals, CategoryTotals, CounterpartyBalance,
    DebtTransfer, ExpenseBreakdown, ExplainBalanceBetweenResponse, ExplainBalanceResponse,
    PaymentBreakdown, SimplifiedDebtsResponse, TotalsSection, UserBalanceItem, UserBalanceResponse,
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

    fn calculate_balance(row: &UserBalanceRow) -> i32 {
        compute_balance(
            row.paid_cents,
            row.owes_cents,
            row.payments_out_cents,
            row.payments_in_cents,
        )
    }

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
                creditor_id: r.to_user,
                debtor_id: r.from_user,
                amount_cents: r.amount_cents,
                amount_paid_cents: r.amount_cents,
                reason: r.description.unwrap_or_default(),
                status: "confirmed".to_string(),
                created_at: r.recorded_at,
            })
            .collect();

        let totals = calculate_totals(&expenses, &payments, user_id);
        let balances = calculate_balances(&expenses, &payments, user_id);

        Ok(ExplainBalanceResponse {
            user_id: balance.user_id,
            paid_cents: balance.paid_cents,
            owes_cents: balance.owes_cents,
            balance_cents: Self::calculate_balance(&balance),
            expenses,
            payments,
            totals,
            balances,
        })
    }

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

        Ok(ExplainBalanceBetweenResponse {
            user_id,
            counterparty_id,
            expenses,
        })
    }

    pub fn recalculate_user_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<UserBalanceResponse, ServiceError> {
        self.user_balance(event_id, user_id)
    }

    pub fn recalculate_event_balances(
        &self,
        event_id: Uuid,
    ) -> Result<BalancesResponse, ServiceError> {
        self.all_balances(event_id)
    }

    pub fn incoming_balances(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<ExplainBalanceResponse, ServiceError> {
        self.explain_balance(event_id, user_id)
    }

    pub fn outgoing_balances(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<ExplainBalanceResponse, ServiceError> {
        self.explain_balance(event_id, user_id)
    }
}

fn calculate_totals(
    expenses: &[ExpenseBreakdown],
    payments: &[PaymentBreakdown],
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
        .filter(|p| p.creditor_id == user_id)
        .map(|p| p.amount_paid_cents)
        .sum();

    let pay_outgoing: i32 = payments
        .iter()
        .filter(|p| p.debtor_id == user_id)
        .map(|p| p.amount_paid_cents)
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
    }
}

fn calculate_balances(
    expenses: &[ExpenseBreakdown],
    payments: &[PaymentBreakdown],
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
        if payment.creditor_id == user_id {
            let cp = by_counterparty
                .entry(payment.debtor_id)
                .or_insert_with(CounterpartyBalance::default);
            cp.payments.incoming += payment.amount_paid_cents;
            cp.incoming += payment.amount_paid_cents;
        } else if payment.debtor_id == user_id {
            let cp = by_counterparty
                .entry(payment.creditor_id)
                .or_insert_with(CounterpartyBalance::default);
            cp.payments.outgoing += payment.amount_paid_cents;
            cp.outgoing += payment.amount_paid_cents;
        }
    }

    for cp in by_counterparty.values_mut() {
        cp.expenses.net = cp.expenses.incoming - cp.expenses.outgoing;
        cp.payments.net = cp.payments.incoming - cp.payments.outgoing;
        cp.net = cp.expenses.net + cp.payments.net;
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
