use crate::schema_enums::{
    EventImageType, EventMemberRole, EventStatus, ExpenseType, SettlementStatus, SplitType,
};

impl std::fmt::Display for EventStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "active"),
            Self::Archived => write!(f, "archived"),
            Self::Deleted => write!(f, "deleted"),
        }
    }
}

impl std::str::FromStr for EventStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "active" => Ok(Self::Active),
            "archived" => Ok(Self::Archived),
            "deleted" => Ok(Self::Deleted),
            _ => Err(format!("invalid event status: {s}")),
        }
    }
}

impl std::fmt::Display for EventMemberRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Admin => write!(f, "admin"),
            Self::Member => write!(f, "member"),
        }
    }
}

impl std::str::FromStr for EventMemberRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "admin" => Ok(Self::Admin),
            "member" => Ok(Self::Member),
            _ => Err(format!("invalid member role: {s}")),
        }
    }
}

impl std::fmt::Display for SplitType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Equal => write!(f, "equal"),
            Self::Custom => write!(f, "custom"),
            Self::Percentage => write!(f, "percentage"),
            Self::Shares => write!(f, "shares"),
        }
    }
}

impl std::str::FromStr for SplitType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "equal" => Ok(Self::Equal),
            "custom" => Ok(Self::Custom),
            "percentage" => Ok(Self::Percentage),
            "shares" => Ok(Self::Shares),
            _ => Err(format!("invalid split type: {s}")),
        }
    }
}

impl std::fmt::Display for SettlementStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Confirmed => write!(f, "confirmed"),
            Self::Disputed => write!(f, "disputed"),
            Self::Rejected => write!(f, "rejected"),
        }
    }
}

impl std::str::FromStr for SettlementStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "confirmed" => Ok(Self::Confirmed),
            "disputed" => Ok(Self::Disputed),
            "rejected" => Ok(Self::Rejected),
            _ => Err(format!("invalid settlement status: {s}")),
        }
    }
}

impl std::fmt::Display for ExpenseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Food => write!(f, "food"),
            Self::Beer => write!(f, "beer"),
            Self::Gas => write!(f, "gas"),
            Self::Transport => write!(f, "transport"),
            Self::Merch => write!(f, "merch"),
            Self::Camping => write!(f, "camping"),
            Self::Other => write!(f, "other"),
        }
    }
}

impl std::str::FromStr for ExpenseType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "food" => Ok(Self::Food),
            "beer" => Ok(Self::Beer),
            "gas" => Ok(Self::Gas),
            "transport" => Ok(Self::Transport),
            "merch" => Ok(Self::Merch),
            "camping" => Ok(Self::Camping),
            "other" => Ok(Self::Other),
            _ => Err(format!("invalid expense type: {s}")),
        }
    }
}

impl std::fmt::Display for EventImageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Banner => write!(f, "banner"),
            Self::Gallery => write!(f, "gallery"),
        }
    }
}

impl std::str::FromStr for EventImageType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "banner" => Ok(Self::Banner),
            "gallery" => Ok(Self::Gallery),
            _ => Err(format!("invalid image type: {s}")),
        }
    }
}
