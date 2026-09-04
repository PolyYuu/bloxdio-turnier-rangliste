window.HubAPI = (() => {
  const SUPABASE_URL = 'https://nxzrgbpaxukgjyzwupjp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  async function invoke(name, body, jwt) {
    const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, ...headers },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function persistSession(session) {
    if (!session) return;
    const { error } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw error;
  }

  async function signUp(username, password) {
    const data = await invoke('hub-signup', { username, password });
    await persistSession(data.session);
    return data;
  }

  async function login(username, password) {
    const data = await invoke('hub-login', { username, password });
    await persistSession(data.session);
    return data;
  }

  async function logout() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function currentSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function currentPlayerId() {
    const { data, error } = await client.rpc('my_global_player_id');
    if (error) throw error;
    return data;
  }

  async function changePassword(currentPassword, newPassword, repeatPassword) {
    const session = await currentSession();
    if (!session) throw new Error('Login required');
    return invoke('hub-change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_repeat: repeatPassword,
    }, session.access_token);
  }

  async function changeMyName(newName) {
    const { error } = await client.rpc('change_my_name', { p_new_name: newName });
    if (error) throw error;
  }

  async function setRankingExperience(enabled) {
    const { error } = await client.rpc('set_my_ranking_experience', { p_enabled: !!enabled });
    if (error) throw error;
  }

  async function saveAvatar(pixels) {
    const { error } = await client.rpc('save_my_avatar', { p_pixels: pixels });
    if (error) throw error;
  }

  async function acknowledgeAvatarReset() {
    const { error } = await client.rpc('acknowledge_avatar_reset');
    if (error) throw error;
  }

  async function getGlobalPlayers() {
    const { data, error } = await client.from('global_players').select('*').is('deleted_at', null).order('rating', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getCareerStats() {
    const { data, error } = await client.from('player_career_stats').select('*');
    if (error) throw error;
    return data || [];
  }

  async function getRatingHistory(playerId) {
    const { data, error } = await client.from('rating_history').select('*').eq('global_player_id', playerId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function sendFriendRequest(receiverId) {
    const { data, error } = await client.rpc('send_friend_request', { p_receiver: receiverId });
    if (error) throw error;
    return data;
  }

  async function respondFriendRequest(requestId, accept) {
    const { error } = await client.rpc('respond_friend_request', { p_request_id: requestId, p_accept: !!accept });
    if (error) throw error;
  }

  async function removeFriend(otherId) {
    const { error } = await client.rpc('remove_friend', { p_other: otherId });
    if (error) throw error;
  }

  async function createCupRegistration(tournamentId, invitedPlayerIds) {
    const { data, error } = await client.rpc('create_cup_registration', {
      p_tournament_id: tournamentId,
      p_invited_player_ids: invitedPlayerIds,
    });
    if (error) throw error;
    return data;
  }

  async function respondCupInvite(registrationId, accept) {
    const { error } = await client.rpc('respond_to_cup_invite', {
      p_registration_id: registrationId,
      p_accept: !!accept,
    });
    if (error) throw error;
  }

  async function cancelCupRegistration(registrationId) {
    const { error } = await client.rpc('cancel_my_cup_registration', { p_registration_id: registrationId });
    if (error) throw error;
  }

  async function finalizeRoundRating(tournamentId, round) {
    const { error } = await client.rpc('finalize_round_rating', { p_tournament_id: tournamentId, p_round: round });
    if (error) throw error;
  }

  async function recalculateRoundRating(tournamentId, round) {
    const { error } = await client.rpc('recalculate_round_rating', { p_tournament_id: tournamentId, p_round: round });
    if (error) throw error;
  }

  async function adminSetCupStatus(tournamentId, status) {
    const { error } = await client.rpc('admin_set_cup_status', { p_tournament_id: tournamentId, p_status: status });
    if (error) throw error;
  }

  async function adminRenamePlayer(playerId, name) {
    const { error } = await client.rpc('admin_rename_global_player', { p_player_id: playerId, p_new_name: name });
    if (error) throw error;
  }

  async function adminSetRating(playerId, rating) {
    const { error } = await client.rpc('admin_set_player_rating', { p_player_id: playerId, p_rating: rating });
    if (error) throw error;
  }

  async function adminSetStats(playerId, stats) {
    const { error } = await client.rpc('admin_set_player_stats', { p_player_id: playerId, p_stats: stats });
    if (error) throw error;
  }

  async function adminResetStats(playerId, resetRating = false) {
    const { error } = await client.rpc('admin_reset_player_stats', { p_player_id: playerId, p_reset_rating: resetRating });
    if (error) throw error;
  }

  async function adminResetAvatar(playerId) {
    const { error } = await client.rpc('admin_reset_avatar', { p_player_id: playerId });
    if (error) throw error;
  }

  async function adminSetAvatar(playerId, pixels) {
    const { error } = await client.rpc('admin_set_avatar', { p_player_id: playerId, p_pixels: pixels });
    if (error) throw error;
  }

  async function adminAccountAction(action, playerId, extra = {}) {
    const session = await currentSession();
    if (!session) throw new Error('Login required');
    return invoke('hub-admin-account', { action, player_id: playerId, ...extra }, session.access_token);
  }

  function subscribeToRatingEvents(onInsert) {
    return client.channel('hub-rating-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rating_history' }, payload => onInsert(payload.new))
      .subscribe();
  }

  function subscribeToInvites(onChange) {
    return client.channel('hub-invites-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cup_registration_members' }, onChange)
      .subscribe();
  }

  return {
    client, signUp, login, logout, currentSession, currentPlayerId, changePassword,
    changeMyName, setRankingExperience, saveAvatar, acknowledgeAvatarReset,
    getGlobalPlayers, getCareerStats, getRatingHistory,
    sendFriendRequest, respondFriendRequest, removeFriend,
    createCupRegistration, respondCupInvite, cancelCupRegistration,
    finalizeRoundRating, recalculateRoundRating, adminSetCupStatus,
    adminRenamePlayer, adminSetRating, adminSetStats, adminResetStats,
    adminResetAvatar, adminSetAvatar, adminAccountAction,
    subscribeToRatingEvents, subscribeToInvites,
  };
})();
