// ============================================================================
// 🧱 ELECTRON MAIN PROCESS (ARABIC SUPPORT + SAVE DIALOG)
// ============================================================================
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = require("electron-is-dev");
const XLSX = require("xlsx");
const { AffindaAPI, AffindaCredential } = require('@affinda/affinda');
require("dotenv").config();
const { Readable } = require('stream');
const os = require('os');

// ----------------------------------------------------------------------------
// 🔑 ENV
// ----------------------------------------------------------------------------
const API_KEY = process.env.MINDEE_API_KEY;
const MODEL_ID = process.env.MINDEE_MODEL_ID;

console.log("====================================");
console.log("🔍 ENV CHECK");
console.log("MINDEE_API_KEY:", API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("MINDEE_MODEL_ID:", MODEL_ID || "❌ Missing");
console.log("====================================");

let mainWindow;

// ----------------------------------------------------------------------------
// 🪟 Create Window
// ----------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // ✅ CHANGER LE TITRE ICI
  mainWindow.setTitle('DocManager - Gestion CV & Factures');

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  registerHandlers();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ============================================================================
// 📡 CV BASE DE DONNE CRUD HANDLERS 
// ============================================================================

// Chemin vers le fichier de base de données CV
const CV_DB_PATH = path.join(app.getPath('userData'), 'cv_database.json');

// ============================================================================
// 📂 GESTIONNAIRE DE BASE DE DONNÉES CV LOCALE
// ============================================================================

/**
 * Charger la base de données CV depuis le fichier local
 */
function loadCVDatabase() {
  try {
    if (fs.existsSync(CV_DB_PATH)) {
      const data = fs.readFileSync(CV_DB_PATH, 'utf8');
      const cvs = JSON.parse(data);
      console.log(`✅ ${cvs.length} CVs chargés depuis ${CV_DB_PATH}`);
      return cvs;
    }
    console.log('📝 Nouvelle base de données CV créée');
    return [];
  } catch (err) {
    console.error('❌ Erreur lecture base CV:', err);
    return [];
  }
}

/**
 * Sauvegarder la base de données CV dans le fichier local
 */
function saveCVDatabase(cvs) {
  try {
    fs.writeFileSync(CV_DB_PATH, JSON.stringify(cvs, null, 2), 'utf8');
    console.log(`💾 ${cvs.length} CVs sauvegardés dans ${CV_DB_PATH}`);
    return true;
  } catch (err) {
    console.error('❌ Erreur sauvegarde base CV:', err);
    return false;
  }
}

// ============================================================================
// 📡 IPC HANDLERS POUR LA GESTION DES CVS
// ============================================================================

/**
 * Charger tous les CVs de la base de données
 */
ipcMain.handle('load-cv-database', async () => {
  try {
    const cvs = loadCVDatabase();
    return { success: true, cvs };
  } catch (err) {
    console.error('Erreur load-cv-database:', err);
    return { success: false, error: err.message, cvs: [] };
  }
});

/**
 * Sauvegarder un nouveau CV dans la base de données
 */
ipcMain.handle('save-cv-to-database', async (event, cvData) => {
  try {
    console.log('💾 Sauvegarde nouveau CV:', cvData.name);
    
    const cvs = loadCVDatabase();
    
    // Vérifier si le CV existe déjà (par ID)
    const existingIndex = cvs.findIndex(cv => cv.id === cvData.id);
    
    if (existingIndex >= 0) {
      // Mettre à jour
      cvs[existingIndex] = cvData;
      console.log('🔄 CV mis à jour');
    } else {
      // Ajouter nouveau
      cvs.push(cvData);
      console.log('➕ Nouveau CV ajouté');
    }
    
    const saved = saveCVDatabase(cvs);
    
    if (saved) {
      return { success: true, message: 'CV sauvegardé avec succès' };
    } else {
      return { success: false, error: 'Erreur lors de la sauvegarde' };
    }
  } catch (err) {
    console.error('Erreur save-cv-to-database:', err);
    return { success: false, error: err.message };
  }
});

/**
 * Supprimer un CV de la base de données
 */
ipcMain.handle('delete-cv-from-database', async (event, cvId) => {
  try {
    console.log('🗑️ Suppression CV:', cvId);
    
    const cvs = loadCVDatabase();
    const filteredCVs = cvs.filter(cv => cv.id !== cvId);
    
    if (filteredCVs.length === cvs.length) {
      return { success: false, error: 'CV non trouvé' };
    }
    
    const saved = saveCVDatabase(filteredCVs);
    
    if (saved) {
      return { success: true, message: 'CV supprimé avec succès' };
    } else {
      return { success: false, error: 'Erreur lors de la suppression' };
    }
  } catch (err) {
    console.error('Erreur delete-cv-from-database:', err);
    return { success: false, error: err.message };
  }
});

/**
 * Exporter la base de données CV en Excel
 */
ipcMain.handle('export-cv-database', async () => {
  try {
    const cvs = loadCVDatabase();
    
    if (cvs.length === 0) {
      return { success: false, error: 'Aucun CV à exporter' };
    }
    
    // Demander où sauvegarder
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Exporter la base de données CV',
      defaultPath: path.join(app.getPath('desktop'), `CVs_Export_${Date.now()}.xlsx`),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    
    if (canceled || !filePath) {
      return { success: false, error: 'Export annulé' };
    }
    
    // Créer le workbook Excel
    const workbook = XLSX.utils.book_new();
    
    // Feuille 1: Vue d'ensemble des CVs
    const overviewData = cvs.map(cv => ({
      'Nom': cv.name || 'N/A',
      'Email': cv.email || 'N/A',
      'Téléphone': cv.phone || 'N/A',
      'Localisation': cv.location || 'N/A',
      'Années d\'expérience': cv.totalYearsExperience || 0,
      'Nombre de compétences': cv.skills?.length || 0,
      'Compétences': cv.skills?.join(', ') || '',
      'Date d\'upload': cv.uploadDate ? new Date(cv.uploadDate).toLocaleDateString() : '',
      'Fichier': cv.fileName || ''
    }));
    
    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Vue d\'ensemble');
    
    // Feuille 2: Compétences détaillées
    const skillsData = [];
    cvs.forEach(cv => {
      if (cv.skills && cv.skills.length > 0) {
        cv.skills.forEach(skill => {
          skillsData.push({
            'Nom': cv.name,
            'Email': cv.email,
            'Compétence': skill,
            'Années d\'expérience': cv.totalYearsExperience
          });
        });
      }
    });
    
    if (skillsData.length > 0) {
      const skillsSheet = XLSX.utils.json_to_sheet(skillsData);
      XLSX.utils.book_append_sheet(workbook, skillsSheet, 'Compétences');
    }
    
    // Feuille 3: Expériences professionnelles
    const expData = [];
    cvs.forEach(cv => {
      if (cv.workExperience && cv.workExperience.length > 0) {
        cv.workExperience.forEach(exp => {
          expData.push({
            'Nom': cv.name,
            'Email': cv.email,
            'Poste': exp.jobTitle || 'N/A',
            'Organisation': exp.organization || 'N/A',
            'Dates': exp.dates || 'N/A',
            'Description': exp.description || ''
          });
        });
      }
    });
    
    if (expData.length > 0) {
      const expSheet = XLSX.utils.json_to_sheet(expData);
      XLSX.utils.book_append_sheet(workbook, expSheet, 'Expériences');
    }
    
    // Feuille 4: Formation
    const eduData = [];
    cvs.forEach(cv => {
      if (cv.education && cv.education.length > 0) {
        cv.education.forEach(edu => {
          eduData.push({
            'Nom': cv.name,
            'Email': cv.email,
            'Diplôme': edu.degree || 'N/A',
            'Institution': edu.institution || 'N/A',
            'Dates': edu.dates || 'N/A'
          });
        });
      }
    });
    
    if (eduData.length > 0) {
      const eduSheet = XLSX.utils.json_to_sheet(eduData);
      XLSX.utils.book_append_sheet(workbook, eduSheet, 'Formation');
    }
    
    // Sauvegarder le fichier Excel
    XLSX.writeFile(workbook, filePath);
    
    console.log(`✅ Base de données exportée vers: ${filePath}`);
    return { success: true, path: filePath };
    
  } catch (err) {
    console.error('Erreur export-cv-database:', err);
    return { success: false, error: err.message };
  }
});

