/* BLOE Signal v3 Client — CSV + Screenshot + Online AI via proxy */
const $ = (q)=>document.querySelector(q);
let chart;
const state = { rows:[], pair:"", tf:"1H", lastSig:null, shotDataUrl:null };

function onStatus(){ $("#status").textContent = navigator.onLine? "Online":"Offline"; }
addEventListener("online", onStatus); addEventListener("offline", onStatus); onStatus();

// Tabs
for(const t of document.querySelectorAll(".tab")){
  t.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=> x.classList.remove("active"));
    t.classList.add("active");
    document.querySelectorAll(".panel").forEach(x=> x.classList.remove("active"));
    $("#panel-"+t.dataset.tab).classList.add("active");
  });
}

// CSV utils
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map(s=> s.trim().toLowerCase());
  const idx = {time:header.indexOf("time"), open:header.indexOf("open"), high:header.indexOf("high"), low:header.indexOf("low"), close:header.indexOf("close"), volume:header.indexOf("volume")};
  if(Object.values(idx).some(v=> v===-1)) throw new Error("Kolom wajib: time,open,high,low,close,volume");
  return lines.map(line=>{
    const c = line.split(",").map(x=> x.trim());
    return { time:c[idx.time], open:+c[idx.open], high:+c[idx.high], low:+c[idx.low], close:+c[idx.close], volume:+c[idx.volume] };
  }).filter(r=> Number.isFinite(r.close));
}
function EMA(values, period){ const k = 2/(period+1); const out=[]; let ema = values[0]; for(let i=0;i<values.length;i++){ const v=values[i]; ema = (i===0)? v : (v-ema)*k + ema; out.push(ema) } return out; }
function SMA(values, period){ const out=[]; let sum=0; for(let i=0;i<values.length;i++){ sum+=values[i]; if(i>=period) sum-=values[i-period]; out.push(i>=period-1? sum/period : NaN) } return out; }
function RSI(closes, p=14){ const gains=[], losses=[]; for(let i=1;i<closes.length;i++){ const d=closes[i]-closes[i-1]; gains.push(Math.max(0,d)); losses.push(Math.max(0,-d)); } const ag=SMA(gains,p), al=SMA(losses,p);
  const out=[NaN]; for(let i=p;i<closes.length;i++){ const G=ag[i-1]??0, L=al[i-1]??0; const rs = L===0? 100 : G/L; out.push(100 - (100/(1+rs))) } return out; }
function MACD(closes, f=12, s=26, sig=9){ const ef=EMA(closes,f), es=EMA(closes,s); const m=ef.map((v,i)=> v-es[i]); const sigArr = EMA(m.slice(s-1), sig); const pad = Array(s-1).fill(NaN);
  const sl = pad.concat(sigArr); const h = m.map((v,i)=> v - (sl[i]??NaN)); return {macd:m, signal:sl, hist:h}; }
function TR(h,l,pc){ return Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)); }
function ATR(rows, p=14){ const trs=[]; for(let i=0;i<rows.length;i++){ if(i===0) trs.push(rows[i].high-rows[i].low); else trs.push(TR(rows[i].high, rows[i].low, rows[i-1].close)); } return SMA(trs,p); }
function swing(rows,i,L=2,R=2,dir="low"){ if(dir==="low"){ for(let k=1;k<=L;k++){ if(rows[i-k]?.low===undefined || rows[i-k].low<rows[i].low) return false } for(let k=1;k<=R;k++){ if(rows[i+k]?.low===undefined || rows[i+k].low<=rows[i].low) return false } return true }
  for(let k=1;k<=L;k++){ if(rows[i-k]?.high===undefined || rows[i-k].high>rows[i].high) return false } for(let k=1;k<=R;k++){ if(rows[i+k]?.high===undefined || rows[i+k].high>=rows[i].high) return false } return true; }
function SR(rows){ const s=[], r=[]; for(let i=2;i<rows.length-2;i++){ if(swing(rows,i,2,2,"low")) s.push({level:rows[i].low,i}); if(swing(rows,i,2,2,"high")) r.push({level:rows[i].high,i}); }
  const last = rows.at(-1)?.close ?? 0; const tol = last*0.01; const merge = (arr)=>{ arr.sort((a,b)=> a.level-b.level); const out=[]; for(const x of arr){ if(!out.length || Math.abs(x.level - out.at(-1).level) > tol) out.push(x); } return out; };
  return { supports: merge(s), resistances: merge(r) }; }

