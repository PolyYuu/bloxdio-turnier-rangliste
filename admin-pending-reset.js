(() => {
  'use strict';

  const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
  const BUTTON_SELECTOR = '[data-v3-delete-player]';
  let playersPromise = null;

  function apiClient() {
    return window.HubAPI?.client || null;
  }

  function toast(message, error = false) {
    if (window.HubV3?.toast) {
      window.HubV3.toast(message, error);
      return;
    }
    if (error) console.error(message);
    else console.log(message);
  }

  async function loadPlayers() {
    if (playersPromise) return playersPromise;
    playersPromise = (async () => {
      const client = apiClient();
      if (!client) return [];
      const {data, error} = await client.rpc('admin_get_account_players');
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    })().catch(error => {
      playersPromise = null;
      throw error;
    });
    return playersPromise;
  }

  function uuidFromElement(element) {
    let node = element;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      for (const attr of Array.from(node.attributes || [])) {
        const match = String(attr.value || '').match(UUID_RE);
        if (match) return match[0];
      }
    }
    return '';
  }

  async function resolvePlayer(deleteButton) {
    const directId = uuidFromElement(deleteButton);
    if (directId) return {id: directId, name: ''};

    const players = await loadPlayers();
    let node = deleteButton.parentElement;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const text = String(node.textContent || '').toLowerCase();
      const matches = players.filter(player => {
        const name = String(player.current_name || '').trim().toLowerCase();
        return name && text.includes(name);
      });
      if (matches.length === 1) return {id: matches[0].id, name: matches[0].current_name || ''};
    }
    return null;
  }

  async function setPending(button, deleteButton) {
    if (button.dataset.busy === '1') return;
    const client = apiClient();
    if (!client) {
      toast('Supabase ist noch nicht bereit. Bitte versuche es erneut.', true);
      return;
    }

    button.dataset.busy = '1';
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'WIRD ZURÜCKGESETZT …';

    try {
      const player = await resolvePlayer(deleteButton);
      if (!player?.id) throw new Error('Spieler-ID konnte nicht eindeutig ermittelt werden.');
      const shownName = player.name || 'diesen Spieler';
      const ok = window.confirm(`${shownName} wirklich wieder auf Pending setzen?\n\nDer HUB-Account bleibt bestehen. Spielerprofil, Stats, Rating und permanente Bloxd-ID werden nicht gelöscht.`);
      if (!ok) return;

      const {data, error} = await client.rpc('admin_set_player_pending', {p_global_player_id: player.id});
      if (error) throw error;
      if (!data?.ok) throw new Error('Pending-Reset wurde nicht bestätigt.');

      toast(`${data.current_name || shownName} wurde auf Pending gesetzt.`);
      setTimeout(() => location.reload(), 650);
    } catch (error) {
      console.error('[The HUB] Pending reset failed', error);
      toast(error?.message || 'Spieler konnte nicht auf Pending gesetzt werden.', true);
    } finally {
      button.dataset.busy = '0';
      button.disabled = false;
      button.textContent = original;
    }
  }

  function addPendingButton(deleteButton) {
    if (!deleteButton || deleteButton.dataset.pendingResetAttached === '1') return;
    deleteButton.dataset.pendingResetAttached = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${deleteButton.className || ''} v3-pending-reset-button`.trim();
    button.textContent = 'AUF PENDING SETZEN';
    button.title = 'HUB-Account behalten und Bloxd-Verifizierung erneut ausführen';
    button.style.setProperty('border-color', 'rgba(244,189,79,.45)');
    button.style.setProperty('color', '#f4bd4f');
    button.style.setProperty('background', 'rgba(244,189,79,.08)');
    deleteButton.insertAdjacentElement('beforebegin', button);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setPending(button, deleteButton);
    });
  }

  function scan() {
    document.querySelectorAll(BUTTON_SELECTOR).forEach(addPendingButton);
  }

  function boot() {
    scan();
    new MutationObserver(scan).observe(document.documentElement, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
