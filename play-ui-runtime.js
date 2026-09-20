(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const normalizeLang = value => {
    const lang = String(value || '').toLowerCase();
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('en')) return 'en';
    return '';
  };

  const language = () => (
    normalizeLang(localStorage.getItem('sg-lang')) ||
    normalizeLang(localStorage.getItem('hub_language')) ||
    normalizeLang(localStorage.getItem('hubLang')) ||
    normalizeLang(document.documentElement.lang) ||
    'en'
  );

  const COPY = {
    de: {
      fullscreen:'⛶ VOLLBILD', exitFullscreen:'✕ VOLLBILD', noLiveCup:'KEIN CUP LIVE', round:n=>`RUNDE ${n}`,
      myProfile:'DEIN PROFIL', profileUnavailable:'Dein Profil konnte gerade nicht geladen werden.', currentCompetitive:'Aktueller Competitive-Stand',
      runningNotParticipant:name=>`${name} läuft · Du bist kein Teilnehmer`, currentRank:'AKTUELLER RANG', placements:'EINRANGSPIELE',
      progressNext:'FORTSCHRITT ZUM NÄCHSTEN RANG', topRank:'HÖCHSTER RANG', peakRating:'Peak Rating',
      placementNote:'Nach <b>15 Competitive-Runden</b> erhältst du deinen ersten Rang.', liveCup:'HUB · LIVE CUP',
      myTeam:(rank,total,round)=>`Dein Team · Platz ${rank} von ${total} · Runde ${round}`, teamsRound:(teams,round)=>`${teams} Teams · Runde ${round}`,
      openTeam:name=>`Team ${name} öffnen`, roundEnded:n=>`RUNDE ${n} BEENDET`, roundChange:'So hat sich der Cup nach dieser Runde verändert.',
      thisRound:value=>`${value} DIESE RUNDE`, resultLoading:'Ergebnis wird geladen…', continue:'WEITERSPIELEN',
      competitiveRating:'DEIN COMPETITIVE RATING', cupDuoProfile:'CUP-DUO-PROFIL', roundByRound:'RUNDE FÜR RUNDE',
      teamPoints:'Teampunkte', kills:'Kills', deathmatches:'Deathmatches', wins:'Siege', points:'Punkte', deaths:'Tode', roundWord:'Runde',
      duoUnavailable:'Für dieses Team ist keine Duo-Rundenansicht verfügbar.', profileImage:name=>`Profilbild von ${name}`, ownProfileImage:'Dein Profilbild'
    },
    en: {
      fullscreen:'⛶ FULLSCREEN', exitFullscreen:'✕ FULLSCREEN', noLiveCup:'NO LIVE CUP', round:n=>`ROUND ${n}`,
      myProfile:'YOUR PROFILE', profileUnavailable:'Your profile could not be loaded right now.', currentCompetitive:'Current competitive standing',
      runningNotParticipant:name=>`${name} is live · You are not a participant`, currentRank:'CURRENT RANK', placements:'PLACEMENTS',
      progressNext:'PROGRESS TO NEXT RANK', topRank:'TOP RANK', peakRating:'Peak Rating',
      placementNote:'After <b>15 competitive rounds</b>, you receive your first rank.', liveCup:'HUB · LIVE CUP',
      myTeam:(rank,total,round)=>`Your team · Rank ${rank} of ${total} · Round ${round}`, teamsRound:(teams,round)=>`${teams} teams · Round ${round}`,
      openTeam:name=>`Open team ${name}`, roundEnded:n=>`ROUND ${n} COMPLETE`, roundChange:'This is how the Cup standings changed after this round.',
      thisRound:value=>`${value} THIS ROUND`, resultLoading:'Loading result…', continue:'CONTINUE PLAYING',
      competitiveRating:'YOUR COMPETITIVE RATING', cupDuoProfile:'CUP DUO PROFILE', roundByRound:'ROUND BY ROUND',
      teamPoints:'Team points', kills:'Kills', deathmatches:'Deathmatches', wins:'Wins', points:'Points', deaths:'Deaths', roundWord:'Round',
      duoUnavailable:'No duo round view is available for this team.', profileImage:name=>`Profile picture of ${name}`, ownProfileImage:'Your profile picture'
    },
    fr: {
      fullscreen:'⛶ PLEIN ÉCRAN', exitFullscreen:'✕ PLEIN ÉCRAN', noLiveCup:'AUCUN CUP EN DIRECT', round:n=>`MANCHE ${n}`,
      myProfile:'TON PROFIL', profileUnavailable:'Ton profil ne peut pas être chargé pour le moment.', currentCompetitive:'Classement compétitif actuel',
      runningNotParticipant:name=>`${name} est en direct · Tu ne participes pas`, currentRank:'RANG ACTUEL', placements:'MATCHS DE PLACEMENT',
      progressNext:'PROGRESSION VERS LE RANG SUIVANT', topRank:'RANG MAXIMAL', peakRating:'Meilleur rating',
      placementNote:'Après <b>15 manches compétitives</b>, tu obtiens ton premier rang.', liveCup:'HUB · CUP EN DIRECT',
      myTeam:(rank,total,round)=>`Ton équipe · Place ${rank} sur ${total} · Manche ${round}`, teamsRound:(teams,round)=>`${teams} équipes · Manche ${round}`,
      openTeam:name=>`Ouvrir l’équipe ${name}`, roundEnded:n=>`MANCHE ${n} TERMINÉE`, roundChange:'Voici comment le classement du Cup a évolué après cette manche.',
      thisRound:value=>`${value} CETTE MANCHE`, resultLoading:'Chargement du résultat…', continue:'CONTINUER À JOUER',
      competitiveRating:'TON RATING COMPÉTITIF', cupDuoProfile:'PROFIL DU DUO DU CUP', roundByRound:'MANCHE PAR MANCHE',
      teamPoints:'Points équipe', kills:'Éliminations', deathmatches:'Deathmatches', wins:'Victoires', points:'Points', deaths:'Morts', roundWord:'Manche',
      duoUnavailable:'Aucune vue des manches en duo n’est disponible pour cette équipe.', profileImage:name=>`Photo de profil de ${name}`, ownProfileImage:'Ta photo de profil'
    }
  };

  const copy = () => COPY[language()] || COPY.en;

  function setText(selector, value) {
    const el = $(selector);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function translateSidePanel(c) {
    const title = $('#sideTitle');
    if (title && /^(DEIN PROFIL|YOUR PROFILE|TON PROFIL)$/i.test(title.textContent.trim())) title.textContent = c.myProfile;

    const eyebrow = $('#sideEyebrow');
    if (eyebrow && /LIVE CUP|CUP EN DIRECT/i.test(eyebrow.textContent)) eyebrow.textContent = c.liveCup;

    const meta = $('#sideMeta');
    if (meta) {
      const text = meta.textContent.trim();
      let match = text.match(/^Dein Team · Platz (\d+) von (\d+) · Runde (\d+)$/i) || text.match(/^Your team · Rank (\d+) of (\d+) · Round (\d+)$/i) || text.match(/^Ton équipe · Place (\d+) sur (\d+) · Manche (\d+)$/i);
      if (match) meta.textContent = c.myTeam(match[1],match[2],match[3]);
      else {
        match = text.match(/^(\d+) Teams · Runde (\d+)$/i) || text.match(/^(\d+) teams · Round (\d+)$/i) || text.match(/^(\d+) équipes · Manche (\d+)$/i);
        if (match) meta.textContent = c.teamsRound(match[1],match[2]);
        else if (/^(Aktueller Competitive-Stand|Current competitive standing|Classement compétitif actuel)$/i.test(text)) meta.textContent = c.currentCompetitive;
        else {
          const suffixes = [' läuft · Du bist kein Teilnehmer',' is live · You are not a participant',' est en direct · Tu ne participes pas'];
          const suffix = suffixes.find(item => text.endsWith(item));
          if (suffix) meta.textContent = c.runningNotParticipant(text.slice(0,-suffix.length));
        }
      }
    }

    $$('.rank-kicker').forEach(el => { el.textContent = c.currentRank; });
    $$('.rank-progress-label span:first-child').forEach(el => {
      const text = el.textContent.trim();
      if (/^(PLACEMENTS|EINRANGSPIELE|MATCHS DE PLACEMENT)$/i.test(text)) el.textContent = c.placements;
      else if (/^(PROGRESS TO NEXT RANK|FORTSCHRITT ZUM NÄCHSTEN RANG|PROGRESSION VERS LE RANG SUIVANT)$/i.test(text)) el.textContent = c.progressNext;
      else if (/^(TOP RANK|HÖCHSTER RANG|RANG MAXIMAL)$/i.test(text)) el.textContent = c.topRank;
    });

    const note = $('.rank-note');
    if (note) {
      if ($('.profile-mini h3:not(.profile-mini-name)')?.textContent.trim().toUpperCase() === 'UNRANKED') note.innerHTML = c.placementNote;
      else {
        const value = note.querySelector('b')?.textContent || '';
        if (value) note.innerHTML = `${c.peakRating}: <b>${value}</b>`;
      }
    }

    const empty = $('.side-panel-content .side-empty');
    if (empty) {
      const text = empty.textContent.trim();
      if (/Profil konnte|profile could not|profil ne peut pas/i.test(text)) empty.textContent = c.profileUnavailable;
    }

    $$('.profile-mini-avatar').forEach(img => { img.alt = c.ownProfileImage; });
    $$('.cup-row[data-cup-team]').forEach(button => {
      const existing = button.getAttribute('aria-label') || '';
      const name = existing.replace(/^Team\s+/i,'').replace(/\s+öffnen$/i,'').replace(/^Open team\s+/i,'').replace(/^Ouvrir l’équipe\s+/i,'');
      if (name) button.setAttribute('aria-label',c.openTeam(name));
    });
  }

  function translateRoundUi(c) {
    const roundLabel = $('#roundLabel');
    if (roundLabel) {
      const text = roundLabel.textContent.trim();
      if (/^(KEIN CUP LIVE|NO LIVE CUP|AUCUN CUP EN DIRECT)$/i.test(text)) roundLabel.textContent = c.noLiveCup;
      else {
        const match = text.match(/(?:RUNDE|ROUND|MANCHE)\s+(\d+)/i);
        if (match) roundLabel.textContent = c.round(match[1]);
      }
    }

    const overlayTitle = $('#overlayTitle');
    if (overlayTitle) {
      const match = overlayTitle.textContent.match(/(?:RUNDE|ROUND|MANCHE)\s+(\d+)/i);
      if (match) overlayTitle.textContent = c.roundEnded(match[1]);
    }
    const overlayChip = $('#overlayRoundChip');
    if (overlayChip) {
      const match = overlayChip.textContent.match(/(?:RUNDE|ROUND|MANCHE)\s+(\d+)/i);
      if (match) overlayChip.textContent = c.round(match[1]);
    }
    setText('#overlaySubtitle',c.roundChange);
    setText('#closeOverlayButton',c.continue);
    const ratingLabel = $('#myRatingBlock span');
    if (ratingLabel) ratingLabel.textContent = c.competitiveRating;

    $$('.overlay-points small').forEach(el => {
      const match = el.textContent.match(/^([+-]?\d+)\s+(?:DIESE RUNDE|THIS ROUND|CETTE MANCHE)$/i);
      if (match) el.textContent = c.thisRound(match[1]);
    });
    $$('.overlay-ranking .side-empty').forEach(el => {
      if (/Ergebnis wird geladen|Loading result|Chargement du résultat/i.test(el.textContent)) el.textContent = c.resultLoading;
    });
  }

  function translateTeamModal(c) {
    const modal = $('#teamDetailModal');
    if (!modal) return;
    const eyebrow = $('.eyebrow',modal);
    if (eyebrow) eyebrow.textContent = c.cupDuoProfile;
    const roundHeading = $('.team-round-table-wrap h3',modal);
    if (roundHeading) roundHeading.textContent = c.roundByRound;

    const labelMap = new Map([
      ['team points',c.teamPoints],['teampunkte',c.teamPoints],['points équipe',c.teamPoints],
      ['kills',c.kills],['éliminations',c.kills],['deathmatches',c.deathmatches],
      ['wins',c.wins],['siege',c.wins],['victoires',c.wins],['points',c.points],['punkte',c.points],
      ['deaths',c.deaths],['tode',c.deaths],['morts',c.deaths],['round',c.roundWord],['runde',c.roundWord],['manche',c.roundWord]
    ]);
    $$('.team-detail-summary span,.player-mini-stats span,.team-round-row.head span',modal).forEach(el => {
      const replacement = labelMap.get(el.textContent.trim().toLowerCase());
      if (replacement) el.textContent = replacement;
    });
    $$('.team-round-table-wrap .side-empty',modal).forEach(el => { el.textContent = c.duoUnavailable; });
  }

  function translateImages(c) {
    $$('img.pixel-avatar').forEach(img => {
      const current = img.alt || '';
      const name = current.replace(/^Profilbild von\s*/i,'').replace(/^Profile picture of\s*/i,'').replace(/^Photo de profil de\s*/i,'');
      if (name) img.alt = c.profileImage(name);
    });
  }

  function applyLanguage() {
    // Observe external UI updates, not this synchronous translation pass.
    observer.disconnect();
    try {
      const lang = language();
      const c = COPY[lang] || COPY.en;
      document.documentElement.lang = lang;
      translateSidePanel(c);
      translateRoundUi(c);
      translateTeamModal(c);
      translateImages(c);
      const loading = $('.side-loading');
      if (loading) loading.textContent = lang === 'de' ? 'VERBINDE MIT HUB…' : lang === 'fr' ? 'CONNEXION AU HUB…' : 'CONNECTING TO HUB…';
      syncFullscreenLabel();
    } finally {
      observer.observe(document.documentElement, translationObserverOptions);
    }
  }

  let translateFrame = 0;
  function scheduleTranslation() {
    if (translateFrame) return;
    translateFrame = requestAnimationFrame(() => {
      translateFrame = 0;
      applyLanguage();
    });
  }

  // Request fullscreen on pointerdown instead of waiting for click. Bloxd's chat can
  // otherwise consume the pointer-up/click after T opened the chat, leaving only a focused button.
  const fullscreenButton = $('#fullscreenButton');
  const gameStage = $('#gameStage');
  let pointerFullscreenAt = 0;

  function toggleFullscreenFromGesture() {
    if (!gameStage) return;
    try {
      if (document.fullscreenElement === gameStage) {
        const result = document.exitFullscreen();
        result?.catch?.(error => console.warn('Play fullscreen exit unavailable',error));
        return;
      }
      if (document.fullscreenElement) {
        const result = document.exitFullscreen();
        result?.catch?.(error => console.warn('Foreign fullscreen exit unavailable',error));
        return;
      }
      const result = gameStage.requestFullscreen();
      result?.catch?.(error => console.warn('Play fullscreen unavailable',error));
    } catch (error) {
      console.warn('Play fullscreen unavailable',error);
    }
  }

  function syncFullscreenLabel() {
    if (!fullscreenButton) return;
    const c = copy();
    setText('#fullscreenButton', document.fullscreenElement === gameStage ? c.exitFullscreen : c.fullscreen);
  }

  fullscreenButton?.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (typeof event.button === 'number' && event.button !== 0)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pointerFullscreenAt = performance.now();
    toggleFullscreenFromGesture();
  }, true);

  fullscreenButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (performance.now() - pointerFullscreenAt < 900) return;
    toggleFullscreenFromGesture();
  }, true);

  document.addEventListener('fullscreenchange', () => {
    syncFullscreenLabel();
    scheduleTranslation();
  });

  const translationObserverOptions = {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-label','alt']};
  const observer = new MutationObserver(scheduleTranslation);
  observer.observe(document.documentElement, translationObserverOptions);
  window.addEventListener('storage', event => {
    if (['sg-lang','hub_language','hubLang'].includes(event.key)) scheduleTranslation();
  });

  applyLanguage();
})();
