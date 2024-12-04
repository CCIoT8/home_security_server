const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const RPI_URL = "http://192.168.20.235:3000";


const app = express();
const router = express.Router();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory system state
let systemState = {
    armed: false,
    alarmTriggered: false,
};

// File paths for data storage
const SENSOR_DATA_FILE = path.join(__dirname, 'sensorData.json');
const IMAGE_DATA_FILE = path.join(__dirname, 'imageData.json');

// Ensure data files exist
const ensureFileExists = (file) => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([]));
    }
};
ensureFileExists(SENSOR_DATA_FILE);
ensureFileExists(IMAGE_DATA_FILE);

// Utility functions to read and write JSON data
const readJsonFile = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJsonFile = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// --- API Endpoints ---

// Batch Update Endpoint (for sending multiple sensor data and images)
router.post('/api/batch-update', (req, res) => {
    const { sensors, images } = req.body;

    if (!sensors || !images) {
        return res.status(400).json({ error: 'Missing required fields: sensors, images' });
    }

    // Process sensor data (add all the sensors at once)
    const sensorData = readJsonFile(SENSOR_DATA_FILE);
    sensors.forEach((sensor) => {
        const { sensorType, value, timestamp } = sensor;
        if (sensorType && value && timestamp) {
            sensorData.push({ sensorType, value, timestamp });
        }
    });
    writeJsonFile(SENSOR_DATA_FILE, sensorData);

    // Process image data (add all the images at once)
    const imageData = readJsonFile(IMAGE_DATA_FILE);
    images.forEach((imageEntry) => {
        const { image, timestamp } = imageEntry;
        if (image && timestamp) {
            imageData.push({ image, timestamp });
        }
    });
    writeJsonFile(IMAGE_DATA_FILE, imageData);

    res.status(200).json({ message: 'Batch update received successfully' });
});

// Check System State
router.get('/api/state', (req, res) => {
    res.status(200).json({
        message: 'System state retrieved successfully',
        state: systemState,
    });
});

// Arm the system
router.get('/api/arm', async (req, res) => {
    if (systemState.armed) {
        return res.status(200).json({ message: 'System is already armed', state: systemState });
    }

    try {
        // Notify Raspberry Pi
        await axios.get(`${RPI_URL}/api/arm`);
        systemState.armed = true;
        res.status(200).json({ message: 'System armed successfully', state: systemState });
        console.log('System armed');
    } catch (error) {
        console.error('Failed to notify Raspberry Pi for arming:', error.message);
        res.status(500).json({ error: 'Failed to update Raspberry Pi state' });
    }
});

// Disarm the system
router.get('/api/disarm', async (req, res) => {
    
    if (!systemState.armed) {
        console.log('Disarming system');
        return res.status(200).json({ message: 'System is already disarmed', state: systemState });
    }
    
    try {
        // Notify Raspberry Pi
        await axios.get(`${RPI_URL}/api/disarm`);
        systemState.armed = false;
        systemState.alarmTriggered = false; // Reset alarm when disarming
        res.status(200).json({ message: 'System disarmed successfully', state: systemState });
        console.log('System disarmed');
    } catch (error) {
        console.error('Failed to notify Raspberry Pi for disarming:', error.message);
        res.status(500).json({ error: 'Failed to update Raspberry Pi state' });
    }
});

// Stop the alarm
router.post('/api/stop-alarm', (req, res) => {
    if (!systemState.alarmTriggered) {
        return res.status(200).json({
            message: 'Alarm is not triggered, nothing to stop',
            state: systemState,
        });
    }

    axios.get(`${RPI_URL}/api/stop`);

    systemState.alarmTriggered = false; // Reset the alarm state
    res.status(200).json({
        message: 'Alarm stopped successfully',
        state: systemState,
    });
    console.log('Alarm stopped');
});




// Trigger an alarm
router.get('/api/trigger', (req, res) => {
    console.log('Triggering alarm');
    if (systemState.armed) {
        systemState.alarmTriggered = true;
        return res.status(200).json({ message: 'Alarm triggered', state: systemState });
    } else {
        return res.status(403).json({ message: 'System not armed. Cannot trigger alarm.', state: systemState });
    }
});

// Receive sensor data
router.post('/api/sensor-data', (req, res) => {
    const { sensorType, value, timestamp } = req.body;

    if (!sensorType || !value || !timestamp) {
        return res.status(400).json({ error: 'Missing required fields: sensorType, value, timestamp' });
    }

    const sensorData = readJsonFile(SENSOR_DATA_FILE);
    sensorData.push({ sensorType, value, timestamp });
    writeJsonFile(SENSOR_DATA_FILE, sensorData);

    res.status(200).json({ message: 'Sensor data received successfully' });
});

// Retrieve the Latest Image
router.get('/api/latest-image', (req, res) => {
    const imageData = readJsonFile(IMAGE_DATA_FILE);

    // If no images exist
    if (!imageData.length) {
        return res.status(404).json({ error: 'No image data available' });
    }

    // Get the latest image (assumes `timestamp` is valid ISO 8601 format)
    const latestImage = imageData.reduce((latest, current) => {
        return new Date(latest.timestamp) > new Date(current.timestamp) ? latest : current;
    });

    res.status(200).json({
        image: latestImage.image,
        timestamp: latestImage.timestamp,
    });
});

// // Stop the alarm
// router.post('/api/stop-alarm', (req, res) => {
//     if (!systemState.alarmTriggered) {
//         return res.status(400).json({ error: 'Alarm is not triggered' });
//     }

//     systemState.alarmTriggered = false; // Reset alarm state
//     res.status(200).json({
//         message: 'Alarm stopped successfully',
//         state: {
//             armed: systemState.armed,
//             alarmTriggered: systemState.alarmTriggered,
//         },
//     });
// });

// View image data (optional, for debugging)
router.get('/api/image-data', (req, res) => {
    const imageData = readJsonFile(IMAGE_DATA_FILE);
    res.status(200).json(imageData);
});

// Attach router and start the server
app.use(router);
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
