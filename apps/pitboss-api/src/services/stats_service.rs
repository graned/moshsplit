//! StatsService — computes event-level statistics.

use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::stats_dtos::EventStats;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::stats_repo::StatsRepository;

pub struct StatsService {
    event_repo: EventRepository,
    stats_repo: StatsRepository,
}

impl StatsService {
    pub fn new(event_repo: EventRepository, stats_repo: StatsRepository) -> Self {
        Self { event_repo, stats_repo }
    }

    /// Get statistics for an event from the perspective of a specific user.
    pub fn get_stats(&self, event_id: Uuid, user_id: Uuid) -> Result<EventStats, ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let row = self.stats_repo.get_event_stats(event_id, user_id)?;

        let outstanding_cents = row.total_spent_cents - row.total_settled_cents;

        let settlement_progress = if row.total_spent_cents > 0 {
            row.total_settled_cents as f64 / row.total_spent_cents as f64
        } else {
            0.0
        };

        // Clamp to [0.0, 1.0] in case of edge cases
        let settlement_progress = settlement_progress.clamp(0.0, 1.0);

        Ok(EventStats {
            total_spent_cents: row.total_spent_cents,
            total_settled_cents: row.total_settled_cents,
            outstanding_cents,
            your_share_cents: row.your_share_cents,
            your_paid_cents: row.your_paid_cents,
            your_outstanding_cents: row.your_outstanding_cents,
            your_incoming_cents: row.your_incoming_cents,
            your_incoming_settled_cents: row.your_incoming_settled_cents,
            settlement_progress,
            top_spender_id: row.top_spender_id,
            top_spender_amount_cents: row.top_spender_amount_cents,
        })
    }
}
