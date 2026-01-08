const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Factures
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFiles2: () => ipcRenderer.invoke('select-files2'),
  selectExistingExcel: () => ipcRenderer.invoke('select-existing-excel'),
  analyseRecu: (imgPath, excelPath) => ipcRenderer.invoke('analyse-recu', imgPath, excelPath),
  
  // CV
  analyzeCV: (fileData) => ipcRenderer.invoke('analyze-cv', fileData),
  analyzeCVForSummary: (fileData) => ipcRenderer.invoke('analyze-cv-for-summary', fileData),
  readFileFromPath: (filePath) => ipcRenderer.invoke('read-file-from-path', filePath),
  
  // Base de données CV
  loadCVDatabase: () => ipcRenderer.invoke('load-cv-database'),
  saveCVToDatabase: (cvData) => ipcRenderer.invoke('save-cv-to-database', cvData),
  deleteCVFromDatabase: (cvId) => ipcRenderer.invoke('delete-cv-from-database', cvId),
  checkCVExists: (email, name) => ipcRenderer.invoke('check-cv-exists', email, name),
  
  // Résumés CV
  saveCVSummaryToDatabase: (cvId, summary) => ipcRenderer.invoke('save-cv-summary-to-database', cvId, summary),
  getCVSummary: (cvId) => ipcRenderer.invoke('get-cv-summary', cvId),
  updateCVSummary: (cvId, summary) => ipcRenderer.invoke('update-cv-summary', cvId, summary),
  
  // Fichiers
  getCVContent: (cvId) => ipcRenderer.invoke('get-cv-content', cvId),
  openDocument: (filePath) => ipcRenderer.invoke('open-document', filePath),
  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  saveFile: (data, fileName) => ipcRenderer.invoke('save-file', data, fileName),
  
  // Recherche et export
  searchCVs: (filters) => ipcRenderer.invoke('search-cvs', filters),
  getCVStats: () => ipcRenderer.invoke('get-cv-stats'),
  exportCVDatabase: () => ipcRenderer.invoke('export-cv-database'),
  updateCV: (cv) => ipcRenderer.invoke('update-cv', cv)
});