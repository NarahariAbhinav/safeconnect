// SafeConnect Dashboard - Clean Rewrite
// NOTE: Must be served via http:// (not file://) for Firebase to work.
// Run: npx serve . OR python -m http.server 8080
var FB = 'https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app';
var map, D = {}, ML = { sos: [], needs: [], help: [], camps: [], teams: [], dist: [], trails: [], heat: null };
var prev = new Set(), cZ = 'all', cD = '', lr = Date.now(), WM = 30 * 60 * 1000;
var heatOn = false, heatLayer = null;

// === Clock ===
function tick() { var n = new Date(); $('clk').textContent = n.toLocaleTimeString('en-IN', { hour12: false }); $('clkd').textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }
tick(); setInterval(tick, 1000);
setInterval(function () { var s = Math.floor((Date.now() - lr) / 1000); $('upd').textContent = 'Updated ' + s + 's ago'; }, 1000);

// === Sound Alert ===
function beep(f, d, v) { try { var c = new (window.AudioContext || window.webkitAudioContext)(); var o = c.createOscillator(); var g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f || 880; g.gain.setValueAtTime(v || .4, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + (d || .5)); o.start(); o.stop(c.currentTime + (d || .5)); } catch (e) { } }
function sos_beep() { beep(880, .2, .5); setTimeout(function () { beep(880, .2, .5); }, 250); setTimeout(function () { beep(1100, .4, .6); }, 500); }

// === Map ===
function initMap() { map = L.map('map', { zoomControl: false, attributionControl: false }).setView([17.75, 79.5], 7); L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map); L.control.zoom({ position: 'bottomright' }).addTo(map); }
function ic(e, c, s) { s = s || 30; return L.divIcon({ className: '', html: '<div style="width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:' + c + ';display:flex;align-items:center;justify-content:center;font-size:' + Math.round(s * .4) + 'px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)">' + e + '</div>', iconSize: [s, s], iconAnchor: [s / 2, s / 2] }); }
function clr() {
    Object.keys(ML).forEach(function (k) {
        if (!Array.isArray(ML[k])) return;
        ML[k].forEach(function (m) { map.removeLayer(m); });
        ML[k].length = 0;
    });
}