/**
 * Rechercher des CVs par critères
 */
ipcMain.handle('search-cvs', async (event, { query, minYearsExp }) => {
  try {
    const cvs = loadCVDatabase();
    
    let results = cvs;
    
    // Filtrer par années d'expérience
    if (minYearsExp && minYearsExp > 0) {
      results = results.filter(cv => 
        cv.totalYearsExperience >= minYearsExp
      );
    }
    
    // Filtrer par texte de recherche
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      results = results.filter(cv => {
        // Rechercher dans le nom
        if (cv.name?.toLowerCase().includes(searchTerm)) return true;
        
        // Rechercher dans les compétences
        if (cv.skills?.some(skill => 
          skill.toLowerCase().includes(searchTerm)
        )) return true;
        
        // Rechercher dans le texte brut
        if (cv.rawText?.toLowerCase().includes(searchTerm)) return true;
        
        return false;
      });
    }
    
    return { success: true, results };
  } catch (err) {
    console.error('Erreur search-cvs:', err);
    return { success: false, error: err.message, results: [] };
  }
});

/**
 * Obtenir les statistiques de la base de données
 */
ipcMain.handle('get-cv-stats', async () => {
  try {
    const cvs = loadCVDatabase();
    
    // Collecter toutes les compétences
    const allSkills = {};
    cvs.forEach(cv => {
      if (cv.skills) {
        cv.skills.forEach(skill => {
          allSkills[skill] = (allSkills[skill] || 0) + 1;
        });
      }
    });
    
    // Top 10 compétences
    const topSkills = Object.entries(allSkills)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));
    
    // Moyenne d'années d'expérience
    const avgExperience = cvs.length > 0
      ? cvs.reduce((sum, cv) => sum + (cv.totalYearsExperience || 0), 0) / cvs.length
      : 0;
    
    const stats = {
      totalCVs: cvs.length,
      avgExperience: avgExperience.toFixed(1),
      topSkills,
      totalSkills: Object.keys(allSkills).length
    };
    
    return { success: true, stats };
  } catch (err) {
    console.error('Erreur get-cv-stats:', err);
    return { success: false, error: err.message };
  }
});

