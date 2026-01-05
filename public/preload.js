const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Sélection de fichiers
  selectFiles: () => ipcRenderer.invoke("select-files"), 
  selectFiles2: () => ipcRenderer.invoke("select-files2"),
  selectExcel: () => ipcRenderer.invoke("select-excel"),
  analyseRecu: (file, excel) => ipcRenderer.invoke("analyse-recu", file, excel),
  selectExistingExcel: () => ipcRenderer.invoke("select-existing-excel"),
  
  // Analyse de CV
  analyzeCV: (fileData) => ipcRenderer.invoke('analyze-cv', fileData),
  analyzeCVForSummary: (fileData) => ipcRenderer.invoke('analyze-cv-for-summary', fileData),
  
  // Gestion de la base de données CV locale
  loadCVDatabase: () => ipcRenderer.invoke('load-cv-database'),
  saveCVToDatabase: (cvData) => ipcRenderer.invoke('save-cv-to-database', cvData),
  deleteCVFromDatabase: (cvId) => ipcRenderer.invoke('delete-cv-from-database', cvId),
  exportCVDatabase: () => ipcRenderer.invoke('export-cv-database'),
  searchCVs: (criteria) => ipcRenderer.invoke('search-cvs', criteria),
  getCVStats: () => ipcRenderer.invoke('get-cv-stats'),
  
  // Gestion des résumés CV
  saveCVSummaryToDatabase: (cvId, summary) => ipcRenderer.invoke('save-cv-summary-to-database', cvId, summary),
  getCVSummary: (cvId) => ipcRenderer.invoke('get-cv-summary', cvId),
  updateCVSummary: (cvId, summary) => ipcRenderer.invoke('update-cv-summary', cvId, summary),
  
  // Vérification de doublons
  checkCVExists: (email, name) => ipcRenderer.invoke('check-cv-exists', email, name),
  
  // Gestion des fichiers
  getCVContent: (cvId) => ipcRenderer.invoke('get-cv-content', cvId),
  openDocument: (filePath) => ipcRenderer.invoke('open-document', filePath),
  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  saveFile: (data, fileName) => ipcRenderer.invoke('save-file', data, fileName),
  readFileFromPath: (filePath) => ipcRenderer.invoke('read-file-from-path', filePath),
  
  // NOTE: generateCVSummary a été supprimé car il est redondant avec analyzeCVForSummary
  
  // Utilitaires d'écoute d'événements
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
});