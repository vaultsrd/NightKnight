import { Chess } from "https://esm.sh/chess.js@1.4.0";

const $ = id => document.getElementById(id);
const chess = new Chess();
let history = [{fen:chess.fen(), san:null, uci:null}], cursor=0, selected=null, legalMoves=[], flipped=false, engine=null, engineReady=false, engineBusy=false, analysisToken=0, lastInfo=null, currentArrows=[];
const files="abcdefgh", glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const startFen=chess.fen();
function msg(text,error=false){$("importMessage").textContent=text;$("importMessage").classList.toggle("error",error)}
function current(){return history[cursor]}
function setFen(fen){chess.load(fen)}
function squareName(row,col){return files[col]+(8-row)}
function displaySquare(row,col){return flipped?[7-row,7-col]:[row,col]}
function renderBoard(){
 const board=$("board");board.innerHTML=""; const pos=chess.board(), last=current().uci;
 const lastFrom=last?.slice(0,2),lastTo=last?.slice(2,4);
 legalMoves=chess.moves({square:selected||undefined,verbose:true});
 const destinations=new Set(legalMoves.filter(m=>m.from===selected).map(m=>m.to));
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const [pr,pc]=displaySquare(r,c), sq=squareName(pr,pc), piece=pos[pr][pc], el=document.createElement("button");
  el.className="square "+((pr+pc)%2===0?"light":"dark");el.type="button";el.dataset.square=sq;el.setAttribute("role","gridcell");el.setAttribute("aria-label",sq+(piece?` ${piece.color==="w"?"putih":"hitam"} ${piece.type}`:""));
  if(sq===selected)el.classList.add("selected");if(sq===lastFrom||sq===lastTo)el.classList.add("last");if(destinations.has(sq))el.classList.add(piece?"capture":"legal");
  if((!flipped&&pc===0)||(flipped&&pc===7)){const coord=document.createElement("span");coord.className="coord";coord.textContent=8-pr;el.append(coord)}
  if(piece){const p=document.createElement("span");p.className="piece "+(piece.color==="w"?"white":"black");p.textContent=glyph[piece.color+piece.type];el.append(p)}
  if((!flipped&&pr===7)||(flipped&&pr===0)){const coord=document.createElement("span");coord.className="coord";coord.style.left="auto";coord.style.top="auto";coord.style.right="3px";coord.style.bottom="2px";coord.textContent=files[pc];el.append(coord)}
  el.addEventListener("click",()=>onSquare(sq));el.draggable=!!piece;el.addEventListener("dragstart",e=>{if(piece){selected=sq;e.dataTransfer.setData("text/plain",sq);renderBoard()}});el.addEventListener("dragover",e=>e.preventDefault());el.addEventListener("drop",e=>{e.preventDefault();const from=e.dataTransfer.getData("text/plain");if(from)makeMove(from,sq)});
  board.append(el);
 }
 renderArrows();renderMeta();
}
function renderArrows(){
 const area=document.querySelector(".board-area");area.querySelector(".arrow-overlay")?.remove();if(!currentArrows.length)return;
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 800 800");svg.classList.add("arrow-overlay");
 currentArrows.slice(0,3).forEach((uci,i)=>{if(!uci||uci.length<4)return;const xy=s=>{let f=files.indexOf(s[0]),r=8-Number(s[1]);if(flipped){f=7-f;r=7-r}return{x:f*100+50,y:r*100+50}};const a=xy(uci.slice(0,2)),b=xy(uci.slice(2,4));const line=document.createElementNS(svg.namespaceURI,"line");line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",a.x+(b.x-a.x)*.72);line.setAttribute("y2",a.y+(b.y-a.y)*.72);if(i===1)line.classList.add("second");if(i===2)line.classList.add("third");svg.append(line)});area.append(svg);
}
function renderMeta(){
 $("turnLabel").textContent=chess.isGameOver()?"Partai selesai":(chess.turn()==="w"?"Putih melangkah":"Hitam melangkah");
 $("positionLabel").textContent=cursor===0?"Posisi awal":`Langkah ${cursor} / ${history.length-1}`;
 $("lastMove").textContent=cursor?`${Math.ceil(cursor/2)}${cursor%2?".":"…"} ${current().san}`:"—";
 $("checkLabel").textContent=chess.isCheck()?"SKAK":chess.isCheckmate()?"SKAKMAT":"";
 $("moveCount").textContent=`${cursor} ply`;
 $("prevBtn").disabled=cursor===0;$("startBtn").disabled=cursor===0;$("nextBtn").disabled=cursor>=history.length-1;$("endBtn").disabled=cursor>=history.length-1;
 renderHistory();
}
function renderHistory(){
 const box=$("moveHistory");box.innerHTML="";if(!cursor){box.innerHTML='<div class="empty-state">Langkah akan muncul di sini.</div>';return}
 for(let i=1;i<=cursor;i+=2){const num=document.createElement("div");num.className="move-num";num.textContent=Math.ceil(i/2)+".";box.append(num);for(let j=i;j<=Math.min(i+1,cursor);j++){const cell=document.createElement("div");cell.className="move-cell"+(j===cursor?" active":"");cell.textContent=history[j].san;cell.title="Klik untuk menuju posisi ini";cell.addEventListener("click",()=>go(j));box.append(cell)}if(i+1>cursor){const blank=document.createElement("div");blank.className="move-cell";box.append(blank)}}
 box.scrollTop=box.scrollHeight;
}
function go(n){cursor=Math.max(0,Math.min(n,history.length-1));chess.load(history[cursor].fen);selected=null;currentArrows=[];renderBoard();analyze()}
function makeMove(from,to,promotion="q"){
 if(cursor<history.length-1)history=history.slice(0,cursor+1);
 const move=chess.move({from,to,promotion});if(!move){msg("Langkah ilegal. Pilih tujuan yang ditandai.",true);return false}
 history.push({fen:chess.fen(),san:move.san,uci:move.from+move.to+(move.promotion||"")});cursor++;selected=null;currentArrows=[];msg("Langkah dimainkan.");renderBoard();analyze();return true;
}
function onSquare(sq){
 if(engineBusy&&false)return;
 const piece=chess.get(sq);
 if(selected){if(selected===sq){selected=null;renderBoard();return}const possible=chess.moves({square:selected,verbose:true}).filter(m=>m.to===sq);if(possible.length){let promo="q";if(possible.some(m=>m.promotion)){const choice=prompt("Promosi menjadi: q (menteri), r (benteng), b (gajah), n (kuda)","q");promo=["q","r","b","n"].includes((choice||"q").toLowerCase())?(choice||"q").toLowerCase():"q"}makeMove(selected,sq,promo);return}}
 if(piece&&piece.color===chess.turn()){selected=sq;renderBoard()}else{selected=null;renderBoard()}
}
function parseUci(uci){return {from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}}
function pvToSan(pv,fen){try{const temp=new Chess(fen);return pv.trim().split(/\s+/).slice(0,12).map(u=>{const m=parseUci(u);const x=temp.move(m);return x?x.san:null}).filter(Boolean).join(" ")||"—"}catch{return "—"}}
function scoreString(score){if(!score)return "0.00";if(score.mate!==undefined)return (score.mate>0?"+#":"−#")+Math.abs(score.mate);return (score.cp>0?"+":"")+ (score.cp/100).toFixed(2)}
function updateAnalysisUI(info){
 lastInfo=info;$("depthValue").textContent=info.depth||0;$("evalScore").textContent=scoreString(info.score);$("evalPerspective").textContent=info.score?.mate!==undefined?"Skakmat dalam jumlah langkah":"Sudut pandang Putih";
 const cp=info.score?.cp??(info.score?.mate>0?1000:info.score?.mate<0?-1000:0);const white=Math.max(3,Math.min(97,50+cp/12));$("evalFill").style.height=white+"%";
 const list=info.lines||[];const wrap=$("candidates");wrap.innerHTML="";
 if(!list.length){wrap.innerHTML='<div class="empty-state">Menunggu hasil engine…</div>';return}
 list.slice(0,Number($("linesSelect").value)).forEach((line,i)=>{const row=document.createElement("div");row.className="candidate"+(!i?" best":"");const rank=document.createElement("span");rank.className="rank";rank.textContent=String(i+1).padStart(2,"0");const pv=document.createElement("span");pv.className="pv";pv.textContent=pvToSan(line.pv,current().fen);const score=document.createElement("span");score.className="score";score.textContent=scoreString(line.score);row.append(rank,pv,score);row.title="Klik untuk melihat jalur kandidat";row.addEventListener("click",()=>{const uci=line.pv?.split(/\s+/)[0];if(uci){const m=parseUci(uci);currentArrows=[uci];renderBoard();msg("Panah menunjukkan langkah kandidat. Klik kotak untuk bermain.")}});wrap.append(row)});
 currentArrows=list.slice(0,3).map(x=>x.pv?.split(/\s+/)[0]).filter(Boolean);renderArrows();
}
function analyze(){
 if(!engineReady||!engine)return;const token=++analysisToken;engineBusy=true;$("analysisState").textContent="Menganalisis…";engine.postMessage("stop");engine.postMessage("position fen "+chess.fen());engine.postMessage("setoption name MultiPV value "+$("linesSelect").value);engine.postMessage("go depth "+$("depthSelect").value);activeToken=token;
}
let activeToken=0, engineLines=new Map();
function initEngine(){
 const candidates=[
  "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js",
  "https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js"
 ];
 // Stockfish's official browser distribution is hosted by jsDelivr; use its single-thread WASM build.
 const url="https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js";
 try{
  engine=new Worker(url);engine.onmessage=e=>onEngineMessage(String(e.data));engine.onerror=()=>{engineReady=false;$("engineStatus").textContent="Engine gagal dimuat";$("engineBadge").textContent="OFFLINE";msg("Stockfish tidak berhasil dimuat. Pastikan internet aktif dan CDN tidak diblokir.",true)};
  engine.postMessage("uci");
 }catch(e){$("engineStatus").textContent="Engine gagal dimuat";msg("Browser tidak dapat memulai Web Worker Stockfish.",true)}
}
function onEngineMessage(line){
 if(line==="uciok"){engine.postMessage("setoption name Threads value 1");engine.postMessage("setoption name Hash value 64");engine.postMessage("isready");return}
 if(line==="readyok"){engineReady=true;$("engineStatus").textContent="Stockfish siap";$("engineStatus").parentElement.classList.add("ready");$("engineBadge").textContent="WASM READY";analyze();return}
 if(line.startsWith("info ")&&line.includes(" depth ")){
  const depth=Number(line.match(/\bdepth (\d+)/)?.[1]||0);if(depth<Number($("depthSelect").value)){}
  const multipv=Number(line.match(/\bmultipv (\d+)/)?.[1]||1);const cp=line.match(/\bscore cp (-?\d+)/),mate=line.match(/\bscore mate (-?\d+)/),pv=line.match(/\bpv (.+)$/);
  if(!pv)return;const turn=chess.turn();let score=cp?{cp:Number(cp[1])}:mate?{mate:Number(mate[1])}:{cp:0};
  // UCI scores are from the side-to-move perspective; normalize to White.
  if(turn==="b"){if(score.cp!==undefined)score.cp=-score.cp;if(score.mate!==undefined)score.mate=-score.mate}
  engineLines.set(multipv,{depth,score,pv:pv[1]});const lines=[...engineLines.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);updateAnalysisUI({depth,score:lines[0]?.score,lines});
  $("analysisState").textContent=`Depth ${depth}`;return;
 }
 if(line.startsWith("bestmove")){engineBusy=false;$("analysisState").textContent="Analisis selesai"}
}
$("flipBtn").addEventListener("click",()=>{flipped=!flipped;renderBoard()});
$("startBtn").addEventListener("click",()=>go(0));$("prevBtn").addEventListener("click",()=>go(cursor-1));$("nextBtn").addEventListener("click",()=>go(cursor+1));$("endBtn").addEventListener("click",()=>go(history.length-1));
$("undoBtn").addEventListener("click",()=>{if(cursor)go(cursor-1)});$("resetBtn").addEventListener("click",()=>{chess.reset();history=[{fen:chess.fen(),san:null,uci:null}];cursor=0;selected=null;currentArrows=[];renderBoard();analyze();msg("Papan direset.")});
$("depthSelect").addEventListener("change",()=>{engineLines.clear();analyze()});$("linesSelect").addEventListener("change",()=>{engineLines.clear();analyze()});
$("loadFenBtn").addEventListener("click",()=>{try{const temp=new Chess();temp.load($("fenInput").value.trim());chess.load(temp.fen());history=[{fen:chess.fen(),san:null,uci:null}];cursor=0;selected=null;currentArrows=[];renderBoard();analyze();msg("FEN berhasil dimuat.")}catch(e){msg("FEN tidak valid: "+e.message,true)}});
$("loadPgnBtn").addEventListener("click",()=>{try{const temp=new Chess();const pgn=$("pgnInput").value.trim();if(!pgn)throw Error("Masukkan teks PGN terlebih dahulu.");temp.loadPgn(pgn);const sans=temp.history();const replay=new Chess();const next=[{fen:replay.fen(),san:null,uci:null}];for(const san of sans){const move=replay.move(san);if(!move)throw Error("Ada langkah ilegal di PGN.");next.push({fen:replay.fen(),san:move.san,uci:move.from+move.to+(move.promotion||"")})}chess.load(next[next.length-1].fen);history=next;cursor=history.length-1;selected=null;currentArrows=[];renderBoard();analyze();msg(`PGN berhasil dimuat · ${sans.length} ply.`)}catch(e){msg("PGN tidak valid: "+e.message,true)}});
function makePgn(){const temp=new Chess();let pgn='[Event "NightKnight Analysis"]\n[Site "GitHub Pages"]\n[Result "*"]\n\n';for(let i=1;i<history.length;i++){temp.load(history[i-1].fen);const san=history[i].san;if(i%2===1)pgn+=`${Math.ceil(i/2)}. `;pgn+=san+" ";}return pgn.trim()+" *\n"}
$("copyPgnBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(makePgn());msg("PGN disalin ke clipboard.")}catch{ $("pgnInput").value=makePgn();msg("Clipboard dibatasi browser; PGN disiapkan di kolom impor.")}});
$("downloadPgnBtn").addEventListener("click",()=>{const blob=new Blob([makePgn()],{type:"application/x-chess-pgn"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="nightknight-game.pgn";a.click();URL.revokeObjectURL(a.href)});
renderBoard();initEngine();
