use anyhow::Result;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct WindowInfo {
    pub process_name: String,
    pub window_title: String,
}

impl Default for WindowInfo {
    fn default() -> Self {
        WindowInfo {
            process_name: String::new(),
            window_title: String::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// IDE / editor process names (50+ entries)
// ---------------------------------------------------------------------------

const IDE_PROCESSES: &[&str] = &[
    "code",
    "code-oss",
    "codium",
    "cursor",
    "vim",
    "nvim",
    "neovim",
    "emacs",
    "helix",
    "hx",
    "zed",
    "lapce",
    "atom",
    "sublime_text",
    "subl",
    "idea",
    "idea64",
    "webstorm",
    "webstorm64",
    "pycharm",
    "pycharm64",
    "clion",
    "clion64",
    "goland",
    "goland64",
    "rustrover",
    "rider",
    "datagrip",
    "phpstorm",
    "phpstorm64",
    "androidstudio",
    "studio",
    "fleet",
    "eclipse",
    "netbeans",
    "notepad++",
    "gedit",
    "kate",
    "kwrite",
    "nano",
    "micro",
    "lite",
    "lite-xl",
    "kakoune",
    "kak",
    "acme",
    "sam",
    "ed",
    "ox",
    "vis",
    "xi",
    "neovide",
    "gvim",
    "macvim",
    "textmate",
    "bbedit",
    "nova",
    "coderunner",
];

// ---------------------------------------------------------------------------
// Typing / productivity process names
// ---------------------------------------------------------------------------

const TYPING_PROCESSES: &[&str] = &[
    "notepad",
    "wordpad",
    "winword",
    "word",
    "soffice",
    "libreoffice",
    "lowriter",
    "pages",
    "slack",
    "discord",
    "teams",
    "zoom",
    "notion",
    "obsidian",
    "roam",
    "logseq",
    "typora",
    "marktext",
    "ghostwriter",
    "zettlr",
    "bear",
    "ulysses",
    "scrivener",
    "focuswriter",
    "writemonkey",
    "telegam",
    "telegram-desktop",
    "signal",
    "whatsapp",
    "element",
    "fractal",
    "thunderbird",
    "evolution",
    "mail",
    "outlook",
    "spark",
    "airmail",
    "mimestream",
    "superhuman",
    "hey",
    "todoist",
    "things",
    "omnifocus",
    "ticktick",
    "habitica",
    "trello",
    "asana",
    "linear",
    "jira",
    "confluence",
    "notion",
    "coda",
    "airtable",
    "craft",
    "anytype",
];

// ---------------------------------------------------------------------------
// Browser process names (for title-based classification)
// ---------------------------------------------------------------------------

const BROWSER_PROCESSES: &[&str] = &[
    "chrome",
    "google-chrome",
    "chromium",
    "firefox",
    "firefox-esr",
    "safari",
    "msedge",
    "edge",
    "opera",
    "brave",
    "brave-browser",
    "vivaldi",
    "arc",
    "waterfox",
    "librewolf",
    "tor browser",
    "min",
    "epiphany",
    "falkon",
    "qutebrowser",
    "surf",
];

// Coding-related keywords found in browser window titles
const CODING_TITLE_KEYWORDS: &[&str] = &[
    "github",
    "gitlab",
    "stackoverflow",
    "stack overflow",
    "crates.io",
    "docs.rs",
    "npmjs",
    "pypi",
    "pkg.go.dev",
    "developer.mozilla",
    "mdn",
    "cppreference",
    "rust-lang",
    "rustdoc",
    "codepen",
    "replit",
    "codesandbox",
    "jsfiddle",
    "leetcode",
    "hackerrank",
    "exercism",
    "advent of code",
    "regex101",
    "jq play",
    "playground",
    "devdocs",
    "api reference",
    "documentation",
];

const IDLE_THRESHOLD_SECS: u64 = 120;

// ---------------------------------------------------------------------------
// Platform: Windows
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub async fn get_active_window() -> WindowInfo {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0 == std::ptr::null_mut() {
            return WindowInfo::default();
        }

        // Window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf) as usize;
        let window_title = OsString::from_wide(&title_buf[..title_len])
            .to_string_lossy()
            .into_owned();

        // Process name
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        let process_name = if pid != 0 {
            let h_process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            match h_process {
                Ok(hp) => {
                    let mut name_buf = [0u16; 512];
                    let mut size = name_buf.len() as u32;
                    let result = QueryFullProcessImageNameW(
                        hp,
                        PROCESS_NAME_WIN32,
                        windows::core::PWSTR(name_buf.as_mut_ptr()),
                        &mut size,
                    );
                    let _ = windows::Win32::Foundation::CloseHandle(hp);
                    if result.is_ok() {
                        let full_path = OsString::from_wide(&name_buf[..size as usize])
                            .to_string_lossy()
                            .into_owned();
                        std::path::Path::new(&full_path)
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_lowercase())
                            .unwrap_or_default()
                            .into_owned()
                    } else {
                        String::new()
                    }
                }
                Err(_) => String::new(),
            }
        } else {
            String::new()
        };

        WindowInfo {
            process_name,
            window_title,
        }
    }
}

#[cfg(target_os = "windows")]
pub async fn get_idle_seconds() -> u64 {
    use windows::Win32::UI::WindowsAndMessaging::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut lii).as_bool() {
            let tick_count = windows::Win32::System::SystemInformation::GetTickCount();
            let idle_ms = tick_count.wrapping_sub(lii.dwTime);
            (idle_ms / 1000) as u64
        } else {
            0
        }
    }
}

