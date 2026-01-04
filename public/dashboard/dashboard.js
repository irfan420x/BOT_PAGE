/*
 * Dashboard script for FB Page Bot
 *
 * Fetches status information from the server and updates the dashboard.
 * Designed to handle missing or incomplete configuration gracefully.
 */

(function () {
  const botNameEl = document.getElementById('botName');
  const pageNameEl = document.getElementById('pageName');
  const pageIdEl = document.getElementById('pageId');
  const botStatusEl = document.getElementById('botStatus');
  const callbackUrlEl = document.getElementById('callbackUrl');
  const verifyTokenEl = document.getElementById('verifyToken');
  const missingListEl = document.getElementById('missingList');
  const copyBtn = document.getElementById('copyCallback');

  async function updateDashboard() {
    try {
      const res = await fetch('/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      // Page information
      if (data.page) {
        pageNameEl.textContent = data.page.name || '–';
        pageIdEl.textContent = data.page.id || '–';
      }
      // Bot status
      const status = data.status || 'unknown';
      botStatusEl.textContent = status;
      botStatusEl.classList.remove('ready', 'setup');
      if (status === 'READY') {
        botStatusEl.classList.add('ready');
      } else {
        botStatusEl.classList.add('setup');
      }
      // Callback URL and verify token
      callbackUrlEl.textContent = data.callbackUrl || '–';
      verifyTokenEl.textContent = data.verifyToken || '–';
      // Missing configuration keys
      missingListEl.innerHTML = '';
      const missing = data.missingConfig || [];
      if (missing.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'None';
        li.style.color = '#28a745';
        missingListEl.appendChild(li);
      } else {
        missing.forEach((key) => {
          const li = document.createElement('li');
          li.textContent = key;
          missingListEl.appendChild(li);
        });
      }
    } catch (err) {
      console.error('Dashboard update error:', err);
    }
  }

  // Copy callback URL to clipboard
  copyBtn.addEventListener('click', () => {
    const text = callbackUrlEl.textContent || '';
    if (!text || text === '–') return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy URL';
        }, 2000);
      })
      .catch((err) => {
        console.error('Clipboard copy failed:', err);
      });
  });

  // Initial load and periodic refresh
  updateDashboard();
  setInterval(updateDashboard, 5000);
})();