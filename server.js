const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

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
router.get('/state', (req, res) => {
    res.status(200).json({
      message: 'System state retrieved successfully',
      state: systemState,
    });
  });  

// Arm the system
router.post('/arm', (req, res) => {
  if (systemState.armed) {
    return res.status(200).json({ message: 'System is already armed', state: systemState });
  }

  systemState.armed = true;
  res.status(200).json({ message: 'System armed successfully', state: systemState });
  console.log('System armed');
});

// Disarm the system
router.post('/disarm', (req, res) => {
  if (!systemState.armed) {
    return res.status(200).json({ message: 'System is already disarmed', state: systemState });
  }

  systemState.armed = false;
  systemState.alarmTriggered = false; // Reset alarm when disarming
  res.status(200).json({ message: 'System disarmed successfully', state: systemState });
});

// Trigger an alarm
router.post('/trigger', (req, res) => {
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

// Receive image data
router.post('/api/all-image-data', (req, res) => {
  const { image, timestamp } = req.body;

  if (!image || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields: image, timestamp' });
  }

  const imageData = readJsonFile(IMAGE_DATA_FILE);
  imageData.push({ image, timestamp });
  writeJsonFile(IMAGE_DATA_FILE, imageData);

  res.status(200).json({ message: 'Image data received successfully' });
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
  

// View sensor data (optional, for debugging)
router.get('/api/sensor-data', (req, res) => {
  const sensorData = readJsonFile(SENSOR_DATA_FILE);
  res.status(200).json(sensorData);
});

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
