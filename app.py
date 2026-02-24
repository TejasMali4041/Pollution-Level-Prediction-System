from flask import Flask, render_template, request

app = Flask(__name__)

def get_aqi_category(aqi):
    if aqi <= 50:
        return "Good", "green"
    elif aqi <= 100:
        return "Satisfactory", "limegreen"
    elif aqi <= 200:
        return "Moderate", "orange"
    elif aqi <= 300:
        return "Poor", "red"
    elif aqi <= 400:
        return "Very Poor", "darkred"
    else:
        return "Severe", "maroon"

@app.route('/')
def home():
    return render_template("dashboard.html")

@app.route('/predict', methods=['POST'])
def predict():
    pm25 = float(request.form['pm25'])
    pm10 = float(request.form['pm10'])
    no2 = float(request.form['no2'])
    so2 = float(request.form['so2'])
    co = float(request.form['co'])
    temp = float(request.form['temp'])
    humidity = float(request.form['humidity'])

    predicted_aqi = int(
        pm25*0.4 +
        pm10*0.2 +
        no2*0.1 +
        so2*0.1 +
        co*0.1 +
        temp*0.05 +
        humidity*0.05
    )

    category, color = get_aqi_category(predicted_aqi)

    return render_template("dashboard.html",
                           prediction=predicted_aqi,
                           category=category,
                           color=color)

if __name__ == "__main__":
    app.run(debug=True)