// ============================================================================
// 📡 MINDEE UPLOAD ➝ POLL ➝ RESULT
// ============================================================================

async function uploadMindee(filePath) {
  const abs = path.resolve(filePath);
  const buffer = fs.readFileSync(abs);
  const blob = new Blob([buffer]);

  const form = new FormData();
  form.append("model_id", MODEL_ID);
  form.append("file", blob, path.basename(abs));

  const res = await fetch("https://api-v2.mindee.net/v2/inferences/enqueue", {
    method: "POST",
    headers: { Authorization: API_KEY },
    body: form,
  });

  const json = await res.json();
  console.log("⬆️ Upload Response:", json);

  if (!json.job?.id) throw new Error("❌ Upload failed: " + JSON.stringify(json));
  return json.job.id;
}

async function pollMindee(jobId) {
  const pollUrl = `https://api-v2.mindee.net/v2/jobs/${jobId}`;
  
  while (true) {
    const res = await fetch(pollUrl, { headers: { Authorization: API_KEY } });
    const json = await res.json();

    if (json.inference) {
      console.log("✅ Résultat reçu directement!");
      return json.inference;
    }

    if (!json.job) {
      throw new Error("❌ Unexpected response: " + JSON.stringify(json));
    }

    const status = json.job.status;
    console.log("⏳ Status:", status);

    if (status === "Processed" && json.job.result_url) {
      const resultRes = await fetch(json.job.result_url, {
        headers: { Authorization: API_KEY }
      });
      const resultJson = await resultRes.json();
      return resultJson.inference;
    }

    if (status === "Failed") {
      throw new Error("❌ Processing failed!");
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

function extractFields(inference) {
  const fields = inference?.result?.fields ?? {};

  const data = {
    "Nom de place": fields.supplier_name?.value || "N/A",
    "Date": fields.date?.value || "N/A",
    "Montant total": fields.total_amount?.value || 0,
    "Catégorie": fields.purchase_category?.value || "N/A",
  };

  console.log("📋 Extracted data:", data);
  return data;
}

function normalizeExcelFile(excelPath) {
  try {
    if (!fs.existsSync(excelPath)) {
      return { exists: false };
    }

    const workbook = XLSX.readFile(excelPath, { cellText: false, cellDates: true });
    const sheetName = workbook.SheetNames[0] || "Reçus";
    const sheet = workbook.Sheets[sheetName];
    
    const allRows = XLSX.utils.sheet_to_json(sheet);
    
    const normalizedRows = allRows.map(row => ({
      "Nom de place": row["Nom de place"] || row["Nom"] || row["nom"] || "N/A",
      "Date": row["Date"] || row["date"] || "N/A",
      "Montant total": row["Montant total"] || row["Montant"] || row["montant"] || 0,
      "Catégorie": row["Catégorie"] || row["catégorie"] || row["Category"] || "N/A"
    }));

    return {
      exists: true,
      rows: normalizedRows,
      sheetName: sheetName,
      workbook: workbook
    };
  } catch (err) {
    console.warn("⚠️ Erreur lors de la normalisation du fichier Excel:", err.message);
    return { exists: false };
  }
}

// ============================================================================
// 📡 AFFINDA API
// ============================================================================

const affindaClient = new AffindaAPI(
  new AffindaCredential(process.env.AFFINDA_API_KEY)
);

ipcMain.handle("analyze-cv", async (_, fileData) => {
  console.log("📥 ANALYZE CV RECEIVED", fileData.fileName);

  try {
    if (!process.env.AFFINDA_WORKSPACE_ID)
      throw new Error("AFFINDA_WORKSPACE_ID missing");
    if (!process.env.AFFINDA_RESUME_TYPE_ID)
      throw new Error("AFFINDA_RESUME_TYPE_ID missing");

    const buffer = Buffer.from(fileData.buffer);
    const stream = Readable.from(buffer);
    stream.name = fileData.fileName;

    console.log("📤 Sending document to Affinda...");

    const document = await affindaClient.createDocument({
      file: stream,
      workspace: process.env.AFFINDA_WORKSPACE_ID,
      documentType: process.env.AFFINDA_RESUME_TYPE_ID,
      language: 'fr',
      country: 'fr'
    });

    console.log("📊 Affinda RAW RESPONSE:", document);

    const resumeData =
      document.data ||
      document.extractedData ||
      document.results?.documents?.[0]?.data;

    if (!resumeData || Object.keys(resumeData).length === 0) {
      console.warn("⚠️ No structured resume data found.");
      return {
        success: false,
        error: "No structured resume data returned",
      };
    }

    return {
      success: true,
      data: resumeData,
    };

  } catch (err) {
    console.error("❌ AFFINDA ERROR:", err.message);
    return { success: false, error: err.message };
  }
});

// ============================================================================
// 📝 UNIQUE HANDLER: Générer résumé avec Affinda Resume Summary Parser
// ============================================================================

ipcMain.handle("analyze-cv-for-summary", async (_, fileData) => {
  console.log("📝 Génération résumé avec Affinda Summary Parser");

  try {
    if (!fileData?.buffer || !fileData?.fileName) {
      return { success: false, error: "Fichier manquant" };
    }

    if (!process.env.AFFINDA_WORKSPACE_ID) {
      return { success: false, error: "AFFINDA_WORKSPACE_ID manquant dans .env" };
    }

    if (!process.env.AFFINDA_SUMMARY_TYPE_ID) {
      return { success: false, error: "AFFINDA_SUMMARY_TYPE_ID manquant dans .env" };
    }

    const buffer = Buffer.from(fileData.buffer);
    const stream = Readable.from(buffer);
    stream.name = fileData.fileName;

    console.log(`📤 Envoi à Affinda: ${fileData.fileName}`);

    const response = await affindaClient.createDocument({
      file: stream,
      workspace: process.env.AFFINDA_WORKSPACE_ID,
      documentType: process.env.AFFINDA_SUMMARY_TYPE_ID,
      language: 'fr',
      country: 'fr'
    });

    console.log("✅ Réponse Affinda reçue");

    if (response.meta?.failed) {
      console.error("❌ L'extraction Affinda a échoué");
      return { 
        success: false, 
        error: `Extraction échouée: ${response.meta.error || 'Erreur inconnue'}`
      };
    }

    if (!response.data) {
      console.error("❌ response.data manquant");
      return { 
        success: false, 
        error: "La réponse d'Affinda ne contient pas de 'data'" 
      };
    }

    const summaryObject = response.data.summary;

    if (!summaryObject) {
      console.error("❌ data.summary est null ou undefined");
      return { 
        success: false, 
        error: "L'API n'a pas généré de résumé. Le CV est peut-être vide ou mal formaté."
      };
    }

    let summary = '';
    
    if (typeof summaryObject === 'string') {
      summary = summaryObject;
    } else if (typeof summaryObject === 'object') {
      summary = summaryObject.parsed || summaryObject.raw || '';
    }

    if (!summary || summary.trim().length === 0) {
      console.error("❌ Le résumé extrait est vide");
      console.log("📋 summaryObject:", JSON.stringify(summaryObject, null, 2));
      return { 
        success: false, 
        error: "Le résumé généré est vide"
      };
    }

    console.log(`✅ Summary trouvé: ${summary.length} caractères`);

    summary = summary.trim();
    summary = summary.replace(/\s+/g, ' ');
    summary = summary.replace(/\n{3,}/g, '\n\n');
    
    const MAX_LENGTH = 2000;
    if (summary.length > MAX_LENGTH) {
      console.log(`⚠️ Résumé long (${summary.length} caractères), troncation à ${MAX_LENGTH}`);
      summary = summary.substring(0, MAX_LENGTH) + "...";
    }

    console.log(`🎉 Résumé final: ${summary.length} caractères`);
    
    return {
      success: true,
      summary: summary,
      summaryLength: summary.length,
      meta: {
        fileName: fileData.fileName,
        documentId: response.meta?.identifier,
        confidence: summaryObject.confidence,
        textExtractionConfidence: summaryObject.textExtractionConfidence,
        language: 'fr'
      }
    };

  } catch (err) {
    console.error("❌ Erreur génération résumé:", err.message);
    
    if (err.response) {
      console.error("📋 Réponse HTTP:", err.response.status);
      console.error("📋 Données:", err.response.data);
      
      return { 
        success: false, 
        error: `Erreur API Affinda (${err.response.status}): ${err.response.data?.error || err.message}`
      };
    }
    
    return { 
      success: false, 
      error: `Erreur: ${err.message}`
    };
  }
});

ipcMain.handle('read-file-from-path', async (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Fichier introuvable" };
    }
    
    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    return {
      success: true,
      buffer: Array.from(new Uint8Array(buffer)),
      fileName: fileName
    };
  } catch (err) {
    console.error("Erreur lecture fichier:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-cv-summary-to-database', async (event, cvId, summary) => {
  try {
    console.log('💾 Sauvegarde résumé pour CV:', cvId);
    
    const cvs = loadCVDatabase();
    const cvIndex = cvs.findIndex(cv => cv.id === cvId);
    
    if (cvIndex === -1) {
      return { success: false, error: 'CV non trouvé' };
    }
    
    cvs[cvIndex] = {
      ...cvs[cvIndex],
      summary: summary,
      summaryDate: new Date().toISOString()
    };
    
    const saved = saveCVDatabase(cvs);
    
    if (saved) {
      return { 
        success: true, 
        message: 'Résumé sauvegardé avec succès' 
      };
    } else {
      return { 
        success: false, 
        error: 'Erreur lors de la sauvegarde du résumé' 
      };
    }
  } catch (err) {
    console.error('Erreur save-cv-summary-to-database:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-cv-summary', async (event, cvId) => {
  try {
    const cvs = loadCVDatabase();
    const cv = cvs.find(cv => cv.id === cvId);
    
    if (!cv) {
      return { success: false, error: 'CV non trouvé' };
    }
    
    return { 
      success: true, 
      summary: cv.summary || null,
      hasSummary: !!cv.summary,
      summaryDate: cv.summaryDate || null
    };
  } catch (err) {
    console.error('Erreur get-cv-summary:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-cv-summary', async (event, cvId, summary) => {
  try {
    console.log('📝 Mise à jour résumé pour CV:', cvId);
    
    const cvs = loadCVDatabase();
    const cvIndex = cvs.findIndex(cv => cv.id === cvId);
    
    if (cvIndex === -1) {
      return { success: false, error: 'CV non trouvé' };
    }
    
    cvs[cvIndex] = {
      ...cvs[cvIndex],
      summary: summary,
      summaryDate: new Date().toISOString(),
      summaryUpdated: true
    };
    
    const saved = saveCVDatabase(cvs);
    
    if (saved) {
      return { 
        success: true, 
        message: 'Résumé mis à jour avec succès' 
      };
    } else {
      return { 
        success: false, 
        error: 'Erreur lors de la mise à jour du résumé' 
      };
    }
  } catch (err) {
    console.error('Erreur update-cv-summary:', err);
    return { success: false, error: err.message };
  }
});

// ============================================================================
// 🎯 IPC HANDLERS
// ============================================================================
function registerHandlers() {
  console.log("🔥 IPC Ready - Enregistrement des handlers");

  // ✅ Sélection multi-fichiers
  ipcMain.handle("select-files", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Documents", extensions: ["pdf", "doc", "docx", "txt"] },
        { name: "Images", extensions: ["jpg", "jpeg", "png"] }
      ],
    });
    
    console.log("📂 Résultat dialog:", result.filePaths.length, "fichiers");
    
    if (result.canceled) {
      console.log("❌ Sélection annulée");
      return { success: false };
    }
    
    console.log("✅ Fichiers sélectionnés:", result.filePaths);
    return { success: true, paths: result.filePaths };
  });

  ipcMain.handle("select-files2", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png"] }
      ],
    });

    if (result.canceled) return { success: false };
    return { success: true, paths: result.filePaths };
  });

  // ✅ Sélectionner un fichier Excel existant
  ipcMain.handle("select-existing-excel", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
      title: "Sélectionner un fichier Excel existant"
    });

    console.log("📂 Select existing Excel result:", result);

    if (result.canceled) {
      console.log("❌ Sélection annulée");
      return null;
    }

    const excelPath = result.filePaths[0];
    
    try {
      fs.accessSync(excelPath, fs.constants.R_OK);
      console.log("✅ Fichier Excel sélectionné:", excelPath);
      return { path: excelPath };
    } catch (err) {
      console.error("❌ Fichier Excel invalide:", err.message);
      return null;
    }
  });

  // ✅ Analyse reçu avec gestion des deux modes
  ipcMain.handle("analyse-recu", async (event, imgPath, excelPath) => {
    try {
      if (!API_KEY) return { success: false, error: "⚠️ Missing MINDEE_API_KEY" };
      if (!MODEL_ID) return { success: false, error: "⚠️ Missing MINDEE_MODEL_ID" };

      console.log("🚀 Starting analysis for:", imgPath);
      console.log("📊 Mode Excel:", excelPath ? "EXISTING" : "NEW");

      const jobId = await uploadMindee(imgPath);
      console.log("📤 Job ID:", jobId);

      const inference = await pollMindee(jobId);
      console.log("✅ Inference received");

      const clean = extractFields(inference);
      console.log("🎉 OCR RESULT:", clean);

      let finalExcelPath = excelPath;
      let workbook;
      let sheetName = "Reçus";
      let rows = [];

      // MODE 1: Pas de chemin fourni → demander où sauvegarder (nouveau fichier)
      if (!finalExcelPath) {
        const currentYear = new Date().getFullYear();
        const defaultPath = path.join(app.getPath("desktop"), `recu_${currentYear}.xlsx`);
        
        const saveResult = await dialog.showSaveDialog(mainWindow, {
          title: "Enregistrer le nouveau fichier Excel",
          defaultPath: defaultPath,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
          properties: ["createDirectory", "showOverwriteConfirmation"]
        });

        if (saveResult.canceled) {
          return { success: false, error: "Sauvegarde annulée" };
        }

        finalExcelPath = saveResult.filePath;
        console.log("📁 Nouveau fichier créé:", finalExcelPath);
        
        workbook = XLSX.utils.book_new();
        rows = [];
      } 
      // MODE 2: Chemin fourni → utiliser le fichier existant
      else {
        const normalized = normalizeExcelFile(finalExcelPath);
        
        if (normalized.exists) {
          workbook = normalized.workbook;
          rows = normalized.rows;
          sheetName = normalized.sheetName;
          console.log("📖 Fichier existant chargé:", rows.length, "lignes");
        } else {
          console.log("⚠️ Fichier non trouvé ou invalide, création nouveau");
          workbook = XLSX.utils.book_new();
          rows = [];
        }
      }

      // Ajouter la nouvelle ligne avec uniquement les 4 champs
      rows.push({
        "Nom de place": clean["Nom de place"],
        "Date": clean["Date"],
        "Montant total": clean["Montant total"],
        "Catégorie": clean["Catégorie"]
      });

      console.log("📝 Total lignes après ajout:", rows.length);

      const ws = XLSX.utils.json_to_sheet(rows, {
        header: ["Nom de place", "Date", "Montant total", "Catégorie"]
      });

      workbook.Sheets[sheetName] = ws;
      workbook.SheetNames = [sheetName];

      XLSX.writeFile(workbook, finalExcelPath, {
        bookType: 'xlsx',
        type: 'buffer',
        cellDates: true,
        compression: true
      });

      console.log("💾 Saved to:", finalExcelPath);

      return { 
        success: true, 
        excelPath: finalExcelPath, 
        data: clean 
      };
    } catch (err) {
      console.error("❌ Error:", err);
      return { success: false, error: err.message };
    }
  });
}

