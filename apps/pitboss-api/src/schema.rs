// @generated automatically by Diesel CLI.

pub mod app {
    pub mod sql_types {
        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "event_image_type", schema = "app"))]
        pub struct EventImageType;

        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "event_member_role", schema = "app"))]
        pub struct EventMemberRole;

        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "event_status", schema = "app"))]
        pub struct EventStatus;

        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "expense_type", schema = "app"))]
        pub struct ExpenseType;

        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "settlement_status", schema = "app"))]
        pub struct SettlementStatus;

        #[derive(diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "split_type", schema = "app"))]
        pub struct SplitType;
    }

    diesel::table! {
        app.audit_log (id) {
            id -> Uuid,
            action -> Text,
            entity_type -> Text,
            entity_id -> Uuid,
            user_id -> Uuid,
            details -> Nullable<Jsonb>,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::EventStatus;

        app.event (id) {
            id -> Uuid,
            name -> Text,
            description -> Nullable<Text>,
            currency -> Text,
            status -> EventStatus,
            created_by -> Uuid,
            created_at -> Timestamptz,
            updated_at -> Timestamptz,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::EventImageType;

        app.event_image (id) {
            id -> Uuid,
            event_id -> Uuid,
            url -> Text,
            alt_text -> Nullable<Text>,
            image_type -> EventImageType,
            sort_order -> Int4,
            uploaded_at -> Timestamptz,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::EventMemberRole;

        app.event_member (id) {
            id -> Uuid,
            event_id -> Uuid,
            user_id -> Uuid,
            role -> EventMemberRole,
            joined_at -> Timestamptz,
            left_at -> Nullable<Timestamptz>,
        }
    }

    diesel::table! {
        app.expense (id) {
            id -> Uuid,
            event_id -> Uuid,
            created_by -> Uuid,
            created_at -> Timestamptz,
            current_version_id -> Nullable<Uuid>,
            deleted_at -> Nullable<Timestamptz>,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::SplitType;
        use super::sql_types::ExpenseType;

        app.expense_version (id) {
            id -> Uuid,
            expense_id -> Uuid,
            version_number -> Int4,
            title -> Text,
            description -> Nullable<Text>,
            amount_cents -> Int4,
            paid_by -> Uuid,
            split_type -> SplitType,
            split_data -> Jsonb,
            notes -> Nullable<Text>,
            created_by -> Uuid,
            created_at -> Timestamptz,
            expense_type -> Nullable<ExpenseType>,
        }
    }

    diesel::table! {
        app.expense_version_share (id) {
            id -> Uuid,
            expense_version_id -> Uuid,
            user_id -> Uuid,
            share_cents -> Int4,
        }
    }

    diesel::table! {
        app.payment (id) {
            id -> Uuid,
            event_id -> Uuid,
            from_user -> Uuid,
            to_user -> Uuid,
            amount_cents -> Int4,
            currency -> Text,
            description -> Nullable<Text>,
            payment_method -> Nullable<Text>,
            external_ref -> Nullable<Text>,
            recorded_by -> Uuid,
            recorded_at -> Timestamptz,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::SettlementStatus;

        app.settlement (id) {
            id -> Uuid,
            event_id -> Uuid,
            from_user -> Uuid,
            to_user -> Uuid,
            amount_cents -> Int4,
            status -> SettlementStatus,
            settled_at -> Nullable<Timestamptz>,
            created_by -> Uuid,
            created_at -> Timestamptz,
            note -> Nullable<Text>,
            proof_url -> Nullable<Text>,
            reviewed_by -> Nullable<Uuid>,
            reviewed_at -> Nullable<Timestamptz>,
            rejection_note -> Nullable<Text>,
            expense_id -> Nullable<Uuid>,
            deleted_at -> Nullable<Timestamptz>,
        }
    }

    diesel::table! {
        app.reimbursement (id) {
            id -> Uuid,
            ref_expense_id -> Uuid,
            settlement_id -> Nullable<Uuid>,
            event_id -> Uuid,
            from_user -> Uuid,
            to_user -> Uuid,
            amount_cents -> Int4,
            created_at -> Timestamptz,
            deleted_at -> Nullable<Timestamptz>,
        }
    }

    diesel::joinable!(event_image -> event (event_id));
    diesel::joinable!(event_member -> event (event_id));
    diesel::joinable!(expense -> event (event_id));
    diesel::joinable!(expense_version -> expense (expense_id));
    diesel::joinable!(expense_version_share -> expense_version (expense_version_id));
    diesel::joinable!(payment -> event (event_id));
    diesel::joinable!(settlement -> event (event_id));

    diesel::allow_tables_to_appear_in_same_query!(
        audit_log,
        event,
        event_image,
        event_member,
        expense,
        expense_version,
        expense_version_share,
        payment,
        settlement,
        reimbursement,
    );
}
