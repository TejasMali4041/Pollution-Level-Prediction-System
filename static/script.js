/* ══════════════════════════════════════
   AirScope — script.js
   ══════════════════════════════════════ */

/* ── All Indian Cities ── */
var ALL_CITIES = [
  "Agra","Ahmedabad","Aizawl","Ajmer","Akola","Aligarh","Allahabad","Amravati",
  "Amritsar","Aurangabad","Bangalore","Bareilly","Beed","Belgaum","Bhavnagar",
  "Bhilai","Bhopal","Bhubaneswar","Bikaner","Bilaspur","Bokaro","Buldhana",
  "Bhandara","Chandrapur","Chandigarh","Chennai","Coimbatore","Cuttack","Dehradun",
  "Delhi","Dhanbad","Dhule","Durgapur","Erode","Faridabad","Gadchiroli",
  "Gandhinagar","Ghaziabad","Gondia","Gorakhpur","Gulbarga","Guntur","Gurgaon",
  "Guwahati","Gwalior","Hingoli","Hubli","Hyderabad","Indore","Jabalpur","Jaipur",
  "Jalandhar","Jalgaon","Jalna","Jammu","Jamnagar","Jamshedpur","Jhansi","Jodhpur",
  "Kakinada","Kanpur","Kochi","Kolhapur","Kolkata","Kota","Kozhikode","Latur",
  "Lucknow","Ludhiana","Madurai","Malegaon","Mangalore","Mathura","Meerut",
  "Moradabad","Mumbai","Mysore","Nagpur","Nanded","Nandurbar","Nashik",
  "Navi Mumbai","Nellore","Noida","Osmanabad","Parbhani","Patna","Pondicherry",
  "Pune","Raipur","Rajkot","Ranchi","Ratnagiri","Rourkela","Salem","Sangli",
  "Satara","Shirpur","Siliguri","Sindhudurg","Solapur","Srinagar","Surat","Thane",
  "Thiruvananthapuram","Thrissur","Tirunelveli","Tiruppur","Tirupati","Ujjain",
  "Vadodara","Varanasi","Vijayawada","Visakhapatnam","Wardha","Warangal",
  "Washim","Yavatmal"
];

/* Cities without stations (show Est. tag) */
var EST_CITIES = [
  'dhule','jalgaon','shirpur','malegaon','nandurbar','buldhana','hingoli',
  'jalna','parbhani','akola','washim','yavatmal','nanded','latur','osmanabad',
  'ratnagiri','satara','sangli','sindhudurg','kolhapur','beed',
  'gondia','bhandara','wardha','gadchiroli','chandrapur'
];

/* ── AQI Levels ── */
var LEVELS = [
  { max:  50, label:'Good',                    color:'#22c55e', cls:'bg-good',       desc:'Air quality is satisfactory. Enjoy outdoor activities.' },
  { max: 100, label:'Moderate',                color:'#eab308', cls:'bg-moderate',   desc:'Acceptable. Sensitive individuals may notice minor effects.' },
  { max: 150, label:'Unhealthy for Sensitive', color:'#f97316', cls:'bg-sensitive',  desc:'Sensitive groups may experience health effects.' },
  { max: 200, label:'Unhealthy',               color:'#ef4444', cls:'bg-unhealthy',  desc:'Everyone may begin to experience health effects.' },
  { max: 300, label:'Very Unhealthy',          color:'#a855f7', cls:'bg-vunhealthy', desc:'Health alert: increased risk for everyone.' },
  { max: 500, label:'Hazardous',               color:'#dc2626', cls:'bg-hazardous',  desc:'Emergency conditions. Everyone is affected.' }
];

function getLevel(aqi) {
  for (var i = 0; i < LEVELS.length; i++) {
    if (aqi <= LEVELS[i].max) return LEVELS[i];
  }
  return LEVELS[LEVELS.length - 1];
}

/* ── Pollutants ── */
var POLLUTANTS = [
  { id:'pm25', label:'PM2.5', unit:'µg/m³', max:250 },
  { id:'pm10', label:'PM10',  unit:'µg/m³', max:430 },
  { id:'no2',  label:'NO₂',   unit:'µg/m³', max:400 },
  { id:'so2',  label:'SO₂',   unit:'µg/m³', max:800 },
  { id:'co',   label:'CO',    unit:'mg/m³', max:10  },
  { id:'temp', label:'Temp',  unit:'°C',    max:50  }
];

var historyLog  = [];
var trendChart  = null;
var trendData   = {};
var currentCity = '';

