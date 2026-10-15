use chrono::{Duration, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::get_connection;

/// How long an approved ticket can still be spent. An approval is for an
/// action happening now, not a standing permission.
const APPROVAL_VALID_FOR: Duration = Duration::hours(24);

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
///
/// `payload` is the exact action being approved (e.g. recipient, subject and
/// body of an email). The tool that performs the action must present the same
/// payload to [`consume_approval`], so approving one thing can't authorize
/// another, and each approval is spent once.
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
    /// The exact action this ticket approves, shown to the approver in full.
    pub payload: Option<Value>,
    pub evidence: Vec<EvidenceRef>,
    pub status: ApprovalStatus,
    /// Who/what asked for approval (e.g. a bot id).
    pub requested_by: Option<String>,
    /// Who resolved it (a Zalo user id or the local user), once resolved.
    pub approver_id: Option<String>,
    pub created_at: String,
    pub resolved_at: Option<String>,
    /// When the approved action was carried out; an approval is single-use.
    pub consumed_at: Option<String>,
}

const COLUMNS: &str = "id, short_code, kind, company_id, summary, evidence, status, \
     requested_by, approver_id, created_at, resolved_at, payload, consumed_at";

fn row_to_ticket(row: &rusqlite::Row<'_>) -> rusqlite::Result<ApprovalTicket> {
    let kind: String = row.get(2)?;
    let status: String = row.get(6)?;
    let evidence: String = row.get(5)?;
    let payload: Option<String> = row.get(11)?;
    Ok(ApprovalTicket {
        id: row.get(0)?,
        short_code: row.get(1)?,
        kind: ApprovalKind::parse(&kind).unwrap_or(ApprovalKind::ZaloCommand),
        company_id: row.get(3)?,
        summary: row.get(4)?,
        payload: payload.and_then(|p| serde_json::from_str(&p).ok()),
        evidence: serde_json::from_str(&evidence).unwrap_or_default(),
        status: ApprovalStatus::parse(&status).unwrap_or(ApprovalStatus::Pending),
        requested_by: row.get(7)?,
        approver_id: row.get(8)?,
        created_at: row.get(9)?,
        resolved_at: row.get(10)?,
        consumed_at: row.get(12)?,
    })
}

/// Serialize with object keys sorted at every level, so the same action
/// always produces the same string no matter how the caller ordered fields.
fn canonical_json(value: &Value) -> String {
    fn sorted(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut keys: Vec<&String> = map.keys().collect();
                keys.sort();
                Value::Object(keys.into_iter().map(|k| (k.clone(), sorted(&map[k]))).collect())
            }
            Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
            other => other.clone(),
        }
    }
    sorted(value).to_string()
}

/// A 6-digit code, re-rolled until it doesn't collide with a code already
/// pending. Collisions are only possible against pending tickets: a resolved
/// one's code is free to reuse.
fn generate_short_code(conn: &Connection) -> Result<String, String> {
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

fn get_approval_with(conn: &Connection, id: &str) -> Result<Option<ApprovalTicket>, String> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM approval_tickets WHERE id = ?1"),
        params![id],
        row_to_ticket,
    )
    .optional()
    .map_err(|e| format!("Failed to read approval: {e}"))
}

fn create_approval_with(
    conn: &Connection,
    kind: ApprovalKind,
    company_id: Option<&str>,
    summary: &str,
    payload: Option<&Value>,
    evidence: &[EvidenceRef],
    requested_by: Option<&str>,
) -> Result<ApprovalTicket, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let short_code = generate_short_code(conn)?;
    let now = Utc::now().to_rfc3339();
    let evidence_json = serde_json::to_string(evidence).unwrap_or_else(|_| "[]".to_string());
    let payload_json = payload.map(canonical_json);

    conn.execute(
        "INSERT INTO approval_tickets (
            id, short_code, kind, company_id, summary, evidence, status,
            requested_by, approver_id, created_at, resolved_at, payload, consumed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, NULL, ?8, NULL, ?9, NULL)",
        params![
            id,
            short_code,
            kind.as_str(),
            company_id,
            summary,
            evidence_json,
            requested_by,
            now,
            payload_json
        ],
    )
    .map_err(|e| format!("Failed to create approval ticket: {e}"))?;

    get_approval_with(conn, &id)?.ok_or_else(|| "Failed to read back the created approval".to_string())
}

fn respond_approval_with(
    conn: &Connection,
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

    get_approval_with(conn, &id)?.ok_or_else(|| "Failed to read back the resolved approval".to_string())
}

