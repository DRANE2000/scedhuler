# app.py

from flask import Flask, request, jsonify, render_template, redirect, url_for
from datetime import datetime, timedelta
import sqlite3
import os
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)

DATABASE = 'appointments.db'

# Initialize the database
def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        # Ensure table exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                service TEXT,
                sub_service TEXT,
                description TEXT,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                duration INTEGER NOT NULL,
                price REAL,
                comments TEXT
            )
        ''')
        conn.commit()

# Ensure the database is initialized
init_db()

def query_db(query, args=(), one=False):
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(query, args)
        rv = cur.fetchall()
        cur.close()
        return (rv[0] if rv else None) if one else rv

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/calendar')
def calendar_view():
    return render_template('calendar.html')

@app.route('/appointments', methods=['GET', 'POST'])
def appointments_page():
    services = {
        'Threading': {
            'Eyebrows': 15,
            'Upper Lips': 15,
            'Chin': 15
        },
        'Waxing': {
            'Half leg': 30,
            'Full leg': 45,
            'Half hands': 30,
            'Full hands': 45
        },
        'Facial': 45,
        'Head Massage': 60,
        'Haircut': 60
    }
    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'add_business':
            service = request.form.get('service')
            sub_service = request.form.get('sub_service')
            custom_sub_service = request.form.get('custom_sub_service')
            duration_input = request.form.get('duration')

            # Determine duration and sub_service_name
            if service in services:
                if isinstance(services[service], dict):
                    # Handle sub-services
                    if sub_service in services[service]:
                        duration = services[service][sub_service]
                        sub_service_name = sub_service
                    else:
                        conflict_message = "Invalid sub-service selected."
                        return render_template(
                            "appointments.html",
                            services=services,
                            conflict_message=conflict_message,
                            form_data=request.form
                        )
                elif isinstance(services[service], int):
                    # Service has a predefined duration, no sub-services
                    duration = services[service]
                    sub_service_name = None
                else:
                    # Service has no predefined duration, get custom sub-service and duration
                    sub_service_name = custom_sub_service
                    duration = int(duration_input) if duration_input else 15  # Default duration
            else:
                # Invalid service selected
                conflict_message = "Invalid service selected."
                return render_template(
                    "appointments.html",
                    services=services,
                    conflict_message=conflict_message,
                    form_data=request.form
                )

            # Convert time from 12-hour format with AM/PM to 24-hour format
            time_12hr = request.form['time']
            try:
                time_24hr = datetime.strptime(time_12hr, '%I:%M %p').strftime('%H:%M')
            except ValueError:
                conflict_message = "Invalid time format."
                return render_template(
                    "appointments.html",
                    services=services,
                    conflict_message=conflict_message,
                    form_data=request.form
                )

            date = request.form['date']
            start_datetime = datetime.strptime(f"{date} {time_24hr}", '%Y-%m-%d %H:%M')
            end_datetime = start_datetime + timedelta(minutes=duration)
            start_time = time_24hr
            end_time = end_datetime.strftime('%H:%M')

            # Check for conflicts
            with sqlite3.connect(DATABASE) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM appointments WHERE date = ? AND (
                        (time < ? AND time >= ?) OR
                        (? < time AND ? > time)
                    )
                ''', (date, end_time, start_time, start_time, end_time))
                conflicts = cursor.fetchall()

            if conflicts and not request.form.get('confirm'):
                # There is a conflict, ask for confirmation
                conflict_message = "Time conflict detected with existing appointments."
                return render_template(
                    "appointments.html",
                    services=services,
                    conflict_message=conflict_message,
                    form_data=request.form
                )
            else:
                # Proceed to add the appointment
                data = {
                    "type": "business",
                    "name": request.form.get('name'),
                    "service": service,
                    "sub_service": sub_service_name,
                    "date": date,
                    "time": start_time,
                    "duration": duration,
                    "price": float(request.form['price']) if request.form.get('price') else None,
                    "comments": request.form.get('comments')
                }
                with sqlite3.connect(DATABASE) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO appointments (type, name, service, sub_service, date, time, duration, price, comments)
                        VALUES (:type, :name, :service, :sub_service, :date, :time, :duration, :price, :comments)
                    ''', data)
                    conn.commit()
                return redirect(url_for('calendar_view'))

        elif action == 'add_personal':
            description = request.form.get('description')
            time_12hr = request.form.get('time')
            try:
                time_24hr = datetime.strptime(time_12hr, '%I:%M %p').strftime('%H:%M')
            except ValueError:
                conflict_message = "Invalid time format."
                return render_template(
                    "appointments.html",
                    services=services,
                    conflict_message=conflict_message,
                    form_data=request.form
                )
            date = request.form.get('date')

            data = {
                "type": "personal",
                "description": description,
                "date": date,
                "time": time_24hr,
                "duration": 30,  # Default duration for personal appointments
                "comments": request.form.get('comments')
            }

            with sqlite3.connect(DATABASE) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO appointments (type, description, date, time, duration, comments)
                    VALUES (:type, :description, :date, :time, :duration, :comments)
                ''', data)
                conn.commit()
            return redirect(url_for('calendar_view'))

        else:
            return redirect(url_for('appointments_page'))

    else:
        return render_template("appointments.html", services=services, form_data={})

# API to get all appointments
@app.route('/appointments_data', methods=['GET'])
def get_appointments():
    appointments = query_db('SELECT * FROM appointments')
    appointments = [dict(row) for row in appointments]  # Ensure all fields are included
    return jsonify(appointments)

# Route to handle delete appointment via AJAX
@app.route('/delete_appointment', methods=['POST'])
def delete_appointment():
    data = request.get_json()
    appointment_id = int(data['appointment_id'])
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM appointments WHERE id = ?', (appointment_id,))
        conn.commit()
    return jsonify({"message": "Appointment deleted successfully"})

# Route to handle update appointment via AJAX
@app.route('/update_appointment', methods=['POST'])
def update_appointment():
    data = request.get_json()
    appointment_id = data.get('id')
    price = data.get('price')  # Can be None for personal appointments
    comments = data.get('comments')

    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE appointments
            SET price = ?, comments = ?
            WHERE id = ?
        ''', (price, comments, appointment_id))
        conn.commit()

    return jsonify({"message": "Appointment updated successfully"})

if __name__ == '__main__':
    # Ensure the database is initialized
    init_db()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
