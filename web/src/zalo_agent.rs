//! Talking to the AI over Zalo.
//!
//! Someone on the approver list is trusted, so what they write goes straight to
//! Codex as a chat message, in the folder of the company they are working on,
//! and the AI's answer comes back as a Zalo message. Each person keeps one
//! Codex conversation per company, so a follow-up continues the same chat.
//! When Codex needs a person ("may I open this page?", "run this command?") the
//! question is put to them on Zalo and their "ok" / "không" is passed back.
//!
//! The conversation is an ordinary Codex thread in the company folder, so it
//! also appears in the app, and every permission Codex asks for still applies.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

use codexia_codex::app_server::CodexAppServer;
use codexia_codex::protocol::RequestId;
use serde_json::{Value, json};
use tokio::sync::Mutex;

use crate::types::WebServerState;
use crate::zalo_text::{
    Company, Reply, RequestKind, chunk_for_chat, company_menu, is_stop, list_companies, parse_company_choice,
    parse_reply, request_kind, request_question, request_response, tidy_for_chat, user_input_is_secret,
    user_input_response,
};

#[derive(Default)]
pub struct ZaloAgentState {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    /// Live conversations, by Codex thread id.
    sessions: HashMap<String, Session>,
    /// A task waiting for its sender to say which company it is for.
    waiting_for_company: HashMap<String, Waiting>,
}

struct Waiting {
    text: String,
    reply_thread: String,
    reply_type: String,
}

struct Session {
    sender_id: String,
    cwd: String,
    reply_thread: String,
    reply_type: String,
    running: bool,
    turn_id: Option<String>,
    final_text: Option<String>,
    /// Messages sent while the AI was busy; handled one at a time afterwards.
    queue: VecDeque<String>,
    /// Questions from Codex waiting for the person's answer.
    pending: VecDeque<PendingRequest>,
}

struct PendingRequest {
    request_id: Value,
    kind: RequestKind,
    params: Value,
}

fn codex(state: &WebServerState) -> Option<Arc<CodexAppServer>> {
    state.codex_state.as_ref().map(|s| Arc::clone(&s.codex))
}

fn companies_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".accountingx").join("companies"))
}

/// Send `text` to a Zalo thread, split into chat-sized messages.
async fn say(state: &WebServerState, thread_id: &str, thread_type: &str, text: &str) {
    let Some(sidecar) = state.zalo_state.sidecar.lock().await.clone() else {
        return;
    };
    for chunk in chunk_for_chat(&tidy_for_chat(text)) {
        if let Err(e) = sidecar.send_message(thread_id, thread_type, &chunk).await {
            log::warn!("zalo: could not send a message: {e}");
            return;
        }
    }
}

