import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { BrowserQRCodeReader } from "@zxing/browser";

const socket = io("http://localhost:5000");

function Receive() {
  const { code } = useParams();
  const [files, setFiles] = useState([]);
  const [shareCode, setShareCode] = useState(code || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const qrReader = useRef(null);

  useEffect(() => {
    socket.on("progress", (data) => {
      const percentage = Math.round((data.processed / data.total) * 100);
      setDownloadProgress(percentage);
    });

    return () => socket.off("progress");
  }, []);

  useEffect(() => {
    if (shareCode.length === 4) fetchFiles();
  }, [shareCode]);

  const fetchFiles = async () => {
    if (shareCode.trim().length !== 4) {
      setErrorMessage("Please enter a valid 4-digit code.");
      return;
    }

    try {
      const response = await axios.get(`http://localhost:5000/file/${shareCode}`);
      if (response.data.files.length === 0) {
        setErrorMessage("No files found. Please check the code or contact the sender.");
        setFiles([]);
      } else {
        setFiles(response.data.files);
        setErrorMessage("");
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      setErrorMessage("Invalid code! Please check and try again.");
    }
  };

  const handleDownloadAll = () => {
    setDownloadProgress(0);
    window.location.href = `http://localhost:5000/download-all/${shareCode}`;
  };

  const startScanning = async () => {
    setScanning(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");

      if (videoDevices.length === 0) {
        setErrorMessage("No camera found!");
        setScanning(false);
        return;
      }

      qrReader.current = new BrowserQRCodeReader();

      const result = await qrReader.current.decodeOnceFromVideoDevice(videoDevices[0].deviceId, videoRef.current);
      console.log("QR Code scanned:", result.text);
      
      const extractedCode = result.text.split("/").pop().slice(-4); 
      setShareCode(extractedCode);
      setErrorMessage("");
      setScanning(false);
    } catch (error) {
      console.error("QR Scan Error:", error);
      setErrorMessage("QR Code scanning failed. Try again.");
      setScanning(false);
    }
  };

  return (
    <div>
      <h1>Receive Files with NeoShare</h1>
      <p>Enter the 4-digit code or scan the QR code to receive files.</p>

      <input
        type="text"
        placeholder="Enter 4-digit code"
        value={shareCode}
        maxLength={4}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, "");
          setShareCode(value);
          setErrorMessage("");
        }}
      />
      <br /><br />

      <button onClick={fetchFiles}>Fetch Files</button>
      <button onClick={startScanning}>Scan QR Code</button>

      {scanning && <video ref={videoRef} style={{ width: "300px" }} autoPlay></video>}

      {errorMessage && <p style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</p>}

      {files.length > 0 && (
        <div>
          <h2>Files:</h2>
          <ul>
            {files.map((file, index) => (
              <li key={index}>
                {file.name} ({(file.size / 1024).toFixed(2)} MB) - 
                <a href={`http://localhost:5000/download/${file.id}`} download>
                  Download
                </a>
              </li>
            ))}
          </ul>

          <button onClick={handleDownloadAll}>Download All as ZIP</button>

          {downloadProgress > 0 && (
            <div>
              <p>Downloading: {downloadProgress}%</p>
              <progress value={downloadProgress} max="100"></progress>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Receive;
