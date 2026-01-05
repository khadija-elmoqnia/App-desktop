// ============================================================================
// 📍 FRONTEND (Renderer) – React Component (MULTI-FILES)
// ============================================================================

import React, { useState } from "react";
import "./AnalyseRecu.css";

export default function AnalyseRecu() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [excelMode, setExcelMode] = useState("new"); // "new" ou "existing"
  const [existingExcelPath, setExistingExcelPath] = useState("");
  const [progress, setProgress] = useState({ 
    current: 0, 
    total: 0,
    percentage: 0,
    currentFile: ""
  });

  async function chooseFiles() {
    try {
      const res = await window.api.selectFiles();
      console.log("📥 Fichiers reçus:", res);
      if (!res?.success) return;
      setFiles(res.paths);
    } catch (err) {
      console.error("❌ Erreur:", err);
      alert("Erreur: " + err.message);
    }
  }

  async function chooseExistingExcel() {
    try {
      const res = await window.api.selectExistingExcel();
      console.log("📥 Excel existant reçu:", res);
      if (res?.path) {
        setExistingExcelPath(res.path);
        setExcelMode("existing");
      }
    } catch (err) {
      console.error("❌ Erreur:", err);
      alert("Erreur: " + err.message);
    }
  }

  async function analyser() {
    if (files.length === 0) {
      alert("⚠️ Choisir au moins un fichier !");
      return;
    }

    if (excelMode === "existing" && !existingExcelPath) {
      alert("⚠️ Veuillez sélectionner un fichier Excel existant !");
      return;
    }
    
    setLoading(true);
    setError("");
    setResults([]);
    setProgress({ 
      current: 0, 
      total: files.length,
      percentage: 0,
      currentFile: files[0]?.split(/[/\\]/).pop() || ""
    });

    const allResults = [];
    let finalExcelPath = existingExcelPath;

    for (let i = 0; i < files.length; i++) {
      try {
        console.log(`🔍 Analyse ${i+1}/${files.length}:`, files[i]);
        
        // Mettre à jour la progression
        const percentage = Math.round(((i + 1) / files.length) * 100);
        setProgress({ 
          current: i + 1, 
          total: files.length,
          percentage,
          currentFile: files[i]?.split(/[/\\]/).pop() || ""
        });
        
        // Si c'est le premier fichier et mode "new", passer null pour demander l'emplacement
        const excelPathToUse = (i === 0 && excelMode === "new") ? null : finalExcelPath;
        
        const res = await window.api.analyseRecu(files[i], excelPathToUse);
        console.log(`📥 Résultat ${i+1}:`, res);

        if (res.success && res.data) {
          allResults.push({ 
            file: files[i], 
            data: res.data,
            excelPath: res.excelPath,
            success: true 
          });
          
          // Stocker le chemin Excel pour les fichiers suivants
          if (i === 0 && res.excelPath) {
            finalExcelPath = res.excelPath;
          }
        } else {
          allResults.push({ 
            file: files[i], 
            error: res.error || "Erreur inconnue", 
            success: false 
          });
        }
      } catch (err) {
        console.error(`❌ Erreur ${i+1}:`, err);
        allResults.push({ 
          file: files[i], 
          error: err.message, 
          success: false 
        });
      }
    }

    setLoading(false);
    setProgress({ current: 0, total: 0, percentage: 0, currentFile: "" });
    setResults(allResults);
    
    const successCount = allResults.filter(r => r.success).length;
    const excelPath = allResults.find(r => r.excelPath)?.excelPath;
    
    if (successCount > 0 && excelPath) {
      alert(`✅ ${successCount}/${files.length} reçus analysés !\n📁 Sauvegardé dans: ${excelPath}`);
      
      // Réinitialiser après succès
      if (excelMode === "new") {
        setFiles([]);
        setExistingExcelPath("");
        setExcelMode("new");
      }
    } else if (successCount > 0) {
      alert(`✅ ${successCount}/${files.length} reçus analysés !`);
    } else {
      alert(`❌ Aucun reçu analysé avec succès`);
    }
  }

  function removeFile(index) {
    setFiles(files.filter((_, i) => i !== index));
  }

  function handleExcelModeChange(mode) {
    setExcelMode(mode);
    if (mode === "new") {
      setExistingExcelPath("");
    }
  }

  return (
    <div className="analyse-container">
      <div className="analyse-card">
        <div className="analyse-header">
          <h1 className="analyse-title">🧾 Analyse de Reçus</h1>
          <p className="analyse-subtitle">Extraction automatique avec OCR</p>
        </div>

        <div className="analyse-section">
          <button onClick={chooseFiles} className="btn-primary">
            📎 Sélectionner des Images
          </button>
          
          {files.length > 0 && (
            <div className="file-list">
              <p className="file-count">
                <strong>{files.length}</strong> fichier(s) sélectionné(s)
              </p>
              <ul>
                {files.map((f, i) => (
                  <li key={i} className="file-list-item">
                    <span className="file-name">{f.split(/[/\\]/).pop()}</span>
                    <button 
                      onClick={() => removeFile(i)} 
                      className="btn-remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="analyse-section">
          <h3 className="section-title">📊 Options Excel</h3>
          
          <div className="excel-options">
            <div className="option-row">
              <input
                type="radio"
                id="new-excel"
                name="excel-mode"
                checked={excelMode === "new"}
                onChange={() => handleExcelModeChange("new")}
              />
              <label htmlFor="new-excel" className="option-label">
                <span className="option-icon">📄</span>
                <div>
                  <strong>Créer un nouveau fichier Excel</strong>
                  <p className="option-description">
                    Choisir l'emplacement lors de la première analyse
                  </p>
                </div>
              </label>
            </div>

            <div className="option-row">
              <input
                type="radio"
                id="existing-excel"
                name="excel-mode"
                checked={excelMode === "existing"}
                onChange={() => handleExcelModeChange("existing")}
              />
              <label htmlFor="existing-excel" className="option-label">
                <span className="option-icon">📂</span>
                <div>
                  <strong>Ajouter à un fichier Excel existant</strong>
                  <p className="option-description">
                    Sélectionner un fichier pour ajouter les nouvelles données
                  </p>
                </div>
              </label>
            </div>
          </div>

          {excelMode === "existing" && (
            <div className="excel-file-section">
              <button onClick={chooseExistingExcel} className="btn-secondary">
                📂 Sélectionner le fichier Excel
              </button>
              {existingExcelPath ? (
                <p className="excel-path">
                  📁 {existingExcelPath.split(/[/\\]/).pop()}
                  <br />
                  <small>{existingExcelPath}</small>
                </p>
              ) : (
                <p className="excel-default">
                  ⚠️ Veuillez sélectionner un fichier Excel
                </p>
              )}
            </div>
          )}
        </div>

        <button 
          disabled={loading || files.length === 0 || (excelMode === "existing" && !existingExcelPath)} 
          onClick={analyser}
          className="btn-analyse"
        >
          {loading ? "⏳ Analyse en cours..." : "🚀 Lancer l'analyse OCR"}
        </button>

        {loading && (
          <div className="progress-section">
            <div className="progress-info">
              <span className="progress-text">
                {progress.currentFile} ({progress.current}/{progress.total})
              </span>
              <span className="progress-percentage">{progress.percentage}%</span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-box">
            ❌ {error}
          </div>
        )}

      </div>
    </div>
  );
}