// === Helpers ===
function $(id) { return document.getElementById(id); }
function ago(t) { if (!t) return '\u2014'; var s = Math.floor((Date.now() - t) / 1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return new Date(t).toLocaleDateString('en-IN'); }
function ini(n) { return (n || '?').split(' ').map(function (w) { return w[0] || ''; }).join('').toUpperCase().slice(0, 2); }
function fly(a, b, z) { if (a && b) map.flyTo([a, b], z || 13, { animate: true, duration: 1 }); }
var _SD = []; // SOS data store — referenced by index in onclick handlers
function sid(o) { _SD.push(o); return _SD.length - 1; } // Store object, return index
function sget(i) { return _SD[i]; } // Retrieve by index
function rw(l, v) { return '<div class="mr"><div class="ml">' + l + '</div><div class="mv">' + v + '</div></div>'; }
function cm() { $('mbg').className = 'mbg'; }
function toast(t, b, c) { var z = $('tz'), el = document.createElement('div'); el.className = 'toast'; el.style.borderLeftColor = c || '#C62828'; el.innerHTML = '<div class="toast-t" style="color:' + (c || '#C62828') + '">' + t + '</div><div class="toast-b">' + b + '</div>'; z.appendChild(el); setTimeout(function () { el.remove(); }, 6000); }

// === Fetch with diagnostics ===
var _fetchErr = false;
var _hasRendered = false; // true once data has been displayed at least once
async function get(p) {
    try {
        var r = await fetch(FB + '/' + p + '.json', { cache: 'no-cache', mode: 'cors' });
        if (!r.ok) { console.error('[SC] Firebase HTTP ' + r.status + ' for /' + p); return {}; }
        var data = await r.json();
        _fetchErr = false;
        return data || {};
    } catch (e) {
        console.error('[SC] Fetch failed for /' + p + ':', e.message);
        _fetchErr = true;
        return {};
    }
}

// === Load ===
async function load() {
    try {
        var [soss, needss, resources, camps, teams, dists] = await Promise.all([
            get('soss'), get('needss'), get('resources'),
            get('relief_camps'), get('govt_rescue_teams'), get('govt_districts')
        ]);
        D = { soss: soss, needss: needss, resources: resources, camps: camps, teams: teams, dists: dists };

        if (_fetchErr) {
            // Network error on this cycle
            $('con-dot').style.background = '#DC2626';
            $('con-lbl').textContent = 'Offline';
            if (!_hasRendered) {
                showConnError(); // First load failed — show error in panels
                return;
            } else {
                toast('⚠️ Connection issue', 'Showing last known data', '#D97706');
                // Don't return — fall through and render with whatever data we have
            }
        } else {
            $('con-dot').style.background = 'var(--green)';
            $('con-lbl').textContent = 'LIVE';
        }

        // Detect new SOS
        var ck = new Set(Object.keys(soss || {}));
        if (prev.size > 0) ck.forEach(function (k) {
            if (!prev.has(k)) {
                var s = soss[k];
                toast('&#128680; NEW SOS: ' + (s.userName || 'Unknown'),
                    s.gps && s.gps.address ? s.gps.address : 'Location captured', '#DC2626');
                sos_beep();
            }
        });
        prev = ck;
        render(); fillDD(); lr = Date.now();
        _hasRendered = true;
        checkCampBanner();
    } catch (e) {
        console.error('[SC] load() error:', e);
        if (!_hasRendered) showConnError();
        else toast('⚠️ Refresh error', e.message, '#DC2626');
    }
}

function showConnError() {
    var isFileProto = location.protocol === 'file:';
    var msg = '<div class="emp" style="padding:30px 16px">' +
        '<div class="emp-i">' + (isFileProto ? '&#128196;' : '&#128268;') + '</div>' +
        '<div class="emp-t" style="color:#DC2626">' + (isFileProto ? 'Open via HTTP server' : 'Cannot connect to Firebase') + '</div>' +
        '<div class="emp-b">' + (isFileProto ?
            'This dashboard cannot fetch data when opened as a <b>file://</b>.<br><br>' +
            '&#128073; Run this in your terminal:<br><br>' +
            '<code style="background:#1A1A2E;color:#6EE7B7;padding:8px 12px;border-radius:8px;font-size:11px;display:block;margin-top:6px">npx serve .</code><br>' +
            'Then open <b>http://localhost:3000</b>' :
            'Check your internet connection.<br>The database may be temporarily unavailable.') +
        '</div>' +
        '<button onclick="load()" style="margin-top:14px;padding:9px 20px;background:#E05A2B;color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">&#8635; Retry Now</button>' +
        '</div>';
    ['p-sos', 'p-needs', 'p-help', 'p-camps', 'p-teams'].forEach(function (id) {
        var el = $(id); if (el) el.innerHTML = msg;
    });
}

// === Render ===
function render() {
    _SD = []; // clear data store each render cycle
    var sl = filt(ov(D.soss).filter(function (s) { return s.isActive; }));
    var nl = filt(ov(D.needss)); var hl = filt(ov(D.resources));
    var cl = filtC(ov(D.camps).filter(function (c) { return c.isActive; }));
    var tl = ov(D.teams); var dl = ov(D.dists);
    // Stats
    $('nsos').textContent = sl.length; $('nnds').textContent = nl.length; $('nhlp').textContent = hl.length;
    $('ncmp').textContent = cl.length; $('ntms').textContent = tl.length;
    $('bsos').textContent = sl.length; $('bnds').textContent = nl.length; $('bhlp').textContent = hl.length;
    // Map
    clr(); markers(sl, nl, hl, cl, tl, dl);
    // Panels
    pSOS(sl); pNeeds(nl); pHelp(hl); pCamps(cl); pTeams(tl); pDists(dl);
}
function ov(o) { return Object.values(o || {}); }
function filt(a) { if (cZ === 'all' && !cD) return a; return a.filter(function (x) { if (cD && (x.district || '').toLowerCase().indexOf(cD.toLowerCase()) < 0) return false; return true; }); }
function filtC(a) { if (cZ === 'all' && !cD) return a; return a.filter(function (c) { if (cD && (c.district || '').toLowerCase().indexOf(cD.toLowerCase()) < 0) return false; if (cZ !== 'all' && (c.zone || '') !== cZ) return false; return true; }); }

// === Zone/District Filter ===
function sz(z) { cZ = z; cD = ''; $('dsel').value = '';['all', 'cen', 'nw', 'ne', 'se', 'sw'].forEach(function (k) { $('z-' + k).className = 'fc'; }); var m = { all: 'all', Central: 'cen', 'North West': 'nw', 'North East': 'ne', 'South East': 'se', 'South West': 'sw' }; var e = $('z-' + (m[z] || 'all')); if (e) e.className = 'fc on'; $('dbar').className = 'dbar'; render(); }
function sd(n) { if (!n) { cD = ''; $('dbar').className = 'dbar'; render(); return; } cD = n; var d = ov(D.dists).find(function (x) { return x.name === n; }); if (d) { $('dbar').className = 'dbar on'; $('dbtxt').innerHTML = '<b>' + d.name + '</b> &#183; ECR: ' + d.ecr + ' &#183; Collector: ' + d.collector + ' &#183; Zone: ' + d.zone; if (d.lat && d.lng) map.flyTo([d.lat, d.lng], 10, { animate: true, duration: 1 }); } render(); }
function cd() { cD = ''; $('dsel').value = ''; $('dbar').className = 'dbar'; render(); }
function fillDD() { var s = $('dsel'); if (s.options.length > 1) return; ov(D.dists).sort(function (a, b) { return (a.name || '').localeCompare(b.name); }).forEach(function (d) { var o = document.createElement('option'); o.value = d.name; o.textContent = d.name; s.appendChild(o); }); }

// === Markers ===
function markers(sos, needs, help, camps, teams, dists) {
    sos.filter(function (s) { return s.gps && s.gps.latitude; }).forEach(function (s) {
        var batBadge = s.batteryCritical ? ' <span class="lptag" style="background:#FFEBEE;color:#C62828">ðŸª« ' + (s.batteryLevel || '?') + '%</span>' : '';
        var m = L.marker([s.gps.latitude, s.gps.longitude], { icon: ic('&#128680;', '#C62828', 38) }).addTo(map).bindPopup('<div class="lpt" style="color:#C62828">SOS: ' + (s.userName || '?') + '</div><div class="lpr">' + (s.gps.address || 'GPS captured') + '</div><div class="lpr">' + ago(s.activatedAt) + '</div><span class="lptag" style="background:#FFEBEE;color:#C62828">ACTIVE</span>' + batBadge);
        m.on('click', function () { showSOS(s); }); ML.sos.push(m);
        // Draw location trail if available
        if (s.locationTrail && Array.isArray(s.locationTrail) && s.locationTrail.length > 1) {
            var pts = s.locationTrail.map(function (p) { return [p.latitude, p.longitude]; });
            var trail = L.polyline(pts, { color: '#C62828', weight: 3, opacity: 0.6, dashArray: '8, 6' }).addTo(map);
            trail.bindPopup('<div class="lpt" style="color:#C62828">Movement Trail</div><div class="lpr">' + s.locationTrail.length + ' points Â· ' + (s.userName || '?') + '</div>');
            ML.trails.push(trail);
        }
    });
    needs.filter(function (n) { return n.gps && n.gps.latitude; }).forEach(function (n) {
        var m = L.marker([n.gps.latitude, n.gps.longitude], { icon: ic('&#128203;', '#D84315', 28) }).addTo(map).bindPopup('<div class="lpt" style="color:#D84315">Needs: ' + (n.userName || '?') + '</div><div class="lpr">' + ((n.needs || []).join(', ') || '\u2014') + '</div><div class="lpr">People: ' + (n.peopleCount || 1) + '</div>');
        ML.needs.push(m);
    });
    help.filter(function (r) { return r.gps && r.gps.latitude; }).forEach(function (r) {
        var m = L.marker([r.gps.latitude, r.gps.longitude], { icon: ic('&#129309;', '#2A7A5A', 28) }).addTo(map).bindPopup('<div class="lpt" style="color:#2A7A5A">Helps: ' + (r.userName || '?') + '</div><div class="lpr">' + ((r.resources || []).join(', ') || '\u2014') + '</div>');
        ML.help.push(m);
    });
    camps.filter(function (c) { return (c.gps && c.gps.latitude) || c.latitude; }).forEach(function (c) {
        var lat = (c.gps && c.gps.latitude) || c.latitude;
        var lng = (c.gps && c.gps.longitude) || c.longitude;
        var pct = Math.round((c.currentOccupancy / c.capacity) * 100) || 0;
        var cl = pct > 90 ? '#C62828' : pct > 70 ? '#D84315' : '#1565C0';
        var m = L.marker([lat, lng], { icon: ic('&#9978;', cl, 28) }).addTo(map)
            .bindPopup('<div class="lpt" style="color:#1565C0">' + c.name + '</div><div class="lpr">' + c.currentOccupancy + '/' + c.capacity + ' (' + pct + '%)</div>');
        ML.camps.push(m);
    });
    teams.filter(function (t) { return t.lat; }).forEach(function (t) {
        var m = L.marker([t.lat, t.lng], { icon: ic('&#128658;', '#2A7A5A', 28) }).addTo(map).bindPopup('<div class="lpt" style="color:#2A7A5A">' + t.name + '</div><div class="lpr">' + t.contact + '</div>');
        ML.teams.push(m);
    });
    if (cZ === 'all' && !cD) dists.forEach(function (d) {
        var m = L.circleMarker([d.lat, d.lng], { radius: 5, fillColor: '#E05A2B', color: 'white', weight: 1.5, fillOpacity: .85 }).addTo(map).bindPopup('<div class="lpt" style="color:#E05A2B">' + d.name + '</div><div class="lpr">ECR: ' + d.ecr + '</div><div class="lpr">Zone: ' + d.zone + '</div>');
        ML.dist.push(m);
    });
}

// === SOS Panel ===
function pSOS(list) {
    var p = $('p-sos');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#10004;</div><div class="emp-t">No Active SOS</div><div class="emp-b">All clear in selected area.</div></div>'; return; }
    list.sort(function (a, b) { return b.activatedAt - a.activatedAt; });
    p.innerHTML = '<div class="ph">Active SOS &#8212; ' + list.length + '</div><div class="grid-wrap">' + list.map(function (s) {
        var w = Date.now() - s.activatedAt > WM;
        var dispatched = s.govtAction && s.govtAction.status;
        var dispBadge = dispatched ? '<span class="p pg">&#10004; ' + (s.govtAction.status || 'Dispatched').replace(/_/g, ' ') + '</span>' : '';
        var batBadge = s.batteryCritical ? '<span class="p pw">&#128267; ' + (s.batteryLevel || '?') + '%</span>' : '';
        var btnLabel = dispatched ? '&#128221; Update' : '&#128658; Dispatch';
        var btnBg = dispatched ? 'var(--blue)' : 'var(--green)';
        var idx = sid(s);
        return '<div class="cd" onclick="showSOS(' + idx + ')"><div class="cs" style="background:' + (dispatched ? '#2A7A5A' : '#C62828') + '"></div><div class="cr"><div class="ca" style="background:var(--red-lt);color:var(--red)">' + ini(s.userName) + '</div><div style="overflow:hidden"><div class="cn">' + (s.userName || 'Unknown') + '</div><div class="csub">' + (s.gps && s.gps.address ? s.gps.address : 'GPS captured') + '</div></div></div><div class="cf">' + (w ? '<span class="p pw">&#9888; ' + Math.floor((Date.now() - s.activatedAt) / 60000) + 'm</span>' : '') + '<span class="p pr">&#128308; ACTIVE</span>' + dispBadge + batBadge + (s.viaBleMesh ? '<span class="p py">BLE Mesh</span>' : '') + '<span class="ts">' + ago(s.activatedAt) + '</span></div><div class="cf" style="margin-top:4px"><button class="dbtn" style="background:' + btnBg + '" onclick="event.stopPropagation();dispatch(' + idx + ')">' + btnLabel + '</button><button class="dbtn" style="background:#7B1FA2" onclick="event.stopPropagation();resolveSOS(' + idx + ')">&#10003; Resolve</button></div></div>';
    }).join('') + '</div>';
}

// === SOS Modal ===
function showSOS(i) {
    var s = typeof i === 'number' ? sget(i) : (typeof i === 'string' ? JSON.parse(i) : i); var la = s.gps && s.gps.latitude, ln = s.gps && s.gps.longitude; var idx = typeof i === 'number' ? i : sid(s);
    var ga = s.govtAction; var gaSection = '';
    if (ga && ga.status) {
        gaSection = '<div style="margin:10px 0 6px;padding:8px 10px;background:rgba(42,122,90,0.08);border-radius:8px;border:1px solid rgba(42,122,90,0.2)">' +
            '<div style="font-size:10px;font-weight:800;color:#2A7A5A;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">&#10004; Response Sent to User</div>' +
            rw('Action', '<span class="p pg">' + (ga.status || '').replace(/_/g, ' ') + '</span>') +
            rw('Message', ga.message || 'â€”') +
            (ga.officerName ? rw('Officer', ga.officerName) : '') +
            (ga.estimatedArrival ? rw('ETA', ga.estimatedArrival) : '') +
            (ga.campName ? rw('Camp', ga.campName) : '') +
            rw('Sent At', ga.dispatchedAt ? new Date(ga.dispatchedAt).toLocaleString('en-IN') : 'â€”') +
            '<div style="font-size:9px;color:#2A7A5A;margin-top:6px;font-weight:600">&#8505; User sees this on their SOS screen (via internet or BLE mesh)</div></div>';
    }
    var trailRow = s.locationTrail && Array.isArray(s.locationTrail) && s.locationTrail.length > 0 ? rw('Trail', '&#128205; ' + s.locationTrail.length + ' GPS points') : '';
    var batRow = s.batteryCritical ? rw('Battery', '<span style="color:#C62828;font-weight:700">&#128267; CRITICAL â€” ' + (s.batteryLevel || '?') + '%</span>') : '';
    var btnLbl = ga ? '&#128221; Update' : '&#128658; Dispatch';
    var body = rw('Status', '<span class="p pr">&#128308; ACTIVE</span>') + rw('Address', (s.gps && s.gps.address) || 'â€”') + rw('GPS', (la ? la.toFixed(6) : 'â€”') + ', ' + (ln ? ln.toFixed(6) : 'â€”')) + rw('Time', s.activatedAt ? new Date(s.activatedAt).toLocaleString('en-IN') : 'â€”') + rw('Contacts', (s.contactsNotified && s.contactsNotified.join(', ')) || 'None') + rw('Mode', s.viaBleMesh ? 'BLE Mesh Relay' : 'Direct Upload') + batRow + trailRow + gaSection;
    $('mbox').innerHTML = '<div class="mh"><div class="ca" style="background:var(--red-lt);color:var(--red);width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">' + ini(s.userName) + '</div><div class="mt">SOS &#8212; ' + (s.userName || 'Unknown') + '</div><button class="mx" onclick="cm()">&#10005;</button></div><div class="mb">' + body + '</div><div class="mf">' + (la && ln ? '<a class="mbtn mbp" href="https://www.google.com/maps?q=' + la + ',' + ln + '" target="_blank">&#128506; Maps</a>' : '') + '<button class="mbtn mbp" style="background:var(--green)" onclick="cm();dispatch(' + idx + ')">' + btnLbl + '</button><button class="mbtn" style="background:#7B1FA2;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer" onclick="cm();resolveSOS(' + idx + ')">&#10003; Person Safe</button><button class="mbtn mbs" onclick="cm()">Close</button></div>';
    $('mbg').className = 'mbg on'; if (la && ln) map.flyTo([la, ln], 14, { animate: true, duration: 1 });
}

// === Dispatch Rescue ===
function dispatch(i) {
    var s = typeof i === 'number' ? sget(i) : (typeof i === 'string' ? JSON.parse(i) : i); var idx = typeof i === 'number' ? i : sid(s);
    $('mbox').innerHTML = '<div class="mh"><div class="mt">&#128658; Dispatch &#8212; ' + s.userName + '</div><button class="mx" onclick="cm()">&#10005;</button></div><div class="mb">' +
        '<div class="mr"><div class="ml">Action</div><div class="mv"><select id="ds" class="inp"><option value="acknowledged">&#10004; Acknowledged</option><option value="rescue_dispatched" selected>&#128658; Rescue Dispatched</option><option value="camp_assigned">&#9978; Camp Assigned</option><option value="resolved">&#128994; Resolved</option></select></div></div>' +
        '<div class="mr"><div class="ml">Message</div><div class="mv"><textarea id="dm" rows="3" class="inp" placeholder="e.g. NDRF team dispatched from Hyderabad. Stay in place."></textarea></div></div>' +
        '<div class="mr"><div class="ml">Officer</div><div class="mv"><input id="do" class="inp" placeholder="e.g. Inspector Raju"></div></div>' +
        '<div class="mr"><div class="ml">ETA</div><div class="mv"><input id="de" class="inp" placeholder="e.g. 20 minutes"></div></div>' +
        '<div class="mr"><div class="ml">Camp</div><div class="mv"><input id="dc" class="inp" placeholder="Camp name (optional)"></div></div>' +
        '</div><div class="mf"><button class="mbtn mbp" style="background:var(--green)" onclick="sendD(' + idx + ')">&#128658; Send to User</button><button class="mbtn mbs" onclick="cm()">Cancel</button></div>';
    $('mbg').className = 'mbg on';
}
async function sendD(i) {
    var s = typeof i === 'number' ? sget(i) : (typeof i === 'string' ? JSON.parse(i) : i);
    var msg = $('dm').value.trim(); if (!msg) { alert('Enter a message.'); return; }
    var a = { sosId: s.id, status: $('ds').value, message: msg, dispatchedAt: Date.now(), officerName: $('do').value.trim() || undefined, estimatedArrival: $('de').value.trim() || undefined, campName: $('dc').value.trim() || undefined };
    try {
        var r = await fetch(FB + '/soss/' + s.id + '/govtAction.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
        if (r.ok) { cm(); toast('&#10004; Sent', '"' + msg + '" sent to ' + s.userName, '#2A7A5A'); load(); } else { alert('Failed.'); }
    } catch (e) { alert('Error: ' + e.message); }
}


// === Resolve SOS (person has been helped) ===
async function resolveSOS(i) {
    var s = typeof i === 'number' ? sget(i) : (typeof i === 'string' ? JSON.parse(i) : i);
    var name = s.userName || 'Unknown';
    if (!confirm('Mark "' + name + '" as RESOLVED? This removes them from the active SOS list.')) return;
    try {
        var r = await fetch(FB + '/soss/' + s.id + '.json', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false, deactivatedAt: Date.now(), resolvedBy: 'dashboard' })
        });
        if (r.ok) { cm(); toast('&#10003; Resolved', name + ' marked as safe & resolved', '#2A7A5A'); load(); }
        else { alert('Failed to resolve.'); }
    } catch (e) { alert('Error: ' + e.message); }
}

