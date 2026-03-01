/* ── AQI LEVELS ── */
var AQI_LEVELS = [
  { max: 50,  label: 'Good',                       color: '#22c55e', desc: 'Air quality is satisfactory. Enjoy outdoor activities.',                cls: 'bg-good' },
  { max: 100, label: 'Moderate',                   color: '#eab308', desc: 'Acceptable air quality. Sensitive individuals may experience minor issues.', cls: 'bg-moderate' },
  { max: 150, label: 'Unhealthy for Sensitive',    color: '#f97316', desc: 'Sensitive groups may experience health effects.',                       cls: 'bg-sensitive' },
  { max: 200, label: 'Unhealthy',                  color: '#ef4444', desc: 'Everyone may begin to experience health effects.',                      cls: 'bg-unhealthy' },
  { max: 300, label: 'Very Unhealthy',             color: '#a855f7', desc: 'Health alert: increased risk for everyone.',                            cls: 'bg-very-unhealthy' },
  { max: 500, label: 'Hazardous',                  color: '#dc2626', desc: 'Emergency conditions. Everyone is more likely to be affected.',         cls: 'bg-unhealthy' }
];

function getLevel(aqi) {
  for (var i = 0; i < AQI_LEVELS.length; i++) {
    if (aqi <= AQI_LEVELS[i].max) return AQI_LEVELS[i];
  }
  return AQI_LEVELS[AQI_LEVELS.length - 1];
}

/* ── POLLUTANT DEFINITIONS ── */
var pollutantDefs = [
  { id: 'pm25', label: 'PM2.5', unit: 'µg/m³', max: 250 },
  { id: 'pm10', label: 'PM10',  unit: 'µg/m³', max: 430 },
  { id: 'no2',  label: 'NO₂',   unit: 'µg/m³', max: 400 },
  { id: 'so2',  label: 'SO₂',   unit: 'µg/m³', max: 800 },
  { id: 'co',   label: 'CO',    unit: 'mg/m³', max: 10  },
  { id: 'temp', label: 'Temp',  unit: '°C',    max: 50  }
];

var history = [];
var trendChart = null;
var trendData = {};

/* ── COMPUTE AQI (simulates ML model) ── */
function computeAQI(pm25, pm10, no2, so2, co, temp, humidity) {
  var pm25_aqi = pm25 * 1.8;
  var pm10_aqi = pm10 * 0.9;
  var no2_aqi  = no2  * 1.3;
  var so2_aqi  = so2  * 1.1;
  var co_aqi   = co   * 18;
  var met_adj  = (humidity / 100) * 12 - (temp > 35 ? 8 : 0);
  var raw = Math.max(pm25_aqi, pm10_aqi, no2_aqi, so2_aqi, co_aqi) + met_adj * 0.5;
  return Math.round(Math.min(Math.max(raw, 10), 499));
}

/* ── INIT POLLUTANT CARDS ── */
function initPollutantGrid() {
  var grid = document.getElementById('pollutantGrid');
  if (!grid) return;
  var html = '';
  for (var i = 0; i < pollutantDefs.length; i++) {
    var p = pollutantDefs[i];
    html += '<div class="pollutant-card">' +
              '<div class="pollutant-name">' + p.label + '</div>' +
              '<div class="pollutant-val" id="card_' + p.id + '">—</div>' +
              '<div class="pollutant-unit">' + p.unit + '</div>' +
              '<div class="pollutant-bar"><div class="pollutant-fill" id="fill_' + p.id + '" style="width:0%"></div></div>' +
            '</div>';
  }
  grid.innerHTML = html;
}

/* ── UPDATE POLLUTANT CARDS ── */
function updatePollutantCards(vals) {
  for (var i = 0; i < pollutantDefs.length; i++) {
    var p = pollutantDefs[i];
    var v = vals[p.id];
    var el = document.getElementById('card_' + p.id);
    var fill = document.getElementById('fill_' + p.id);
    if (el && v !== undefined && v !== '' && !isNaN(v)) {
      el.textContent = v;
      var pct = Math.min((parseFloat(v) / p.max) * 100, 100);
      if (fill) fill.style.width = pct + '%';
    }
  }
}

/* ── LIVE LABEL ── */
function updateLabel(inputId, spanId) {
  var v = document.getElementById(inputId).value;
  document.getElementById(spanId).textContent = v || '—';
}

/* ── GAUGE ── */
function setGauge(aqi, color) {
  var arc = document.getElementById('gaugeArc');
  var pctEl = document.getElementById('gaugePct');
  if (!arc || !pctEl) return;
  var pct = Math.min(aqi / 500, 1);
  var circ = 326.7;
  arc.style.strokeDashoffset = circ - pct * circ;
  arc.style.stroke = color;
  pctEl.textContent = Math.round(pct * 100) + '%';
}

