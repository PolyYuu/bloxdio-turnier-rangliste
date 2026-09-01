const RANK_ICONS = {"Holz":"v2-assets/ranks/holz.svg","Eisen":"v2-assets/ranks/eisen.svg","Gold":"v2-assets/ranks/gold.svg","Emerald":"v2-assets/ranks/emerald.svg","Diamant":"v2-assets/ranks/diamant.svg","Meister":"v2-assets/ranks/meister.svg","Großmeister":"v2-assets/ranks/grossmeister.svg"};
const PLAYERS = [{"name": "Stalker_Curry", "rating": 1908, "peak": 1942, "games": 80, "trend": 23, "form": ["up", "down", "up", "up", "down"]}, {"name": "SuesserSuessling", "rating": 1876, "peak": 1912, "games": 80, "trend": 19, "form": ["up", "up", "down", "up", "up"]}, {"name": "Haarsytem123", "rating": 1712, "peak": 1760, "games": 80, "trend": 31, "form": ["up", "up", "down", "up", "up"]}, {"name": "Haarglatzfall123", "rating": 1706, "peak": 1754, "games": 80, "trend": 27, "form": ["up", "down", "up", "up", "up"]}, {"name": "Strebaer", "rating": 1588, "peak": 1657, "games": 80, "trend": 18, "form": ["up", "up", "down", "down", "up"]}, {"name": "Meinii", "rating": 1548, "peak": 1612, "games": 80, "trend": 12, "form": ["up", "down", "up", "down", "up"]}, {"name": "Fruechtebox", "rating": 1472, "peak": 1529, "games": 80, "trend": 9, "form": ["up", "up", "down", "up", "down"]}, {"name": "rgyray", "rating": 1459, "peak": 1518, "games": 80, "trend": -8, "form": ["down", "up", "down", "up", "down"]}, {"name": "Holynazmoly", "rating": 1222, "peak": 1334, "games": 80, "trend": 7, "form": ["up", "down", "up", "down", "up"]}, {"name": "mino_o", "rating": 1208, "peak": 1321, "games": 80, "trend": 4, "form": ["up", "down", "down", "up", "up"]}, {"name": "KleinerWurm", "rating": 1139, "peak": 1288, "games": 80, "trend": -2, "form": ["down", "up", "down", "up", "down"]}, {"name": "FetteEule", "rating": 1127, "peak": 1269, "games": 80, "trend": 3, "form": ["up", "down", "up", "down", "down"]}, {"name": "SchlanzGurke", "rating": 1041, "peak": 1194, "games": 80, "trend": -5, "form": ["down", "down", "up", "down", "up"]}, {"name": "000Nemo000", "rating": 1028, "peak": 1178, "games": 80, "trend": 2, "form": ["up", "down", "down", "up", "down"]}, {"name": "Mysterykiller12", "rating": 947, "peak": 1096, "games": 80, "trend": -6, "form": ["down", "up", "down", "down", "up"]}, {"name": "LordLudes58", "rating": 936, "peak": 1088, "games": 80, "trend": 5, "form": ["up", "down", "up", "down", "down"]}, {"name": "luj00", "rating": 889, "peak": 1044, "games": 80, "trend": -4, "form": ["down", "down", "up", "down", "up"]}, {"name": "JuanDaLan", "rating": 874, "peak": 1025, "games": 80, "trend": -9, "form": ["down", "up", "down", "down", "down"]}];
const CUP_TEAMS = [["SuesserSuessling + Stalker_Curry", 56], ["Haarglatzfall123 + Haarsytem123", 52], ["Fruechtebox + rgyray", 44], ["Strebaer + Meinii", 43], ["mino_o + Holynazmoly", 25], ["FetteEule + KleinerWurm", 16], ["000Nemo000 + SchlanzGurke", 13], ["Mysterykiller12 + LordLudes58", 8], ["luj00 + JuanDaLan", 6]];
const CUP_INDIVIDUAL = [["Strebaer", 31], ["Stalker_Curry", 29], ["SuesserSuessling", 27], ["Haarglatzfall123", 26], ["Haarsytem123", 26], ["Fruechtebox", 23], ["rgyray", 21], ["mino_o", 15], ["KleinerWurm", 13], ["Meinii", 12], ["Holynazmoly", 10], ["SchlanzGurke", 9], ["LordLudes58", 6], ["luj00", 6], ["000Nemo000", 4], ["FetteEule", 3], ["Mysterykiller12", 2], ["JuanDaLan", 0]];
const ROUND_DATA = {"1": [["Suesser + Stalker", 10], ["Fruechtebox + rgyray", 10], ["FetteEule + KleinerWurm", 7]], "2": [["Haarglatz + Haarsytem", 12], ["Suesser + Stalker", 11], ["Fruechtebox + rgyray", 5]], "3": [["Suesser + Stalker", 15], ["Nemo + Schlanz", 8], ["Holynazmoly + mino_o", 4]], "4": [["Haarglatz + Haarsytem", 16], ["Strebaer + Meinii", 6], ["Suesser + Stalker", 4]], "5": [["Strebaer + Meinii", 14], ["Mystery + Lord", 3], ["Suesser + Stalker", 3]], "6": [["Fruechtebox + rgyray", 17], ["Holynazmoly + mino_o", 8], ["Strebaer + Meinii", 7]], "7": [["Suesser + Stalker", 10], ["Fruechtebox + rgyray", 5], ["Strebaer + Meinii", 4]], "8": [["Haarglatz + Haarsytem", 13], ["Holynazmoly + mino_o", 7], ["FetteEule + KleinerWurm", 5]]};