/// A message from someone on the approver list that is not a ticket reply.
pub async fn handle_user_message(
    state: &WebServerState,
    sender_id: &str,
    can_approve: bool,
    reply_thread: String,
    reply_type: String,
    text: String,
) {
    let agent = &state.zalo_state.agent;
    let text = text.trim().to_string();
    if text.is_empty() {
        return;
    }

    // 1. An answer to something the AI asked.
    if answer_pending_request(state, sender_id, &reply_thread, &reply_type, &text).await {
        return;
    }
    // 1b. A bare "ok"/"không" with exactly one ticket waiting decides that ticket.
    if can_approve
        && let Some(reply) = parse_reply(&text)
        && let Ok(pending) = codexia_db::approvals::list_pending_approvals()
        && let [ticket] = pending.as_slice()
    {
        let approve = reply != Reply::No;
        let answer = match codexia_db::approvals::respond_approval(&ticket.short_code, approve, Some(sender_id)) {
            Ok(done) => format!("Đã {} phiếu {}: {}", if approve { "duyệt" } else { "từ chối" }, done.short_code, done.summary),
            Err(e) => format!("Không xử lý được phiếu: {e}"),
        };
        say(state, &reply_thread, &reply_type, &answer).await;
        return;
    }

    let Some(codex) = codex(state) else {
        say(state, &reply_thread, &reply_type, "AI chưa sẵn sàng, bạn thử lại sau ít phút nhé.").await;
        return;
    };

    // 2. Stop what the AI is doing.
    if is_stop(&text) {
        let target = {
            let inner = agent.inner.lock().await;
            inner
                .sessions
                .iter()
                .find(|(_, s)| s.sender_id == sender_id && s.running)
                .map(|(id, s)| (id.clone(), s.turn_id.clone()))
        };
        let answer = match target {
            Some((thread_id, Some(turn_id))) => {
                let _ = codex
                    .send_request("turn/interrupt", json!({ "threadId": thread_id, "turnId": turn_id }))
                    .await;
                "Đã dừng."
            }
            _ => "Hiện không có việc nào đang chạy.",
        };
        say(state, &reply_thread, &reply_type, answer).await;
        return;
    }

    // 3. Which company is this about?
    let companies = companies_dir().map(|d| list_companies(&d)).unwrap_or_default();
    if companies.is_empty() {
        say(state, &reply_thread, &reply_type, "Chưa có công ty nào trong AccountingX. Hãy thêm công ty trong ứng dụng trước.").await;
        return;
    }
    if let Some(index) = parse_company_choice(&text, &companies) {
        let company = &companies[index];
        if let Err(e) = codexia_db::zalo_threads::set_active_cwd(sender_id, &company.cwd.to_string_lossy()) {
            log::warn!("zalo: could not remember the company choice: {e}");
        }
        let waiting = agent.inner.lock().await.waiting_for_company.remove(sender_id);
        match waiting {
            Some(task) => {
                say(state, &task.reply_thread, &task.reply_type, &format!("Đã chọn {}.", company.name)).await;
                send_to_ai(state, &codex, sender_id, task.reply_thread, task.reply_type, company, task.text).await;
            }
            None => say(state, &reply_thread, &reply_type, &format!("Đã chọn {}.", company.name)).await,
        }
        return;
    }
    let Some(company) = current_company(sender_id, &companies) else {
        agent.inner.lock().await.waiting_for_company.insert(
            sender_id.to_string(),
            Waiting { text, reply_thread: reply_thread.clone(), reply_type: reply_type.clone() },
        );
        say(state, &reply_thread, &reply_type, &company_menu(&companies)).await;
        return;
    };

    // 4. Hand it to the AI.
    send_to_ai(state, &codex, sender_id, reply_thread, reply_type, &company, text).await;
}

/// The company this person is working on: their last choice if it still
/// exists, or the only company there is.
fn current_company(sender_id: &str, companies: &[Company]) -> Option<Company> {
    let chosen = codexia_db::zalo_threads::active_cwd(sender_id).ok().flatten();
    if let Some(cwd) = chosen
        && let Some(found) = companies.iter().find(|c| c.cwd.to_string_lossy() == cwd)
    {
        return Some(found.clone());
    }
    if let [only] = companies {
        let _ = codexia_db::zalo_threads::set_active_cwd(sender_id, &only.cwd.to_string_lossy());
        return Some(only.clone());
    }
    None
}

/// If the AI is waiting on this person, treat `text` as the answer. Returns
/// whether the message was used up that way.
async fn answer_pending_request(
    state: &WebServerState,
    sender_id: &str,
    reply_thread: &str,
    reply_type: &str,
    text: &str,
) -> bool {
    let Some(codex) = codex(state) else {
        return false;
    };
    let mut inner = state.zalo_state.agent.inner.lock().await;
    let Some(session) = inner.sessions.values_mut().find(|s| s.sender_id == sender_id && !s.pending.is_empty()) else {
        return false;
    };
    let front = session.pending.front().expect("checked non-empty");

    let response = if front.kind == RequestKind::UserInput {
        user_input_response(&front.params, text)
    } else {
        parse_reply(text).map(|reply| request_response(front.kind, &front.params, reply))
    };
    let Some(response) = response else {
        drop(inner);
        say(state, reply_thread, reply_type, "Em đang chờ bạn trả lời câu hỏi trên: \"ok\", \"ok luôn\" hoặc \"không\".").await;
        return true;
    };

    let request = session.pending.pop_front().expect("checked non-empty");
    drop(inner);
    match serde_json::from_value::<RequestId>(request.request_id) {
        Ok(id) => {
            if let Err(e) = codex.send_response(id, response).await {
                log::warn!("zalo: could not answer the AI's request: {e}");
            }
        }
        Err(e) => log::warn!("zalo: bad request id from Codex: {e}"),
    }
    true
}

