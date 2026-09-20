let state = {lang: localStorage.getItem("sg-lang") || "en", profilePlayer:"Stalker_Curry"};

function t(key, vars={}) {
  let value = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
  Object.entries(vars).forEach(([k,v]) => value = value.replace(`{${k}}`, v));
  return value;
}
function rankName(key){ return RANK_NAMES[state.lang][key] || key; }
function getRankKey(rating){
  if(rating>=2000) return "grandmaster";
  if(rating>=1750) return "master";
  if(rating>=1500) return "diamond";
  if(rating>=1250) return "emerald";
  if(rating>=1000) return "gold";
  if(rating>=750) return "iron";
  return "wood";
}
function getBounds(rating){
  if(rating>=2000) return {low:2000,high:3000,next:null};
  if(rating>=1750) return {low:1750,high:2000,next:"grandmaster"};
  if(rating>=1500) return {low:1500,high:1750,next:"master"};
  if(rating>=1250) return {low:1250,high:1500,next:"diamond"};
  if(rating>=1000) return {low:1000,high:1250,next:"emerald"};
  if(rating>=750) return {low:750,high:1000,next:"gold"};
  return {low:0,high:750,next:"iron"};
}
function pct(rating,bounds){ return Math.max(0,Math.min(100,(rating-bounds.low)/(bounds.high-bounds.low)*100)); }
function renderRankIcon(rankKey,size=44){ return `<img src="${RANK_ICONS[rankKey]}" alt="${rankName(rankKey)}" width="${size}" height="${size}">`; }
function playerByName(name){ return PLAYERS.find(p=>p.name===name) || PLAYERS[0]; }
function pointsFor(e){ return (e?.k||0)+3*(e?.dm||0)+2*(e?.w||0); }
function eventFor(round,name){ return ROUND_EVENTS[String(round)]?.[name] || {k:0,dm:0,w:0}; }
function cupStats(name){
  let points=0,kills=0,dm=0,wins=0,maxRound=0;
  for(let r=1;r<=8;r++){ const e=eventFor(r,name); const p=pointsFor(e); points+=p;kills+=e.k;dm+=e.dm;wins+=e.w;maxRound=Math.max(maxRound,p); }
  return {points,kills,dm,wins,deaths:8-wins,maxRound};
}
function careerStats(name){
  const p=playerByName(name), c=cupStats(name), factor=Math.max(1,p.games/8);
  const roundWins=Math.round(c.wins*factor), kills=Math.round(c.kills*factor), deaths=Math.max(0,p.games-roundWins);
  return {
    rankedGames:p.games,cups:Math.max(1,Math.round(p.games/8)),avgPoints:(c.points/8).toFixed(1),
    kills,cupWins:CUP_WIN_DEMO[name]||0,roundWins,kd:(kills/Math.max(1,deaths)).toFixed(2),
    mostCupPoints:c.points,mostRoundPoints:c.maxRound
  };
}

