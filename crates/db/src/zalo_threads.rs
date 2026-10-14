//! Which Codex conversation a Zalo person is in, per company, so a follow-up
//! message continues the same chat (and the AI remembers what was said) even
//! after the app restarts.

use rusqlite::{Connection, OptionalExtension, params};

use super::get_connection;

fn active_cwd_with(conn: &Connection, sender_id: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT cwd FROM zalo_threads WHERE sender_id = ?1 AND active = 1",
        params![sender_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("Failed to read the active company: {e}"))
}

fn set_active_with(conn: &Connection, sender_id: &str, cwd: &str) -> Result<(), String> {
    conn.execute("UPDATE zalo_threads SET active = 0 WHERE sender_id = ?1", params![sender_id])
        .map_err(|e| format!("Failed to switch company: {e}"))?;
    // Ensure a row exists for the company (without a conversation yet).
    conn.execute(
        "INSERT INTO zalo_threads (sender_id, cwd, thread_id, active) VALUES (?1, ?2, NULL, 1)
         ON CONFLICT(sender_id, cwd) DO UPDATE SET active = 1",
        params![sender_id, cwd],
    )
    .map_err(|e| format!("Failed to switch company: {e}"))?;
    Ok(())
}

fn thread_for_with(conn: &Connection, sender_id: &str, cwd: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT thread_id FROM zalo_threads WHERE sender_id = ?1 AND cwd = ?2",
        params![sender_id, cwd],
        |row| row.get::<_, Option<String>>(0),
    )
    .optional()
    .map(Option::flatten)
    .map_err(|e| format!("Failed to read the conversation: {e}"))
}

fn save_thread_with(conn: &Connection, sender_id: &str, cwd: &str, thread_id: Option<&str>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO zalo_threads (sender_id, cwd, thread_id, active) VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(sender_id, cwd) DO UPDATE SET thread_id = excluded.thread_id",
        params![sender_id, cwd, thread_id],
    )
    .map_err(|e| format!("Failed to save the conversation: {e}"))?;
    Ok(())
}

/// The company folder this person is currently working in, if they chose one.
pub fn active_cwd(sender_id: &str) -> Result<Option<String>, String> {
    active_cwd_with(&get_connection()?, sender_id)
}

pub fn set_active_cwd(sender_id: &str, cwd: &str) -> Result<(), String> {
    set_active_with(&get_connection()?, sender_id, cwd)
}

pub fn thread_for(sender_id: &str, cwd: &str) -> Result<Option<String>, String> {
    thread_for_with(&get_connection()?, sender_id, cwd)
}

/// Remember (or with `None`, forget) the conversation for this person and company.
pub fn save_thread(sender_id: &str, cwd: &str, thread_id: Option<&str>) -> Result<(), String> {
    save_thread_with(&get_connection()?, sender_id, cwd, thread_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::conn::init_zalo_threads_table(&conn).unwrap();
        conn
    }

    #[test]
    fn a_person_has_one_active_company_and_a_conversation_per_company() {
        let conn = db();
        assert_eq!(active_cwd_with(&conn, "u1").unwrap(), None);

        set_active_with(&conn, "u1", "/a").unwrap();
        save_thread_with(&conn, "u1", "/a", Some("thread-a")).unwrap();
        set_active_with(&conn, "u1", "/b").unwrap();

        assert_eq!(active_cwd_with(&conn, "u1").unwrap().as_deref(), Some("/b"));
        assert_eq!(thread_for_with(&conn, "u1", "/b").unwrap(), None);
        assert_eq!(thread_for_with(&conn, "u1", "/a").unwrap().as_deref(), Some("thread-a"));

        // Going back to the first company keeps its conversation.
        set_active_with(&conn, "u1", "/a").unwrap();
        assert_eq!(active_cwd_with(&conn, "u1").unwrap().as_deref(), Some("/a"));
        assert_eq!(thread_for_with(&conn, "u1", "/a").unwrap().as_deref(), Some("thread-a"));
    }

    #[test]
    fn people_do_not_share_state_and_a_conversation_can_be_forgotten() {
        let conn = db();
        set_active_with(&conn, "u1", "/a").unwrap();
        save_thread_with(&conn, "u1", "/a", Some("t1")).unwrap();
        assert_eq!(active_cwd_with(&conn, "u2").unwrap(), None);

        save_thread_with(&conn, "u1", "/a", None).unwrap();
        assert_eq!(thread_for_with(&conn, "u1", "/a").unwrap(), None);
    }
}
