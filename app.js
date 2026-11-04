(()=>{"use strict";
const $=s=>document.querySelector(s), screen=$("#screen"), modal=$("#modal"), detail=$("#detail"), player=$("#player"), video=$("#video");
let catalog={items:[]}, view="home", selected=null, activeFilter="Todos", searchTerm="", focusIndex=0;
const store={get(k){try{return JSON.parse(localStorage.getItem("xuper_"+k)||"[]")}catch(e){return[]}},set(k,v){localStorage.setItem("xuper_"+k,JSON.stringify(v))}};
const favorites=()=>store.get("favorites"), history=()=>store.get("history");
const safe=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const items=()=>catalog.items||[];
const isMovie=x=>/pel[ií]cula|movie/i.test((x.kind||"")+" "+(x.type||""));
const isSeries=x=>/serie|series|teleplay/i.test((x.kind||"")+" "+(x.type||""));
const navNames={home:"Inicio",live:"TV en vivo",movies:"Películas",series:"Series",kids:"Infantil",anime:"Anime",favorites:"Favoritos",history:"Historial",search:"Buscar",settings:"Ajustes"};
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
 screen.innerHTML=`<h1 class="page-title">${safe(title)}</h1><div class="subtle">${filtered.length} títulos disponibles en el catálogo</div>${filterable?categoryChips(list):""}<div class="grid">${filtered.map(card).join("")}</div>`;
 document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderGrid(title,list,filterable)});
 bindCards();
}
function navigate(v){view=v;activeFilter="Todos";document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===v));$("#crumb").textContent=navNames[v].toUpperCase();
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
}
function renderSearch(){screen.innerHTML=`<h1 class="page-title">Buscar</h1><p class="subtle">Busca entre las películas, series, anime y contenido infantil del catálogo.</p><input id="searchInput" class="searchbox" type="text" placeholder="Escribe el nombre de una película o serie…" autocomplete="off"><div id="searchResults"></div>`;
 const input=$("#searchInput");input.addEventListener("input",()=>{searchTerm=input.value.trim().toLocaleLowerCase();let res=searchTerm?items().filter(x=>(x.title+" "+(x.alias||"")+" "+(x.genres||[]).join(" ")).toLocaleLowerCase().includes(searchTerm)).slice(0,120):[];$("#searchResults").innerHTML=res.length?`<div class="section-head"><h2>Resultados</h2><small>${res.length} coincidencias</small></div><div class="grid">${res.map(card).join("")}</div>`:searchTerm?`<div class="empty">No encontramos coincidencias.</div>`:"";bindCards()});}
function renderLive(){screen.innerHTML=`<h1 class="page-title">TV en vivo</h1><div class="live-placeholder"><div class="box"><div class="eyebrow">TV EN VIVO</div><h2>La sección está preparada</h2><p>El proyecto Roku contiene la estructura de TV en vivo y el proyecto webOS contiene la integración de portal, pero los dos archivos recibidos no incluyen una lista de canales con direcciones de reproducción activas. La sesión de portal guardada tampoco contiene credenciales. No se mostrarán canales inventados ni enlaces que no estén en los archivos.</p><button class="secondary" id="backHome">Volver al inicio</button></div></div>`;$("#backHome").onclick=()=>navigate("home")}
function renderSettings(){screen.innerHTML=`<h1 class="page-title">Ajustes</h1><p class="subtle">Información de esta compilación</p><div class="settings">
<div class="setting"><strong>XuperTV para VIDAA · 1.0.0</strong><span>Interfaz HTML5 optimizada para pantallas 16:9 y navegación con control remoto.</span></div>
<div class="setting"><strong>Catálogo local</strong><span>${items().length} fichas combinadas desde las versiones Roku y webOS. Las imágenes remotas requieren conexión a internet.</span></div>
<div class="setting"><strong>Favoritos e historial</strong><span>Se guardan localmente en el almacenamiento del navegador de la aplicación.</span></div>
<div class="setting"><strong>Compatibilidad de reproducción</strong><span>Reproducción HTML5 para enlaces directos compatibles con el navegador VIDAA. HLS depende del soporte del firmware y del formato de origen.</span></div>
<div class="setting"><strong>Estado del portal</strong><span>La copia webOS incluye una instantánea anónima del catálogo, pero no credenciales de usuario ni URLs de reproducción para el contenido del portal.</span></div>
</div>`}
function openDetail(x){if(!x)return;selected=x;let fav=favorites().includes(String(x.id));detail.innerHTML=`<button class="close" id="closeDetail">✕</button>${x.poster?`<img class="detail-poster" src="${safe(x.poster)}" onerror="this.style.opacity='.15'">`:`<div class="detail-poster"></div>`}<div class="detail-info"><div class="eyebrow">${safe(x.kind||"CONTENIDO")} · XUPERTV</div><h2>${safe(x.title)}</h2><div class="meta">${safe(x.year||"Año no disponible")}　·　${safe(x.duration||"Duración no disponible")}　·　★ ${safe(x.score||"—")}</div><div class="meta">${safe((x.genres||[]).join(" · "))}</div><p>${safe(x.synopsis||"Sinopsis no disponible en la captura del catálogo.")}</p><p class="subtle">Dirección: ${safe(x.director||"—")}<br>Reparto: ${safe(x.actors||"—")}</p><div class="actions"><button class="primary" id="playItem">${x.streamUrl?"▶ Reproducir":"▶ Ver opciones"}</button><button class="secondary" id="favItem">${fav?"♥ Quitar de favoritos":"♡ Añadir a favoritos"}</button></div></div>`;
 modal.classList.remove("hidden");$("#closeDetail").onclick=closeDetail;$("#favItem").onclick=()=>{let f=favorites(),id=String(x.id);f=f.includes(id)?f.filter(a=>a!==id):[...f,id];store.set("favorites",f);$("#favItem").textContent=f.includes(id)?"♥ Quitar de favoritos":"♡ Añadir a favoritos";toast(f.includes(id)?"Añadido a favoritos":"Eliminado de favoritos")};$("#playItem").onclick=()=>{if(x.streamUrl)play(x);else toast("Esta ficha no incluye un enlace de reproducción en los archivos recibidos.")};}
