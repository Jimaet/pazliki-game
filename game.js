const IMAGE_COUNT=20;
const IMAGE_PATH=i=>`assets/images/image${String(i).padStart(2,"0")}.jpg`;
const SAVE_KEY="pazliki_pikabu_save_v3";
const DIFFICULTIES={
easy:{size:3,name:"Легко"},
medium:{size:4,name:"Средне"},
hard:{size:5,name:"Сложно"}
};
const ACHIEVEMENTS=[
{id:"first",icon:"◆",name:"Первый пазл",check:s=>s.totalCompleted>=1},
{id:"ten",icon:"✦",name:"10 пазлов",check:s=>s.totalCompleted>=10},
{id:"thirty",icon:"★",name:"30 пазлов",check:s=>s.totalCompleted>=30},
{id:"easy",icon:"3",name:"Лёгкая серия",check:s=>s.progress.easy.filter(Boolean).length>=20},
{id:"medium",icon:"4",name:"Средняя серия",check:s=>s.progress.medium.filter(Boolean).length>=20},
{id:"hard",icon:"5",name:"Сложная серия",check:s=>s.progress.hard.filter(Boolean).length>=20},
{id:"master",icon:"♛",name:"Мастер пазлов",check:s=>s.totalCompleted>=60}
];
const state={
difficulty:"easy",
level:0,
board:[],
size:3,
moves:0,
seconds:0,
timer:null,
paused:false,
locked:false,
selected:null,
hintPiece:null,
hintTarget:null,
completedSinceAd:0,
fullscreenUnavailable:false,
rewardedUnavailable:false,
sdk:null,
sdkStarted:false,
save:null
};
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function defaultSave(){
return{
version:3,
progress:{easy:Array(20).fill(false),medium:Array(20).fill(false),hard:Array(20).fill(false)},
totalCompleted:0,
best:{},
lastDifficulty:"easy",
lastLevel:0
};
}
function loadLocal(){
try{
const raw=localStorage.getItem(SAVE_KEY);
if(!raw)return defaultSave();
const parsed=JSON.parse(raw);
const base=defaultSave();
return{
...base,...parsed,
progress:{
easy:Array.isArray(parsed.progress?.easy)?[...parsed.progress.easy,...Array(20).fill(false)].slice(0,20):base.progress.easy,
medium:Array.isArray(parsed.progress?.medium)?[...parsed.progress.medium,...Array(20).fill(false)].slice(0,20):base.progress.medium,
hard:Array.isArray(parsed.progress?.hard)?[...parsed.progress.hard,...Array(20).fill(false)].slice(0,20):base.progress.hard
},
best:parsed.best||{}
};
}catch{return defaultSave()}
}
function saveLocal(){
try{localStorage.setItem(SAVE_KEY,JSON.stringify(state.save))}catch{}
}
async function cloudSave(){
saveLocal();
if(!state.sdk?.player?.isAuthorized)return;
try{
await fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({player:state.sdk.player,save:state.save})});
}catch{}
}
async function cloudLoad(){
if(!state.sdk?.player?.isAuthorized)return;
try{
const r=await fetch(`/api/save?playerId=${encodeURIComponent(state.sdk.player.id)}`);
if(!r.ok)return;
const data=await r.json();
if(data?.save){
state.save={...state.save,...data.save,progress:{...state.save.progress,...data.save.progress}};
saveLocal();
}
}catch{}
}
function showScreen(id){
document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
$(id).classList.add("active");
}
function imagePreload(){
const promises=[];
for(let i=1;i<=IMAGE_COUNT;i++){
promises.push(new Promise(resolve=>{
const img=new Image();
img.onload=resolve;
img.onerror=resolve;
img.src=IMAGE_PATH(i);
}));
}
return Promise.all(promises);
}
async function boot(){
state.save=loadLocal();
const images=imagePreload();
let sdkPromise=Promise.race([window.pikabuSDKReady,sleep(4500).then(()=>null)]);
const sdk=await sdkPromise;
state.sdk=sdk;
await images;
if(state.sdk){
try{
if(state.sdk.ads?.preloader?.isSupported&&state.sdk.ads.preloader.isSupported()){
if(state.sdk.ads.preloader.canShow&&state.sdk.ads.preloader.canShow())await state.sdk.ads.preloader.show();
}
}catch{}
}
startSDK();
$("bootStatus").textContent="Готово";
await sleep(250);
showScreen("menuScreen");
renderMenu();
}
function startSDK(){
if(state.sdk&&!state.sdkStarted){
try{state.sdk.gameStarted();state.sdkStarted=true}catch{}
}
}
function renderMenu(){
if(state.save.totalCompleted>0)$("profileButton").textContent="♙";
}
function openLevels(difficulty){
state.difficulty=difficulty;
state.save.lastDifficulty=difficulty;
state.size=DIFFICULTIES[difficulty].size;
$("levelsTitle").textContent=DIFFICULTIES[difficulty].name;
$("levelsDifficulty").textContent=DIFFICULTIES[difficulty].name.toUpperCase();
renderLevels();
showScreen("levelsScreen");
}
function renderLevels(){
const progress=state.save.progress[state.difficulty];
$("levelsCompleted").textContent=progress.filter(Boolean).length;
const grid=$("levelsGrid");
grid.innerHTML="";
for(let i=0;i<20;i++){
const unlocked=i===0||progress[i-1];
const card=document.createElement("button");
card.type="button";
card.className=`level-card${progress[i]?" completed":""}${!unlocked?" locked":""}${!progress[i]&&unlocked?" current":""}`;
card.disabled=!unlocked;
card.innerHTML=`<div class="level-thumb"></div><div class="level-number">${i+1}</div><div class="level-lock">${progress[i]?"✓":unlocked?"→":"🔒"}</div>`;
card.querySelector(".level-thumb").style.backgroundImage=`url("${IMAGE_PATH(i+1)}")`;
if(unlocked)card.addEventListener("click",()=>startLevel(i));
grid.appendChild(card);
}
}
function shuffleArray(arr){
const a=[...arr];
for(let i=a.length-1;i>0;i--){
const j=Math.floor(Math.random()*(i+1));
[a[i],a[j]]=[a[j],a[i]];
}
return a;
}
function startLevel(level){
state.level=level;
state.size=DIFFICULTIES[state.difficulty].size;
state.moves=0;
state.seconds=0;
state.paused=false;
state.locked=false;
state.selected=null;
state.hintPiece=null;
state.hintTarget=null;
const total=state.size*state.size;
let board;
do{board=shuffleArray(Array.from({length:total},(_,i)=>i))}while(board.every((v,i)=>v===i));
state.board=board;
$("gameLevel").textContent=level+1;
$("movesValue").textContent="0";
$("timeValue").textContent="00:00";
$("piecesValue").textContent=total;
$("gameProgress").style.width=`${((level+1)/20)*100}%`;
$("hintButton").disabled=false;
showScreen("gameScreen");
renderBoard();
startTimer();
}
function renderBoard(){
const board=$("puzzleBoard");
board.innerHTML="";
board.style.gridTemplateColumns=`repeat(${state.size},1fr)`;
board.style.gridTemplateRows=`repeat(${state.size},1fr)`;
state.board.forEach((pieceId,pos)=>{
const cell=document.createElement("button");
cell.type="button";
cell.className="puzzle-piece";
cell.dataset.position=pos;
cell.dataset.piece=pieceId;
const row=Math.floor(pieceId/state.size);
const col=pieceId%state.size;
const p=state.size;
cell.style.backgroundImage=`url("${IMAGE_PATH(state.level+1)}")`;
cell.style.backgroundSize=`${p*100}% ${p*100}%`;
cell.style.backgroundPosition=`${(col*100)/(p-1)}% ${(row*100)/(p-1)}%`;
if(state.selected===pos)cell.classList.add("selected");
if(state.hintPiece===pos)cell.classList.add("hint-piece");
if(state.hintTarget===pos)cell.classList.add("hint-target");
cell.addEventListener("click",()=>selectPiece(pos));
board.appendChild(cell);
});
}
async function selectPiece(position){
if(state.locked||state.paused)return;
if(state.selected===null){
state.selected=position;
renderBoard();
return;
}
if(state.selected===position){
state.selected=null;
renderBoard();
return;
}
const first=state.selected;
const second=position;
state.locked=true;
document.querySelectorAll(".puzzle-piece").forEach(el=>{
const p=Number(el.dataset.position);
if(p===first||p===second)el.classList.add("swap-anim");
});
await sleep(180);
[state.board[first],state.board[second]]=[state.board[second],state.board[first]];
state.moves++;
state.selected=null;
state.hintPiece=null;
state.hintTarget=null;
$("movesValue").textContent=state.moves;
renderBoard();
state.locked=false;
if(isSolved())await completeLevel();
}
function isSolved(){
return state.board.every((piece,pos)=>piece===pos);
}
function startTimer(){
stopTimer();
state.timer=setInterval(()=>{
if(!state.paused&&!state.locked){
state.seconds++;
$("timeValue").textContent=formatTime(state.seconds);
}
},1000);
}
function stopTimer(){
if(state.timer){clearInterval(state.timer);state.timer=null}
}
function formatTime(seconds){
const m=String(Math.floor(seconds/60)).padStart(2,"0");
const s=String(seconds%60).padStart(2,"0");
return`${m}:${s}`;
}
async function completeLevel(){
state.locked=true;
stopTimer();
const key=`${state.difficulty}_${state.level}`;
const old=state.save.best[key];
if(!old||state.seconds<old.time)state.save.best[key]={time:state.seconds,moves:state.moves};
if(!state.save.progress[state.difficulty][state.level]){
state.save.progress[state.difficulty][state.level]=true;
state.save.totalCompleted++;
}
saveLocal();
cloudSave();
$("resultMoves").textContent=state.moves;
$("resultTime").textContent=formatTime(state.seconds);
$("resultTitle").textContent=getResultTitle();
$("resultSubtitle").textContent=getResultSubtitle();
$("nextLevelButton").textContent=state.level<19?"Следующий уровень →":"К уровням";
$("resultModal").classList.add("active");
state.completedSinceAd++;
}
function getResultTitle(){
if(state.moves<=state.size*state.size*1.5)return"Идеально!";
if(state.seconds<30)return"Молниеносно!";
if(state.moves<=state.size*state.size*3)return"Отлично!";
return"Готово!";
}
function getResultSubtitle(){
if(state.moves<=state.size*state.size*1.5)return"Очень точная сборка";
if(state.seconds<30)return"Ты собрал картинку невероятно быстро";
return"Картинка полностью собрана";
}
async function closeResultAndContinue(){
$("resultModal").classList.remove("active");
if(state.level<19){
state.locked=false;
startLevel(state.level+1);
await tryFullscreenAd();
}else{
state.locked=false;
openLevels(state.difficulty);
}
}
async function tryFullscreenAd(){
if(state.completedSinceAd<3||state.fullscreenUnavailable)return;
const ad=state.sdk?.ads?.fullscreen;
if(!ad?.isSupported||!ad.isSupported()){
state.fullscreenUnavailable=true;
return;
}
try{
if(!ad.canShow||!ad.canShow())return;
state.paused=true;
const result=await ad.show();
state.paused=false;
if(result?.success!==false)state.completedSinceAd=0;
}catch{
state.paused=false;
}
}
async function showHint(){
if(state.locked||state.paused||state.hintPiece!==null)return;
const ad=state.sdk?.ads?.rewarded;
if(!ad?.isSupported||!ad.isSupported()){
state.rewardedUnavailable=true;
showToast("Подсказка сейчас недоступна");
return;
}
try{
if(!ad.canShow||!ad.canShow()){
showToast("Подсказка сейчас недоступна");
return;
}
state.paused=true;
const result=await ad.show();
state.paused=false;
if(result?.reward!==true){
showToast("Награда не получена");
return;
}
applyHint();
}catch{
state.paused=false;
showToast("Не удалось показать рекламу");
}
}
function applyHint(){
let wrong=-1;
for(let i=0;i<state.board.length;i++){
if(state.board[i]!==i){wrong=i;break}
}
if(wrong<0)return;
const piece=state.board[wrong];
const target=piece;
state.hintPiece=wrong;
state.hintTarget=target;
renderBoard();
showToast("Выделенная деталь должна оказаться на подсвеченном месте");
setTimeout(()=>{
if(state.hintPiece===wrong){
state.hintPiece=null;
state.hintTarget=null;
renderBoard();
}
},4200);
}
function showToast(text){
const toast=$("hintToast");
toast.textContent=text;
toast.classList.add("active");
clearTimeout(showToast.timer);
showToast.timer=setTimeout(()=>toast.classList.remove("active"),3500);
}
function openSource(){
$("sourceImage").src=IMAGE_PATH(state.level+1);
$("sourceModal").classList.add("active");
}
function closeSource(){$("sourceModal").classList.remove("active")}
function pauseGame(){
if(state.locked)return;
state.paused=true;
$("pauseModal").classList.add("active");
}
function resumeGame(){
state.paused=false;
$("pauseModal").classList.remove("active");
}
function exitToLevels(){
stopTimer();
state.paused=false;
state.locked=false;
$("pauseModal").classList.remove("active");
$("resultModal").classList.remove("active");
openLevels(state.difficulty);
}
function openProfile(){
renderProfile();
$("profileModal").classList.add("active");
}
function renderProfile(){
const player=state.sdk?.player;
$("profileName").textContent=player?.isAuthorized&&player.name?player.name:"Игрок";
$("profileStatus").textContent=player?.isAuthorized?"Облачное сохранение включено":"Локальный прогресс";
const completed=state.save.totalCompleted;
const percent=Math.round((completed/60)*100);
$("overallProgress").textContent=`${percent}%`;
$("overallProgressBar").style.width=`${percent}%`;
$("authBlock").style.display=player?.isAuthorized?"none":"block";
const wrap=$("achievements");
wrap.innerHTML="";
ACHIEVEMENTS.forEach(a=>{
const unlocked=a.check(state.save);
const el=document.createElement("div");
el.className=`achievement${unlocked?" unlocked":""}`;
el.innerHTML=`<div class="achievement-icon">${a.icon}</div><div class="achievement-name">${a.name}</div>`;
wrap.appendChild(el);
});
}
async function auth(){
if(!state.sdk?.auth?.openAuthDialog)return;
try{
await state.sdk.auth.openAuthDialog();
await cloudLoad();
renderProfile();
}catch{}
}
function handleVisibility(){
if(document.hidden&&$("gameScreen").classList.contains("active")&&!state.locked){
state.paused=true;
$("pauseModal").classList.add("active");
}
}
document.addEventListener("visibilitychange",handleVisibility);
window.addEventListener("blur",()=>{
if($("gameScreen").classList.contains("active")&&!state.locked){
state.paused=true;
$("pauseModal").classList.add("active");
}
});
document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("dragstart",e=>e.preventDefault());
document.addEventListener("selectstart",e=>e.preventDefault());
document.addEventListener("gesturestart",e=>e.preventDefault());
document.addEventListener("touchmove",e=>{if(e.cancelable)e.preventDefault()},{passive:false});
document.querySelectorAll(".difficulty-card").forEach(card=>card.addEventListener("click",()=>openLevels(card.dataset.difficulty)));
$("levelsBackButton").addEventListener("click",()=>showScreen("menuScreen"));
$("gameBackButton").addEventListener("click",exitToLevels);
$("pauseButton").addEventListener("click",pauseGame);
$("resumeButton").addEventListener("click",resumeGame);
$("pauseExitButton").addEventListener("click",exitToLevels);
$("sourceButton").addEventListener("click",openSource);
$("originalButton").addEventListener("click",openSource);
$("sourceCloseButton").addEventListener("click",closeSource);
$("hintButton").addEventListener("click",showHint);
$("profileButton").addEventListener("click",openProfile);
$("profileCloseButton").addEventListener("click",()=>$("profileModal").classList.remove("active"));
$("authButton").addEventListener("click",auth);
$("nextLevelButton").addEventListener("click",closeResultAndContinue);
$("resultLevelsButton").addEventListener("click",()=>{
$("resultModal").classList.remove("active");
openLevels(state.difficulty);
});
$("sourceModal").addEventListener("click",e=>{if(e.target===$("sourceModal"))closeSource()});
$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))$("profileModal").classList.remove("active")});
$("pauseModal").addEventListener("click",e=>{if(e.target===$("pauseModal"))resumeGame()});
$("resultModal").addEventListener("click",e=>e.stopPropagation());
if(window.PkbSDK)window.setTimeout(initSDK,0);
boot();