function rankingRow(player,index,compact=false){
  const key=getRankKey(player.rating), trendClass=player.trend>=0?"positive":"negative", prefix=player.trend>=0?"+":"";
  const form=player.form.map(f=>`<i class="${f}"></i>`).join("");
  return `<div class="ranking-row ${index===0?"top1":""}" data-profile-player="${player.name}">
    <div class="placement">${index+1}</div>
    <div class="player-name"><button class="player-link" type="button" data-profile-player="${player.name}">${player.name}</button></div>
    <div class="rank-cell">${renderRankIcon(key,compact?38:46)}<span>${rankName(key)}</span></div>
    <div class="rating">${player.rating}</div>
    ${compact?`<div class="trend ${trendClass}">${prefix}${player.trend}</div>`:`<div class="peak">${player.peak}</div><div class="games">${player.games}</div><div class="form-pills">${form}</div>`}
  </div>`;
}
function renderOverviewRanking(){ document.querySelector("#overviewRankingRows").innerHTML=PLAYERS.slice(0,8).map((p,i)=>rankingRow(p,i,true)).join(""); }
function renderRankFilter(){
  const select=document.querySelector("#rankFilter");
  const keys=["grandmaster","master","diamond","emerald","gold","iron","wood"];
  select.innerHTML=`<option value="all">${t("ranking.allRanks")}</option>`+keys.map(k=>`<option value="${k}">${rankName(k)}</option>`).join("");
}
function renderFullRanking(){
  const q=(document.querySelector("#rankingSearch")?.value||"").toLowerCase(), filter=document.querySelector("#rankFilter")?.value||"all";
  const filtered=PLAYERS.filter(p=>p.name.toLowerCase().includes(q)&&(filter==="all"||getRankKey(p.rating)===filter));
  document.querySelector("#fullRankingRows").innerHTML=filtered.map((p,i)=>rankingRow(p,PLAYERS.indexOf(p),false)).join("")||`<div style="padding:34px;color:#8f82a9;text-align:center">${t("ranking.empty")}</div>`;
}
function competitionRanks(rows){ let out=[],last=null,rank=0;rows.forEach((r,i)=>{if(r.points!==last)rank=i+1;out.push(rank);last=r.points;});return out; }
function individualRows(){
  const rows=PLAYERS.map(p=>({name:p.name,points:cupStats(p.name).points})).sort((a,b)=>b.points-a.points);
  return rows;
}
function renderCupTeams(){
  document.querySelector("#cupTeamRows").innerHTML=CUP_TEAMS.map((team,i)=>`<div class="cup-row ${i===0?"top":""}">
    <span class="cup-rank">${i+1}</span>
    <button class="cup-team-button" type="button" data-team-index="${i}"><span>${team.players[0]}</span><i>+</i><span>${team.players[1]}</span></button>
    <span class="cup-points">${team.points}</span></div>`).join("");
}
function renderCupIndividual(){
  const rows=individualRows(), ranks=competitionRanks(rows);
  document.querySelector("#cupIndividualRows").innerHTML=rows.map((row,i)=>`<div class="cup-row ${i===0?"top":""}">
    <span class="cup-rank">${ranks[i]}</span><span class="cup-player-name"><button class="cup-player-button" type="button" data-profile-player="${row.name}">${row.name}</button></span><span class="cup-points">${row.points}</span></div>`).join("");
}
function teamRoundPoints(team,round){ return team.players.reduce((s,n)=>s+pointsFor(eventFor(round,n)),0); }
function roundTeamRanking(round){
  return CUP_TEAMS.map((team,i)=>({i,team,points:teamRoundPoints(team,round)})).sort((a,b)=>b.points-a.points);
}
function renderRounds(){
  const picker=document.querySelector("#roundPicker");
  picker.innerHTML=Array.from({length:8},(_,i)=>`<button class="${i===0?"active":""}" data-round="${i+1}">${i+1}</button>`).join("");
  showRound(1);
}
function showRound(round){
  const data=roundTeamRanking(round);
  document.querySelector("#roundSummary").innerHTML=data.map((r,i)=>`<div class="round-card" data-team-index="${r.i}">
    <span>${i===0?t("misc.roundWinner"):t("misc.place",{n:i+1})}</span>
    <button class="cup-team-button" type="button" data-team-index="${r.i}">${r.team.players[0]} <i>+</i> ${r.team.players[1]}</button>
    <span style="margin-top:5px">${t("misc.points",{n:r.points})}</span></div>`).join("");
}
function renderRegistrations(){
  document.querySelector("#publicRegistrationList").innerHTML=UPCOMING_REGISTRATIONS.map(x=>`<div><span>${x.team.join(" + ")}</span><b class="${x.status==="confirmed"?"status-confirmed":"status-pending"}">${t(x.status==="confirmed"?"misc.confirmed":"misc.pending")}</b></div>`).join("");
}
function openTeamDetail(index){
  const team=CUP_TEAMS[index]; if(!team)return;
  document.querySelector("#teamDetailTitle").textContent=team.players.join(" + ");
  const stats=team.players.map(cupStats), kills=stats.reduce((s,x)=>s+x.kills,0),dm=stats.reduce((s,x)=>s+x.dm,0),wins=stats.reduce((s,x)=>s+x.wins,0);
  document.querySelector("#teamDetailSummary").innerHTML=[
    [t("team.totalPoints"),team.points],[t("team.kills"),kills],[t("team.dm"),dm],[t("team.wins"),wins]
  ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  document.querySelector("#teamPlayerCards").innerHTML=team.players.map((name,pi)=>{const s=stats[pi];return `<article><h3><button type="button" data-profile-player="${name}">${name} ↗</button></h3><div class="player-mini-stats">
    <div><span>${t("table.points")}</span><b>${s.points}</b></div><div><span>${t("team.kills")}</span><b>${s.kills}</b></div><div><span>DM</span><b>${s.dm}</b></div><div><span>${t("team.wins")}</span><b>${s.wins}</b></div><div><span>${t("team.deaths")}</span><b>${s.deaths}</b></div>
  </div></article>`}).join("");
  const head=`<div class="team-round-row head"><span>${t("team.round")}</span><span>${team.players[0]}</span><span>PTS</span><span>K</span><span>DM</span><span>W</span><span>${team.players[1]}</span><span>PTS</span><span>K</span><span>DM</span><span>W</span></div>`;
  const rows=Array.from({length:8},(_,i)=>{const r=i+1,a=eventFor(r,team.players[0]),b=eventFor(r,team.players[1]),pa=pointsFor(a),pb=pointsFor(b),winner=a.w||b.w;return `<div class="team-round-row">
    <strong class="${winner?"winner":""}">${r}</strong><strong>${team.players[0]}</strong><span class="round-total">${pa}</span><span>${a.k}</span><span>${a.dm}</span><span>${a.w}</span>
    <strong>${team.players[1]}</strong><span class="round-total">${pb}</span><span>${b.k}</span><span>${b.dm}</span><span>${b.w}</span></div>`}).join("");
  document.querySelector("#teamRoundTable").className="team-round-table"; document.querySelector("#teamRoundTable").innerHTML=head+rows;
  document.querySelector("#teamDetailModal").hidden=false;
}
function initials(name){ return name.replace(/[^A-Za-z0-9]/g," ").split(/\s+/).filter(Boolean).map(s=>s[0]).join("").slice(0,2).toUpperCase()||name.slice(0,2).toUpperCase(); }
function renderProfile(){
  const p=playerByName(state.profilePlayer), globalRank=PLAYERS.indexOf(p)+1, key=getRankKey(p.rating), bounds=getBounds(p.rating), progress=pct(p.rating,bounds), c=careerStats(p.name);
  document.querySelector("#profilePlayerName").textContent=p.name; document.querySelector("#profileMonogram").textContent=initials(p.name); document.querySelector("#profileGlobalRank").textContent=`#${globalRank} global`;
  document.querySelector("#profileRankIcon").src=RANK_ICONS[key]; document.querySelector("#profileRankName").textContent=rankName(key); document.querySelector("#profileRating").textContent=p.rating; document.querySelector("#profilePeak").textContent=`Peak: ${p.peak}`;
  document.querySelector("#profileProgressBar").style.width=`${progress}%`; document.querySelector("#profileProgressPct").textContent=`${Math.round(progress)}%`; document.querySelector("#profileRangeLow").textContent=bounds.low; document.querySelector("#profileRangeHigh").textContent=bounds.high;
  if(bounds.next){ document.querySelector("#profileProgressTitle").textContent=t("overlay.progressTo",{rank:rankName(bounds.next)}); document.querySelector("#profileRatingRemaining").textContent=t("overlay.left",{n:bounds.high-p.rating}); }
  else{ document.querySelector("#profileProgressTitle").textContent=rankName("grandmaster"); document.querySelector("#profileRatingRemaining").textContent=`${p.rating} / 3000`; }
  const statItems=[
    ["stats.rankedGames",c.rankedGames],["stats.cups",c.cups],["stats.avgPoints",c.avgPoints],["stats.kills",c.kills],["stats.cupWins",c.cupWins],
    ["stats.roundWins",c.roundWins],["stats.kd",c.kd],["stats.mostCupPoints",c.mostCupPoints],["stats.mostRoundPoints",c.mostRoundPoints]
  ];
  document.querySelector("#profileStatGrid").innerHTML=statItems.map(([k,v])=>`<div><span>${t(k)}</span><strong>${v}</strong></div>`).join("");
}
function renderOverviewRank(){
  const p=playerByName("Stalker_Curry"),key=getRankKey(p.rating),b=getBounds(p.rating),progress=pct(p.rating,b);
  document.querySelector("#overviewRankIcon").src=RANK_ICONS[key]; document.querySelector("#overviewRankName").textContent=rankName(key);document.querySelector("#overviewRating").textContent=p.rating;document.querySelector("#overviewProgressBar").style.width=`${progress}%`;document.querySelector("#overviewProgressLabel").textContent=`${Math.round(progress)}%`;
  document.querySelector("#overviewProgressText").textContent=t("overlay.progressTo",{rank:rankName(b.next)});document.querySelector("#overviewRatingLeft").textContent=t("overlay.left",{n:b.high-p.rating});
}
function renderAdmin(){
  document.querySelector("#adminRoundPicker").innerHTML=Array.from({length:8},(_,i)=>`<button class="${i===7?"active":""}">${i+1}</button>`).join("");
  const teamMap={};CUP_TEAMS.forEach((team,i)=>team.players.forEach(n=>teamMap[n]=`#${i+1} · ${team.players.join(" + ")}`));
  document.querySelector("#adminParticipantRows").innerHTML=PLAYERS.map(p=>`<div class="admin-player-row"><strong>${p.name}</strong><span>${teamMap[p.name]||"—"}</span><b>${cupStats(p.name).points}</b><span>Round 8</span><span><button>${t("misc.edit")}</button> <button>${t("misc.remove")}</button></span></div>`).join("");
  document.querySelector("#adminRegistrationRows").innerHTML=UPCOMING_REGISTRATIONS.map((x,i)=>`<div class="admin-registration-row"><strong>${x.team.join(" + ")}</strong><span class="${x.status==="confirmed"?"status-confirmed":"status-pending"}">${t(x.status==="confirmed"?"misc.confirmed":"misc.pending")}</span><span>${x.team[0]}</span><span><button>${t("misc.edit")}</button></span></div>`).join("");
}
function setProfilePlayer(name){ if(!playerByName(name))return; state.profilePlayer=name; renderProfile(); setPage("profile"); }
function setPage(page){
  const valid=["overview","ranking","cup","profile","admin"]; if(!valid.includes(page))page="overview";
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===page));
  document.querySelectorAll(".primary-nav [data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===page));
  if(location.hash!==`#${page}`)history.replaceState(null,"",`#${page}`); window.scrollTo({top:0,behavior:"smooth"});
}
function applyLanguage(lang){
  if(!I18N[lang])lang="en";state.lang=lang;localStorage.setItem("sg-lang",lang);document.documentElement.lang=lang;
  const [flag,code]=FLAGS[lang];document.querySelector("#languageFlag").textContent=flag;document.querySelector("#languageCode").textContent=code;
  document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(I18N[lang][key])el.textContent=I18N[lang][key]});
  document.querySelector("#rankingSearch").placeholder=t("ranking.search");
  renderRankFilter();renderOverviewRanking();renderFullRanking();renderCupTeams();renderCupIndividual();showRound(Number(document.querySelector("#roundPicker .active")?.dataset.round||1));renderRegistrations();renderProfile();renderOverviewRank();renderAdmin();
}
function openRankUpdate(rankUp=false){
  const modal=document.querySelector("#roundUpdateModal"),card=document.querySelector("#rankUpdateCard"),icon=document.querySelector("#updateRankIcon"),bar=document.querySelector("#animatedUpdateBar"),message=document.querySelector("#rankUpMessage");
  card.classList.toggle("rank-up",rankUp);message.hidden=true;
  const before=rankUp?1988:1908,after=rankUp?2015:1935,oldKey=getRankKey(before),newKey=getRankKey(after),oldB=getBounds(before),newB=getBounds(after),beforePct=pct(before,oldB),afterPct=pct(after,newB);
  icon.src=RANK_ICONS[oldKey];document.querySelector("#updateRankName").textContent=rankName(oldKey);document.querySelector("#ratingBefore").textContent=before;document.querySelector("#ratingAfter").textContent=after;document.querySelector("#ratingDelta").textContent=`+${after-before} Rating`;document.querySelector("#updateKicker").textContent=t("overlay.update",{n:81});document.querySelector("#rankUpdateTitle").textContent=t("overlay.yourProgress");
  document.querySelector("#updateLow").textContent=oldB.low;document.querySelector("#updateHigh").textContent=oldB.high;document.querySelector("#updateProgressTitle").textContent=oldB.next?t("overlay.progressTo",{rank:rankName(oldB.next)}):rankName(oldKey);document.querySelector("#updateProgressPct").textContent=`${Math.round(beforePct)}%`;document.querySelector("#updateRemaining").textContent=t("overlay.left",{n:Math.max(0,oldB.high-before)});
  modal.hidden=false;bar.style.transition="none";bar.style.width=`${beforePct}%`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition="width 2.1s cubic-bezier(.2,.75,.2,1)";bar.style.width=rankUp?"100%":`${afterPct}%`;document.querySelector("#updateProgressPct").textContent=rankUp?"100%":`${Math.round(afterPct)}%`;}));
  if(rankUp){setTimeout(()=>{icon.src=RANK_ICONS[newKey];document.querySelector("#updateRankName").textContent=rankName(newKey);document.querySelector("#newRankName").textContent=rankName(newKey);message.hidden=false;bar.style.transition="none";bar.style.width="0%";document.querySelector("#updateLow").textContent=newB.low;document.querySelector("#updateHigh").textContent=newB.high;document.querySelector("#updateProgressTitle").textContent=rankName(newKey);document.querySelector("#updateRemaining").textContent=`${after} / ${newB.high}`;requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition="width 2.1s cubic-bezier(.2,.75,.2,1)";bar.style.width=`${afterPct}%`;document.querySelector("#updateProgressPct").textContent=`${Math.round(afterPct)}%`;}));},2300);}
}
window.simulateRealtimeRatingEvent=(payload={})=>openRankUpdate(!!payload.rankUp);