/* ── AQI HERO ── */
function updateHero(aqi, level) {
  var hero = document.getElementById('aqiHero');
  var valEl = document.getElementById('aqiValue');
  var catEl = document.getElementById('aqiCategory');
  var descEl = document.getElementById('aqiDesc');
  if (!hero || !valEl || !catEl || !descEl) return;
  hero.style.setProperty('--aqi-color', level.color);
  valEl.textContent = aqi;
  valEl.style.color = level.color;
  catEl.textContent = level.label;
  catEl.style.color = level.color;
  descEl.textContent = level.desc;
  setGauge(aqi, level.color);
}

/* ── TREND CHART ── */
function generateTrendData(latestAQI, days) {
  var arr = [], labels = [];
  var base = latestAQI;
  for (var i = days; i >= 0; i--) {
    var noise = (Math.random() - 0.4) * 30;
    base = Math.max(10, Math.min(400, base + noise));
    arr.push(Math.round(base));
    var d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
  }
  arr[arr.length - 1] = latestAQI;
  return { data: arr, labels: labels };
}

function initChart(aqi, color) {
  var canvas = document.getElementById('trendChart');
  if (!canvas) return;

  // Check Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return;
  }

  trendData['7d']  = generateTrendData(aqi, 7);
  trendData['30d'] = generateTrendData(aqi, 30);
  trendData['90d'] = generateTrendData(aqi, 90);
  var td = trendData['7d'];

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  var ctx = canvas.getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: td.labels,
      datasets: [{
        label: 'AQI',
        data: td.data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: color,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111318',
          borderColor: '#1e2330',
          borderWidth: 1,
          titleColor: '#e8ecf5',
          bodyColor: '#5a6480',
          titleFont: { family: 'Space Mono' },
          bodyFont:  { family: 'Space Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e2330' },
          ticks: { color: '#5a6480', font: { family: 'Space Mono', size: 10 }, maxTicksLimit: 7 }
        },
        y: {
          grid: { color: '#1e2330' },
          ticks: { color: '#5a6480', font: { family: 'Space Mono', size: 10 } },
          min: 0, max: 400
        }
      }
    }
  });
}

function switchTab(el, range) {
  var tabs = document.querySelectorAll('.chart-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  el.classList.add('active');
  if (!trendChart || !trendData[range]) return;
  var td = trendData[range];
  trendChart.data.labels = td.labels;
  trendChart.data.datasets[0].data = td.data;
  trendChart.update();
}

/* ── HISTORY ── */
function addHistory(city, aqi, level) {
  history.unshift({ city: city, aqi: aqi, level: level });
  if (history.length > 5) history.pop();
  var el = document.getElementById('historyList');
  if (!el) return;
  var html = '';
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    var time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    html += '<div class="history-item">' +
              '<div>' +
                '<div style="font-size:13px;font-weight:600;">' + h.city + '</div>' +
                '<div class="history-city">' + time + '</div>' +
              '</div>' +
              '<div class="history-aqi ' + h.level.cls + '">' + h.aqi + '</div>' +
            '</div>';
  }
  el.innerHTML = html;
}

/* ── PREDICT ── */
function runPrediction() {
  var pm25 = parseFloat(document.getElementById('pm25').value);
  var pm10 = parseFloat(document.getElementById('pm10').value);
  var no2  = parseFloat(document.getElementById('no2').value);
  var so2  = parseFloat(document.getElementById('so2').value);
  var co   = parseFloat(document.getElementById('co').value);
  var temp = parseFloat(document.getElementById('temp').value);
  var hum  = parseFloat(document.getElementById('humidity').value);

  if (isNaN(pm25) || isNaN(pm10) || isNaN(no2) || isNaN(so2) || isNaN(co)) {
    alert('Please fill in all 5 pollutant fields (PM2.5, PM10, NO₂, SO₂, CO).');
    return;
  }

  var btn = document.getElementById('predictBtn');
  btn.classList.add('loading');
  btn.textContent = '⏳ Computing...';

  setTimeout(function() {
    try {
      var aqi   = computeAQI(pm25, pm10, no2, so2, co, isNaN(temp) ? 25 : temp, isNaN(hum) ? 60 : hum);
      var level = getLevel(aqi);
      var city  = document.getElementById('citySelect').value;

      updateHero(aqi, level);
      updatePollutantCards({ pm25: pm25, pm10: pm10, no2: no2, so2: so2, co: co, temp: isNaN(temp) ? '—' : temp });
      initChart(aqi, level.color);
      addHistory(city, aqi, level);
    } catch(e) {
      console.error('Prediction error:', e);
    } finally {
      btn.classList.remove('loading');
      btn.textContent = '⚡ Predict AQI';
    }
  }, 900);
}

/* ── BOOT ── */
initPollutantGrid();