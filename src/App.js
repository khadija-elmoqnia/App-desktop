import React, { useState } from 'react';
import './App.css';
import GenerationFacture from './components/GenerationFacture';
import AnalyseCV from './components/AnalyseCV';
import AnalyseRecu from './components/AnalyseRecu';

function App() {
  const [activePage, setActivePage] = useState('cv'); // Page par défaut

  // Fonction pour rendre la page active en plein écran
  const renderPage = () => {
    switch(activePage) {
      case 'factures':
        return <GenerationFacture onNavigate={setActivePage} />;
      case 'cv':
        return <AnalyseCV onNavigate={setActivePage} />;
      case 'analyse':
        return <AnalyseRecu onNavigate={setActivePage} />;
      default:
        return <AnalyseCV onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="App">
      {/* Sidebar de navigation fixe */}
      <aside className="App-sidebar">
        <div className="sidebar-header">
          <h2>📊 DocManager</h2>
          <p className="version">v1.0.0</p>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={activePage === 'factures' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActivePage('factures')}
          >
            <span className="nav-icon">📄</span>
            <span className="nav-label">Factures</span>
          </button>

          <button 
            className={activePage === 'cv' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActivePage('cv')}
          >
            <span className="nav-icon">👔</span>
            <span className="nav-label">Analyse CV</span>
          </button>

          <button 
            className={activePage === 'analyse' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActivePage('analyse')}
          >
            <span className="nav-icon">💰</span>
            <span className="nav-label">Analyse Reçus</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>Développé avec ❤️</p>
          <p className="email">khadijamoqnia73@gmail.com</p>
        </div>
      </aside>

      {/* Contenu principal - PLEINE PAGE */}
      <main className="App-main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;