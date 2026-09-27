import { MITFLOWW_LOGO_SVG } from "./logo.js";

export function renderAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MitFloww - Operations Console</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <style>
    :root {
      --bg-base: #0a0e17;
      --bg-surface: #111726;
      --bg-card: #161f33;
      --bg-card-hover: #1c2740;
      --border-subtle: #232f48;
      --border-focus: #3b82f6;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-blue-hover: #2563eb;
      --accent-cyan: #06b6d4;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.12);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.12);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Header */
    header {
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 1.5rem;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .brand-logo-container {
      height: 28px;
      width: auto;
      max-width: 175px;
      display: flex;
      align-items: center;
    }

    .brand-logo-container svg {
      height: 100%;
      width: auto;
      max-height: 28px;
      display: block;
    }

    .login-logo-container {
      height: 38px;
      width: auto;
      max-width: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .login-logo-container svg {
      height: 100%;
      width: auto;
      max-height: 38px;
      display: block;
    }

    .brand-logo-container svg #icon1,
    .login-logo-container svg #icon1 {
      fill: #00c7ff !important;
    }

    .brand-logo-container svg #icon2,
    .login-logo-container svg #icon2 {
      fill: #005bdd !important;
    }

    .brand-logo-container svg #wordmark,
    .login-logo-container svg #wordmark {
      fill: #ffffff !important;
    }

    .brand-logo-link {
      display: flex;
      align-items: center;
      text-decoration: none;
      color: #ffffff;
      transition: opacity 0.2s ease;
    }

    .brand-logo-link:hover {
      opacity: 0.9;
    }

    .brand-tag {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
    }

    .brand-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
      background: rgba(255,255,255,0.05);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .badge-healthy {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-healthy .badge-dot { background: var(--success); box-shadow: 0 0 8px var(--success); }

    .badge-degraded, .badge-paused {
      background: var(--warning-bg);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .badge-degraded .badge-dot, .badge-paused .badge-dot { background: var(--warning); box-shadow: 0 0 8px var(--warning); }

    .badge-danger {
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .badge-danger .badge-dot { background: var(--danger); box-shadow: 0 0 8px var(--danger); }

    .badge-mode-dry {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .badge-mode-live {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    /* Tabs Navigation */
    .nav-tabs {
      display: flex;
      gap: 0.25rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 1.5rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.85rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background: rgba(255,255,255,0.02);
    }

    .tab-btn.active {
      color: var(--accent-blue);
      border-bottom-color: var(--accent-blue);
    }

    .tab-badge {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 10px;
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 1.5rem;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
    }

    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }

    /* Grid & Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .metric-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      transition: border-color 0.15s ease;
    }
    .metric-card:hover {
      border-color: var(--border-focus);
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .metric-value {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--font-mono);
      color: #fff;
    }

    .metric-subtext {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Panel Card */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .panel-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.01);
    }

    .panel-title {
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      font-size: 0.825rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      font-family: var(--font-sans);
    }

    .btn-sm {
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
    }

    .btn-primary {
      background: var(--accent-blue);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--accent-blue-hover);
    }

    .btn-secondary {
      background: var(--bg-card);
      border-color: var(--border-subtle);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      background: var(--bg-card-hover);
      border-color: var(--text-muted);
    }

    .btn-danger {
      background: var(--danger);
      color: #fff;
    }
    .btn-danger:hover {
      background: #dc2626;
    }

    .btn-warning {
      background: var(--warning);
      color: #000;
    }
    .btn-warning:hover {
      background: #d97706;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Filter Bar */
    .filter-bar {
      padding: 0.85rem 1.25rem;
      background: rgba(0,0,0,0.2);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .input-field, .select-field {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      padding: 0.4rem 0.7rem;
      border-radius: 6px;
      font-size: 0.825rem;
      font-family: inherit;
      outline: none;
    }
    .input-field:focus, .select-field:focus {
      border-color: var(--border-focus);
    }

    /* Tables */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.825rem;
    }

    th {
      background: rgba(0,0,0,0.25);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255,255,255,0.015);
      color: var(--text-primary);
    }

    .font-mono {
      font-family: var(--font-mono);
    }

    .clickable-row {
      cursor: pointer;
    }

    /* Status Pills */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.725rem;
      font-weight: 600;
      font-family: var(--font-mono);
      text-transform: uppercase;
    }

    .status-pill.success { background: var(--success-bg); color: var(--success); }
    .status-pill.failed { background: var(--danger-bg); color: var(--danger); }
    .status-pill.running { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); animation: pulse 2s infinite; }
    .status-pill.locked { background: var(--warning-bg); color: var(--warning); }
    .status-pill.cancelled { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
    .status-pill.idle { background: rgba(100, 116, 139, 0.15); color: #64748b; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* Pagination */
    .pagination-bar {
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* Modal / Drawer */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      padding: 1rem;
    }

    .modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-dialog {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      max-width: 650px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .modal-header {
      padding: 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 1.1rem;
      font-weight: 700;
    }

    .modal-body {
      padding: 1.25rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: rgba(0,0,0,0.2);
    }

    /* Detail Views inside Modal */
    .key-value-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 0.75rem;
      font-size: 0.825rem;
      margin-bottom: 1rem;
    }

    .key-name {
      color: var(--text-muted);
      font-weight: 600;
    }

    .key-value {
      color: var(--text-primary);
      word-break: break-all;
    }

    pre.code-block {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 250px;
    }

    /* Toast Container */
    #toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 200;
    }

    .toast {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.85rem;
      animation: slideIn 0.2s ease forwards;
    }
    .toast.success { border-left: 4px solid var(--success); }
    .toast.error { border-left: 4px solid var(--danger); }
    .toast.warn { border-left: 4px solid var(--warning); }

    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Login Screen */
    #login-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-base);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 500;
      padding: 1rem;
    }

    .login-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
    }
  
    /* Worker Admin Styles */
    .progress-bar-container {
      width: 100%;
      height: 6px;
      background: var(--bg-base);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 4px;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--accent-blue);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .progress-bar-fill.upload { background: var(--accent-cyan); }
    .progress-bar-fill.process { background: var(--accent-blue); }
    .progress-bar-fill.download { background: var(--success); }

    /* Service Badges */
    .badge-service {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      letter-spacing: 0.03em;
    }
    .badge-service-api { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-service-web { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-service-worker { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); }
    .badge-service-scheduler { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }

    /* SVG Chart */
    .svg-chart-container {
      display: flex;
      align-items: flex-end;
      gap: 1.5rem;
      height: 160px;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .svg-bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
    }
    .svg-bar {
      width: 100%;
      max-width: 48px;
      background: var(--accent-blue);
      border-radius: 4px 4px 0 0;
      transition: height 0.4s ease;
      min-height: 4px;
    }
    .svg-bar-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 0.4rem;
      text-align: center;
    }
    .svg-bar-value {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

</style>
</head>
<body>

  <!-- Login Modal / Overlay -->
  <div id="login-overlay" style="display: none;">
    <div class="login-box">
      <div style="text-align: center; margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
          <div class="login-logo-container">
            ${MITFLOWW_LOGO_SVG}
          </div>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle); padding: 3px 12px; border-radius: 20px;">
          <span style="color: #38bdf8; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Operations</span>
          <span>•</span>
          <span>Internal Console</span>
        </div>
      </div>
      <form id="login-form" onsubmit="handleLogin(event)">
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Administrative Access Key</label>
          <input type="password" id="login-key" class="input-field" style="width: 100%; padding: 0.6rem 0.8rem;" placeholder="Enter SCHEDULER_ADMIN_KEY..." required />
          <div style="margin-top: 0.45rem; font-size: 0.72rem; color: var(--text-muted); line-height: 1.4;">
            Configured in <code style="color: var(--accent); background: rgba(56,189,248,0.1); padding: 1px 4px; border-radius: 4px;">.env</code> as <code style="color: var(--accent); background: rgba(56,189,248,0.1); padding: 1px 4px; border-radius: 4px;">SCHEDULER_ADMIN_KEY</code> (default: <code style="color: var(--text-main); background: rgba(255,255,255,0.06); padding: 1px 4px; border-radius: 4px;">mitfloww-admin-secret</code>)
          </div>
        </div>
        <div id="login-error" style="color: var(--danger); font-size: 0.8rem; margin-bottom: 1rem; display: none;"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.65rem;">Authenticate & Enter</button>
      </form>
    </div>
  </div>

  <!-- Header -->
  <header>
    <div class="brand">
      <a href="/" class="brand-logo-link" title="MitFloww Operations">
        <div class="brand-logo-container">
          ${MITFLOWW_LOGO_SVG}
        </div>
      </a>
      <div style="display: flex; align-items: center; gap: 0.4rem;">
        <span class="brand-tag">Operations</span>
        <span class="brand-subtitle">v1.0.0</span>
      </div>
    </div>

    <div class="header-controls">
      <!-- Status Badge -->
      <div id="scheduler-status-badge" class="badge badge-healthy">
        <span class="badge-dot"></span>
        <span id="scheduler-status-text">HEALTHY</span>
      </div>

      <!-- Mode Badge -->
      <div id="mode-badge" class="badge badge-mode-dry">
        DRY RUN (ENFORCED)
      </div>

      <!-- Clear History & Reset -->
      <button class="btn btn-sm btn-secondary" onclick="openClearHistoryModal()" title="Reset and clear history logs without affecting running processes">
        🧹 Clear History
      </button>

      <!-- Pause/Resume Toggle -->
      <button id="pause-resume-btn" class="btn btn-sm btn-secondary" onclick="togglePauseResume()">
        Pause Scheduler
      </button>

      <!-- Auto-Refresh Select -->
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">Auto-Refresh:</span>
        <select id="refresh-interval-select" class="select-field" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onchange="updateRefreshInterval()">
          <option value="5000">5s</option>
          <option value="10000" selected>10s</option>
          <option value="30000">30s</option>
          <option value="0">Off</option>
        </select>
        <button class="btn btn-sm btn-secondary" onclick="refreshAllData()" title="Refresh now">🔄</button>
      </div>

      <!-- Logout -->
      <button class="btn btn-sm btn-secondary" onclick="handleLogout()">Logout</button>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <nav class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('dashboard')">
      📊 Dashboard
    </button>
    <button class="tab-btn" onclick="switchTab('jobs')">
      ⚙️ Jobs & Controls <span id="jobs-count-badge" class="tab-badge">7</span>
    </button>
    <button class="tab-btn" onclick="switchTab('history')">
      📜 Run History
    </button>
    <button class="tab-btn" onclick="switchTab('failures')">
      🚨 Failure Logs <span id="failures-count-badge" class="tab-badge" style="color: #ef4444;">0</span>
    </button>
    <button class="tab-btn" onclick="switchTab('worker')">
      ⚡ Worker Admin <span id="worker-active-badge" class="tab-badge" style="display:none;">0</span>
    </button>
    <button class="tab-btn" onclick="switchTab('logs')">
      📋 Operational Logs
    </button>
    <button class="tab-btn" onclick="switchTab('audit')">
      🛡️ Admin Audit Trail
    </button>
  </nav>

  <!-- Main Content Area -->
  <main>
    <!-- TAB 1: DASHBOARD -->
    <div id="tab-dashboard" class="tab-content active">
      <!-- Status Banner -->
      <div class="panel" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.8)); border-color: rgba(59, 130, 246, 0.2);">
        <div style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Core Infrastructure Status</div>
            <div style="display: flex; align-items: center; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.9rem;">
              <div>Database: <span id="dash-db-status" style="font-weight: 700; color: var(--success);">Connected</span></div>
              <div>Cloudflare R2: <span id="dash-r2-status" style="font-weight: 700; color: var(--success);">Connected</span></div>
              <div>Uptime: <span id="dash-uptime" class="font-mono" style="font-weight: 700; color: var(--text-primary);">0s</span></div>
              <div>Active In-Flight Jobs: <span id="dash-inflight" class="font-mono" style="font-weight: 700; color: var(--accent-cyan);">0</span></div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="switchTab('failures')">View Failure Logs</button>
            <button class="btn btn-primary btn-sm" onclick="switchTab('history')">View Run History</button>
          </div>
        </div>
      </div>

      <!-- Key Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Executions</div>
          <div id="m-total-runs" class="metric-value">0</div>
          <div class="metric-subtext">All time audit history</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Successful Runs</div>
          <div id="m-success-runs" class="metric-value" style="color: var(--success);">0</div>
          <div id="m-success-rate" class="metric-subtext">100% success rate</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Failed Runs</div>
          <div id="m-failed-runs" class="metric-value" style="color: var(--danger);">0</div>
          <div id="m-failed-sub" class="metric-subtext">0 terminal failures</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cancelled Runs</div>
          <div id="m-cancelled-runs" class="metric-value" style="color: var(--text-muted);">0</div>
          <div class="metric-subtext">Cooperative aborts</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Objects Deleted</div>
          <div id="m-deleted-records" class="metric-value" style="color: var(--accent-cyan);">0</div>
          <div class="metric-subtext">Purged from R2 & DB</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Records Processed</div>
          <div id="m-processed-records" class="metric-value">0</div>
          <div id="m-scanned-records" class="metric-subtext">0 scanned</div>
        </div>
      </div>

      <!-- Active Executions Panel -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span>⚡ Currently Running Executions</span>
            <span id="active-runs-pill" class="status-pill idle">0 Active</span>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Execution ID</th>
                <th>Triggered By</th>
                <th>Started At</th>
                <th>Elapsed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="active-executions-tbody">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No jobs currently running.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Quick Jobs Summary -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">⚙️ Registered Cleanup Jobs Overview</div>
          <button class="btn btn-sm btn-secondary" onclick="switchTab('jobs')">Manage All Jobs</button>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Last Duration</th>
                <th>Records Deleted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="dash-jobs-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: JOBS & CONTROLS -->
    <div id="tab-jobs" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Registered Scheduler Cleanup Jobs</div>
          <div class="panel-actions">
            <span style="font-size: 0.8rem; color: var(--text-muted);">All jobs use advisory locking and keyset pagination</span>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Description</th>
                <th>Interval</th>
                <th>Status</th>
                <th>Last Completed</th>
                <th>Consecutive Failures</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="jobs-full-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: RUN HISTORY -->
    <div id="tab-history" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Authoritative Job Execution History</div>
          <div class="panel-actions">
            <button class="btn btn-sm btn-secondary" onclick="loadHistory(0)">🔄 Refresh History</button>
          </div>
        </div>
        <!-- Filter Bar -->
        <div class="filter-bar">
          <input type="text" id="hist-filter-search" class="input-field" placeholder="Search execution ID / job..." onkeyup="handleHistFilterKey(event)" style="min-width: 220px;" />
          <select id="hist-filter-job" class="select-field" onchange="loadHistory(0)">
            <option value="all">All Jobs</option>
            <option value="expired-projects">expired-projects</option>
            <option value="revision-lifecycle">revision-lifecycle</option>
            <option value="stale-uploads">stale-uploads</option>
            <option value="orphaned-processed-files">orphaned-processed-files</option>
            <option value="soft-deleted-assets">soft-deleted-assets</option>
            <option value="deleted-users">deleted-users</option>
          </select>
          <select id="hist-filter-status" class="select-field" onchange="loadHistory(0)">
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="running">Running</option>
            <option value="locked">Locked</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="loadHistory(0)">Filter</button>
        </div>
        <!-- History Table -->
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Started Time</th>
                <th>Job Name</th>
                <th>Status</th>
                <th>Execution ID</th>
                <th>Scanned</th>
                <th>Eligible</th>
                <th>Processed</th>
                <th>Deleted</th>
                <th>Skipped</th>
                <th>Failed</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody id="history-tbody"></tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="pagination-bar">
          <div>Showing <span id="hist-count-range">0</span> of <span id="hist-total-count">0</span> executions</div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="hist-prev-btn" class="btn btn-sm btn-secondary" onclick="paginateHistory(-1)">Previous</button>
            <button id="hist-next-btn" class="btn btn-sm btn-secondary" onclick="paginateHistory(1)">Next</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: FAILURE LOGS -->
    <div id="tab-failures" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Persistent Failure & Error Logs</div>
          <div class="panel-actions">
            <button class="btn btn-sm btn-secondary" onclick="triggerTestFailure()">🧪 Test Ingestion</button>
            <button class="btn btn-sm btn-secondary" onclick="loadFailures(0)">🔄 Refresh</button>
          </div>
        </div>
        <!-- Filter Bar -->
        <div class="filter-bar">
          <input type="text" id="fail-filter-search" class="input-field" placeholder="Search error / execution ID..." onkeyup="handleFailFilterKey(event)" style="min-width: 220px;" />
          <select id="fail-filter-job" class="select-field" onchange="loadFailures(0)">
            <option value="all">All Jobs</option>
            <option value="expired-projects">expired-projects</option>
            <option value="revision-lifecycle">revision-lifecycle</option>
            <option value="stale-uploads">stale-uploads</option>
            <option value="orphaned-processed-files">orphaned-processed-files</option>
            <option value="soft-deleted-assets">soft-deleted-assets</option>
            <option value="deleted-users">deleted-users</option>
          </select>
          <select id="fail-filter-severity" class="select-field" onchange="loadFailures(0)">
            <option value="all">All Severities</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="fatal">Fatal</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="loadFailures(0)">Filter</button>
        </div>
        <!-- Table -->
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Job Name</th>
                <th>Severity</th>
                <th>Error Code</th>
                <th>Error Message</th>
                <th>Entity / Key</th>
                <th>Retryable</th>
                <th>Attempt</th>
              </tr>
            </thead>
            <tbody id="failures-tbody"></tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="pagination-bar">
          <div>Showing <span id="fail-count-range">0</span> of <span id="fail-total-count">0</span> failures</div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="fail-prev-btn" class="btn btn-sm btn-secondary" onclick="paginateFailures(-1)">Previous</button>
            <button id="fail-next-btn" class="btn btn-sm btn-secondary" onclick="paginateFailures(1)">Next</button>
          </div>
        </div>
      </div>
    </div>

    
    <!-- TAB: WORKER ADMIN -->
    <section id="tab-worker" class="tab-content" style="display: none;">
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.25rem 0;">⚡ Worker Processing & Queue Monitor</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Real-time BullMQ video, image, and document transcode queues with adaptive caching</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span id="worker-cache-indicator" class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.75rem;">Connecting...</span>
          <button class="btn btn-sm btn-secondary" onclick="fetchWorkerStatus(true)" title="Force fresh status bypass cache">🔄 Refresh</button>
        </div>
      </div>

      <!-- Queue Stats Cards -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 1.25rem;">
        <div class="stat-card">
          <div class="stat-label">Total Jobs</div>
          <div id="worker-stat-total" class="stat-value">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active / Processing</div>
          <div id="worker-stat-processing" class="stat-value" style="color: var(--accent-blue);">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Queued / Waiting</div>
          <div id="worker-stat-queued" class="stat-value" style="color: var(--warning);">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Completed</div>
          <div id="worker-stat-completed" class="stat-value" style="color: var(--success);">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Failed</div>
          <div id="worker-stat-failed" class="stat-value" style="color: var(--danger);">0</div>
        </div>
      </div>

      <!-- Queue Chart -->
      <div class="card" style="margin-bottom: 1.25rem; padding: 1.25rem;">
        <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem;">Queue Distribution</div>
        <div id="worker-chart-container" class="svg-chart-container">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Live / History Subtabs -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <div class="button-group">
          <button id="worker-subtab-live" class="btn btn-sm btn-primary" onclick="switchWorkerSubtab('live')">Live Jobs (<span id="worker-live-count">0</span>)</button>
          <button id="worker-subtab-history" class="btn btn-sm btn-secondary" onclick="switchWorkerSubtab('history')">History (<span id="worker-history-count">0</span>)</button>
        </div>
      </div>

      <!-- Worker Jobs Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Progress</th>
                <th>Queue Pos</th>
                <th>Duration</th>
                <th>Started</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="worker-jobs-table-body">
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading worker jobs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB: OPERATIONAL LOGS -->
    <section id="tab-logs" class="tab-content" style="display: none;">
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.25rem 0;">📋 Centralized Operational Logs</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Structured event and diagnostic log storage across API, Web, Worker, and Scheduler</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-sm btn-secondary" onclick="fetchLogs()" title="Refresh logs">🔄 Refresh</button>
        </div>
      </div>

      <!-- 24h Stats Ribbon -->
      <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1.25rem;">
        <div class="stat-card" style="cursor: pointer;" onclick="setLogServiceFilter('api')">
          <div class="stat-label">API Logs (24h)</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span id="log-stat-api-total" class="stat-value" style="font-size: 1.25rem;">0</span>
            <span id="log-stat-api-errors" class="badge badge-failed" style="font-size: 0.7rem;">0 errors</span>
          </div>
        </div>
        <div class="stat-card" style="cursor: pointer;" onclick="setLogServiceFilter('web')">
          <div class="stat-label">Web Logs (24h)</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span id="log-stat-web-total" class="stat-value" style="font-size: 1.25rem;">0</span>
            <span id="log-stat-web-errors" class="badge badge-failed" style="font-size: 0.7rem;">0 errors</span>
          </div>
        </div>
        <div class="stat-card" style="cursor: pointer;" onclick="setLogServiceFilter('worker')">
          <div class="stat-label">Worker Logs (24h)</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span id="log-stat-worker-total" class="stat-value" style="font-size: 1.25rem;">0</span>
            <span id="log-stat-worker-errors" class="badge badge-failed" style="font-size: 0.7rem;">0 errors</span>
          </div>
        </div>
        <div class="stat-card" style="cursor: pointer;" onclick="setLogServiceFilter('scheduler')">
          <div class="stat-label">Scheduler Logs (24h)</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span id="log-stat-scheduler-total" class="stat-value" style="font-size: 1.25rem;">0</span>
            <span id="log-stat-scheduler-errors" class="badge badge-failed" style="font-size: 0.7rem;">0 errors</span>
          </div>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="filter-bar" style="margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <!-- Service Filter -->
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn btn-sm log-svc-btn active" data-svc="all" onclick="setLogServiceFilter('all')">All</button>
          <button class="btn btn-sm log-svc-btn" data-svc="api" onclick="setLogServiceFilter('api')">API</button>
          <button class="btn btn-sm log-svc-btn" data-svc="web" onclick="setLogServiceFilter('web')">Web</button>
          <button class="btn btn-sm log-svc-btn" data-svc="worker" onclick="setLogServiceFilter('worker')">Worker</button>
          <button class="btn btn-sm log-svc-btn" data-svc="scheduler" onclick="setLogServiceFilter('scheduler')">Scheduler</button>
        </div>

        <!-- Level Filter -->
        <select id="logs-level-filter" class="select-field" style="width: 120px;" onchange="applyLogFilters()">
          <option value="all">All Levels</option>
          <option value="info">INFO</option>
          <option value="warn">WARN</option>
          <option value="error">ERROR</option>
          <option value="fatal">FATAL</option>
          <option value="debug">DEBUG</option>
        </select>

        <!-- Time Range -->
        <select id="logs-time-filter" class="select-field" style="width: 130px;" onchange="applyLogFilters()">
          <option value="all">All Time</option>
          <option value="15m">Last 15m</option>
          <option value="1h" selected>Last 1 hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
        </select>

        <!-- Search Input -->
        <div style="flex: 1; min-width: 220px;">
          <input id="logs-search-input" type="text" class="input-field" placeholder="Search message, event, request ID, error..." oninput="handleLogSearchInput(this.value)">
        </div>
      </div>

      <!-- Logs Table -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1rem;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 140px;">Timestamp</th>
                <th style="width: 90px;">Service</th>
                <th style="width: 80px;">Level</th>
                <th style="width: 140px;">Event</th>
                <th>Message</th>
                <th style="width: 130px;">Request ID</th>
                <th style="width: 80px;">Duration</th>
                <th style="width: 60px; text-align: center;">Detail</th>
              </tr>
            </thead>
            <tbody id="logs-table-body">
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading operational logs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Logs Pagination -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Showing <span id="logs-pagination-showing">0-0</span> of <span id="logs-pagination-total">0</span> logs
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="logs-prev-btn" class="btn btn-sm btn-secondary" onclick="prevLogsPage()" disabled>Previous</button>
          <button id="logs-next-btn" class="btn btn-sm btn-secondary" onclick="nextLogsPage()" disabled>Next</button>
        </div>
      </div>
    </section>

    <!-- TAB 5: ADMIN AUDIT TRAIL -->
    <div id="tab-audit" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Administrative Actions Audit Trail</div>
          <div class="panel-actions">
            <button class="btn btn-sm btn-secondary" onclick="openClearHistoryModal()">🧹 Clear History</button>
            <button class="btn btn-sm btn-secondary" onclick="loadAuditLogs(0)">🔄 Refresh</button>
          </div>
        </div>
        <!-- Filter Bar -->
        <div class="filter-bar">
          <input type="text" id="audit-filter-search" class="input-field" placeholder="Search action / actor / execution ID..." onkeyup="handleAuditFilterKey(event)" style="min-width: 240px;" />
          <select id="audit-filter-action" class="select-field" onchange="loadAuditLogs(0)">
            <option value="all">All Actions</option>
            <option value="run_job">run_job</option>
            <option value="cancel_job">cancel_job</option>
            <option value="pause_scheduler">pause_scheduler</option>
            <option value="resume_scheduler">resume_scheduler</option>
            <option value="clear_history">clear_history</option>
            <option value="admin_login">admin_login</option>
            <option value="test_failure">test_failure</option>
          </select>
          <select id="audit-filter-result" class="select-field" onchange="loadAuditLogs(0)">
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="locked">Locked</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="loadAuditLogs(0)">Filter</button>
        </div>
        <!-- Table -->
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target Job</th>
                <th>Execution ID</th>
                <th>Actor</th>
                <th>Result</th>
                <th>Metadata</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="audit-tbody"></tbody>
          </table>
        </div>
        <div class="pagination-bar">
          <div>Showing <span id="audit-count-range">0</span> of <span id="audit-total-count">0</span> records</div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="audit-prev-btn" class="btn btn-sm btn-secondary" onclick="paginateAudit(-1)">Previous</button>
            <button id="audit-next-btn" class="btn btn-sm btn-secondary" onclick="paginateAudit(1)">Next</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Generic Details Modal -->
  <div id="details-modal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 id="modal-title" class="modal-title">Execution Details</h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('details-modal')">✕</button>
      </div>
      <div id="modal-content" class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('details-modal')">Close</button>
      </div>
    </div>
  </div>

  <!-- Destructive Confirmation Modal -->
  <div id="confirm-modal" class="modal-overlay">
    <div class="modal-dialog" style="max-width: 480px;">
      <div class="modal-header">
        <h3 id="confirm-modal-title" class="modal-title">Confirm Action</h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('confirm-modal')">✕</button>
      </div>
      <div class="modal-body">
        <p id="confirm-modal-message" style="margin-bottom: 1rem; color: var(--text-primary);"></p>
        <div id="confirm-modal-warning" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; color: #fbbf24;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('confirm-modal')">Cancel</button>
        <button id="confirm-modal-btn" class="btn btn-primary" onclick="executeConfirmedAction()">Confirm</button>
      </div>
    </div>
  </div>

  <!-- Clear History Modal -->
  <div id="clear-history-modal" class="modal-overlay">
    <div class="modal-dialog" style="max-width: 520px;">
      <div class="modal-header">
        <h3 class="modal-title">🧹 Clear History & Reset Console</h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('clear-history-modal')">✕</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-primary); margin-bottom: 1rem; font-size: 0.875rem;">
          Reset historical execution runs, error logs, and audit records to start fresh.
        </p>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
          <div style="font-weight: 700; color: #10b981; margin-bottom: 0.25rem; font-size: 0.85rem;">🛡️ Safe Execution Guarantee</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
            Currently active processes (<strong>status: running</strong>) and recurring scheduled intervals will <strong>NOT</strong> be interrupted or cancelled. Only past historical records are deleted.
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.85rem;">
            <input type="checkbox" id="clear-opt-runs" checked style="accent-color: var(--accent-blue); width: 16px; height: 16px;" />
            <div>
              <div style="font-weight: 600; color: #fff;">Clear Job Run History</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Deletes past completed/failed run records from PostgreSQL (running jobs are preserved)</div>
            </div>
          </label>
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.85rem;">
            <input type="checkbox" id="clear-opt-failures" checked style="accent-color: var(--accent-blue); width: 16px; height: 16px;" />
            <div>
              <div style="font-weight: 600; color: #fff;">Clear Failure & Error Logs</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Deletes all historical error logs and resets failure counters</div>
            </div>
          </label>
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.85rem;">
            <input type="checkbox" id="clear-opt-audit" style="accent-color: var(--accent-blue); width: 16px; height: 16px;" />
            <div>
              <div style="font-weight: 600; color: #fff;">Clear Admin Audit Trail</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Deletes past admin logs and creates a new entry recording this reset</div>
            </div>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('clear-history-modal')">Cancel</button>
        <button class="btn btn-danger" onclick="executeClearHistory()">Reset & Clear History</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container"></div>

  <script>
    // State management
    let currentTab = 'dashboard';
    let refreshTimer = null;
    let isPausedState = false;
    let isDryRun = true;
    let pendingAction = null;

    let histOffset = 0;
    const histLimit = 20;
    let failOffset = 0;
    const failLimit = 20;
    let auditOffset = 0;
    const auditLimit = 20;

    // Toast helper
    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<span>' + (type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ') + '</span><span>' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    // Modal helpers
    function openModal(id) {
      document.getElementById(id).classList.add('active');
    }
    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    // Tab switching
    function switchTab(tabId) {
      currentTab = tabId;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');

      const targetContent = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.add('active');

      if (tabId === 'dashboard') loadDashboard();
      if (tabId === 'jobs') loadJobs();
      if (tabId === 'history') loadHistory(histOffset);
      if (tabId === 'failures') loadFailures(failOffset);
      if (tabId === 'worker') fetchWorkerStatus();
      if (tabId === 'logs') { fetchLogStats(); fetchLogs(); }
      if (tabId === 'audit') loadAuditLogs(auditOffset);
    }

    // Authenticated API fetch
    async function apiFetch(url, options = {}) {
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          }
        });

        if (res.status === 401) {
          document.getElementById('login-overlay').style.display = 'flex';
          throw new Error('Unauthorized');
        }

        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch (err) {
        if (err.message !== 'Unauthorized') {
          console.error('API Error:', err);
        }
        return { ok: false, status: 500, data: { error: err.message } };
      }
    }

    // Auth handlers
    async function checkAuth() {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          document.getElementById('login-overlay').style.display = 'none';
          isDryRun = data.dryRun;
          updateModeBadge();
          refreshAllData();
          return true;
        }
      }
      document.getElementById('login-overlay').style.display = 'flex';
      return false;
    }

    async function handleLogin(e) {
      e.preventDefault();
      const key = document.getElementById('login-key').value;
      const errorEl = document.getElementById('login-error');
      errorEl.style.display = 'none';

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('login-overlay').style.display = 'none';
        showToast('Authenticated successfully');
        refreshAllData();
      } else {
        errorEl.textContent = data.error || 'Authentication failed.';
        errorEl.style.display = 'block';
      }
    }

    async function handleLogout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      document.getElementById('login-overlay').style.display = 'flex';
      showToast('Logged out', 'info');
    }

    function updateModeBadge() {
      const badge = document.getElementById('mode-badge');
      if (isDryRun) {
        badge.className = 'badge badge-mode-dry';
        badge.textContent = 'DRY RUN (ENFORCED)';
      } else {
        badge.className = 'badge badge-mode-live';
        badge.textContent = 'DESTRUCTIVE MODE';
      }
    }

    // Data Loaders
    async function loadDashboard() {
      const res = await apiFetch('/api/scheduler/status');
      if (!res.ok) return;

      const data = res.data;
      isPausedState = Boolean(data.scheduler?.isPaused);
      isDryRun = Boolean(data.dryRun);
      updateModeBadge();

      // Status Badge
      const statusBadge = document.getElementById('scheduler-status-badge');
      const statusText = document.getElementById('scheduler-status-text');
      const pauseBtn = document.getElementById('pause-resume-btn');

      if (data.status === 'running') {
        statusBadge.className = 'badge badge-healthy';
        statusText.textContent = 'RUNNING';
        pauseBtn.textContent = 'Pause Scheduler';
        pauseBtn.className = 'btn btn-sm btn-secondary';
      } else if (data.status === 'paused') {
        statusBadge.className = 'badge badge-paused';
        statusText.textContent = 'PAUSED';
        pauseBtn.textContent = 'Resume Scheduler';
        pauseBtn.className = 'btn btn-sm btn-warning';
      } else {
        statusBadge.className = 'badge badge-degraded';
        statusText.textContent = data.status.toUpperCase();
      }

      // Infrastructure status
      const dbEl = document.getElementById('dash-db-status');
      dbEl.textContent = data.database === 'connected' ? 'Connected' : 'Disconnected';
      dbEl.style.color = data.database === 'connected' ? 'var(--success)' : 'var(--danger)';

      const r2El = document.getElementById('dash-r2-status');
      r2El.textContent = data.storage === 'connected' ? 'Connected' : 'Disconnected';
      r2El.style.color = data.storage === 'connected' ? 'var(--success)' : 'var(--danger)';

      document.getElementById('dash-uptime').textContent = formatDuration(data.uptimeSeconds * 1000);
      document.getElementById('dash-inflight').textContent = data.activeExecutions?.length || 0;

      // Metrics
      const m = data.metrics?.summary || {};
      document.getElementById('m-total-runs').textContent = (m.totalExecutions || 0).toLocaleString();
      document.getElementById('m-success-runs').textContent = (m.successExecutions || 0).toLocaleString();
      document.getElementById('m-failed-runs').textContent = (m.failedExecutions || 0).toLocaleString();
      document.getElementById('m-cancelled-runs').textContent = (m.cancelledExecutions || 0).toLocaleString();
      document.getElementById('m-deleted-records').textContent = (m.totalDeleted || 0).toLocaleString();
      document.getElementById('m-processed-records').textContent = (m.totalProcessed || 0).toLocaleString();
      document.getElementById('m-scanned-records').textContent = (m.totalScanned || 0).toLocaleString() + ' scanned';

      if (m.totalExecutions > 0) {
        const rate = Math.round(((m.successExecutions || 0) / m.totalExecutions) * 100);
        document.getElementById('m-success-rate').textContent = rate + '% success rate';
      }

      // Failure count badge in tab
      const failCount = data.metrics?.failures?.totalFailures || 0;
      document.getElementById('failures-count-badge').textContent = failCount;

      // Active Executions Table
      renderActiveExecutions(data.activeExecutions || []);

      // Dash Jobs Table
      loadDashJobs();
    }

    function renderActiveExecutions(activeList) {
      const tbody = document.getElementById('active-executions-tbody');
      const pill = document.getElementById('active-runs-pill');
      pill.textContent = activeList.length + ' Active';
      pill.className = activeList.length > 0 ? 'status-pill running' : 'status-pill idle';

      if (activeList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No jobs currently executing.</td></tr>';
        return;
      }

      tbody.innerHTML = activeList.map(item => \`
        <tr>
          <td style="font-weight: 700; color: #fff;">\${escapeHtml(item.jobName)}</td>
          <td class="font-mono">\${escapeHtml(item.executionId.substring(0, 8))}...</td>
          <td>\${escapeHtml(item.triggeredBy)}</td>
          <td>\${new Date(item.startedAt).toLocaleTimeString()}</td>
          <td class="font-mono" style="color: var(--accent-cyan);">\${Math.round(item.elapsedMs / 1000)}s</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="confirmCancelJob('\${item.executionId}', '\${item.jobName}')">
              Cancel Execution
            </button>
          </td>
        </tr>
      \`).join('');
    }

    async function loadDashJobs() {
      const res = await apiFetch('/api/jobs');
      if (!res.ok) return;

      const jobs = res.data.jobs || [];
      document.getElementById('jobs-count-badge').textContent = jobs.length;

      const tbody = document.getElementById('dash-jobs-tbody');
      tbody.innerHTML = jobs.map(j => \`
        <tr>
          <td style="font-weight: 700; color: #fff;">\${escapeHtml(j.name)}</td>
          <td class="font-mono" style="color: var(--text-muted);">\${formatDuration(j.intervalMs)}</td>
          <td><span class="status-pill \${j.status}">\${j.status}</span></td>
          <td>\${j.lastCompletedAt ? new Date(j.lastCompletedAt).toLocaleTimeString() : 'Never'}</td>
          <td class="font-mono">\${j.lastDurationMs !== null ? j.lastDurationMs + 'ms' : '-'}</td>
          <td class="font-mono" style="color: var(--accent-cyan); font-weight: 700;">\${j.lastResult?.deleted ?? 0}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="confirmRunJob('\${j.name}')" \${j.status === 'running' ? 'disabled' : ''}>
              Run Now
            </button>
          </td>
        </tr>
      \`).join('');
    }

    async function loadJobs() {
      const res = await apiFetch('/api/jobs');
      if (!res.ok) return;

      const jobs = res.data.jobs || [];
      const tbody = document.getElementById('jobs-full-tbody');
      tbody.innerHTML = jobs.map(j => \`
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff;">\${escapeHtml(j.name)}</div>
          </td>
          <td style="color: var(--text-secondary); max-width: 320px;">\${escapeHtml(j.description)}</td>
          <td class="font-mono" style="color: var(--accent-cyan);">\${formatDuration(j.intervalMs)}</td>
          <td><span class="status-pill \${j.status}">\${j.status}</span></td>
          <td>\${j.lastCompletedAt ? new Date(j.lastCompletedAt).toLocaleString() : 'Never'}</td>
          <td class="font-mono" style="color: \${j.consecutiveFailures > 0 ? 'var(--danger)' : 'var(--text-muted)'};">\${j.consecutiveFailures}</td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm btn-primary" onclick="confirmRunJob('\${j.name}')" \${j.status === 'running' ? 'disabled' : ''}>
                Run Now
              </button>
              \${j.status === 'running' && j.activeExecution ? \`
                <button class="btn btn-sm btn-danger" onclick="confirmCancelJob('\${j.activeExecution.executionId}', '\${j.name}')">
                  Cancel
                </button>
              \` : ''}
            </div>
          </td>
        </tr>
      \`).join('');
    }

    async function loadHistory(offset = 0) {
      histOffset = offset;
      const job = document.getElementById('hist-filter-job')?.value || 'all';
      const status = document.getElementById('hist-filter-status')?.value || 'all';
      const search = document.getElementById('hist-filter-search')?.value || '';

      const query = new URLSearchParams({
        limit: histLimit.toString(),
        offset: histOffset.toString(),
        ...(job !== 'all' ? { jobName: job } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await apiFetch('/api/runs?' + query.toString());
      if (!res.ok) return;

      const { items, total } = res.data;
      document.getElementById('hist-total-count').textContent = total;
      document.getElementById('hist-count-range').textContent = total === 0 ? '0' : \`\${histOffset + 1}-\${Math.min(histOffset + items.length, total)}\`;

      document.getElementById('hist-prev-btn').disabled = histOffset === 0;
      document.getElementById('hist-next-btn').disabled = histOffset + items.length >= total;

      const tbody = document.getElementById('history-tbody');
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No execution history matching filters.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(run => \`
        <tr class="clickable-row" onclick="viewRunDetail('\${run.executionId}')">
          <td class="font-mono">\${new Date(run.startedAt).toLocaleString()}</td>
          <td style="font-weight: 600; color: #fff;">\${escapeHtml(run.jobName)}</td>
          <td><span class="status-pill \${run.status}">\${run.status}</span></td>
          <td class="font-mono">\${run.executionId.substring(0, 8)}...</td>
          <td class="font-mono">\${run.recordsScanned}</td>
          <td class="font-mono">\${run.recordsEligible}</td>
          <td class="font-mono">\${run.recordsProcessed}</td>
          <td class="font-mono" style="color: var(--accent-cyan); font-weight: 700;">\${run.recordsDeleted}</td>
          <td class="font-mono">\${run.recordsSkipped}</td>
          <td class="font-mono" style="color: \${run.recordsFailed > 0 ? 'var(--danger)' : 'var(--text-muted)'};">\${run.recordsFailed}</td>
          <td class="font-mono">\${run.durationMs !== null ? run.durationMs + 'ms' : '-'}</td>
        </tr>
      \`).join('');
    }

    function paginateHistory(direction) {
      loadHistory(Math.max(0, histOffset + direction * histLimit));
    }

    function handleHistFilterKey(e) {
      if (e.key === 'Enter') loadHistory(0);
    }

    async function viewRunDetail(executionId) {
      const res = await apiFetch('/api/runs/' + executionId);
      if (!res.ok) return;

      const run = res.data.run;
      document.getElementById('modal-title').textContent = 'Execution Details: ' + run.jobName;

      document.getElementById('modal-content').innerHTML = \`
        <div class="key-value-grid">
          <div class="key-name">Execution ID:</div>
          <div class="key-value font-mono">\${run.executionId}</div>
          <div class="key-name">Job Name:</div>
          <div class="key-value" style="font-weight: 700;">\${run.jobName}</div>
          <div class="key-name">Status:</div>
          <div class="key-value"><span class="status-pill \${run.status}">\${run.status}</span></div>
          <div class="key-name">Started At:</div>
          <div class="key-value font-mono">\${new Date(run.startedAt).toLocaleString()}</div>
          <div class="key-name">Completed At:</div>
          <div class="key-value font-mono">\${run.completedAt ? new Date(run.completedAt).toLocaleString() : 'In-flight'}</div>
          <div class="key-name">Duration:</div>
          <div class="key-value font-mono">\${run.durationMs !== null ? run.durationMs + ' ms' : '-'}</div>
        </div>

        <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1.25rem 0 0.5rem 0; text-transform: uppercase; color: var(--text-muted);">Metrics Breakdown</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Scanned</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700;">\${run.recordsScanned}</div>
          </div>
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Eligible</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700;">\${run.recordsEligible}</div>
          </div>
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Processed</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700;">\${run.recordsProcessed}</div>
          </div>
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Deleted</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700; color: var(--accent-cyan);">\${run.recordsDeleted}</div>
          </div>
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Skipped</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700;">\${run.recordsSkipped}</div>
          </div>
          <div class="metric-card" style="padding: 0.75rem;">
            <div class="metric-label">Failed</div>
            <div class="font-mono" style="font-size: 1.2rem; font-weight: 700; color: \${run.recordsFailed > 0 ? 'var(--danger)' : 'inherit'};">\${run.recordsFailed}</div>
          </div>
        </div>

        \${run.errorMessage ? \`
          <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1rem 0 0.5rem 0; color: var(--danger);">Error Message</h4>
          <pre class="code-block" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">\${escapeHtml(run.errorMessage)}</pre>
        \` : ''}

        \${run.details ? \`
          <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1rem 0 0.5rem 0; text-transform: uppercase; color: var(--text-muted);">Details & Metadata</h4>
          <pre class="code-block">\${escapeHtml(run.details)}</pre>
        \` : ''}
      \`;

      openModal('details-modal');
    }

    // Failures loader
    async function loadFailures(offset = 0) {
      failOffset = offset;
      const job = document.getElementById('fail-filter-job')?.value || 'all';
      const severity = document.getElementById('fail-filter-severity')?.value || 'all';
      const search = document.getElementById('fail-filter-search')?.value || '';

      const query = new URLSearchParams({
        limit: failLimit.toString(),
        offset: failOffset.toString(),
        ...(job !== 'all' ? { jobName: job } : {}),
        ...(severity !== 'all' ? { severity } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await apiFetch('/api/failures?' + query.toString());
      if (!res.ok) return;

      const { items, total } = res.data;
      document.getElementById('fail-total-count').textContent = total;
      document.getElementById('fail-count-range').textContent = total === 0 ? '0' : \`\${failOffset + 1}-\${Math.min(failOffset + items.length, total)}\`;

      document.getElementById('fail-prev-btn').disabled = failOffset === 0;
      document.getElementById('fail-next-btn').disabled = failOffset + items.length >= total;

      const tbody = document.getElementById('failures-tbody');
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No failure records matching filters.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(f => \`
        <tr class="clickable-row" onclick="viewFailureDetail('\${f.id}')">
          <td class="font-mono">\${new Date(f.createdAt).toLocaleString()}</td>
          <td style="font-weight: 600; color: #fff;">\${escapeHtml(f.jobName)}</td>
          <td><span class="status-pill \${f.severity === 'fatal' ? 'failed' : f.severity === 'warn' ? 'locked' : 'failed'}">\${f.severity}</span></td>
          <td class="font-mono">\${escapeHtml(f.errorCode || '-')}</td>
          <td style="color: #f87171; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${escapeHtml(f.errorMessage)}</td>
          <td class="font-mono">\${escapeHtml(f.entityId || f.storageKey || '-')}</td>
          <td class="font-mono">\${f.retryable ? 'Yes' : 'No'}</td>
          <td class="font-mono">\${f.attempt}</td>
        </tr>
      \`).join('');
    }

    function paginateFailures(direction) {
      loadFailures(Math.max(0, failOffset + direction * failLimit));
    }

    function handleFailFilterKey(e) {
      if (e.key === 'Enter') loadFailures(0);
    }

    async function viewFailureDetail(id) {
      const res = await apiFetch('/api/failures/' + id);
      if (!res.ok) return;

      const f = res.data.failure;
      document.getElementById('modal-title').textContent = 'Failure Record Detail';

      document.getElementById('modal-content').innerHTML = \`
        <div class="key-value-grid">
          <div class="key-name">Failure ID:</div>
          <div class="key-value font-mono">\${f.id}</div>
          <div class="key-name">Execution ID:</div>
          <div class="key-value font-mono">\${f.executionId || '-'}</div>
          <div class="key-name">Job Name:</div>
          <div class="key-value" style="font-weight: 700;">\${f.jobName}</div>
          <div class="key-name">Severity:</div>
          <div class="key-value"><span class="status-pill failed">\${f.severity}</span></div>
          <div class="key-name">Error Code:</div>
          <div class="key-value font-mono">\${f.errorCode || '-'}</div>
          <div class="key-name">Operation:</div>
          <div class="key-value">\${f.operation || '-'}</div>
          <div class="key-name">Entity:</div>
          <div class="key-value font-mono">\${f.entityType ? f.entityType + ': ' + f.entityId : '-'}</div>
          <div class="key-name">Storage Target:</div>
          <div class="key-value font-mono">\${f.storageBucket ? f.storageBucket + ' / ' + (f.storageKey || '') : '-'}</div>
          <div class="key-name">Created At:</div>
          <div class="key-value font-mono">\${new Date(f.createdAt).toLocaleString()}</div>
        </div>

        <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1rem 0 0.5rem 0; color: var(--danger);">Error Message</h4>
        <pre class="code-block" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">\${escapeHtml(f.errorMessage)}</pre>

        \${f.stackTrace ? \`
          <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1rem 0 0.5rem 0; text-transform: uppercase; color: var(--text-muted);">Stack Trace</h4>
          <pre class="code-block" style="color: #94a3b8;">\${escapeHtml(f.stackTrace)}</pre>
        \` : ''}

        \${f.metadata ? \`
          <h4 style="font-size: 0.85rem; font-weight: 700; margin: 1rem 0 0.5rem 0; text-transform: uppercase; color: var(--text-muted);">Metadata</h4>
          <pre class="code-block">\${escapeHtml(f.metadata)}</pre>
        \` : ''}
      \`;

      openModal('details-modal');
    }

    async function triggerTestFailure() {
      const res = await apiFetch('/api/test/failure', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) {
        showToast('Controlled test failure log created');
        loadFailures(0);
      } else {
        showToast(res.data.error || 'Failed to trigger test', 'error');
      }
    }

    // Audit Logs loader
    async function loadAuditLogs(offset = 0) {
      auditOffset = offset;
      const action = document.getElementById('audit-filter-action')?.value || 'all';
      const result = document.getElementById('audit-filter-result')?.value || 'all';
      const search = document.getElementById('audit-filter-search')?.value || '';

      const query = new URLSearchParams({
        limit: auditLimit.toString(),
        offset: auditOffset.toString(),
        ...(action !== 'all' ? { action } : {}),
        ...(result !== 'all' ? { result } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await apiFetch('/api/audit-logs?' + query.toString());
      if (!res.ok) return;

      const { items, total } = res.data;
      document.getElementById('audit-total-count').textContent = total;
      document.getElementById('audit-count-range').textContent = total === 0 ? '0' : \`\${auditOffset + 1}-\${Math.min(auditOffset + items.length, total)}\`;

      document.getElementById('audit-prev-btn').disabled = auditOffset === 0;
      document.getElementById('audit-next-btn').disabled = auditOffset + items.length >= total;

      const tbody = document.getElementById('audit-tbody');
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No administrative audit records found matching filters.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(a => \`
        <tr class="clickable-row" onclick="viewAuditDetail('\${a.id}')" title="Click to view detailed audit breakdown">
          <td class="font-mono">\${new Date(a.createdAt).toLocaleString()}</td>
          <td style="font-weight: 700; color: #fff;"><span style="color: #38bdf8;">\${escapeHtml(a.action)}</span></td>
          <td>\${escapeHtml(a.jobName || '-')}</td>
          <td class="font-mono">\${a.executionId ? a.executionId.substring(0, 8) + '...' : '-'}</td>
          <td class="font-mono">\${escapeHtml(a.actor)}</td>
          <td><span class="status-pill \${a.result === 'success' ? 'success' : a.result === 'failed' ? 'failed' : 'locked'}">\${a.result}</span></td>
          <td class="font-mono" style="color: var(--text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${escapeHtml(a.metadata || '-')}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewAuditDetail('\${a.id}')">View</button>
          </td>
        </tr>
      \`).join('');
    }

    function paginateAudit(direction) {
      loadAuditLogs(Math.max(0, auditOffset + direction * auditLimit));
    }

    function handleAuditFilterKey(e) {
      if (e.key === 'Enter') loadAuditLogs(0);
    }

    async function viewAuditDetail(id) {
      const res = await apiFetch('/api/audit-logs/' + id);
      if (!res.ok) return;

      const a = res.data.audit;
      document.getElementById('modal-title').textContent = 'Admin Audit Record: ' + a.action;

      let formattedMetadata = a.metadata || '';
      try {
        if (a.metadata && (a.metadata.startsWith('{') || a.metadata.startsWith('['))) {
          formattedMetadata = JSON.stringify(JSON.parse(a.metadata), null, 2);
        }
      } catch {
        formattedMetadata = a.metadata;
      }

      document.getElementById('modal-content').innerHTML = \`
        <div class="key-value-grid">
          <div class="key-name">Audit ID:</div>
          <div class="key-value font-mono">\${a.id}</div>
          <div class="key-name">Action:</div>
          <div class="key-value" style="font-weight: 700; color: #38bdf8;">\${escapeHtml(a.action)}</div>
          <div class="key-name">Result Status:</div>
          <div class="key-value"><span class="status-pill \${a.result === 'success' ? 'success' : a.result === 'failed' ? 'failed' : 'locked'}">\${a.result}</span></div>
          <div class="key-name">Actor / Origin:</div>
          <div class="key-value font-mono">\${escapeHtml(a.actor)}</div>
          <div class="key-name">Target Job:</div>
          <div class="key-value">\${escapeHtml(a.jobName || 'None / System')}</div>
          <div class="key-name">Execution ID:</div>
          <div class="key-value font-mono">
            \${a.executionId ? \`
              <span>\${escapeHtml(a.executionId)}</span>
              <button class="btn btn-sm btn-secondary" style="margin-left: 0.5rem; padding: 2px 6px; font-size: 0.725rem;" onclick="viewRunDetail('\${a.executionId}')">
                🔍 View Run
              </button>
            \` : '-'}
          </div>
          <div class="key-name">Timestamp:</div>
          <div class="key-value font-mono">\${new Date(a.createdAt).toLocaleString()}</div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 0.5rem 0;">
          <h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin: 0;">Detailed Action Metadata</h4>
          \${formattedMetadata ? \`
            <button id="copy-audit-meta-btn" class="btn btn-sm btn-secondary" style="padding: 2px 8px; font-size: 0.72rem;">
              📋 Copy Metadata
            </button>
          \` : ''}
        </div>
        <pre id="audit-meta-pre" class="code-block" style="color: #38bdf8; max-height: 280px; overflow-y: auto;">\${formattedMetadata ? escapeHtml(formattedMetadata) : 'No extra metadata recorded for this action.'}</pre>

        \${a.executionId ? \`
          <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.8rem; color: var(--text-secondary);">Linked to job execution <code>\${a.executionId.substring(0, 8)}...</code></span>
            <button class="btn btn-sm btn-primary" onclick="viewRunDetail('\${a.executionId}')">Open Execution Record</button>
          </div>
        \` : ''}
      \`;

      const copyBtn = document.getElementById('copy-audit-meta-btn');
      if (copyBtn && formattedMetadata) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(formattedMetadata).then(() => showToast('Metadata copied to clipboard'));
        };
      }

      openModal('details-modal');
    }

    function openClearHistoryModal() {
      openModal('clear-history-modal');
    }

    async function executeClearHistory() {
      closeModal('clear-history-modal');
      const clearRuns = document.getElementById('clear-opt-runs')?.checked ?? true;
      const clearFailures = document.getElementById('clear-opt-failures')?.checked ?? true;
      const clearAudit = document.getElementById('clear-opt-audit')?.checked ?? false;

      const res = await apiFetch('/api/scheduler/clear-history', {
        method: 'POST',
        body: JSON.stringify({ clearRuns, clearFailures, clearAudit }),
      });

      if (res.ok) {
        const d = res.data;
        showToast(\`History reset successfully (\${d.deletedRuns || 0} runs, \${d.deletedFailures || 0} failures cleared). Running jobs preserved.\`);
        refreshAllData();
      } else {
        showToast(res.data.error || 'Failed to clear history', 'error');
      }
    }

    // Confirmation actions
    function confirmRunJob(jobName) {
      pendingAction = { type: 'run_job', jobName };
      document.getElementById('confirm-modal-title').textContent = 'Confirm Manual Run: ' + jobName;
      document.getElementById('confirm-modal-message').innerHTML = 'Are you sure you want to trigger <strong>' + escapeHtml(jobName) + '</strong> immediately?';
      document.getElementById('confirm-modal-warning').innerHTML = isDryRun
        ? '⚠️ <strong>DRY RUN MODE IS ACTIVE.</strong> No destructive modifications or deletions will occur.'
        : '🚨 <strong>DESTRUCTIVE MODE:</strong> This will execute permanent storage and database cleanup actions according to system retention rules.';
      
      const btn = document.getElementById('confirm-modal-btn');
      btn.textContent = 'Execute Job';
      btn.className = isDryRun ? 'btn btn-primary' : 'btn btn-danger';
      openModal('confirm-modal');
    }

    function confirmCancelJob(executionId, jobName) {
      pendingAction = { type: 'cancel_job', executionId, jobName };
      document.getElementById('confirm-modal-title').textContent = 'Confirm Job Cancellation';
      document.getElementById('confirm-modal-message').innerHTML = 'Are you sure you want to cooperatively cancel the active execution for <strong>' + escapeHtml(jobName) + '</strong> (' + executionId.substring(0, 8) + '...)?';
      document.getElementById('confirm-modal-warning').innerHTML = 'ℹ️ This triggers an AbortSignal. In-flight operations will exit at the next safe transaction boundary and release advisory locks cleanly.';
      
      const btn = document.getElementById('confirm-modal-btn');
      btn.textContent = 'Abort Execution';
      btn.className = 'btn btn-danger';
      openModal('confirm-modal');
    }

    function togglePauseResume() {
      if (isPausedState) {
        pendingAction = { type: 'resume_scheduler' };
        document.getElementById('confirm-modal-title').textContent = 'Resume Scheduler';
        document.getElementById('confirm-modal-message').textContent = 'Resume master scheduler loop and allow scheduled job ticks?';
        document.getElementById('confirm-modal-warning').textContent = 'Jobs will resume running on their normal scheduled intervals.';
        const btn = document.getElementById('confirm-modal-btn');
        btn.textContent = 'Resume Scheduler';
        btn.className = 'btn btn-primary';
        openModal('confirm-modal');
      } else {
        pendingAction = { type: 'pause_scheduler' };
        document.getElementById('confirm-modal-title').textContent = 'Pause Scheduler';
        document.getElementById('confirm-modal-message').textContent = 'Suspend all upcoming scheduled job runs?';
        document.getElementById('confirm-modal-warning').textContent = 'Currently running executions will finish cleanly, but no new ticks will be dispatched until resumed.';
        const btn = document.getElementById('confirm-modal-btn');
        btn.textContent = 'Pause Scheduler';
        btn.className = 'btn btn-warning';
        openModal('confirm-modal');
      }
    }

    async function executeConfirmedAction() {
      closeModal('confirm-modal');
      if (!pendingAction) return;

      if (pendingAction.type === 'run_job') {
        const res = await apiFetch('/api/jobs/' + pendingAction.jobName + '/run', { method: 'POST' });
        if (res.ok) {
          showToast(res.data.message || 'Job triggered successfully');
          refreshAllData();
        } else {
          showToast(res.data.error || 'Failed to run job', 'error');
        }
      } else if (pendingAction.type === 'cancel_job') {
        const res = await apiFetch('/api/runs/' + pendingAction.executionId + '/cancel', { method: 'POST' });
        if (res.ok) {
          showToast(res.data.message || 'Cancellation signal sent');
          refreshAllData();
        } else {
          showToast(res.data.error || 'Failed to cancel job', 'error');
        }
      } else if (pendingAction.type === 'pause_scheduler') {
        const res = await apiFetch('/api/scheduler/pause', { method: 'POST' });
        if (res.ok) {
          showToast('Scheduler paused');
          refreshAllData();
        }
      } else if (pendingAction.type === 'resume_scheduler') {
        const res = await apiFetch('/api/scheduler/resume', { method: 'POST' });
        if (res.ok) {
          showToast('Scheduler resumed');
          refreshAllData();
        }
      }

      pendingAction = null;
    }

    // Refresh orchestration
    function refreshAllData() {
      if (currentTab === 'dashboard') loadDashboard();
      if (currentTab === 'jobs') loadJobs();
      if (currentTab === 'history') loadHistory(histOffset);
      if (currentTab === 'failures') loadFailures(failOffset);
      if (currentTab === 'worker') fetchWorkerStatus();
      if (currentTab === 'logs') { fetchLogStats(); fetchLogs(); }
      if (currentTab === 'audit') loadAuditLogs(auditOffset);
    }

    function updateRefreshInterval() {
      if (refreshTimer) clearInterval(refreshTimer);
      const val = parseInt(document.getElementById('refresh-interval-select').value, 10);
      if (val > 0) {
        refreshTimer = setInterval(() => {
          refreshAllData();
        }, val);
      }
    }

    // Formatting utilities
    function formatDuration(ms) {
      if (!ms || ms < 0) return '0s';
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return sec + 's';
      const min = Math.floor(sec / 60);
      if (min < 60) return min + 'm ' + (sec % 60) + 's';
      const hr = Math.floor(min / 60);
      return hr + 'h ' + (min % 60) + 'm';
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Initial startup
    window.addEventListener('DOMContentLoaded', () => {
      checkAuth();
      updateRefreshInterval();
    });
  
    // ==========================================
    // WORKER ADMIN STATE & LOGIC
    // ==========================================
    let workerSubtab = 'live';
    let workerData = null;
    let workerPollTimer = null;

    function switchWorkerSubtab(subtab) {
      workerSubtab = subtab;
      document.getElementById('worker-subtab-live').className = subtab === 'live' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      document.getElementById('worker-subtab-history').className = subtab === 'history' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      renderWorkerJobs();
    }

    async function fetchWorkerStatus(force = false) {
      const indicator = document.getElementById('worker-cache-indicator');
      if (indicator) indicator.textContent = 'Updating...';

      const res = await apiFetch('/api/worker/status' + (force ? '?force=1' : ''));
      if (!res.ok) {
        if (indicator) {
          indicator.textContent = 'Worker Offline';
          indicator.style.color = 'var(--danger)';
        }
        return;
      }

      workerData = res.data;
      if (indicator) {
        if (workerData.workerError) {
          indicator.textContent = 'Worker Offline (Cached)';
          indicator.style.color = 'var(--warning)';
        } else {
          indicator.textContent = workerData.fromCache ? '⚡ Cached (4s)' : '🟢 Live';
          indicator.style.color = workerData.fromCache ? 'var(--accent-cyan)' : 'var(--success)';
        }
      }

      // Update stat cards
      const stats = workerData.stats || {};
      document.getElementById('worker-stat-total').textContent = stats.total || 0;
      document.getElementById('worker-stat-processing').textContent = stats.processing || 0;
      document.getElementById('worker-stat-queued').textContent = stats.queued || 0;
      document.getElementById('worker-stat-completed').textContent = stats.completed || 0;
      document.getElementById('worker-stat-failed').textContent = stats.failed || 0;

      // Update badge in tab
      const activeCount = (stats.processing || 0) + (stats.queued || 0);
      const activeBadge = document.getElementById('worker-active-badge');
      if (activeBadge) {
        if (activeCount > 0) {
          activeBadge.style.display = 'inline-block';
          activeBadge.textContent = activeCount;
        } else {
          activeBadge.style.display = 'none';
        }
      }

      document.getElementById('worker-live-count').textContent = (workerData.live || []).length;
      document.getElementById('worker-history-count').textContent = (workerData.history || []).length;

      renderWorkerChart(stats);
      renderWorkerJobs();
    }

    function renderWorkerChart(stats) {
      const container = document.getElementById('worker-chart-container');
      if (!container) return;

      const keys = ['queued', 'processing', 'completed', 'failed'];
      const maxVal = Math.max(1, ...keys.map(k => stats[k] || 0));

      const colors = {
        queued: 'var(--warning)',
        processing: 'var(--accent-blue)',
        completed: 'var(--success)',
        failed: 'var(--danger)',
      };

      container.innerHTML = keys.map(k => {
        const val = stats[k] || 0;
        const pct = Math.max(4, Math.round((val / maxVal) * 100));
        const color = colors[k] || 'var(--accent-blue)';
        return \`
          <div class="svg-bar-col">
            <div class="svg-bar-value">\${val}</div>
            <div class="svg-bar" style="height: \${pct}%; background: \${color};"></div>
            <div class="svg-bar-label">\${k.toUpperCase()}</div>
          </div>
        \`;
      }).join('');
    }

    function renderWorkerJobs() {
      const tbody = document.getElementById('worker-jobs-table-body');
      if (!tbody || !workerData) return;

      const list = workerSubtab === 'live' ? (workerData.live || []) : (workerData.history || []);
      if (list.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
              No \${workerSubtab} jobs currently recorded on the worker.
            </td>
          </tr>
        \`;
        return;
      }

      tbody.innerHTML = list.map(job => {
        const statusClass = job.state === 'completed' ? 'badge-success' : job.state === 'failed' ? 'badge-danger' : 'badge-healthy';
        const uploadPct = Math.min(100, Math.max(0, job.uploadProgress ?? 0));
        const processPct = Math.min(100, Math.max(0, job.processingProgress ?? job.progress ?? 0));
        const durationText = job.duration ? (job.duration / 1000).toFixed(1) + 's' : '-';
        const startedText = job.startedAt ? formatRelativeTime(new Date(job.startedAt)) : '-';

        return \`
          <tr>
            <td style="font-weight: 600; color: var(--text-primary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              \${escapeHtml(job.fileName || job.id)}
            </td>
            <td><span class="badge \${statusClass}">\${escapeHtml(job.state || 'active')}</span></td>
            <td><span style="font-size: 0.8rem; text-transform: capitalize; color: var(--text-secondary);">\${escapeHtml(job.stage || 'queued')}</span></td>
            <td style="min-width: 140px;">
              <div style="font-size: 0.72rem; display: flex; justify-content: space-between; color: var(--text-muted);">
                <span>Proc</span><span>\${processPct}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill process" style="width: \${processPct}%;"></div>
              </div>
            </td>
            <td style="font-family: var(--font-mono); font-size: 0.8rem;">\${job.queuePosition ?? '-'}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">\${durationText}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">\${startedText}</td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-sm btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;" onclick="openWorkerJobDetailModal('\${job.id}')">Details</button>
              \${job.state === 'failed' ? \`<button class="btn btn-sm btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 0.75rem; color: #34d399;" onclick="retryWorkerJob('\${job.id}')">Retry</button>\` : ''}
              \${job.state === 'active' || job.state === 'waiting' ? \`<button class="btn btn-sm btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 0.75rem; color: #ef4444;" onclick="cancelWorkerJob('\${job.id}')">Cancel</button>\` : ''}
            </td>
          </tr>
        \`;
      }).join('');
    }

    async function openWorkerJobDetailModal(jobId) {
      document.getElementById('worker-job-detail-modal').style.display = 'flex';
      const body = document.getElementById('worker-job-detail-body');
      body.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading job metadata & step timeline...</div>';

      const res = await apiFetch('/api/worker/job/' + jobId);
      if (!res.ok) {
        body.innerHTML = '<div class="banner banner-error">Failed to fetch job details from worker: ' + escapeHtml(res.data?.error || 'Unknown error') + '</div>';
        return;
      }

      const detail = res.data;
      const logs = detail.logs || [];
      const meta = detail.meta || {};

      body.innerHTML = \`
        <div class="key-value-grid">
          <div class="key-name">Job ID:</div>
          <div class="key-value font-mono">\${escapeHtml(jobId)}</div>
          <div class="key-name">File Type:</div>
          <div class="key-value">\${escapeHtml(meta.fileType || 'Unknown')}</div>
          <div class="key-name">Output Key:</div>
          <div class="key-value font-mono">\${escapeHtml(meta.outputKey || '-')}</div>
        </div>

        <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">Processing Timeline</div>
        <div style="border-left: 2px solid var(--border-subtle); padding-left: 1rem; margin-left: 0.5rem; margin-bottom: 1rem;">
          \${logs.length > 0 ? logs.map(l => \`
            <div style="margin-bottom: 0.5rem;">
              <span style="font-weight: 600; text-transform: capitalize; color: var(--accent-cyan); font-size: 0.8rem;">\${escapeHtml(l.stage)}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">\${typeof l.time === 'number' ? new Date(l.time).toLocaleTimeString() : l.time}</span>
            </div>
          \`).join('') : '<div style="color: var(--text-muted); font-size: 0.8rem;">No stage logs recorded.</div>'}
        </div>
      \`;
    }

    async function retryWorkerJob(jobId) {
      if (!confirm('Retry processing for job ' + jobId + '?')) return;
      const res = await apiFetch('/api/worker/retry/' + jobId, { method: 'POST' });
      if (res.ok) {
        showToast('Job queued for retry', 'success');
        fetchWorkerStatus(true);
      } else {
        showToast('Failed to retry: ' + (res.data?.error || 'Unknown error'), 'error');
      }
    }

    async function cancelWorkerJob(jobId) {
      if (!confirm('Cancel active processing for job ' + jobId + '?')) return;
      const res = await apiFetch('/api/worker/cancel/' + jobId, { method: 'POST' });
      if (res.ok) {
        showToast('Job cancelled successfully', 'success');
        fetchWorkerStatus(true);
      } else {
        showToast('Failed to cancel: ' + (res.data?.error || 'Unknown error'), 'error');
      }
    }

    // ==========================================
    // UNIFIED OPERATIONAL LOGS STATE & LOGIC
    // ==========================================
    let currentLogService = 'all';
    let currentLogLevel = 'all';
    let currentLogTime = '1h';
    let currentLogSearch = '';
    let currentLogOffset = 0;
    const currentLogLimit = 50;
    let currentLogSearchTimer = null;
    let selectedLogEntry = null;

    async function fetchLogStats() {
      const res = await apiFetch('/api/logs/stats');
      if (res.ok && res.data?.stats) {
        const s = res.data.stats;
        document.getElementById('log-stat-api-total').textContent = s.api?.total || 0;
        document.getElementById('log-stat-api-errors').textContent = (s.api?.errors || 0) + ' errors';
        document.getElementById('log-stat-web-total').textContent = s.web?.total || 0;
        document.getElementById('log-stat-web-errors').textContent = (s.web?.errors || 0) + ' errors';
        document.getElementById('log-stat-worker-total').textContent = s.worker?.total || 0;
        document.getElementById('log-stat-worker-errors').textContent = (s.worker?.errors || 0) + ' errors';
        document.getElementById('log-stat-scheduler-total').textContent = s.scheduler?.total || 0;
        document.getElementById('log-stat-scheduler-errors').textContent = (s.scheduler?.errors || 0) + ' errors';
      }
    }

    function setLogServiceFilter(svc) {
      currentLogService = svc;
      document.querySelectorAll('.log-svc-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-svc') === svc);
      });
      currentLogOffset = 0;
      fetchLogs();
    }

    function applyLogFilters() {
      currentLogLevel = document.getElementById('logs-level-filter').value;
      currentLogTime = document.getElementById('logs-time-filter').value;
      currentLogOffset = 0;
      fetchLogs();
    }

    function handleLogSearchInput(val) {
      currentLogSearch = val.trim();
      clearTimeout(currentLogSearchTimer);
      currentLogSearchTimer = setTimeout(() => {
        currentLogOffset = 0;
        fetchLogs();
      }, 350);
    }

    async function fetchLogs() {
      const tbody = document.getElementById('logs-table-body');
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading operational logs...</td></tr>';

      const params = new URLSearchParams();
      params.set('service', currentLogService);
      params.set('limit', currentLogLimit.toString());
      params.set('offset', currentLogOffset.toString());

      if (currentLogLevel !== 'all') params.set('level', currentLogLevel);
      if (currentLogSearch) params.set('search', currentLogSearch);

      if (currentLogTime !== 'all') {
        const now = Date.now();
        let fromMs = now - (60 * 60 * 1000); // 1h
        if (currentLogTime === '15m') fromMs = now - (15 * 60 * 1000);
        if (currentLogTime === '24h') fromMs = now - (24 * 60 * 60 * 1000);
        if (currentLogTime === '7d') fromMs = now - (7 * 24 * 60 * 60 * 1000);
        params.set('from', new Date(fromMs).toISOString());
      }

      const res = await apiFetch('/api/logs?' + params.toString());
      if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading logs: ' + escapeHtml(res.data?.error || 'Unknown error') + '</td></tr>';
        return;
      }

      const items = res.data.items || [];
      const total = res.data.total || 0;

      // Update pagination
      const start = total === 0 ? 0 : currentLogOffset + 1;
      const end = Math.min(currentLogOffset + items.length, total);
      document.getElementById('logs-pagination-showing').textContent = start + '-' + end;
      document.getElementById('logs-pagination-total').textContent = total;

      document.getElementById('logs-prev-btn').disabled = currentLogOffset <= 0;
      document.getElementById('logs-next-btn').disabled = currentLogOffset + currentLogLimit >= total;

      renderLogsTable(items);
    }

    function renderLogsTable(items) {
      const tbody = document.getElementById('logs-table-body');
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No matching log events found.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(log => {
        const serviceBadgeClass = 'badge-service-' + log.service;
        const levelBadgeClass = log.level === 'error' || log.level === 'fatal' ? 'badge-failed' : log.level === 'warn' ? 'badge-mode-dry' : 'badge-healthy';
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const durationStr = log.durationMs != null ? log.durationMs + 'ms' : '-';
        const reqId = log.requestId ? escapeHtml(log.requestId.slice(0, 14)) : '-';

        return \`
          <tr style="cursor: pointer;" onclick="openLogDetailModal('\${log.service}', \${log.id})">
            <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">
              \${timeStr}
            </td>
            <td><span class="badge-service \${serviceBadgeClass}">\${log.service}</span></td>
            <td><span class="badge \${levelBadgeClass}" style="font-size: 0.7rem;">\${log.level.toUpperCase()}</span></td>
            <td style="font-weight: 600; font-size: 0.8rem; color: var(--accent-cyan); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">
              \${escapeHtml(log.event)}
            </td>
            <td style="font-size: 0.8rem; color: var(--text-primary); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              \${escapeHtml(log.message)}
            </td>
            <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">\${reqId}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">\${durationStr}</td>
            <td style="text-align: center;">
              <button class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.35rem; font-size: 0.7rem;">🔍</button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function prevLogsPage() {
      if (currentLogOffset <= 0) return;
      currentLogOffset = Math.max(0, currentLogOffset - currentLogLimit);
      fetchLogs();
    }

    function nextLogsPage() {
      currentLogOffset += currentLogLimit;
      fetchLogs();
    }

    async function openLogDetailModal(service, id) {
      document.getElementById('log-detail-modal').style.display = 'flex';
      const body = document.getElementById('log-detail-body');
      body.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading full log payload...</div>';

      const res = await apiFetch('/api/logs/' + service + '/' + id);
      if (!res.ok) {
        body.innerHTML = '<div class="banner banner-error">Failed to fetch log detail: ' + escapeHtml(res.data?.error || 'Unknown') + '</div>';
        return;
      }

      selectedLogEntry = res.data.log;
      const log = selectedLogEntry;

      body.innerHTML = \`
        <div class="key-value-grid">
          <div class="key-name">Service:</div>
          <div class="key-value"><span class="badge-service badge-service-\${log.service}">\${log.service}</span></div>
          <div class="key-name">Timestamp:</div>
          <div class="key-value">\${new Date(log.timestamp).toISOString()}</div>
          <div class="key-name">Level:</div>
          <div class="key-value"><span class="badge badge-healthy">\${log.level.toUpperCase()}</span></div>
          <div class="key-name">Event:</div>
          <div class="key-value" style="color: var(--accent-cyan); font-weight: 600;">\${escapeHtml(log.event)}</div>
          <div class="key-name">Message:</div>
          <div class="key-value" style="font-weight: 600;">\${escapeHtml(log.message)}</div>
          \${log.request_id ? \`<div class="key-name">Request ID:</div><div class="key-value font-mono">\${escapeHtml(log.request_id)}</div>\` : ''}
          \${log.correlation_id ? \`<div class="key-name">Correlation ID:</div><div class="key-value font-mono">\${escapeHtml(log.correlation_id)}</div>\` : ''}
          \${log.user_id ? \`<div class="key-name">User ID:</div><div class="key-value font-mono">\${escapeHtml(log.user_id)}</div>\` : ''}
          \${log.method && log.path ? \`<div class="key-name">Route:</div><div class="key-value font-mono">\${escapeHtml(log.method)} \${escapeHtml(log.path)} [\${log.status_code || 200}]</div>\` : ''}
          \${log.duration_ms != null ? \`<div class="key-name">Duration:</div><div class="key-value">\${log.duration_ms}ms</div>\` : ''}
          \${log.component ? \`<div class="key-name">Component:</div><div class="key-value">\${escapeHtml(log.component)}</div>\` : ''}
          \${log.error_code ? \`<div class="key-name">Error Code:</div><div class="key-value" style="color: var(--danger);">\${escapeHtml(log.error_code)}</div>\` : ''}
          \${log.error_message ? \`<div class="key-name">Error Message:</div><div class="key-value" style="color: var(--danger);">\${escapeHtml(log.error_message)}</div>\` : ''}
        </div>

        \${log.stack_trace ? \`
          <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem; color: var(--danger);">Stack Trace</div>
          <pre class="code-block" style="color: #f87171; margin-bottom: 1rem;">\${escapeHtml(log.stack_trace)}</pre>
        \` : ''}

        \${log.metadata ? \`
          <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem;">Metadata</div>
          <pre class="code-block">\${escapeHtml(typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata, null, 2))}</pre>
        \` : ''}
      \`;
    }

    function copyLogJson() {
      if (!selectedLogEntry) return;
      navigator.clipboard.writeText(JSON.stringify(selectedLogEntry, null, 2))
        .then(() => showToast('Log JSON copied to clipboard', 'success'))
        .catch(() => showToast('Failed to copy JSON', 'error'));
    }

    // Adaptive Worker Polling (Pauses on blur/hidden, runs 8s when active)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(workerPollTimer);
        workerPollTimer = null;
      } else {
        if (currentTab === 'worker') {
          fetchWorkerStatus();
          workerPollTimer = setInterval(() => {
            if (currentTab === 'worker' && !document.hidden) fetchWorkerStatus();
          }, 8000);
        }
      }
    });

    setInterval(() => {
      if (currentTab === 'worker' && !document.hidden && !workerPollTimer) {
        workerPollTimer = setInterval(() => {
          if (currentTab === 'worker' && !document.hidden) fetchWorkerStatus();
        }, 8000);
      }
    }, 4000);

</script>
</body>
</html>`;
}
