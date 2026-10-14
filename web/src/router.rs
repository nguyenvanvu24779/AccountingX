use axum::{
    Router, middleware,
    http::{Method, header},
    routing::{get, post},
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use super::{
    handlers::{
        api_account_rate_limits, api_allow_sleep, api_archive_thread, api_unarchive_thread, api_canonicalize_path,
        
        api_create_approval, api_list_pending_approvals, api_consume_approval, api_browser_health, api_permission_mode,
        api_zalo_connect, api_zalo_disconnect, api_zalo_status,
        api_zalo_list_approvers, api_zalo_send,
        
        
        api_create_automation, api_delete_automation, api_list_automation_runs, api_list_automations, api_run_automation_now, api_set_automation_paused,
        api_update_automation,
        api_asset, api_codex_home, api_delete_file,
        api_get_account, api_get_agent_heatmaps, api_save_account_snapshot,
        api_list_account_snapshots, api_remove_account_snapshot, api_switch_account_snapshot, api_get_home_directory, api_get_insight_filter_options,
        api_get_insight_rankings, 
        
        
        
        api_list_threads, api_delete_thread, api_rename_thread, api_turn_steer,
        api_thread_goal_set, api_thread_goal_get, api_thread_goal_clear,
        api_thread_compact_start, api_thread_memory_mode_set, api_memory_reset,
        api_hooks_list, api_plugin_list, api_plugin_read, api_plugin_install,
        api_plugin_uninstall, api_plugin_installed,
        api_external_agent_config_detect, api_external_agent_config_import,
        api_external_agent_config_import_record_history,
        api_external_agent_config_import_read_histories,
        api_prevent_sleep,
        api_login_account, api_model_list, api_model_list_post, api_read_directory, api_read_file,
        api_check_app_installed, api_open_workspace_in,
        
        api_read_text_file, api_read_text_file_lines,
        api_respond_command_execution_approval,
        api_respond_file_change_approval, api_respond_mcp_elicitation,
        api_respond_permissions_approval, api_respond_user_input,
        api_resume_thread,
        api_rollback_thread, api_fork_thread,
        api_search_files, api_search_files_by_name, api_skills_config_write, api_skills_list, api_start_review,
        api_start_thread, api_watch_directory, api_unwatch_directory,
        api_mcp_server_oauth_login, api_list_mcp_server_status,
        api_skill_groups_read, api_skill_groups_write,
        api_skills_clone_repo, api_skills_delete_central, api_skills_install_marketplace,
        api_skills_link_to_agent, api_skills_list_central, api_skills_list_installed,
        api_skills_list_marketplace, api_skills_uninstall_installed,
        api_skillssh_install, api_skillssh_leaderboard, api_skillssh_search,
        api_turn_interrupt, api_turn_start,
        api_unified_add_mcp_server, api_unified_disable_mcp_server,
        api_unified_enable_mcp_server, api_unified_read_mcp_config,
        api_unified_remove_mcp_server, api_write_file,
        api_get_settings_file, api_save_settings_file, health_check, api_model_list_other, api_load_env_keys, api_set_env,
        api_list_provider_presets, api_add_model_provider, api_list_config_providers,
        api_remove_model_provider,
    },
    types::WebServerState,
    websocket::{sse_handler, ws_handler},
};
use crate::auth::require_device_token;
use crate::system_check::{api_system_check, api_system_repair};

fn resolve_dist_dir() -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();
    let mut add_candidate = |path: PathBuf| {
        if seen.insert(path.clone()) {
            candidates.push(path);
        }
    };

    if let Some(project_root) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
        add_candidate(project_root.join("dist"));
    }

    if let Ok(exe_path) = std::env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        add_candidate(exe_dir.join("dist"));
        add_candidate(exe_dir.join("../dist"));
        add_candidate(exe_dir.join("../../dist"));
        add_candidate(exe_dir.join("resources/dist"));
        add_candidate(exe_dir.join("../resources/dist"));
        add_candidate(exe_dir.join("../Resources/dist"));
        add_candidate(exe_dir.join("../../Resources/dist"));
    }

    add_candidate(PathBuf::from("dist"));

    candidates
        .into_iter()
        .find(|path| path.join("index.html").exists())
        .unwrap_or_else(|| PathBuf::from("dist"))
}

static EXTRA_ALLOWED_ORIGINS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();

