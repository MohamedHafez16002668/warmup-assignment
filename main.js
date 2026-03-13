const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {

    function toSeconds(timeStr) {
        let [time, period] = timeStr.split(" ");
        let [h, m, s] = time.split(":").map(Number);

        if (period.toLowerCase() === "pm" && h !== 12) h += 12;
        if (period.toLowerCase() === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let startSec = toSeconds(startTime);
    let endSec = toSeconds(endTime);

    if (endSec < startSec) {
        endSec += 24 * 3600;   // handle overnight shifts
    }

    let diff = endSec - startSec;

    let hours = Math.floor(diff / 3600);
    diff %= 3600;

    let minutes = Math.floor(diff / 60);
    let seconds = diff % 60;

    return `${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {

    function toSeconds(timeStr) {
        timeStr = timeStr.trim();

        let [time, period] = timeStr.split(" ");
        let [h, m, s] = time.split(":").map(Number);

        if (period.toLowerCase() === "pm" && h !== 12) h += 12;
        if (period.toLowerCase() === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    let workStart = 8 * 3600;
    let workEnd = 22 * 3600;

    let shiftDuration = end - start;

    let startInside = Math.max(start, workStart);
    let endInside = Math.min(end, workEnd);

    let workDuration = Math.max(0, endInside - startInside);

    let idle = shiftDuration - workDuration;

    let hours = Math.floor(idle / 3600);
    let minutes = Math.floor((idle % 3600) / 60);
    let seconds = idle % 60;

    return hours + ":" +
           String(minutes).padStart(2,"0") + ":" +
           String(seconds).padStart(2,"0");
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    function toSeconds(timeStr) {
        let parts = timeStr.split(":");
        let h = parseInt(parts[0]);
        let m = parseInt(parts[1]);
        let s = parseInt(parts[2]);

        return h * 3600 + m * 60 + s;
    }

    let shiftSeconds = toSeconds(shiftDuration);
    let idleSeconds = toSeconds(idleTime);

    let activeSeconds = shiftSeconds - idleSeconds;

    let hours = Math.floor(activeSeconds / 3600);
    let minutes = Math.floor((activeSeconds % 3600) / 60);
    let seconds = activeSeconds % 60;

    return hours + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");
} 

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    function toSeconds(timeStr) {
        let [h, m, s] = timeStr.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }

    let activeSeconds = toSeconds(activeTime);

    let quotaSeconds;

    if (date >= "2025-04-10" && date <= "2025-04-30") {
        quotaSeconds = 6 * 3600; // 6:00:00
    } else {
        quotaSeconds = 8 * 3600 + 24 * 60; // 8:24:00
    }

    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let data = fs.readFileSync(textFile, "utf8").trim();

    let lines = data.split("\n");

    // Check if record already exists
    for (let line of lines) {

    let parts = line.split(",");

    // skip empty or broken lines
    if (parts.length < 3) continue;

    let driverID = parts[0].trim();
    let date = parts[2].trim();

        if (driverID === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    // Calculate required fields
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let met = metQuota(shiftObj.date, activeTime);

    // Build new line for file
    let newLine =
        shiftObj.driverID + "," +
        shiftObj.driverName + "," +
        shiftObj.date + "," +
        shiftObj.startTime + "," +
        shiftObj.endTime + "," +
        shiftDuration + "," +
        idleTime + "," +
        activeTime + "," +
        met + "," +
        false;

    // Append to file
    fs.appendFileSync(textFile, "\n" + newLine);

    // Return object with 10 properties
    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: met,
        hasBonus: false
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {

    let data = fs.readFileSync(textFile, "utf8");

    let lines = data.trim().split("\n");

    let newLines = [];

    for (let line of lines) {

        let parts = line.split(",");

        if (parts[0] === driverID && parts[2] === date) {

            parts[9] = String(newValue);   // FIXED COLUMN

            line = parts.join(",");
        }

        newLines.push(line);
    }

    fs.writeFileSync(textFile, newLines.join("\n"));
}
// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let count = 0;
    let driverFound = false;
    let targetMonth = parseInt(month);

    for (let i = 1; i < lines.length; i++) {

        let line = lines[i].trim();
        if (line === "") continue;

        let parts = line.split(",");
        if (parts.length < 10) continue;

        let id = parts[0].trim();
        let date = parts[2].trim();
        let bonus = parts[9].trim();

        let fileMonth = parseInt(date.split("-")[1]);

        if (id === driverID) {
            driverFound = true;

            if (fileMonth === targetMonth && bonus === "true") {
                count++;
            }
        }
    }

    if (!driverFound) return -1;

    return count;
}
// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

let data = fs.readFileSync(textFile, "utf8");
let lines = data.trim().split("\n");

let totalSeconds = 0;

for (let i = 1; i < lines.length; i++) {   // skip header

    let line = lines[i].trim();
    if (line === "") continue;

    let parts = line.split(",");

    if (parts.length < 10) continue; // ensure valid row

    let id = parts[0].trim();
    let date = parts[2].trim();
    let activeTime = parts[7].trim();

    let fileMonth = parseInt(date.split("-")[1]);

    if (id === driverID && fileMonth === parseInt(month)) {

        let t = activeTime.split(":");

        let seconds =
            parseInt(t[0]) * 3600 +
            parseInt(t[1]) * 60 +
            parseInt(t[2]);

        totalSeconds += seconds;
    }
}

let hours = Math.floor(totalSeconds / 3600);
let minutes = Math.floor((totalSeconds % 3600) / 60);
let seconds = totalSeconds % 60;

return String(hours).padStart(3, "0") + ":" +
       String(minutes).padStart(2, "0") + ":" +
       String(seconds).padStart(2, "0");

}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

// find driver's day off
let rateData = fs.readFileSync(rateFile, "utf8").trim().split("\n");
let dayOff = "";

for (let line of rateData) {
    let p = line.split(",");
    if (p[0].trim() === driverID) {
        dayOff = p[1].trim();
        break;
    }
}

if (dayOff === "") return "000:00:00";

let shiftData = fs.readFileSync(textFile, "utf8").trim().split("\n");

let totalSeconds = 0;

for (let i = 1; i < shiftData.length; i++) {

    let line = shiftData[i].trim();
    if (line === "") continue;

    let parts = line.split(",");

    if (parts.length < 10) continue;

    let id = parts[0].trim();
    let date = parts[2].trim();

    let d = new Date(date);
    let fileMonth = d.getMonth() + 1;

    if (id !== driverID || fileMonth !== month) continue;

    let dayName = d.toLocaleDateString("en-US", { weekday: "long" });

    if (dayName === dayOff) continue;

    let quotaSeconds;

    // Eid period: Apr 10–30 2025
    if (date >= "2025-04-10" && date <= "2025-04-30") {
        quotaSeconds = 6 * 3600;
    } else {
        quotaSeconds = (8 * 3600) + (24 * 60);
    }

    totalSeconds += quotaSeconds;
}

// subtract bonus deduction
totalSeconds -= bonusCount * 2 * 3600;

if (totalSeconds < 0) totalSeconds = 0;

let hours = Math.floor(totalSeconds / 3600);
let minutes = Math.floor((totalSeconds % 3600) / 60);
let seconds = totalSeconds % 60;

return String(hours).padStart(3, "0") + ":" +
       String(minutes).padStart(2, "0") + ":" +
       String(seconds).padStart(2, "0");

}
// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    function toSeconds(t){
        let p = t.split(":");
        return parseInt(p[0])*3600 + parseInt(p[1])*60 + parseInt(p[2]);
    }

    let actual = toSeconds(actualHours);
    let required = toSeconds(requiredHours);

    let data = fs.readFileSync(rateFile,"utf8");
    let lines = data.trim().split("\n");

    let basePay = 0;
    let allowance = 0;

    for(let line of lines){

        let parts = line.split(",");

        if(parts[0].trim() === driverID){
            basePay = parseInt(parts[2]);
            allowance = parseInt(parts[3]);
            break;
        }
    }

    // If driver worked enough
    if(actual >= required){
        return basePay;
    }

    let missingSeconds = required - actual;

    // remove allowance
    let allowanceSeconds = allowance * 3600;
    missingSeconds = Math.max(0, missingSeconds - allowanceSeconds);

    // only full hours count
    let missingHours = Math.floor(missingSeconds / 3600);

    let deductionRatePerHour = Math.floor(basePay / 185);

    let deduction = missingHours * deductionRatePerHour;

    return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
