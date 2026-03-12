use std::sync::Arc;

use anyhow::Result;
use log::{error, info, warn};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc::{self, UnboundedSender};
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// IPC message type
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcMessage {
    pub msg_type: String,
    pub payload: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Connected-clients registry (global, lazily initialised)
//
// Each client is represented by an UnboundedSender<Vec<u8>>.  A per-client
// writer task drains the channel and pushes bytes to the actual socket/pipe.
// This avoids storing `dyn AsyncWrite` trait objects (which are not
// object-safe due to generic methods on `AsyncWriteExt`).
// ---------------------------------------------------------------------------

type ClientList = Arc<Mutex<Vec<UnboundedSender<Vec<u8>>>>>;

static CLIENTS: OnceCell<ClientList> = OnceCell::new();

fn clients() -> &'static ClientList {
    CLIENTS.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

/// Serialise `msg` as JSON and send it to every connected IPC client.
/// Dead senders (disconnected clients) are pruned automatically.
pub async fn broadcast(msg: &IpcMessage) -> Result<()> {
    let mut payload = serde_json::to_vec(msg)?;
    payload.push(b'\n'); // newline framing

    let mut guard = clients().lock().await;
    guard.retain(|tx| tx.send(payload.clone()).is_ok());
    Ok(())
}

// ---------------------------------------------------------------------------
// Writer task helper
// ---------------------------------------------------------------------------

/// Spawn a task that reads from `rx` and writes each chunk to `writer`.
/// When the channel closes (all senders dropped) the task exits.
fn spawn_writer_task<W>(mut writer: W, mut rx: mpsc::UnboundedReceiver<Vec<u8>>)
where
    W: AsyncWriteExt + Send + Unpin + 'static,
{
    tokio::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            if writer.write_all(&chunk).await.is_err() {
                break;
            }
        }
    });
}

/// Register a new client writer: create a channel, spawn the writer task,
/// and store the sender in the global client list.
async fn register_writer<W>(writer: W)
where
    W: AsyncWriteExt + Send + Unpin + 'static,
{
    let (tx, rx) = mpsc::unbounded_channel::<Vec<u8>>();
    spawn_writer_task(writer, rx);
    clients().lock().await.push(tx);
}

// ---------------------------------------------------------------------------
// Inbound reader helper (shared logic for Unix / Windows)
// ---------------------------------------------------------------------------

async fn handle_reader<R>(mut reader: R, app: AppHandle)
where
    R: AsyncReadExt + Unpin,
{
    let mut buf = Vec::with_capacity(512);
    let mut tmp = [0u8; 256];

    loop {
        match reader.read(&mut tmp).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                buf.extend_from_slice(&tmp[..n]);
                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let line = buf.drain(..=pos).collect::<Vec<u8>>();
                    if let Ok(msg) =
                        serde_json::from_slice::<IpcMessage>(&line[..line.len() - 1])
                    {
                        dispatch_to_tauri(&app, &msg);
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Server (Unix socket — Linux / macOS)
// ---------------------------------------------------------------------------

#[cfg(unix)]
pub async fn start_ipc_server(app_handle: AppHandle) -> Result<()> {
    use tokio::net::UnixListener;

    const SOCKET_PATH: &str = "/tmp/littleguy.sock";

    let _ = tokio::fs::remove_file(SOCKET_PATH).await;
    let listener = UnixListener::bind(SOCKET_PATH)?;
    info!("IPC Unix socket listening at {SOCKET_PATH}");

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let (reader, writer) = tokio::io::split(stream);
                register_writer(writer).await;
                let app = app_handle.clone();
                tokio::spawn(handle_reader(reader, app));
            }
            Err(e) => error!("IPC accept error: {e}"),
        }
    }
}

// ---------------------------------------------------------------------------
// Server (Windows named pipe)
// ---------------------------------------------------------------------------

#[cfg(windows)]
pub async fn start_ipc_server(app_handle: AppHandle) -> Result<()> {
    use tokio::net::windows::named_pipe::ServerOptions;

    const PIPE_NAME: &str = r"\\.\pipe\littleguy";
    info!("IPC named pipe server at {PIPE_NAME}");

    loop {
        let server = ServerOptions::new()
            .first_pipe_instance(false)
            .create(PIPE_NAME)?;

        server.connect().await?;

        let (reader, writer) = tokio::io::split(server);
        register_writer(writer).await;
        let app = app_handle.clone();
        tokio::spawn(handle_reader(reader, app));
    }
}

// ---------------------------------------------------------------------------
// Stub for unsupported platforms
// ---------------------------------------------------------------------------

#[cfg(all(not(unix), not(windows)))]
pub async fn start_ipc_server(_app_handle: AppHandle) -> Result<()> {
    warn!("IPC bridge: no implementation for this platform");
    Ok(())
}

// ---------------------------------------------------------------------------
// Dispatch inbound IPC messages → Tauri events
// ---------------------------------------------------------------------------

fn dispatch_to_tauri(app: &AppHandle, msg: &IpcMessage) {
    match msg.msg_type.as_str() {
        "state-change" | "companion-config" | "walking-update" | "dialogue" | "buddy-nearby" => {
            app.emit(&msg.msg_type, &msg.payload).ok();
        }
        other => {
            warn!("IPC: unknown message type '{other}'");
        }
    }
}
