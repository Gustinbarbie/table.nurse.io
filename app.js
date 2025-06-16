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

    const shiftModal = document.getElementById('shiftSelectionModal');
    const modalContent = document.getElementById('shiftModalContent');
    const modalTitle = document.getElementById('modalTitle');
    const shiftModalBody = document.getElementById('shiftModalBody');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalOkBtn = document.getElementById('modalOkBtn');

    // --- VARIABLES & STATE ---
    let nurses = [];
    let schedule = {}; 
    let holidays = [];

    // shiftTypes สำหรับการเลือกใน Modal (ไม่มี "OFF" ที่นี่)
    const shiftTypes = {
        "ช": "เช้า", "บ": "บ่าย", "ด": "ดึก",
        "ช1": "OT เช้า", "บ1": "OT บ่าย", "ด1": "OT ดึก"
    };

    // summaryColumnOrder สำหรับการแสดงผลคอลัมน์สรุป (มี "OFF" สำหรับแสดงผลที่คำนวณได้)
    const summaryColumnOrder = ["ช", "บ", "ด", "รวมเวร", "ช1", "บ1", "ด1", "รวมOT", "OFF"];
    // dailySummaryDisplayConfig สำหรับการแสดงผลสรุปรายวัน (มี "OFF" สำหรับแสดงผลที่คำนวณได้)
    const dailySummaryDisplayConfig = [
        { key: "ด", label: "ด", otKey: "ด1" },
        { key: "ช", label: "ช", otKey: "ช1" },
        { key: "บ", label: "บ", otKey: "บ1" },
        { key: "OFF", label: "OFF", otKey: null }
    ];

    let isControlsCollapsed = false;
    let currentExpandedHeight = 0;
    let currentCollapsedHeight = 0;
    let currentEditingCell = { nurseId: null, date: null, nurseName: null };

    // --- FUNCTIONS FOR COLLAPSIBLE CONTROLS ---
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
        if (!controlsBar || !toggleControlsBtn) { console.warn("Collapsible controls elements not found."); return; }
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
            if (controlsBar) { updateAndStoreControlsHeights(); applyBodyPadding(); }
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
                        if (dailyShifts.hasOwnProperty(nurseId) && Array.isArray(dailyShifts[nurseId])) {
                            dailyShifts[nurseId].forEach(shift => {
                                if (shift === "ช1" || shift === "บ1" || shift === "ด1") {
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
        if (totalAssignedOTDisplay) { totalAssignedOTDisplay.textContent = totalAssignedOT.toString(); }
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
        if (departmentOTLimitInput) { localStorage.setItem('departmentOTLimit', departmentOTLimitInput.value); }
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
    function getDaysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); }
    function getDayOfWeek(year, month, day) { return new Date(year, month, day).getDay(); }
    function populateMonthYearSelectors() {
        if (!monthSelect || !yearSelect) return;
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        monthSelect.innerHTML = '';
        thaiMonths.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index.toString(); option.textContent = month;
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
            if (nurses.find(nurse => nurse.name === name)) { alert("มีพยาบาลชื่อนี้ในระบบแล้ว"); return; }
            nurses.push({ id: Date.now(), name: name });
            newNurseNameInput.value = '';
            renderScheduleTable(); saveDataToLocalStorage();
        } else { alert("กรุณาใส่ชื่อพยาบาล"); }
    }
    function handleDeleteNurse(event) {
        event.stopPropagation(); 
        const nurseIdToDelete = parseInt(event.target.dataset.nurseId, 10);
        const nurseToDelete = nurses.find(n => n.id === nurseIdToDelete);
        if (!nurseToDelete) return;
        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบพยาบาล "${nurseToDelete.name}"?\nข้อมูลเวรทั้งหมดของพยาบาลคนนี้จะถูกลบไปด้วย`)) {
            nurses = nurses.filter(nurse => nurse.id !== nurseIdToDelete);
            for (const dateKey in schedule) {
                if (schedule.hasOwnProperty(dateKey) && schedule[dateKey][nurseIdToDelete]) {
                    delete schedule[dateKey][nurseIdToDelete];
                    if (Object.keys(schedule[dateKey]).length === 0) { delete schedule[dateKey]; }
                }
            }
            saveDataToLocalStorage(); renderScheduleTable();
        }
    }

    // --- HOLIDAY MANAGEMENT ---
    function addHolidayFromInput() {
        if (!holidayDateInput) return;
        const dateStr = holidayDateInput.value;
        if (dateStr) {
            if (!holidays.includes(dateStr)) {
                holidays.push(dateStr); holidays.sort();
                saveDataToLocalStorage(); renderCustomHolidaysList(); renderScheduleTable();
                holidayDateInput.value = '';
            } else { alert("วันหยุดนี้ถูกกำหนดไว้แล้ว"); }
        } else { alert("กรุณาเลือกวันที่"); }
    }
    function removeHoliday(dateStr) {
        holidays = holidays.filter(h => h !== dateStr);
        saveDataToLocalStorage(); renderCustomHolidaysList(); renderScheduleTable();
    }
    function renderCustomHolidaysList() {
        if (!customHolidaysList) return;
        customHolidaysList.innerHTML = '';
        if (holidays.length === 0) { customHolidaysList.innerHTML = '<li>ยังไม่มีวันหยุดที่กำหนด</li>'; return; }
        holidays.forEach(dateStr => {
            const li = document.createElement('li');
            li.textContent = `${dateStr} `;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'ลบ';
            removeBtn.onclick = () => removeHoliday(dateStr);
            li.appendChild(removeBtn); customHolidaysList.appendChild(li);
        });
    }

    // --- SHIFT SELECTION POPOVER/MODAL FUNCTIONS ---
    function openShiftModal(nurseId, date, nurseName, clickedCellElement) {
        if (!shiftModal || !modalContent || !modalTitle || !shiftModalBody || !clickedCellElement) {
            console.error("Modal elements not found or cell not provided for opening modal."); return;
        }
        currentEditingCell.nurseId = parseInt(nurseId, 10);
        currentEditingCell.date = date;
        currentEditingCell.nurseName = nurseName; 
        const [year, month, day] = date.split('-');
        modalTitle.textContent = `เลือกเวร: ${nurseName} (วันที่ ${parseInt(day)}/${parseInt(month)}/${year})`;
        shiftModalBody.innerHTML = ''; 
        const currentShiftsForCell = schedule[date]?.[parseInt(nurseId, 10)] || [];

        // วนลูป shiftTypes (ซึ่งตอนนี้ไม่มี "OFF") เพื่อสร้าง checkbox
        for (const code in shiftTypes) {
            if (shiftTypes.hasOwnProperty(code)) {
                const optionDiv = document.createElement('div');
                optionDiv.classList.add('shift-option');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `shift-checkbox-${code}-${nurseId}-${date}`;
                checkbox.value = code;
                checkbox.checked = currentShiftsForCell.includes(code);
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = `${code} (${shiftTypes[code]})`;
                optionDiv.appendChild(checkbox); optionDiv.appendChild(label);
                shiftModalBody.appendChild(optionDiv);
            }
        }
        const rect = clickedCellElement.getBoundingClientRect();
        modalContent.style.top = 'auto'; modalContent.style.left = 'auto';
        modalContent.style.bottom = 'auto'; modalContent.style.right = 'auto';
        shiftModal.style.display = 'block'; // Show overlay
        let topPos = rect.bottom + window.scrollY + 2;
        let leftPos = rect.left + window.scrollX;
        const popoverHeight = modalContent.offsetHeight;
        const popoverWidth = modalContent.offsetWidth;
        if (topPos + popoverHeight > window.innerHeight + window.scrollY) {
            topPos = rect.top + window.scrollY - popoverHeight - 2;
        }
        if (leftPos + popoverWidth > window.innerWidth + window.scrollX) {
            leftPos = rect.right + window.scrollX - popoverWidth;
        }
        topPos = Math.max(5 + window.scrollY, topPos);
        leftPos = Math.max(5 + window.scrollX, leftPos);
        modalContent.style.top = `${topPos}px`;
        modalContent.style.left = `${leftPos}px`;
    }

    function closeShiftModal() {
        if (shiftModal) shiftModal.style.display = 'none';
        currentEditingCell = { nurseId: null, date: null, nurseName: null };
    }

    function handleModalOk() {
        if (!shiftModalBody || !currentEditingCell.nurseId || !currentEditingCell.date) return;
        const selectedShifts = [];
        const checkboxes = shiftModalBody.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => { selectedShifts.push(checkbox.value.toUpperCase()); });
        const { nurseId, date } = currentEditingCell;
        if (!schedule[date]) { schedule[date] = {}; }
        schedule[date][nurseId] = selectedShifts; // ถ้าไม่เลือกอะไรเลย selectedShifts จะเป็น []
        saveDataToLocalStorage();
        renderScheduleTable();
        checkOTLimit();
        closeShiftModal();
    }

    // --- SCHEDULE RENDERING & UPDATES ---
    function renderScheduleTable() {
        if (!scheduleTableContainer || !monthSelect || !yearSelect) {
             console.error("renderScheduleTable: Core elements missing."); return;
        }
        scheduleTableContainer.innerHTML = '';
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

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
        summaryColumnOrder.forEach(() => { // ใช้ summaryColumnOrder ที่อัปเดตแล้ว
            headerRow1.appendChild(document.createElement('th')).classList.add('summary-col');
        });
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
        summaryColumnOrder.forEach(key => { // ใช้ summaryColumnOrder ที่อัปเดตแล้ว
            const td = document.createElement('td');
            td.textContent = key;
            td.classList.add('summary-col');
            headerRow2.appendChild(td);
        });
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
                cell.classList.add('shift-cell');
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const currentShifts = schedule[dateStr]?.[nurse.id] || [];
                const displaySpan = document.createElement('span');
                displaySpan.classList.add('shift-cell-display');

                if (currentShifts.length > 0) {
                    displaySpan.textContent = currentShifts.join('/');
                } else {
                    displaySpan.textContent = 'OFF'; // << แสดง "OFF" ถ้าไม่มีเวร >>
                    displaySpan.classList.add('shift-cell-off'); 
                }
                cell.appendChild(displaySpan);
                
                cell.dataset.nurseId = nurse.id.toString();
                cell.dataset.date = dateStr;
                cell.dataset.nurseName = nurse.name; 
                cell.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return; 
                    openShiftModal(e.currentTarget.dataset.nurseId, e.currentTarget.dataset.date, e.currentTarget.dataset.nurseName, e.currentTarget);
                });
                
                const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
                if (holidays.includes(dateStr)) cell.classList.add('holiday');
                else if (dayOfWeek === 0 || dayOfWeek === 6) cell.classList.add('weekend');
                
                row.appendChild(cell);
            }
            
            summaryColumnOrder.forEach(key => { // ใช้ summaryColumnOrder ที่อัปเดตแล้ว
                const cell = document.createElement('td');
                cell.classList.add('summary-col');
                if (key === "รวมเวร") { cell.id = `nurse-${nurse.id}-total`; }
                else if (key === "รวมOT") { cell.id = `nurse-${nurse.id}-ot-total`; }
                else { cell.id = `nurse-${nurse.id}-type-${key}`; } // key จะรวม "OFF" ด้วย
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        scheduleTableContainer.appendChild(table);
        
        updateAllSummaries();
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

            const rawWorkShiftCounts = {}; // นับเฉพาะเวรทำงานและ OT ที่กำหนดใน shiftTypes (ช,บ,ด,ช1,บ1,ด1)
            Object.keys(shiftTypes).forEach(st => rawWorkShiftCounts[st] = 0);
            let derivedOffCountForDay = 0;

            nurses.forEach(nurse => {
                const nurseShifts = schedule[dateStr]?.[nurse.id];
                if (!nurseShifts || nurseShifts.length === 0) {
                    derivedOffCountForDay++;
                } else {
                    nurseShifts.forEach(shift => {
                        if (shiftTypes[shift]) { // ตรวจสอบจาก shiftTypes (ซึ่งไม่มี OFF)
                            rawWorkShiftCounts[shift]++;
                        }
                    });
                }
            });

            let displayHtml = "";
            dailySummaryDisplayConfig.forEach(config => { // dailySummaryDisplayConfig มี OFF
                if (config.key === "OFF") {
                    displayHtml += `<div>${config.label}: ${derivedOffCountForDay}</div>`;
                } else {
                    let combinedCount = rawWorkShiftCounts[config.key] || 0;
                    if (config.otKey && rawWorkShiftCounts[config.otKey]) {
                        combinedCount += rawWorkShiftCounts[config.otKey];
                    }
                    displayHtml += `<div>${config.label}: ${combinedCount}</div>`;
                }
            });
            dailySummaryCell.innerHTML = displayHtml;
        }
    }
    
    function updateMonthlyNurseSummaries() {
        if (!monthSelect || !yearSelect) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear); // Get days in month here

        nurses.forEach(nurse => {
            let totalWorkShifts = 0; 
            const typeCounts = {};
            summaryColumnOrder.forEach(key => typeCounts[key] = 0); // Initialize based on display order
            let totalOT = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const nurseShiftsForDay = schedule[dateKey]?.[nurse.id];

                if (!nurseShiftsForDay || nurseShiftsForDay.length === 0) {
                    if (typeCounts["OFF"] !== undefined) typeCounts["OFF"]++;
                } else {
                    nurseShiftsForDay.forEach(shift => {
                        // ตรวจสอบกับ shiftTypes เพื่อให้แน่ใจว่าเป็นเวรที่รู้จัก (ไม่นับถ้าเป็นค่าแปลกๆ)
                        if (shiftTypes[shift] || shift === "OFF") { // "OFF" ไม่ได้อยู่ใน shiftTypes แต่เราจะนับมันสำหรับ typeCounts
                            if (shift === "ช" || shift === "บ" || shift === "ด") {
                                totalWorkShifts++;
                            }
                            // นับทุกประเภทที่อยู่ใน summaryColumnOrder
                            if (typeCounts[shift] !== undefined) {
                                typeCounts[shift]++;
                            }
                            
                            if (shift === "ช1" || shift === "บ1" || shift === "ด1") {
                                totalOT++;
                            }
                        }
                    });
                }
            }

            const totalWorkShiftsCell = document.getElementById(`nurse-${nurse.id}-total`);
            if (totalWorkShiftsCell) totalWorkShiftsCell.textContent = totalWorkShifts.toString();
            
            const otCell = document.getElementById(`nurse-${nurse.id}-ot-total`);
            if (otCell) otCell.textContent = totalOT.toString();

            summaryColumnOrder.forEach(key => {
                if (key !== "รวมเวร" && key !== "รวมOT") {
                    const typeCell = document.getElementById(`nurse-${nurse.id}-type-${key}`);
                    if (typeCell) typeCell.textContent = (typeCounts[key] || 0).toString();
                }
            });
        });
    }
    
    // --- CSV EXPORT ---
    function downloadScheduleAsCsv() {
        if (!monthSelect || !yearSelect) return;
        const selectedMonth = parseInt(monthSelect.value, 10);
        const selectedYear = parseInt(yearSelect.value, 10);
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear); // Corrected call
        const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        let csvContent = "\uFEFF";

        const csvHeaders = ['ชื่อพยาบาล'];
        for (let day = 1; day <= daysInMonth; day++) csvHeaders.push(day.toString());
        summaryColumnOrder.forEach(colName => csvHeaders.push(colName));
        csvContent += csvHeaders.join(',') + '\r\n';

        nurses.forEach(nurse => {
            const nurseRow = [`"${nurse.name.replace(/"/g, '""')}"`];
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const currentShifts = schedule[dateStr]?.[nurse.id] || [];
                let cellData = "";
                if (currentShifts.length > 0) {
                    cellData = currentShifts.join('/');
                } else {
                    cellData = "OFF"; 
                }
                nurseRow.push(`"${cellData.replace(/"/g, '""')}"`);
            }

            let csvTotalWorkShifts = 0;
            const csvTypeCounts = {};
            summaryColumnOrder.forEach(key => csvTypeCounts[key] = 0);
            let csvTotalOT = 0;

            for (let d = 1; d <= daysInMonth; d++) { // Iterate all days
                const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const nurseShiftsForDay = schedule[dateKey]?.[nurse.id];
                if (!nurseShiftsForDay || nurseShiftsForDay.length === 0) {
                    if (csvTypeCounts["OFF"] !== undefined) csvTypeCounts["OFF"]++;
                } else {
                    nurseShiftsForDay.forEach(shift => {
                        // Check against keys in shiftTypes (ช,บ,ด,ช1,บ1,ด1) for work/OT counts
                        // And allow "OFF" to be counted if it somehow got stored (though it shouldn't be selected)
                        if (shiftTypes[shift] || shift === "OFF") { 
                            if (shift === "ช" || shift === "บ" || shift === "ด") {
                                csvTotalWorkShifts++;
                            }
                            if (csvTypeCounts[shift] !== undefined) { // Count defined types
                                csvTypeCounts[shift]++;
                            }
                            if (shift === "ช1" || shift === "บ1" || shift === "ด1") {
                                csvTotalOT++;
                            }
                        }
                    });
                }
            }
            
            summaryColumnOrder.forEach(key => {
                if (key === "รวมเวร") { nurseRow.push(csvTotalWorkShifts); }
                else if (key === "รวมOT") { nurseRow.push(csvTotalOT); }
                else { nurseRow.push(csvTypeCounts[key] || 0); }
            });
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
        if (generateScheduleBtn) generateScheduleBtn.addEventListener('click', renderScheduleTable);
        if (departmentOTLimitInput) {
            departmentOTLimitInput.addEventListener('change', (e) => {
                localStorage.setItem('departmentOTLimit', e.target.value); checkOTLimit(); 
            });
        }
        if (addHolidayBtn) addHolidayBtn.addEventListener('click', addHolidayFromInput);
        if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadScheduleAsCsv);
        if(closeModalBtn) closeModalBtn.addEventListener('click', closeShiftModal);
        if(modalCancelBtn) modalCancelBtn.addEventListener('click', closeShiftModal);
        if(modalOkBtn) modalOkBtn.addEventListener('click', handleModalOk);
        if(shiftModal) {
            shiftModal.addEventListener('click', (event) => {
                if (event.target === shiftModal) { closeShiftModal(); }
            });
        }
        
        populateMonthYearSelectors();
        loadDataFromLocalStorage();
        renderCustomHolidaysList();
        renderScheduleTable();
        initializeCollapsibleControls();
    }

    init();
});
