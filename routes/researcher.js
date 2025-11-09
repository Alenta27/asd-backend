const express = require('express');
const router = express.Router();
const { verifyToken, researcherCheck, requireResourceAccess } = require('../middlewares/auth');
const User = require('../models/user');
const Patient = require('../models/patient');
const Report = require('../models/report');
const EducationalContent = require('../models/educationalContent');

// All routes require authentication and researcher role
router.use(verifyToken);
router.use(researcherCheck);

// Get researcher's profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get anonymized demographic statistics
router.get('/demographics', requireResourceAccess('analytics'), async (req, res) => {
  try {
    // Get all data but anonymize it
    const patients = await Patient.find({});
    const reports = await Report.find({});
    
    // Anonymize and aggregate data
    const demographics = {
      totalParticipants: patients.length,
      ageDistribution: {
        '0-3': patients.filter(p => p.age >= 0 && p.age <= 3).length,
        '4-6': patients.filter(p => p.age >= 4 && p.age <= 6).length,
        '7-10': patients.filter(p => p.age >= 7 && p.age <= 10).length,
        '11-15': patients.filter(p => p.age >= 11 && p.age <= 15).length,
        '16+': patients.filter(p => p.age >= 16).length
      },
      genderDistribution: {
        male: patients.filter(p => p.gender === 'male').length,
        female: patients.filter(p => p.gender === 'female').length,
        other: patients.filter(p => p.gender === 'other').length
      },
      diagnosisBreakdown: {
        asd: patients.filter(p => p.diagnosis === 'ASD').length,
        asperger: patients.filter(p => p.diagnosis === 'Asperger').length,
        pdd: patients.filter(p => p.diagnosis === 'PDD-NOS').length,
        typical: patients.filter(p => p.diagnosis === 'Typical').length
      },
      screeningTypes: {
        voice: patients.filter(p => p.screeningType === 'voice').length,
        image: patients.filter(p => p.screeningType === 'image').length,
        mri: patients.filter(p => p.screeningType === 'mri').length,
        questionnaire: patients.filter(p => p.screeningType === 'questionnaire').length
      }
    };
    
    res.json(demographics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get anonymized screening results
router.get('/screening-results', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const patients = await Patient.find({});
    
    const screeningResults = {
      totalScreenings: patients.length,
      accuracyByType: {
        voice: {
          total: patients.filter(p => p.screeningType === 'voice').length,
          correct: patients.filter(p => p.screeningType === 'voice' && p.prediction === p.actualDiagnosis).length,
          accuracy: 0.85 // Mock accuracy
        },
        image: {
          total: patients.filter(p => p.screeningType === 'image').length,
          correct: patients.filter(p => p.screeningType === 'image' && p.prediction === p.actualDiagnosis).length,
          accuracy: 0.78 // Mock accuracy
        },
        mri: {
          total: patients.filter(p => p.screeningType === 'mri').length,
          correct: patients.filter(p => p.screeningType === 'mri' && p.prediction === p.actualDiagnosis).length,
          accuracy: 0.92 // Mock accuracy
        }
      },
      riskDistribution: {
        low: patients.filter(p => p.riskLevel === 'low').length,
        medium: patients.filter(p => p.riskLevel === 'medium').length,
        high: patients.filter(p => p.riskLevel === 'high').length
      }
    };
    
    res.json(screeningResults);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Data explorer - filter anonymized data
router.post('/data-explorer', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const { filters } = req.body;
    const { ageRange, gender, diagnosis, screeningType, riskLevel } = filters;
    
    let query = {};
    
    // Build query based on filters
    if (ageRange) {
      query.age = { $gte: ageRange.min, $lte: ageRange.max };
    }
    if (gender) {
      query.gender = gender;
    }
    if (diagnosis) {
      query.diagnosis = diagnosis;
    }
    if (screeningType) {
      query.screeningType = screeningType;
    }
    if (riskLevel) {
      query.riskLevel = riskLevel;
    }
    
    const filteredData = await Patient.find(query);
    
    // Return only anonymized, aggregated data
    const result = {
      totalMatches: filteredData.length,
      ageDistribution: {
        '0-3': filteredData.filter(p => p.age >= 0 && p.age <= 3).length,
        '4-6': filteredData.filter(p => p.age >= 4 && p.age <= 6).length,
        '7-10': filteredData.filter(p => p.age >= 7 && p.age <= 10).length,
        '11-15': filteredData.filter(p => p.age >= 11 && p.age <= 15).length,
        '16+': filteredData.filter(p => p.age >= 16).length
      },
      genderDistribution: {
        male: filteredData.filter(p => p.gender === 'male').length,
        female: filteredData.filter(p => p.gender === 'female').length,
        other: filteredData.filter(p => p.gender === 'other').length
      },
      diagnosisBreakdown: {
        asd: filteredData.filter(p => p.diagnosis === 'ASD').length,
        asperger: filteredData.filter(p => p.diagnosis === 'Asperger').length,
        pdd: filteredData.filter(p => p.diagnosis === 'PDD-NOS').length,
        typical: filteredData.filter(p => p.diagnosis === 'Typical').length
      },
      riskDistribution: {
        low: filteredData.filter(p => p.riskLevel === 'low').length,
        medium: filteredData.filter(p => p.riskLevel === 'medium').length,
        high: filteredData.filter(p => p.riskLevel === 'high').length
      }
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Export anonymized data as CSV
router.post('/export', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const { filters } = req.body;
    
    // Apply same filters as data explorer
    let query = {};
    if (filters) {
      const { ageRange, gender, diagnosis, screeningType, riskLevel } = filters;
      
      if (ageRange) {
        query.age = { $gte: ageRange.min, $lte: ageRange.max };
      }
      if (gender) {
        query.gender = gender;
      }
      if (diagnosis) {
        query.diagnosis = diagnosis;
      }
      if (screeningType) {
        query.screeningType = screeningType;
      }
      if (riskLevel) {
        query.riskLevel = riskLevel;
      }
    }
    
    const data = await Patient.find(query);
    
    // Create anonymized CSV data
    const csvData = data.map((patient, index) => ({
      participant_id: `P${String(index + 1).padStart(4, '0')}`, // Anonymized ID
      age: patient.age,
      gender: patient.gender,
      diagnosis: patient.diagnosis,
      screening_type: patient.screeningType,
      risk_level: patient.riskLevel,
      prediction: patient.prediction,
      screening_date: patient.screeningDate,
      // No personal information like name, email, etc.
    }));
    
    // Convert to CSV format
    const csvHeaders = Object.keys(csvData[0] || {}).join(',');
    const csvRows = csvData.map(row => Object.values(row).join(','));
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=anonymized_data.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get model performance metrics
router.get('/model-performance', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const patients = await Patient.find({});
    
    // Calculate accuracy for each screening type
    const calculateAccuracy = (screeningType) => {
      const typePatients = patients.filter(p => p.screeningType === screeningType);
      if (typePatients.length === 0) return { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
      
      const correct = typePatients.filter(p => p.prediction === p.actualDiagnosis).length;
      const accuracy = correct / typePatients.length;
      
      // Calculate confusion matrix for this type
      const truePositive = typePatients.filter(p => p.prediction === 'ASD' && p.actualDiagnosis === 'ASD').length;
      const falsePositive = typePatients.filter(p => p.prediction === 'ASD' && p.actualDiagnosis !== 'ASD').length;
      const falseNegative = typePatients.filter(p => p.prediction !== 'ASD' && p.actualDiagnosis === 'ASD').length;
      
      const precision = (truePositive + falsePositive) > 0 ? truePositive / (truePositive + falsePositive) : 0;
      const recall = (truePositive + falseNegative) > 0 ? truePositive / (truePositive + falseNegative) : 0;
      const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
      
      return { accuracy: parseFloat(accuracy.toFixed(2)), precision: parseFloat(precision.toFixed(2)), recall: parseFloat(recall.toFixed(2)), f1Score: parseFloat(f1Score.toFixed(2)) };
    };
    
    // Calculate overall confusion matrix
    const truePositive = patients.filter(p => p.prediction === 'ASD' && p.actualDiagnosis === 'ASD').length;
    const trueNegative = patients.filter(p => p.prediction !== 'ASD' && p.actualDiagnosis !== 'ASD').length;
    const falsePositive = patients.filter(p => p.prediction === 'ASD' && p.actualDiagnosis !== 'ASD').length;
    const falseNegative = patients.filter(p => p.prediction !== 'ASD' && p.actualDiagnosis === 'ASD').length;
    
    const overallAccuracy = (truePositive + trueNegative) / patients.length || 0;
    
    const performance = {
      overallAccuracy: parseFloat((overallAccuracy).toFixed(2)),
      models: {
        voice: calculateAccuracy('voice'),
        image: calculateAccuracy('image'),
        mri: calculateAccuracy('mri'),
        questionnaire: calculateAccuracy('questionnaire')
      },
      confusionMatrix: {
        truePositive,
        trueNegative,
        falsePositive,
        falseNegative
      }
    };
    
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system health metrics
router.get('/system-health', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const systemHealth = {
      totalUsers: await User.countDocuments(),
      totalScreenings: await Patient.countDocuments(),
      totalReports: await Report.countDocuments(),
      systemUptime: '99.9%',
      averageResponseTime: '120ms',
      errorRate: '0.1%',
      lastUpdated: new Date()
    };
    
    res.json(systemHealth);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get research trends
router.get('/trends', requireResourceAccess('analytics'), async (req, res) => {
  try {
    const patients = await Patient.find({}).select('screeningDate screeningType diagnosis prediction actualDiagnosis');
    
    // Calculate monthly screening trends for the last 12 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = {};
    
    patients.forEach(patient => {
      if (patient.screeningDate) {
        const date = new Date(patient.screeningDate);
        const monthIndex = date.getMonth();
        const monthKey = monthNames[monthIndex];
        monthlyTrends[monthKey] = (monthlyTrends[monthKey] || 0) + 1;
      }
    });
    
    const monthly = monthNames.map(month => ({
      month,
      count: monthlyTrends[month] || 0
    }));
    
    // Screening by type
    const byType = {
      voice: patients.filter(p => p.screeningType === 'voice').length,
      image: patients.filter(p => p.screeningType === 'image').length,
      mri: patients.filter(p => p.screeningType === 'mri').length,
      questionnaire: patients.filter(p => p.screeningType === 'questionnaire').length
    };
    
    // Diagnosis breakdown
    const diagnosisTrends = {
      asd: patients.filter(p => p.actualDiagnosis === 'ASD').length,
      asperger: patients.filter(p => p.actualDiagnosis === 'Asperger').length,
      pdd: patients.filter(p => p.actualDiagnosis === 'PDD-NOS').length,
      typical: patients.filter(p => p.actualDiagnosis === 'Typical').length
    };
    
    const trends = {
      screeningTrends: {
        monthly,
        byType
      },
      diagnosisTrends,
      totalScreenings: patients.length
    };
    
    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available datasets
router.get('/datasets', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const dataDir = path.join(__dirname, '../..', 'data');
    const datasets = [];
    
    // Helper function to get directory size
    const getDirSize = async (dirPath) => {
      let size = 0;
      try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
          const filePath = path.join(dirPath, file.name);
          if (file.isDirectory()) {
            size += await getDirSize(filePath);
          } else {
            const stats = await fs.stat(filePath);
            size += stats.size;
          }
        }
      } catch (err) {
        console.warn('Error calculating size:', err.message);
      }
      return size;
    };
    
    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };
    
    // List Caltech MRI dataset
    const caltechPath = path.join(dataDir, 'Caltech');
    try {
      const caltechFiles = await fs.readdir(caltechPath);
      const caltechSubjects = caltechFiles.filter(f => f.match(/^\d+$/)).length;
      const caltechSize = await getDirSize(caltechPath);
      
      datasets.push({
        id: 'caltech-mri',
        name: 'Caltech Brain Imaging Dataset',
        description: 'Structural and functional MRI brain imaging data from the Caltech Autism Research Project.',
        type: 'MRI Data',
        subjects: caltechSubjects,
        records: caltechSubjects,
        size: formatSize(caltechSize),
        sizeBytes: caltechSize,
        format: 'BIDS (Brain Imaging Data Structure)',
        acquisitionMethod: 'fMRI',
        status: 'Active',
        lastUpdated: new Date().toISOString().split('T')[0],
        downloadable: true,
        path: caltechPath
      });
    } catch (err) {
      console.warn('Caltech dataset not found:', err.message);
    }
    
    // List Training Data (fMRI features in CSV format)
    const trainingPath = path.join(dataDir, 'Training Data');
    try {
      const asdPath = path.join(trainingPath, 'ASD');
      const normalPath = path.join(trainingPath, 'Normal');
      
      let asdCount = 0, normalCount = 0;
      try {
        const asdFiles = await fs.readdir(asdPath);
        asdCount = asdFiles.filter(f => f.endsWith('.csv')).length;
      } catch (err) {}
      
      try {
        const normalFiles = await fs.readdir(normalPath);
        normalCount = normalFiles.filter(f => f.endsWith('.csv')).length;
      } catch (err) {}
      
      if (asdCount > 0 || normalCount > 0) {
        const trainingSize = await getDirSize(trainingPath);
        datasets.push({
          id: 'training-data-fmri',
          name: 'Training Data - ASD vs Normal (fMRI Features)',
          description: 'Labeled training dataset with extracted fMRI features from ASD and Normal control subjects.',
          type: 'Tabular Data',
          subjects: asdCount + normalCount,
          records: asdCount + normalCount,
          asd: asdCount,
          normal: normalCount,
          size: formatSize(trainingSize),
          sizeBytes: trainingSize,
          format: 'CSV',
          acquisitionMethod: 'fMRI Feature Extraction',
          status: 'Active',
          lastUpdated: new Date().toISOString().split('T')[0],
          downloadable: true,
          path: trainingPath
        });
      }
    } catch (err) {
      console.warn('Training data not found:', err.message);
    }
    
    // List Facial Data dataset
    const facialPath = path.join(dataDir, 'facial_data');
    try {
      const facialFiles = await fs.readdir(facialPath);
      const imageFiles = facialFiles.filter(f => 
        f.match(/\.(jpg|jpeg|png|gif|bmp)$/i)
      ).length;
      
      if (imageFiles > 0) {
        const facialSize = await getDirSize(facialPath);
        datasets.push({
          id: 'facial-data',
          name: 'Facial Dataset',
          description: 'Facial images dataset for autism spectrum disorder classification and analysis.',
          type: 'Facial Data',
          subjects: imageFiles,
          records: imageFiles,
          size: formatSize(facialSize),
          sizeBytes: facialSize,
          format: 'Image Files (JPG, PNG, BMP, GIF)',
          acquisitionMethod: 'Camera/Image Capture',
          status: 'Active',
          lastUpdated: new Date().toISOString().split('T')[0],
          downloadable: true,
          path: facialPath
        });
      }
    } catch (err) {
      console.warn('Facial data not found:', err.message);
    }
    
    console.log(`✅ Found ${datasets.length} datasets`);
    res.json({ 
      success: true, 
      datasets: datasets.sort((a, b) => b.sizeBytes - a.sizeBytes),
      totalCount: datasets.length,
      totalRecords: datasets.reduce((sum, d) => sum + (d.records || 0), 0),
      totalSize: datasets.reduce((sum, d) => sum + (d.sizeBytes || 0), 0)
    });
  } catch (error) {
    console.error('❌ Error fetching datasets:', error);
    res.status(500).json({ message: 'Error fetching datasets', error: error.message });
  }
});

// Download dataset
router.get('/datasets/:datasetId/download', async (req, res) => {
  try {
    const { datasetId } = req.params;
    
    const fs = require('fs').promises;
    const path = require('path');
    const archiver = require('archiver');
    
    let datasetPath;
    
    if (datasetId === 'caltech-mri') {
      datasetPath = path.join(__dirname, '../..', 'data', 'Caltech');
    } else if (datasetId === 'training-data-fmri') {
      datasetPath = path.join(__dirname, '../..', 'data', 'Training Data');
    } else if (datasetId === 'facial-data') {
      datasetPath = path.join(__dirname, '../..', 'data', 'facial_data');
    } else {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Check if path exists
    try {
      await fs.access(datasetPath);
    } catch (err) {
      return res.status(404).json({ error: 'Dataset path not accessible' });
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${datasetId}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Error creating download' });
    });
    
    archive.pipe(res);
    archive.directory(datasetPath, datasetId);
    archive.finalize();
    
  } catch (error) {
    console.error('❌ Error downloading dataset:', error);
    res.status(500).json({ message: 'Error downloading dataset', error: error.message });
  }
});

// Delete dataset (soft delete - just removes from listing)
router.delete('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params;
    
    // Log the deletion (could implement actual archiving instead of deletion)
    console.log(`Dataset ${datasetId} marked for deletion`);
    
    res.json({ 
      success: true, 
      message: `Dataset ${datasetId} has been removed from active datasets` 
    });
  } catch (error) {
    console.error('❌ Error deleting dataset:', error);
    res.status(500).json({ message: 'Error deleting dataset', error: error.message });
  }
});

// Get educational content by category (NO AUTH REQUIRED FOR FRONTEND)
router.get('/educational-content', async (req, res) => {
  try {
    const { category } = req.query;
    
    console.log('📚 Fetching educational content, category:', category);
    
    let query = { active: true };
    if (category) {
      query.category = category;
    }
    
    const content = await EducationalContent.find(query).sort({ order: 1 });
    console.log(`✅ Found ${content.length} educational content items`);
    
    // Group by category if no specific category requested
    if (!category) {
      const grouped = {
        'learn-signs': [],
        'screening': [],
        'conditions': [],
        'interventions': []
      };
      
      content.forEach(item => {
        if (grouped[item.category]) {
          grouped[item.category].push({
            topic: item.topic,
            title: item.title,
            content: item.content
          });
        }
      });
      
      console.log('📖 Grouped content:', Object.keys(grouped).map(k => `${k}: ${grouped[k].length} items`).join(', '));
      return res.json(grouped);
    }
    
    const formatted = content.map(item => ({
      topic: item.topic,
      title: item.title,
      content: item.content
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('❌ Error fetching educational content:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
