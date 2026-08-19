const fs = require('fs');
const path = require('path');

let collegeMap = null;

function loadCollegeMap() {
  if (collegeMap) return collegeMap;

  collegeMap = new Map();
  const filePath = path.join(__dirname, '..', '..', 'data', 'colleges_aktu.json');

  try {
    const colleges = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Sort to prioritize official AK codes
    colleges.sort((a, b) => {
      const aIsAK = (a.CGCode || '').toUpperCase().startsWith('AK') ? 1 : 0;
      const bIsAK = (b.CGCode || '').toUpperCase().startsWith('AK') ? 1 : 0;
      return bIsAK - aIsAK;
    });

    colleges.forEach(c => {
      if (c.CGCode) {
        const num = parseInt(c.CGCode.replace(/\D/g, ''), 10);
        if (!isNaN(num) && !collegeMap.has(num)) {
          collegeMap.set(num, {
            collegeId: String(c.CGId),
            collegeName: c.CGName,
            collegeCode: c.CGCode,
            pincode: c.CGPincode,
            address: c.CGAddress
          });
        }
      }
    });
  } catch (err) {
    console.error('Error loading colleges_aktu.json:', err);
  }

  return collegeMap;
}

function resolveCollegeByRollNo(rollNo) {
  if (!rollNo) return null;
  const clean = String(rollNo).trim().replace(/\D/g, '');

  if (clean.length < 6) return null;

  // Digits 3-6 (index 2 to 6) represent the college code
  const codeStr = clean.substring(2, 6);
  const collegeNum = parseInt(codeStr, 10);

  if (isNaN(collegeNum)) return null;

  const map = loadCollegeMap();
  const college = map.get(collegeNum);

  if (!college) {
    return null;
  }

  return {
    ...college,
    extractedCode: codeStr,
    numericCode: collegeNum,
    admissionYear: clean.substring(0, 2)
  };
}

module.exports = {
  loadCollegeMap,
  resolveCollegeByRollNo
};
