/* app.js (shortened version same logic) */
const $=q=>document.querySelector(q);
let chart; const state={pair:"",tf:"1H",rows:[]};
function parseCSV(t){const L=t.trim().split(/\r?\n/);const h=L.shift().split(",").map(s=>s.trim().toLowerCase());
const idx={time:h.indexOf("time"),open:h.indexOf("open"),high:h.indexOf("high"),low:h.indexOf("low"),close:h.indexOf("close"),volume:h.indexOf("volume")};
if(Object.values(idx).some(v=>v===-1))throw new Error("Kolom wajib: time,open,high,low,close,volume");
return L.map(l=>{const c=l.split(",").map(x=>x.trim());return{time:c[idx.time],open:+c[idx.open],high:+c[idx.high],low:+c[idx.low],close:+c[idx.close],volume:+c[idx.volume]}}).filter(r=>Number.isFinite(r.close));}
function EMA(v,p){const k=2/(p+1);const o=[];let e=v[0];for(let i=0;i<v.length;i++){const x=v[i];e=i===0?x:(x-e)*k+e;o.push(e)}return o}
function SMA(v,p){const o=[];let s=0;for(let i=0;i<v.length;i++){s+=v[i];if(i>=p)s-=v[i-p];o.push(i>=p-1?s/p:NaN)}return o}
function RSI(c,p=14){const g=[],l=[];for(let i=1;i<c.length;i++){const d=c[i]-c[i-1];g.push(Math.max(0,d));l.push(Math.max(0,-d))}const ag=SMA(g,p),al=SMA(l,p),r=[NaN];
for(let i=p;i<c.length;i++){const G=ag[i-1]??0,L=al[i-1]??0;const rs=L===0?100:G/L;r.push(100-(100/(1+rs)))}return r}
function MACD(c,fa=12,sl=26,si=9){const ef=EMA(c,fa),es=EMA(c,sl);const m=ef.map((v,i)=>v-es[i]);const sig=EMA(m.slice(sl-1),si);const pad=Array(sl-1).fill(NaN);
const s=pad.concat(sig);const h=m.map((v,i)=>v-(s[i]??NaN));return{macd:m,signal:s,hist:h}}
function TR(h,l,pc){return Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc))}
function ATR(r,p=14){const t=[];for(let i=0;i<r.length;i++){if(i===0)t.push(r[i].high-r[i].low);else t.push(TR(r[i].high,r[i].low,r[i-1].close))}return SMA(t,p)}
function swing(rows,i,L=2,R=2,dir="low"){if(dir==="low"){for(let k=1;k<=L;k++){if(rows[i-k]?.low===undefined||rows[i-k].low<rows[i].low)return false}
for(let k=1;k<=R;k++){if(rows[i+k]?.low===undefined||rows[i+k].low<=rows[i].low)return false}return true}
for(let k=1;k<=L;k++){if(rows[i-k]?.high===undefined||rows[i-k].high>rows[i].high)return false}
for(let k=1;k<=R;k++){if(rows[i+k]?.high===undefined||rows[i+k].high>=rows[i].high)return false}return true}
function SR(rows){const s=[],r=[];for(let i=2;i<rows.length-2;i++){if(swing(rows,i,2,2,"low"))s.push({level:rows[i].low,i});if(swing(rows,i,2,2,"high"))r.push({level:rows[i].high,i})}
const last=rows.at(-1)?.close??0;const tol=last*0.01;const merge=(a)=>{a.sort((a,b)=>a.level-b.level);const out=[];for(const x of a){if(!out.length||Math.abs(x.level-out.at(-1).level)>tol)out.push(x)}return out};return{supports:merge(s),resistances:merge(r)}}
function signal(rows){if(rows.length<60)return {side:"NEUTRAL",trend:"Sideways",price:rows.at(-1)?.close??0,reason:["Data minim"],confidence:50};
const c=rows.map(r=>r.close), e20=EMA(c,20), e50=EMA(c,50), rsi=RSI(c,14), m=MACD(c), a=ATR(rows,14), sr=SR(rows);
const i=rows.length-1, price=c[i]; const trend=e20[i]>e50[i]?"Uptrend":(e20[i]<e50[i]?"Downtrend":"Sideways");
let side="NEUTRAL", reason=["Tidak konfluens"]; const hist=m.hist[i], macdNow=m.macd[i], sigNow=m.signal[i];
if(trend==="Uptrend"&&rsi[i]>45&&macdNow>sigNow&&hist>0){side="BUY";reason=["EMA20>EMA50, RSI>45, MACD>Signal"]}
else if(trend==="Downtrend"&&rsi[i]<55&&macdNow<sigNow&&hist<0){side="SELL";reason=["EMA20<EMA50, RSI<55, MACD<Signal"]}
const atr=a[i]; const sl= side==="BUY"? price-1.5*atr : side==="SELL"? price+1.5*atr : null;
const tp1= side==="BUY"? price+1.5*atr : side==="SELL"? price-1.5*atr : null;
const tp2= side==="BUY"? price+2.5*atr : side==="SELL"? price-2.5*atr : null;
const conf=(()=>{let x=50;if(side==="NEUTRAL")return 50;if((trend==="Uptrend"&&side==="BUY")||(trend==="Downtrend"&&side==="SELL"))x+=10;
if(Math.sign(hist)===(side==="BUY"?1:-1))x+=10; return Math.max(10,Math.min(95,x))})();
return {price,side,trend,rsi:Number(rsi[i]?.toFixed(2)),macd:Number(macdNow?.toFixed(4)),macdSignal:Number(sigNow?.toFixed(4)),hist:Number(hist?.toFixed(4)),atr:Number(atr?.toFixed(4)),
sl:sl?Number(sl.toFixed(4)):null,tp1:tp1?Number(tp1.toFixed(4)):null,tp2:tp2?Number(tp2.toFixed(4)):null,
nearestSupports:sr.supports.filter(s=>s.level<=price).slice(-2).map(x=>+x.level.toFixed(4)),
nearestResistances:sr.resistances.filter(r=>r.level>=price).slice(0,2).map(x=>+x.level.toFixed(4)),
confidence:conf,reason};}
function render(rows, sig){
  const ctx=$("#chart"); const labels=rows.map(r=>r.time), price=rows.map(r=>r.close);
  if(chart) chart.destroy(); chart=new Chart(ctx,{type:"line",data:{labels,datasets:[{label:"Close",data:price,borderWidth:1.5,pointRadius:0,tension:.15}]},
  options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#cdd4df"}}},scales:{x:{ticks:{color:"#9aa3b2"},grid:{color:"#1e2431"}},y:{ticks:{color:"#9aa3b2"},grid:{color:"#1e2431"}}}}});
  const box=document.createElement("div"); box.className="item";
  box.innerHTML = `📊 Pair/TF: <b>${state.pair||"-"}</b> • <b>${state.tf}</b><br>
  💡 Sinyal: <b>${sig.side}</b> • Tren: <b>${sig.trend}</b> • Price: <b>${sig.price}</b><br>
  ⛔ SL: <b>${sig.sl??"-"}</b> • 🎯 TP1: <b>${sig.tp1??"-"}</b> • TP2: <b>${sig.tp2??"-"}</b><br>
  🔒 Confidence: <b>${sig.confidence}%</b><br>
  🧱 Support: <b>${sig.nearestSupports.join(", ")||"-"}</b> • Resistance: <b>${sig.nearestResistances.join(", ")||"-"}</b><br>
  🔎 Alasan: ${sig.reason.join("; ")}`;
  $("#signals").innerHTML=""; $("#signals").appendChild(box);
  const payload={pair:state.pair,timeframe:state.tf,last_price:sig.price,trend:sig.trend,plan:{side:sig.side,sl:sig.sl,tp:[sig.tp1,sig.tp2]},levels:{supports:sig.nearestSupports,resistances:sig.nearestResistances},confidence:sig.confidence};
  $("#prompt").value=`Analisa & validasi rencana trading berikut, beri perbaikan jika perlu:\n${JSON.stringify(payload,null,2)}\n\nKembalikan output dengan format tabel ENTRY/SL/TP + skenario alternatif jika trend berbalik.`;
}
function process(){
  state.pair=$("#pair").value.trim()||"PAIR/USDT"; state.tf=$("#tf").value.trim()||"1H";
  const rows=parseCSV($("#csv").value); state.rows=rows; const sig=signal(rows); render(rows,sig);
}
$("#file").addEventListener("change", async (e)=>{const f=e.target.files?.[0]; if(!f) return; $("#csv").value=await f.text();});
$("#parse").addEventListener("click", process);
$("#demo").addEventListener("click", ()=>{$("#pair").value="TRB/USDT"; $("#tf").value="1H"; $("#csv").value=`time,open,high,low,close,volume
2025-10-30 08:00,410,420,405,418,1200
2025-10-30 09:00,418,425,415,422,1300
2025-10-30 10:00,422,430,420,429,1400
2025-10-30 11:00,429,435,426,432,1150
2025-10-30 12:00,432,438,428,436,1500
2025-10-30 13:00,436,441,433,438,1600
2025-10-30 14:00,438,444,436,442,1250
2025-10-30 15:00,442,448,440,447,1800
2025-10-30 16:00,447,452,444,449,1750
2025-10-30 17:00,449,455,446,454,1620
2025-10-30 18:00,454,459,451,458,1510
2025-10-30 19:00,458,462,455,460,1490
2025-10-30 20:00,460,466,457,465,1610
2025-10-30 21:00,465,470,462,468,1730
2025-10-30 22:00,468,472,465,471,1680
2025-10-30 23:00,471,476,468,475,1590
2025-10-31 00:00,475,480,472,479,1700
2025-10-31 01:00,479,485,476,483,1820
2025-10-31 02:00,483,488,480,486,1760
2025-10-31 03:00,486,491,483,489,1690
2025-10-31 04:00,489,494,486,492,1610
2025-10-31 05:00,492,498,489,497,1750
2025-10-31 06:00,497,503,494,501,1710
2025-10-31 07:00,501,506,498,505,1685`;});
$("#clear").addEventListener("click", ()=>{$("#csv").value=""; $("#signals").innerHTML=""; $("#prompt").value=""; if(window.chart) window.chart.destroy();});
$("#copy").addEventListener("click", async ()=>{await navigator.clipboard.writeText($("#prompt").value); alert("Prompt disalin. Paste ke ChatGPT untuk validasi.");});
$("#share").addEventListener("click", async ()=>{const text=$("#prompt").value; if(navigator.share){try{await navigator.share({text})}catch(e){}} else {await navigator.clipboard.writeText(text); alert("Prompt disalin (Web Share tak tersedia).");}});
const statusEl=document.getElementById("status"); function setStatus(){statusEl.textContent=navigator.onLine?"Online":"Offline"}; window.addEventListener("online",setStatus); window.addEventListener("offline",setStatus); setStatus();
if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{});});}
