import { saveSetting, getSetting, listUsers } from '../db/indexeddb.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentTheme = await getSetting('theme');
  document.documentElement.setAttribute('data-theme', currentTheme || 'light');
  document.getElementById('themeSelect').value = currentTheme || 'light';
  document.getElementById('themeSelect').addEventListener('change', async (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    await saveSetting('theme', theme);
  });

  renderUsers();

  document.getElementById('applyIconBtn').addEventListener('click', async () => {
    const selected = document.querySelector('input[name="icon"]:checked').value;
    await saveSetting('iconPath', selected);
    chrome.runtime.sendMessage({ type: 'SET_ICON', iconPath: selected });
  });
});

async function renderUsers() {
  const container = document.getElementById('usersList');
  const users = await listUsers();
  container.innerHTML = '';
  if (!users.length) {
    container.textContent = 'No users yet. Login in the popup to create one.';
    return;
  }
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-pill';
    div.textContent = u.username;
    container.appendChild(div);
  });
}
