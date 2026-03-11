'use strict';

/**
 * activity-monitor.js
 *
 * Polls the OS for the currently focused window / process and classifies
 * the user's activity into one of five states:
 *   idle | active | typing | coding | sleeping
 */

const { execFile } = require('child_process');
const os = require('os');
const util = require('util');

const execFileAsync = util.promisify(execFile);

// ─── Known process lists ───────────────────────────────────────────────────────

const IDE_PROCESSES = new Set([
  // VS Code family
  'code', 'code - insiders', 'codium', 'vscodium',
  // Cursor AI editor
  'cursor', 'cursor - insiders',
  // JetBrains IDEs
  'devenv',                                   // Visual Studio
  'idea64', 'idea',                           // IntelliJ IDEA
  'pycharm64', 'pycharm',
  'clion64', 'clion',
  'rider64', 'rider',
  'webstorm64', 'webstorm',
  'goland64', 'goland',
  'phpstorm64', 'phpstorm',
  'datagrip64', 'datagrip',
  'rubymine64', 'rubymine',
  'fleet',                                    // JetBrains Fleet
  // Classic editors
  'sublime_text', 'subl',
  'atom',
  'brackets',
  'notepad++', 'notepadplusplus',
  // Heavy IDEs
  'eclipse',
  'netbeans64', 'netbeans',
  'androidstudio', 'android studio', 'studio64',
  'xcode',
  // Terminal / vim
  'vim', 'nvim', 'gvim', 'macvim',
  'emacs', 'xemacs',
  'helix', 'hx',
  // Modern editors
  'zed', 'zed-editor',
  'lapce',
  'kate',
  'gedit', 'gnome-text-editor',
  // Windsurf / Codeium editor
  'windsurf',
  // Theia-based
  'theia',
]);

const TYPING_PROCESSES = new Set([
  // Windows note-taking
  'notepad', 'wordpad',
  // Microsoft Office
  'winword', 'word',           // Microsoft Word
  'excel', 'powerpnt', 'onenote',
  // Acrobat (forms)
  'acrord32', 'acrobat',
  // Email
  'outlook', 'thunderbird',
  // Messaging / calls
  'slack', 'discord', 'teams',
  'skype', 'zoom', 'webex',
  // Note-taking / knowledge bases
  'notion',
  'obsidian',
  'logseq',
  'typora',
  'bear',                      // macOS Bear app
  'craft',                     // macOS Craft
  'drafts',
  'ulysses',
  // macOS documents
  'pages', 'keynote', 'numbers',
  // Cross-platform writing
  'focuswriter',
  'libreoffice', 'soffice',    // LibreOffice Writer etc.
  // Markdown editors
  'marktext', 'ghostwriter',
  'apostrophe',
]);

const BROWSER_PROCESSES = new Set([
  'chrome', 'google chrome',
  'firefox',
  'msedge', 'microsoft edge',
  'opera', 'brave',
  'safari',
  'vivaldi',
  'iexplore',
  'chromium',
  'arc',         // Arc browser (macOS)
  'zen',         // Zen browser
]);

// Browser title fragments that suggest a coding context
const BROWSER_CODING_TITLES = [
  'github', 'gitlab', 'bitbucket',
  'codepen', 'jsfiddle', 'codesandbox',
  'replit', 'stackblitz', 'glitch.me',
  'regex101', 'leetcode', 'hackerrank',
  'codeforces', 'exercism', 'adventofcode',
];

// Title fragments that suggest a typing-heavy context inside a browser
const BROWSER_TYPING_TITLES = [
  'gmail', 'mail.google', 'mail -',
  'outlook', 'yahoo mail', 'protonmail', 'fastmail',
  'google docs', 'word online', 'docs.google',
  'notion', 'evernote', 'onenote',
  'confluence', 'jira', 'linear',
  'slack', 'discord', 'teams',
  'whatsapp', 'telegram', 'signal',
  'compose', 'new message', 'reply', 'forward',
  'chat.openai', 'claude.ai', 'gemini',
  'github.com/issues', 'github.com/pull',
];

// ─── Platform-specific window detection ───────────────────────────────────────

