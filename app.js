(()=>{"use strict";
const $=s=>document.querySelector(s), screen=$("#screen"), modal=$("#modal"), detail=$("#detail"), player=$("#player"), video=$("#video");
let catalog={items:[]}, view="home", selected=null, activeFilter="Todos", searchTerm="", focusIndex=0, gridLimit=48, lastFocus=null, adminUnlocked=false, adminEditingId=null, adminListQuery="";
const store={get(k){try{return JSON.parse(localStorage.getItem("xuper_"+k)||"[]")}catch(e){return[]}},set(k,v){try{localStorage.setItem("xuper_"+k,JSON.stringify(v))}catch(e){toast("No hay espacio para guardar este cambio.")}}};
const favorites=()=>store.get("favorites"), history=()=>store.get("history");
const safe=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const readAdminOverrides=()=>{try{const value=JSON.parse(localStorage.getItem("xuper_admin_overrides")||"{}");return value&&!Array.isArray(value)&&typeof value==="object"?value:{}}catch(e){return {}}};
const items=()=>{const overrides=readAdminOverrides(),hidden=store.get("admin_hidden");return [...(catalog.items||[]),...store.get("admin_items")].filter(x=>!hidden.includes(String(x.id))).map(x=>Object.assign({},x,overrides[String(x.id)]||{}))};
const adminPassword=()=>{try{return localStorage.getItem("xuper_admin_password")||"123456789"}catch(e){return "123456789"}};
/* Cliente del adaptador de portal. El navegador VIDAA no puede ejecutar
   módulos Node (crypto/https/dns); la comunicación del portal va por un
   servicio HTTPS propio configurado en Ajustes. */
const portalConfig={get(){try{return localStorage.getItem("xuper_portal_api")||""}catch(e){return""}},set(v){try{localStorage.setItem("xuper_portal_api",v.replace(/\/+$/,""))}catch(e){}}};
const portalApi={
 base(){return portalConfig.get().replace(/\/+$/,"")},
 async request(path){const base=this.base();if(!base)throw new Error("Configura la URL del servicio de portal en Ajustes.");const r=await fetch(base+path,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("Servicio de portal: HTTP "+r.status);const d=await r.json();if(d&&d.error)throw new Error(d.error);return d},
 async resolve(item){const d=await this.request("/api/resolve?id="+encodeURIComponent(item.id)+"&seriesId="+encodeURIComponent(item.seriesId||""));if(d&&typeof d.url==="string"&&d.url.charAt(0)==="/")d.url=this.base()+d.url;return d},
 async detail(item){return this.request("/api/detail?id="+encodeURIComponent(item.id))},
 async health(){return this.request("/api/health")}
};

const isMovie=x=>/pel[ií]cula|movie/i.test((x.kind||"")+" "+(x.type||""));
const isSeries=x=>/serie|series|teleplay/i.test((x.kind||"")+" "+(x.type||""));
const navNames={home:"Inicio",live:"TV en vivo",movies:"Películas",series:"Series",kids:"Infantil",anime:"Anime",favorites:"Favoritos",history:"Historial",search:"Buscar",settings:"Ajustes",admin:"Administrador"};
function poster(x){let src=x.poster||x.landscape||x.backdrop||"";return src?`<img loading="lazy" src="${safe(src)}" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('beforeend','<div class=\\'fallback\\'>${safe(x.title)}</div>')">`:`<div class="fallback">${safe(x.title)}</div>`}
function card(x){return `<button class="poster" data-id="${safe(x.id)}" aria-label="${safe(x.title)}">${poster(x)}<span class="label">${safe(x.year&&x.year!=="—"?x.year:x.kind||"XuperTV")}</span></button>`}
function row(title,list,tag){if(!list.length)return"";return `<div class="section-head"><h2>${safe(title)}</h2><small>${list.length} títulos</small></div><div class="row-scroll">${list.slice(0,30).map(card).join("")}</div>`}
function allRows(){let rows=[...new Set(items().map(x=>x.row).filter(Boolean))];return rows}
function bindCards(){document.querySelectorAll("[data-id]").forEach(b=>b.addEventListener("click",()=>openDetail(items().find(x=>String(x.id)===b.dataset.id))))}
function renderHome(){
 const featured=items().filter(x=>x.category==="destacado").slice(0,8);
 const movies=items().filter(isMovie), series=items().filter(isSeries), kids=items().filter(x=>x.kind==="infantil"), anime=items().filter(x=>x.kind==="anime");
 screen.innerHTML=`<div class="hero"><div class="hero-content"><div class="eyebrow">TU ENTRETENIMIENTO EN UN SOLO LUGAR</div><h1>XuperTV</h1><p>Películas, series, anime y contenido familiar. Explora el catálogo integrado de las versiones Roku y webOS.</p><div class="actions"><button class="primary" id="goMovies">Explorar películas</button><button class="secondary" id="goSeries">Ver series</button></div></div></div>
 ${row("Destacados",featured)}${row("Películas",movies)}${row("Series",series)}${row("Infantil",kids)}${row("Anime",anime)}
 <div class="subtle" style="font-size:12px;margin:8px 0">Catálogo integrado: ${items().length} fichas · Última captura del portal: ${safe(catalog.portalSnapshotDate||"sin fecha")}</div>`;
 $("#goMovies").onclick=()=>navigate("movies");$("#goSeries").onclick=()=>navigate("series");bindCards();
}
function categoryChips(list){let cats=["Todos",...new Set(list.flatMap(x=>(x.genres||[]).filter(Boolean)))].slice(0,24);return `<div class="filterbar">${cats.map(c=>`<button class="chip ${c===activeFilter?"active":""}" data-filter="${safe(c)}">${safe(c)}</button>`).join("")}</div>`}
function renderGrid(title,list,filterable=true){
 let filtered=activeFilter==="Todos"?list:list.filter(x=>(x.genres||[]).includes(activeFilter));
 let visible=filtered.slice(0,gridLimit);
 screen.innerHTML=`<h1 class="page-title">${safe(title)}</h1><div class="subtle">Mostrando ${visible.length} de ${filtered.length} títulos</div>${filterable?categoryChips(list):""}<div class="grid">${visible.map(card).join("")}</div>${visible.length<filtered.length?`<div class="more-wrap"><button class="secondary" id="loadMore">Cargar más títulos</button></div>`:""}`;
 document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;gridLimit=48;renderGrid(title,list,filterable)});
 const more=$("#loadMore");if(more)more.onclick=()=>{gridLimit+=48;renderGrid(title,list,filterable);const firstNew=screen.querySelectorAll("[data-id]")[visible.length];if(firstNew)firstNew.focus()};
 bindCards();
}
function navigate(v){view=v;activeFilter="Todos";gridLimit=48;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===v));$("#crumb").textContent=navNames[v].toUpperCase();
 if(v==="home")renderHome();
 else if(v==="movies")renderGrid("Películas",items().filter(isMovie));
 else if(v==="series")renderGrid("Series",items().filter(isSeries));
 else if(v==="kids")renderGrid("Infantil",items().filter(x=>x.kind==="infantil"||/kid|infantil|niño/i.test(x.category||"")));
 else if(v==="anime")renderGrid("Anime",items().filter(x=>x.kind==="anime"||/anime/i.test((x.category||"")+" "+(x.row||""))));
 else if(v==="favorites")renderGrid("Mis favoritos",items().filter(x=>favorites().includes(String(x.id))),false);
 else if(v==="history")renderGrid("Continuar viendo",items().filter(x=>history().includes(String(x.id))),false);
 else if(v==="search")renderSearch();
 else if(v==="live")renderLive();
 else if(v==="settings")renderSettings();
 else if(v==="admin")renderAdmin();
}
function renderSearch(){screen.innerHTML=`<h1 class="page-title">Buscar</h1><p class="subtle">Busca entre las películas, series, anime y contenido infantil del catálogo.</p><input id="searchInput" class="searchbox" type="text" placeholder="Escribe el nombre de una película o serie…" autocomplete="off"><div id="searchResults"></div>`;
 const input=$("#searchInput");input.addEventListener("input",()=>{searchTerm=input.value.trim().toLocaleLowerCase();let res=searchTerm?items().filter(x=>(x.title+" "+(x.alias||"")+" "+(x.genres||[]).join(" ")).toLocaleLowerCase().includes(searchTerm)).slice(0,120):[];$("#searchResults").innerHTML=res.length?`<div class="section-head"><h2>Resultados</h2><small>${res.length} coincidencias</small></div><div class="grid">${res.map(card).join("")}</div>`:searchTerm?`<div class="empty">No encontramos coincidencias.</div>`:"";bindCards()});}