fn consume_approval_with(
    conn: &Connection,
    short_code: &str,
    kind: ApprovalKind,
    payload: &Value,
) -> Result<ApprovalTicket, String> {
    let payload_json = canonical_json(payload);
    let not_before = (Utc::now() - APPROVAL_VALID_FOR).to_rfc3339();

    // One statement, so two callers racing on the same approval can't both
    // win: whichever UPDATE lands first spends it.
    let id: Option<String> = conn
        .query_row(
            "UPDATE approval_tickets SET consumed_at = ?1
             WHERE id = (
                 SELECT id FROM approval_tickets
                 WHERE short_code = ?2 AND kind = ?3 AND payload = ?4
                   AND status = 'approved' AND consumed_at IS NULL AND resolved_at >= ?5
                 ORDER BY resolved_at DESC LIMIT 1
             )
             RETURNING id",
            params![Utc::now().to_rfc3339(), short_code, kind.as_str(), payload_json, not_before],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to spend approval: {e}"))?;

    match id {
        Some(id) => get_approval_with(conn, &id)?
            .ok_or_else(|| "Failed to read back the spent approval".to_string()),
        None => Err(explain_unusable(conn, short_code, kind, &payload_json)),
    }
}

/// Why a code couldn't be spent, phrased for the agent that tried — it should
/// stop and ask a human, not guess another code.
fn explain_unusable(conn: &Connection, short_code: &str, kind: ApprovalKind, payload_json: &str) -> String {
    let candidates: Vec<ApprovalTicket> = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM approval_tickets WHERE short_code = ?1 AND kind = ?2 ORDER BY created_at DESC"
        ))
        .and_then(|mut stmt| {
            stmt.query_map(params![short_code, kind.as_str()], row_to_ticket)?
                .collect::<Result<Vec<_>, _>>()
        })
        .unwrap_or_default();

    let Some(latest) = candidates.first() else {
        return format!("No approval `{short_code}` of this kind exists. Ask a person to approve the action first.");
    };
    let same_payload =
        |t: &ApprovalTicket| t.payload.as_ref().map(canonical_json).as_deref() == Some(payload_json);
    if !candidates.iter().any(same_payload) {
        return format!(
            "Approval `{short_code}` was given for different content. Request a new approval for exactly this action."
        );
    }
    match latest.status {
        ApprovalStatus::Pending => format!("Approval `{short_code}` is still waiting for a person to decide."),
        ApprovalStatus::Rejected => format!("Approval `{short_code}` was rejected. Do not carry out this action."),
        ApprovalStatus::Approved if latest.consumed_at.is_some() => {
            format!("Approval `{short_code}` was already used. Request a new approval to do this again.")
        }
        ApprovalStatus::Approved => format!("Approval `{short_code}` has expired. Request a new approval."),
    }
}

pub fn create_approval(
    kind: ApprovalKind,
    company_id: Option<&str>,
    summary: &str,
    payload: Option<&Value>,
    evidence: &[EvidenceRef],
    requested_by: Option<&str>,
) -> Result<ApprovalTicket, String> {
    let conn = get_connection()?;
    create_approval_with(&conn, kind, company_id, summary, payload, evidence, requested_by)
}

pub fn get_approval(id: &str) -> Result<Option<ApprovalTicket>, String> {
    let conn = get_connection()?;
    get_approval_with(&conn, id)
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

fn list_approved_unspent_with(conn: &Connection, kind: ApprovalKind) -> Result<Vec<ApprovalTicket>, String> {
    let not_before = (Utc::now() - APPROVAL_VALID_FOR).to_rfc3339();
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM approval_tickets
             WHERE status = 'approved' AND consumed_at IS NULL AND kind = ?1 AND resolved_at >= ?2
             ORDER BY resolved_at ASC"
        ))
        .map_err(|e| format!("Failed to prepare approved-ticket query: {e}"))?;
    let rows = stmt
        .query_map(params![kind.as_str(), not_before], row_to_ticket)
        .map_err(|e| format!("Failed to query approved tickets: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read approved tickets: {e}"))
}

/// Tickets of this kind a person has approved and nobody has acted on yet,
/// oldest first. Used to wake the AI that is waiting for the answer.
pub fn list_approved_unspent(kind: ApprovalKind) -> Result<Vec<ApprovalTicket>, String> {
    let conn = get_connection()?;
    list_approved_unspent_with(&conn, kind)
}

/// Resolve the pending ticket with this short code. Fails if no pending
/// ticket has that code — it may have already been resolved, or never
/// existed — so a caller (the app button or the Zalo handler) can tell the
/// approver their code didn't match anything.
///
/// Only a person may cause this call: the desktop UI (through a Tauri command,
/// not the local HTTP API an agent could reach) or a whitelisted Zalo approver.
pub fn respond_approval(
    short_code: &str,
    approve: bool,
    approver_id: Option<&str>,
) -> Result<ApprovalTicket, String> {
    let conn = get_connection()?;
    respond_approval_with(&conn, short_code, approve, approver_id)
}