/// Adds operator-configured origins (e.g. `--allow-origin https://my.host`) to
/// the CORS allowlist, on top of the loopback defaults below. Call
/// once at startup, before the server starts accepting connections.
///
/// This only widens which origins the browser lets make the request — every
/// non-loopback request still needs a valid device token (see `auth.rs`), so
/// an extra origin alone cannot drive the desktop.
pub fn set_extra_allowed_origins(origins: Vec<String>) {
    if EXTRA_ALLOWED_ORIGINS.set(origins).is_err() {
        log::warn!("set_extra_allowed_origins called more than once; ignoring later call");
    }
}

/// Whether a browser origin may call this API cross-origin.
///
/// Only the locally served UI qualifies by default.
/// Anything else — an arbitrary site the user happens to visit — must not be
/// able to drive the desktop, which matters especially because the auth
/// layer exempts loopback requests from presenting a token. Operators can
/// add more origins via `set_extra_allowed_origins`.
fn origin_is_allowed(origin: &str) -> bool {
    if let Some(extra) = EXTRA_ALLOWED_ORIGINS.get()
        && extra.iter().any(|allowed| allowed == origin)
    {
        return true;
    }

    // Tauri mobile webviews use their own scheme for the bundled app itself:
    // `tauri://localhost` on iOS, `http://tauri.localhost` on Android.
    if origin == "tauri://localhost" {
        return true;
    }

    let Some(rest) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };

    // Split host from port, keeping bracketed IPv6 literals intact.
    let host = if let Some(end) = rest.strip_prefix('[').and_then(|r| r.find(']')) {
        &rest[1..=end]
    } else {
        rest.split(':').next().unwrap_or(rest)
    };

    matches!(host, "localhost" | "127.0.0.1" | "::1" | "tauri.localhost")
}

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            origin.to_str().map(origin_is_allowed).unwrap_or(false)
        }))
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
}