document.addEventListener("click",e=>{
  const route=e.target.closest("[data-route]");if(route){e.preventDefault();setPage(route.dataset.route);}
  const profile=e.target.closest("[data-profile-player]");if(profile){e.stopPropagation();setProfilePlayer(profile.dataset.profilePlayer);}
  const team=e.target.closest("[data-team-index]");if(team){e.stopPropagation();openTeamDetail(Number(team.dataset.teamIndex));}
  const close=e.target.closest("[data-close-modal]");if(close)document.getElementById(close.dataset.closeModal).hidden=true;
  if(e.target.matches(".modal-backdrop"))e.target.hidden=true;
  if(e.target.closest("[data-open-register]"))document.querySelector("#registerModal").hidden=false;
  if(!e.target.closest("#languagePicker"))document.querySelector("#languageMenu").hidden=true;
});
document.querySelector("#languageButton").addEventListener("click",()=>{const m=document.querySelector("#languageMenu");m.hidden=!m.hidden;document.querySelector("#languageButton").setAttribute("aria-expanded",String(!m.hidden));});
document.querySelectorAll("[data-lang]").forEach(btn=>btn.addEventListener("click",()=>{applyLanguage(btn.dataset.lang);document.querySelector("#languageMenu").hidden=true;}));
document.querySelector("#rankingSearch").addEventListener("input",renderFullRanking);document.querySelector("#rankFilter").addEventListener("change",renderFullRanking);
document.querySelectorAll("[data-cup-tab]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-cup-tab]").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".cup-tab-content").forEach(t=>t.classList.remove("active"));document.querySelector(btn.dataset.cupTab==="teams"?"#cupTeamsTab":btn.dataset.cupTab==="individual"?"#cupIndividualTab":"#cupRoundsTab").classList.add("active");}));
document.querySelector("#roundPicker").addEventListener("click",e=>{const b=e.target.closest("[data-round]");if(!b)return;document.querySelectorAll("#roundPicker button").forEach(x=>x.classList.toggle("active",x===b));showRound(Number(b.dataset.round));});
document.querySelector("#cupSelect").addEventListener("change",e=>{const upcoming=e.target.value==="upcoming";document.querySelector("#pastCupView").hidden=upcoming;document.querySelector("#upcomingCupView").hidden=!upcoming;});
document.querySelector("#showRoundUpdateButton").addEventListener("click",()=>openRankUpdate(false));document.querySelector("#profileRoundUpdateButton").addEventListener("click",()=>openRankUpdate(false));document.querySelector("#rankUpDemoButton").addEventListener("click",()=>openRankUpdate(true));
document.querySelector("#adminLaunchButton").addEventListener("click",()=>setPage("admin"));document.querySelector("#profileAdminButton").addEventListener("click",()=>setPage("admin"));
document.querySelectorAll("[data-admin-tab]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-admin-tab]").forEach(b=>b.classList.toggle("active",b===btn));document.querySelector("#adminParticipantsTab").classList.toggle("active",btn.dataset.adminTab==="participants");document.querySelector("#adminRegistrationsTab").classList.toggle("active",btn.dataset.adminTab==="registrations");}));
const mateSelect=document.querySelector("#mateSelect"),matePreview=document.querySelector("#matePreview"),mateName=document.querySelector("#mateName"),sendInviteButton=document.querySelector("#sendInviteButton");
mateSelect.addEventListener("change",()=>{const has=!!mateSelect.value;matePreview.hidden=!has;sendInviteButton.disabled=!has;if(has)mateName.textContent=mateSelect.value;});
sendInviteButton.addEventListener("click",()=>{document.querySelector("#inviteSuccess").hidden=false;sendInviteButton.textContent=t("register.sent");sendInviteButton.disabled=true;matePreview.querySelector("small").textContent=t("register.pending");});
document.querySelector("#renameButton").addEventListener("click",()=>alert(state.lang==="de"?"Klick-Dummy: Hier wird später der Bloxd.io Name geändert.":state.lang==="fr"?"Démo : le nom Bloxd.io pourra être modifié ici.":"Click dummy: the Bloxd.io name will be changed here later."));
document.querySelector("#loginDemoButton").addEventListener("click",()=>{document.querySelector("#adminLaunchButton").hidden=false;setPage("profile");});

renderRounds();renderCupTeams();renderCupIndividual();renderRegistrations();renderOverviewRanking();renderFullRanking();renderProfile();renderOverviewRank();renderAdmin();applyLanguage(state.lang);setPage(location.hash.replace("#","")||"overview");
window.addEventListener("hashchange",()=>setPage(location.hash.replace("#","")||"overview"));
