//! Short-lived codes for adding someone to the Zalo approver list without
//! anyone having to look up a Zalo ID: the app shows a code, the person messages
//! it to the bot, and their ID and name are read from that message.

use chrono::{DateTime, Duration, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use super::get_connection;

/// How long a code can be used after it is created.
pub const PAIRING_VALID_FOR: Duration = Duration::minutes(10);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZaloPairing {
    pub code: String,
    /// What the person gets once paired.
    pub can_approve: bool,
    pub can_command: bool,
    pub expires_at: String,
}

fn random_code() -> String {
    format!(
        "{:06}",
        u32::from_le_bytes(uuid::Uuid::new_v4().as_bytes()[..4].try_into().unwrap()) % 1_000_000
    )
}

fn create_with(conn: &Connection, can_approve: bool, can_command: bool) -> Result<ZaloPairing, String> {
    let now = Utc::now();
    conn.execute("DELETE FROM zalo_pairings WHERE expires_at <= ?1", params![now.to_rfc3339()])
        .map_err(|e| format!("Failed to clear old pairing codes: {e}"))?;

    for _ in 0..20 {
        let code = random_code();
        let taken: bool = conn
            .query_row("SELECT EXISTS(SELECT 1 FROM zalo_pairings WHERE code = ?1)", params![code], |r| r.get(0))
            .map_err(|e| format!("Failed to check pairing code: {e}"))?;
        if taken {
            continue;
        }
        let expires_at = (now + PAIRING_VALID_FOR).to_rfc3339();
        conn.execute(
            "INSERT INTO zalo_pairings (code, can_approve, can_command, expires_at) VALUES (?1, ?2, ?3, ?4)",
            params![code, can_approve, can_command, expires_at],
        )
        .map_err(|e| format!("Failed to create pairing code: {e}"))?;
        return Ok(ZaloPairing { code, can_approve, can_command, expires_at });
    }
    Err("Could not generate a free pairing code".to_string())
}

/// Use up a code: returns what it grants and deletes it, so it works once.
fn claim_with(conn: &Connection, code: &str, now: DateTime<Utc>) -> Result<Option<ZaloPairing>, String> {
    conn.query_row(
        "DELETE FROM zalo_pairings WHERE code = ?1 AND expires_at > ?2
         RETURNING code, can_approve, can_command, expires_at",
        params![code, now.to_rfc3339()],
        |row| {
            Ok(ZaloPairing {
                code: row.get(0)?,
                can_approve: row.get(1)?,
                can_command: row.get(2)?,
                expires_at: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("Failed to use pairing code: {e}"))
}

pub fn create_pairing(can_approve: bool, can_command: bool) -> Result<ZaloPairing, String> {
    create_with(&get_connection()?, can_approve, can_command)
}

pub fn claim_pairing(code: &str) -> Result<Option<ZaloPairing>, String> {
    claim_with(&get_connection()?, code, Utc::now())
}

pub fn cancel_pairing(code: &str) -> Result<(), String> {
    get_connection()?
        .execute("DELETE FROM zalo_pairings WHERE code = ?1", params![code])
        .map_err(|e| format!("Failed to cancel pairing code: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::conn::init_zalo_pairings_table(&conn).unwrap();
        conn
    }

    #[test]
    fn a_code_works_once_and_carries_its_permissions() {
        let conn = db();
        let pairing = create_with(&conn, true, false).unwrap();
        assert_eq!(pairing.code.len(), 6);

        let claimed = claim_with(&conn, &pairing.code, Utc::now()).unwrap().unwrap();
        assert!(claimed.can_approve && !claimed.can_command);
        assert!(claim_with(&conn, &pairing.code, Utc::now()).unwrap().is_none(), "single use");
    }

    #[test]
    fn unknown_and_expired_codes_are_refused() {
        let conn = db();
        assert!(claim_with(&conn, "000000", Utc::now()).unwrap().is_none());

        let pairing = create_with(&conn, true, true).unwrap();
        let later = Utc::now() + PAIRING_VALID_FOR + Duration::seconds(1);
        assert!(claim_with(&conn, &pairing.code, later).unwrap().is_none());
    }

    #[test]
    fn creating_a_code_clears_expired_ones() {
        let conn = db();
        conn.execute(
            "INSERT INTO zalo_pairings (code, can_approve, can_command, expires_at) VALUES ('111111', 1, 0, '2000-01-01T00:00:00+00:00')",
            [],
        )
        .unwrap();
        create_with(&conn, true, false).unwrap();
        let left: i64 = conn.query_row("SELECT COUNT(*) FROM zalo_pairings WHERE code = '111111'", [], |r| r.get(0)).unwrap();
        assert_eq!(left, 0);
    }
}
