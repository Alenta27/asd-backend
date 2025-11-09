const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const imagePath = req.file.path;
    const pythonProcess = spawn('python', ['ai_model/predict.py', imagePath]);

    let predictionData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        predictionData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
        // We still capture warnings, but we won't treat them as a crash unless the script fails.
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        // THE FIX: We now check the exit code. 0 means success.
        // Any other code means a real error happened in the Python script.
        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            console.error(`Error details: ${errorData}`);
            return res.status(500).json({ error: 'Prediction script failed.' });
        }
        
        try {
            // Now we only try to parse if the script was successful
            const predictionResult = JSON.parse(predictionData);
            res.json(predictionResult);
        } catch (e) {
            console.log("Raw output from Python that failed to parse:", predictionData);
            res.status(500).json({ error: 'Failed to parse prediction result from Python.' });
        }
    });
});

module.exports = router;
