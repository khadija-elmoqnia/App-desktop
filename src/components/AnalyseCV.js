import React, { useState, useEffect } from 'react'; 
import './AnalyseCV.css';

function AnalyseCV() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cvData, setCvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileContent, setFileContent] = useState(null);
  const [savedCVs, setSavedCVs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minYearsExp, setMinYearsExp] = useState('');
  const [viewMode, setViewMode] = useState('analyze');
  const [showingSummary, setShowingSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  
  // Nouveaux états pour les modifications
  const [selectedDomain, setSelectedDomain] = useState('');
  const [editingCV, setEditingCV] = useState(null);

  // Domaines de formation
  const DOMAIN_RULES = [
    {
      key: "SECURITE_INCENDIE",
      label: "Sécurité incendie",
      keywords: ["incendie", "fire", "extincteur", "évacuation", "sécurité incendie", "feu", "pompier"]
    },
    {
      key: "HABILITATION_ELECTRIQUE",
      label: "Habilitation électrique",
      keywords: ["habilitation électrique", "elec", "électrique", "courant", "installation électrique"]
    },
    {
      key: "SECOURISME",
      label: "Secourisme",
      keywords: ["secourisme", "sst", "sauvetage", "premiers secours", "paramédical", "ambulance"]
    },
    {
      key: "RISQUE_CHANTIER",
      label: "Risque chantier",
      keywords: ["chantier", "risque chantier", "bâtiment", "sécurité chantier", "travail en hauteur", "accident chantier"]
    },
    {
      key: "CONDUCTEUR_APPAREIL_LEVAGE",
      label: "Conducteur appareil de levage",
      keywords: ["appareil de levage", "grue", "chariot élévateur", "pont roulant", "conduite engin", "manutention"]
    }
  ];

  useEffect(() => {
    loadSavedCVs();
  }, []);

  const loadSavedCVs = async () => {
    try {
      const result = await window.api.loadCVDatabase();
      if (result.success) {
        setSavedCVs(result.cvs);
        console.log(`📂 ${result.cvs.length} CVs chargés`);
      }
    } catch (err) {
      console.error("Erreur chargement CVs:", err);
    }
  };

  const checkIfCVExists = async (email, name) => {
    try {
      const result = await window.api.checkCVExists(email, name);
      return result;
    } catch (err) {
      console.error("Erreur vérification doublon:", err);
      return { exists: false };
    }
  };

  const detectDomainsFromText = (text = "") => {
    if (!text) return [];
    const lower = text.toLowerCase();
    const found = [];
    DOMAIN_RULES.forEach(domain => {
      if (domain.keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
        found.push(domain.label);
      }
    });
    return [...new Set(found)];
  };

  const extractNameFromAffinda = (candidateName) => {
    if (!candidateName) return 'Nom non spécifié';
    if (typeof candidateName === 'string') return candidateName.trim();
    if (candidateName.raw && typeof candidateName.raw === 'string') {
      return candidateName.raw.trim();
    }
    if (candidateName.parsed) {
      const parsed = candidateName.parsed;
      const getValue = (field) => {
        if (!field) return '';
        if (typeof field === 'string') return field.trim();
        if (field.value) return String(field.value).trim();
        if (field.label) return String(field.label).trim();
        return '';
      };
      const firstName = getValue(parsed.firstName);
      const middleName = getValue(parsed.middleName);
      const familyName = getValue(parsed.familyName);
      const nameParts = [firstName, middleName, familyName]
        .filter(part => part && part !== '')
        .join(' ');
      if (nameParts) return nameParts;
    }
    return 'Nom non spécifié';
  };

  const extractFieldValue = (field, fieldName = '') => {
    if (!field) return null;
    if (typeof field === 'string' || typeof field === 'number') return field;
    if (field.parsed !== undefined) {
      if (field.parsed === null) return field.raw || null;
      if (typeof field.parsed === 'object' && !Array.isArray(field.parsed)) {
        if (fieldName === 'candidateName' || field.parsed.firstName || field.parsed.familyName) {
          return extractNameFromAffinda(field);
        }
        if (field.parsed.formatted) return field.parsed.formatted;
        if (field.parsed.rawInput || field.parsed.raw_input) {
          return field.parsed.rawInput || field.parsed.raw_input;
        }
        if (field.parsed.formattedNumber || field.parsed.formatted_number) {
          return field.parsed.formattedNumber || field.parsed.formatted_number;
        }
        if (field.parsed.rawText || field.parsed.raw_text) {
          return field.parsed.rawText || field.parsed.raw_text;
        }
        if (field.parsed.start || field.parsed.end) {
          const start = field.parsed.start;
          const end = field.parsed.end;
          let startStr = '';
          let endStr = '';
          if (start) {
            startStr = start.date || start.year || '';
            if (!startStr && start.month && start.year) {
              startStr = `${start.month}/${start.year}`;
            }
          }
          if (end) {
            if (end.isCurrent || end.is_current) {
              endStr = 'Présent';
            } else {
              endStr = end.date || end.year || '';
              if (!endStr && end.month && end.year) {
                endStr = `${end.month}/${end.year}`;
              }
            }
          }
          if (startStr || endStr) {
            return `${startStr} - ${endStr}`.trim().replace(/^-\s*/, '').replace(/\s*-$/, '');
          }
        }
        return null;
      }
      return field.parsed;
    }
    if (field.raw) return field.raw;
    return null;
  };

  const transformAffindaData = (rawData, currentFileContent) => {
    console.log("🔄 Transformation Affinda");

    const name = extractNameFromAffinda(rawData.candidateName);
    const email = rawData.email?.[0] ? extractFieldValue(rawData.email[0]) : null;
    const rawText = rawData.rawText || "";
    const domains = detectDomainsFromText(rawText);
    const mainDomain = domains[0] || "Non déterminé";

    const transformed = {
      id: Date.now().toString(),
      uploadDate: new Date().toISOString(),
      fileName: fileName,
      filePath: filePath,
      fileContent: currentFileContent,
      
      name: name,
      email: email,
      phone: rawData.phoneNumber?.[0] ? extractFieldValue(rawData.phoneNumber[0]) : null,
      location: extractFieldValue(rawData.location),
      dateOfBirth: extractFieldValue(rawData.dateOfBirth),
      totalYearsExperience: Number(extractFieldValue(rawData.totalYearsExperience)) || 0,
      
      domains: domains,
      mainDomain: mainDomain,
      
      // Champ pour stocker le résumé
      summary: null,
      summaryDate: null,
      
      workExperience: (rawData.workExperience || [])
        .map(exp => {
          const p = exp.parsed || {};
          return {
            jobTitle: extractFieldValue(p.workExperienceJobTitle),
            organization: extractFieldValue(p.workExperienceOrganization),
            dates: extractFieldValue(p.workExperienceDates)
          };
        })
        .filter(e => e.jobTitle || e.organization),

      rawText: rawText
    };

    console.log("✅ CV transformé:", {
      name: transformed.name,
      hasFileContent: !!transformed.fileContent,
      fileContentSize: transformed.fileContent?.length
    });
    
    return transformed;
  };

  // Fonction pour convertir base64 en ArrayBuffer
  const base64ToArrayBuffer = (base64Data) => {
    return new Promise((resolve, reject) => {
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        resolve(bytes.buffer);
      } catch (err) {
        reject(err);
      }
    });
  };

  // Fonction pour extraire le buffer depuis fileContent
  const getFileBufferFromContent = async (fileContent) => {
    try {
      // Extraire les données base64 (supprimer le préfixe data:)
      const base64Match = fileContent.match(/^data:.+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error("Format base64 invalide");
      }
      
      const base64Data = base64Match[1];
      return await base64ToArrayBuffer(base64Data);
    } catch (err) {
      console.error("Erreur extraction buffer:", err);
      return null;
    }
  };

  // Fonction optimisée pour générer le résumé (utilise le cache)
  const generateSummary = async (cv) => {
    setLoadingSummary(true);
    setSummaryError('');
    setShowingSummary(null);
    
    try {
      console.log("📝 Vérification résumé pour:", cv.name);
      
      // 1. Vérifier dans la base locale d'abord
      if (cv.summary) {
        console.log("✅ Résumé trouvé en cache local");
        showSummaryModal(cv.name, cv.summary);
        setLoadingSummary(false);
        return;
      }
      
      // 2. Vérifier dans la base de données
      console.log("🔍 Vérification dans la base de données...");
      const result = await window.api.getCVSummary(cv.id);
      
      if (result.success && result.summary) {
        console.log("✅ Résumé trouvé dans la base de données");
        // Mettre à jour le cache local
        const updatedCVs = savedCVs.map(savedCV => 
          savedCV.id === cv.id 
            ? { ...savedCV, summary: result.summary, summaryDate: result.summaryDate } 
            : savedCV
        );
        setSavedCVs(updatedCVs);
        
        showSummaryModal(cv.name, result.summary);
        setLoadingSummary(false);
        return;
      }
      
      // 3. Si aucun résumé n'existe, en générer un nouveau
      console.log("🔧 Génération d'un nouveau résumé...");
      await generateAndSaveNewSummary(cv);
      
    } catch (err) {
      console.error("❌ Erreur génération résumé:", err);
      setSummaryError("Impossible de générer le résumé: " + err.message);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fonction pour générer et sauvegarder un nouveau résumé
  const generateAndSaveNewSummary = async (cv) => {
    try {
      let fileArrayBuffer = null;
      let currentFileName = cv.fileName || 'CV.pdf';
      
      // 1. Essayer avec le CV actuellement analysé (en mémoire)
      if (fileContent && cv.id === cvData?.id) {
        console.log("📄 Utilisation du contenu en mémoire");
        fileArrayBuffer = await getFileBufferFromContent(fileContent);
      }
      // 2. Essayer avec le fileContent stocké dans la base
      else if (cv.fileContent) {
        console.log("📄 Utilisation du contenu de la base");
        fileArrayBuffer = await getFileBufferFromContent(cv.fileContent);
      }
      // 3. Essayer avec le chemin du fichier
      else if (cv.filePath) {
        console.log("📄 Lecture depuis chemin:", cv.filePath);
        const result = await window.api.readFileFromPath(cv.filePath);
        if (result.success) {
          // Convertir le buffer en ArrayBuffer
          const bufferArray = result.buffer;
          fileArrayBuffer = new Uint8Array(bufferArray).buffer;
          currentFileName = result.fileName || currentFileName;
        }
      }
      
      if (!fileArrayBuffer) {
        throw new Error("Impossible de récupérer le fichier CV");
      }
      
      console.log("🔄 Envoi à Affinda Resume Parser...", {
        fileName: currentFileName,
        bufferSize: fileArrayBuffer.byteLength
      });
      
      // Convertir ArrayBuffer en Array pour IPC
      const byteArray = Array.from(new Uint8Array(fileArrayBuffer));
      
      // UTILISATION DU NOUVEAU HANDLER UNIQUE
      const result = await window.api.analyzeCVForSummary({
        buffer: byteArray,
        fileName: currentFileName,
        cvId: cv.id
      });

      if (result.success && result.summary) {
        // Sauvegarder dans la base de données
        await saveCVSummaryToDatabase(cv.id, result.summary);
        
        // Mettre à jour l'état local
        const updatedCVs = savedCVs.map(savedCV => 
          savedCV.id === cv.id 
            ? { ...savedCV, summary: result.summary, summaryDate: new Date().toISOString() }
            : savedCV
        );
        setSavedCVs(updatedCVs);
        
        showSummaryModal(cv.name, result.summary);
      } else {
        setSummaryError("Erreur lors de la génération du résumé: " + (result.error || "Aucun résumé généré"));
      }
    } catch (err) {
      console.error("❌ Erreur génération nouveau résumé:", err);
      throw err;
    }
  };

  // Fonction helper pour afficher le modal
  const showSummaryModal = (name, summary) => {
    setShowingSummary({
      cvName: name,
      summary: summary
    });
  };

  // Fonction pour sauvegarder le résumé dans la base
  const saveCVSummaryToDatabase = async (cvId, summary) => {
    try {
      console.log("💾 Sauvegarde résumé pour CV ID:", cvId);
      
      const result = await window.api.saveCVSummaryToDatabase(cvId, summary);
      
      if (result.success) {
        console.log("✅ Résumé sauvegardé avec succès");
      } else {
        console.error("❌ Erreur sauvegarde résumé:", result.error);
      }
    } catch (err) {
      console.error("❌ Erreur sauvegarde résumé:", err);
    }
  };

  // Fonction pour générer le résumé pendant l'analyse initiale
  const generateSummaryDuringAnalysis = async (file, cvId) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const byteArray = Array.from(new Uint8Array(arrayBuffer));
      
      // UTILISATION DU NOUVEAU HANDLER UNIQUE
      const result = await window.api.analyzeCVForSummary({
        buffer: byteArray,
        fileName: file.name,
        cvId: cvId
      });
      
      if (result.success && result.summary) {
        // Sauvegarder directement dans la base
        await window.api.saveCVSummaryToDatabase(cvId, result.summary);
        return { success: true, summary: result.summary };
      }
      
      return { success: false, error: result.error };
    } catch (err) {
      console.error("Erreur génération résumé analyse:", err);
      return { success: false, error: err.message };
    }
  };

  const analyzeCV = async (file) => {
    setLoading(true);
    setError("");
    setCvData(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Lire le contenu du fichier en base64 pour stockage
      const fileContentData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Erreur lecture fichier"));
        reader.readAsDataURL(file);
      });
      
      console.log("📄 Contenu fichier lu, taille:", fileContentData.length);
      setFileContent(fileContentData);

      // Analyser avec Affinda
      const response = await window.api.analyzeCV({
        buffer: Array.from(new Uint8Array(arrayBuffer)),
        fileName: file.name,
        language: 'fr',
        filePath: file.path
      });

      if (!response.success) {
        setError(response.error || "Échec de l'analyse Affinda");
        return;
      }

      // Transformer les données
      const transformedData = transformAffindaData(response.data, fileContentData);
      
      // GÉNÉRER LE RÉSUMÉ IMMÉDIATEMENT
      console.log("🔍 Génération automatique du résumé...");
      try {
        const summaryResult = await generateSummaryDuringAnalysis(file, transformedData.id);
        if (summaryResult.success && summaryResult.summary) {
          transformedData.summary = summaryResult.summary;
          transformedData.summaryDate = new Date().toISOString();
        }
      } catch (summaryErr) {
        console.warn("⚠️ Échec génération résumé:", summaryErr.message);
      }
      
      // Vérifier doublon
      if (transformedData.email || transformedData.name !== 'Nom non spécifié') {
        const checkResult = await checkIfCVExists(transformedData.email, transformedData.name);
        
        if (checkResult.exists) {
          setCvData(transformedData);
          setLoading(false);
          
          if (window.confirm(
            `${checkResult.message}\n\nVoulez-vous quand même ajouter ce CV ?`
          )) {
            await saveCVToDatabase(transformedData);
          } else {
            alert("CV non ajouté à la base de données.");
          }
          return;
        }
      }
      
      setCvData(transformedData);
      await saveCVToDatabase(transformedData);

    } catch (err) {
      console.error("❌ Erreur analyse CV:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCVToDatabase = async (cvData) => {
    try {
      console.log("💾 Sauvegarde CV:", {
        name: cvData.name,
        hasFileContent: !!cvData.fileContent,
        fileContentSize: cvData.fileContent?.length,
        hasSummary: !!cvData.summary
      });

      const saveResult = await window.api.saveCVToDatabase(cvData);
      if (saveResult.success) {
        await loadSavedCVs();
        alert("✅ CV enregistré avec succès!");
      } else {
        console.error("Erreur sauvegarde:", saveResult.error);
        alert("Erreur lors de la sauvegarde du CV.");
      }
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        setError('Format non supporté. Utilisez PDF, DOC ou DOCX');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('Fichier trop volumineux. Max 10MB');
        return;
      }
      
      setFileName(file.name);
      setFilePath(file.path || file.name);
      await analyzeCV(file);
    }
  };

  const resetAnalysis = () => {
    setCvData(null);
    setError('');
    setFileName('');
    setFilePath('');
    setFileContent(null);
    const fileInput = document.getElementById('cv-input');
    if (fileInput) fileInput.value = '';
  };

  const openOriginalCV = async (cv) => {
    console.log("📂 Ouverture CV:", cv.name);
    
    try {
      if (cv.fileContent) {
        downloadCVFromContent(cv);
        return;
      }
      
      console.log("⚠️ Récupération depuis base...");
      const result = await window.api.getCVContent(cv.id);
      
      if (result.success && result.fileContent) {
        downloadCVFromContent({ ...cv, fileContent: result.fileContent });
      } else {
        alert(`Impossible de trouver le fichier CV.\n\nNom: ${cv.name}`);
      }
      
    } catch (err) {
      console.error("❌ Erreur ouverture CV:", err);
      alert(`Erreur lors du téléchargement: ${err.message}`);
    }
  };

  const downloadCVFromContent = (cv) => {
  try {
    if (!cv.fileContent || !cv.fileContent.startsWith('data:')) {
      throw new Error("Contenu de fichier invalide");
    }
    
    const matches = cv.fileContent.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error("Format base64 invalide");
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const byteCharacters = atob(base64Data);
    const byteArray = new Uint8Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    
    const blob = new Blob([byteArray], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Construire le nom de fichier avec le nom du candidat
    let fileName = '';
    
    // Nettoyer le nom du candidat (supprimer caractères spéciaux)
    const cleanName = (cv.name || 'CV')
      .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, '')
      .replace(/\s+/g, '_')
      .trim();
    
    // Déterminer l'extension selon le mimeType
    let extension = '';
    if (mimeType.includes('pdf')) {
      extension = '.pdf';
    } else if (mimeType.includes('wordprocessingml') || mimeType.includes('docx')) {
      extension = '.docx';
    } else if (mimeType.includes('msword')) {
      extension = '.doc';
    } else {
      // Fallback: essayer d'extraire depuis le fileName original
      const originalExt = cv.fileName?.match(/\.(pdf|docx?|txt)$/i);
      extension = originalExt ? originalExt[0] : '.pdf';
    }
    
    fileName = `CV_${cleanName}${extension}`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    
    console.log(`✅ Téléchargement: ${fileName}`);
    
  } catch (err) {
    console.error("❌ Erreur téléchargement CV:", err);
    alert("Impossible de télécharger le CV.");
  }
};

  const deleteCV = async (cvId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce CV ?')) return;
    
    const result = await window.api.deleteCVFromDatabase(cvId);
    if (result.success) {
      await loadSavedCVs();
      alert('CV supprimé avec succès');
    }
  };

  // Fonction pour exporter en Excel (CSV)
  // Remplacer la fonction d'export existante par celle-ci :