function closeDetail(){modal.classList.add("hidden");selected=null}
function play(x){closeDetail();player.classList.remove("hidden");$("#playerTitle").textContent=x.title;$("#playerMsg").textContent="";video.src=x.streamUrl;video.play().catch(()=>$("#playerMsg").textContent="No se pudo iniciar: revisa conexión o formato.");let h=history().filter(a=>a!==String(x.id));h.unshift(String(x.id));store.set("history",h.slice(0,100))}
function closePlayer(){video.pause();video.removeAttribute("src");video.load();player.classList.add("hidden")}
$("#closePlayer").onclick=closePlayer;
function toast(s){let t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function clock(){let d=new Date();$("#clock").textContent=d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}
function focusables(){return [...document.querySelectorAll("button:not(:disabled),input")].filter(x=>x.offsetParent!==null)}
function moveFocus(dir){let els=focusables();if(!els.length)return;let cur=document.activeElement,idx=els.indexOf(cur);if(idx<0){els[0].focus();return}
 let rect=cur.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,candidates=els.map((e,i)=>{if(i===idx)return null;let r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,dx=x-cx,dy=y-cy;let primary=dir==="left"?-dx:dir==="right"?dx:dir==="up"?-dy:dy;if(primary<=0)return null;let secondary=(dir==="left"||dir==="right")?Math.abs(dy):Math.abs(dx);return {e,score:primary+secondary*2+secondary*secondary/Math.max(primary,1),primary}}).filter(Boolean).sort((a,b)=>a.score-b.score);if(candidates[0])candidates[0].e.focus()}
document.addEventListener("keydown",e=>{if(!player.classList.contains("hidden")){if(e.key==="Escape"||e.key==="Backspace"){e.preventDefault();closePlayer()}return}
 if(!modal.classList.contains("hidden")){if(e.key==="Escape"||e.key==="Backspace"){e.preventDefault();closeDetail()}return}
 const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"};if(map[e.key]){e.preventDefault();moveFocus(map[e.key])}
 else if(e.key==="Escape"||e.key==="Backspace"){e.preventDefault();if(view!=="home")navigate("home")}
 else if(e.key==="Enter"&&document.activeElement?.tagName==="BUTTON"){e.preventDefault();document.activeElement.click()}
});
$("#nav").addEventListener("click",e=>{let b=e.target.closest("[data-view]");if(b)navigate(b.dataset.view)});
window.addEventListener("load",()=>{fetch("data/catalog.json").then(r=>r.json()).then(d=>{catalog=d;navigate("home")}).catch(()=>{screen.innerHTML='<div class="empty">No se pudo cargar el catálogo local.</div>'})});
setInterval(clock,1000);clock();
})();