pub fn create_router(state: WebServerState) -> Router {
    let dist_dir = resolve_dist_dir();
    let static_site = ServeDir::new(dist_dir.clone())
        .not_found_service(ServeFile::new(dist_dir.join("index.html")));

    let protected = Router::new()
        .route("/ws", get(ws_handler))
        .route("/api/events", get(sse_handler))
        .route("/api/codex/mcp/oauth/login", post(api_mcp_server_oauth_login))
        .route("/api/codex/mcp/status/list", post(api_list_mcp_server_status))
        .route("/api/codex/thread/start", post(api_start_thread))
        .route("/api/codex/start-thread", post(api_start_thread))
        .route("/api/codex/thread/resume", post(api_resume_thread))
        .route("/api/codex/thread/fork", post(api_fork_thread))
        .route("/api/codex/thread/rollback", post(api_rollback_thread))
        .route("/api/codex/thread/list", post(api_list_threads))
        .route("/api/codex/thread/archive", post(api_archive_thread))
        .route("/api/codex/thread/unarchive", post(api_unarchive_thread))
        .route("/api/codex/thread/delete", post(api_delete_thread))
        .route("/api/codex/thread/rename", post(api_rename_thread))
        .route("/api/codex/thread/goal/set", post(api_thread_goal_set))
        .route("/api/codex/thread/goal/get", post(api_thread_goal_get))
        .route("/api/codex/thread/goal/clear", post(api_thread_goal_clear))
        .route(
            "/api/codex/thread/compact/start",
            post(api_thread_compact_start),
        )
        .route(
            "/api/codex/thread/memory-mode/set",
            post(api_thread_memory_mode_set),
        )
        .route("/api/codex/memory/reset", post(api_memory_reset))
        .route("/api/codex/hooks/list", post(api_hooks_list))
        .route("/api/codex/plugin/list", post(api_plugin_list))
        .route("/api/codex/plugin/read", post(api_plugin_read))
        .route("/api/codex/plugin/install", post(api_plugin_install))
        .route("/api/codex/plugin/uninstall", post(api_plugin_uninstall))
        .route("/api/codex/plugin/installed", post(api_plugin_installed))
        .route(
            "/api/codex/external-agent-config/detect",
            post(api_external_agent_config_detect),
        )
        .route(
            "/api/codex/external-agent-config/import",
            post(api_external_agent_config_import),
        )
        .route(
            "/api/codex/external-agent-config/import/record-history",
            post(api_external_agent_config_import_record_history),
        )
        .route(
            "/api/codex/external-agent-config/import/read-histories",
            post(api_external_agent_config_import_read_histories),
        )
        .route("/api/codex/turn/start", post(api_turn_start))
        .route("/api/codex/turn/steer", post(api_turn_steer))
        .route("/api/codex/turn/interrupt", post(api_turn_interrupt))
        .route(
            "/api/codex/model/list",
            get(api_model_list).post(api_model_list_post),
        )
        .route("/api/codex/model/list-other", get(api_model_list_other))
        .route("/api/codex/provider/presets", get(api_list_provider_presets))
        .route("/api/codex/provider/add", post(api_add_model_provider))
        .route("/api/codex/provider/list", get(api_list_config_providers))
        .route("/api/codex/provider/remove", post(api_remove_model_provider))
        .route("/api/codex/load_env_keys", get(api_load_env_keys))
        .route("/api/codex/set_env", post(api_set_env))
        .route(
            "/api/codex/account/rate-limits",
            get(api_account_rate_limits),
        )
        .route("/api/codex/account/get", post(api_get_account))
        .route("/api/codex/account/login", post(api_login_account))
        .route(
            "/api/codex/account/snapshot/save",
            post(api_save_account_snapshot),
        )
        .route(
            "/api/codex/account/snapshot/list",
            get(api_list_account_snapshots),
        )
        .route(
            "/api/codex/account/snapshot/remove",
            post(api_remove_account_snapshot),
        )
        .route(
            "/api/codex/account/snapshot/switch",
            post(api_switch_account_snapshot),
        )
        .route("/api/codex/skills/list", post(api_skills_list))
        .route(
            "/api/codex/skills/config/write",
            post(api_skills_config_write),
        )
        .route(
            "/api/codex/approval/command-execution",
            post(api_respond_command_execution_approval),
        )
        .route(
            "/api/codex/approval/file-change",
            post(api_respond_file_change_approval),
        )
        .route(
            "/api/codex/approval/user-input",
            post(api_respond_user_input),
        )
        .route(
            "/api/codex/approval/mcp-elicitation",
            post(api_respond_mcp_elicitation),
        )
        .route(
            "/api/codex/approval/permissions",
            post(api_respond_permissions_approval),
        )
        .route("/api/codex/review/start", post(api_start_review))
        .route("/api/filesystem/read-directory", post(api_read_directory))
        .route("/api/openapp/check-app-installed", post(api_check_app_installed))
        .route("/api/openapp/open-workspace-in", post(api_open_workspace_in))
        .route("/api/filesystem/home-directory", get(api_get_home_directory))
        .route("/api/filesystem/canonicalize-path", post(api_canonicalize_path))
        .route("/api/filesystem/search-files", post(api_search_files))
        .route("/api/filesystem/search-files-by-name", post(api_search_files_by_name))
        .route("/api/filesystem/codex-home", get(api_codex_home))
        .route("/api/filesystem/asset", get(api_asset))
        .route("/api/filesystem/read-file", post(api_read_file))
        .route("/api/filesystem/read-text-file", post(api_read_text_file))
        .route("/api/filesystem/read-text-file-lines", post(api_read_text_file_lines))
        .route("/api/filesystem/write-file", post(api_write_file))
        .route("/api/filesystem/delete-file", post(api_delete_file))
        .route("/api/filesystem/watch", post(api_watch_directory))
        .route("/api/filesystem/unwatch", post(api_unwatch_directory))
        .route("/api/automation/list", post(api_list_automations))
        .route("/api/automation/runs/list", post(api_list_automation_runs))
        .route("/api/automation/create", post(api_create_automation))
        .route("/api/automation/update", post(api_update_automation))
        .route("/api/automation/set-paused", post(api_set_automation_paused))
        .route("/api/automation/delete", post(api_delete_automation))
        .route("/api/automation/run-now", post(api_run_automation_now))
        .route("/api/skills/list-marketplace", post(api_skills_list_marketplace))
        .route("/api/skills/list-installed", post(api_skills_list_installed))
        .route(
            "/api/skills/install-marketplace",
            post(api_skills_install_marketplace),
        )
        .route(
            "/api/skills/uninstall-installed",
            post(api_skills_uninstall_installed),
        )
        .route("/api/skills/clone-repo", post(api_skills_clone_repo))
        .route("/api/skills/list-central", post(api_skills_list_central))
        .route("/api/skills/link-to-agent", post(api_skills_link_to_agent))
        .route("/api/skills/delete-central", post(api_skills_delete_central))
        .route("/api/skillssh/leaderboard", post(api_skillssh_leaderboard))
        .route("/api/skillssh/search", post(api_skillssh_search))
        .route("/api/skillssh/install", post(api_skillssh_install))
        .route("/api/skills/groups/read", post(api_skill_groups_read))
        .route("/api/skills/groups/write", post(api_skill_groups_write))
        .route("/api/codex/mcp/read", post(api_unified_read_mcp_config))
        .route("/api/codex/mcp/add", post(api_unified_add_mcp_server))
        .route("/api/codex/mcp/remove", post(api_unified_remove_mcp_server))
        .route("/api/codex/mcp/enable", post(api_unified_enable_mcp_server))
        .route("/api/codex/mcp/disable", post(api_unified_disable_mcp_server))
        .route("/api/approvals/create", post(api_create_approval))
        .route("/api/approvals/pending", post(api_list_pending_approvals))
        .route("/api/approvals/consume", post(api_consume_approval))
        .route("/api/browser/health", post(api_browser_health))
        .route("/api/permissions/mode", post(api_permission_mode))
        .route("/api/system/check", post(api_system_check))
        .route("/api/system/repair", post(api_system_repair))
        .route("/api/zalo/connect", post(api_zalo_connect))
        .route("/api/zalo/disconnect", post(api_zalo_disconnect))
        .route("/api/zalo/status", post(api_zalo_status))
        .route("/api/zalo/approvers/list", post(api_zalo_list_approvers))
        .route("/api/zalo/send", post(api_zalo_send))
        // Called by bots' own agent processes, over loopback — see `bots_mcp`.
        .route("/api/insights/heatmaps", post(api_get_agent_heatmaps))
        .route("/api/insights/rankings", post(api_get_insight_rankings))
        .route("/api/insights/filter-options", post(api_get_insight_filter_options))
        .route("/api/sleep/prevent", post(api_prevent_sleep))
        .route("/api/sleep/allow", post(api_allow_sleep))
        .route("/api/settings", get(api_get_settings_file).post(api_save_settings_file))
        .route_layer(middleware::from_fn_with_state(
            state.device_token.clone(),
            require_device_token,
        ));

    Router::new()
        // Liveness probe stays open so a client can tell "desktop unreachable"
        // apart from "desktop rejected my token". It exposes no data.
        .route("/health", get(health_check))
        .merge(protected)
        // The SPA bundle carries no user data; the APIs behind it are what
        // require a token.
        .fallback_service(static_site)
        .layer(cors_layer())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::origin_is_allowed;
    use std::collections::HashMap;

    /// Axum panics at startup when the same path is registered twice, which in
    /// the desktop app means the loopback server silently never comes up. The
    /// table is long enough that a copy-paste duplicate is easy to miss, so
    /// catch it here instead.
    #[test]
    fn every_route_path_is_registered_once() {
        let source = include_str!("router.rs");
        let mut counts: HashMap<&str, usize> = HashMap::new();
        for chunk in source.split(".route(").skip(1) {
            let Some(rest) = chunk.split_once('"') else {
                continue;
            };
            let Some((path, _)) = rest.1.split_once('"') else {
                continue;
            };
            if path.starts_with('/') {
                *counts.entry(path).or_default() += 1;
            }
        }

        // The table itself must be non-trivial, or a parsing change would make
        // this test pass by finding nothing.
        assert!(counts.len() > 100, "found only {} routes", counts.len());

        let mut duplicates: Vec<&str> = counts
            .iter()
            .filter(|(_, count)| **count > 1)
            .map(|(path, _)| *path)
            .collect();
        duplicates.sort_unstable();
        assert_eq!(duplicates, Vec::<&str>::new());
    }

    #[test]
    fn local_ui_origins_are_allowed() {
        assert!(origin_is_allowed("http://localhost:7420"));
        assert!(origin_is_allowed("http://127.0.0.1:7420"));
        assert!(origin_is_allowed("http://localhost"));
        assert!(origin_is_allowed("http://[::1]:7420"));
    }

    #[test]
    fn remote_origins_are_rejected_because_the_server_is_local_only() {
        assert!(!origin_is_allowed("https://codexia-mac.tail1234.ts.net"));
        assert!(!origin_is_allowed("http://codexia-mac.tail1234.ts.net:7420"));
    }

    #[test]
    fn arbitrary_sites_are_rejected() {
        assert!(!origin_is_allowed("https://evil.example.com"));
        assert!(!origin_is_allowed("http://evil.example.com:7420"));
        // Suffix matching must not be fooled by a lookalike domain.
        assert!(!origin_is_allowed("https://evil-ts.net"));
        assert!(!origin_is_allowed("https://notts.net.evil.com"));
        assert!(!origin_is_allowed("file://"));
        assert!(!origin_is_allowed("null"));
    }
}