// === Needs Panel ===
var NE = { food: '&#127838;', water: '&#128167;', medicine: '&#128138;', shelter: '&#127968;', rescue: '&#128641;', medical_help: '&#129466;' };
function pNeeds(list) {
    var p = $('p-needs');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#128203;</div><div class="emp-t">No Needs</div><div class="emp-b">When someone taps "I Need Help" in the app, requests appear here.</div></div>'; return; }
    list.sort(function (a, b) { return (b.reportedAt || 0) - (a.reportedAt || 0); });
    p.innerHTML = '<div class="ph">"I Need Help" &#8212; ' + list.length + '</div><div class="grid-wrap">' + list.map(function (n) {
        var icons = (n.needs || []).map(function (k) { return NE[k] || '?'; }).join(' ');
        return '<div class="cd" onclick="fly(' + (n.gps && n.gps.latitude || 0) + ',' + (n.gps && n.gps.longitude || 0) + ')"><div class="cs" style="background:#D84315"></div><div class="cr"><div class="ca" style="background:var(--amber-lt);color:var(--amber)">' + icons + '</div><div style="overflow:hidden"><div class="cn">' + (n.userName || 'Unknown') + '</div><div class="csub">' + (n.gps && n.gps.address ? n.gps.address : 'GPS') + '</div></div></div><div class="cb">Needs: <b>' + ((n.needs || []).join(', ') || '\u2014') + '</b></div><div class="cf"><span class="p pa">NEEDS HELP</span><span class="p py">' + (n.peopleCount || 1) + ' ppl</span><span class="ts">' + ago(n.reportedAt) + '</span></div></div>';
    }).join('') + '</div>';
}