function generateSignal(rows){
  if(rows.length < 60) return { side:"NEUTRAL", trend:"Sideways", reason:["Data terlalu sedikit"], confidence:50, price: rows.at(-1)?.close ?? 0 };
  const closes = rows.map(r=> r.close);
  const e20 = EMA(closes, 20), e50 = EMA(closes, 50);
  const rsi = RSI(closes, 14), macd = MACD(closes), atr = ATR(rows, 14), sr = SR(rows);
  const i = rows.length-1; const price = closes[i];
  const trend = e20[i] > e50[i] ? "Uptrend" : (e20[i] < e50[i] ? "Downtrend" : "Sideways");
  let side = "NEUTRAL", reason = ["Tidak konfluens"];
  const hist = macd.hist[i], macdNow = macd.macd[i], sigNow = macd.signal[i];
  if(trend==="Uptrend" && rsi[i]>45 && macdNow>sigNow && hist>0){ side="BUY"; reason=["EMA20>EMA50, RSI>45, MACD>Signal"]; }
  else if(trend==="Downtrend" && rsi[i]<55 && macdNow<sigNow && hist<0){ side="SELL"; reason=["EMA20<EMA50, RSI<55, MACD<Signal"]; }
  const a = atr[i];
  const sl = side==="BUY"? price-1.5*a : side==="SELL"? price+1.5*a : null;
  const tp1 = side==="BUY"? price+1.5*a : side==="SELL"? price-1.5*a : null;
  const tp2 = side==="BUY"? price+2.5*a : side==="SELL"? price-2.5*a : null;
  const conf = (()=>{ let c=50; if(side==="NEUTRAL") return 50; if((trend==="Uptrend"&&side==="BUY")||(trend==="Downtrend"&&side==="SELL")) c+=10; if(Math.sign(hist)===(side==="BUY"?1:-1)) c+=10; return Math.max(10,Math.min(95,c)); })();
  return {
    price, side, trend, rsi: Number(rsi[i]?.toFixed(2)), macd: Number(macdNow?.toFixed(4)), macdSignal: Number(sigNow?.toFixed(4)), hist: Number(hist?.toFixed(4)), atr: Number(a?.toFixed(4)),
    sl: sl? Number(sl.toFixed(4)) : null, tp1: tp1? Number(tp1.toFixed(4)) : null, tp2: tp2? Number(tp2.toFixed(4)) : null,
    nearestSupports: sr.supports.filter(s=> s.level <= price).slice(-2).map(x=> +x.level.toFixed(4)),
    nearestResistances: sr.resistances.filter(r=> r.level >= price).slice(0,2).map(x=> +x.level.toFixed(4)),
    confidence: conf, reason
  };
}

function render(rows, sig){
  const ctx=$("#chart"); const labels = rows.map(r=> r.time), price = rows.map(r=> r.close);
  if(chart) chart.destroy();
  chart = new Chart(ctx, { type:"line", data:{ labels, datasets:[{ label:"Close", data:price, borderWidth:1.4, pointRadius:0, tension:.15 }]},
    options:{ animation:false, responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:"#cdd4df" } } }, scales:{ x:{ ticks:{ color:"#9bb0d0" }, grid:{ color:"#1a2548" } }, y:{ ticks:{ color:"#9bb0d0" }, grid:{ color:"#1a2548" } } } } });
  const box = $("#signalBox");
  box.innerHTML = `📊 Pair/TF: <b>${state.pair||"-"}</b> • <b>${state.tf}</b><br>
  💡 Sinyal: <b>${sig.side}</b> • Tren: <b>${sig.trend}</b> • Price: <b>${sig.price}</b> • 🔒 Confidence: <b>${sig.confidence}%</b><br>
  ⛔ SL: <b>${sig.sl??"-"}</b> • 🎯 TP1: <b>${sig.tp1??"-"}</b> • TP2: <b>${sig.tp2??"-"}</b><br>
  🧱 Support: <b>${sig.nearestSupports.join(", ")||"-"}</b> • Resistance: <b>${sig.nearestResistances.join(", ")||"-"}</b><br>
  🔎 Alasan: ${sig.reason.join("; ")}`;
}

