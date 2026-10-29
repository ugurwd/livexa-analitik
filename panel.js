/* LIVEXA Analitik paneli — /api/veri (toplu sayaçlar + harcama) ve /api/siparisler (ödeme kayıtları) ile çalışır. */
(function () {
  'use strict';
  var KANALLAR = ['Google Reklam', 'Instagram Reklam', 'Facebook Reklam', 'Meta Reklam', 'Meta (etiketsiz)', 'Instagram', 'Facebook',
    'Google Arama', 'Diğer Arama', 'WhatsApp', 'E-posta', 'TikTok', 'YouTube', 'X', 'Diğer kampanya', 'Diğer site', 'Doğrudan'];
  var FIYAT = { 'paket-1': 290000, 'paket-2': 550000 };
  var SAYFA_AD = { '/index.html': 'Ana sayfa', '/satin-al.html': 'Satın al', '/icerik-ve-kullanim.html': 'İçerik ve kullanım', '/sss.html': 'Sık sorulanlar',
    '/hakkimizda.html': 'Hakkımızda', '/iletisim.html': 'İletişim', '/kunye.html': 'Künye', '/odeme-basarili.html': 'Ödeme başarılı', '/odeme-basarisiz.html': 'Ödeme başarısız',
    '/on-bilgilendirme-formu.html': 'Ön bilgilendirme', '/mesafeli-satis-sozlesmesi.html': 'Mesafeli satış', '/iade-ve-cayma.html': 'İade ve cayma',
    '/teslimat-ve-kargo.html': 'Teslimat ve kargo', '/kvkk-aydinlatma.html': 'KVKK', '/gizlilik-ve-cerez.html': 'Gizlilik' };
  var YER_AD = { menu: 'Üst menü', cubuk: 'Mobil alt çubuk', altbilgi: 'Altbilgi', 'bolum-00-hero': 'Ana sayfa girişi', 'bolum-siparis': 'Ana sayfa sipariş bölümü',
    'bolum-sofra': 'Sofra bölümü', 'sa-karar': 'Satın al kutusu', 'sa-kapanis': 'Kapanış bandı', 'hn-kapanis': 'Kapanış bandı' };
  var BOLUM_AD = { 'bolum-sofra': 'Ana sayfa · Dört bileşen, tek sofra', 'bolum-02-beyan': 'Ana sayfa · Bileşen beyanları', 'bolum-04-kullanim': 'Ana sayfa · Kullanım ve uyarılar',
    'bolum-siparis': 'Ana sayfa · Sipariş', 'sa-paket': 'Satın al · Paket seçimi', 'sa-form': 'Satın al · Sipariş formu', 'ud-uyarilar': 'İçerik · Uyarılar', tablolar: 'İçerik · Bileşen tabloları' };
  var CIHAZ_AD = { mobil: 'Mobil', tablet: 'Tablet', masaustu: 'Masaüstü', '': 'Bilinmiyor' };

  var $ = function (s) { return document.querySelector(s); };
  var el = function (tag, attrs, html) { var e = document.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sayi = function (n) { return Math.round(n || 0).toLocaleString('tr-TR'); };
  var tl = function (kurus) { return (kurus / 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL'; };
  var yuzde = function (a, b) { return b ? (100 * a / b).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' %' : '—'; };
  var trBugun = function () { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); };
  var gunEkle = function (g, n) { var d = new Date(g + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var trGun = function (iso) { return iso ? new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 10) : ''; };
  var trZaman = function (iso) { if (!iso) return ''; var t = new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString(); return t.slice(8, 10) + '.' + t.slice(5, 7) + ' ' + t.slice(11, 16); };
  var kisaGun = function (g) { return g.slice(8, 10) + '.' + g.slice(5, 7); };

  // Panel analitik.livexa.com.tr'de (GitHub Pages) durur, veri Worker'dan gelir. Parola yalnız bu sekmede tutulur.
  var API = /(^|\.)wakaresearch\.com$/.test(location.hostname) ? '' : 'https://livexa-analitik.wakaresearch.com';
  var parola = ''; try { parola = sessionStorage.getItem('lx_panel') || ''; } catch (e) { /* yok */ }
  var istek = function (yol, se) {
    se = se || {}; se.headers = Object.assign({}, se.headers || {}, { Authorization: 'Basic ' + btoa('livexa:' + parola) }); se.cache = 'no-store';
    return fetch(API + yol, se).then(function (r) { if (r.status === 401) { girisGoster(); throw new Error('giris'); } return r.json(); });
  };
  function girisGoster(hata) { $('#giris').hidden = false; $('#giris-hata').textContent = hata || (parola ? 'Parola yanlış.' : ''); $('#giris-parola').focus(); }
  $('#giris-form').addEventListener('submit', function (e) {
    e.preventDefault(); parola = $('#giris-parola').value; try { sessionStorage.setItem('lx_panel', parola); } catch (er) { /* yok */ }
    $('#giris').hidden = true; yukle();
  });
  var durum = { bas: gunEkle(trBugun(), -6), son: trBugun(), kanal: '', test: false };
  var veri = null, siparis = [], alanIdx = {};

  // ---------- filtreler
  var kanalSec = $('#f-kanal'), hKanal = document.querySelector('#harcama select[name=kanal]');
  KANALLAR.forEach(function (k) { kanalSec.appendChild(el('option', { value: k }, esc(k))); hKanal.appendChild(el('option', { value: k }, esc(k))); });
  document.querySelector('#harcama input[name=gun]').value = trBugun();
  var aralikYaz = function () { $('#f-bas').value = durum.bas; $('#f-son').value = durum.son; };
  document.querySelectorAll('[data-aralik]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.getAttribute('data-aralik'), bug = trBugun();
      if (a === 'bugun') { durum.bas = durum.son = bug; }
      else if (a === 'dun') { durum.bas = durum.son = gunEkle(bug, -1); }
      else if (a === 'ay') { durum.bas = bug.slice(0, 8) + '01'; durum.son = bug; }
      else if (a === 'tum') { durum.bas = '2026-10-01'; durum.son = bug; }
      else { durum.bas = gunEkle(bug, -(Number(a) - 1)); durum.son = bug; }
      document.querySelectorAll('[data-aralik]').forEach(function (x) { x.classList.toggle('etkin', x === b); });
      aralikYaz(); yukle();
    });
  });
  ['#f-bas', '#f-son'].forEach(function (s) { $(s).addEventListener('change', function () {
    if ($('#f-bas').value && $('#f-son').value) { durum.bas = $('#f-bas').value; durum.son = $('#f-son').value; document.querySelectorAll('[data-aralik]').forEach(function (x) { x.classList.remove('etkin'); }); yukle(); }
  }); });
  kanalSec.addEventListener('change', function () { durum.kanal = kanalSec.value; ciz(); });
  $('#f-test').addEventListener('change', function () { durum.test = $('#f-test').checked; yukle(); });
  $('#yenile').addEventListener('click', function () { yukle(); });
  aralikYaz();

  // ---------- veri
  function yukle() {
    $('#guncel').textContent = 'Yükleniyor…';
    var u = '/api/veri?bas=' + durum.bas + '&son=' + durum.son + '&test=' + (durum.test ? 1 : 0);
    if (!parola) { $('#guncel').textContent = ''; girisGoster(); return; }
    Promise.all([istek(u), istek('/api/siparisler')])
      .then(function (s) {
        veri = s[0]; siparis = s[1].kayitlar || [];
        alanIdx = {}; veri.alanlar.forEach(function (a, i) { alanIdx[a] = i; });
        ciz(); promoYukle();
        $('#guncel').textContent = 'Güncellendi ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      })
      .catch(function (er) { $('#guncel').textContent = er && er.message === 'giris' ? '' : 'Veri alınamadı. Yenile’ye basın.'; });
  }
  var al = function (r, a) { return r[alanIdx[a]]; };
  function satirlar(kanalFiltreli) {
    return veri.satirlar.filter(function (r) { return !kanalFiltreli || !durum.kanal || al(r, 'kanal') === durum.kanal; });
  }
  function topla(rs, kosul) { var t = 0; for (var i = 0; i < rs.length; i++) if (kosul(rs[i])) t += al(rs[i], 'adet'); return t; }
  function grupla(rs, anahtar, kosul) {
    var m = {}; rs.forEach(function (r) { if (kosul && !kosul(r)) return; var k = typeof anahtar === 'function' ? anahtar(r) : al(r, anahtar); m[k] = (m[k] || 0) + al(r, 'adet'); });
    return m;
  }
  var O = function (ad) { return function (r) { return al(r, 'olay') === ad; }; };
  var ZIYARET = function (r) { return al(r, 'olay') === 'sayfa' && al(r, 'giris') === 1; };
  function metrik(rs) {
    var paket = grupla(rs, 'ek', O('satin_alma'));
    var ciro = 0; for (var p in paket) ciro += (FIYAT[p] || 0) * paket[p];
    return {
      ziyaret: topla(rs, ZIYARET), sayfa: topla(rs, O('sayfa')), saSayfa: topla(rs, function (r) { return al(r, 'olay') === 'sayfa' && al(r, 'sayfa') === '/satin-al.html'; }),
      tik: topla(rs, O('satin_al_tik')), paket: topla(rs, O('paket_sec')), form: topla(rs, O('form_basla')), hata: topla(rs, O('form_hata')),
      odeme: topla(rs, O('odeme_tik')), acildi: topla(rs, O('odeme_acildi')), satis: topla(rs, O('satin_alma')), basarisiz: topla(rs, O('odeme_basarisiz')),
      wa: topla(rs, O('whatsapp_tik')), ciro: ciro,
    };
  }
  function harcamaTopla(kanal) {
    var t = 0; (veri.harcama || []).forEach(function (h) { if (!kanal || h.kanal === kanal) t += h.tutar_kurus; }); return t;
  }

  // ---------- çizim
  function ciz() {
    if (!veri) return;
    var rs = satirlar(true), m = metrik(rs);
    var sip = siparis.filter(function (s) { var g = trGun(s.olusturma); return g >= durum.bas && g <= durum.son && s.test === durum.test; });
    var odenen = sip.filter(function (s) { return s.durum === 'odendi'; });
    var ciroKesin = odenen.reduce(function (t, s) { return t + (s.tahsil || s.tutar || 0); }, 0);
    var harc = harcamaTopla(durum.kanal);
    var kf = !!durum.kanal;
    var tiles = [
      ['Ziyaret', sayi(m.ziyaret), 'dışarıdan giriş'],
      ['Sayfa görüntüleme', sayi(m.sayfa), m.ziyaret ? (m.sayfa / m.ziyaret).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' sayfa / ziyaret' : ''],
      ['"Satın al" tıklaması', sayi(m.tik), yuzde(m.tik, m.ziyaret) + ' ziyarete göre'],
      ['Ödemeye geçen', sayi(m.odeme), 'ödeme ekranı açılan ' + sayi(m.acildi)],
      kf ? ['Satın alma', sayi(m.satis), 'bu kanaldan, ödeme dönüşüyle'] : ['Sipariş (ödenen)', sayi(odenen.length), 'kanala bağlanan ' + sayi(m.satis)],
      kf ? ['Ciro (paketlerden)', tl(m.ciro), ''] : ['Ciro', tl(ciroKesin), odenen.length ? 'ortalama ' + tl(ciroKesin / odenen.length) : ''],
      ['Dönüşüm oranı', yuzde(kf ? m.satis : odenen.length, m.ziyaret), 'satın alma / ziyaret'],
      ['Reklam harcaması', harc ? tl(harc) : '—', harc ? 'ROAS ' + ((kf ? m.ciro : ciroKesin) / harc).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' · sipariş başı ' + ((kf ? m.satis : odenen.length) ? tl(harc / (kf ? m.satis : odenen.length)) : '—') : 'aşağıdan girilir'],
    ];
    $('#kpi').innerHTML = tiles.map(function (t) { return '<div class="tile"><div class="etiket">' + esc(t[0]) + '</div><div class="deger">' + esc(t[1]) + '</div><div class="alt">' + esc(t[2]) + '</div></div>'; }).join('');

    huni([['Ziyaret', m.ziyaret], ['"Satın al" tıklaması', m.tik], ['Satın al sayfası görüntüleme', m.saSayfa], ['Forma başlayan', m.form],
      ['Ödemeye geçmeyi deneyen', m.odeme], ['Ödeme ekranı açılan', m.acildi], ['Satın alma', m.satis]]);

    var gunler = []; for (var g = durum.bas; g <= durum.son && gunler.length < 400; g = gunEkle(g, 1)) gunler.push(g);
    var zG = grupla(rs, 'gun', ZIYARET), sG = grupla(rs, 'gun', O('satin_alma'));
    cizgiGrafik('#g-ziyaret', gunler.map(function (g) { return { x: g, y: zG[g] || 0 }; }), 'ziyaret');
    sutunGrafik('#g-satis', gunler.map(function (g) { return { x: g, etiket: kisaGun(g), y: sG[g] || 0 }; }), 'satın alma', true);
    var sS = grupla(rs, 'saat', ZIYARET);
    sutunGrafik('#g-saat', Array.from({ length: 24 }, function (_, h) { return { x: h, etiket: String(h).padStart(2, '0'), y: sS[h] || 0 }; }), 'ziyaret', false, 3);

    kanalTablosu(); kampanyaTablosu(rs);
    siparisler(sip, odenen, ciroKesin);
    hbar('#b-sayfa', grupla(rs, 'sayfa', O('sayfa')), function (k) { return SAYFA_AD[k] || k; });
    hbar('#b-cihaz', grupla(rs, 'cihaz', ZIYARET), function (k) { return CIHAZ_AD[k] || k; });
    hbar('#b-il', grupla(rs, 'il', ZIYARET), function (k) { return k ? k.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : 'Bilinmiyor'; }, 10);
    hbar('#b-yon', grupla(rs, 'yonlendiren', function (r) { return ZIYARET(r) && al(r, 'yonlendiren'); }), function (k) { return k; }, 10);
    hbar('#b-cta', grupla(rs, 'ek', O('satin_al_tik')), function (k) { return YER_AD[k] || k || 'Bilinmiyor'; });
    hbar('#b-bolum', grupla(rs, 'ek', O('bolum')), function (k) { return BOLUM_AD[k] || k; });
    harcamaTablosu();
  }

  function huni(adimlar) {
    var maks = Math.max.apply(null, adimlar.map(function (a) { return a[1]; })) || 1;
    $('#huni').innerHTML = '<div class="huni">' + adimlar.map(function (a, i) {
      var once = i ? adimlar[i - 1][1] : 0;
      return '<div class="adim"><div>' + esc(a[0]) + '</div><div class="iz"><div class="dolgu" style="width:' + (100 * a[1] / maks).toFixed(1) + '%"></div></div>' +
        '<div class="say">' + sayi(a[1]) + (i ? '<small>' + yuzde(a[1], once) + '</small>' : '<small>&nbsp;</small>') + '</div></div>';
    }).join('') + '</div>';
  }

  function hbar(sec, m, ad, enCok) {
    enCok = enCok || 8;
    var l = Object.keys(m).map(function (k) { return [k, m[k]]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    if (l.length > enCok) { var digr = l.slice(enCok - 1).reduce(function (t, x) { return t + x[1]; }, 0); l = l.slice(0, enCok - 1).concat([['__diger', digr]]); }
    var maks = l.length ? l[0][1] : 1, top = l.reduce(function (t, x) { return t + x[1]; }, 0);
    $(sec).innerHTML = '<div class="hbar">' + (l.length ? l.map(function (x) {
      var n = x[0] === '__diger' ? 'Diğer' : ad(x[0]);
      return '<div class="ad" title="' + esc(n) + '">' + esc(n) + '</div><div class="iz" data-ipucu="' + esc(n + ': ' + sayi(x[1]) + ' (' + yuzde(x[1], top) + ')') + '"><div class="dolgu" style="width:' + (100 * x[1] / maks).toFixed(1) + '%"></div></div><div class="say">' + sayi(x[1]) + '</div>';
    }).join('') : '<div class="bos">Bu aralıkta veri yok.</div>') + '</div>';
  }

  function olcek(maks) { if (maks <= 4) return { ust: Math.max(maks, 1), adim: 1 }; var p = Math.pow(10, Math.floor(Math.log10(maks))), a = [1, 2, 2.5, 5, 10].map(function (x) { return x * p; }).find(function (x) { return maks / x <= 5; }); return { ust: Math.ceil(maks / a) * a, adim: a }; }

  function cizgiGrafik(sec, n, birim) {
    var W = 640, H = 210, L = 36, R = 12, T = 12, B = 24;
    var maks = Math.max.apply(null, n.map(function (p) { return p.y; })); var o = olcek(maks || 1);
    var x = function (i) { return L + (n.length < 2 ? (W - L - R) / 2 : i * (W - L - R) / (n.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / o.ust); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Günlük ' + birim + '"><g class="izgara">';
    for (var v = 0; v <= o.ust; v += o.adim) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    s += '</g><g class="eksen">';
    for (v = 0; v <= o.ust; v += o.adim) s += '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + sayi(v) + '</text>';
    [0, Math.floor((n.length - 1) / 2), n.length - 1].filter(function (i, j, a) { return a.indexOf(i) === j && n[i]; }).forEach(function (i) {
      s += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n.length - 1 ? 'end' : 'middle') + '">' + kisaGun(n[i].x) + '</text>';
    });
    s += '</g>';
    var yol = n.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.y).toFixed(1); }).join('');
    if (n.length > 1) s += '<path class="alan" d="' + yol + 'L' + x(n.length - 1) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z"/>';
    s += '<path class="cizgi" d="' + yol + '"/>';
    if (n.length) s += '<circle class="nokta" r="4" cx="' + x(n.length - 1) + '" cy="' + y(n[n.length - 1].y) + '"/>';
    s += '<line class="imlec" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/><circle class="nokta imlec-n" r="5" visibility="hidden"/>';
    var gen = (W - L - R) / Math.max(1, n.length - 1);
    n.forEach(function (p, i) { s += '<rect class="hedef" x="' + (x(i) - gen / 2) + '" y="' + T + '" width="' + Math.max(gen, 8) + '" height="' + (H - T - B) + '" data-i="' + i + '"/>'; });
    s += '</svg><details><summary>Tablo olarak göster</summary>' + tabloHtml(['Gün', birim], n.map(function (p) { return [kisaGun(p.x), sayi(p.y)]; })) + '</details>';
    var kap = $(sec); kap.innerHTML = s;
    var svg = kap.querySelector('svg'), im = svg.querySelector('.imlec'), imn = svg.querySelector('.imlec-n');
    svg.querySelectorAll('.hedef').forEach(function (r) {
      r.addEventListener('mousemove', function (e) { var i = +r.getAttribute('data-i'); im.setAttribute('x1', x(i)); im.setAttribute('x2', x(i)); im.setAttribute('visibility', 'visible');
        imn.setAttribute('cx', x(i)); imn.setAttribute('cy', y(n[i].y)); imn.setAttribute('visibility', 'visible'); ipucu(e, kisaGun(n[i].x) + ' · ' + sayi(n[i].y) + ' ' + birim); });
      r.addEventListener('mouseleave', function () { im.setAttribute('visibility', 'hidden'); imn.setAttribute('visibility', 'hidden'); ipucuGizle(); });
    });
  }

  function sutunGrafik(sec, n, birim, vurgu, etiketAdim) {
    var W = 640, H = 200, L = 36, R = 8, T = 12, B = 24;
    var maks = Math.max.apply(null, n.map(function (p) { return p.y; })); var o = olcek(maks || 1);
    var bw = (W - L - R) / Math.max(1, n.length), y = function (v) { return T + (H - T - B) * (1 - v / o.ust); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(birim) + '"><g class="izgara">';
    for (var v = 0; v <= o.ust; v += o.adim) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    s += '</g><g class="eksen">';
    for (v = 0; v <= o.ust; v += o.adim) s += '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + sayi(v) + '</text>';
    var adim = etiketAdim || Math.max(1, Math.ceil(n.length / 8));
    n.forEach(function (p, i) { if (i % adim === 0 || i === n.length - 1) s += '<text x="' + (L + bw * i + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(p.etiket) + '</text>'; });
    s += '</g>';
    n.forEach(function (p, i) {
      var h = (H - T - B) * p.y / o.ust, w = Math.max(1, bw - 2), bx = L + bw * i + 1, by = H - B - h;
      if (p.y > 0) s += '<path class="sutun' + (vurgu ? ' sutun--vurgu' : '') + '" d="M' + bx + ',' + (H - B) + 'V' + (by + Math.min(4, h)) + 'q0,-' + Math.min(4, h) + ' ' + Math.min(4, w / 2) + ',-' + Math.min(4, h) + 'H' + (bx + w - Math.min(4, w / 2)) + 'q' + Math.min(4, w / 2) + ',0 ' + Math.min(4, w / 2) + ',' + Math.min(4, h) + 'V' + (H - B) + 'Z"/>';
      s += '<rect class="hedef" x="' + (L + bw * i) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" data-ipucu="' + esc(p.etiket + ' · ' + sayi(p.y) + ' ' + birim) + '"/>';
    });
    s += '</svg><details><summary>Tablo olarak göster</summary>' + tabloHtml(['', birim], n.map(function (p) { return [p.etiket, sayi(p.y)]; })) + '</details>';
    $(sec).innerHTML = s;
  }

  function tabloHtml(bas, satir) {
    return '<table class="tablo"><thead><tr>' + bas.map(function (b) { return '<th>' + esc(b) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      satir.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  // sıralanabilir tablo
  function tablo(sec, sutunlar, satirlar, varsayilan) {
    var t = $(sec), sira = t._sira || { i: varsayilan || 1, azalan: true };
    var ciz2 = function () {
      var l = satirlar.slice().sort(function (a, b) { var x = a[sira.i].v, y = b[sira.i].v; if (typeof x === 'string') return sira.azalan ? y.localeCompare(x, 'tr') : x.localeCompare(y, 'tr'); return sira.azalan ? (y - x) : (x - y); });
      t.innerHTML = '<thead><tr>' + sutunlar.map(function (s, i) { return '<th scope="col"' + (i === sira.i ? ' aria-sort="' + (sira.azalan ? 'descending' : 'ascending') + '"' : '') + ' data-i="' + i + '">' + esc(s) + (i === sira.i ? (sira.azalan ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (l.length ? l.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c.h + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td class="bos" colspan="' + sutunlar.length + '">Bu aralıkta veri yok.</td></tr>') + '</tbody>';
      t.querySelectorAll('th').forEach(function (th) { th.addEventListener('click', function () { var i = +th.getAttribute('data-i'); sira = { i: i, azalan: sira.i === i ? !sira.azalan : true }; t._sira = sira; ciz2(); }); });
    };
    ciz2();
  }
  var hc = function (v, h) { return { v: v, h: h == null ? sayi(v) : h }; };

  function kanalTablosu() {
    var tum = satirlar(false), byK = {};
    tum.forEach(function (r) { var k = al(r, 'kanal'); (byK[k] = byK[k] || []).push(r); });
    var hk = {}; (veri.harcama || []).forEach(function (h) { hk[h.kanal] = (hk[h.kanal] || 0) + h.tutar_kurus; });
    Object.keys(hk).forEach(function (k) { byK[k] = byK[k] || []; });
    var maksZ = 1, l = Object.keys(byK).map(function (k) { var m = metrik(byK[k]); maksZ = Math.max(maksZ, m.ziyaret); return [k, m]; });
    var satir = l.map(function (x) {
      var k = x[0], m = x[1], h = hk[k] || 0;
      return [hc(k, '<b>' + esc(k) + '</b>'), hc(m.ziyaret, '<span class="cubukhucre" style="width:' + Math.round(60 * m.ziyaret / maksZ) + 'px"></span>' + sayi(m.ziyaret)), hc(m.sayfa), hc(m.tik), hc(m.form), hc(m.odeme), hc(m.satis),
        hc(m.ziyaret ? m.satis / m.ziyaret : 0, yuzde(m.satis, m.ziyaret)), hc(m.ciro, m.ciro ? tl(m.ciro) : '—'), hc(h, h ? tl(h) : '—'),
        hc(h && m.satis ? h / m.satis : 0, h && m.satis ? tl(h / m.satis) : '—'), hc(h ? m.ciro / h : 0, h ? (m.ciro / h).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—')];
    });
    tablo('#t-kanal', ['Kanal', 'Ziyaret', 'Sayfa', '"Satın al" tık', 'Forma başlayan', 'Ödemeye geçen', 'Satın alma', 'Dönüşüm', 'Ciro', 'Harcama', 'Sipariş başı', 'ROAS'], satir, 1);
  }

  function kampanyaTablosu(rs) {
    var by = {};
    rs.forEach(function (r) { if (!al(r, 'kaynak') && !al(r, 'kampanya')) return; var k = [al(r, 'kaynak') || '—', al(r, 'ortam') || '—', al(r, 'kampanya') || '—', al(r, 'icerik') || '—'].join(' / ') + '|' + al(r, 'kanal'); (by[k] = by[k] || []).push(r); });
    var satir = Object.keys(by).map(function (k) { var m = metrik(by[k]), p = k.split('|');
      return [hc(p[0], esc(p[0])), hc(p[1], esc(p[1])), hc(m.ziyaret), hc(m.tik), hc(m.odeme), hc(m.satis), hc(m.ziyaret ? m.satis / m.ziyaret : 0, yuzde(m.satis, m.ziyaret)), hc(m.ciro, m.ciro ? tl(m.ciro) : '—')]; });
    tablo('#t-kampanya', ['Kaynak / ortam / kampanya / içerik', 'Kanal', 'Ziyaret', '"Satın al" tık', 'Ödemeye geçen', 'Satın alma', 'Dönüşüm', 'Ciro'], satir, 2);
  }

  function siparisler(sip, odenen, ciro) {
    var by = {}; sip.forEach(function (s) { by[s.durum] = (by[s.durum] || 0) + 1; });
    var iki = odenen.filter(function (s) { return s.paket === '2'; }).length;
    var t = [['Ödenen', sayi(odenen.length), tl(ciro)], ['Ödeme ekranında kalan', sayi(by.bekliyor || 0), 'formu doldurup ödemeyi tamamlamayan'],
      ['Başarısız ödeme', sayi(by.basarisiz || 0), ''], ["2'li paket oranı", yuzde(iki, odenen.length), sayi(iki) + ' sipariş'],
      ['Ortalama sepet', odenen.length ? tl(ciro / odenen.length) : '—', '']];
    $('#s-ozet').innerHTML = t.map(function (x) { return '<div class="tile"><div class="etiket">' + esc(x[0]) + '</div><div class="deger">' + esc(x[1]) + '</div><div class="alt">' + esc(x[2]) + '</div></div>'; }).join('');
    var DURUM = { odendi: 'Ödendi', bekliyor: 'Ödeme bekleniyor', basarisiz: 'Başarısız', 'token-hatasi': 'Ödeme açılamadı' };
    var satir = sip.slice(0, 200).map(function (s) {
      return [hc(s.olusturma || '', esc(trZaman(s.olusturma))), hc(s.no, esc(s.no)), hc(s.paket, s.paket === '2' ? "2'li paket" : '1 kutu'), hc(s.tahsil || s.tutar || 0, tl(s.tahsil || s.tutar || 0)),
        hc(s.durum, '<span class="durum durum--' + esc(s.durum) + '">' + esc(DURUM[s.durum] || s.durum) + '</span>' + (s.hata ? ' <small>' + esc(s.hata) + '</small>' : '')),
        hc(s.promo || '', s.promo ? esc(s.promo) + ' <small>−' + tl(s.indirim) + '</small>' : '—'),
        hc(s.odemeTuru, esc(s.odemeTuru === 'card' ? 'Kart' : s.odemeTuru || '—')), hc(s.epostaMusteri, esc(s.epostaMusteri || '—')), hc(s.fatura, esc(s.fatura || '—'))];
    });
    tablo('#t-siparis', ['Tarih', 'Sipariş no', 'Paket', 'Tutar', 'Durum', 'Promosyon', 'Ödeme', 'Müşteri e-postası', 'Fatura'], satir, 0);
  }

  function harcamaTablosu() {
    var satir = (veri.harcama || []).map(function (h) { return [hc(h.gun, esc(kisaGun(h.gun) + '.' + h.gun.slice(0, 4))), hc(h.kanal, esc(h.kanal)), hc(h.tutar_kurus, tl(h.tutar_kurus)), hc(h.notu || '', esc(h.notu || ''))]; });
    tablo('#t-harcama', ['Gün', 'Kanal', 'Tutar', 'Not'], satir, 0);
  }

  // promosyon kodları
  var promolar = [];
  function promoYukle() { istek('/api/promo').then(function (v) { promolar = v.kodlar || []; promoCiz(); }, function () {}); }
  function promoCiz() {
    var odenenKod = {}; siparis.forEach(function (s) { if (s.promo && s.durum === 'odendi' && !s.test) { var o = odenenKod[s.promo] = odenenKod[s.promo] || { n: 0, ind: 0, ciro: 0 }; o.n++; o.ind += s.indirim; o.ciro += s.tahsil || s.tutar || 0; } });
    var bug = trBugun();
    var satir = promolar.map(function (k) {
      var o = odenenKod[k.kod] || { n: 0, ind: 0, ciro: 0 };
      var durumYaz = !k.aktif ? 'Kapalı' : (k.son && bug > k.son) ? 'Süresi doldu' : (k.bas && bug < k.bas) ? 'Başlamadı' : (k.limit && k.kullanim >= k.limit) ? 'Sınır doldu' : 'Geçerli';
      return [hc(k.kod, '<b>' + esc(k.kod) + '</b>' + (k.notu ? '<br><small>' + esc(k.notu) + '</small>' : '')),
        hc(k.deger, k.tip === 'yuzde' ? '%' + k.deger : tl(k.deger * 100)), hc((k.paketler || []).join(','), (k.paketler || []).map(function (p) { return p === '2' ? "2'li" : '1 kutu'; }).join(' + ')),
        hc(k.bas || '', esc((k.bas ? kisaGun(k.bas) : '…') + ' – ' + (k.son ? kisaGun(k.son) : '…'))), hc(k.kullanim || 0, sayi(k.kullanim || 0) + (k.limit ? ' / ' + sayi(k.limit) : '')),
        hc(o.ciro, o.n ? tl(o.ciro) : '—'), hc(o.ind, o.n ? tl(o.ind) : '—'),
        hc(durumYaz, '<span class="durum' + (durumYaz === 'Geçerli' ? ' durum--odendi' : '') + '">' + esc(durumYaz) + '</span>' +
          '<button type="button" class="mini" data-promo-ac="' + esc(k.kod) + '">' + (k.aktif ? 'Kapat' : 'Aç') + '</button><button type="button" class="mini" data-promo-duzen="' + esc(k.kod) + '">Düzenle</button><button type="button" class="mini" data-promo-sil="' + esc(k.kod) + '">Sil</button>')];
    });
    tablo('#t-promo', ['Kod', 'İndirim', 'Paket', 'Geçerlilik', 'Kullanım', 'Ciro (kodla)', 'Verilen indirim', 'Durum'], satir, 0);
  }
  var promoGonder = function (g, mesaj) {
    return istek('/api/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) }).then(function (v) {
      $('#promo-sonuc').textContent = v.tamam ? mesaj : 'Kaydedilemedi: ' + ({ kod: 'kod 3–24 harf/rakam/tire olmalı', deger: 'indirim yüzde en çok 90, tutar en çok 5.000 TL', paket: 'en az bir paket seçin', tarih: 'bitiş başlangıçtan önce' }[v.hata] || v.hata || '');
      $('#promo-sonuc').style.color = v.tamam ? '' : 'var(--kotu)'; if (v.tamam) promoYukle();
    });
  };
  $('#promo-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target;
    var paketler = []; if (f.p1.checked) paketler.push('1'); if (f.p2.checked) paketler.push('2');
    var eski = promolar.find(function (k) { return k.kod === f.kod.value.trim().toLocaleUpperCase('tr'); });
    promoGonder({ kod: f.kod.value, tip: f.tip.value, deger: f.deger.value, paketler: paketler, bas: f.bas.value, son: f.son.value, limit: f.limit.value, notu: f.notu.value, aktif: eski ? eski.aktif : true }, 'Kaydedildi.')
      .then(function () { f.reset(); f.p1.checked = f.p2.checked = true; });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-promo-ac], [data-promo-sil], [data-promo-duzen]'); if (!b) return;
    var kod = b.getAttribute('data-promo-ac') || b.getAttribute('data-promo-sil') || b.getAttribute('data-promo-duzen'), k = promolar.find(function (x) { return x.kod === kod; }); if (!k) return;
    if (b.hasAttribute('data-promo-sil')) { if (window.confirm(kod + ' kodu silinsin mi?')) promoGonder({ kod: kod, sil: true }, 'Silindi.'); return; }
    if (b.hasAttribute('data-promo-ac')) { promoGonder(Object.assign({}, k, { aktif: !k.aktif }), k.aktif ? 'Kapatıldı.' : 'Açıldı.'); return; }
    var f = $('#promo-form'); f.kod.value = k.kod; f.tip.value = k.tip; f.deger.value = k.deger; f.p1.checked = (k.paketler || []).includes('1'); f.p2.checked = (k.paketler || []).includes('2');
    f.bas.value = k.bas || ''; f.son.value = k.son || ''; f.limit.value = k.limit || ''; f.notu.value = k.notu || ''; f.kod.focus(); f.scrollIntoView({ block: 'center' });
  });

  // harcama formu
  $('#harcama').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, g = { gun: f.gun.value, kanal: f.kanal.value, tutar: f.tutar.value, notu: f.notu.value };
    istek('/api/harcama', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) })
      .then(function (v) { $('#harcama-sonuc').textContent = v.tamam ? 'Kaydedildi.' : 'Kaydedilemedi: ' + (v.hata || ''); if (v.tamam) { f.tutar.value = ''; f.notu.value = ''; yukle(); } });
  });

  // kampanya bağlantısı
  var utm = $('#utm');
  var sadeyap = function (v) { return String(v || '').toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); };
  function utmCiz() {
    var hz = utm.hazir.value.split('|');
    if (hz[0] !== 'ozel') { utm.kaynak.value = hz[0]; utm.ortam.value = hz[1]; }
    var p = new URLSearchParams();
    if (utm.kaynak.value) p.set('utm_source', sadeyap(utm.kaynak.value));
    if (utm.ortam.value) p.set('utm_medium', sadeyap(utm.ortam.value));
    if (utm.kampanya.value) p.set('utm_campaign', sadeyap(utm.kampanya.value));
    if (utm.icerik.value) p.set('utm_content', sadeyap(utm.icerik.value));
    $('#utm-sonuc').textContent = 'https://www.livexa.com.tr' + utm.sayfa.value + (p.toString() ? '?' + p.toString() : '');
  }
  utm.addEventListener('input', utmCiz); utm.addEventListener('change', utmCiz); utmCiz();
  $('#utm-kopyala').addEventListener('click', function () { var t = $('#utm-sonuc').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('#utm-kopyala').textContent = 'Kopyalandı'; setTimeout(function () { $('#utm-kopyala').textContent = 'Bağlantıyı kopyala'; }, 1500); }, function () {}); });

  // ipucu
  var ip = $('#ipucu');
  function ipucu(e, metin) { ip.textContent = metin; ip.hidden = false; var x = Math.min(e.clientX + 14, window.innerWidth - ip.offsetWidth - 8); ip.style.left = x + 'px'; ip.style.top = (e.clientY - 36) + 'px'; }
  function ipucuGizle() { ip.hidden = true; }
  document.addEventListener('mousemove', function (e) { var t = e.target.closest && e.target.closest('[data-ipucu]'); if (t) ipucu(e, t.getAttribute('data-ipucu')); else if (!e.target.closest('.hedef')) ipucuGizle(); });

  yukle();
  setInterval(function () { if (document.visibilityState === 'visible' && parola && $('#giris').hidden) yukle(); }, 120000);
})();