// === Help Panel ===
var RE = { food: '&#127838;', water: '&#128167;', medicine: '&#128138;', shelter: '&#127968;', vehicle: '&#128663;', medical_skills: '&#129466;', space: '&#128719;' };
function pHelp(list) {
    var p = $('p-help');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#129309;</div><div class="emp-t">No Help Offers</div><div class="emp-b">When someone taps "I Can Help", offers appear here.</div></div>'; return; }
    list.sort(function (a, b) { return (b.offeredAt || 0) - (a.offeredAt || 0); });
    p.innerHTML = '<div class="ph">Volunteers — ' + list.length + '</div><div class="grid-wrap">' + list.map(function (r) {
        var icons = (r.resources || []).map(function (k) { return RE[k] || '?'; }).join(' ');
        return '<div class="cd" onclick="fly(' + (r.gps && r.gps.latitude || 0) + ',' + (r.gps && r.gps.longitude || 0) + ')"><div class="cs" style="background:#2A7A5A"></div><div class="cr"><div class="ca" style="background:var(--green-lt);color:var(--green)">' + icons + '</div><div style="overflow:hidden"><div class="cn">' + (r.userName || 'Volunteer') + '</div><div class="csub">' + (r.gps && r.gps.address ? r.gps.address : 'GPS') + '</div></div></div><div class="cb">Offering: <b>' + ((r.resources || []).join(', ') || '\u2014') + '</b></div><div class="cf"><span class="p pg">CAN HELP</span><span class="ts">' + ago(r.offeredAt) + '</span></div></div>';
    }).join('') + '</div>';
}