const exportToExcel = () => {
  if (filteredCVs.length === 0) {
    alert("Aucun CV à exporter");
    return;
  }

  // Préparer les en-têtes avec encodage UTF-8 BOM
  const headers = [
    "Nom",
    "Email",
    "Téléphone",
    "Domaine principal",
    "Domaines",
    "Années d'expérience",
    "Localisation"
  ];

  // Préparer les données avec traitement des accents
  const rows = filteredCVs.map(cv => [
    cv.name || '',
    cv.email || '',
    cv.phone || '',
    cv.mainDomain || '',
    (cv.domains || []).join(' | '),
    cv.totalYearsExperience || 0,
    cv.location || ''
  ]);

  // Créer le contenu CSV avec séparateur point-virgule et encodage UTF-8
  let csvContent = '\uFEFF'; // BOM pour UTF-8 (Excel)
  csvContent += headers.join(";") + "\n";
  csvContent += rows.map(row => 
    row.map(cell => {
      // Échapper les cellules contenant des guillemets ou des sauts de ligne
      if (typeof cell === 'string') {
        // Remplacer les accents et caractères spéciaux pour Excel
        const escaped = cell
          .replace(/"/g, '""') // Échapper les guillemets doubles
          .replace(/\n/g, ' ') // Remplacer les sauts de ligne par des espaces
          .replace(/\r/g, ''); // Supprimer les retours chariot
        
        // Encadrer de guillemets si nécessaire
        if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n')) {
          return `"${escaped}"`;
        }
        return escaped;
      }
      return cell;
    }).join(";")
  ).join("\n");

  // Créer le blob avec l'encodage UTF-8
  const blob = new Blob([csvContent], { 
    type: "text/csv;charset=utf-8;" 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  
  // Nom du fichier avec date
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `CV_Database_${dateStr}.csv`;
  a.href = url;
  
  document.body.appendChild(a);
  a.click();
  
  // Nettoyer
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
  
  console.log(`✅ Export Excel terminé: ${filteredCVs.length} CVs exportés`);
};

  // Filtrer les CVs selon les critères
  const filteredCVs = savedCVs.filter(cv => {
    const matchesExperience = minYearsExp ? 
      cv.totalYearsExperience >= parseInt(minYearsExp) : true;
    
    const matchesDomain = selectedDomain
      ? cv.domains?.includes(selectedDomain)
      : true;

    if (!searchQuery) return matchesExperience && matchesDomain;
    
    const query = searchQuery.toLowerCase();
    const matchesName = cv.name?.toLowerCase().includes(query);
    const matchesText = cv.rawText?.toLowerCase().includes(query);
    
    return (matchesName || matchesText) && matchesExperience && matchesDomain;
  });

  return (
    <div className="analyse-cv-container">
      <div className="cv-header">
        <h2>📄 Système de Gestion de CV</h2>
        <p>Analysez, stockez et recherchez des CV par domaine et expérience</p>
        <p className="storage-info">💾 Stockage local: {savedCVs.length} CV(s)</p>
      </div>

      <div className="view-toggle">
        <button 
          className={viewMode === 'analyze' ? 'active' : ''}
          onClick={() => setViewMode('analyze')}
        >
          📤 Analyser CV
        </button>
        <button 
          className={viewMode === 'database' ? 'active' : ''}
          onClick={() => setViewMode('database')}
        >
          🗄️ Base de données ({savedCVs.length})
        </button>
      </div>

      {viewMode === 'analyze' && (
        <>
          <div className="upload-section">
            <label htmlFor="cv-input" className="upload-label">
              <div className="upload-box">
                <span className="upload-icon">📁</span>
                <span className="upload-text">
                  {fileName || 'Cliquez pour sélectionner un CV'}
                </span>
                <span className="upload-hint">PDF, DOC, DOCX (max 10MB)</span>
              </div>
            </label>
            <input
              type="file"
              id="cv-input"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            {cvData && (
              <button className="reset-btn" onClick={resetAnalysis}>
                🔄 Analyser un autre CV
              </button>
            )}
          </div>

          {loading && (
            <div className="loader-section">
              <div className="spinner"></div>
              <p>Analyse en cours...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {cvData && !loading && (
            <div className="results-section">
              <h3>✅ Résultats de l'analyse</h3>
              
              <div className="result-card">
                <div className="result-header">
                  <span className="result-icon">👤</span>
                  <h4>Informations personnelles</h4>
                </div>
                <div className="result-content">
                  <p><strong>Nom:</strong> {cvData.name}</p>
                  {cvData.email && <p><strong>Email:</strong> {cvData.email}</p>}
                  {cvData.phone && <p><strong>Téléphone:</strong> {cvData.phone}</p>}
                  {cvData.location && <p><strong>Localisation:</strong> {cvData.location}</p>}
                  {cvData.dateOfBirth && <p><strong>Date de naissance:</strong> {cvData.dateOfBirth}</p>}
                  <p>
                    <strong>Fichier:</strong> {cvData.fileName || 'Non spécifié'}
                    <button 
                      onClick={() => openOriginalCV(cvData)} 
                      className="file-link-btn"
                    >
                      📄 Télécharger
                    </button>
                  </p>
                </div>
              </div>
              
              <div className="result-card">
                <div className="result-header">
                  <span className="result-icon">⏱️</span>
                  <h4>Expérience professionnelle</h4>
                </div>
                <div className="result-content">
                  <span className="experience-years">{cvData.totalYearsExperience} ans</span>
                  {cvData.workExperience?.length > 0 && (
                    <p className="experience-count">{cvData.workExperience.length} poste(s)</p>
                  )}
                </div>
              </div>

              {cvData.domains?.length > 0 && (
                <div className="result-card">
                  <div className="result-header">
                    <span className="result-icon">🎯</span>
                    <h4>Domaines détectés ({cvData.domains.length})</h4>
                  </div>
                  <div className="result-content">
                    <div className="skills-container">
                      {cvData.domains.map((domain, index) => (
                        <span key={index} className="skill-tag">{domain}</span>
                      ))}
                    </div>
                    {cvData.mainDomain && (
                      <p className="main-domain">
                        <strong>Domaine principal:</strong> {cvData.mainDomain}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {cvData.workExperience?.length > 0 && (
                <div className="result-card">
                  <div className="result-header">
                    <span className="result-icon">📋</span>
                    <h4>Expériences ({cvData.workExperience.length})</h4>
                  </div>
                  <div className="result-content">
                    {cvData.workExperience.map((exp, index) => (
                      <div key={index} className="experience-item">
                        <h5>{exp.jobTitle || 'Poste non spécifié'}</h5>
                        {exp.organization && <p className="organization">{exp.organization}</p>}
                        {exp.dates && <p className="dates">{exp.dates}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === 'database' && (
        <div className="database-section">
          <div className="search-filters">
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="search-input"
            >
              <option value="">🎯 Tous les domaines</option>
              {DOMAIN_RULES.map(d => (
                <option key={d.key} value={d.label}>{d.label}</option>
              ))}
            </select>
            
            <input
              type="number"
              placeholder="Années d'expérience min"
              value={minYearsExp}
              onChange={(e) => setMinYearsExp(e.target.value)}
              className="search-input"
              min="0"
            />
            
        
            
            <button 
              onClick={() => { setSearchQuery(''); setMinYearsExp(''); setSelectedDomain(''); }}
              className="reset-btn"
            >
              🔄 Réinitialiser
            </button>
            
            <button className="reset-btn" onClick={exportToExcel}>
              📤 Exporter Excel
            </button>
          </div>

          <div className="cv-list">
            <h3>📊 {filteredCVs.length} CV trouvé(s)</h3>
            {filteredCVs.map((cv) => (
              <div key={cv.id} className="cv-card">
                <div className="cv-card-header">
                  <div>
                    <h4>{cv.name}</h4>
                    <div className="cv-meta">
                      <span className="cv-date">📅 {new Date(cv.uploadDate).toLocaleDateString()}</span>
                      <span className="cv-exp">⏱️ {cv.totalYearsExperience} ans</span>
                      {cv.summary && (
                        <span className="cv-has-summary" title="Résumé disponible">
                          📝
                        </span>
                      )}
                    </div>
                    {cv.email && <div className="cv-email">{cv.email}</div>}
                    {cv.mainDomain && <div className="cv-domain">🎯 {cv.mainDomain}</div>}
                  </div>
                  <div className="cv-actions">
                    <button 
                      onClick={() => setEditingCV(cv)}
                      className="action-btn edit"
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => generateSummary(cv)} 
                      className="action-btn summary"
                      title={cv.summary ? "Voir le résumé" : "Générer résumé"}
                      disabled={loadingSummary}
                    >
                      {cv.summary ? '📋' : '📝'}
                    </button>
                    <button 
                      onClick={() => openOriginalCV(cv)} 
                      className="action-btn download"
                      title="Télécharger CV"
                    >
                      📄
                    </button>
                    <button 
                      onClick={() => deleteCV(cv.id)} 
                      className="action-btn delete"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="cv-card-body">
                  {cv.location && <p>📍 {cv.location}</p>}
                  {cv.phone && <p>📱 {cv.phone}</p>}
                  
                  {cv.domains?.length > 0 && (
                    <div className="cv-domains">
                      <strong>Domaines:</strong>
                      <div className="domains-tags">
                        {cv.domains.slice(0, 5).map((domain, i) => (
                          <span key={i} className="domain-tag-small">{domain}</span>
                        ))}
                        {cv.domains.length > 5 && (
                          <span className="domain-tag-small">+{cv.domains.length - 5}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {cv.workExperience?.length > 0 && (
                    <div className="cv-experience">
                      <strong>Dernier poste:</strong>
                      <p className="last-job">
                        {cv.workExperience[0]?.jobTitle || 'Non spécifié'}
                        {cv.workExperience[0]?.organization && ` - ${cv.workExperience[0].organization}`}
                      </p>
                    </div>
                  )}
                  
                  {cv.summaryDate && (
                    <div className="cv-summary-info">
                      <small>Résumé généré le: {new Date(cv.summaryDate).toLocaleDateString()}</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {filteredCVs.length === 0 && (
              <div className="no-results">
                <p>Aucun CV trouvé</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL RÉSUMÉ */}
      {showingSummary && (
        <div className="summary-modal" onClick={() => setShowingSummary(null)}>
          <div className="summary-content" onClick={(e) => e.stopPropagation()}>
            <div className="summary-header">
              <h3>📝 Résumé - {showingSummary.cvName}</h3>
              <button onClick={() => setShowingSummary(null)} className="close-btn">✕</button>
            </div>
            <div className="summary-body">
              <pre className="summary-text">{showingSummary.summary}</pre>
            </div>
            <div className="summary-footer">
              <small>Ce résumé est stocké dans la base de données pour une réutilisation ultérieure</small>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉDITION CV */}
      {editingCV && (
        <div className="summary-modal" onClick={() => setEditingCV(null)}>
          <div className="summary-content" onClick={(e) => e.stopPropagation()}>
            <div className="summary-header">
              <h3>✏️ Modifier le profil</h3>
              <button onClick={() => setEditingCV(null)} className="close-btn">✕</button>
            </div>
            <div className="summary-body">
              <div className="edit-form">
                <div className="form-group">
                  <label>Nom</label>
                  <input
                    value={editingCV.name}
                    onChange={e => setEditingCV({ ...editingCV, name: e.target.value })}
                    placeholder="Nom"
                    className="search-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Email</label>
                  <input
                    value={editingCV.email || ''}
                    onChange={e => setEditingCV({ ...editingCV, email: e.target.value })}
                    placeholder="Email"
                    className="search-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Téléphone</label>
                  <input
                    value={editingCV.phone || ''}
                    onChange={e => setEditingCV({ ...editingCV, phone: e.target.value })}
                    placeholder="Téléphone"
                    className="search-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Localisation</label>
                  <input
                    value={editingCV.location || ''}
                    onChange={e => setEditingCV({ ...editingCV, location: e.target.value })}
                    placeholder="Localisation"
                    className="search-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Années d'expérience</label>
                  <input
                    type="number"
                    value={editingCV.totalYearsExperience || 0}
                    onChange={e => setEditingCV({ ...editingCV, totalYearsExperience: parseInt(e.target.value) || 0 })}
                    placeholder="Années d'expérience"
                    className="search-input"
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label>Domaine principal</label>
                  <select
                    value={editingCV.mainDomain}
                    onChange={e => setEditingCV({ ...editingCV, mainDomain: e.target.value })}
                    className="search-input"
                  >
                    <option value="">Sélectionner un domaine</option>
                    {DOMAIN_RULES.map(d => (
                      <option key={d.key} value={d.label}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="summary-footer">
              <button
                className="reset-btn"
                onClick={async () => {
                  try {
                    const result = await window.api.updateCV(editingCV);
                    if (result.success) {
                      await loadSavedCVs();
                      setEditingCV(null);
                      alert("✅ Profil mis à jour avec succès!");
                    } else {
                      alert("❌ Erreur lors de la mise à jour: " + result.error);
                    }
                  } catch (err) {
                    console.error("Erreur mise à jour CV:", err);
                    alert("❌ Erreur lors de la mise à jour");
                  }
                }}
              >
                💾 Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingSummary && (
        <div className="summary-loading">
          <div className="spinner"></div>
          <p>Génération du résumé...</p>
        </div>
      )}

      {summaryError && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{summaryError}</span>
          <button onClick={() => setSummaryError('')} className="close-error-btn">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default AnalyseCV;