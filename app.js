(()=>{"use strict";
const $=s=>document.querySelector(s), screen=$("#screen"), modal=$("#modal"), detail=$("#detail"), player=$("#player"), video=$("#video");
let catalog={items:[]}, view="home", selected=null, activeFilter="Todos", searchTerm="", focusIndex=0, gridLimit=48, lastFocus=null, adminUnlocked=false, adminEditingId=null, adminListQuery="";
const store={get(k){try{return JSON.parse(localStorage.getItem("xuper_"+k)||"[]")}catch(e){return[]}},set(k,v){try{localStorage.setItem("xuper_"+k,JSON.stringify(v))}catch(e){toast("No hay espacio para guardar este cambio.")}}};
const favorites=()=>store.get("favorites"), history=()=>store.get("history");
const safe=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const items=()=>{const overrides=store.get("admin_overrides"),hidden=store.get("admin_hidden");return [...(catalog.items||[]),...store.get("admin_items")].filter(x=>!hidden.includes(String(x.id))).map(x=>Object.assign({},x,overrides[String(x.id)]||{}))};
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
function renderLive(){screen.innerHTML=`<h1 class="page-title">TV en vivo</h1><div class="live-placeholder"><div class="box"><div class="eyebrow">TV EN VIVO</div><h2>La sección está preparada</h2><p>El proyecto Roku contiene la estructura de TV en vivo y el proyecto webOS contiene la integración de portal, pero los dos archivos recibidos no incluyen una lista de canales con direcciones de reproducción activas. La sesión de portal guardada tampoco contiene credenciales. No se mostrarán canales inventados ni enlaces que no estén en los archivos.</p><button class="secondary" id="backHome">Volver al inicio</button></div></div>`;$("#backHome").onclick=()=>navigate("home")}

function renderAdmin(){
 if(!adminUnlocked){
  screen.innerHTML='<h1 class="page-title">Administrador</h1><div class="admin-card"><h2>Acceso de administrador</h2><p class="subtle">Inicia sesión para editar el catálogo.</p><form id="adminLogin" class="admin-form"><label>Usuario<input id="adminUser" class="searchbox" autocomplete="username" value="admin" required></label><label>Contraseña<input id="adminPass" class="searchbox" type="password" autocomplete="current-password" placeholder="Contraseña" required></label><button class="primary" type="submit">Iniciar sesión</button><div id="adminError" class="admin-error"></div></form></div>';
  $("#adminLogin").onsubmit=e=>{e.preventDefault();if($("#adminUser").value.trim()==="admin"&&$("#adminPass").value===adminPassword()){adminUnlocked=true;renderAdmin()}else $("#adminError").textContent="Usuario o contraseña incorrectos."};
  return;
 }
 const all=items();
 const own=store.get("admin_items");
 const filtered=all.filter(x=>(String(x.title||"")+" "+String(x.id||"")+" "+String(x.kind||"")+" "+String(x.category||"")).toLocaleLowerCase().includes(adminListQuery.toLocaleLowerCase())).slice(0,200);
 const editing=adminEditingId?all.find(x=>String(x.id)===String(adminEditingId)):null;
 const editForm=editing?'<div class="admin-card" id="adminEditor"><h2>Editar: '+safe(editing.title)+'</h2><form id="editContent" class="admin-form admin-grid">'+
 '<label>Título<input id="eTitle" class="searchbox" required maxlength="160"></label>'+
 '<label>Tipo<select id="eType" class="searchbox"><option value="movie">Película</option><option value="series">Serie</option><option value="infantil">Infantil</option><option value="anime">Anime</option><option value="other">Otro</option></select></label>'+
 '<label>Categoría<input id="eCategory" class="searchbox"></label><label>Año<input id="eYear" class="searchbox"></label>'+
 '<label>Géneros<input id="eGenres" class="searchbox"></label>'+
 '<label>URL del póster<input id="ePoster" class="searchbox" type="url"></label><label>URL horizontal<input id="eLandscape" class="searchbox" type="url"></label>'+
 '<label>URL de fondo<input id="eBackdrop" class="searchbox" type="url"></label><label class="wide">URL del video<input id="eStream" class="searchbox" type="url" placeholder="https://..."></label>'+
 '<label>Duración<input id="eDuration" class="searchbox"></label><label>Calificación<input id="eScore" class="searchbox"></label>'+
 '<label>Director<input id="eDirector" class="searchbox"></label><label>Reparto<input id="eActors" class="searchbox"></label>'+
 '<label class="wide">Sinopsis<textarea id="eSynopsis" class="searchbox" rows="4" maxlength="3000"></textarea></label>'+
 '<div class="wide actions"><button class="primary" type="submit">Guardar cambios</button><button class="secondary" type="button" id="cancelEdit">Cancelar</button></div></form></div>':'';
 screen.innerHTML='<h1 class="page-title">Administrador</h1><div class="admin-top"><p class="subtle">Gestiona películas, series y el resto del catálogo.</p><button class="secondary" id="adminLogout">Cerrar sesión</button></div>'+
 '<div class="admin-card"><h2>Editar contenido existente ('+all.length+')</h2><p class="admin-note">Busca un título y pulsa EDITAR para modificar información, imágenes o video.</p><input id="adminCatalogSearch" class="searchbox" placeholder="Buscar película o serie por nombre..." value="'+safe(adminListQuery)+'"><p class="admin-note">Coincidencias mostradas: '+filtered.length+'</p>'+
 (filtered.length?filtered.map(x=>'<div class="admin-entry"><span>'+safe(x.title||"Sin título")+' <small>'+safe(x.kind||x.category||"contenido")+'</small></span><button class="primary" data-edit-admin="'+safe(x.id)+'">EDITAR</button></div>').join(""):'<p class="subtle">No hay coincidencias. Prueba otro nombre.</p>')+'</div>'+editForm+
 '<div class="admin-card"><h2>Agregar contenido nuevo</h2><form id="addContent" class="admin-form admin-grid">'+
 '<label>Nombre<input id="cTitle" class="searchbox" required maxlength="120"></label><label>Tipo<select id="cType" class="searchbox"><option value="movie">Película</option><option value="series">Serie</option><option value="infantil">Infantil</option><option value="anime">Anime</option></select></label>'+
 '<label>Año<input id="cYear" class="searchbox" maxlength="4"></label><label>Géneros<input id="cGenres" class="searchbox" placeholder="Acción, Drama"></label>'+
 '<label>URL del póster<input id="cPoster" class="searchbox" type="url"></label><label>URL del video<input id="cStream" class="searchbox" type="url"></label>'+
 '<label class="wide">Sinopsis<textarea id="cSynopsis" class="searchbox" rows="3"></textarea></label><div class="wide"><button class="primary" type="submit">Guardar contenido</button></div></form></div>'+
 '<div class="admin-card"><h2>Cambiar contraseña</h2><form id="changeAdminPass" class="admin-form"><label>Nueva contraseña<input id="newAdminPass" class="searchbox" type="password" minlength="8" required></label><button class="secondary" type="submit">Actualizar contraseña</button></form></div>';
 $("#adminLogout").onclick=()=>{adminUnlocked=false;adminEditingId=null;renderAdmin()};
 $("#adminCatalogSearch").oninput=e=>{adminListQuery=e.target.value;const pos=e.target.selectionStart;renderAdmin();const input=$("#adminCatalogSearch");input.focus();input.setSelectionRange(pos,pos)};
 document.querySelectorAll("[data-edit-admin]").forEach(b=>b.onclick=()=>{adminEditingId=b.dataset.editAdmin;renderAdmin();const ed=$("#adminEditor");if(ed)ed.scrollIntoView({block:"start"})});
 $("#addContent").onsubmit=e=>{e.preventDefault();const title=$("#cTitle").value.trim(),type=$("#cType").value,poster=$("#cPoster").value.trim(),stream=$("#cStream").value.trim();if(!title){toast("Escribe un título.");return}if((poster&&!/^https?:\/\//i.test(poster))||(stream&&!/^https?:\/\//i.test(stream))){toast("Las URL deben comenzar con http:// o https://.");return}const kind=type==="movie"?"película":type==="series"?"serie":type;const added=store.get("admin_items");added.push({id:"admin_"+Date.now(),title,kind,type,category:type,year:$("#cYear").value.trim(),genres:$("#cGenres").value.split(",").map(x=>x.trim()).filter(Boolean),poster,streamUrl:stream,synopsis:$("#cSynopsis").value.trim(),row:"Agregado por administrador"});store.set("admin_items",added);toast("Contenido agregado.");adminListQuery=title;renderAdmin()};
 if(editing){
  const val=(id,v)=>{const el=$(id);if(el)el.value=v==null?"":String(v)};
  val("#eTitle",editing.title);val("#eType",["movie","series","infantil","anime"].includes(editing.type)?editing.type:(editing.kind==="infantil"||editing.kind==="anime"?editing.kind:(/serie/i.test(editing.kind||"")?"series":/pel[ií]cula/i.test(editing.kind||"")?"movie":"other")));
  val("#eCategory",editing.category);val("#eYear",editing.year);val("#eGenres",Array.isArray(editing.genres)?editing.genres.join(", "):editing.genres);
  val("#ePoster",editing.poster);val("#eLandscape",editing.landscape);val("#eBackdrop",editing.backdrop);val("#eStream",editing.streamUrl);val("#eDuration",editing.duration);val("#eScore",editing.score);val("#eDirector",editing.director);val("#eActors",editing.actors);val("#eSynopsis",editing.synopsis);
  $("#cancelEdit").onclick=()=>{adminEditingId=null;renderAdmin()};
  $("#editContent").onsubmit=e=>{e.preventDefault();const urls=["#ePoster","#eLandscape","#eBackdrop","#eStream"].map(id=>$(id).value.trim());if(urls.some(u=>u&&!/^https?:\/\//i.test(u))){toast("Las URL deben comenzar con http:// o https://.");return}
   const type=$("#eType").value,kind=type==="movie"?"película":type==="series"?"serie":type==="other"?(editing.kind||"contenido"):type;
   const patch={title:$("#eTitle").value.trim(),type:type==="other"?(editing.type||"other"):type,kind,category:$("#eCategory").value.trim()||type,year:$("#eYear").value.trim(),genres:$("#eGenres").value.split(",").map(x=>x.trim()).filter(Boolean),poster:urls[0],landscape:urls[1],backdrop:urls[2],streamUrl:urls[3],duration:$("#eDuration").value.trim(),score:$("#eScore").value.trim(),director:$("#eDirector").value.trim(),actors:$("#eActors").value.trim(),synopsis:$("#eSynopsis").value.trim()};
   const overrides=store.get("admin_overrides");overrides[String(editing.id)]=patch;store.set("admin_overrides",overrides);toast("Ficha actualizada en este dispositivo.");adminEditingId=null;renderAdmin();
  };
 }
 $("#changeAdminPass").onsubmit=e=>{e.preventDefault();const p=$("#newAdminPass").value;if(p.length<8){toast("Usa al menos 8 caracteres.");return}try{localStorage.setItem("xuper_admin_password",p);toast("Contraseña actualizada.");$("#newAdminPass").value=""}catch(_){toast("No se pudo guardar la contraseña.")}};
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