// ---------------------------------------------------------------------------
// Platform: Linux
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
pub async fn get_active_window() -> WindowInfo {
    // Primary: xdotool (widely available on X11)
    if let Ok(output) = tokio::process::Command::new("xdotool")
        .args(["getactivewindow", "getwindowname", "getwindowpid"])
        .output()
        .await
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut lines = text.lines();
            let window_title = lines.next().unwrap_or("").to_string();
            let pid_str = lines.next().unwrap_or("0");
            let pid: u32 = pid_str.trim().parse().unwrap_or(0);

            let process_name = if pid > 0 {
                read_proc_name(pid).await.unwrap_or_default()
            } else {
                String::new()
            };

            return WindowInfo {
                process_name,
                window_title,
            };
        }
    }

    // Fallback: qdbus / wmctrl
    if let Ok(output) = tokio::process::Command::new("xprop")
        .args(["-root", "_NET_ACTIVE_WINDOW"])
        .output()
        .await
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            // parse window id and follow up — simplified fallback
            let _ = text;
        }
    }

    WindowInfo::default()
}

#[cfg(target_os = "linux")]
async fn read_proc_name(pid: u32) -> Result<String> {
    let comm_path = format!("/proc/{pid}/comm");
    let name = tokio::fs::read_to_string(&comm_path)
        .await
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    Ok(name)
}

#[cfg(target_os = "linux")]
pub async fn get_idle_seconds() -> u64 {
    // Try org.gnome.Mutter.IdleMonitor via DBus
    let idle = query_dbus_idle().await.unwrap_or(None);
    if let Some(ms) = idle {
        return ms / 1000;
    }

    // Fallback: xprintidle
    if let Ok(out) = tokio::process::Command::new("xprintidle").output().await {
        if out.status.success() {
            let ms: u64 = String::from_utf8_lossy(&out.stdout)
                .trim()
                .parse()
                .unwrap_or(0);
            return ms / 1000;
        }
    }

    0
}

#[cfg(target_os = "linux")]
async fn query_dbus_idle() -> Result<Option<u64>> {
    use zbus::Connection;

    let conn = Connection::session().await?;
    let proxy = zbus::Proxy::new(
        &conn,
        "org.gnome.Mutter.IdleMonitor",
        "/org/gnome/Mutter/IdleMonitor/Core",
        "org.gnome.Mutter.IdleMonitor",
    )
    .await?;

    let idle_time: u64 = proxy.call("GetIdletime", &()).await?;
    Ok(Some(idle_time))
}

// ---------------------------------------------------------------------------
// Platform: macOS
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub async fn get_active_window() -> WindowInfo {
    let script = r#"
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            try
                set winTitle to name of front window of frontApp
            on error
                set winTitle to ""
            end try
            return appName & "\n" & winTitle
        end tell
    "#;

    if let Ok(output) = tokio::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .await
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut parts = text.splitn(2, '\n');
            let process_name = parts
                .next()
                .unwrap_or("")
                .trim()
                .to_lowercase()
                .replace(' ', "");
            let window_title = parts.next().unwrap_or("").trim().to_string();
            return WindowInfo {
                process_name,
                window_title,
            };
        }
    }

    WindowInfo::default()
}

#[cfg(target_os = "macos")]
pub async fn get_idle_seconds() -> u64 {
    // ioreg-based HID idle time
    if let Ok(out) = tokio::process::Command::new("ioreg")
        .args(["-c", "IOHIDSystem"])
        .output()
        .await
    {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if line.contains("HIDIdleTime") {
                if let Some(val) = line.split('=').nth(1) {
                    let ns: u64 = val.trim().parse().unwrap_or(0);
                    return ns / 1_000_000_000;
                }
            }
        }
    }
    0
}

// ---------------------------------------------------------------------------
// Activity classification (platform-independent)
// ---------------------------------------------------------------------------

/// Classify user activity based on the active process and window title.
///
/// Returns one of: "idle", "sleeping", "coding", "typing", "active", "walking", "greeting"
pub fn classify_activity(
    process_name: &str,
    window_title: &str,
    idle_seconds: u64,
) -> &'static str {
    let proc = process_name.to_lowercase();
    let title = window_title.to_lowercase();

    if idle_seconds >= IDLE_THRESHOLD_SECS {
        return "sleeping";
    }

    if idle_seconds >= 30 {
        return "idle";
    }

    if is_ide_process(&proc) {
        return "coding";
    }

    // Browser with coding-related title
    if is_browser_process(&proc) {
        if CODING_TITLE_KEYWORDS
            .iter()
            .any(|kw| title.contains(kw))
        {
            return "coding";
        }
        // Reading / watching — treat as active
        return "active";
    }

    if is_typing_process(&proc) {
        return "typing";
    }

    if proc.is_empty() {
        return "idle";
    }

    "active"
}

fn is_ide_process(proc: &str) -> bool {
    IDE_PROCESSES.iter().any(|p| proc == *p || proc.starts_with(p))
}

fn is_browser_process(proc: &str) -> bool {
    BROWSER_PROCESSES
        .iter()
        .any(|p| proc == *p || proc.starts_with(p))
}

fn is_typing_process(proc: &str) -> bool {
    TYPING_PROCESSES
        .iter()
        .any(|p| proc == *p || proc.starts_with(p))
}
