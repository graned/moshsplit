//! StatsService — computes event-level statistics.

use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::stats_repo::StatsRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::stats_dtos::EventStats;

pub struct StatsService {
    event_repo: EventRepository,
    stats_repo: StatsRepository,
}

impl StatsService {
    pub fn new(event_repo: EventRepository, stats_repo: StatsRepository) -> Self {
        Self {
            event_repo,
            stats_repo,
        }
    }

    pub fn get_stats(&self, event_id: Uuid, user_id: Uuid) -> Result<EventStats, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let row = self.stats_repo.get_event_stats(event_id, user_id)?;

        let outstanding_cents = row.total_spent_cents - row.total_settled_cents;

        let payment_progress = if row.total_spent_cents > 0 {
            row.total_settled_cents as f64 / row.total_spent_cents as f64
        } else {
            0.0
        };

        let payment_progress = payment_progress.clamp(0.0, 1.0);

        Ok(EventStats {
            total_spent_cents: row.total_spent_cents,
            total_paid_cents: row.total_settled_cents,
            outstanding_cents,
            your_share_cents: row.your_share_cents,
            your_paid_cents: row.your_paid_cents,
            your_outstanding_cents: row.your_outstanding_cents,
            your_incoming_cents: row.your_incoming_cents,
            your_incoming_paid_cents: row.your_incoming_settled_cents,
            your_outgoing_paid_cents: row.your_outgoing_settled_cents,
            payment_progress,
            top_spender_id: row.top_spender_id,
            top_spender_amount_cents: row.top_spender_amount_cents,
        })
    }
}
