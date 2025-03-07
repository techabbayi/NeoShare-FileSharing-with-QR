import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import QRCode from "qrcode";
import dotenv from "dotenv";
import archiver from "archiver";
import { Server } from "socket.io";
import http from "http";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.ensureDirSync(UPLOADS_DIR);

// Socket.io Integration for Download Progress
io.on("connection", (socket) => {
  console.log(`A user connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Generate a 4-Digit Unique Code
const generateFileCode = () => Math.floor(1000 + Math.random() * 9000).toString();

//  Multer Storage Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const fileCode = generateFileCode();
    const ext = path.extname(file.originalname);
    const newFilename = `${fileCode}${ext}`;

    if (!req.fileCodes) req.fileCodes = [];
    req.fileCodes.push({ code: fileCode, filename: newFilename, originalName: file.originalname });

    cb(null, newFilename);
  },
});

const upload = multer({ storage });

// Upload Multiple Files API
app.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const shareCode = generateFileCode();
    const fileDetails = req.files.map(file => ({
      id: generateFileCode(),
      name: file.originalname,
      size: file.size || 0,  // Ensure numeric size
      path: path.join(UPLOADS_DIR, file.filename),
    }));

    const shareData = { code: shareCode, files: fileDetails };
    await fs.writeJson(path.join(UPLOADS_DIR, `${shareCode}.json`), shareData);

    const fileUrl = `${req.protocol}://${req.get("host")}/receive/${shareCode}`;
    const qrCode = await QRCode.toDataURL(fileUrl);

    io.emit("fileUploaded", { fileUrl, qrCode, shareCode, files: fileDetails });

    res.json({ fileUrl, qrCode, shareCode, files: fileDetails });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch Files by Share Code API
app.get("/file/:shareCode", async (req, res) => {
  try {
    const shareCode = req.params.shareCode;
    const filePath = path.join(UPLOADS_DIR, `${shareCode}.json`);

    if (!(await fs.pathExists(filePath))) return res.status(404).json({ error: "Invalid code" });

    const shareData = await fs.readJson(filePath);
    res.json({ files: shareData.files });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

//  Download Single File API
app.get("/download/:fileCode", async (req, res) => {
  try {
    const fileCode = req.params.fileCode;
    const jsonFiles = await fs.readdir(UPLOADS_DIR);

    for (const jsonFile of jsonFiles) {
      if (jsonFile.endsWith(".json")) {
        const fileData = await fs.readJson(path.join(UPLOADS_DIR, jsonFile));
        const fileToDownload = fileData.files.find(file => file.id === fileCode);

        if (fileToDownload && (await fs.pathExists(fileToDownload.path))) {
          return res.download(fileToDownload.path, fileToDownload.name);
        }
      }
    }
    res.status(404).json({ error: "File not found" });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

//  Download All Files as ZIP File
app.get("/download-all/:shareCode", async (req, res) => {
  try {
    const shareCode = req.params.shareCode;
    const filePath = path.join(UPLOADS_DIR, `${shareCode}.json`);

    if (!(await fs.pathExists(filePath))) return res.status(404).json({ error: "Invalid code" });

    const shareData = await fs.readJson(filePath);
    const zipFileName = `${shareCode}.zip`;
    const zipFilePath = path.join(UPLOADS_DIR, zipFileName);

    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", async () => {
      res.download(zipFilePath, zipFileName, async (err) => {
        if (err) console.error("Download error:", err);
        await fs.remove(zipFilePath);
      });
    });

    archive.pipe(output);
    for (const file of shareData.files) {
      if (await fs.pathExists(file.path)) {
        archive.file(file.path, { name: file.name });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("ZIP error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Cleanup Old Files Periodically
const cleanupOldFiles = async () => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);

      if (Date.now() - stats.mtimeMs > expiryTime) {
        await fs.remove(filePath);
        console.log(`Deleted expired file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

// Run cleanup every 1 hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
