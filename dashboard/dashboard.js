// SafeConnect Dashboard - Clean Rewrite
var FB = 'https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app';
var map, D = {}, ML = { sos: [], needs: [], help: [], camps: [], teams: [], dist: [], trails: [] };
var prev = new Set(), cZ = 'all', cD = '', lr = Date.now(), WM = 30 * 60 * 1000;

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
function clr() { Object.values(ML).forEach(function (a) { a.forEach(function (m) { map.removeLayer(m); }); a.length = 0; }); }

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

// === Fetch ===
async function get(p) { try { var r = await fetch(FB + '/' + p + '.json'); return (await r.json()) || {}; } catch (e) { return {}; } }

// === Load ===
async function load() {
    var [soss, needss, resources, camps, teams, dists] = await Promise.all([get('soss'), get('needss'), get('resources'), get('relief_camps'), get('govt_rescue_teams'), get('govt_districts')]);
    D = { soss: soss, needss: needss, resources: resources, camps: camps, teams: teams, dists: dists };
    // Detect new SOS
    var ck = new Set(Object.keys(soss || {}));
    if (prev.size > 0) ck.forEach(function (k) { if (!prev.has(k)) { var s = soss[k]; toast('&#128680; NEW SOS: ' + (s.userName || 'Unknown'), s.gps && s.gps.address ? s.gps.address : 'Location captured', '#C62828'); sos_beep(); } });
    prev = ck;
    render(); fillDD(); lr = Date.now();
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
    camps.filter(function (c) { return c.latitude; }).forEach(function (c) {
        var pct = Math.round((c.currentOccupancy / c.capacity) * 100) || 0; var cl = pct > 90 ? '#C62828' : pct > 70 ? '#D84315' : '#1565C0';
        var m = L.marker([c.latitude, c.longitude], { icon: ic('&#9978;', cl, 28) }).addTo(map).bindPopup('<div class="lpt" style="color:#1565C0">' + c.name + '</div><div class="lpr">' + c.currentOccupancy + '/' + c.capacity + '</div>');
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
    p.innerHTML = '<div class="ph">Active SOS &#8212; ' + list.length + '</div>' + list.map(function (s) {
        var w = Date.now() - s.activatedAt > WM;
        var dispatched = s.govtAction && s.govtAction.status;
        var dispBadge = dispatched ? '<span class="p pg">&#10004; ' + (s.govtAction.status || 'Dispatched').replace(/_/g, ' ') + '</span>' : '';
        var batBadge = s.batteryCritical ? '<span class="p pw">&#128267; ' + (s.batteryLevel || '?') + '%</span>' : '';
        var btnLabel = dispatched ? '&#128221; Update' : '&#128658; Dispatch';
        var btnBg = dispatched ? 'var(--blue)' : 'var(--green)';
        var idx = sid(s);
        return '<div class="cd" onclick="showSOS(' + idx + ')"><div class="cs" style="background:' + (dispatched ? '#2A7A5A' : '#C62828') + '"></div><div class="cr"><div class="ca" style="background:var(--red-lt);color:var(--red)">' + ini(s.userName) + '</div><div><div class="cn">' + (s.userName || 'Unknown') + '</div><div class="csub">' + (s.gps && s.gps.address ? s.gps.address : 'GPS captured') + '</div></div></div><div class="cf">' + (w ? '<span class="p pw">&#9888; ' + Math.floor((Date.now() - s.activatedAt) / 60000) + 'm</span>' : '') + '<span class="p pr">&#128308; ACTIVE</span>' + dispBadge + batBadge + (s.viaBleMesh ? '<span class="p py">BLE Mesh</span>' : '') + (s.contactsNotified && s.contactsNotified.length ? '<span class="p pg">SMS</span>' : '') + '<span class="ts">' + ago(s.activatedAt) + '</span><button class="dbtn" style="background:' + btnBg + '" onclick="event.stopPropagation();dispatch(' + idx + ')">' + btnLabel + '</button><button class="dbtn" style="background:#7B1FA2" onclick="event.stopPropagation();resolveSOS(' + idx + ')">&#10003; Resolve</button></div></div>';
    }).join('');
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
    p.innerHTML = '<div class="ph">"I Need Help" &#8212; ' + list.length + '</div>' + list.map(function (n) {
        var icons = (n.needs || []).map(function (k) { return NE[k] || '?'; }).join(' ');
        return '<div class="cd" onclick="fly(' + (n.gps && n.gps.latitude || 0) + ',' + (n.gps && n.gps.longitude || 0) + ')"><div class="cs" style="background:#D84315"></div><div class="cr"><div class="ca" style="background:var(--amber-lt);color:var(--amber)">' + icons + '</div><div><div class="cn">' + (n.userName || 'Unknown') + '</div><div class="csub">' + (n.gps && n.gps.address ? n.gps.address : 'GPS') + '</div></div></div><div class="cb">Needs: <b>' + ((n.needs || []).join(', ') || '\u2014') + '</b>' + (n.notes ? '<br>' + n.notes : '') + '</div><div class="cf"><span class="p pa">NEEDS HELP</span><span class="p py">' + (n.peopleCount || 1) + ' person' + ((n.peopleCount || 1) > 1 ? 's' : '') + '</span><span class="ts">' + ago(n.reportedAt) + '</span></div></div>';
    }).join('');
}

// === Help Panel ===
var RE = { food: '&#127838;', water: '&#128167;', medicine: '&#128138;', shelter: '&#127968;', vehicle: '&#128663;', medical_skills: '&#129466;', space: '&#128719;' };
function pHelp(list) {
    var p = $('p-help');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#129309;</div><div class="emp-t">No Help Offers</div><div class="emp-b">When someone taps "I Can Help", offers appear here.</div></div>'; return; }
    list.sort(function (a, b) { return (b.offeredAt || 0) - (a.offeredAt || 0); });
    p.innerHTML = '<div class="ph">"I Can Help" &#8212; ' + list.length + '</div>' + list.map(function (r) {
        var icons = (r.resources || []).map(function (k) { return RE[k] || '?'; }).join(' ');
        return '<div class="cd" onclick="fly(' + (r.gps && r.gps.latitude || 0) + ',' + (r.gps && r.gps.longitude || 0) + ')"><div class="cs" style="background:#2A7A5A"></div><div class="cr"><div class="ca" style="background:var(--green-lt);color:var(--green)">' + icons + '</div><div><div class="cn">' + (r.userName || 'Volunteer') + '</div><div class="csub">' + (r.gps && r.gps.address ? r.gps.address : 'GPS') + '</div></div></div><div class="cb">Offering: <b>' + ((r.resources || []).join(', ') || '\u2014') + '</b>' + (r.capacity ? '<br>Can help ' + r.capacity + ' people' : '') + (r.notes ? '<br>' + r.notes : '') + '</div><div class="cf"><span class="p pg">CAN HELP</span><span class="ts">' + ago(r.offeredAt) + '</span></div></div>';
    }).join('');
}

// === Camps Panel ===
function pCamps(list) {
    var p = $('p-camps');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#9978;</div><div class="emp-t">No Camps</div><div class="emp-b">No relief camps for this area.</div></div>'; return; }
    list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    p.innerHTML = '<div class="ph">Relief Camps &#8212; ' + list.length + '</div>' + list.map(function (c) {
        var pct = Math.round((c.currentOccupancy / c.capacity) * 100) || 0; var bc = pct > 90 ? '#C62828' : pct > 70 ? '#D84315' : '#2A7A5A'; var pc = pct > 90 ? 'pr' : pct > 70 ? 'pa' : 'pg'; var lb = pct > 90 ? 'Near Full' : pct > 70 ? 'Filling' : 'Available';
        return '<div class="cd" onclick="fly(' + c.latitude + ',' + c.longitude + ')"><div class="cs" style="background:#1565C0"></div><div class="cr"><div class="ca" style="background:var(--blue-lt);color:var(--blue)">&#9978;</div><div><div class="cn" style="font-size:11px">' + c.name + '</div><div class="csub">' + c.district + ' &#183; ' + c.contactNumber + '</div></div></div><div class="cpw"><div class="cpb" style="width:' + pct + '%;background:' + bc + '"></div></div><div class="cpl">' + c.currentOccupancy + '/' + c.capacity + ' (' + pct + '%)</div><div class="rcs">' + (c.resources || []).map(function (r) { return '<span class="rc">' + r + '</span>'; }).join('') + '</div><div class="cf" style="margin-top:5px"><span class="p ' + pc + '">' + lb + '</span>' + (c.isGovtRegistered ? '<span class="p po">Govt</span>' : '') + '</div></div>';
    }).join('');
}

// === Teams Panel ===
function pTeams(list) {
    var p = $('p-teams');
    if (!list.length) { p.innerHTML = '<div class="emp"><div class="emp-i">&#128658;</div><div class="emp-t">Loading...</div></div>'; return; }
    p.innerHTML = '<div class="ph">Rescue Teams &#8212; ' + list.length + '</div>' + list.map(function (t) {
        return '<div class="cd" onclick="fly(' + (t.lat || 0) + ',' + (t.lng || 0) + ')"><div class="cs" style="background:#2A7A5A"></div><div class="cr"><div class="ca" style="background:var(--green-lt);color:var(--green)">&#128658;</div><div><div class="cn">' + t.name + '</div><div class="csub">' + t.contact + ' &#183; ' + t.totalTeams + ' teams</div></div></div><div class="cb">' + t.headquarters + '</div><div class="rcs" style="margin-top:5px">' + (t.capabilities || []).map(function (c) { return '<span class="rc">' + c + '</span>'; }).join('') + '</div><div class="cf" style="margin-top:5px"><span class="p py">' + t.type + '</span>' + (t.website ? '<a href="' + t.website + '" target="_blank" style="font-size:10px;color:var(--blue);font-weight:600;text-decoration:none">Website &#8594;</a>' : '') + '</div></div>';
    }).join('');
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
        h += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:800;color:var(--orange);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;padding:3px 7px;background:var(--orange-lt);border-radius:5px">' + z + ' (' + zd.length + ')</div>' + zd.map(function (d) {
            return '<div class="cd" onclick="sd(\'' + d.name + '\')" style="padding:8px 10px 8px 13px;margin-bottom:3px"><div class="cs" style="background:var(--orange)"></div><div style="display:flex;align-items:center;gap:7px;padding-left:4px"><div style="flex:1"><div class="cn" style="font-size:11px">' + d.name + '</div><div class="csub">ECR: ' + d.ecr + '</div></div><span class="p po" style="font-size:8px">' + d.districtCode + '</span></div></div>';
        }).join('') + '</div>';
    });
    p.innerHTML = h;
}

// === Tab Switch ===
function go(n) { ['sos', 'needs', 'help', 'camps', 'teams', 'districts'].forEach(function (t) { var tb = $('t-' + t), pn = $('p-' + t), st = $('s-' + t); if (tb) tb.className = 'tb' + (t === n ? ' on' : ''); if (pn) pn.className = 'pnl' + (t === n ? ' on' : ''); if (st) st.className = 'st' + (t === n ? ' on' : ''); }); }

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