// Handler pour vérifier si un CV existe déjà
ipcMain.handle('check-cv-exists', async (_, email, name) => {
  try {
    const cvs = loadCVDatabase();

    if (email) {
      const existingByEmail = cvs.find(cv => cv.email?.toLowerCase() === email.toLowerCase());
      if (existingByEmail) {
        return { 
          exists: true, 
          reason: 'email', 
          cv: existingByEmail,
          message: `Un CV existe déjà avec cet email: ${existingByEmail.email} (${existingByEmail.name})`
        };
      }
    }

    if (name) {
      const existingByName = cvs.find(cv => cv.name?.toLowerCase() === name.toLowerCase());
      if (existingByName) {
        return { 
          exists: true, 
          reason: 'name', 
          cv: existingByName,
          message: `Un CV existe déjà avec ce nom: ${existingByName.name} (${existingByName.email || 'pas d\'email'})`
        };
      }
    }

    return { exists: false };
  } catch (err) {
    console.error("Erreur check-cv-exists:", err);
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('get-cv-content', async (_, cvId) => {
  try {
    const cvs = loadCVDatabase();
    const cv = cvs.find(cv => cv.id === cvId);
    
    if (!cv) {
      return { success: false, error: "CV non trouvé" };
    }
    
    if (cv.fileContent) {
      return { success: true, fileContent: cv.fileContent };
    } else {
      return { success: false, error: "Contenu non trouvé" };
    }
  } catch (err) {
    console.error("Erreur récupération contenu CV:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-document", async (_, filePath) => {
  try {
    console.log("📂 Ouverture du document:", filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error("❌ Fichier non trouvé:", filePath);
      return { success: false, error: "Fichier non trouvé" };
    }
    
    await shell.openPath(filePath);
    console.log("✅ Document ouvert avec succès");
    return { success: true };
    
  } catch (err) {
    console.error("❌ Erreur ouverture document:", err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-download-directory', async () => {
  return path.join(os.homedir(), 'Downloads');
});

ipcMain.handle('file-exists', async (_, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
});



ipcMain.handle('save-file', async (_, data, fileName) => {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads', fileName);
    
    if (data.startsWith('data:')) {
      const base64Data = data.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(downloadsPath, buffer);
    } else {
      fs.writeFileSync(downloadsPath, data);
    }
    
    return { success: true, path: downloadsPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



// PAR CE CODE :
ipcMain.handle('update-cv', async (event, cv) => {
  try {
    console.log('✏️ Mise à jour CV:', cv.id, cv.name);
    
    const cvs = loadCVDatabase();
    const cvIndex = cvs.findIndex(c => c.id === cv.id);
    
    if (cvIndex === -1) {
      console.error('❌ CV non trouvé pour mise à jour:', cv.id);
      return { success: false, error: 'CV non trouvé' };
    }
    
    // Mettre à jour le CV existant
    const updatedCV = {
      ...cvs[cvIndex], // Garder les données existantes
      ...cv,           // Appliquer les nouvelles données
      // S'assurer que certains champs critiques restent
      id: cv.id, 
      filePath: cvs[cvIndex].filePath,
      fileName: cvs[cvIndex].fileName,
      uploadDate: cvs[cvIndex].uploadDate,
      fileContent: cvs[cvIndex].fileContent,
      // Mettre à jour la date de modification
      lastModified: new Date().toISOString()
    };
    
    cvs[cvIndex] = updatedCV;
    
    // Sauvegarder dans le fichier JSON
    const saved = saveCVDatabase(cvs);
    
    if (saved) {
      console.log('✅ CV mis à jour avec succès:', cv.name);
      return { 
        success: true, 
        message: 'CV mis à jour avec succès' 
      };
    } else {
      console.error('❌ Erreur sauvegarde lors de la mise à jour');
      return { 
        success: false, 
        error: 'Erreur lors de la sauvegarde' 
      };
    }
  } catch (err) {
    console.error('Erreur update-cv:', err);
    return { success: false, error: err.message };
  }
});

console.log('✅ Handlers de gestion CV enregistrés');
console.log(`📂 Base de données CV: ${CV_DB_PATH}`);