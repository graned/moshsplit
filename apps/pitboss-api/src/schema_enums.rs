use diesel::deserialize::{self, FromSql};
use diesel::pg::{Pg, PgValue};
use diesel::serialize::{self, IsNull, Output, ToSql};
use diesel::sql_types::Text;
use serde::{Deserialize, Serialize};
use std::io::Write;

// ── Re-export auto-generated SQL types from schema.rs ──────────────────────────

use crate::schema::app::sql_types::{
    EventImageType as EventImageTypeType,
    EventMemberRole as EventMemberRoleType,
    EventStatus as EventStatusType,
    ExpenseType as ExpenseTypeType,
    SettlementStatus as SettlementStatusType,
    SplitType as SplitTypeType,
};

// ── Rust enum types with Diesel mappings ───────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = EventStatusType)]
pub enum EventStatus {
    Active,
    Archived,
    Deleted,
}

impl ToSql<EventStatusType, Pg> for EventStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Active => out.write_all(b"active")?,
            Self::Archived => out.write_all(b"archived")?,
            Self::Deleted => out.write_all(b"deleted")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<EventStatusType, Pg> for EventStatus {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"active" => Ok(Self::Active),
            b"archived" => Ok(Self::Archived),
            b"deleted" => Ok(Self::Deleted),
            _ => Err("Unrecognized EventStatus variant".into()),
        }
    }
}

// Also implement Text-based ToSql/FromSql for use in raw SQL contexts
impl ToSql<Text, Pg> for EventStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Active => out.write_all(b"active")?,
            Self::Archived => out.write_all(b"archived")?,
            Self::Deleted => out.write_all(b"deleted")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for EventStatus {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"active" => Ok(Self::Active),
            b"archived" => Ok(Self::Archived),
            b"deleted" => Ok(Self::Deleted),
            _ => Err("Unrecognized EventStatus variant".into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = EventMemberRoleType)]
pub enum EventMemberRole {
    Admin,
    Member,
}

impl ToSql<EventMemberRoleType, Pg> for EventMemberRole {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Admin => out.write_all(b"admin")?,
            Self::Member => out.write_all(b"member")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<EventMemberRoleType, Pg> for EventMemberRole {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"admin" => Ok(Self::Admin),
            b"member" => Ok(Self::Member),
            _ => Err("Unrecognized EventMemberRole variant".into()),
        }
    }
}

impl ToSql<Text, Pg> for EventMemberRole {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Admin => out.write_all(b"admin")?,
            Self::Member => out.write_all(b"member")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for EventMemberRole {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"admin" => Ok(Self::Admin),
            b"member" => Ok(Self::Member),
            _ => Err("Unrecognized EventMemberRole variant".into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = SplitTypeType)]
pub enum SplitType {
    Equal,
    Custom,
    Percentage,
    Shares,
}

impl ToSql<SplitTypeType, Pg> for SplitType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Equal => out.write_all(b"equal")?,
            Self::Custom => out.write_all(b"custom")?,
            Self::Percentage => out.write_all(b"percentage")?,
            Self::Shares => out.write_all(b"shares")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<SplitTypeType, Pg> for SplitType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"equal" => Ok(Self::Equal),
            b"custom" => Ok(Self::Custom),
            b"percentage" => Ok(Self::Percentage),
            b"shares" => Ok(Self::Shares),
            _ => Err("Unrecognized SplitType variant".into()),
        }
    }
}

impl ToSql<Text, Pg> for SplitType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Equal => out.write_all(b"equal")?,
            Self::Custom => out.write_all(b"custom")?,
            Self::Percentage => out.write_all(b"percentage")?,
            Self::Shares => out.write_all(b"shares")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for SplitType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"equal" => Ok(Self::Equal),
            b"custom" => Ok(Self::Custom),
            b"percentage" => Ok(Self::Percentage),
            b"shares" => Ok(Self::Shares),
            _ => Err("Unrecognized SplitType variant".into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = SettlementStatusType)]
pub enum SettlementStatus {
    Pending,
    Confirmed,
    Disputed,
    Rejected,
}

