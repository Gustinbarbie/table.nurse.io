document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const controlsBar = document.getElementById('controlsBar');
    const toggleControlsBtn = document.getElementById('toggleControlsBtn');
    const mainBody = document.body;

    const newNurseNameInput = document.getElementById('newNurseName');
    const addNurseBtn = document.getElementById('addNurseBtn');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const generateScheduleBtn = document.getElementById('generateScheduleBtn');
    const departmentOTLimitInput = document.getElementById('departmentOTLimit');
    const totalAssignedOTDisplay = document.getElementById('totalAssignedOTDisplay');
    const scheduleTableContainer = document.getElementById('scheduleTableContainer');

    const holidayDateInput = document.getElementById('holidayDate');
    const addHolidayBtn = document.getElementById('addHolidayBtn');
    const customHolidaysList = document.getElementById('customHolidaysList');

    const downloadCsvBtn = document.getElementById('downloadCsvBtn');

    // --- VARIABLES & STATE ---
    let nurses = [];
    let schedule = {};
    let holidays = [];

    const shiftTypes = {
        "ช": "เช้า", "บ": "บ่าย", "ด": "ดึก",
        "OT-ช": "OT เช้า", "OT-บ": "OT บ่าย", "OT-ด": "OT ดึก",
        "OFF": "วันหยุด", 
        "ล": "ลาพักร้อน/ป่วย" // ใช้ "ล" เป็นตัวย่อสำหรับการลา
    };

    let isControlsCollapsed = false;
    let currentExpandedHeight = 0;
    let currentCollapsedHeight = 0;

    // --- FUNCTIONS FOR COLLAPSIBLE CONTROLS (REFINED) ---
    function applyBodyPadding() {
        if (!mainBody) return;
        mainBody.style.paddingTop = (isControlsCollapsed ? currentCollapsedHeight : currentExpandedHeight) + 'px';
    }

    function updateAndStoreControlsHeights() {
        if (!controlsBar) return;
        
        controlsBar.classList.remove('collapsed');
        currentExpandedHeight = controlsBar.offsetHeight;

        controlsBar.classList.add('collapsed');
        currentCollapsedHeight = controlsBar.offsetHeight;

        controlsBar.classList.toggle('collapsed', isControlsCollapsed);
    }

    function toggleControls() {
        if (!controlsBar || !toggleControlsBtn) return;
        isControlsCollapsed = !isControlsCollapsed;
        controlsBar.classList.toggle('collapsed', isControlsCollapsed);
        toggleControlsBtn.textContent = isControlsCollapsed ? 'ขยาย' : 'ย่อ';
        applyBodyPadding(); 
        localStorage.setItem('controlsCollapsedState', isControlsCollapsed.toString());
    }

    function initializeCollapsibleControls() {
        if (!controlsBar || !toggleControlsBtn) {
            console.warn("Collapsible controls elements (controlsBar or toggleControlsBtn) not found.");
            return;
        }
        const savedState = localStorage.getItem('controlsCollapsedState');
        isControlsCollapsed = (savedState === 'true');
        controlsBar.classList.toggle('collapsed', isControlsCollapsed);
        toggleControlsBtn.textContent = isControlsCollapsed ? 'ขยาย' : 'ย่อ';
        
        requestAnimationFrame(() => {
            setTimeout(() => {
                 updateAndStoreControlsHeights();
                 applyBodyPadding();
            }, 50);
        });

        toggleControlsBtn.addEventListener('click', toggleControls);
        window.addEventListener('resize', () => {
            if (controlsBar) {
                updateAndStoreControlsHeights();
                applyBodyPadding();
            }
        });
    }
    
    // --- OT LIMIT CHECK FUNCTIONS ---
    function calculateTotalAssignedOT(selectedMonth, selectedYear) {
        let totalOTCount = 0;
        for (const dateKey in schedule) {
            if (schedule.hasOwnProperty(dateKey)) {
                const [yearStr, monthStr] = dateKey.split('-');
                const year = parseInt(yearStr, 10);
                const month = parseInt(monthStr, 10) - 1;

                if (year === selectedYear && month === selectedMonth) {
                    const dailyShifts = schedule[dateKey];
                    for (const nurseId in dailyShifts) {
                        if (dailyShifts.hasOwnProperty(nurseId)) {
                            dailyShifts[nurseId].forEach(shift => {
                                if (shift && shift.toUpperCase().startsWith("OT-")) {
                                    totalOTCount++;
                                }
                            });
                        }
                    }
                }
            }
        }
        return totalOTCount;
    }

    function checkOTLimit() {
        if (!monthSelect || !yearSelect || !departmentOTLimitInput) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const currentDepartmentOTLimit = parseInt(departmentOTLimitInput.value, 10);

        if (isNaN(currentDepartmentOTLimit)) return; 

        const totalAssignedOT = calculateTotalAssignedOT(selectedMonth, selectedYear);

        if (totalAssignedOTDisplay) {
            totalAssignedOTDisplay.textContent = totalAssignedOT.toString();
        }

        if (totalAssignedOT > currentDepartmentOTLimit) {
            setTimeout(() => {
                alert(`คำเตือน: จำนวนเวร OT ที่จ่ายไป (${totalAssignedOT}) เกินขีดจำกัดของแผนก (${currentDepartmentOTLimit}) แล้ว!`);
            }, 100);
        }
    }

    // --- DATA MANAGEMENT & UTILITY FUNCTIONS ---
    function saveDataToLocalStorage() {
        localStorage.setItem('nurses', JSON.stringify(nurses));
        localStorage.setItem('schedule', JSON.stringify(schedule));
        localStorage.setItem('holidays', JSON.stringify(holidays));
        if (departmentOTLimitInput) {
            localStorage.setItem('departmentOTLimit', departmentOTLimitInput.value);
        }
    }

    function loadDataFromLocalStorage() {
        nurses = JSON.parse(localStorage.getItem('nurses')) || [];
        schedule = JSON.parse(localStorage.getItem('schedule')) || {};
        holidays = JSON.parse(localStorage.getItem('holidays')) || [];
        
        if (departmentOTLimitInput) {
            const savedOTLimit = localStorage.getItem('departmentOTLimit');
            departmentOTLimitInput.value = savedOTLimit !== null ? savedOTLimit : '100';
        }
    }

    function getDaysInMonth(month, year) { // month is 0-11
        return new Date(year, month + 1, 0).getDate();
    }

    function getDayOfWeek(year, month, day) { // month is 0-11
        return new Date(year, month, day).getDay(); // 0 = Sunday, 6 = Saturday
    }
    
    function populateMonthYearSelectors() {
        if (!monthSelect || !yearSelect) return;
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        monthSelect.innerHTML = '';
        thaiMonths.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            option.textContent = month;
            monthSelect.appendChild(option);
        });
        const today = new Date();
        monthSelect.value = today.getMonth().toString();
        yearSelect.value = today.getFullYear();
    }

    // --- NURSE MANAGEMENT ---
    function addNurse() {
        if (!newNurseNameInput) return;
        const name = newNurseNameInput.value.trim();
        if (name) {
            if (nurses.find(nurse => nurse.name === name)) {
                alert("มีพยาบาลชื่อนี้ในระบบแล้ว");
                return;
            }
            nurses.push({ id: Date.now(), name: name }); // Use Date.now() for a simple unique ID
            newNurseNameInput.value = '';
            renderScheduleTable();
            saveDataToLocalStorage();
        } else {
            alert("กรุณาใส่ชื่อพยาบาล");
        }
    }

    function handleDeleteNurse(event) {
        const nurseIdToDelete = parseInt(event.target.dataset.nurseId, 10);
        const nurseToDelete = nurses.find(n => n.id === nurseIdToDelete);

        if (!nurseToDelete) {
            console.error("ไม่พบพยาบาลที่ต้องการลบ ID:", nurseIdToDelete);
            return;
        }

        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบพยาบาล "${nurseToDelete.name}"?\nข้อมูลเวรทั้งหมดของพยาบาลคนนี้จะถูกลบไปด้วย`)) {
            nurses = nurses.filter(nurse => nurse.id !== nurseIdToDelete);
            for (const dateKey in schedule) {
                if (schedule.hasOwnProperty(dateKey) && schedule[dateKey][nurseIdToDelete]) {
                    delete schedule[dateKey][nurseIdToDelete];
                    if (Object.keys(schedule[dateKey]).length === 0) {
                        delete schedule[dateKey];
                    }
                }
            }
            saveDataToLocalStorage();
            renderScheduleTable();
        }
    }

    // --- HOLIDAY MANAGEMENT ---
    function addHolidayFromInput() {
        if (!holidayDateInput) return;
        const dateStr = holidayDateInput.value;
        if (dateStr) {
            if (!holidays.includes(dateStr)) {
                holidays.push(dateStr);
                holidays.sort();
                saveDataToLocalStorage();
                renderCustomHolidaysList();
                renderScheduleTable();
                holidayDateInput.value = '';
            } else {
                alert("วันหยุดนี้ถูกกำหนดไว้แล้ว");
            }
        } else {
            alert("กรุณาเลือกวันที่");
        }
    }

    function removeHoliday(dateStr) {
        holidays = holidays.filter(h => h !== dateStr);
        saveDataToLocalStorage();
        renderCustomHolidaysList();
        renderScheduleTable();
    }

    function renderCustomHolidaysList() {
        if (!customHolidaysList) return;
        customHolidaysList.innerHTML = '';
        if (holidays.length === 0) {
            customHolidaysList.innerHTML = '<li>ยังไม่มีวันหยุดที่กำหนด</li>';
            return;
        }
        holidays.forEach(dateStr => {
            const li = document.createElement('li');
            li.textContent = `${dateStr} `;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'ลบ';
            removeBtn.onclick = () => removeHoliday(dateStr);
            li.appendChild(removeBtn);
            customHolidaysList.appendChild(li);
        });
    }

    // --- SCHEDULE RENDERING & UPDATES ---
    function renderScheduleTable() {
        if (!scheduleTableContainer || !monthSelect || !yearSelect) {
            console.error("Missing core elements for rendering schedule table.");
            return;
        }
        scheduleTableContainer.innerHTML = '';
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Header Row 1: Dates & Monthly Summary Titles
        const headerRow1 = document.createElement('tr');
        headerRow1.appendChild(document.createElement('th')).textContent = 'วันที่';
        for (let day = 1; day <= daysInMonth; day++) {
            const th = document.createElement('th');
            th.textContent = day.toString();
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
            if (holidays.includes(dateStr)) th.classList.add('holiday');
            else if (dayOfWeek === 0 || dayOfWeek === 6) th.classList.add('weekend');
            headerRow1.appendChild(th);
        }
        headerRow1.appendChild(document.createElement('th')).classList.add('summary-col');
        Object.keys(shiftTypes).forEach(() => headerRow1.appendChild(document.createElement('th')).classList.add('summary-col'));
        headerRow1.appendChild(document.createElement('th')).classList.add('summary-col');
        thead.appendChild(headerRow1);
        
        const headerRow2 = document.createElement('tr');
        headerRow2.appendChild(document.createElement('td')).innerHTML = '<b>สรุปเวรรายวัน</b>';
        for (let day = 1; day <= daysInMonth; day++) {
            const td = document.createElement('td');
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            td.id = `daily-summary-${dateStr}`;
            const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
            if (holidays.includes(dateStr)) td.classList.add('holiday');
            else if (dayOfWeek === 0 || dayOfWeek === 6) td.classList.add('weekend');
            headerRow2.appendChild(td);
        }
        headerRow2.appendChild(document.createElement('td')).textContent = 'รวมเวร';
        headerRow2.querySelector('td:last-child').classList.add('summary-col');
        Object.keys(shiftTypes).forEach(st => {
             const td = document.createElement('td');
             td.textContent = st;
             td.classList.add('summary-col');
             headerRow2.appendChild(td);
        });
        headerRow2.appendChild(document.createElement('td')).textContent = 'รวม OT';
        headerRow2.querySelector('td:last-child').classList.add('summary-col');
        thead.appendChild(headerRow2);
        table.appendChild(thead);

        nurses.forEach(nurse => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.appendChild(document.createTextNode(nurse.name + " ")); 

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'ลบ';
            deleteBtn.classList.add('delete-nurse-btn');
            deleteBtn.dataset.nurseId = nurse.id.toString();
            deleteBtn.addEventListener('click', handleDeleteNurse);
            nameCell.appendChild(deleteBtn);
            row.appendChild(nameCell);

            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.classList.add('shift-input');
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                input.dataset.nurseId = nurse.id.toString();
                input.dataset.date = dateStr;
                input.value = schedule[dateStr]?.[nurse.id]?.join(',') || '';
                input.addEventListener('change', handleShiftChange);
                const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
                if (holidays.includes(dateStr)) cell.classList.add('holiday');
                else if (dayOfWeek === 0 || dayOfWeek === 6) cell.classList.add('weekend');
                cell.appendChild(input);
                row.appendChild(cell);
            }
            row.appendChild(document.createElement('td')).id = `nurse-${nurse.id}-total`;
            row.querySelector('td:last-child').classList.add('summary-col');
            Object.keys(shiftTypes).forEach(st => {
                const cell = document.createElement('td');
                cell.id = `nurse-${nurse.id}-type-${st}`;
                cell.classList.add('summary-col');
                row.appendChild(cell);
            });
            row.appendChild(document.createElement('td')).id = `nurse-${nurse.id}-ot-total`;
            row.querySelector('td:last-child').classList.add('summary-col');
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        scheduleTableContainer.appendChild(table);
        
        updateAllSummaries();
        checkOTLimit();
    }

    function handleShiftChange(event) {
        const nurseId = parseInt(event.target.dataset.nurseId, 10);
        const date = event.target.dataset.date;
        const shifts = event.target.value.toUpperCase().split(',').map(s => s.trim()).filter(s => s);
        if (!schedule[date]) schedule[date] = {};
        schedule[date][nurseId] = shifts;
        updateAllSummaries();
        saveDataToLocalStorage();
        checkOTLimit();
    }

    function updateAllSummaries() {
        updateDailyShiftCounts();
        updateMonthlyNurseSummaries();
    }

    function updateDailyShiftCounts() {
        if (!monthSelect || !yearSelect) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dailySummaryCell = document.getElementById(`daily-summary-${dateStr}`);
            if (!dailySummaryCell) continue;
            const dailyCounts = {};
            Object.keys(shiftTypes).forEach(st => dailyCounts[st] = 0);
            if (schedule[dateStr]) {
                Object.values(schedule[dateStr]).forEach(nurseShifts => {
                    nurseShifts.forEach(shift => {
                        if (shiftTypes[shift]) dailyCounts[shift]++;
                    });
                });
            }
            dailySummaryCell.innerHTML = Object.keys(shiftTypes)
                                          .map(st => `<div>${st}: ${dailyCounts[st]}</div>`)
                                          .join('');
        }
    }
    
    function updateMonthlyNurseSummaries() {
        if (!monthSelect || !yearSelect) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        nurses.forEach(nurse => {
            let totalShifts = 0;
            const typeCounts = {};
            Object.keys(shiftTypes).forEach(st => typeCounts[st] = 0);
            let totalOT = 0;
            for (const dateKey in schedule) {
                if (schedule.hasOwnProperty(dateKey)) {
                    const [yearStr, monthStr] = dateKey.split('-');
                    const year = parseInt(yearStr, 10);
                    const month = parseInt(monthStr, 10) - 1;
                    if (year === selectedYear && month === selectedMonth) {
                        if (schedule[dateKey][nurse.id]) {
                            schedule[dateKey][nurse.id].forEach(shift => {
                                if (shiftTypes[shift]) {
                                    totalShifts++;
                                    typeCounts[shift]++;
                                    if (shift.toUpperCase().startsWith("OT-")) totalOT++;
                                }
                            });
                        }
                    }
                }
            }
            const totalCell = document.getElementById(`nurse-${nurse.id}-total`);
            if (totalCell) totalCell.textContent = totalShifts.toString();
            Object.keys(shiftTypes).forEach(st => {
                const typeCell = document.getElementById(`nurse-${nurse.id}-type-${st}`);
                if (typeCell) typeCell.textContent = (typeCounts[st] || 0).toString();
            });
            const otCell = document.getElementById(`nurse-${nurse.id}-ot-total`);
            if (otCell) otCell.textContent = totalOT.toString();
        });
    }
    
    // --- CSV EXPORT ---
    function downloadScheduleAsCsv() {
        if (!monthSelect || !yearSelect) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        let csvContent = "\uFEFF";
        const header1 = ['ชื่อพยาบาล'];
        for (let day = 1; day <= daysInMonth; day++) header1.push(day.toString());
        header1.push('รวมเวร');
        Object.keys(shiftTypes).forEach(st => header1.push(st));
        header1.push('รวม OT');
        csvContent += header1.join(',') + '\r\n';
        nurses.forEach(nurse => {
            const nurseRow = [`"${nurse.name.replace(/"/g, '""')}"`];
            let monthlyTotalShifts = 0;
            const monthlyTypeCounts = {};
            Object.keys(shiftTypes).forEach(st => monthlyTypeCounts[st] = 0);
            let monthlyTotalOT = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                let cellData = "";
                if (schedule[dateStr]?.[nurse.id]) {
                    cellData = schedule[dateStr][nurse.id].join('/');
                     schedule[dateStr][nurse.id].forEach(shift => {
                        if (shiftTypes[shift]) {
                            monthlyTotalShifts++;
                            monthlyTypeCounts[shift]++;
                            if (shift.toUpperCase().startsWith("OT-")) monthlyTotalOT++;
                        }
                    });
                }
                nurseRow.push(`"${cellData.replace(/"/g, '""')}"`);
            }
            nurseRow.push(monthlyTotalShifts);
            Object.keys(shiftTypes).forEach(st => nurseRow.push(monthlyTypeCounts[st] || 0));
            nurseRow.push(monthlyTotalOT);
            csvContent += nurseRow.join(',') + '\r\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `ตารางเวร-${thaiMonths[selectedMonth]}-${selectedYear}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // --- INITIALIZATION ---
    function init() {
        if (addNurseBtn) addNurseBtn.addEventListener('click', addNurse);
        else console.error("addNurseBtn not found");

        if (generateScheduleBtn) generateScheduleBtn.addEventListener('click', renderScheduleTable);
        else console.error("generateScheduleBtn not found");
        
        if (departmentOTLimitInput) {
            departmentOTLimitInput.addEventListener('change', (e) => {
                localStorage.setItem('departmentOTLimit', e.target.value);
                checkOTLimit(); 
            });
        } else console.error("departmentOTLimitInput not found");

        if (addHolidayBtn) addHolidayBtn.addEventListener('click', addHolidayFromInput);
        else console.error("addHolidayBtn not found");

        if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadScheduleAsCsv);
        else console.error("downloadCsvBtn not found");
        
        populateMonthYearSelectors();
        loadDataFromLocalStorage(); // Loads data including OT limit
        renderCustomHolidaysList();
        renderScheduleTable();      // Initial render, this will call checkOTLimit
        initializeCollapsibleControls(); // Initialize collapsible controls at the end
    }

    init(); // Start the application
});