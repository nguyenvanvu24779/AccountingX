use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use super::get_connection;

/// What an approval ticket is standing in for. More kinds (e.g. a ledger
/// write, once the MISA playbook exists) are added here as they're built.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalKind {
    ZaloCommand,
    EmailSend,
    /// A write action a MISA playbook (browser-use) wants to take — e.g.
    /// submitting a form, not a read-only check like an inventory lookup.
    MisaAction,
}

impl ApprovalKind {
    fn as_str(self) -> &'static str {
        match self {
            ApprovalKind::ZaloCommand => "zalo_command",
            ApprovalKind::EmailSend => "email_send",
            ApprovalKind::MisaAction => "misa_action",
        }
    }

    fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "zalo_command" => Ok(ApprovalKind::ZaloCommand),
            "email_send" => Ok(ApprovalKind::EmailSend),
            "misa_action" => Ok(ApprovalKind::MisaAction),
            other => Err(format!("unknown approval kind `{other}`")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
}

impl ApprovalStatus {
    fn as_str(self) -> &'static str {
        match self {
            ApprovalStatus::Pending => "pending",
            ApprovalStatus::Approved => "approved",
            ApprovalStatus::Rejected => "rejected",
        }
    }

    fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "pending" => Ok(ApprovalStatus::Pending),
            "approved" => Ok(ApprovalStatus::Approved),
            "rejected" => Ok(ApprovalStatus::Rejected),
            other => Err(format!("unknown approval status `{other}`")),
        }
    }
}

/// One piece of evidence attached to a ticket: a file path (Excel export,
/// screenshot, ...) with a short label for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRef {
    pub label: String,
    pub path: String,
}

/// Something with a side effect, waiting for a human to say yes. Created by
/// whatever wants to act (a Zalo command, a drafted email, later a ledger
/// write), resolved either in the app or — for `kind`s that support it — by
/// an approver replying with the short code over Zalo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalTicket {
    pub id: String,
    /// Short enough to type back over Zalo; unique among currently-pending tickets.
    pub short_code: String,
    pub kind: ApprovalKind,
    /// Which company's workspace this belongs to, when relevant.
    pub company_id: Option<String>,
    /// One line describing what would happen, shown to the approver.
    pub summary: String,
    pub evidence: Vec<EvidenceRef>,
    pub status: ApprovalStatus,
    /// Who/what asked for approval (e.g. a bot id).
    pub requested_by: Option<String>,
    /// Who resolved it (a Zalo user id or the local user), once resolved.
    pub approver_id: Option<String>,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

const COLUMNS: &str = "id, short_code, kind, company_id, summary, evidence, status, \
     requested_by, approver_id, created_at, resolved_at";

fn row_to_ticket(row: &rusqlite::Row<'_>) -> rusqlite::Result<ApprovalTicket> {
    let kind: String = row.get(2)?;
    let status: String = row.get(6)?;
    let evidence: String = row.get(5)?;
    Ok(ApprovalTicket {
        id: row.get(0)?,
        short_code: row.get(1)?,
        kind: ApprovalKind::parse(&kind).unwrap_or(ApprovalKind::ZaloCommand),
        company_id: row.get(3)?,
        summary: row.get(4)?,
        evidence: serde_json::from_str(&evidence).unwrap_or_default(),
        status: ApprovalStatus::parse(&status).unwrap_or(ApprovalStatus::Pending),
        requested_by: row.get(7)?,
        approver_id: row.get(8)?,
        created_at: row.get(9)?,
        resolved_at: row.get(10)?,
    })
}

/// A 6-digit code, re-rolled until it doesn't collide with a code already
/// pending. Collisions are only possible against pending tickets: a resolved
/// one's code is free to reuse.
fn generate_short_code(conn: &rusqlite::Connection) -> Result<String, String> {
    for _ in 0..20 {
        let candidate = format!(
            "{:06}",
            u32::from_le_bytes(uuid::Uuid::new_v4().as_bytes()[..4].try_into().unwrap()) % 1_000_000
        );
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM approval_tickets WHERE short_code = ?1 AND status = 'pending')",
                params![candidate],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to check approval code: {e}"))?;
        if !exists {
            return Ok(candidate);
        }
    }
    Err("Could not generate a free approval code".to_string())
}

#[allow(clippy::too_many_arguments)]
pub fn create_approval(
    kind: ApprovalKind,
    company_id: Option<&str>,
    summary: &str,
    evidence: &[EvidenceRef],
    requested_by: Option<&str>,
) -> Result<ApprovalTicket, String> {
    let conn = get_connection()?;
    let id = uuid::Uuid::new_v4().to_string();
    let short_code = generate_short_code(&conn)?;
    let now = Utc::now().to_rfc3339();
    let evidence_json = serde_json::to_string(evidence).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO approval_tickets (
            id, short_code, kind, company_id, summary, evidence, status,
            requested_by, approver_id, created_at, resolved_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, NULL, ?8, NULL)",
        params![
            id,
            short_code,
            kind.as_str(),
            company_id,
            summary,
            evidence_json,
            requested_by,
            now
        ],
    )
    .map_err(|e| format!("Failed to create approval ticket: {e}"))?;

    get_approval(&id)?.ok_or_else(|| "Failed to read back the created approval".to_string())
}