// === Camps Panel ===
function pCamps(list) {
    var p = $('p-camps');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#9978;</div><div class="emp-t">No Camps</div><div class="emp-b">No relief camps for this area.</div></div>'; return; }
    list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    p.innerHTML = '<div class="ph">Relief Camps &#8212; ' + list.length + '</div><div class="grid-wrap">' + list.map(function (c) {
        var clat = (c.gps && c.gps.latitude) || c.latitude || 0;
        var clng = (c.gps && c.gps.longitude) || c.longitude || 0;
        var pct = Math.round((c.currentOccupancy / c.capacity) * 100) || 0;
        var bc = pct > 90 ? '#C62828' : pct > 70 ? '#D84315' : '#2A7A5A';
        var pc = pct > 90 ? 'pr' : pct > 70 ? 'pa' : 'pg';
        var lb = pct > 90 ? 'Near Full' : pct > 70 ? 'Filling' : 'Available';
        return '<div class="cd" onclick="fly(' + clat + ',' + clng + ')"><div class="cs" style="background:#1565C0"></div><div class="cr"><div class="ca" style="background:var(--blue-lt);color:var(--blue)">&#9978;</div><div style="overflow:hidden"><div class="cn">' + c.name + '</div><div class="csub">' + c.district + '</div></div></div><div class="cpw"><div class="cpb" style="width:' + pct + '%;background:' + bc + '"></div></div><div class="cpl">' + c.currentOccupancy + '/' + c.capacity + ' (' + pct + '%)</div><div class="rcs">' + (c.resources || []).map(function (r) { return '<span class="rc">' + r + '</span>'; }).join('') + '</div><div class="cf" style="margin-top:4px"><span class="p ' + pc + '">' + lb + '</span>' + (c.isGovtRegistered ? '<span class="p po">Govt</span>' : '') + '</div></div>';
    }).join('') + '</div>';
}

