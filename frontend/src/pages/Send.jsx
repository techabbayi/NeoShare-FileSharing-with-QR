import { useState } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import "../App.css";

function Send() {
  const [files, setFiles] = useState([]);
  const [shareCode, setShareCode] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (event) => {
    setFiles([...event.target.files]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return alert("Select at least one file!");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await axios.post("https://neoshare-filesharing-with-qr.onrender.com/upload", formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(percent);
        },
      });

      setShareCode(response.data.shareCode);
      setUploadedFiles(response.data.files);
      setUploadProgress(100);

      setTimeout(() => setUploadProgress(0), 2000);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload files. Please try again.");
      setUploadProgress(0);
    }
  };

  const formatFileSize = (size) => {
    if (!size || isNaN(size)) return "Unknown Size";

    return size < 1024
      ? `${size} KB`
      : `${(size / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="container">
      <h1>Send Endless Files with NeoShare</h1>
      <input type="file" multiple onChange={handleFileChange} className="file-input" />
      <button onClick={handleUpload}>Upload & Generate QR</button>

      {uploadProgress > 0 && (
        <div>
          <p>Uploading: {uploadProgress}%</p>
          <progress value={uploadProgress} max="100"></progress>
        </div>
      )}

      {shareCode && (
        <div>
          <h2>Share Code: <strong>{shareCode}</strong></h2>

          <QRCodeCanvas value={`https://neoshare.netlify.app/receive/${shareCode}`} />

          <h3>Files:</h3>
          <ul>
            {uploadedFiles.map((file, index) => (
              <li key={index}>
                {file.name} - {formatFileSize(file?.size)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Send;
