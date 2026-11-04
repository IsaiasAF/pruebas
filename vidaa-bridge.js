/* XuperTV VIDAA platform bridge — diagnostic helpers only. */
(function (w, d) {
  'use strict';
  var ua = (w.navigator && w.navigator.userAgent) || '';
  var video = d.createElement('video');
  var info = {
    platform: /Hisense|VIDAA/i.test(ua) ? 'VIDAA' : 'HTML5 / navegador',
    userAgent: ua,
    width: w.innerWidth || 0,
    height: w.innerHeight || 0,
    mp4: !!(video.canPlayType && video.canPlayType('video/mp4').replace(/no/, '')),
    hls: !!(video.canPlayType && (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL')).replace(/no/, '')),
    dash: !!(video.canPlayType && video.canPlayType('application/dash+xml').replace(/no/, '')),
    storage: false
  };
  try {
    w.localStorage.setItem('__xuper_vidaa_test__', '1');
    w.localStorage.removeItem('__xuper_vidaa_test__');
    info.storage = true;
  } catch (e) { info.storage = false; }
  w.XUPERTV_VIDAA = {
    getInfo: function () { return info; },
    refresh: function () {
      info.width = w.innerWidth || 0;
      info.height = w.innerHeight || 0;
      return info;
    }
  };
  function showDiagnostics() {
    var settings = d.querySelector('.settings');
    if (!settings || d.getElementById('xuper-vidaa-diagnostics')) return;
    var card = d.createElement('div');
    card.id = 'xuper-vidaa-diagnostics';
    card.className = 'setting';
    var title = d.createElement('strong');
    title.textContent = 'Compatibilidad detectada en este televisor';
    var body = d.createElement('span');
    body.textContent = 'Plataforma: ' + info.platform +
      ' · Pantalla: ' + info.width + ' × ' + info.height +
      ' · MP4: ' + (info.mp4 ? 'sí' : 'no detectado') +
      ' · HLS: ' + (info.hls ? 'sí' : 'no detectado') +
      ' · DASH: ' + (info.dash ? 'sí' : 'no detectado') +
      ' · Almacenamiento: ' + (info.storage ? 'disponible' : 'no disponible');
    card.appendChild(title);
    card.appendChild(body);
    settings.insertBefore(card, settings.firstChild);
  }
  if (w.MutationObserver) {
    var observer = new MutationObserver(showDiagnostics);
    function watch() {
      var screen = d.getElementById('screen');
      if (screen) observer.observe(screen, { childList: true, subtree: true });
      showDiagnostics();
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', watch);
    else watch();
  }
  w.addEventListener('resize', function () { info.width = w.innerWidth || 0; info.height = w.innerHeight || 0; });
  function lifecycleEvent(name) {
    var event;
    if (d.createEvent) {
      event = d.createEvent('Event');
      event.initEvent(name, false, false);
      d.dispatchEvent(event);
    }
  }
  if (typeof w.Hisense_onAppShow !== 'function') w.Hisense_onAppShow = function () { lifecycleEvent('xuper:appshow'); };
  if (typeof w.Hisense_onAppHide !== 'function') w.Hisense_onAppHide = function () { lifecycleEvent('xuper:apphide'); };
})(window, document);