// Chat helpers
function addBubble(text, who="ai"){
  const el = document.createElement("div");
  el.className = "bubble " + (who==="me"?"me":"ai");
  el.innerText = text;
  $("#chat").appendChild(el);
  $("#chat").scrollTop = $("#chat").scrollHeight;
}

async function postToAI(messages, extra={}){
  const url = $("#apiUrl").value.trim();
  if(!url){ alert("Isi Server Proxy URL dulu."); return; }
  addBubble("Menghubungkan ke AI...", "ai");
  const res = await fetch(url, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ messages, extra }) });
  if(!res.ok){
    addBubble("Gagal menghubungkan: " + res.status + " " + (await res.text()), "ai"); return;
  }
  const data = await res.json();
  addBubble(data.reply || "(kosong)", "ai");
}

function buildContext(sig){
  return {
    pair: state.pair, timeframe: state.tf, last_price: sig?.price, trend: sig?.trend,
    sl: sig?.sl, tp1: sig?.tp1, tp2: sig?.tp2, confidence: sig?.confidence,
    supports: sig?.nearestSupports, resistances: sig?.nearestResistances, notes: sig?.reason
  };
}

// CSV panel events
$("#file").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  $("#csv").value = await f.text();
});
$("#parse").addEventListener("click", ()=>{
  try{
    state.pair = $("#pair").value.trim() || "PAIR/USDT";
    state.tf = $("#tf").value.trim() || "1H";
    state.rows = parseCSV($("#csv").value);
    state.lastSig = generateSignal(state.rows);
    render(state.rows, state.lastSig);
  }catch(err){ alert("Gagal memproses CSV: " + err.message); }
});
$("#demo").addEventListener("click", ()=>{
  $("#pair").value = "TRB/USDT"; $("#tf").value = "1H";
  $("#csv").value = `time,open,high,low,close,volume
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
2025-10-31 07:00,501,506,498,505,1685`;
});
$("#clear").addEventListener("click", ()=>{
  $("#csv").value=""; $("#signalBox").innerHTML=""; if(chart) chart.destroy();
});
$("#sendContext").addEventListener("click", async ()=>{
  if(!state.lastSig){ alert("Belum ada analisis. Proses CSV dulu."); return; }
  const context = buildContext(state.lastSig);
  const msg = "Validasi & perbaiki rencana trading berikut (beri skenario alternatif/jika berbalik):\n" + JSON.stringify(context, null, 2);
  addBubble(msg, "me");
  await postToAI([{role:"user", content: msg}], { mode: "validate" });
});
$("#ask").addEventListener("click", async ()=>{
  const text = $("#userMsg").value.trim(); if(!text) return;
  $("#userMsg").value=""; addBubble(text, "me");
  await postToAI([{role:"user", content:text}], { mode: $("#mode").value });
});

// Screenshot panel events
$("#shot").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    state.shotDataUrl = reader.result;
    const img = $("#shotPreview");
    img.src = state.shotDataUrl; img.style.display = "block";
  };
  reader.readAsDataURL(f);
});
$("#sendShot").addEventListener("click", async ()=>{
  if(!state.shotDataUrl){ alert("Upload screenshot dulu."); return; }
  const pair = $("#spair").value.trim(); const tf = $("#stf").value.trim();
  const userText = `Baca screenshot chart trading berikut. Jika terlihat, identifikasi pair & timeframe. Ekstrak: arah trend, level Support/Resistance utama, pola candle penting, dan rekomendasi ENTRY/SL/TP berbasis konteks gambar. Jika ada indikator seperti EMA/RSI/MACD pada screenshot, gunakan sebagai konfirmasi. Formatkan rencana trade yang actionable + skenario jika berbalik.`;
  addBubble("[Screenshot dikirim ke AI Vision] " + (pair||"") + " " + (tf||""), "me");
  const content = [
    { type:"text", text: userText + (pair? `\nPair (opsional dari user): ${pair}`:"") + (tf? `\nTimeframe (opsional dari user): ${tf}`:"") },
    { type:"image_url", image_url: { url: state.shotDataUrl } }
  ];
  await postToAI([{ role:"user", content }], { mode:"vision" });
});

// PWA basic SW
if("serviceWorker" in navigator){ addEventListener("load", ()=>{ navigator.serviceWorker.register("./sw.js").catch(()=>{}); }); }