/// Spend an approval right before carrying out the action it covers.
///
/// Succeeds only when a person approved this `kind` of action with exactly
/// this `payload`, within the last 24 hours, and the approval hasn't been
/// spent before. The error explains why otherwise, in words an agent can act
/// on (wait, ask again, or stop).
pub fn consume_approval(short_code: &str, kind: ApprovalKind, payload: &Value) -> Result<ApprovalTicket, String> {
    let conn = get_connection()?;
    consume_approval_with(&conn, short_code, kind, payload)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::conn::init_approval_tickets_table(&conn).unwrap();
        conn
    }

    fn email() -> Value {
        json!({ "to": "a@example.com", "subject": "Invoice", "body": "Please find attached." })
    }

    fn approved_email(conn: &Connection) -> ApprovalTicket {
        let ticket =
            create_approval_with(conn, ApprovalKind::EmailSend, None, "send invoice", Some(&email()), &[], None)
                .unwrap();
        respond_approval_with(conn, &ticket.short_code, true, Some("approver-1")).unwrap()
    }

    #[test]
    fn short_codes_are_six_digits_and_unique_among_pending() {
        let conn = db();
        let a = create_approval_with(&conn, ApprovalKind::ZaloCommand, None, "x", None, &[], None).unwrap();
        assert_eq!(a.short_code.len(), 6);
        let b = generate_short_code(&conn).unwrap();
        assert_ne!(a.short_code, b, "a fresh code must not collide with a still-pending one");
    }

    #[test]
    fn respond_only_matches_a_pending_code() {
        let conn = db();
        let resolved = approved_email(&conn);
        assert_eq!(resolved.status, ApprovalStatus::Approved);
        assert_eq!(resolved.approver_id, Some("approver-1".to_string()));

        // The same code cannot be resolved twice.
        assert!(respond_approval_with(&conn, &resolved.short_code, true, None).is_err());
    }

    #[test]
    fn approved_unspent_lists_only_approved_tickets_nobody_has_spent() {
        let conn = db();
        let waiting =
            create_approval_with(&conn, ApprovalKind::MisaAction, None, "wait", Some(&email()), &[], None).unwrap();
        let approved = approved_email(&conn);
        let misa = create_approval_with(&conn, ApprovalKind::MisaAction, Some("1"), "ghi", Some(&email()), &[], None)
            .unwrap();
        let misa = respond_approval_with(&conn, &misa.short_code, true, Some("p")).unwrap();

        let listed = list_approved_unspent_with(&conn, ApprovalKind::MisaAction).unwrap();
        assert_eq!(listed.len(), 1, "pending and other kinds are left out");
        assert_eq!(listed[0].id, misa.id);

        consume_approval_with(&conn, &misa.short_code, ApprovalKind::MisaAction, &email()).unwrap();
        assert!(list_approved_unspent_with(&conn, ApprovalKind::MisaAction).unwrap().is_empty());
        let _ = (waiting, approved);
    }

    #[test]
    fn an_approval_is_spent_exactly_once() {
        let conn = db();
        let ticket = approved_email(&conn);
        let spent = consume_approval_with(&conn, &ticket.short_code, ApprovalKind::EmailSend, &email()).unwrap();
        assert!(spent.consumed_at.is_some());

        let again = consume_approval_with(&conn, &ticket.short_code, ApprovalKind::EmailSend, &email());
        assert!(again.unwrap_err().contains("already used"));
    }

    #[test]
    fn field_order_does_not_matter_but_content_does() {
        let conn = db();
        let ticket = approved_email(&conn);

        let tampered = json!({ "to": "attacker@example.com", "subject": "Invoice", "body": "Please find attached." });
        let err = consume_approval_with(&conn, &ticket.short_code, ApprovalKind::EmailSend, &tampered).unwrap_err();
        assert!(err.contains("different content"));

        let reordered = json!({ "body": "Please find attached.", "subject": "Invoice", "to": "a@example.com" });
        assert!(consume_approval_with(&conn, &ticket.short_code, ApprovalKind::EmailSend, &reordered).is_ok());
    }

    #[test]
    fn pending_rejected_and_wrong_kind_cannot_be_spent() {
        let conn = db();
        let pending =
            create_approval_with(&conn, ApprovalKind::EmailSend, None, "s", Some(&email()), &[], None).unwrap();
        let err = consume_approval_with(&conn, &pending.short_code, ApprovalKind::EmailSend, &email()).unwrap_err();
        assert!(err.contains("still waiting"));

        let wrong_kind = consume_approval_with(&conn, &pending.short_code, ApprovalKind::MisaAction, &email());
        assert!(wrong_kind.is_err());

        respond_approval_with(&conn, &pending.short_code, false, None).unwrap();
        let err = consume_approval_with(&conn, &pending.short_code, ApprovalKind::EmailSend, &email()).unwrap_err();
        assert!(err.contains("rejected"));
    }

    #[test]
    fn an_old_approval_expires() {
        let conn = db();
        let ticket = approved_email(&conn);
        let long_ago = (Utc::now() - APPROVAL_VALID_FOR - Duration::minutes(1)).to_rfc3339();
        conn.execute("UPDATE approval_tickets SET resolved_at = ?1 WHERE id = ?2", params![long_ago, ticket.id])
            .unwrap();

        let err = consume_approval_with(&conn, &ticket.short_code, ApprovalKind::EmailSend, &email()).unwrap_err();
        assert!(err.contains("expired"));
    }
}
