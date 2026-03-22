"""
AirScope — Flask Backend
"""
from flask import Flask, render_template, request, jsonify
import urllib.request, urllib.parse, json

app = Flask(__name__)

WAQI_TOKEN = 'f8c42940cf5f9314703d2852df38ad8159a2427f'

NEAREST = {
    'dhule':'Nashik','jalgaon':'Nashik','shirpur':'Nashik',
    'malegaon':'Nashik','nandurbar':'Nashik',
    'buldhana':'Aurangabad','hingoli':'Aurangabad','jalna':'Aurangabad','parbhani':'Aurangabad',
    'akola':'Amravati','washim':'Amravati','yavatmal':'Amravati',
    'nanded':'Hyderabad','latur':'Solapur','osmanabad':'Solapur',
    'ratnagiri':'Pune','satara':'Pune','sangli':'Pune',
    'sindhudurg':'Pune','kolhapur':'Pune','beed':'Pune',
    'gondia':'Nagpur','bhandara':'Nagpur',
    'wardha':'Nagpur','gadchiroli':'Nagpur','chandrapur':'Nagpur',
}


def waqi_request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return json.loads(urllib.request.urlopen(req, timeout=6).read())


def fetch_direct(city_name):
    """
    Fetch AQI directly by city name URL.
    e.g. api.waqi.info/feed/nashik/
    This works even when search returns dead stations.
    """
    try:
        url = f"https://api.waqi.info/feed/{urllib.parse.quote(city_name.lower())}/?token={WAQI_TOKEN}"
        res = waqi_request(url)
        if res.get('status') == 'ok':
            d    = res['data']
            iaqi = d.get('iaqi', {})
            raw  = d.get('aqi', 0)
            try:
                aqi = int(raw) if int(raw) > 0 else 0
            except:
                aqi = 0
            if aqi > 0:
                return {
                    'aqi':      aqi,
                    'pm25':     iaqi.get('pm25', {}).get('v', ''),
                    'pm10':     iaqi.get('pm10', {}).get('v', ''),
                    'no2':      iaqi.get('no2',  {}).get('v', ''),
                    'so2':      iaqi.get('so2',  {}).get('v', ''),
                    'co':       round(iaqi.get('co', {}).get('v', 0) / 1000, 3)
                                if iaqi.get('co', {}).get('v', '') != '' else '',
                    'temp':     iaqi.get('t',    {}).get('v', ''),
                    'humidity': iaqi.get('h',    {}).get('v', ''),
                    'station':  d.get('city', {}).get('name', city_name),
                }
    except Exception as e:
        print(f"[Direct] Error for {city_name}: {e}")
    return None


def search_raw(keyword):
    """Search WAQI and return raw station list."""
    try:
        url = f"https://api.waqi.info/search/?token={WAQI_TOKEN}&keyword={urllib.parse.quote(keyword)}"
        res = waqi_request(url)
        if res.get('status') == 'ok' and res.get('data'):
            stations = []
            for item in res['data']:
                uid  = item.get('uid')
                name = item.get('station', {}).get('name', '')
                aqi  = item.get('aqi', '-')
                if uid and name:
                    stations.append({
                        'uid':  uid,
                        'name': name,
                        'aqi':  str(aqi),
                        'live': str(aqi) not in ['-', 'N/A', '']
                    })
            return stations
    except Exception as e:
        print(f"[Search] Error: {e}")
    return []


def is_india_station(name, city):
    """Check if a station belongs to the searched Indian city."""
    name_lower = name.lower()
    city_lower = city.lower()

    # Must contain the city name
    if city_lower not in name_lower:
        return False

    # Explicitly foreign — reject only if a foreign country name is clearly present
    foreign_countries = [
        'thailand', 'romania', 'kuwait', 'pakistan', 'bangladesh',
        'nepal', 'sri lanka', 'china', 'germany', 'france', 'japan',
        'korea', 'indonesia', 'malaysia', 'australia', 'canada',
        'usa', 'united states', 'united kingdom'
    ]
    for f in foreign_countries:
        if f in name_lower:
            return False

    return True


def get_city_stations(city):
    """Search for stations strictly matching Indian city name only."""
    all_results = search_raw(city + ' India')
    matched = [s for s in all_results if is_india_station(s['name'], city)]

    if not matched:
        all_results2 = search_raw(city)
        matched = [s for s in all_results2 if is_india_station(s['name'], city)]

    # Deduplicate
    seen, unique = set(), []
    for s in matched:
        if s['uid'] not in seen:
            seen.add(s['uid'])
            unique.append(s)

    live    = [s for s in unique if s['live']]
    no_live = [s for s in unique if not s['live']]
    return live + no_live


