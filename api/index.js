const express = require('express');
const multer = require('multer');
const { Canvas, Image, loadImage } = require('canvas');

// --- 1. SUPER POLYFILL (The Fix) ---
// We trick the library into thinking it's in a browser
global.window = global;
global.HTMLCanvasElement = Canvas;
global.HTMLImageElement = Image;
global.HTMLVideoElement = Object;

// The error happened because we missed this part:
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') return new Canvas(224, 224); // Give it a fake canvas
        if (tag === 'img') return new Image();
        return {};
    },
    // Sometimes it asks for body to append things
    body: { appendChild: () => {} }
};
// -----------------------------------

// --- 2. LOAD LIBRARIES (Must be AFTER polyfills) ---
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
    
    // Using the mock environment to load
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

        // Create a Canvas for the AI
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
app.get('/', (req, res) => res.send("✅ API is Online"));

module.exports = app;
