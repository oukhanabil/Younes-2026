// data.js - Version simplifiée et garantie fonctionnelle

// Données de test
const agents = [
    { code: 'AG001', nom: 'Dupont', prenom: 'Jean', groupe: 'A', tel: '0612345678', poste: 'Agent', statut: 'actif' },
    { code: 'AG002', nom: 'Martin', prenom: 'Sophie', groupe: 'B', tel: '0623456789', poste: 'Superviseur', statut: 'actif' },
    { code: 'AG003', nom: 'Bernard', prenom: 'Pierre', groupe: 'C', tel: '0634567890', poste: 'Agent', statut: 'actif' },
    { code: 'AG004', nom: 'Petit', prenom: 'Marie', groupe: 'D', tel: '0645678901', poste: 'Chef', statut: 'actif' },
    { code: 'AG005', nom: 'Robert', prenom: 'Luc', groupe: 'E', tel: '0656789012', poste: 'Agent', statut: 'actif' }
];

// Données de planning vides
const planningData = {};

// Jours fériés
const holidays = [];

// Autres données
const panicCodes = [];
const radios = [];
const uniforms = [];
const warnings = [];
const leaves = [];
const radioHistory = [];

// Constantes
const JOURS_FRANCAIS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SHIFT_LABELS = { '1': 'Matin', '2': 'Après-midi', '3': 'Nuit', 'R': 'Repos', 'C': 'Congé', 'M': 'Maladie', 'A': 'Autre', '-': 'Non défini' };
const SHIFT_COLORS = { '1': '#3498db', '2': '#e74c3c', '3': '#9b59b6', 'R': '#2ecc71', 'C': '#f39c12', 'M': '#e67e22', 'A': '#95a5a6', '-': '#7f8c8d' };

// Exporter vers window pour garantir l'accès
window.agents = agents;
window.planningData = planningData;
window.holidays = holidays;
window.panicCodes = panicCodes;
window.radios = radios;
window.uniforms = uniforms;
window.warnings = warnings;
window.leaves = leaves;
window.radioHistory = radioHistory;
window.JOURS_FRANCAIS = JOURS_FRANCAIS;
window.SHIFT_LABELS = SHIFT_LABELS;
window.SHIFT_COLORS = SHIFT_COLORS;

console.log("✅ data.js chargé avec", agents.length, "agents");
