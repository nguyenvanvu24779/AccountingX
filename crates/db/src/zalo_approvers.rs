use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use super::get_connection;

/// Someone allowed to talk to the Zalo bot — either to approve/reject
/// pending tickets, or to hand it a free-form task for one bot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZaloApprover {
    /// Zalo's own user id for this person (the thread id their messages carry).
    pub zalo_user_id: String,
    pub display_name: String,
    /// Which bot a free-form message from this person is handed to. `None`
    /// means they can only approve/reject — no command routing for them.
    pub bot_id: Option<String>,
    pub can_approve: bool,
    pub can_command: bool,
    pub created_at: String,
}

const COLUMNS: &str =
    "zalo_user_id, display_name, bot_id, can_approve, can_command, created_at";

fn row_to_approver(row: &rusqlite::Row<'_>) -> rusqlite::Result<ZaloApprover> {
    Ok(ZaloApprover {
        zalo_user_id: row.get(0)?,
        display_name: row.get(1)?,
        bot_id: row.get(2)?,
        can_approve: row.get(3)?,
        can_command: row.get(4)?,
        created_at: row.get(5)?,
    })
}

pub fn add_approver(
    zalo_user_id: &str,
    display_name: &str,
    bot_id: Option<&str>,
    can_approve: bool,
    can_command: bool,
) -> Result<ZaloApprover, String> {
    let conn = get_connection()?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO zalo_approvers (zalo_user_id, display_name, bot_id, can_approve, can_command, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(zalo_user_id) DO UPDATE SET
            display_name = excluded.display_name,
            bot_id = excluded.bot_id,
            can_approve = excluded.can_approve,
            can_command = excluded.can_command",
        params![zalo_user_id, display_name, bot_id, can_approve, can_command, now],
    )
    .map_err(|e| format!("Failed to add Zalo approver: {e}"))?;

    get_approver(zalo_user_id)?.ok_or_else(|| "Failed to read back the Zalo approver".to_string())
}

pub fn get_approver(zalo_user_id: &str) -> Result<Option<ZaloApprover>, String> {
    let conn = get_connection()?;
    let mut stmt = conn
        .prepare(&format!("SELECT {COLUMNS} FROM zalo_approvers WHERE zalo_user_id = ?1"))
        .map_err(|e| format!("Failed to prepare Zalo approver query: {e}"))?;
    let mut rows = stmt
        .query_map(params![zalo_user_id], row_to_approver)
        .map_err(|e| format!("Failed to query Zalo approver: {e}"))?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| format!("Failed to read Zalo approver: {e}"))?)),
        None => Ok(None),
    }
}

pub fn list_approvers() -> Result<Vec<ZaloApprover>, String> {
    let conn = get_connection()?;
    let mut stmt = conn
        .prepare(&format!("SELECT {COLUMNS} FROM zalo_approvers ORDER BY created_at ASC"))
        .map_err(|e| format!("Failed to prepare Zalo approver list query: {e}"))?;
    let rows = stmt
        .query_map([], row_to_approver)
        .map_err(|e| format!("Failed to query Zalo approvers: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read Zalo approvers: {e}"))
}

pub fn remove_approver(zalo_user_id: &str) -> Result<(), String> {
    let conn = get_connection()?;
    conn.execute("DELETE FROM zalo_approvers WHERE zalo_user_id = ?1", params![zalo_user_id])
        .map_err(|e| format!("Failed to remove Zalo approver: {e}"))?;
    Ok(())
}