function getRank(rating) {
  if (rating >= 2000) return "Großmeister";
  if (rating >= 1750) return "Meister";
  if (rating >= 1500) return "Diamant";
  if (rating >= 1250) return "Emerald";
  if (rating >= 1000) return "Gold";
  if (rating >= 750) return "Eisen";
  return "Holz";
}

function renderRankIcon(rank, size=34) {
  return `<img src="${RANK_ICONS[rank]}" alt="${rank} Rangicon" width="${size}" height="${size}">`;
}

function rankingRow(player, index, compact=false) {
  const rank = getRank(player.rating);
  const trendClass = player.trend >= 0 ? "positive" : "negative";
  const trendPrefix = player.trend >= 0 ? "+" : "";
  const form = player.form.map(f => `<i class="${f}"></i>`).join("");
  return `<div class="ranking-row ${index===0 ? "top1" : ""}" data-player="${player.name}">
    <div class="placement">${index+1}</div>
    <div class="player-name">${player.name}</div>
    <div class="rank-cell">${renderRankIcon(rank)}<span>${rank}</span></div>
    <div class="rating">${player.rating}</div>
    ${compact ? `<div class="trend ${trendClass}">${trendPrefix}${player.trend}</div>` :
    `<div class="peak">${player.peak}</div><div class="games">${player.games}</div><div class="form-pills">${form}</div>`}
  </div>`;
}

