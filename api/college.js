const { resolveCollegeByRollNo } = require('./lib/collegeResolver');

module.exports = (req, res) => {
  const rollNo = req.query.rollNo || req.body?.rollNo;
  
  if (!rollNo || String(rollNo).trim().length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'A valid roll number with at least 6 digits is required.' 
    });
  }

  const college = resolveCollegeByRollNo(rollNo);
  
  if (!college) {
    return res.json({ 
      success: false, 
      message: 'College not found for this roll number.' 
    });
  }

  return res.json({
    success: true,
    college: {
      id: college.collegeId,
      name: college.collegeName,
      code: college.collegeCode,
      pincode: college.pincode,
      address: college.address,
      extractedCode: college.extractedCode,
      admissionYear: college.admissionYear
    }
  });
};