async fn send_to_ai(
    state: &WebServerState,
    codex: &Arc<CodexAppServer>,
    sender_id: &str,
    reply_thread: String,
    reply_type: String,
    company: &Company,
    text: String,
) {
    let cwd = company.cwd.to_string_lossy().into_owned();
    let thread_id = match ensure_thread(state, codex, sender_id, &cwd).await {
        Ok(id) => id,
        Err(e) => {
            log::warn!("zalo: could not open a Codex conversation: {e}");
            say(state, &reply_thread, &reply_type, "Em chưa mở được cuộc trò chuyện với AI. Bạn thử lại sau nhé.").await;
            return;
        }
    };

    {
        let mut inner = state.zalo_state.agent.inner.lock().await;
        let session = inner.sessions.entry(thread_id.clone()).or_insert_with(|| Session {
            sender_id: sender_id.to_string(),
            cwd: cwd.clone(),
            reply_thread: reply_thread.clone(),
            reply_type: reply_type.clone(),
            running: false,
            turn_id: None,
            final_text: None,
            queue: VecDeque::new(),
            pending: VecDeque::new(),
        });
        session.reply_thread = reply_thread.clone();
        session.reply_type = reply_type.clone();
        if session.running {
            session.queue.push_back(text);
            drop(inner);
            say(state, &reply_thread, &reply_type, "Em đang làm việc trước đó, xong em làm tiếp việc này nhé.").await;
            return;
        }
        session.running = true;
        session.final_text = None;
    }

    say(state, &reply_thread, &reply_type, &format!("Dạ, em đang xử lý ({}).", company.name)).await;
    start_turn(state, codex, &thread_id, &cwd, &text).await;
}

/// Name the conversation after the person so it is easy to spot in the app's
/// list. Harmless to repeat, and it also renames conversations made before.
async fn name_thread(codex: &Arc<CodexAppServer>, sender_id: &str, thread_id: &str) {
    let person = codexia_db::zalo_approvers::get_approver(sender_id)
        .ok()
        .flatten()
        .map(|a| a.display_name)
        .unwrap_or_else(|| "Zalo".to_string());
    let _ = codex
        .send_request("thread/name/set", json!({ "threadId": thread_id, "name": format!("Zalo · {person}") }))
        .await;
}

/// This person's Codex conversation for the company: the saved one if it can be
/// resumed, otherwise a new one.
async fn ensure_thread(
    state: &WebServerState,
    codex: &Arc<CodexAppServer>,
    sender_id: &str,
    cwd: &str,
) -> Result<String, String> {
    if let Some(saved) = codexia_db::zalo_threads::thread_for(sender_id, cwd).ok().flatten() {
        let known = state.zalo_state.agent.inner.lock().await.sessions.contains_key(&saved);
        if known || codex.send_request("thread/resume", json!({ "threadId": saved })).await.is_ok() {
            name_thread(codex, sender_id, &saved).await;
            return Ok(saved);
        }
    }

    let started = codex
        .send_request(
            "thread/start",
            json!({
                "approvalPolicy": "on-request",
                "sandbox": "workspace-write",
                "cwd": cwd,
                "config": { "model_reasoning_effort": "medium" },
                "personality": "friendly",
                "experimentalRawEvents": true,
            }),
        )
        .await?;
    let thread_id = started
        .pointer("/thread/id")
        .and_then(Value::as_str)
        .ok_or("thread/start response missing thread.id")?
        .to_string();
    if let Err(e) = codexia_db::zalo_threads::save_thread(sender_id, cwd, Some(&thread_id)) {
        log::warn!("zalo: could not remember the conversation: {e}");
    }

    name_thread(codex, sender_id, &thread_id).await;
    Ok(thread_id)
}

async fn start_turn(state: &WebServerState, codex: &Arc<CodexAppServer>, thread_id: &str, cwd: &str, text: &str) {
    let result = codex
        .send_request(
            "turn/start",
            json!({
                "threadId": thread_id,
                "input": [{ "type": "text", "text": text, "text_elements": [] }],
                "approvalPolicy": "on-request",
                "sandboxPolicy": {
                    "type": "workspaceWrite",
                    "writableRoots": [],
                    "readOnlyAccess": { "type": "fullAccess" },
                    "networkAccess": false,
                    "excludeTmpdirEnvVar": false,
                    "excludeSlashTmp": false
                },
                "effort": "medium",
                "personality": "friendly",
                "cwd": cwd,
            }),
        )
        .await;

    let mut inner = state.zalo_state.agent.inner.lock().await;
    let Some(session) = inner.sessions.get_mut(thread_id) else {
        return;
    };
    match result {
        Ok(started) => {
            session.turn_id = started.pointer("/turn/id").and_then(Value::as_str).map(str::to_string);
        }
        Err(e) => {
            session.running = false;
            let (thread, kind) = (session.reply_thread.clone(), session.reply_type.clone());
            drop(inner);
            log::warn!("zalo: turn/start failed: {e}");
            say(state, &thread, &kind, "Em chưa bắt đầu được việc này. Bạn thử lại sau nhé.").await;
        }
    }
}