// === Teams Panel ===
function pTeams(list) {
    var p = $('p-teams');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#128658;</div><div class="emp-t">Loading...</div></div>'; return; }
    p.innerHTML = '<div class="ph">Rescue Teams &#8212; ' + list.length + '</div><div class="grid-wrap">' + list.map(function (t) {
        return '<div class="cd" onclick="fly(' + (t.lat || 0) + ',' + (t.lng || 0) + ')"><div class="cs" style="background:#2A7A5A"></div><div class="cr"><div class="ca" style="background:var(--green-lt);color:var(--green)">&#128658;</div><div style="overflow:hidden"><div class="cn">' + t.name + '</div><div class="csub">' + t.totalTeams + ' teams</div></div></div><div class="cb">' + t.headquarters + '</div><div class="rcs" style="margin-top:4px">' + (t.capabilities || []).map(function (c) { return '<span class="rc">' + c + '</span>'; }).join('') + '</div><div class="cf" style="margin-top:4px"><span class="p py">' + t.type + '</span></div></div>';
    }).join('') + '</div>';
}

// === Districts Panel ===
function pDists(list) {
    var p = $('p-districts');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#127963;</div><div class="emp-t">Loading...</div></div>'; return; }
    list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    var zones = [...new Set(list.map(function (d) { return d.zone; }))].sort();
    var h = '<div class="ph">33 Districts &#8212; Click to filter</div>';
    zones.forEach(function (z) {
        var zd = list.filter(function (d) { return d.zone === z; });
        h += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:800;color:var(--orange);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;padding:4px 8px;background:var(--orange-lt);border-radius:6px">' + z + ' (' + zd.length + ')</div><div class="grid-wrap">' + zd.map(function (d) {
            return '<div class="cd" onclick="sd(\'' + d.name + '\')" style="padding:10px"><div class="cs" style="background:var(--orange)"></div><div style="padding-left:6px"><div class="cn">' + d.name + '</div><div class="csub">ECR: ' + d.ecr + '</div><span class="p po" style="font-size:7px;margin-top:4px">' + d.districtCode + '</span></div></div>';
        }).join('') + '</div></div>';
    });
    p.innerHTML = h;
}

// === Tab Switch (updated to include new tabs) ===
function go(n) {
    var all = ['sos', 'needs', 'help', 'camps', 'teams', 'districts', 'match', 'sitrep', 'resp'];
    all.forEach(function (t) {
        var tb = $('t-' + t), pn = $('p-' + t), st = $('s-' + t);
        if (tb) tb.className = 'tb' + (t === n ? ' on' : '');
        if (pn) pn.className = 'pnl' + (t === n ? ' on' : '');
        if (st) st.className = 'st' + (t === n ? ' on' : '');
    });
}

// === Feature 1: Heatmap Toggle ===
function togHeat() {
    if (!heatOn) {
        var pts = [];
        ov(D.soss || {}).filter(function (s) { return s.isActive && s.gps && s.gps.latitude; }).forEach(function (s) {
            pts.push([s.gps.latitude, s.gps.longitude, 1.0]);
        });
        ov(D.needss || {}).filter(function (n) { return n.gps && n.gps.latitude; }).forEach(function (n) {
            pts.push([n.gps.latitude, n.gps.longitude, 0.5]);
        });
        if (pts.length === 0) { toast('No Data', 'No GPS points to show heatmap for.', '#1565C0'); return; }
        heatLayer = L.heatLayer(pts, {
            radius: 35, blur: 20, maxZoom: 12,
            gradient: { 0.2: '#1565C0', 0.5: '#E65100', 0.8: '#C62828', 1.0: '#7B1FA2' }
        }).addTo(map);
        heatOn = true;
        $('heat-btn').style.background = '#C62828';
        $('heat-btn').style.color = '#fff';
        $('heat-btn').style.borderColor = '#C62828';
        toast('&#127754; Heatmap ON', 'Showing SOS + Needs density', '#C62828');
    } else {
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        heatOn = false;
        $('heat-btn').style.background = '';
        $('heat-btn').style.color = '';
        $('heat-btn').style.borderColor = '';
        toast('Heatmap OFF', 'Heatmap hidden', '#2A7A5A');
    }
}

// === Feature 2: Camp Capacity Alert Banner ===
function checkCampBanner() {
    var nearFull = ov(D.camps || {}).filter(function (c) {
        return c.isActive && c.capacity > 0 && (c.currentOccupancy / c.capacity) >= 0.80;
    });
    var banner = $('camp-banner');
    if (!banner) return;
    if (nearFull.length > 0) {
        var names = nearFull.map(function (c) {
            return c.name + ' (' + Math.round((c.currentOccupancy / c.capacity) * 100) + '%)';
        }).join(' &#183; ');
        $('camp-banner-txt').innerHTML = '&#9888; ' + nearFull.length + ' camp(s) near/at capacity: ' + names;
        banner.classList.add('on');
    } else {
        banner.classList.remove('on');
    }
}

