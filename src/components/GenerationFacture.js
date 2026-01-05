import React, { useState } from 'react';
import { Document, Packer, Paragraph, TextRun, Table, VerticalAlign ,TableRow, TableCell, WidthType, AlignmentType, BorderStyle} from "docx";
import { saveAs } from "file-saver";

function GenerationFacture() {
  const isElectron = () => {
    return window && window.process && window.process.type;
  };

  const [formData, setFormData] = useState({
    numeroFacture: '',
    dateFacture: new Date().toISOString().split('T')[0],
    nomClient: '',
    adresseClient: '',
    villeClient: '',
    numeroICE: '',
    intitule: '',
    tauxTVA: 20,
    numeroBC: ''
  });

  const [lignes, setLignes] = useState([
    { designation: '', quantite: 1, prixUnitaire: 0 }
  ]);

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loadingWord, setLoadingWord] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLigneChange = (index, field, value) => {
    const newLignes = [...lignes];
    newLignes[index][field] = value;
    setLignes(newLignes);
  };

  const ajouterLigne = () => {
    setLignes([...lignes, { designation: '', quantite: 1, prixUnitaire: 0 }]);
  };

  const supprimerLigne = (index) => {
    if (lignes.length > 1) {
      const newLignes = lignes.filter((_, i) => i !== index);
      setLignes(newLignes);
    }
  };

  const nombreEnLettres = (nombre) => {
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];

    const convertirPartieEntiere = (num) => {
      if (num === 0) return '';

      let result = '';

      if (num >= 1000000) {
        const millions = Math.floor(num / 1000000);
        if (millions === 1) {
          result += 'un million ';
        } else {
          result += convertirPartieEntiere(millions) + ' millions ';
        }
        num = num % 1000000;
      }

      if (num >= 1000) {
        const milliers = Math.floor(num / 1000);
        if (milliers === 1) {
          result += 'mille ';
        } else {
          result += convertirPartieEntiere(milliers) + ' mille ';
        }
        num = num % 1000;
      }

      if (num >= 100) {
        const c = Math.floor(num / 100);
        if (c === 1) {
          result += 'cent ';
        } else {
          result += unites[c] + ' cent ';
        }
        num = num % 100;
      }

      if (num >= 20) {
        const d = Math.floor(num / 10);
        const u = num % 10;
        
        if (d === 7 || d === 9) {
          result += dizaines[d] + '-';
          if (u === 0) {
            result += 'dix';
          } else {
            result += teens[u];
          }
        } else {
          result += dizaines[d];
          if (u === 1 && d !== 8) {
            result += ' et un';
          } else if (u > 0) {
            result += '-' + unites[u];
          } else if (d === 8) {
            result += 's';
          }
        }
      } else if (num >= 10) {
        result += teens[num - 10];
      } else if (num > 0) {
        result += unites[num];
      }

      return result.trim();
    };

    if (nombre === 0) return 'zéro dirham';

    const partieEntiere = Math.floor(nombre);
    const decimales = Math.round((nombre - partieEntiere) * 100);

    let resultat = convertirPartieEntiere(partieEntiere);
    
    resultat = resultat.charAt(0).toUpperCase() + resultat.slice(1);
    
    if (partieEntiere > 1) {
      resultat += ' dirhams';
    } else if (partieEntiere === 1) {
      resultat += ' dirham';
    }

    // Gestion des centimes
    if (decimales > 0) {
      resultat += ' et ' + convertirPartieEntiere(decimales);
      if (decimales > 1) {
        resultat += ' centimes';
      } else {
        resultat += ' centime';
      }
    } else {
      // Si les centimes sont égaux à zéro (ex: 200.00)
      resultat += ' et zéro centime';
    }

    return resultat;
  };

  const calculerTotal = () => {
    const tauxTVA = Number(formData.tauxTVA) || 0;
    
    let sousTotal = 0;
    lignes.forEach(ligne => {
      const quantite = Number(ligne.quantite) || 0;
      const prixUnitaire = Number(ligne.prixUnitaire) || 0;
      sousTotal += quantite * prixUnitaire;
    });
    
    const montantTVA = sousTotal * (tauxTVA / 100);
    const total = sousTotal + montantTVA;
    return { sousTotal, montantTVA, total };
  };

  const formatNombre = (nombre) => {
    return nombre.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

 const genererDocumentWord = async () => {
    try {
      setLoadingWord(true);
      setMessage({ type: '', text: '' });

      if (!formData.nomClient || !formData.numeroFacture) {
        setMessage({ type: 'error', text: 'Veuillez remplir tous les champs obligatoires' });
        setLoadingWord(false);
        return;
      }

      const { sousTotal, montantTVA, total } = calculerTotal();
      const montantLettres = nombreEnLettres(total);

      const children = [];

      // Titre - Agrandi
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `FACTURE : N° ${formData.numeroFacture}`,
              bold: true,
              size: 20, // Augmenté de 28 à 32
              font: "Arial",
            }),
          ],
          spacing: { after: 250 }, // Augmenté
        })
      );

      // Informations - Agrandies
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Date : ${formData.dateFacture}`, size: 24, font: "Arial" })], // Augmenté
        })
      );

      if (formData.numeroBC) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `N° BC : ${formData.numeroBC}`, size: 24, font: "Arial" })], // Augmenté
            spacing: { after: 350 }, // Augmenté
          })
        );
      }

      // Client - Agrandi
      children.push(
        new Paragraph({
          children: [new TextRun({ text: formData.nomClient, size: 24, font: "Arial", bold: true })], // Augmenté
          alignment: AlignmentType.RIGHT,
        })
      );

      if (formData.adresseClient) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: formData.adresseClient, size: 24, font: "Arial" })], // Augmenté
            alignment: AlignmentType.RIGHT,
          })
        );
      }

      if (formData.villeClient) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: formData.villeClient, size: 24, font: "Arial" })], // Augmenté
            alignment: AlignmentType.RIGHT,
          })
        );
      }

      if (formData.numeroICE) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `N° ICE : ${formData.numeroICE}`, size: 24, font: "Arial" })], // Augmenté
            alignment: AlignmentType.RIGHT,
            spacing: { after: 350 }, // Augmenté
          })
        );
      }

      // Intitulé - Agrandi
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Intitulé : ", bold: true, size: 24, font: "Arial" }), // Augmenté
            new TextRun({ text: formData.intitule || "Audit ...", size: 24, font: "Arial" }), // Augmenté
          ],
          spacing: { after: 450 }, // Augmenté
        })
      );

      // Tableau principal - Agrandi avec alignement à droite pour les montants
      const tableauRows = [
        new TableRow({
          tableHeader: true,
          height: { value: 600, rule: "atLeast" }, // Hauteur augmentée
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Quantité", bold: true, size: 22 })], // Augmenté
                alignment: AlignmentType.CENTER, // Centrer l'en-tête quantité
              })],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: "E6F2FF" },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Désignation", bold: true, size: 22 })] // Augmenté
              })],
              width: { size: 45, type: WidthType.PERCENTAGE },
              shading: { fill: "E6F2FF" },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Prix unitaire HT", bold: true, size: 22 })], // Augmenté
                alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
              })],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: "E6F2FF" },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Total HT", bold: true, size: 22 })], // Augmenté
                alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
              })],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: "E6F2FF" },
            }),
          ],
        }),
      ];

      lignes.forEach((ligne) => {
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prixUnitaire) || 0;
        const totalLigne = qte * pu;

        tableauRows.push(
          new TableRow({
            height: { value: 500, rule: "atLeast" }, // Hauteur augmentée
            children: [
              new TableCell({ 
                children: [new Paragraph({
                  children: [new TextRun({ text: qte.toFixed(2), size: 20 })], // Augmenté
                  alignment: AlignmentType.CENTER, // Centrer les quantités
                })] 
              }),
              new TableCell({ 
                children: [new Paragraph({
                  children: [new TextRun({ text: ligne.designation || "", size: 20 })] // Augmenté
                })] 
              }),
              new TableCell({ 
                children: [new Paragraph({
                  children: [new TextRun({ text: formatNombre(pu), size: 20 })], // Augmenté
                  alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
                })] 
              }),
              new TableCell({ 
                children: [new Paragraph({
                  children: [new TextRun({ text: formatNombre(totalLigne), size: 20 })], // Augmenté
                  alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
                })] 
              }),
            ],
          })
        );
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableauRows,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2 }, // Épaisseur augmentée
            bottom: { style: BorderStyle.SINGLE, size: 2 }, // Épaisseur augmentée
            left: { style: BorderStyle.SINGLE, size: 2 }, // Épaisseur augmentée
            right: { style: BorderStyle.SINGLE, size: 2 }, // Épaisseur augmentée
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      );

      children.push(new Paragraph({ text: "", spacing: { after: 350 } })); // Augmenté

      // Totaux - Agrandi avec alignement à droite pour les montants
      children.push(
        new Table({
          width: { size: 40, type: WidthType.PERCENTAGE },
          alignment: AlignmentType.RIGHT,
          rows: [
            new TableRow({
              height: { value: 400, rule: "atLeast" }, // Hauteur augmentée
              children: [
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: "Total Hors Taxes", size: 20 })] // Augmenté
                  })] 
                }),
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: formatNombre(sousTotal), size: 20 })], // Augmenté
                    alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
                  })] 
                }),
              ],
            }),
            new TableRow({
              height: { value: 400, rule: "atLeast" }, // Hauteur augmentée
              children: [
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: `TVA ${formData.tauxTVA || 20}%`, size: 20 })] // Augmenté
                  })] 
                }),
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: formatNombre(montantTVA), size: 20 })], // Augmenté
                    alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
                  })] 
                }),
              ],
            }),
            new TableRow({
              height: { value: 450, rule: "atLeast" }, // Hauteur augmentée
              children: [
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: "Total TTC", bold: true, size: 22 })] // Augmenté
                  })] 
                }),
                new TableCell({ 
                  children: [new Paragraph({
                    children: [new TextRun({ text: formatNombre(total), bold: true, size: 22 })], // Augmenté
                    alignment: AlignmentType.RIGHT, // ALIGNER À DROITE
                  })] 
                }),
              ],
            }),
          ],
        })
      );

      children.push(new Paragraph({ text: "", spacing: { after: 450 } })); // Augmenté

      // Montant en lettres - Agrandi
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Le montant de la facture est de ${montantLettres}.`, size: 24 })], // Augmenté
          spacing: { after: 450 }, // Augmenté
        })
      );

