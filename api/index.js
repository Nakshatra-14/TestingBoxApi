const express = require('express');
const multer = require('multer');
const { Canvas, Image, loadImage } = require('canvas');

// --- 1. POLYFILL THE BROWSER ENVIRONMENT ---
// We must do this BEFORE loading TensorFlow/TeachableMachine
// or they will crash looking for "window" or "HTMLCanvasElement".
global.window = global;
global.HTMLCanvasElement = Canvas;
global.HTMLImageElement = Image;
global.HTMLVideoElement = Object; // Dummy object to prevent crash

// --- 2. LOAD LIBRARIES ---
const tf = require('@tensorflow/tfjs');
const tmImage = require('@teachablemachine/image');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// --- CONFIGURATION ---
const URL = "https://teachablemachine.withgoogle.com/models/nxq6v0lNm/"; 
let model;

// --- 3. MODEL LOADER ---
async function loadModel() {
    if (model) return model;
    console.log("Loading model...");
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";
    
    // tmImage.load usually runs in browser. In Node, it needs help.
    model = await tmImage.load(modelURL, metadataURL);
    return model;
}

// --- 4. API ROUTE ---
app.post('/api/check', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        // Load Model
        const loadedModel = await loadModel();

        // Convert Buffer to Image
        const image = await loadImage(req.file.buffer);

        // Create a Canvas (The AI needs a canvas, not a raw image)
        const canvas = new Canvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // Predict
        const prediction = await loadedModel.predict(canvas);

        // Find Winner
        let highestScore = 0;
        let status = "Unknown";

        prediction.forEach(p => {
            if (p.probability > highestScore) {
                highestScore = p.probability;
                status = p.className;
            }
        });

        // Response
        res.json({
            status: status,
            confidence: (highestScore * 100).toFixed(2),
            is_damaged: status.toLowerCase().includes("damaged")
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Analysis failed", details: error.message });
    }
});

// Health Check
app.get('/', (req, res) => res.send("✅ Box API is Online (Node 18 Mode)"));

module.exports = app;