async function getWindowsActiveWindow() {
  // Use GetForegroundWindow Win32 API via inline C# to get the *focused* window,
  // not the process with the highest CPU (which was the previous, incorrect approach).
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
try {
  if (-not ([System.Management.Automation.PSTypeName]'LGFgWin').Type) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class LGFgWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
'@
  }
  $hwnd = [LGFgWin]::GetForegroundWindow()
  $procId = [uint32]0
  [LGFgWin]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
  $proc = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
  if ($proc -and $proc.MainWindowTitle -ne '') {
    Write-Output ($proc.Name + '|' + $proc.MainWindowTitle)
    exit
  }
  if ($proc) {
    Write-Output ($proc.Name + '|')
    exit
  }
} catch {}
$fallback = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } |
  Sort-Object CPU -Descending | Select-Object -First 1
if ($fallback) { Write-Output ($fallback.Name + '|' + $fallback.MainWindowTitle) } else { Write-Output '|' }
`.trim();

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps],
      { timeout: 5000, windowsHide: true }
    );
    const line = stdout.trim();
    const sep = line.indexOf('|');
    if (sep === -1) return { processName: '', windowTitle: '' };
    return {
      processName: line.slice(0, sep).toLowerCase().trim(),
      windowTitle: line.slice(sep + 1).trim(),
    };
  } catch (err) {
    console.warn('[activity-monitor] Windows window detection failed:', err.message);
    return { processName: '', windowTitle: '' };
  }
}

async function getLinuxActiveWindow() {
  try {
    const { stdout: id } = await execFileAsync('xdotool', ['getactivewindow'], { timeout: 2000 });
    const wid = id.trim();
    const [{ stdout: title }, { stdout: pid }] = await Promise.all([
      execFileAsync('xdotool', ['getwindowname', wid], { timeout: 2000 }),
      execFileAsync('xdotool', ['getwindowpid', wid], { timeout: 2000 }),
    ]);
    const { stdout: comm } = await execFileAsync(
      'cat', [`/proc/${pid.trim()}/comm`], { timeout: 1000 }
    );
    return {
      processName: comm.trim().toLowerCase(),
      windowTitle: title.trim(),
    };
  } catch {
    return { processName: '', windowTitle: '' };
  }
}

async function getMacActiveWindow() {
  const script = `
tell application "System Events"
  set fp to first application process whose frontmost is true
  set pName to name of fp
  set wTitle to ""
  try
    set wTitle to name of front window of fp
  end try
  return pName & "|" & wTitle
end tell
`.trim();
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 4000 });
    const line = stdout.trim();
    const sep = line.indexOf('|');
    if (sep === -1) return { processName: line.toLowerCase(), windowTitle: '' };
    return {
      processName: line.slice(0, sep).toLowerCase().trim(),
      windowTitle: line.slice(sep + 1).trim(),
    };
  } catch {
    return { processName: '', windowTitle: '' };
  }
}

/**
 * Returns the currently focused window's process name and title.
 * @returns {Promise<{processName: string, windowTitle: string}>}
 */
async function getActiveWindow() {
  switch (os.platform()) {
    case 'win32':  return getWindowsActiveWindow();
    case 'linux':  return getLinuxActiveWindow();
    case 'darwin': return getMacActiveWindow();
    default:       return { processName: '', windowTitle: '' };
  }
}

// ─── State classification ─────────────────────────────────────────────────────

/** Seconds of system idle time before the character enters the sleeping state. */
const IDLE_THRESHOLD_SECONDS = 120; // 2 minutes

/**
 * Maps process + window info + idle time to one of:
 *   'sleeping' | 'coding' | 'typing' | 'active' | 'idle'
 *
 * @param {string} processName
 * @param {string} windowTitle
 * @param {number} idleSeconds
 * @returns {string}
 */
function classifyActivity(processName, windowTitle, idleSeconds) {
  if (idleSeconds >= IDLE_THRESHOLD_SECONDS) return 'sleeping';

  const proc  = processName.replace(/\.exe$/i, '').toLowerCase().trim();
  const title = windowTitle.toLowerCase();

  if (IDE_PROCESSES.has(proc)) return 'coding';

  if (TYPING_PROCESSES.has(proc)) return 'typing';

  if (BROWSER_PROCESSES.has(proc)) {
    // Coding-related browser tabs take priority
    if (BROWSER_CODING_TITLES.some((t) => title.includes(t))) return 'coding';
    if (BROWSER_TYPING_TITLES.some((t) => title.includes(t))) return 'typing';
    return 'active';
  }

  if (proc) return 'active';

  return 'idle';
}

module.exports = { getActiveWindow, classifyActivity };