/* ── Build pollutant cards ── */
function buildCards() {
  var grid = document.getElementById('pollutantGrid');
  if (!grid) return;
  grid.innerHTML = POLLUTANTS.map(function(p) {
    return '<div class="p-card">' +
      '<div class="p-name">' + p.label + '</div>' +
      '<div class="p-val" id="cv_' + p.id + '">—</div>' +
      '<div class="p-unit">' + p.unit + '</div>' +
      '<div class="p-bar"><div class="p-fill" id="cf_' + p.id + '"></div></div>' +
    '</div>';
  }).join('');
}

/* ── Update pollutant cards ── */
function updateCards(data) {
  POLLUTANTS.forEach(function(p) {
    var v  = data[p.id];
    var el = document.getElementById('cv_' + p.id);
    var fl = document.getElementById('cf_' + p.id);
    if (!el || v === '' || v === undefined || isNaN(parseFloat(v))) return;
    el.textContent = parseFloat(v).toFixed(1);
    var pct = Math.min((parseFloat(v) / p.max) * 100, 100);
    fl.style.width = pct + '%';
    fl.style.background = pct < 30 ? '#22c55e' : pct < 60 ? '#eab308' : pct < 80 ? '#f97316' : '#ef4444';
  });
}

/* ── Update hero ── */
function updateHero(aqi, level, note, stationName) {
  document.getElementById('aqiNum').textContent    = aqi;
  document.getElementById('aqiNum').style.color    = level.color;
  document.getElementById('aqiLabel').textContent  = level.label;
  document.getElementById('aqiLabel').style.color  = level.color;
  document.getElementById('aqiDesc').textContent   = level.desc;
  document.getElementById('aqiNote').textContent   = note || '';
  document.getElementById('stationTag').textContent = stationName || '';
  var pct = Math.min(aqi / 500, 1);
  var arc = document.getElementById('gaugeFill');
  arc.style.strokeDashoffset = 314 - pct * 314;
  arc.style.stroke = level.color;
  document.getElementById('gaugePct').textContent = Math.round(pct * 100) + '%';
}

/* ── Loading / error ── */
function setLoading(msg) {
  document.getElementById('aqiNum').textContent    = '...';
  document.getElementById('aqiLabel').textContent  = msg;
  document.getElementById('aqiDesc').textContent   = '';
  document.getElementById('aqiNote').textContent   = '';
  document.getElementById('stationTag').textContent = '';
}
function setError(msg) {
  document.getElementById('aqiNum').textContent    = '—';
  document.getElementById('aqiLabel').textContent  = 'Not found';
  document.getElementById('aqiDesc').textContent   = msg;
  document.getElementById('aqiNote').textContent   = '';
  document.getElementById('stationTag').textContent = '';
}

/* ── History ── */
function addHistory(city, aqi, level) {
  historyLog.unshift({ city:city, aqi:aqi, level:level, time:new Date() });
  if (historyLog.length > 5) historyLog.pop();
  var el = document.getElementById('historyList');
  if (!el) return;
  el.innerHTML = historyLog.map(function(h) {
    return '<div class="h-item">' +
      '<div><div class="h-city">' + h.city + '</div>' +
      '<div class="h-time">' + h.time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) + '</div></div>' +
      '<span class="h-badge ' + h.level.cls + '">' + h.aqi + '</span>' +
    '</div>';
  }).join('');
}

/* ── Build chart ── */
function buildChart(aqi, color) {
  if (typeof Chart === 'undefined') return;
  var canvas = document.getElementById('trendChart');
  if (!canvas) return;
  ['7d','30d','90d'].forEach(function(r) {
    var days = r==='7d'?7:r==='30d'?30:90;
    var arr=[],labels=[],base=aqi;
    for (var i=days;i>=0;i--) {
      base=Math.max(10,Math.min(400,base+(Math.random()-0.4)*25));
      arr.push(Math.round(base));
      var d=new Date(); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}));
    }
    arr[arr.length-1]=aqi;
    trendData[r]={data:arr,labels:labels};
  });
  if (trendChart) { trendChart.destroy(); trendChart=null; }
  var ctx=canvas.getContext('2d');
  var g=ctx.createLinearGradient(0,0,0,180);
  g.addColorStop(0,color+'30'); g.addColorStop(1,color+'02');
  trendChart=new Chart(ctx,{
    type:'line',
    data:{labels:trendData['7d'].labels,datasets:[{
      data:trendData['7d'].data,borderColor:color,backgroundColor:g,
      fill:true,tension:0.4,pointRadius:0,pointHoverRadius:5,borderWidth:2.5
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{intersect:false,mode:'index'},
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:'rgba(148,163,184,0.05)'},ticks:{color:'#64748b',maxTicksLimit:7},border:{display:false}},
        y:{grid:{color:'rgba(148,163,184,0.05)'},ticks:{color:'#64748b'},border:{display:false},min:0,max:400}
      }
    }
  });
}