impl ToSql<SettlementStatusType, Pg> for SettlementStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Pending => out.write_all(b"pending")?,
            Self::Confirmed => out.write_all(b"confirmed")?,
            Self::Disputed => out.write_all(b"disputed")?,
            Self::Rejected => out.write_all(b"rejected")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<SettlementStatusType, Pg> for SettlementStatus {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"pending" => Ok(Self::Pending),
            b"confirmed" => Ok(Self::Confirmed),
            b"disputed" => Ok(Self::Disputed),
            b"rejected" => Ok(Self::Rejected),
            _ => Err("Unrecognized SettlementStatus variant".into()),
        }
    }
}

impl ToSql<Text, Pg> for SettlementStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Pending => out.write_all(b"pending")?,
            Self::Confirmed => out.write_all(b"confirmed")?,
            Self::Disputed => out.write_all(b"disputed")?,
            Self::Rejected => out.write_all(b"rejected")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for SettlementStatus {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"pending" => Ok(Self::Pending),
            b"confirmed" => Ok(Self::Confirmed),
            b"disputed" => Ok(Self::Disputed),
            b"rejected" => Ok(Self::Rejected),
            _ => Err("Unrecognized SettlementStatus variant".into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = ExpenseTypeType)]
pub enum ExpenseType {
    Food,
    Beer,
    Gas,
    Transport,
    Merch,
    Camping,
    Other,
    Reimburse,
}

impl ToSql<ExpenseTypeType, Pg> for ExpenseType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Food => out.write_all(b"food")?,
            Self::Beer => out.write_all(b"beer")?,
            Self::Gas => out.write_all(b"gas")?,
            Self::Transport => out.write_all(b"transport")?,
            Self::Merch => out.write_all(b"merch")?,
            Self::Camping => out.write_all(b"camping")?,
            Self::Other => out.write_all(b"other")?,
            Self::Reimburse => out.write_all(b"reimburse")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<ExpenseTypeType, Pg> for ExpenseType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"food" => Ok(Self::Food),
            b"beer" => Ok(Self::Beer),
            b"gas" => Ok(Self::Gas),
            b"transport" => Ok(Self::Transport),
            b"merch" => Ok(Self::Merch),
            b"camping" => Ok(Self::Camping),
            b"other" => Ok(Self::Other),
            b"reimburse" => Ok(Self::Reimburse),
            _ => Err("Unrecognized ExpenseType variant".into()),
        }
    }
}

impl ToSql<Text, Pg> for ExpenseType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Food => out.write_all(b"food")?,
            Self::Beer => out.write_all(b"beer")?,
            Self::Gas => out.write_all(b"gas")?,
            Self::Transport => out.write_all(b"transport")?,
            Self::Merch => out.write_all(b"merch")?,
            Self::Camping => out.write_all(b"camping")?,
            Self::Other => out.write_all(b"other")?,
            Self::Reimburse => out.write_all(b"reimburse")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for ExpenseType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"food" => Ok(Self::Food),
            b"beer" => Ok(Self::Beer),
            b"gas" => Ok(Self::Gas),
            b"transport" => Ok(Self::Transport),
            b"merch" => Ok(Self::Merch),
            b"camping" => Ok(Self::Camping),
            b"other" => Ok(Self::Other),
            b"reimburse" => Ok(Self::Reimburse),
            _ => Err("Unrecognized ExpenseType variant".into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = EventImageTypeType)]
pub enum EventImageType {
    Banner,
    Gallery,
}

impl ToSql<EventImageTypeType, Pg> for EventImageType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Banner => out.write_all(b"banner")?,
            Self::Gallery => out.write_all(b"gallery")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<EventImageTypeType, Pg> for EventImageType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"banner" => Ok(Self::Banner),
            b"gallery" => Ok(Self::Gallery),
            _ => Err("Unrecognized EventImageType variant".into()),
        }
    }
}

impl ToSql<Text, Pg> for EventImageType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Banner => out.write_all(b"banner")?,
            Self::Gallery => out.write_all(b"gallery")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for EventImageType {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"banner" => Ok(Self::Banner),
            b"gallery" => Ok(Self::Gallery),
            _ => Err("Unrecognized EventImageType variant".into()),
        }
    }
}