def fetch_by_uid(uid):
    """Fetch full pollutant data by station uid."""
    try:
        res = waqi_request(f"https://api.waqi.info/feed/@{uid}/?token={WAQI_TOKEN}")
        if res.get('status') == 'ok':
            d    = res['data']
            iaqi = d.get('iaqi', {})
            raw  = d.get('aqi', 0)
            try:
                aqi = int(raw) if int(raw) > 0 else 0
            except:
                aqi = 0
            return {
                'aqi':      aqi,
                'pm25':     iaqi.get('pm25', {}).get('v', ''),
                'pm10':     iaqi.get('pm10', {}).get('v', ''),
                'no2':      iaqi.get('no2',  {}).get('v', ''),
                'so2':      iaqi.get('so2',  {}).get('v', ''),
                'co':       round(iaqi.get('co', {}).get('v', 0) / 1000, 3)
                            if iaqi.get('co', {}).get('v', '') != '' else '',
                'temp':     iaqi.get('t',    {}).get('v', ''),
                'humidity': iaqi.get('h',    {}).get('v', ''),
                'station':  d.get('city', {}).get('name', ''),
            }
    except Exception as e:
        print(f"[Fetch] Error uid={uid}: {e}")
    return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/stations')
def get_stations():
    city = request.args.get('city', '').strip()
    if not city:
        return jsonify({'success': False, 'error': 'No city provided'})

    fallback = None
    stations = get_city_stations(city)
    live_only = [s for s in stations if s['live']]

    # ── Case 1: Multiple live stations → show picker ──
    if len(live_only) > 1:
        return jsonify({
            'success': True, 'city': city.title(),
            'fallback': None, 'direct': None,
            'stations': live_only[:8]
        })

    # ── Case 2: Exactly one live station → use directly ──
    if len(live_only) == 1:
        return jsonify({
            'success': True, 'city': city.title(),
            'fallback': None, 'direct': None,
            'stations': live_only
        })

    # ── Case 3: Stations found but none are live → show them anyway so user can try ──
    if stations:
        return jsonify({
            'success': True, 'city': city.title(),
            'fallback': None, 'direct': None,
            'stations': stations[:8]
        })

    # ── Case 4: Search returned ZERO stations → try direct URL ──
    direct = fetch_direct(city)
    if direct and direct['aqi'] > 0:
        return jsonify({
            'success': True, 'city': city.title(),
            'fallback': None, 'direct': direct, 'stations': []
        })

    # ── Case 5: Nothing → try nearest fallback city ──
    fallback = NEAREST.get(city.lower())
    if fallback:
        stations  = get_city_stations(fallback)
        live_only = [s for s in stations if s['live']]

        if len(live_only) > 1:
            return jsonify({
                'success': True, 'city': city.title(),
                'fallback': fallback, 'direct': None,
                'stations': live_only[:8]
            })

        if len(live_only) == 1:
            return jsonify({
                'success': True, 'city': city.title(),
                'fallback': fallback, 'direct': None,
                'stations': live_only
            })

        if stations:
            return jsonify({
                'success': True, 'city': city.title(),
                'fallback': fallback, 'direct': None,
                'stations': stations[:8]
            })

        direct = fetch_direct(fallback)
        if direct and direct['aqi'] > 0:
            return jsonify({
                'success': True, 'city': city.title(),
                'fallback': fallback, 'direct': direct, 'stations': []
            })

    return jsonify({
        'success': False,
        'error': f'No data found for {city}. Try Mumbai, Delhi, Pune, Nagpur etc.'
    })


@app.route('/api/station')
def get_station():
    uid = request.args.get('uid', '')
    if not uid:
        return jsonify({'success': False, 'error': 'No uid provided'})
    try:
        data = fetch_by_uid(uid)
        if data:
            return jsonify({'success': True, 'data': data})
        return jsonify({'success': False, 'error': 'No data for this station'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/predict', methods=['POST'])
def predict():
    try:
        d    = request.get_json()
        pm25 = float(d.get('pm25', 0))
        pm10 = float(d.get('pm10', 0))
        no2  = float(d.get('no2',  0))
        so2  = float(d.get('so2',  0))
        co   = float(d.get('co',   0))

        def sub(val, bp):
            for clo, chi, ilo, ihi in bp:
                if clo <= val <= chi:
                    return ((ihi - ilo) / (chi - clo)) * (val - clo) + ilo
            return 500 if val > bp[-1][1] else 0

        aqi = int(round(max(
            sub(pm25, [(0,30,0,50),(31,60,51,100),(61,90,101,200),(91,120,201,300),(121,250,301,400),(250,500,401,500)]),
            sub(pm10, [(0,50,0,50),(51,100,51,100),(101,250,101,200),(251,350,201,300),(351,430,301,400),(430,600,401,500)]),
            sub(no2,  [(0,40,0,50),(41,80,51,100),(81,180,101,200),(181,280,201,300),(281,400,301,400),(400,800,401,500)]),
            sub(so2,  [(0,40,0,50),(41,80,51,100),(81,380,101,200),(381,800,201,300),(801,1600,301,400),(1600,2400,401,500)]),
            sub(co,   [(0,1,0,50),(1.1,2,51,100),(2.1,10,101,200),(10.1,17,201,300),(17.1,34,301,400),(34,60,401,500)]),
        )))
        return jsonify({'success': True, 'aqi': max(0, min(500, aqi))})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


if __name__ == '__main__':
    app.run(debug=True)