// RIB sous forme de texte - Souligné
children.push(
  new Paragraph({
    children: [new TextRun({ 
      text: "Relevé d'Identité Bancaire (RIB) : ", 
      size: 22,
      underline: {},
      bold: true
    })],
    spacing: { after: 350 },
  })
);


// RIB - Tableau avec 4 lignes
children.push(
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Ligne 1: Domiciliation (1ère cellule fusionnée sur 2 colonnes, 2ème cellule fusionnée sur 3 colonnes)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Domiciliation :",
                    size: 16,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 3,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Banque populaire",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
        ],
      }),
      
      // Ligne 2: Agence (1ère cellule fusionnée sur 2 colonnes, 2ème cellule fusionnée sur 3 colonnes)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Agence :",
                    size: 16,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 3,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "OULAD HADDOU",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
        ],
      }),
      
      // Ligne 3: En-têtes RIB (5 cellules)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Code Banque",
                    size: 14,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Code Ville",
                    size: 14,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Code Guichet",
                    size: 14,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Numéro de Compte",
                    size: 14,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Clé RIB",
                    size: 14,
                    color: "666666"
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
        ],
      }),
      
      // Ligne 4: Valeurs RIB (5 cellules)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "190",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "780",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "212",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "1142403260003",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "35",
                    size: 16
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
              }),
            ],
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    },
  })
);
 





      // Création du document
      const doc = new Document({
        sections: [
          {
            properties: {
              page: { 
                margin: { 
                  top: 1200, // Augmenté
                  right: 1200, // Augmenté
                  bottom: 1200, // Augmenté
                  left: 1200  // Augmenté
                } 
              },
            },
            children,
          },
        ],
      });

      // Génération du fichier
      const blob = await Packer.toBlob(doc);
      const filename = `facture ${formData.numeroFacture} - ES PREVENTION ${new Date().getFullYear()}.docx`;

      if (isElectron()) {
        const { ipcRenderer } = window.require("electron");
        const arrayBuffer = await blob.arrayBuffer();
        
        const result = await ipcRenderer.invoke(
          "save-docx", 
          Buffer.from(arrayBuffer), 
          filename
        );

        if (result.success) {
          setMessage({ type: "success", text: `Document Word enregistré: ${result.path}` });
        } else {
          setMessage({ type: "error", text: result.message });
        }
      } else {
        saveAs(blob, filename);
      }

    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    } finally {
      setLoadingWord(false);
    }
  };

  const { sousTotal, montantTVA, total } = calculerTotal();

  return (
    <div style={{ 
      padding: '15px',
      background: '#0f172a',
      minHeight: '100vh'
    }}>
      
      {message.text && (
        <div style={{ 
          padding: '10px',
          marginBottom: '15px',
          borderRadius: '6px',
          background: message.type === 'error' ? '#7f1d1d' : '#065f46',
          color: '#f1f5f9',
          fontSize: '0.9em'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ 
        background: '#1e293b', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #334155'
      }}>
        {/* FORMULAIRE PRINCIPAL - Version compacte */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '15px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              N° Facture *
            </label>
            <input 
              type="text" 
              name="numeroFacture"
              value={formData.numeroFacture}
              onChange={handleChange}
              placeholder="Ex: 332/25"
              required
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              Date *
            </label>
            <input 
              type="date" 
              name="dateFacture"
              value={formData.dateFacture}
              onChange={handleChange}
              required
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              N°BC
            </label>
            <input 
              type="text" 
              name="numeroBC"
              value={formData.numeroBC}
              onChange={handleChange}
              placeholder="Ex: BC00123"
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              N° ICE
            </label>
            <input 
              type="text" 
              name="numeroICE"
              value={formData.numeroICE}
              onChange={handleChange}
              placeholder="000000000000000"
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '15px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              Nom Client *
            </label>
            <input 
              type="text" 
              name="nomClient"
              value={formData.nomClient}
              onChange={handleChange}
              placeholder="Ex: Société XXXX"
              required
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              Adresse
            </label>
            <input 
              type="text" 
              name="adresseClient"
              value={formData.adresseClient}
              onChange={handleChange}
              placeholder="Rue, Ville"
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              Ville
            </label>
            <input 
              type="text" 
              name="villeClient"
              value={formData.villeClient}
              onChange={handleChange}
              placeholder="Ex: Rabat"
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
            Intitulé *
          </label>
          <textarea 
            name="intitule"
            value={formData.intitule}
            onChange={handleChange}
            placeholder="Ex: audit de conformité réglementaire..."
            rows="2"
            required
            style={{
              padding: '10px', // Augmenté
              borderRadius: '4px',
              border: '1px solid #475569',
              width: '100%',
              fontSize: '1em', // Augmenté
              background: '#0f172a',
              color: '#f1f5f9',
              resize: 'vertical',
              minHeight: '60px' // Augmenté
            }}
          />
        </div>

        {/* Section TVA compacte */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 3fr',
          gap: '12px',
          marginBottom: '15px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#94a3b8' }}>
              TVA (%)
            </label>
            <input 
              type="number" 
              name="tauxTVA"
              value={formData.tauxTVA}
              onChange={handleChange}
              min="0"
              max="100"
              style={{
                padding: '10px', // Augmenté
                borderRadius: '4px',
                border: '1px solid #475569',
                width: '100%',
                fontSize: '1em', // Augmenté
                background: '#0f172a',
                color: '#f1f5f9'
              }}
            />
          </div>
          
          {/* Espace vide ou autre info */}
          <div></div>
        </div>

        {/* Section Lignes du tableau - Version plus grande */}
        <div style={{ 
          background: '#0f172a', 
          padding: '20px', // Augmenté
          borderRadius: '6px',
          border: '1px solid #334155',
          marginBottom: '15px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '15px' // Augmenté
          }}>
            <span style={{ color: '#60a5fa', fontSize: '1.1em', fontWeight: '500' }}>Lignes de la facture</span>
            <button 
              type="button"
              onClick={ajouterLigne}
              style={{ 
                padding: '8px 16px', // Augmenté
                fontSize: '0.9em', // Augmenté
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              + Ajouter ligne
            </button>
          </div>

          {lignes.map((ligne, index) => (
            <div key={index} style={{ 
              background: '#1e293b',
              padding: '15px', // Augmenté
              borderRadius: '4px',
              marginBottom: '12px', // Augmenté
              border: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9em' }}>Ligne {index + 1}</span>
                {lignes.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => supprimerLigne(index)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '1.2em',
                      padding: '2px'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <input 
                    type="text"
                    value={ligne.designation}
                    onChange={(e) => handleLigneChange(index, 'designation', e.target.value)}
                    placeholder="Désignation *"
                    required
                    style={{
                      padding: '10px', // Augmenté
                      borderRadius: '4px',
                      border: '1px solid #475569',
                      width: '100%',
                      fontSize: '1em', // Augmenté
                      background: '#0f172a',
                      color: '#f1f5f9'
                    }}
                  />
                </div>

                <div>
                  <input 
                    type="number"
                    value={ligne.quantite}
                    onChange={(e) => handleLigneChange(index, 'quantite', e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder="Qté"
                    style={{
                      padding: '10px', // Augmenté
                      borderRadius: '4px',
                      border: '1px solid #475569',
                      width: '100%',
                      fontSize: '1em', // Augmenté
                      background: '#0f172a',
                      color: '#f1f5f9'
                    }}
                  />
                </div>

                <div>
                  <input 
                    type="number"
                    value={ligne.prixUnitaire}
                    onChange={(e) => handleLigneChange(index, 'prixUnitaire', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Prix (MAD)"
                    style={{
                      padding: '10px', // Augmenté
                      borderRadius: '4px',
                      border: '1px solid #475569',
                      width: '100%',
                      fontSize: '1em', // Augmenté
                      background: '#0f172a',
                      color: '#f1f5f9'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ 
                marginTop: '10px', // Augmenté
                textAlign: 'right', 
                color: '#60a5fa',
                fontSize: '1em' // Augmenté
              }}>
                Total: {formatNombre((Number(ligne.quantite) || 0) * (Number(ligne.prixUnitaire) || 0))} MAD
              </div>
            </div>
          ))}
        </div>

        {/* Totaux - Version plus grande */}
        <div style={{ 
          background: '#0f172a', 
          padding: '15px', // Augmenté
          borderRadius: '6px', 
          marginBottom: '15px',
          border: '1px solid #334155'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '1em' // Augmenté
          }}>
            <div>
              <div style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '1.05em' }}>Sous-total HT:</div>
              <div style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '1.05em' }}>TVA ({formData.tauxTVA}%):</div>
              <div style={{ color: '#60a5fa', fontWeight: '500', marginTop: '10px', fontSize: '1.2em' }}>TOTAL TTC:</div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#f1f5f9', marginBottom: '8px', fontSize: '1.05em' }}>{formatNombre(sousTotal)} MAD</div>
              <div style={{ color: '#f1f5f9', marginBottom: '8px', fontSize: '1.05em' }}>{formatNombre(montantTVA)} MAD</div>
              <div style={{ color: '#60a5fa', fontWeight: '600', marginTop: '10px', fontSize: '1.2em' }}>{formatNombre(total)} MAD</div>
            </div>
          </div>
          
          <div style={{ 
            marginTop: '12px', 
            fontSize: '0.95em', // Légèrement augmenté
            color: '#94a3b8', 
            fontStyle: 'italic',
            borderTop: '1px solid #334155',
            paddingTop: '10px'
          }}>
            {nombreEnLettres(total)}
          </div>
        </div>

        {/* Bouton d'export Word */}
        <div style={{ textAlign: 'center' }}>
          <button 
            type="button"
            onClick={genererDocumentWord}
            style={{ 
              padding: '12px 30px', // Augmenté
              fontSize: '1.05em', // Augmenté
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: '500',
              width: '100%'
            }}
            disabled={loadingWord}
            onMouseOver={(e) => e.target.style.opacity = '0.9'}
            onMouseOut={(e) => e.target.style.opacity = '1'}
          >
            {loadingWord ? '⏳ Génération en cours...' : '📄 Générer le document Word'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GenerationFacture;