function renderOverviewRanking() {
  document.querySelector("#overviewRankingRows").innerHTML = PLAYERS.slice(0,8).map((p,i)=>rankingRow(p,i,true)).join("");
}
function renderFullRanking() {
  const q = (document.querySelector("#rankingSearch")?.value || "").toLowerCase();
  const filter = document.querySelector("#rankFilter")?.value || "all";
  const filtered = PLAYERS.filter(p => p.name.toLowerCase().includes(q) && (filter === "all" || getRank(p.rating) === filter));
  document.querySelector("#fullRankingRows").innerHTML = filtered.map((p,i)=>rankingRow(p,i,false)).join("") || `<div style="padding:28px;color:#8f82a9;text-align:center">Keine Spieler gefunden.</div>`;
}
function renderCupTeams() {
  document.querySelector("#cupTeamRows").innerHTML = CUP_TEAMS.map((row,i)=>`<div class="cup-row ${i===0 ? "top" : ""}"><span class="cup-rank">${i+1}</span><span class="cup-team-name">${row[0]}</span><span class="cup-points">${row[1]}</span></div>`).join("");
}
function competitionRanks(rows) {
  let ranks=[], last=null, rank=0;
  rows.forEach((r,i)=>{ if(r[1]!==last) rank=i+1; ranks.push(rank); last=r[1]; });
  return ranks;
}
function renderCupIndividual() {
  const ranks = competitionRanks(CUP_INDIVIDUAL);
  document.querySelector("#cupIndividualRows").innerHTML = CUP_INDIVIDUAL.map((row,i)=>`<div class="cup-row ${i===0 ? "top" : ""}"><span class="cup-rank">${ranks[i]}</span><span class="cup-player-name">${row[0]}</span><span class="cup-points">${row[1]}</span></div>`).join("");
}
function renderRounds() {
  const picker = document.querySelector("#roundPicker");
  picker.innerHTML = Object.keys(ROUND_DATA).map((r,i)=>`<button class="${i===0?"active":""}" data-round="${r}">${r}</button>`).join("");
  showRound(1);
  picker.addEventListener("click", e=>{
    const btn=e.target.closest("[data-round]"); if(!btn) return;
    picker.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));
    showRound(Number(btn.dataset.round));
  });
}
function showRound(round) {
  const data = ROUND_DATA[round] || [];
  document.querySelector("#roundSummary").innerHTML = data.map((r,i)=>`<div class="round-card"><span>${i===0?"Rundensieger":`Platz ${i+1}`}</span><strong>${r[0]}</strong><span style="margin-top:5px">${r[1]} Punkte</span></div>`).join("");
}
function setPage(page) {
  const valid = ["overview","ranking","cup","profile"];
  if(!valid.includes(page)) page="overview";
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===page));
  document.querySelectorAll(".primary-nav [data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===page));
  if(location.hash !== `#${page}`) history.replaceState(null,"",`#${page}`);
  window.scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("click", e=>{
  const route=e.target.closest("[data-route]");
  if(route) { e.preventDefault(); setPage(route.dataset.route); }
  const close=e.target.closest("[data-close-modal]");
  if(close) document.getElementById(close.dataset.closeModal).hidden=true;
  if(e.target.matches(".modal-backdrop")) e.target.hidden=true;
  if(e.target.closest("[data-open-register]")) document.querySelector("#registerModal").hidden=false;
});

document.querySelector("#rankingSearch").addEventListener("input",renderFullRanking);
document.querySelector("#rankFilter").addEventListener("change",renderFullRanking);
document.querySelectorAll("[data-cup-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-cup-tab]").forEach(b=>b.classList.toggle("active",b===btn));
  document.querySelectorAll(".cup-tab-content").forEach(t=>t.classList.remove("active"));
  const id = btn.dataset.cupTab === "teams" ? "#cupTeamsTab" : btn.dataset.cupTab === "individual" ? "#cupIndividualTab" : "#cupRoundsTab";
  document.querySelector(id).classList.add("active");
}));
document.querySelector("#cupSelect").addEventListener("change",e=>{
  const upcoming=e.target.value==="upcoming";
  document.querySelector("#pastCupView").hidden=upcoming;
  document.querySelector("#upcomingCupView").hidden=!upcoming;
});

function openRankUpdate() {
  document.querySelector("#roundUpdateModal").hidden=false;
  const bar=document.querySelector("#animatedUpdateBar");
  bar.style.transition="none"; bar.style.width="63.2%";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition="width 1.05s cubic-bezier(.2,.75,.2,1)";bar.style.width="74%";}));
}
document.querySelector("#showRoundUpdateButton").addEventListener("click",openRankUpdate);
document.querySelector("#profileRoundUpdateButton").addEventListener("click",openRankUpdate);

const mateSelect=document.querySelector("#mateSelect");
const matePreview=document.querySelector("#matePreview");
const mateName=document.querySelector("#mateName");
const sendInviteButton=document.querySelector("#sendInviteButton");
mateSelect.addEventListener("change",()=>{
  const has=!!mateSelect.value;
  matePreview.hidden=!has; sendInviteButton.disabled=!has;
  if(has) mateName.textContent=mateSelect.value;
});
sendInviteButton.addEventListener("click",()=>{
  document.querySelector("#inviteSuccess").hidden=false;
  sendInviteButton.textContent="Anfrage gesendet";
  sendInviteButton.disabled=true;
  matePreview.querySelector("small").textContent="Bestätigung ausstehend";
});
document.querySelector("#renameButton").addEventListener("click",()=>alert("Klick-Dummy: Hier würde später der Bloxd.io Name geändert werden."));
document.querySelector("#loginDemoButton").addEventListener("click",()=>setPage("profile"));
document.querySelector("#overviewRankIcon").src=RANK_ICONS["Meister"];
document.querySelector("#profileRankIcon").src=RANK_ICONS["Meister"];
document.querySelector("#updateRankIcon").src=RANK_ICONS["Meister"];

renderOverviewRanking();
renderFullRanking();
renderCupTeams();
renderCupIndividual();
renderRounds();
setPage(location.hash.replace("#","") || "overview");
window.addEventListener("hashchange",()=>setPage(location.hash.replace("#","") || "overview"));
