/*
 * Dashboard logic for the IRFAN Page Bot.
 *
 * This script fetches runtime information from the `/status` endpoint at a
 * regular interval and updates the DOM elements accordingly. It also adds
 * clipboard functionality to the webhook copy button. Errors are logged to
 * the console but do not disrupt the page.
 */

(function () {
  const pageNameEl = document.getElementById('pageName');
  const pageIdEl = document.getElementById('pageId');
  const statusEl = document.getElementById('status');
  const serverTimeEl = document.getElementById('serverTime');
  const nodeVersionEl = document.getElementById('nodeVersion');
  const modeEl = document.getElementById('mode');
  const webhookEl = document.getElementById('webhookUrl');
  const botNameEl = document.getElementById('botName');
  const copyBtn = document.getElementById('copyWebhook');
  const copyMsg = document.getElementById('copyMessage');

  // Additional elements for enhanced dashboard
  const botVersionEl = document.getElementById('botVersion');
  const uptimeEl = document.getElementById('uptime');
  const messagesProcessedEl = document.getElementById('messagesProcessed');
  const commentsProcessedEl = document.getElementById('commentsProcessed');
  const postbacksProcessedEl = document.getElementById('postbacksProcessed');
  const duplicatesBlockedEl = document.getElementById('duplicatesBlocked');
  const commandsCountEl = document.getElementById('commandsCount');
  const postbacksCountEl = document.getElementById('postbacksCount');
  const commentsCountEl = document.getElementById('commentsCount');
  const heapUsedEl = document.getElementById('heapUsed');
  const heapTotalEl = document.getElementById('heapTotal');
  const rssEl = document.getElementById('rss');

  function formatDuration(seconds) {
    const secs = Math.floor(seconds);
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(s)}`;
  }

  async function updateStatus() {
    try {
      const res = await fetch('/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      // Bot name and version
      if (data.botName) {
        botNameEl.textContent = data.botName;
      }
      // Page info
      const pageInfo = data.pageInfo || {};
      pageNameEl.textContent = pageInfo.name || 'N/A';
      pageIdEl.textContent = pageInfo.id || 'N/A';
      // Health status
      // Use health flag if available, otherwise derive from status field
      const isHealthy = data.health ? data.health === 'healthy' : data.status === 'online';
      statusEl.textContent = isHealthy ? 'online' : 'offline';
      statusEl.classList.remove('online', 'offline', 'degraded');
      if (isHealthy) {
        statusEl.classList.add('online');
      } else {
        statusEl.classList.add('offline');
      }
      // Server time
      // Prefer the serverTime field when present; otherwise fall back to now
      if (data.serverTime) {
        serverTimeEl.textContent = new Date(data.serverTime).toLocaleString();
      } else {
        serverTimeEl.textContent = new Date().toLocaleString();
      }
      // Node version
      nodeVersionEl.textContent = data.nodeVersion || '';
      // Mode
      modeEl.textContent = data.mode || '';
      // Bot version
      botVersionEl.textContent = data.botVersion || data.version || '';
      // Uptime (seconds to HH:MM:SS)
      uptimeEl.textContent = formatDuration(data.uptime || 0);
      // Activity metrics
      const metrics = data.metrics || {};
      messagesProcessedEl.textContent = metrics.messagesProcessed ?? '0';
      commentsProcessedEl.textContent = metrics.commentsProcessed ?? '0';
      postbacksProcessedEl.textContent = metrics.postbacksProcessed ?? '0';
      duplicatesBlockedEl.textContent = metrics.duplicatesBlocked ?? '0';
      // Plugin counts
      const plugins = data.plugins || {};
      commandsCountEl.textContent = plugins.commands ?? '0';
      postbacksCountEl.textContent = plugins.postbacks ?? '0';
      commentsCountEl.textContent = plugins.comments ?? '0';
      // System memory stats
      const memory = data.system?.process?.memory || {};
      heapUsedEl.textContent = memory.heapUsed !== undefined ? `${memory.heapUsed} MB` : '–';
      heapTotalEl.textContent = memory.heapTotal !== undefined ? `${memory.heapTotal} MB` : '–';
      rssEl.textContent = memory.rss !== undefined ? `${memory.rss} MB` : '–';
      // Webhook URL
      webhookEl.textContent = data.webhookUrl || '';
    } catch (error) {
      console.error('Dashboard update error:', error);
    }
  }

  // Copy webhook handler
  copyBtn.addEventListener('click', () => {
    const text = webhookEl.textContent || '';
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        copyMsg.textContent = 'Webhook URL copied to clipboard!';
        copyMsg.style.display = 'block';
        setTimeout(() => {
          copyMsg.style.display = 'none';
        }, 3000);
      })
      .catch(err => {
        console.error('Clipboard copy failed:', err);
      });
  });

  // Initial load and periodic refresh every 5 seconds
  updateStatus();
  setInterval(updateStatus, 5000);
})();