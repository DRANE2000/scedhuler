// static/js/script.js

document.addEventListener('DOMContentLoaded', function () {
    
    const calendarEl = document.getElementById('calendar');
    const modalElement = document.getElementById('appointmentModal');
    const modalDetails = document.getElementById('modalDetails');
    const appointmentIdInput = document.getElementById('appointment_id');
    const deleteButton = document.getElementById('deleteButton');
    const priceContainer = document.getElementById('priceContainer');
    const commentsContainer = document.getElementById('commentsContainer');
    const modalPrice = document.getElementById('modalPrice');
    const modalComments = document.getElementById('modalComments');
    let appointments = [];
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize currentDate to today in Edmonton Time (date-only)
    let currentDate = getEdmontonToday();
    
    // Current View: 'monthly' or 'weekly'
    let currentView = 'monthly';
    
    // Fetch appointments and generate calendar
    function fetchAppointments() {
        // Display loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'd-flex justify-content-center align-items-center my-5';
        loadingSpinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        calendarEl.innerHTML = '';
        calendarEl.appendChild(loadingSpinner);

        fetch('/appointments_data')
            .then(response => response.json())
            .then(data => {
                appointments = data;
                generateCalendar();
            })
            .catch(error => {
                console.error('Error fetching appointments:', error);
                showAlert('Failed to load appointments. Please try again later.', 'danger');
                calendarEl.innerHTML = ''; // Remove spinner
            });
    }

    // Function to get today's date in Edmonton Time as Date object (midnight)
    function getEdmontonToday() {
        const now = new Date();
        const options = { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // 'en-CA' gives 'YYYY-MM-DD'
        const dateStr = formatter.format(now);
        return new Date(dateStr + 'T00:00:00');
    }

    // Function to format Date object to 'YYYY-MM-DD' in Edmonton Time
    function formatDate(date) {
        const options = { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // 'en-CA' gives 'YYYY-MM-DD'
        return formatter.format(date);
    }

    // Generate the calendar based on currentDate and currentView
    function generateCalendar() {
        calendarEl.innerHTML = '';

        if (currentView === 'monthly') {
            generateMonthlyCalendar();
        } else if (currentView === 'weekly') {
            generateWeeklyCalendar();
        }
    }

    // Generate Monthly Calendar
    function generateMonthlyCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const numDays = new Date(year, month + 1, 0).getDate();

        const monthContainer = document.createElement('div');
        monthContainer.className = 'month-container';

        const monthHeader = document.createElement('h3');
        monthHeader.textContent = `${monthNames[month]} ${year}`;
        monthContainer.appendChild(monthHeader);

        const monthGrid = document.createElement('div');
        monthGrid.className = 'month-grid';

        // Add day names
        dayNames.forEach(day => {
            const dayName = document.createElement('div');
            dayName.className = 'day-name';
            dayName.textContent = day;
            monthGrid.appendChild(dayName);
        });

        // Fill in blank cells for days before the first day
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'date-cell';
            monthGrid.appendChild(emptyCell);
        }

        // Today's date in Edmonton Time
        const todayStr = formatDate(new Date());

        // Fill in date cells
        for (let day = 1; day <= numDays; day++) {
            const dateCell = document.createElement('div');
            dateCell.className = 'date-cell';
            dateCell.textContent = day;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Check if the date has appointments
            const dayAppointments = appointments.filter(app => app.date === dateStr);
            if (dayAppointments.length > 0) {
                dateCell.classList.add('has-appointment');
                // Display appointment details (time, name, service)
                dayAppointments.forEach(app => {
                    const appDiv = document.createElement('div');
                    appDiv.className = `appointment ${app.type}`; // 'business' or 'personal'
                    appDiv.innerHTML = `
                        <strong>${app.time}</strong> - ${app.name || app.description || ''} - ${app.service || ''}
                    `;
                    appDiv.dataset.id = app.id;
                    appDiv.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent triggering dateCell click
                        openModal(app);
                    });
                    dateCell.appendChild(appDiv);
                });
            }

            // Highlight only today's date
            if (dateStr === todayStr) {
                dateCell.classList.add('selected');
            }

            // Add click event to select the date and switch to weekly view
            dateCell.addEventListener('click', () => {
                currentDate = new Date(dateStr + 'T00:00:00'); // Set to midnight
                currentView = 'weekly';
                updateViewButtons();
                generateCalendar();
                populateDateNumbers(); // Ensure date numbers are updated immediately
                highlightSelectedDateNumber();
            });

            monthGrid.appendChild(dateCell);
        }

        monthContainer.appendChild(monthGrid);
        calendarEl.appendChild(monthContainer);
    }

    // Generate Weekly Calendar
    function generateWeeklyCalendar() {
        const weekDates = getWeekDates(currentDate);
        const weekContainer = document.createElement('div');
        weekContainer.className = 'week-container';

        weekDates.forEach((date, index) => {
            const dateStr = formatDate(date);
            const dayAppointments = appointments.filter(app => app.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

            const dayContainer = document.createElement('div');
            dayContainer.className = 'day-container';

            // Determine if the day is selected, previous, or next
            if (isSameDate(date, currentDate)) {
                dayContainer.classList.add('selected-day');
            } else if (isAdjacentDay(date, currentDate)) {
                dayContainer.classList.add('adjacent-day');
            } else {
                dayContainer.style.display = 'none'; // Hide other days
            }

            // Date Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date';
            dateHeader.textContent = `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
            dayContainer.appendChild(dateHeader);

            // Appointments Display
            if (dayAppointments.length > 0) {
                dayAppointments.forEach(app => {
                    const appDiv = document.createElement('div');
                    appDiv.className = `appointment ${app.type}`; // 'business' or 'personal'
                    appDiv.innerHTML = `
                        <strong>${app.time}</strong> - ${app.name || app.description || ''} - ${app.service || ''}
                    `;
                    appDiv.dataset.id = app.id;
                    appDiv.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent triggering dayContainer click
                        openModal(app);
                    });
                    dayContainer.appendChild(appDiv);
                });
            } else {
                const noAppDiv = document.createElement('div');
                noAppDiv.className = 'appointment no-appointment';
                noAppDiv.textContent = 'No Appointments';
                dayContainer.appendChild(noAppDiv);
            }

            // Click event to select the day
            dayContainer.addEventListener('click', () => {
                currentDate = new Date(dateStr + 'T00:00:00'); // Set to midnight
                currentView = 'weekly';
                updateViewButtons();
                generateCalendar();
                populateDateNumbers(); // Ensure date numbers are updated immediately
                highlightSelectedDateNumber();
            });

            weekContainer.appendChild(dayContainer);
        });

        calendarEl.appendChild(weekContainer);
    }

    // Function to get all dates in the week of the given date (Sunday to Saturday)
    function getWeekDates(date) {
        const week = [];
        const current = new Date(date);
        const day = current.getDay(); // 0 (Sun) to 6 (Sat)
        current.setDate(current.getDate() - day); // Set to Sunday

        for (let i = 0; i < 7; i++) {
            week.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return week;
    }

    // Function to handle opening the modal with appointment details
    function openModal(appointment) {
        // Convert time to 12-hour AM/PM format
        const timeParts = appointment.time.split(':'); // Split time into hours and minutes
        const timeDateObject = new Date();
        timeDateObject.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10));
        const formattedTime = timeDateObject.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        // Populate modal details
        let details = `
            <p><strong>Date:</strong> ${appointment.date}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> ${appointment.duration} mins</p>
        `;

        if (appointment.type === 'business') {
            details += `
                <p><strong>Name:</strong> ${appointment.name || 'N/A'}</p>
                <p><strong>Service:</strong> ${appointment.service || 'N/A'}</p>
                ${appointment.sub_service ? `<p><strong>Sub-Service:</strong> ${appointment.sub_service}</p>` : ''}
                ${appointment.price !== null ? `<p><strong>Price:</strong> $${appointment.price.toFixed(2)}</p>` : ''}
            `;
        } else if (appointment.type === 'personal') {
            details += `
                <p><strong>Description:</strong> ${appointment.description || 'N/A'}</p>
            `;
        }

        details += `
            ${appointment.comments ? `<p><strong>Comments:</strong> ${appointment.comments}</p>` : ''}
        `;

        modalDetails.innerHTML = details;
        appointmentIdInput.value = appointment.id;

        // Show or hide price container based on appointment type
        if (appointment.type === 'business') {
            priceContainer.style.display = 'block';
            modalPrice.value = appointment.price !== null ? appointment.price.toFixed(2) : '';
        } else {
            priceContainer.style.display = 'none';
        }

        // Always show comments container
        commentsContainer.style.display = 'block';
        modalComments.value = appointment.comments || '';

        // Display the modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }

    // Event listener for updating appointment details when modal is closed
    modalElement.addEventListener('hidden.bs.modal', () => {
        const appointmentId = appointmentIdInput.value;
        const price = modalPrice.value ? parseFloat(modalPrice.value) : null;
        const comments = modalComments.value ? modalComments.value : null;

        fetch('/update_appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: appointmentId, price, comments })
        }).then(() => fetchAppointments());
    });

    // Event listener for deleting appointments
    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            const appointmentId = appointmentIdInput.value;
            // Show confirmation dialog
            if (confirm('Are you sure you want to delete this appointment?')) {
                fetch('/delete_appointment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appointment_id: appointmentId })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message === "Appointment deleted successfully") {
                            // Refresh appointments and calendar
                            fetchAppointments();
                            // Close the modal
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            modalInstance.hide();
                            // Show success message
                            showAlert('Appointment deleted successfully', 'success');
                        } else {
                            showAlert('Failed to delete appointment.', 'danger');
                        }
                    })
                    .catch(error => {
                        console.error('Error deleting appointment:', error);
                        showAlert('Error deleting appointment.', 'danger');
                    });
            }
        });
    }

    // Function to show alerts
    function showAlert(message, type='success') {
        const alertContainer = document.getElementById('alertContainer');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.classList.remove('show');
            alertDiv.classList.add('hide');
            alertDiv.addEventListener('transitionend', () => alertDiv.remove());
        }, 3000);
    }

    // Event listeners for navigation arrows
    const prevArrow = document.getElementById('prevArrow');
    const nextArrow = document.getElementById('nextArrow');

    if (prevArrow && nextArrow) {
        prevArrow.addEventListener('click', () => {
            if (currentView === 'weekly') {
                currentDate.setDate(currentDate.getDate() - 7);
            } else if (currentView === 'monthly') {
                currentDate.setMonth(currentDate.getMonth() - 1);
            }
            currentDate = getEdmontonTodayFromDate(currentDate);
            generateCalendar();
            if (currentView === 'weekly') {
                populateDateNumbers(); // Ensure date numbers are updated immediately
                highlightSelectedDateNumber();
            }
        });

        nextArrow.addEventListener('click', () => {
            if (currentView === 'weekly') {
                currentDate.setDate(currentDate.getDate() + 7);
            } else if (currentView === 'monthly') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
            currentDate = getEdmontonTodayFromDate(currentDate);
            generateCalendar();
            if (currentView === 'weekly') {
                populateDateNumbers(); // Ensure date numbers are updated immediately
                highlightSelectedDateNumber();
            }
        });
    }

    // Function to adjust date to Edmonton Time after changing date
    function getEdmontonTodayFromDate(date) {
        const options = { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // 'en-CA' gives 'YYYY-MM-DD'
        const dateStr = formatter.format(date);
        return new Date(dateStr + 'T00:00:00');
    }

    // Toggle Buttons for Calendar Views
    const monthlyViewBtn = document.getElementById('monthlyViewBtn');
    const weeklyViewBtn = document.getElementById('dailyViewBtn'); // Ensure this ID matches in HTML

    if (monthlyViewBtn && weeklyViewBtn) {
        monthlyViewBtn.addEventListener('click', () => {
            if (currentView !== 'monthly') {
                currentView = 'monthly';
                updateViewButtons();
                generateCalendar();
            }
        });

        weeklyViewBtn.addEventListener('click', () => {
            if (currentView !== 'weekly') {
                currentView = 'weekly';
                updateViewButtons();
                generateCalendar();
                populateDateNumbers();
                highlightSelectedDateNumber();
            }
        });
    }

    function updateViewButtons() {
        if (currentView === 'monthly') {
            if (monthlyViewBtn) monthlyViewBtn.classList.add('active');
            if (weeklyViewBtn) weeklyViewBtn.classList.remove('active');
            const dateNumbersContainer = document.getElementById('dateNumbersContainer');
            if (dateNumbersContainer) dateNumbersContainer.style.display = 'none';
        } else if (currentView === 'weekly') {
            if (weeklyViewBtn) weeklyViewBtn.classList.add('active');
            if (monthlyViewBtn) monthlyViewBtn.classList.remove('active');
            const dateNumbersContainer = document.getElementById('dateNumbersContainer');
            if (dateNumbersContainer) dateNumbersContainer.style.display = 'block';
            populateDateNumbers();
        }
    }

    // Populate Date Numbers for Weekly View (7 numbers for the week)
    function populateDateNumbers() {
        const dateNumbersContainer = document.querySelector('#dateNumbersContainer ul');
        if (!dateNumbersContainer) return;
        dateNumbersContainer.innerHTML = ''; // Clear existing buttons

        const weekDates = getWeekDates(currentDate);

        weekDates.forEach(date => {
            const dayName = dayNames[date.getDay()];
            const dayNumber = date.getDate();
            const month = monthNames[date.getMonth()];
            const dateStr = formatDate(date);

            const dateButton = document.createElement('button');
            dateButton.className = 'btn btn-outline-secondary btn-sm date-number';
            dateButton.textContent = `${dayName} ${dayNumber}`;
            dateButton.dataset.date = dateStr;

            // Highlight the current selected day
            if (isSameDate(date, currentDate)) {
                dateButton.classList.add('selected');
            }

            // Add click event to select the date
            dateButton.addEventListener('click', () => {
                currentDate = new Date(dateStr + 'T00:00:00'); // Set to midnight
                currentDate = getEdmontonTodayFromDate(currentDate);
                currentView = 'weekly'; // Ensure the view remains weekly
                updateViewButtons();
                generateCalendar();
                highlightSelectedDateNumber();
            });

            dateNumbersContainer.appendChild(dateButton);
        });
    }

    // Function to highlight the selected date number
    function highlightSelectedDateNumber() {
        const dateNumberButtons = document.querySelectorAll('.date-number');
        dateNumberButtons.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.date === formatDate(currentDate)) {
                btn.classList.add('selected');
            }
        });
    }

    // Helper Functions
    function isSameDate(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    function isAdjacentDay(date, referenceDate) {
        const prevDate = new Date(referenceDate);
        prevDate.setDate(referenceDate.getDate() - 1);
        const nextDate = new Date(referenceDate);
        nextDate.setDate(referenceDate.getDate() + 1);
        return isSameDate(date, prevDate) || isSameDate(date, nextDate);
    }

    // Initialize by fetching appointments
    fetchAppointments();
});