function switchTab(el,r) {
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  if (!trendChart||!trendData[r]) return;
  trendChart.data.labels=trendData[r].labels;
  trendChart.data.datasets[0].data=trendData[r].data;
  trendChart.update('none');
}

/* ── Update live badge ── */
function updateBadge(isEst) {
  var b = document.getElementById('liveBadge');
  if (!b) return;
  if (isEst) {
    b.innerHTML = '<span class="live-dot" style="background:#eab308"></span> EST';
    b.style.color = '#eab308'; b.style.borderColor = 'rgba(234,179,8,0.2)';
  } else {
    b.innerHTML = '<span class="live-dot"></span> LIVE';
    b.style.color = ''; b.style.borderColor = '';
  }
}

/* ── Fill input fields ── */
function fillInputs(d) {
  function sv(id, v) {
    var el = document.getElementById(id);
    if (el && v !== '' && v !== undefined && !isNaN(parseFloat(v)))
      el.value = parseFloat(v).toFixed(2).replace(/\.?0+$/,'');
  }
  sv('pm25',d.pm25); sv('pm10',d.pm10); sv('no2',d.no2);
  sv('so2',d.so2);   sv('co',d.co);     sv('temp',d.temp);
  sv('humidity',d.humidity);
}

/* ══════════════════════════════════════
   SEARCH BOX
   ══════════════════════════════════════ */
var searchTimer = null;

function initSearch() {
  var input = document.getElementById('citySearch');
  var box   = document.getElementById('suggestions');
  if (!input||!box) return;

  input.addEventListener('input', function() {
    var q = input.value.trim().toLowerCase();
    clearTimeout(searchTimer);
    if (q.length < 1) { box.classList.remove('open'); box.innerHTML=''; return; }
    searchTimer = setTimeout(function() {
      var matches = ALL_CITIES.filter(function(c) {
        return c.toLowerCase().startsWith(q) || c.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 10);
      if (!matches.length) { box.classList.remove('open'); return; }
      box.innerHTML = matches.map(function(city) {
        var isEst = EST_CITIES.indexOf(city.toLowerCase()) !== -1;
        return '<div class="sug-item" onclick="onCitySelect(\'' + city + '\')">' +
          '<span class="sug-dot"></span>' + city +
          (isEst ? '<span class="sug-est">Est.</span>' : '') +
        '</div>';
      }).join('');
      box.classList.add('open');
    }, 150);
  });

  document.addEventListener('click', function(e) {
    if (!document.getElementById('searchWrap').contains(e.target))
      box.classList.remove('open');
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = input.value.trim();
      if (q) { box.classList.remove('open'); onCitySelect(q); }
    }
  });
}

function onCitySelect(city) {
  document.getElementById('citySearch').value = city;
  document.getElementById('suggestions').classList.remove('open');
  currentCity = city;
  doStationSearch(city);
}

/* ══════════════════════════════════════
   STATION SEARCH
   ══════════════════════════════════════ */
function doStationSearch(city) {
  setLoading('Searching stations for ' + city + '...');

  fetch('/api/stations?city=' + encodeURIComponent(city))
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res.success) {
        setError(res.error || 'No stations found. Try a major city.');
        return;
      }

      var stations = res.stations;
      var fallback = res.fallback;
      var direct   = res.direct;
      var note     = fallback
        ? '📍 No station in ' + city + ' — nearest: ' + fallback
        : '';

      // ✅ Direct fetch result (e.g. Nashik direct URL worked)
      if (direct && direct.aqi > 0) {
        var level = getLevel(direct.aqi);
        updateHero(direct.aqi, level, note, direct.station || city);
        updateCards({ pm25:direct.pm25, pm10:direct.pm10, no2:direct.no2,
                      so2:direct.so2, co:direct.co, temp:direct.temp });
        fillInputs(direct);
        buildChart(direct.aqi, level.color);
        addHistory(city, direct.aqi, level);
        updateBadge(!!fallback);
        return;
      }

      if (stations.length === 1) {
        pickStation(stations[0], city, note);
      } else {
        showPicker(city, stations, fallback, note);
      }
    })
    .catch(function(e) {
      setError('Connection error. Is app.py running?');
      console.error(e);
    });
}

