use crate::schema_enums::{
    DeletionStatus, EventImageType, EventMemberRole, EventStatus, ExpenseType, PaymentStatus,
    PaymentTransactionStatus, SplitType,
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
            Self::Reimburse => write!(f, "reimburse"),
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
            "reimburse" => Ok(Self::Reimburse),
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

impl std::fmt::Display for PaymentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Open => write!(f, "open"),
            Self::Ongoing => write!(f, "ongoing"),
            Self::Completed => write!(f, "completed"),
        }
    }
}

impl std::str::FromStr for PaymentStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "open" => Ok(Self::Open),
            "ongoing" => Ok(Self::Ongoing),
            "completed" => Ok(Self::Completed),
            _ => Err(format!("invalid payment status: {s}")),
        }
    }
}

impl std::fmt::Display for PaymentTransactionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Confirmed => write!(f, "confirmed"),
            Self::Rejected => write!(f, "rejected"),
        }
    }
}

impl std::str::FromStr for PaymentTransactionStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "confirmed" => Ok(Self::Confirmed),
            "rejected" => Ok(Self::Rejected),
            _ => Err(format!("invalid payment transaction status: {s}")),
        }
    }
}

impl std::fmt::Display for DeletionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "none"),
            Self::PendingDeletion => write!(f, "pending_deletion"),
        }
    }
}

impl std::str::FromStr for DeletionStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "none" => Ok(Self::None),
            "pending_deletion" => Ok(Self::PendingDeletion),
            _ => Err(format!("invalid deletion status: {s}")),
        }
    }
}