/// Listen to what Codex does and answer on Zalo: the final reply of a turn, and
/// any question that needs a person.
pub async fn run_event_loop(state: WebServerState) {
    let mut events = state.event_tx.subscribe();
    loop {
        match events.recv().await {
            Ok((event, payload)) => handle_event(&state, &event, &payload).await,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                log::warn!("zalo agent: missed {skipped} events");
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
        }
    }
}

async fn handle_event(state: &WebServerState, event: &str, payload: &Value) {
    if event == "codex:notification" {
        let params = payload.get("params").unwrap_or(&Value::Null);
        let Some(thread_id) = params.get("threadId").and_then(Value::as_str) else {
            return;
        };
        match payload.get("method").and_then(Value::as_str) {
            Some("item/completed") => remember_agent_message(state, thread_id, params).await,
            Some("turn/completed") => finish_turn(state, thread_id, params).await,
            _ => {}
        }
        return;
    }

    let Some(kind) = request_kind(event, payload) else {
        return;
    };
    let Some(thread_id) = payload.get("threadId").and_then(Value::as_str) else {
        return;
    };
    let mut inner = state.zalo_state.agent.inner.lock().await;
    let Some(session) = inner.sessions.get_mut(thread_id) else {
        return; // Not a Zalo conversation: the app's own screen handles it.
    };
    let (reply_thread, reply_type) = (session.reply_thread.clone(), session.reply_type.clone());

    if kind == RequestKind::UserInput && user_input_is_secret(payload) {
        drop(inner);
        say(state, &reply_thread, &reply_type, "AI cần một thông tin bí mật (mật khẩu/mã). Vì an toàn, hãy trả lời trực tiếp trong ứng dụng AccountingX, đừng gửi qua Zalo.").await;
        return;
    }
    session.pending.push_back(PendingRequest {
        request_id: payload.get("requestId").cloned().unwrap_or(Value::Null),
        kind,
        params: payload.clone(),
    });
    drop(inner);
    say(state, &reply_thread, &reply_type, &request_question(kind, payload)).await;
}

async fn remember_agent_message(state: &WebServerState, thread_id: &str, params: &Value) {
    let Some(item) = params.get("item") else {
        return;
    };
    if item.get("type").and_then(Value::as_str) != Some("agentMessage") {
        return;
    }
    // Commentary is the AI narrating its steps; the answer is what comes last.
    if item.get("phase").and_then(Value::as_str) == Some("commentary") {
        return;
    }
    let Some(text) = item.get("text").and_then(Value::as_str) else {
        return;
    };
    if let Some(session) = state.zalo_state.agent.inner.lock().await.sessions.get_mut(thread_id) {
        session.final_text = Some(text.to_string());
    }
}

async fn finish_turn(state: &WebServerState, thread_id: &str, params: &Value) {
    let status = params.pointer("/turn/status").and_then(Value::as_str).unwrap_or("completed");
    let error = params.pointer("/turn/error/message").and_then(Value::as_str).map(str::to_string);

    let (reply_thread, reply_type, answer, next, cwd) = {
        let mut inner = state.zalo_state.agent.inner.lock().await;
        let Some(session) = inner.sessions.get_mut(thread_id) else {
            return;
        };
        session.running = false;
        session.turn_id = None;
        session.pending.clear();
        let answer = match status {
            "interrupted" => "Đã dừng.".to_string(),
            "failed" => format!("Có lỗi khi xử lý: {}", error.unwrap_or_else(|| "không rõ nguyên nhân".to_string())),
            _ => session.final_text.take().unwrap_or_else(|| "Đã xong.".to_string()),
        };
        let next = session.queue.pop_front();
        if next.is_some() {
            session.running = true;
            session.final_text = None;
        }
        (session.reply_thread.clone(), session.reply_type.clone(), answer, next, session.cwd.clone())
    };

    say(state, &reply_thread, &reply_type, &answer).await;

    if let (Some(text), Some(codex)) = (next, codex(state)) {
        say(state, &reply_thread, &reply_type, "Dạ, em làm tiếp việc bạn nhắn lúc nãy.").await;
        start_turn(state, &codex, thread_id, &cwd, &text).await;
    }
}
