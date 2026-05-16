// @generated automatically by Diesel CLI.

pub mod app {
    diesel::table! {
        app._sqlx_migrations (version) {
            version -> Int8,
            description -> Text,
            installed_on -> Timestamptz,
            success -> Bool,
            checksum -> Bytea,
            execution_time -> Int8,
        }
    }

    diesel::table! {
        app.event (id) {
            id -> Uuid,
            name -> Text,
            description -> Nullable<Text>,
            currency -> Text,
            status -> crate::schema_enums::EventStatusType,
            created_by -> Uuid,
            created_at -> Timestamptz,
            updated_at -> Timestamptz,
        }
    }

    diesel::table! {
        app.event_member (id) {
            id -> Uuid,
            event_id -> Uuid,
            user_id -> Uuid,
            role -> crate::schema_enums::EventMemberRoleType,
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
        app.expense_version (id) {
            id -> Uuid,
            expense_id -> Uuid,
            version_number -> Int4,
            title -> Text,
            description -> Nullable<Text>,
            amount_cents -> Int4,
            paid_by -> Uuid,
            split_type -> crate::schema_enums::SplitTypeType,
            split_data -> Jsonb,
            notes -> Nullable<Text>,
            created_by -> Uuid,
            created_at -> Timestamptz,
            expense_type -> Nullable<crate::schema_enums::ExpenseTypeType>,
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
        app.settlement (id) {
            id -> Uuid,
            event_id -> Uuid,
            from_user -> Uuid,
            to_user -> Uuid,
            amount_cents -> Int4,
            status -> crate::schema_enums::SettlementStatusType,
            settled_at -> Nullable<Timestamptz>,
            created_by -> Uuid,
            created_at -> Timestamptz,
        }
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

    diesel::joinable!(event_member -> event (event_id));
    diesel::joinable!(expense -> event (event_id));
    diesel::joinable!(expense_version -> expense (expense_id));
    diesel::joinable!(expense_version_share -> expense_version (expense_version_id));
    diesel::joinable!(payment -> event (event_id));
    diesel::joinable!(settlement -> event (event_id));

    diesel::allow_tables_to_appear_in_same_query!(
        _sqlx_migrations,
        audit_log,
        event,
        event_member,
        expense,
        expense_version,
        expense_version_share,
        payment,
        settlement,
    );
}