function parseM3U(text){
 const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/),channels=[];
 let meta=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line)continue;
  if(line.indexOf("#EXTINF:")===0){
   const comma=line.indexOf(","),header=comma>=0?line.slice(0,comma):line;
   const attr=function(key){const match=header.match(new RegExp("(?:^|\\s)"+key+"=[\"']([^\"']*)[\"']","i"));return match?match[1]:""};
   meta={name:comma>=0?line.slice(comma+1).trim():"",logo:attr("tvg-logo"),group:attr("group-title")||"Otros"};
  }else if(line.charAt(0)!=="#"&&/^https?:\/\//i.test(line)){
   channels.push({name:meta&&meta.name?meta.name:"Canal "+(channels.length+1),logo:meta&&meta.logo?meta.logo:"",group:meta&&meta.group?meta.group:"Otros",url:line});
   meta=null;
  }
 }
 return channels;
}
function renderLive(){
 let channels=[];
 try{const saved=JSON.parse(localStorage.getItem("xuper_live_channels")||"[]");if(Array.isArray(saved))channels=saved}catch(e){}
 const groups=["Todos"];channels.forEach(function(c){const g=c.group||"Otros";if(groups.indexOf(g)<0)groups.push(g)});
 screen.innerHTML='<h1 class="page-title">TV en vivo</h1>'+
 '<div class="setting" style="display:block"><div class="eyebrow">TU LISTA DE CANALES</div><h2 style="margin:10px 0">Agregar lista M3U / M3U8</h2>'+
 '<p class="subtle" style="line-height:1.5">Selecciona un archivo de tu computadora o memoria USB. También puedes pegar una URL pública de una lista.</p>'+
 '<input id="liveFile" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" style="display:none">'+
 '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0">'+
 '<button type="button" class="primary" id="chooseLiveFile">Seleccionar archivo M3U</button>'+
 '<input id="liveUrl" class="searchbox" type="url" placeholder="https://servidor/lista.m3u" style="flex:1;min-width:220px;width:auto;font-size:15px;padding:12px">'+
 '<button type="button" class="secondary" id="loadLiveUrl">Cargar URL</button>'+
 (channels.length?'<button type="button" class="secondary" id="clearLive">Eliminar lista</button>':'')+'</div>'+
 '<div id="liveStatus" class="subtle">'+(channels.length?channels.length+' canales guardados en este dispositivo.':'Todavía no has agregado una lista.')+'</div></div>'+
 (channels.length?'<div class="section-head"><h2>Canales</h2><small>'+channels.length+' disponibles</small></div>'+
 '<input id="liveSearch" class="searchbox" type="search" placeholder="Buscar canal..." style="font-size:15px;padding:12px">'+
 '<div id="liveGroups" class="filterbar">'+groups.map(function(g,i){return '<button type="button" class="chip '+(i===0?'active':'')+'" data-live-group="'+safe(g)+'">'+safe(g)+'</button>'}).join("")+'</div>'+
 '<div id="liveChannels" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px;padding-bottom:30px"></div>':
 '<div class="empty" style="margin-top:18px">Después de cargar tu archivo, los canales aparecerán aquí.</div>');
 const status=$("#liveStatus"),file=$("#liveFile");
 $("#chooseLiveFile").onclick=function(){file.click()};
 function showChannels(){
  const search=$("#liveSearch"),term=search?search.value.toLocaleLowerCase():"",host=$("#liveChannels");if(!host)return;
  const filtered=channels.filter(function(ch){return(activeGroup==="Todos"||(ch.group||"Otros")===activeGroup)&&(ch.name||"").toLocaleLowerCase().indexOf(term)>=0});
  host.innerHTML=filtered.length?filtered.map(function(ch){return '<button type="button" class="secondary live-channel-entry" data-live-index="'+channels.indexOf(ch)+'" style="min-height:76px;display:flex;align-items:center;gap:10px;text-align:left;padding:12px;overflow:hidden">'+
   (ch.logo?'<img src="'+safe(ch.logo)+'" alt="" style="width:42px;height:42px;object-fit:contain" onerror="this.style.display=\\'none\\'">':'<span style="font-size:22px;color:#35c9f4">▶</span>')+
   '<span style="min-width:0;overflow:hidden"><strong style="display:block;white-space:normal">'+safe(ch.name)+'</strong><small style="display:block;color:#9baac0;margin-top:5px">'+safe(ch.group||"Otros")+'</small></span></button>'}).join(""):'<div class="empty">No hay canales en esta categoría o búsqueda.</div>';
  host.querySelectorAll("[data-live-index]").forEach(function(btn){btn.onclick=function(){const ch=channels[Number(btn.getAttribute("data-live-index"))];if(ch)play({id:"live_"+btn.getAttribute("data-live-index"),title:ch.name,streamUrl:ch.url})}});
 }
 let activeGroup="Todos";
 function importText(text){
  const parsed=parseM3U(text);
  if(!parsed.length){status.textContent="No se encontraron canales con enlaces HTTP/HTTPS. Comprueba que el archivo tenga formato M3U.";return}
  try{localStorage.setItem("xuper_live_channels",JSON.stringify(parsed));toast("Lista M3U cargada: "+parsed.length+" canales");renderLive()}
  catch(e){status.textContent="No se pudo guardar la lista: el almacenamiento está lleno."}
 }
 file.onchange=function(){
  const selectedFile=file.files&&file.files[0];if(!selectedFile)return;
  status.textContent="Leyendo "+selectedFile.name+"...";
  if(typeof FileReader!=="undefined"){
   const reader=new FileReader();
   reader.onload=function(){importText(reader.result||"")};
   reader.onerror=function(){status.textContent="No se pudo leer el archivo. Intenta guardarlo como UTF-8."};
   reader.readAsText(selectedFile);
  }else if(selectedFile.text){
   selectedFile.text().then(importText).catch(function(){status.textContent="No se pudo leer el archivo seleccionado."});
  }else{status.textContent="Este navegador no permite leer archivos locales."}
 };
 $("#loadLiveUrl").onclick=async function(){
  const url=$("#liveUrl").value.trim();
  if(!/^https?:\/\//i.test(url)){status.textContent="Escribe una URL http:// o https:// válida.";return}
  status.textContent="Descargando lista...";
  try{const response=await fetch(url);if(!response.ok)throw new Error("HTTP "+response.status);importText(await response.text())}
  catch(e){status.textContent="No se pudo descargar la URL. Puede estar bloqueada por CORS; en ese caso usa Seleccionar archivo M3U."}
 };
 if(channels.length){
  showChannels();
  document.querySelectorAll("[data-live-group]").forEach(function(btn){btn.onclick=function(){activeGroup=btn.getAttribute("data-live-group");document.querySelectorAll("[data-live-group]").forEach(function(x){x.classList.toggle("active",x===btn)});showChannels()}});
  $("#liveSearch").oninput=showChannels;
 }
 const clear=$("#clearLive");if(clear)clear.onclick=function(){if(confirm("¿Eliminar la lista M3U guardada en este dispositivo?")){localStorage.removeItem("xuper_live_channels");renderLive()}};
}
function renderSettings(){screen.innerHTML=`<h1 class="page-title">Ajustes</h1><p class="subtle">Conexión con el servicio de portal</p><div class="settings">
<div class="setting"><strong>Servicio XuperTV</strong><span>Introduce la dirección HTTPS de tu propio adaptador Node. VIDAA ejecuta la interfaz HTML5; la autenticación, cifrado 3DES y solicitudes al portal deben ejecutarse fuera del navegador.</span><input id="portalApiUrl" class="searchbox" style="font-size:15px;margin-top:12px;width:100%" placeholder="https://tu-servidor.example" value="${safe(portalConfig.get())}"><div class="actions"><button class="primary" id="savePortalApi">Guardar y probar</button><span id="portalStatus" class="subtle"></span></div></div>
<div class="setting"><strong>Catálogo local</strong><span>${items().length} fichas de respaldo. El servicio conectado puede resolver reproducción mediante el endpoint /api/resolve.</span></div>
<div class="setting"><strong>Compatibilidad VIDAA</strong><span>Se envía al reproductor HTML5 la URL que devuelve el servicio. El formato (MP4/HLS), CORS y HTTPS deben ser compatibles con el firmware del televisor.</span></div>
<div class="setting"><strong>Privacidad</strong><span>La dirección del servicio se guarda solo en este televisor. No se importan ni reutilizan sesiones o tokens compartidos de terceros.</span></div>
</div>`;
$("#savePortalApi").onclick=async()=>{const v=$("#portalApiUrl").value.trim();if(!/^https:\/\//i.test(v)){toast("Usa una dirección HTTPS válida.");return}portalConfig.set(v);$("#portalStatus").textContent="Probando…";try{const h=await portalApi.health();$("#portalStatus").textContent="Conectado"+(h.version?" · "+h.version:"");toast("Servicio conectado.");}catch(e){$("#portalStatus").textContent="Sin conexión: "+e.message;toast("No se pudo conectar al servicio.");}};}
function openDetail(x){if(!x)return;lastFocus=document.activeElement;selected=x;let fav=favorites().includes(String(x.id));detail.innerHTML=`<button class="close" id="closeDetail">✕</button>${x.poster?`<img class="detail-poster" src="${safe(x.poster)}" onerror="this.style.opacity='.15'">`:`<div class="detail-poster"></div>`}<div class="detail-info"><div class="eyebrow">${safe(x.kind||"CONTENIDO")} · XUPERTV</div><h2>${safe(x.title)}</h2><div class="meta">${safe(x.year||"Año no disponible")}　·　${safe(x.duration||"Duración no disponible")}　·　★ ${safe(x.score||"—")}</div><div class="meta">${safe((x.genres||[]).join(" · "))}</div><p>${safe(x.synopsis||"Sinopsis no disponible en la captura del catálogo.")}</p><p class="subtle">Dirección: ${safe(x.director||"—")}<br>Reparto: ${safe(x.actors||"—")}</p><div class="actions"><button class="primary" id="playItem">${x.streamUrl?"▶ Reproducir":"▶ Ver opciones"}</button><button class="secondary" id="favItem">${fav?"♥ Quitar de favoritos":"♡ Añadir a favoritos"}</button></div></div>`;
 modal.classList.remove("hidden");$("#closeDetail").onclick=closeDetail;$("#closeDetail").focus();$("#favItem").onclick=()=>{let f=favorites(),id=String(x.id);f=f.includes(id)?f.filter(a=>a!==id):[...f,id];store.set("favorites",f);$("#favItem").textContent=f.includes(id)?"♥ Quitar de favoritos":"♡ Añadir a favoritos";toast(f.includes(id)?"Añadido a favoritos":"Eliminado de favoritos")};$("#playItem").onclick=async()=>{if(x.streamUrl){play(x);return}const b=$("#playItem");b.disabled=true;b.textContent="Conectando…";try{const d=await portalApi.resolve(x);const url=d.url||d.streamUrl||d.playUrl;if(!url)throw new Error("El servicio no devolvió una URL de reproducción.");play(Object.assign({},x,{streamUrl:url}));}catch(e){toast(e.message||"No se pudo resolver la reproducción.");}finally{b.disabled=false;b.textContent="▶ Intentar reproducir"}};}
function closeDetail(){modal.classList.add("hidden");selected=null;if(lastFocus&&lastFocus.focus)lastFocus.focus()}
function play(x){closeDetail();player.classList.remove("hidden");$("#playerTitle").textContent=x.title;$("#playerMsg").textContent="";video.src=x.streamUrl;video.play().catch(()=>$("#playerMsg").textContent="No se pudo iniciar: revisa conexión o formato.");let h=history().filter(a=>a!==String(x.id));h.unshift(String(x.id));store.set("history",h.slice(0,100))}
function closePlayer(){video.pause();video.removeAttribute("src");video.load();player.classList.add("hidden")}
$("#closePlayer").onclick=closePlayer;
function toast(s){let t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function clock(){let d=new Date();$("#clock").textContent=d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}
function focusables(){return [...document.querySelectorAll("button:not(:disabled),input")].filter(x=>x.offsetParent!==null)}
function moveFocus(dir){let els=focusables();if(!els.length)return;let cur=document.activeElement,idx=els.indexOf(cur);if(idx<0){els[0].focus();return}
 let rect=cur.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,candidates=els.map((e,i)=>{if(i===idx)return null;let r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,dx=x-cx,dy=y-cy;let primary=dir==="left"?-dx:dir==="right"?dx:dir==="up"?-dy:dy;if(primary<=0)return null;let secondary=(dir==="left"||dir==="right")?Math.abs(dy):Math.abs(dx);return {e,score:primary+secondary*2+secondary*secondary/Math.max(primary,1),primary}}).filter(Boolean).sort((a,b)=>a.score-b.score);if(candidates[0])candidates[0].e.focus()}
document.addEventListener("keydown",e=>{
 const code=e.keyCode||e.which||0;
 const key=e.key||"";
 const back=(key==="Escape"||key==="Backspace"||key==="BrowserBack"||code===8||code===27||code===10009||code===461);
 if(!player.classList.contains("hidden")){if(back){e.preventDefault();closePlayer()}return}
 if(!modal.classList.contains("hidden")){if(back){e.preventDefault();closeDetail()}return}
 const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",Left:"left",Right:"right",Up:"up",Down:"down"};
 const dir=map[key]||(code===37?"left":code===39?"right":code===38?"up":code===40?"down":null);
 if(dir){e.preventDefault();moveFocus(dir)}
 else if(back){e.preventDefault();if(view!=="home")navigate("home")}
 else if((key==="Enter"||code===13)&&document.activeElement&&document.activeElement.tagName==="BUTTON"){e.preventDefault();document.activeElement.click()}
});
document.addEventListener("focusin",e=>{const el=e.target;if(el&&el.scrollIntoView){try{el.scrollIntoView({block:"nearest",inline:"nearest"})}catch(_){}}});
video.addEventListener("error",()=>{if(!player.classList.contains("hidden"))$("#playerMsg").textContent="Formato o enlace no compatible con este televisor."});

$("#nav").addEventListener("click",e=>{let b=e.target;while(b&&b!==e.currentTarget&&!b.dataset.view)b=b.parentNode;if(b&&b.dataset&&b.dataset.view)navigate(b.dataset.view)});
window.addEventListener("load",()=>{fetch("data/catalog.json").then(r=>r.json()).then(d=>{catalog=d;navigate("home")}).catch(()=>{screen.innerHTML='<div class="empty">No se pudo cargar el catálogo local.</div>'})});
setInterval(clock,1000);clock();
})();