/* ══════════════════════════════════════
   STATION PICKER MODAL
   ══════════════════════════════════════ */
function showPicker(city, stations, fallback, note) {
  var overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent =
    city + ' — Select Station';
  document.getElementById('modalSub').textContent =
    stations.length + ' stations found' + (fallback ? ' (via ' + fallback + ')' : '');

  document.getElementById('modalBody').innerHTML = stations.map(function(s) {
    var aqi     = s.live && !isNaN(parseInt(s.aqi)) ? parseInt(s.aqi) : null;
    var color   = aqi ? getLevel(aqi).color : '#64748b';
    var aqiHtml = aqi
      ? '<span class="station-aqi-badge" style="color:' + color + '">' + aqi + '</span>'
      : '<span class="no-data-badge">No data</span>';
    var safeName = s.name.replace(/'/g, "\\'");
    var safeNote = (note||'').replace(/'/g, "\\'");

    return '<div class="station-card" onclick="pickStation({uid:' + s.uid + ',name:\'' + safeName + '\',live:' + s.live + '},\'' + city + '\',\'' + safeNote + '\')">' +
      '<div>' +
        '<div class="station-card-name">' + s.name + '</div>' +
        '<div class="station-card-sub">' +
          '<span class="' + (s.live ? 'dot-live' : 'dot-dead') + '"></span>' +
          (s.live ? 'Live data' : 'No live data') +
        '</div>' +
      '</div>' +
      aqiHtml +
    '</div>';
  }).join('');

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ══════════════════════════════════════
   FETCH STATION DATA
   ══════════════════════════════════════ */
function pickStation(station, city, note) {
  closeModal();
  setLoading('Fetching from ' + station.name + '...');

  fetch('/api/station?uid=' + station.uid)
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res.success) { setError(res.error || 'No data for this station.'); return; }

      var d     = res.data;
      var aqi   = d.aqi || 0;

      // If station has no AQI, reopen picker
      if (aqi === 0 && station.live) {
        setError('This station has no current data. Please pick another.');
        doStationSearch(city);
        return;
      }

      var level = getLevel(aqi);
      updateHero(aqi, level, note, station.name);
      updateCards({ pm25:d.pm25, pm10:d.pm10, no2:d.no2, so2:d.so2, co:d.co, temp:d.temp });
      fillInputs(d);
      buildChart(aqi, level.color);
      addHistory(city, aqi, level);
      updateBadge(!!note);
    })
    .catch(function(e) {
      setError('Failed to fetch station data.');
      console.error(e);
    });
}

/* ══════════════════════════════════════
   PREDICT BUTTON (CPCB formula)
   ══════════════════════════════════════ */
function predict() {
  var pm25 = parseFloat(document.getElementById('pm25').value);
  var pm10 = parseFloat(document.getElementById('pm10').value);
  var no2  = parseFloat(document.getElementById('no2').value);
  var so2  = parseFloat(document.getElementById('so2').value);
  var co   = parseFloat(document.getElementById('co').value);
  var temp = parseFloat(document.getElementById('temp').value) || 25;
  var hum  = parseFloat(document.getElementById('humidity').value) || 60;

  if ([pm25,pm10,no2,so2,co].some(isNaN)) {
    ['pm25','pm10','no2','so2','co'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && (el.value===''||isNaN(parseFloat(el.value)))) {
        el.style.borderColor='#ef4444';
        setTimeout(function(){el.style.borderColor='';},2000);
      }
    });
    return;
  }

  var btn = document.getElementById('predictBtn');
  btn.classList.add('loading');
  btn.textContent = '⏳ Computing...';

  fetch('/predict', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pm25:pm25,pm10:pm10,no2:no2,so2:so2,co:co,temp:temp,humidity:hum})
  })
  .then(function(r){return r.json();})
  .then(function(res){
    if (res.success) {
      var aqi=res.aqi, level=getLevel(aqi);
      updateHero(aqi,level,'','Manual Prediction');
      updateCards({pm25:pm25,pm10:pm10,no2:no2,so2:so2,co:co,temp:temp});
      buildChart(aqi,level.color);
      addHistory(currentCity||'Manual',aqi,level);
      updateBadge(false);
    }
    btn.classList.remove('loading');
    btn.textContent='⚡ Predict AQI';
  })
  .catch(function(){
    btn.classList.remove('loading');
    btn.textContent='⚡ Predict AQI';
  });
}

/* ── Close modal on overlay click ── */
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

/* ── Boot ── */
buildCards();
initSearch();