pub fn get_approval(id: &str) -> Result<Option<ApprovalTicket>, String> {
    let conn = get_connection()?;
    let mut stmt = conn
        .prepare(&format!("SELECT {COLUMNS} FROM approval_tickets WHERE id = ?1"))
        .map_err(|e| format!("Failed to prepare approval query: {e}"))?;
    let mut rows = stmt
        .query_map(params![id], row_to_ticket)
        .map_err(|e| format!("Failed to query approval: {e}"))?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| format!("Failed to read approval: {e}"))?)),
        None => Ok(None),
    }
}

/// Pending tickets, oldest first (so the one waiting longest surfaces first).
pub fn list_pending_approvals() -> Result<Vec<ApprovalTicket>, String> {
    let conn = get_connection()?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM approval_tickets WHERE status = 'pending' ORDER BY created_at ASC"
        ))
        .map_err(|e| format!("Failed to prepare approval list query: {e}"))?;
    let rows = stmt
        .query_map([], row_to_ticket)
        .map_err(|e| format!("Failed to query approvals: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read approvals: {e}"))
}

/// Resolve the pending ticket with this short code. Fails if no pending
/// ticket has that code — it may have already been resolved, or never
/// existed — so a caller (the app button or the Zalo handler) can tell the
/// approver their code didn't match anything.
pub fn respond_approval(
    short_code: &str,
    approve: bool,
    approver_id: Option<&str>,
) -> Result<ApprovalTicket, String> {
    let conn = get_connection()?;
    let id: String = conn
        .query_row(
            "SELECT id FROM approval_tickets WHERE short_code = ?1 AND status = 'pending'",
            params![short_code],
            |row| row.get(0),
        )
        .map_err(|_| format!("No pending approval with code `{short_code}`"))?;

    let status = if approve { ApprovalStatus::Approved } else { ApprovalStatus::Rejected };
    conn.execute(
        "UPDATE approval_tickets SET status = ?1, approver_id = ?2, resolved_at = ?3 WHERE id = ?4",
        params![status.as_str(), approver_id, Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| format!("Failed to resolve approval: {e}"))?;

    get_approval(&id)?.ok_or_else(|| "Failed to read back the resolved approval".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init(conn: &rusqlite::Connection) {
        crate::conn::init_approval_tickets_table(conn).unwrap();
    }

    #[test]
    fn short_codes_are_six_digits_and_unique_among_pending() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        init(&conn);
        let a = generate_short_code(&conn).unwrap();
        assert_eq!(a.len(), 6);
        conn.execute(
            "INSERT INTO approval_tickets (id, short_code, kind, company_id, summary, evidence, status, requested_by, approver_id, created_at, resolved_at)
             VALUES ('t1', ?1, 'zalo_command', NULL, 'x', '[]', 'pending', NULL, NULL, '', NULL)",
            params![a],
        ).unwrap();
        let b = generate_short_code(&conn).unwrap();
        assert_ne!(a, b, "a fresh code must not collide with a still-pending one");
    }

    #[test]
    fn respond_only_matches_a_pending_code() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        init(&conn);
        conn.execute(
            "INSERT INTO approval_tickets (id, short_code, kind, company_id, summary, evidence, status, requested_by, approver_id, created_at, resolved_at)
             VALUES ('t1', '123456', 'email_send', NULL, 'send invoice', '[]', 'pending', NULL, NULL, '2020-01-01T00:00:00Z', NULL)",
            [],
        ).unwrap();

        let resolved = respond_approval_with_conn(&conn, "123456", true, Some("approver-1")).unwrap();
        assert_eq!(resolved.status, ApprovalStatus::Approved);
        assert_eq!(resolved.approver_id, Some("approver-1".to_string()));

        // The same code cannot be resolved twice.
        assert!(respond_approval_with_conn(&conn, "123456", true, None).is_err());
    }

    // Test-only indirection so the resolve logic can run against an in-memory
    // connection instead of the real on-disk database.
    fn respond_approval_with_conn(
        conn: &rusqlite::Connection,
        short_code: &str,
        approve: bool,
        approver_id: Option<&str>,
    ) -> Result<ApprovalTicket, String> {
        let id: String = conn
            .query_row(
                "SELECT id FROM approval_tickets WHERE short_code = ?1 AND status = 'pending'",
                params![short_code],
                |row| row.get(0),
            )
            .map_err(|_| format!("No pending approval with code `{short_code}`"))?;
        let status = if approve { ApprovalStatus::Approved } else { ApprovalStatus::Rejected };
        conn.execute(
            "UPDATE approval_tickets SET status = ?1, approver_id = ?2, resolved_at = ?3 WHERE id = ?4",
            params![status.as_str(), approver_id, Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| format!("Failed to resolve approval: {e}"))?;
        let mut stmt = conn
            .prepare(&format!("SELECT {COLUMNS} FROM approval_tickets WHERE id = ?1"))
            .unwrap();
        let mut rows = stmt.query_map(params![id], row_to_ticket).unwrap();
        Ok(rows.next().unwrap().unwrap())
    }
}
