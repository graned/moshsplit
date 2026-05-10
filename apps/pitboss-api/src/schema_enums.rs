use diesel::deserialize::{self, FromSql};
use diesel::pg::{Pg, PgValue};
use diesel::serialize::{self, IsNull, Output, ToSql};
use diesel::sql_types::Text;
use serde::{Deserialize, Serialize};
use std::io::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, diesel::FromSqlRow, diesel::AsExpression)]
#[diesel(sql_type = Text)]
pub enum EventStatus {
    Active,
    Archived,
    Deleted,
}

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
#[diesel(sql_type = Text)]
pub enum EventMemberRole {
    Admin,
    Member,
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
#[diesel(sql_type = Text)]
pub enum SplitType {
    Equal,
    Custom,
    Percentage,
    Shares,
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
#[diesel(sql_type = Text)]
pub enum SettlementStatus {
    Pending,
    Confirmed,
    Disputed,
}

impl ToSql<Text, Pg> for SettlementStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self {
            Self::Pending => out.write_all(b"pending")?,
            Self::Confirmed => out.write_all(b"confirmed")?,
            Self::Disputed => out.write_all(b"disputed")?,
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
            _ => Err("Unrecognized SettlementStatus variant".into()),
        }
    }
}