// === Feature 3: Need-Volunteer Matcher ===
function haversine(la1, lo1, la2, lo2) {
    var R = 6371, dLat = (la2 - la1) * Math.PI / 180, dLon = (lo2 - lo1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function runMatch() {
    var p = $('p-match'); if (!p) return;
    var needs = ov(D.needss || {}).filter(function (n) { return n.gps && n.gps.latitude; });
    var vols = ov(D.resources || {}).filter(function (r) { return r.gps && r.gps.latitude; });
    if (!needs.length || !vols.length) {
        p.innerHTML = '<div class="emp"><div class="emp-i">&#129309;</div><div class="emp-t">No matches yet</div><div class="emp-b">Needs &amp; Volunteer offers will be matched here automatically.</div></div>';
        return;
    }
    var pairs = [];
    needs.forEach(function (n) {
        var nNeeds = n.needs || [];
        var best = null, bestDist = Infinity;
        vols.forEach(function (v) {
            var vRes = v.resources || [];
            var overlap = nNeeds.filter(function (k) { return vRes.indexOf(k) > -1; });
            if (overlap.length === 0) return;
            var d = haversine(n.gps.latitude, n.gps.longitude, v.gps.latitude, v.gps.longitude);
            if (d < bestDist) { bestDist = d; best = { vol: v, overlap: overlap, dist: d }; }
        });
        if (best) pairs.push({ need: n, vol: best.vol, overlap: best.overlap, dist: best.dist });
    });
    pairs.sort(function (a, b) { return a.dist - b.dist; });
    if (!pairs.length) {
        p.innerHTML = '<div class="emp"><div class="emp-i">&#129309;</div><div class="emp-t">No resource overlap found</div><div class="emp-b">No volunteer offers match current needs categories.</div></div>';
        return;
    }
    p.innerHTML = '<div class="ph">Best Matches &#8212; ' + pairs.length + '</div>' +
        pairs.map(function (pr) {
            var la = pr.need.gps.latitude, lo = pr.need.gps.longitude;
            return '<div class="match-pair">' +
                '<div class="mph">Matched on: ' + pr.overlap.join(', ') + '</div>' +
                '<div class="match-row">' +
                '<div class="match-side">' +
                '<div class="match-name" style="color:#D84315">&#128203; ' + (pr.need.userName || 'Unknown') + '</div>' +
                '<div class="match-detail">' + (pr.need.gps.address || 'GPS location') + '<br>Needs: ' + (pr.need.needs || []).join(', ') + '</div>' +
                '</div>' +
                '<div class="match-arrow">&#8594;</div>' +
                '<div class="match-side">' +
                '<div class="match-name" style="color:#2A7A5A">&#129309; ' + (pr.vol.userName || 'Volunteer') + '</div>' +
                '<div class="match-detail">' + (pr.vol.gps.address || 'GPS location') + '<br>Offers: ' + (pr.vol.resources || []).join(', ') + '</div>' +
                '</div>' +
                '</div>' +
                '<div class="match-dist">&#128205; ' + pr.dist.toFixed(1) + ' km apart</div>' +
                '<button class="match-btn" onclick="fly(' + la + ',' + lo + ')">&#128506; Show on Map</button>' +
                '</div>';
        }).join('');
}

// === Feature 4: SITREP Auto-Generator ===
function genSITREP() {
    var el = $('sitrep-out'); if (!el) return;
    var now = new Date();
    var sl = ov(D.soss || {}).filter(function (s) { return s.isActive; });
    var nl = ov(D.needss || {});
    var vl = ov(D.resources || {});
    var cl = ov(D.camps || {}).filter(function (c) { return c.isActive; });
    var tl = ov(D.teams || {});
    var totalCap = cl.reduce(function (s, c) { return s + (c.capacity || 0); }, 0);
    var totalOcc = cl.reduce(function (s, c) { return s + (c.currentOccupancy || 0); }, 0);
    var critCamps = cl.filter(function (c) { return c.capacity > 0 && (c.currentOccupancy / c.capacity) >= 0.90; });
    var oldSOS = sl.filter(function (s) { return Date.now() - s.activatedAt > WM; });
    var lines = [
        '╔════════════════════════════════════════════════════════╗',
        '  SITUATION REPORT (SITREP) — SAFECONNECT PLATFORM',
        '  Generated: ' + now.toLocaleString('en-IN'),
        '  Zone: ' + (cZ === 'all' ? 'All Zones' : cZ) + (cD ? ' | District: ' + cD : ''),
        '╚════════════════════════════════════════════════════════╝',
        '',
        '━━ ACTIVE INCIDENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '  Active SOS Alerts    : ' + sl.length,
        '  Unresponded (>30min) : ' + oldSOS.length + (oldSOS.length ? ' ⚠️' : ''),
        '  Needs Reports        : ' + nl.length,
        '  Volunteer Offers     : ' + vl.length,
        '',
        '━━ RELIEF INFRASTRUCTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '  Active Camps         : ' + cl.length,
        '  Total Capacity       : ' + totalCap,
        '  Current Occupancy    : ' + totalOcc + ' (' + (totalCap ? Math.round(totalOcc / totalCap * 100) : 0) + '%)',
        '  Near-Full Camps (≥90%): ' + critCamps.length + (critCamps.length ? ' ⚠️' : ''),
        '  Rescue Teams On-Site : ' + tl.length,
        '',
    ];
    if (sl.length > 0) {
        lines.push('━━ CRITICAL SOS CASES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sl.slice(0, 5).forEach(function (s, i) {
            var age = Math.floor((Date.now() - s.activatedAt) / 60000);
            var rsp = s.govtAction && s.govtAction.status ? '✓ ' + s.govtAction.status.replace(/_/g, ' ') : '✗ No response';
            lines.push('  ' + (i + 1) + '. ' + (s.userName || 'Unknown') + ' — ' + (s.gps && s.gps.address ? s.gps.address : 'GPS captured'));
            lines.push('     Age: ' + age + 'min | Response: ' + rsp + (s.viaBleMesh ? ' | Via BLE Mesh' : ''));
        });
        if (sl.length > 5) lines.push('  ... and ' + (sl.length - 5) + ' more active SOS');
        lines.push('');
    }
    if (critCamps.length > 0) {
        lines.push('━━ CAMP CAPACITY WARNINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        critCamps.forEach(function (c) {
            lines.push('  ⚠️  ' + c.name + ' — ' + c.currentOccupancy + '/' + c.capacity + ' (' + Math.round(c.currentOccupancy / c.capacity * 100) + '%) — ' + c.district);
        });
        lines.push('');
    }
    lines.push('━━ ACTION REQUIRED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (oldSOS.length > 0) lines.push('  [URGENT] ' + oldSOS.length + ' SOS alert(s) unresponded for >30 minutes');
    if (critCamps.length > 0) lines.push('  [URGENT] Redirect incoming survivors from full camps');
    if (sl.length === 0 && nl.length === 0) lines.push('  [STATUS] All clear — no active emergencies');
    lines.push('');
    lines.push('— End of SITREP — Generated by SafeConnect Dashboard — TSDMA —');
    el.textContent = lines.join('\n');
}
function copySITREP() {
    var el = $('sitrep-out');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(function () {
        toast('&#10004; Copied', 'SITREP copied to clipboard', '#2A7A5A');
    }).catch(function () { toast('Error', 'Could not copy. Select text manually.', '#C62828'); });
}
function printSITREP() {
    var el = $('sitrep-out');
    if (!el) return;
    var w = window.open('', '_blank');
    w.document.write('<pre style="font-family:Courier New,monospace;font-size:12px;padding:20px;white-space:pre-wrap">' + el.textContent + '</pre>');
    w.document.close(); w.print();
}

// === Feature 5: Response Time Leaderboard ===
function renderResp() {
    var p = $('p-resp'); if (!p) return;
    var all = ov(D.soss || {});
    if (!all.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#9201;</div><div class="emp-t">No SOS data yet</div></div>'; return; }
    var byDist = {};
    all.forEach(function (s) {
        var d = s.district || s.gps && s.gps.address && s.gps.address.split(',').pop().trim() || 'Unknown';
        if (!byDist[d]) byDist[d] = { total: 0, responded: 0, respTimes: [], handled: 0 };
        byDist[d].total++;
        if (s.govtAction && s.govtAction.dispatchedAt && s.activatedAt) {
            var rt = (s.govtAction.dispatchedAt - s.activatedAt) / 60000;
            if (rt > 0 && rt < 1440) { byDist[d].respTimes.push(rt); byDist[d].responded++; }
        }
        if (!s.isActive) byDist[d].handled++;
    });
    var rows = Object.keys(byDist).map(function (d) {
        var r = byDist[d];
        var avg = r.respTimes.length ? (r.respTimes.reduce(function (a, b) { return a + b; }, 0) / r.respTimes.length) : null;
        return { dist: d, avg: avg, handled: r.handled, total: r.total, responded: r.responded };
    }).sort(function (a, b) {
        if (a.avg === null && b.avg === null) return 0;
        if (a.avg === null) return 1;
        if (b.avg === null) return -1;
        return a.avg - b.avg;
    });
    var rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    var html = '<div class="ph">Response Time by District (fastest first)</div>' +
        '<table class="rt-table"><thead><tr><th>#</th><th>District</th><th>Avg Response</th><th>Handled</th><th>Total SOS</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
        var rc = rankColors[i] || '#8C7060';
        html += '<tr>' +
            '<td><span class="rt-rank" style="background:' + rc + '">' + (i + 1) + '</span></td>' +
            '<td style="font-weight:700">' + r.dist + '</td>' +
            '<td style="font-weight:700;color:' + (r.avg ? '#2A7A5A' : '#8C7060') + '">' + (r.avg ? r.avg.toFixed(0) + ' min' : '—') + '</td>' +
            '<td><span class="p pg">' + r.handled + '</span></td>' +
            '<td>' + r.total + '</td>' +
            '</tr>';
    });
    html += '</tbody></table><div style="font-size:9px;color:var(--muted);margin-top:8px">&#9432; Response time = SOS activated → first govt dispatch. Lower is better.</div>';
    p.innerHTML = html;
}

// === Export CSV ===
function xport() {
    var rows = [['Name', 'Address', 'Lat', 'Lng', 'Time', 'Status', 'BLE']];
    ov(D.soss).filter(function (s) { return s.isActive; }).forEach(function (s) { rows.push([s.userName || '', s.gps && s.gps.address || '', s.gps && s.gps.latitude || '', s.gps && s.gps.longitude || '', s.activatedAt ? new Date(s.activatedAt).toLocaleString('en-IN') : '', 'ACTIVE', s.viaBleMesh ? 'Yes' : 'No']); });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'safeconnect_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
}

// === Fullscreen Toggle ===
function togFS() { var s = $('sidebar'); s.style.display = s.style.display === 'none' ? '' : 'none'; }

// === Boot ===
initMap(); load(); setInterval(load, 10000);
