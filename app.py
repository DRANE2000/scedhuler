from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)

# Database configuration
# Use external URL for production, fallback to internal URL if not set
DATABASE_URL = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Define Appointment model
class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100))
    service = db.Column(db.String(100))
    sub_service = db.Column(db.String(100))
    description = db.Column(db.String(200))
    date = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(50), nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float)
    comments = db.Column(db.Text)

# Ensure the database is initialized
# Ensure the database is initialized
with app.app_context():
    db.create_all()


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
                    sub_service_name = custom_sub_service
                    duration = int(duration_input) if duration_input else 15
            else:
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
            conflicts = Appointment.query.filter(
                Appointment.date == date,
                (Appointment.time < end_time) & (Appointment.time >= start_time)
            ).all()

            if conflicts and not request.form.get('confirm'):
                conflict_message = "Time conflict detected with existing appointments."
                return render_template(
                    "appointments.html",
                    services=services,
                    conflict_message=conflict_message,
                    form_data=request.form
                )

            # Add the appointment
            new_appointment = Appointment(
                type="business",
                name=request.form.get('name'),
                service=service,
                sub_service=sub_service_name,
                date=date,
                time=start_time,
                duration=duration,
                price=float(request.form['price']) if request.form.get('price') else None,
                comments=request.form.get('comments')
            )
            db.session.add(new_appointment)
            db.session.commit()
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

            new_appointment = Appointment(
                type="personal",
                description=description,
                date=date,
                time=time_24hr,
                duration=30,
                comments=request.form.get('comments')
            )
            db.session.add(new_appointment)
            db.session.commit()
            return redirect(url_for('calendar_view'))

        else:
            return redirect(url_for('appointments_page'))

    else:
        return render_template("appointments.html", services=services, form_data={})

@app.route('/appointments_data', methods=['GET'])
def get_appointments():
    appointments = Appointment.query.all()
    return jsonify([{
        'id': a.id,
        'type': a.type,
        'name': a.name,
        'service': a.service,
        'sub_service': a.sub_service,
        'description': a.description,
        'date': a.date,
        'time': a.time,
        'duration': a.duration,
        'price': a.price,
        'comments': a.comments
    } for a in appointments])

@app.route('/delete_appointment', methods=['POST'])
def delete_appointment():
    data = request.get_json()
    appointment_id = int(data['appointment_id'])
    appointment = Appointment.query.get(appointment_id)
    if appointment:
        db.session.delete(appointment)
        db.session.commit()
    return jsonify({"message": "Appointment deleted successfully"})

@app.route('/update_appointment', methods=['POST'])
def update_appointment():
    data = request.get_json()
    appointment_id = data.get('id')
    appointment = Appointment.query.get(appointment_id)
    if appointment:
        appointment.price = data.get('price')
        appointment.comments = data.get('comments')
        db.session.commit()
    return jsonify({"message": "Appointment updated successfully"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(debug=True, host='0.0.0.0', port=port)
