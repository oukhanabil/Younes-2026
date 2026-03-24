// app.js - VERSION COMPLÈTE CORRIGÉE
// Système de Gestion des Agents (SGA) - CleanCo Service

// ==================== CONSTANTES GLOBALES ====================

// Ces constantes sont également définies dans data.js, mais nous les redéfinissons
// pour garantir leur disponibilité même si data.js n'est pas chargé
const JOURS_FRANCAIS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const SHIFT_LABELS = {
    '1': 'Matin',
    '2': 'Après-midi',
    '3': 'Nuit',
    'R': 'Repos',
    'C': 'Congé',
    'M': 'Maladie',
    'A': 'Autre absence',
    '-': 'Non défini'
};

const SHIFT_COLORS = {
    '1': '#3498db',
    '2': '#e74c3c',
    '3': '#9b59b6',
    'R': '#2ecc71',
    'C': '#f39c12',
    'M': '#e67e22',
    'A': '#95a5a6',
    '-': '#7f8c8d'
};

const WARNING_TYPES = {
    ORAL: { label: 'Avertissement Oral', color: '#f39c12', severity: 1 },
    ECRIT: { label: 'Avertissement Écrit', color: '#e74c3c', severity: 2 },
    MISE_A_PIED: { label: 'Mise à pied', color: '#c0392b', severity: 3 }
};

// Variables globales (seront remplies par data.js ou localStorage)
let agents = [];
let planningData = {};
let holidays = [];
let panicCodes = [];
let radios = [];
let uniforms = [];
let warnings = [];
let leaves = [];
let radioHistory = [];
let auditLog = [];

const DATE_AFFECTATION_BASE = new Date('2025-11-01');

// ==================== FONCTIONS UTILITAIRES ====================

function getMonthName(month) {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return months[month - 1] || '';
}

function isHolidayDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(h => h.date === dateStr);
}

function getShiftForAgent(agentCode, dateStr) {
    const monthKey = dateStr.substring(0, 7);
    if (planningData[monthKey] && planningData[monthKey][agentCode] && planningData[monthKey][agentCode][dateStr]) {
        return planningData[monthKey][agentCode][dateStr].shift;
    }
    return calculateTheoreticalShift(agentCode, dateStr);
}

function calculateTheoreticalShift(agentCode, dateStr) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent || agent.statut !== 'actif') return '-';
    
    const date = new Date(dateStr);
    const group = agent.groupe;
    
    if (group === 'E') {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'R';
        const dayNum = date.getDate();
        return dayNum % 2 === 0 ? '1' : '2';
    } else {
        const daysSinceStart = Math.floor((date - DATE_AFFECTATION_BASE) / (1000 * 60 * 60 * 24));
        let groupOffset = 0;
        switch(group) {
            case 'A': groupOffset = 0; break;
            case 'B': groupOffset = 2; break;
            case 'C': groupOffset = 4; break;
            case 'D': groupOffset = 6; break;
            default: groupOffset = 0;
        }
        const cycleDay = (daysSinceStart + groupOffset) % 8;
        switch(cycleDay) {
            case 0: case 1: return '1';
            case 2: case 3: return '2';
            case 4: case 5: return '3';
            case 6: case 7: return 'R';
            default: return '-';
        }
    }
}

function calculateAgentStats(agentCode, month, year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const stats = { '1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0, '-': 0 };
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const shift = getShiftForAgent(agentCode, dateStr);
        if (stats[shift] !== undefined) stats[shift]++;
    }
    
    return [
        { label: 'Matin (1)', value: stats['1'] },
        { label: 'Après-midi (2)', value: stats['2'] },
        { label: 'Nuit (3)', value: stats['3'] },
        { label: 'Repos (R)', value: stats['R'] },
        { label: 'Congés (C)', value: stats['C'] + stats['M'] + stats['A'] },
        { label: 'Jours total', value: daysInMonth }
    ];
}

function calculateAgentDetailedStats(agentCode, startDate, endDate) {
    const stats = {
        totalDays: 0,
        workedDays: 0,
        shifts: { '1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0, '-': 0 },
        leaves: 0,
        sickDays: 0,
        otherAbsences: 0,
        weekendDays: 0,
        holidayDays: 0,
        modifiedShifts: 0,
        exchanges: 0
    };
    
    const current = new Date(startDate);
    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const shift = getShiftForAgent(agentCode, dateStr);
        
        stats.totalDays++;
        if (stats.shifts[shift] !== undefined) stats.shifts[shift]++;
        
        if (shift === 'C') stats.leaves++;
        if (shift === 'M') stats.sickDays++;
        if (shift === 'A') stats.otherAbsences++;
        
        if (current.getDay() === 0 || current.getDay() === 6) stats.weekendDays++;
        if (isHolidayDate(current)) stats.holidayDays++;
        
        const monthKey = dateStr.substring(0, 7);
        if (planningData[monthKey] && planningData[monthKey][agentCode] && planningData[monthKey][agentCode][dateStr]) {
            const record = planningData[monthKey][agentCode][dateStr];
            if (record.type === 'modification_manuelle') stats.modifiedShifts++;
            else if (record.type === 'echange' || record.type === 'echange_reciproque') stats.exchanges++;
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    stats.workedDays = stats.shifts['1'] + stats.shifts['2'] + stats.shifts['3'];
    stats.workRate = stats.totalDays > 0 ? ((stats.workedDays / stats.totalDays) * 100).toFixed(1) : 0;
    stats.absenceRate = stats.totalDays > 0 ? (((stats.leaves + stats.sickDays + stats.otherAbsences) / stats.totalDays) * 100).toFixed(1) : 0;
    
    return stats;
}

// ==================== GESTION DES DONNÉES (LOCALSTORAGE) ====================

function loadData() {
    const savedAgents = localStorage.getItem('sga_agents');
    if (savedAgents && JSON.parse(savedAgents).length > 0) {
        agents = JSON.parse(savedAgents);
    } else if (typeof window.agents !== 'undefined' && window.agents.length > 0) {
        agents = window.agents;
    } else {
        agents = [];
    }
    
    planningData = localStorage.getItem('sga_planning') ? JSON.parse(localStorage.getItem('sga_planning')) : {};
    holidays = localStorage.getItem('sga_holidays') ? JSON.parse(localStorage.getItem('sga_holidays')) : (typeof window.holidays !== 'undefined' ? window.holidays : []);
    panicCodes = localStorage.getItem('sga_panic_codes') ? JSON.parse(localStorage.getItem('sga_panic_codes')) : (typeof window.panicCodes !== 'undefined' ? window.panicCodes : []);
    radios = localStorage.getItem('sga_radios') ? JSON.parse(localStorage.getItem('sga_radios')) : (typeof window.radios !== 'undefined' ? window.radios : []);
    uniforms = localStorage.getItem('sga_uniforms') ? JSON.parse(localStorage.getItem('sga_uniforms')) : (typeof window.uniforms !== 'undefined' ? window.uniforms : []);
    warnings = localStorage.getItem('sga_warnings') ? JSON.parse(localStorage.getItem('sga_warnings')) : (typeof window.warnings !== 'undefined' ? window.warnings : []);
    leaves = localStorage.getItem('sga_leaves') ? JSON.parse(localStorage.getItem('sga_leaves')) : [];
    radioHistory = localStorage.getItem('sga_radio_history') ? JSON.parse(localStorage.getItem('sga_radio_history')) : [];
    auditLog = localStorage.getItem('sga_audit_log') ? JSON.parse(localStorage.getItem('sga_audit_log')) : [];
    
    if (holidays.length === 0 && typeof window.holidays !== 'undefined' && window.holidays.length > 0) {
        holidays = window.holidays;
    }
}

function saveData() {
    localStorage.setItem('sga_agents', JSON.stringify(agents));
    localStorage.setItem('sga_planning', JSON.stringify(planningData));
    localStorage.setItem('sga_holidays', JSON.stringify(holidays));
    localStorage.setItem('sga_panic_codes', JSON.stringify(panicCodes));
    localStorage.setItem('sga_radios', JSON.stringify(radios));
    localStorage.setItem('sga_uniforms', JSON.stringify(uniforms));
    localStorage.setItem('sga_warnings', JSON.stringify(warnings));
    localStorage.setItem('sga_leaves', JSON.stringify(leaves));
    localStorage.setItem('sga_radio_history', JSON.stringify(radioHistory));
    localStorage.setItem('sga_audit_log', JSON.stringify(auditLog));
}

// ==================== INTERFACES UTILISATEUR ====================

function openPopup(title, body, footer) {
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('popup-content');
    content.innerHTML = `
        <div class="popup-header">
            <h2>${title}</h2>
            <button class="popup-close-btn" onclick="closePopup()">&times;</button>
        </div>
        <div class="popup-body">${body}</div>
        <div class="popup-footer">${footer}</div>
    `;
    overlay.classList.add('visible');
}

function closePopup() {
    document.getElementById('overlay').classList.remove('visible');
}

function showSnackbar(msg, duration = 3000) {
    let snackbar = document.getElementById('snackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        document.body.appendChild(snackbar);
    }
    snackbar.textContent = msg;
    snackbar.className = 'show';
    setTimeout(() => {
        snackbar.className = '';
    }, duration);
}

function checkPassword() {
    const password = prompt("🔐 Veuillez entrer le mot de passe pour continuer:");
    if (password === "Nabil1974") {
        return true;
    } else {
        showSnackbar("❌ Mot de passe incorrect");
        return false;
    }
}

function downloadCSV(content, filename) {
    const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==================== MENUS PRINCIPAUX ====================

function displayMainMenu() {
    const mainContent = document.getElementById('main-content');
    document.getElementById('sub-title').textContent = "Menu Principal - SGA";
    mainContent.innerHTML = '';
    
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-button-container';
    
    const options = [
        { text: "👥 GESTION DES AGENTS", handler: () => displayAgentsManagementMenu() },
        { text: "📅 GESTION DU PLANNING", handler: () => displayPlanningMenu() },
        { text: "📊 STATISTIQUES & CLASSEMENT", handler: () => displayStatisticsMenu() },
        { text: "🏖️ CONGÉS & ABSENCES", handler: () => displayLeavesMenu() },
        { text: "🚨 CODES PANIQUE", handler: () => displayPanicCodesMenu() },
        { text: "📻 GESTION RADIOS", handler: () => displayRadiosMenu() },
        { text: "👔 HABILLEMENT", handler: () => displayUniformMenu() },
        { text: "⚠️ AVERTISSEMENTS", handler: () => displayWarningsMenu() },
        { text: "🎉 JOURS FÉRIÉS", handler: () => displayHolidaysMenu() },
        { text: "💾 EXPORTATIONS", handler: () => displayExportMenu() },
        { text: "⚙️ CONFIGURATION", handler: () => displayConfigMenu() },
        { text: "🚪 QUITTER", handler: () => { if(confirm("Quitter ?")) { saveData(); window.close(); } }, className: "quit-button" }
    ];
    
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.textContent = option.text;
        btn.className = 'menu-button' + (option.className ? ' ' + option.className : '');
        btn.onclick = option.handler;
        menuContainer.appendChild(btn);
    });
    
    mainContent.appendChild(menuContainer);
}

function displaySubMenu(title, options) {
    const mainContent = document.getElementById('main-content');
    document.getElementById('sub-title').textContent = title;
    mainContent.innerHTML = '';
    
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-button-container';
    
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.textContent = option.text;
        btn.className = 'menu-button' + (option.className ? ' ' + option.className : '');
        btn.onclick = option.handler;
        menuContainer.appendChild(btn);
    });
    
    mainContent.appendChild(menuContainer);
}

// ==================== GESTION DES AGENTS ====================

function displayAgentsManagementMenu() {
    displaySubMenu("GESTION DES AGENTS", [
        { text: "📋 Liste des Agents", handler: () => displayAgentsList() },
        { text: "➕ Ajouter un Agent", handler: () => showAddAgentForm() },
        { text: "✏️ Modifier un Agent", handler: () => showEditAgentList() },
        { text: "🗑️ Supprimer un Agent", handler: () => showDeleteAgentList() },
        { text: "📁 Importer Agents (Excel)", handler: () => showSnackbar("📁 Import Excel - fonctionnalité à venir") },
        { text: "📥 Importer Agents (CSV)", handler: () => showSnackbar("📥 Import CSV - fonctionnalité à venir") },
        { text: "🔄 Agents de Test", handler: () => initializeTestData() },
        { text: "📤 Exporter Agents", handler: () => exportAgentsToCSV() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function displayAgentsList() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <input type="text" id="searchAgent" placeholder="Rechercher nom ou code..." 
                       style="width:70%; padding:10px; border-radius:5px; border:none;"
                       onkeyup="filterAgentsList()">
                <button class="popup-button blue" onclick="displayAgentsList()">🔄</button>
            </div>
            <div id="agentsListContainer">
                ${generateAgentsTable(activeAgents)}
            </div>
        </div>
    `;
    
    openPopup("📋 Liste des Agents", html, `
        <button class="popup-button green" onclick="showAddAgentForm()">➕ Ajouter</button>
        <button class="popup-button gray" onclick="closePopup()">Fermer</button>
    `);
}

function generateAgentsTable(agentsList) {
    if (!agentsList || agentsList.length === 0) {
        return '<p style="text-align:center; color:#7f8c8d;">Aucun agent trouvé</p>';
    }
    
    return `
        <table class="classement-table">
            <thead>
                <tr><th>Code</th><th>Nom & Prénom</th><th>Groupe</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${agentsList.map(a => `
                    <tr>
                        <td><strong>${a.code}</strong></td>
                        <td>${a.nom} ${a.prenom}</td>
                        <td>${a.groupe}</td>
                        <td><span class="status-badge ${a.statut === 'actif' ? 'active' : 'inactive'}">${a.statut}</span></td>
                        <td style="white-space:nowrap;">
                            <button class="action-btn small blue" onclick="showEditAgentForm('${a.code}')" title="Modifier">✏️</button>
                            <button class="action-btn small red" onclick="confirmDeleteAgent('${a.code}')" title="Supprimer">🗑️</button>
                            <button class="action-btn small green" onclick="showAgentDetails('${a.code}')" title="Détails">👁️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function filterAgentsList() {
    const searchTerm = document.getElementById('searchAgent').value.toLowerCase();
    const filtered = agents.filter(a => 
        a.nom.toLowerCase().includes(searchTerm) || 
        a.code.toLowerCase().includes(searchTerm) ||
        a.prenom.toLowerCase().includes(searchTerm)
    );
    document.getElementById('agentsListContainer').innerHTML = generateAgentsTable(filtered);
}

function showAgentDetails(code) {
    const agent = agents.find(a => a.code === code);
    if (!agent) return;
    
    const details = `
        <div class="info-section">
            <h3>Informations Personnelles</h3>
            <div class="info-item"><span class="info-label">Matricule:</span><span class="info-value">${agent.matricule || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">CIN:</span><span class="info-value">${agent.cin || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">Téléphone:</span><span class="info-value">${agent.tel || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">Poste:</span><span class="info-value">${agent.poste || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">Date d'entrée:</span><span class="info-value">${agent.date_entree || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">Date de sortie:</span><span class="info-value">${agent.date_sortie || 'Actif'}</span></div>
            
            <h3 style="margin-top:20px;">Actions Rapides</h3>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="popup-button small blue" onclick="showAgentPlanning('${agent.code}')">📅 Planning</button>
                <button class="popup-button small green" onclick="showAgentStats('${agent.code}')">📊 Stats</button>
                <button class="popup-button small orange" onclick="showAddLeaveForAgent('${agent.code}')">🏖️ Congé</button>
            </div>
        </div>
    `;
    
    openPopup(`👤 Détails : ${agent.nom} ${agent.prenom}`, details, `
        <button class="popup-button green" onclick="showEditAgentForm('${agent.code}')">✏️ Modifier</button>
        <button class="popup-button blue" onclick="displayAgentsList()">📋 Retour liste</button>
        <button class="popup-button gray" onclick="closePopup()">Fermer</button>
    `);
}

function showAddAgentForm() {
    if (!checkPassword()) return;
    
    const html = `
        <div class="info-section">
            <h3>Ajouter un nouvel agent</h3>
            <form id="addAgentForm" onsubmit="return addNewAgent(event)">
                <div class="form-group"><label>Code Agent *</label><input type="text" id="agentCode" required placeholder="Ex: A01" class="form-input"></div>
                <div class="form-group"><label>Nom *</label><input type="text" id="agentNom" required placeholder="Ex: Dupont" class="form-input"></div>
                <div class="form-group"><label>Prénom *</label><input type="text" id="agentPrenom" required placeholder="Ex: Alice" class="form-input"></div>
                <div class="form-group">
                    <label>Groupe *</label>
                    <select id="agentGroupe" required class="form-input">
                        <option value="">Sélectionner</option>
                        <option value="A">Groupe A</option><option value="B">Groupe B</option>
                        <option value="C">Groupe C</option><option value="D">Groupe D</option>
                        <option value="E">Groupe E</option>
                    </select>
                </div>
                <div class="form-group"><label>Matricule</label><input type="text" id="agentMatricule" class="form-input"></div>
                <div class="form-group"><label>CIN</label><input type="text" id="agentCIN" class="form-input"></div>
                <div class="form-group"><label>Téléphone</label><input type="tel" id="agentTel" class="form-input"></div>
                <div class="form-group"><label>Poste</label><input type="text" id="agentPoste" class="form-input"></div>
                <div class="form-group"><label>Date d'entrée</label><input type="date" id="agentDateEntree" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            </form>
        </div>
    `;
    
    openPopup("➕ Ajouter un Agent", html, `
        <button class="popup-button green" onclick="document.getElementById('addAgentForm').submit()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayAgentsManagementMenu()">Annuler</button>
    `);
}

function addNewAgent(event) {
    if (event) event.preventDefault();
    
    const code = document.getElementById('agentCode').value.toUpperCase();
    const nom = document.getElementById('agentNom').value;
    const prenom = document.getElementById('agentPrenom').value;
    const groupe = document.getElementById('agentGroupe').value;
    
    if (!code || !nom || !prenom || !groupe) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires (*)");
        return false;
    }
    
    if (agents.find(a => a.code === code)) {
        showSnackbar(`⚠️ Le code ${code} existe déjà`);
        return false;
    }
    
    agents.push({
        code: code, nom: nom, prenom: prenom, groupe: groupe,
        matricule: document.getElementById('agentMatricule').value || '',
        cin: document.getElementById('agentCIN').value || '',
        tel: document.getElementById('agentTel').value || '',
        poste: document.getElementById('agentPoste').value || '',
        date_entree: document.getElementById('agentDateEntree').value || new Date().toISOString().split('T')[0],
        date_sortie: null, statut: 'actif'
    });
    
    saveData();
    showSnackbar(`✅ Agent ${code} ajouté avec succès`);
    displayAgentsList();
    closePopup();
    return false;
}

function showEditAgentList() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    if (activeAgents.length === 0) {
        showSnackbar("⚠️ Aucun agent à modifier");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Sélectionnez un agent à modifier</h3>
            <input type="text" id="searchEditAgent" placeholder="Rechercher..." 
                   style="width:100%; padding:10px; margin-bottom:15px; border-radius:5px; border:none;"
                   onkeyup="filterEditAgents()">
            <div id="editAgentsList">
                ${generateEditAgentsList(activeAgents)}
            </div>
        </div>
    `;
    
    openPopup("✏️ Modifier un Agent", html, `
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function generateEditAgentsList(agentsList) {
    if (!agentsList || agentsList.length === 0) return '<p style="text-align:center; color:#7f8c8d;">Aucun agent trouvé</p>';
    
    return `
        <table class="classement-table">
            <thead><tr><th>Code</th><th>Nom & Prénom</th><th>Groupe</th><th>Action</th></tr></thead>
            <tbody>
                ${agentsList.map(a => `
                    <tr>
                        <td>${a.code}</td><td>${a.nom} ${a.prenom}</td><td>${a.groupe}</td>
                        <td><button class="popup-button small blue" onclick="showEditAgentForm('${a.code}')">Modifier</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function filterEditAgents() {
    const searchTerm = document.getElementById('searchEditAgent').value.toLowerCase();
    const filtered = agents.filter(a => 
        a.nom.toLowerCase().includes(searchTerm) || 
        a.code.toLowerCase().includes(searchTerm) ||
        a.prenom.toLowerCase().includes(searchTerm)
    );
    document.getElementById('editAgentsList').innerHTML = generateEditAgentsList(filtered);
}

function showEditAgentForm(code) {
    if (!checkPassword()) return;
    
    const agent = agents.find(a => a.code === code);
    if (!agent) {
        showSnackbar("⚠️ Agent non trouvé");
        return;
    }
    
    const html = `
        <div class="info-section">
            <h3>Modifier l'agent ${agent.code}</h3>
            <form id="editAgentForm" onsubmit="return updateAgent('${code}', event)">
                <div class="form-group"><label>Code Agent</label><input type="text" value="${agent.code}" readonly class="form-input" style="background:#34495e;"></div>
                <div class="form-group"><label>Nom *</label><input type="text" id="editNom" value="${agent.nom}" required class="form-input"></div>
                <div class="form-group"><label>Prénom *</label><input type="text" id="editPrenom" value="${agent.prenom}" required class="form-input"></div>
                <div class="form-group">
                    <label>Groupe *</label>
                    <select id="editGroupe" required class="form-input">
                        <option value="A" ${agent.groupe === 'A' ? 'selected' : ''}>Groupe A</option>
                        <option value="B" ${agent.groupe === 'B' ? 'selected' : ''}>Groupe B</option>
                        <option value="C" ${agent.groupe === 'C' ? 'selected' : ''}>Groupe C</option>
                        <option value="D" ${agent.groupe === 'D' ? 'selected' : ''}>Groupe D</option>
                        <option value="E" ${agent.groupe === 'E' ? 'selected' : ''}>Groupe E</option>
                    </select>
                </div>
                <div class="form-group"><label>Matricule</label><input type="text" id="editMatricule" value="${agent.matricule || ''}" class="form-input"></div>
                <div class="form-group"><label>CIN</label><input type="text" id="editCIN" value="${agent.cin || ''}" class="form-input"></div>
                <div class="form-group"><label>Téléphone</label><input type="tel" id="editTel" value="${agent.tel || ''}" class="form-input"></div>
                <div class="form-group"><label>Poste</label><input type="text" id="editPoste" value="${agent.poste || ''}" class="form-input"></div>
                <div class="form-group"><label>Date d'entrée</label><input type="date" id="editDateEntree" value="${agent.date_entree || ''}" class="form-input"></div>
                <div class="form-group"><label>Date de sortie</label><input type="date" id="editDateSortie" value="${agent.date_sortie || ''}" class="form-input"></div>
            </form>
        </div>
    `;
    
    openPopup(`✏️ Modifier ${agent.code}`, html, `
        <button class="popup-button green" onclick="document.getElementById('editAgentForm').submit()">💾 Enregistrer</button>
        <button class="popup-button blue" onclick="showEditAgentList()">↩️ Retour</button>
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function updateAgent(oldCode, event) {
    if (event) event.preventDefault();
    
    const agentIndex = agents.findIndex(a => a.code === oldCode);
    if (agentIndex === -1) {
        showSnackbar("⚠️ Agent non trouvé");
        return false;
    }
    
    agents[agentIndex] = {
        ...agents[agentIndex],
        nom: document.getElementById('editNom').value,
        prenom: document.getElementById('editPrenom').value,
        groupe: document.getElementById('editGroupe').value,
        matricule: document.getElementById('editMatricule').value,
        cin: document.getElementById('editCIN').value,
        tel: document.getElementById('editTel').value,
        poste: document.getElementById('editPoste').value,
        date_entree: document.getElementById('editDateEntree').value,
        date_sortie: document.getElementById('editDateSortie').value || null,
        statut: document.getElementById('editDateSortie').value ? 'inactif' : 'actif'
    };
    
    saveData();
    showSnackbar(`✅ Agent ${oldCode} modifié avec succès`);
    displayAgentsList();
    closePopup();
    return false;
}

function showDeleteAgentList() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    if (activeAgents.length === 0) {
        showSnackbar("⚠️ Aucun agent actif à supprimer");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Sélectionnez un agent à supprimer (marquer comme inactif)</h3>
            <p style="color:#e74c3c; font-size:0.9em;">⚠️ Attention: Cette action marquera l'agent comme inactif mais conservera ses données historiques.</p>
            <div id="deleteAgentsList">
                ${generateDeleteAgentsList(activeAgents)}
            </div>
        </div>
    `;
    
    openPopup("🗑️ Supprimer un Agent", html, `
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function generateDeleteAgentsList(agentsList) {
    if (!agentsList || agentsList.length === 0) return '<p style="text-align:center; color:#7f8c8d;">Aucun agent trouvé</p>';
    
    return `
        <table class="classement-table">
            <thead><tr><th>Code</th><th>Nom & Prénom</th><th>Groupe</th><th>Action</th></tr></thead>
            <tbody>
                ${agentsList.map(a => `
                    <tr>
                        <td>${a.code}</td><td>${a.nom} ${a.prenom}</td><td>${a.groupe}</td>
                        <td><button class="popup-button small red" onclick="confirmDeleteAgent('${a.code}')">Supprimer</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function confirmDeleteAgent(code) {
    if (!checkPassword()) return;
    
    const agent = agents.find(a => a.code === code);
    if (!agent) return;
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${code} (${agent.nom} ${agent.prenom}) ?\n\nCette action marquera l'agent comme inactif.`)) {
        const agentIndex = agents.findIndex(a => a.code === code);
        if (agentIndex !== -1) {
            agents[agentIndex].date_sortie = new Date().toISOString().split('T')[0];
            agents[agentIndex].statut = 'inactif';
            saveData();
            showSnackbar(`✅ Agent ${code} marqué comme inactif`);
            displayAgentsList();
            closePopup();
        }
    }
}

function initializeTestData() {
    if (!checkPassword()) return;
    if (confirm("Voulez-vous initialiser avec des données de test ?\n\n⚠️ Attention : Cela écrasera les données existantes.")) {
        agents = [
            { code: 'TEST01', nom: 'Test', prenom: 'Agent1', groupe: 'A', tel: '0600000000', adresse: '', code_panique: '111', poste: 'Test', cin: 'TEST01', date_naissance: '1990-01-01', matricule: 'TEST01', date_entree: new Date().toISOString().split('T')[0], date_sortie: null, statut: 'actif' },
            { code: 'TEST02', nom: 'Test', prenom: 'Agent2', groupe: 'B', tel: '0600000001', adresse: '', code_panique: '112', poste: 'Test', cin: 'TEST02', date_naissance: '1991-01-01', matricule: 'TEST02', date_entree: new Date().toISOString().split('T')[0], date_sortie: null, statut: 'actif' }
        ];
        saveData();
        showSnackbar("✅ Données de test initialisées");
        displayAgentsManagementMenu();
    }
}

function exportAgentsToCSV() {
    if (agents.length === 0) {
        showSnackbar("ℹ️ Aucun agent à exporter");
        return;
    }
    
    let csvContent = "Code;Nom;Prénom;Groupe;Matricule;CIN;Téléphone;Poste;Date Entrée;Date Sortie;Statut\n";
    agents.forEach(a => {
        csvContent += `${a.code};${a.nom};${a.prenom};${a.groupe};${a.matricule || ''};${a.cin || ''};${a.tel || ''};${a.poste || ''};${a.date_entree || ''};${a.date_sortie || ''};${a.statut}\n`;
    });
    
    downloadCSV(csvContent, `agents_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Export agents terminé");
}

// ==================== GESTION DU PLANNING ====================

function displayPlanningMenu() {
    displaySubMenu("GESTION DU PLANNING", [
        { text: "📅 Planning Mensuel", handler: () => showMonthlyPlanning() },
        { text: "👥 Planning par Groupe", handler: () => showGroupPlanningSelection() },
        { text: "👤 Planning par Agent", handler: () => showAgentPlanningSelection() },
        { text: "📊 Planning Trimestriel", handler: () => showTrimestrialPlanning() },
        { text: "✏️ Modifier Shift", handler: () => showShiftModificationForm() },
        { text: "🔄 Échanger Shifts", handler: () => showShiftExchangeForm() },
        { text: "➕ Ajouter Absence", handler: () => showAddLeaveForm() },
        { text: "🔄 Générer Planning", handler: () => showSnackbar("🔄 Génération du planning théorique en cours...") },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showMonthlyPlanning() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    let html = `
        <div class="info-section">
            <h3>Sélection du mois</h3>
            <div class="form-group"><label>Mois</label>
                <select id="planningMonth" class="form-input">
                    ${Array.from({length: 12}, (_, i) => {
                        const monthNum = i + 1;
                        const monthName = new Date(currentYear, i, 1).toLocaleDateString('fr-FR', { month: 'long' });
                        return `<option value="${monthNum}" ${monthNum === currentMonth ? 'selected' : ''}>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group"><label>Année</label><input type="number" id="planningYear" class="form-input" value="${currentYear}" min="2020" max="2030"></div>
            <div class="form-group"><label>Type de planning</label>
                <select id="planningType" class="form-input">
                    <option value="global">Planning Global</option>
                    <option value="groupe">Par Groupe</option>
                    <option value="agent">Par Agent</option>
                </select>
            </div>
            <div id="groupSelector" style="display:none;"><div class="form-group"><label>Sélectionner un groupe</label>
                <select id="selectedGroup" class="form-input"><option value="A">Groupe A</option><option value="B">Groupe B</option><option value="C">Groupe C</option><option value="D">Groupe D</option><option value="E">Groupe E</option></select>
            </div></div>
            <div id="agentSelector" style="display:none;"><div class="form-group"><label>Sélectionner un agent</label>
                <select id="selectedAgent" class="form-input">${agents.filter(a => a.statut === 'actif').map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}</select>
            </div></div>
        </div>
    `;
    
    openPopup("📅 Planning Mensuel", html, `
        <button class="popup-button green" onclick="generateMonthlyPlanning()">📋 Générer Planning</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Annuler</button>
    `);
    
    setTimeout(() => {
        const typeSelect = document.getElementById('planningType');
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                document.getElementById('groupSelector').style.display = this.value === 'groupe' ? 'block' : 'none';
                document.getElementById('agentSelector').style.display = this.value === 'agent' ? 'block' : 'none';
            });
        }
    }, 100);
}

function generateMonthlyPlanning() {
    const month = parseInt(document.getElementById('planningMonth').value);
    const year = parseInt(document.getElementById('planningYear').value);
    const type = document.getElementById('planningType').value;
    
    if (type === 'groupe') {
        const group = document.getElementById('selectedGroup').value;
        showGroupPlanning(group, month, year);
    } else if (type === 'agent') {
        const agentCode = document.getElementById('selectedAgent').value;
        showAgentPlanning(agentCode, month, year);
    } else {
        showGlobalPlanning(month, year);
    }
}

function showGlobalPlanning(month, year) {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let html = `
        <div class="info-section">
            <h3>Planning Global - ${getMonthName(month)} ${year}</h3>
            <div style="overflow-x: auto;">
                <table class="planning-table">
                    <thead>
                        <tr><th>Agent</th><th>Groupe</th>
                        ${Array.from({length: daysInMonth}, (_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month - 1, day);
                            const dayName = JOURS_FRANCAIS[date.getDay()];
                            return `<th>${day}<br>${dayName}</th>`;
                        }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${activeAgents.map(agent => `
                            <tr>
                                <td nowrap><strong>${agent.code}</strong><br><small>${agent.nom} ${agent.prenom}</small></td>
                                <td>${agent.groupe}</td>
                                ${Array.from({length: daysInMonth}, (_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                    const shift = getShiftForAgent(agent.code, dateStr);
                                    const color = SHIFT_COLORS[shift] || '#7f8c8d';
                                    return `<td class="shift-cell" style="background-color:${color}; color:white;">${shift}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; padding: 10px; background: #34495e; border-radius: 5px;">
                <h4>Légende des shifts:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${Object.entries(SHIFT_LABELS).map(([code, label]) => `
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 20px; height: 20px; background-color: ${SHIFT_COLORS[code]}; border-radius: 3px;"></div>
                            <span style="font-size: 0.9em;">${code} = ${label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    openPopup(`📅 Planning Global ${getMonthName(month)} ${year}`, html, `
        <button class="popup-button blue" onclick="showMonthlyPlanning()">🔄 Nouveau</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Retour</button>
    `);
}

function showGroupPlanningSelection() {
    let html = `
        <div class="info-section">
            <h3>Sélection du groupe</h3>
            <div class="form-group"><label>Groupe:</label>
                <select id="selectedGroupPlanning" class="form-input">
                    <option value="A">Groupe A</option><option value="B">Groupe B</option>
                    <option value="C">Groupe C</option><option value="D">Groupe D</option>
                    <option value="E">Groupe E</option>
                </select>
            </div>
            <div class="form-group"><label>Mois:</label>
                <select id="groupMonth" class="form-input">
                    ${Array.from({length: 12}, (_, i) => {
                        const monthNum = i + 1;
                        const monthName = new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'long' });
                        return `<option value="${monthNum}">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group"><label>Année:</label><input type="number" id="groupYear" class="form-input" value="${new Date().getFullYear()}" min="2020" max="2030"></div>
        </div>
    `;
    
    openPopup("👥 Planning par Groupe", html, `
        <button class="popup-button green" onclick="showSelectedGroupPlanning()">📋 Voir Planning</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Annuler</button>
    `);
}

function showSelectedGroupPlanning() {
    const group = document.getElementById('selectedGroupPlanning').value;
    const month = parseInt(document.getElementById('groupMonth').value);
    const year = parseInt(document.getElementById('groupYear').value);
    showGroupPlanning(group, month, year);
}

function showGroupPlanning(group, month, year) {
    const groupAgents = agents.filter(a => a.groupe === group && a.statut === 'actif');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    if (groupAgents.length === 0) {
        showSnackbar(`⚠️ Aucun agent actif dans le groupe ${group}`);
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Planning Groupe ${group} - ${getMonthName(month)} ${year}</h3>
            <div style="overflow-x: auto;">
                <table class="planning-table">
                    <thead>
                        <tr><th>Agent</th>
                        ${Array.from({length: daysInMonth}, (_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month - 1, day);
                            const dayName = JOURS_FRANCAIS[date.getDay()];
                            return `<th>${day}<br>${dayName}</th>`;
                        }).join('')}</tr>
                    </thead>
                    <tbody>
                        ${groupAgents.map(agent => `
                            <tr>
                                <td nowrap><strong>${agent.code}</strong><br><small>${agent.nom} ${agent.prenom}</small></td>
                                ${Array.from({length: daysInMonth}, (_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                    const shift = getShiftForAgent(agent.code, dateStr);
                                    const color = SHIFT_COLORS[shift] || '#7f8c8d';
                                    return `<td class="shift-cell" style="background-color:${color}; color:white;">${shift}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    openPopup(`📅 Planning Groupe ${group}`, html, `
        <button class="popup-button blue" onclick="showMonthlyPlanning()">🔄 Nouveau</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Retour</button>
    `);
}

function showAgentPlanningSelection() {
    let html = `
        <div class="info-section">
            <h3>Sélection de l'agent</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="selectedAgentPlanning" class="form-input">
                    ${agents.filter(a => a.statut === 'actif').map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code}) - Groupe ${a.groupe}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Mois:</label>
                <select id="agentMonth" class="form-input">
                    ${Array.from({length: 12}, (_, i) => {
                        const monthNum = i + 1;
                        const monthName = new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'long' });
                        return `<option value="${monthNum}">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group"><label>Année:</label><input type="number" id="agentYear" class="form-input" value="${new Date().getFullYear()}" min="2020" max="2030"></div>
        </div>
    `;
    
    openPopup("👤 Planning par Agent", html, `
        <button class="popup-button green" onclick="showSelectedAgentPlanning()">📋 Voir Planning</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Annuler</button>
    `);
}

function showSelectedAgentPlanning() {
    const agentCode = document.getElementById('selectedAgentPlanning').value;
    const month = parseInt(document.getElementById('agentMonth').value);
    const year = parseInt(document.getElementById('agentYear').value);
    showAgentPlanning(agentCode, month, year);
}

function showAgentPlanning(agentCode, month, year) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) {
        showSnackbar("⚠️ Agent non trouvé");
        return;
    }
    
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let html = `
        <div class="info-section">
            <h3>Planning de ${agent.nom} ${agent.prenom} (${agent.code})</h3>
            <p><strong>Groupe:</strong> ${agent.groupe} | <strong>Poste:</strong> ${agent.poste}</p>
            <div style="overflow-x: auto;">
                <table class="planning-table">
                    <thead><tr><th>Date</th><th>Jour</th><th>Shift</th><th>Description</th></tr></thead>
                    <tbody>
                        ${Array.from({length: daysInMonth}, (_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month - 1, day);
                            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                            const dayName = JOURS_FRANCAIS[date.getDay()];
                            const shift = getShiftForAgent(agentCode, dateStr);
                            const shiftLabel = SHIFT_LABELS[shift] || shift;
                            const color = SHIFT_COLORS[shift] || '#7f8c8d';
                            return `<tr><td>${dateStr}</td><td>${dayName}</td><td style="background-color:${color}; color:white; text-align:center;">${shift}</td><td>${shiftLabel}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #34495e; border-radius: 5px;">
                <h4>Statistiques du mois:</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                    ${calculateAgentStats(agentCode, month, year).map(stat => `
                        <div style="text-align: center; padding: 10px; background: #2c3e50; border-radius: 5px;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${stat.value}</div>
                            <div style="font-size: 0.9em;">${stat.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    openPopup(`📅 Planning ${agent.code}`, html, `
        <button class="popup-button blue" onclick="showMonthlyPlanning()">🔄 Nouveau</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Retour</button>
    `);
}

function showShiftModificationForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>Modifier un Shift</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="shiftAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Date:</label><input type="date" id="shiftDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Nouveau shift:</label>
                <select id="newShiftSelect" class="form-input">
                    ${Object.entries(SHIFT_LABELS).map(([code, label]) => `<option value="${code}">${code} - ${label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Commentaire:</label><textarea id="shiftComment" class="form-input" rows="3" placeholder="Raison du changement..."></textarea></div>
        </div>
    `;
    
    openPopup("✏️ Modifier Shift", html, `
        <button class="popup-button green" onclick="applyShiftModification()">💾 Appliquer</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Annuler</button>
    `);
}

function applyShiftModification() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('shiftAgent').value;
    const dateStr = document.getElementById('shiftDate').value;
    const newShift = document.getElementById('newShiftSelect').value;
    const comment = document.getElementById('shiftComment').value;
    
    const monthKey = dateStr.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][dateStr] = {
        shift: newShift,
        type: 'modification_manuelle',
        comment: comment,
        modified_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ Shift modifié pour ${agentCode} le ${dateStr}`);
    closePopup();
}

function showShiftExchangeForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>Échanger les shifts entre deux agents</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div><h4>Premier agent</h4>
                    <div class="form-group"><label>Agent:</label><select id="agent1" class="form-input">${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Date:</label><input type="date" id="date1" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
                </div>
                <div><h4>Deuxième agent</h4>
                    <div class="form-group"><label>Agent:</label><select id="agent2" class="form-input">${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Date:</label><input type="date" id="date2" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
                </div>
            </div>
            <div class="form-group"><label>Commentaire:</label><textarea id="exchangeComment" class="form-input" rows="2" placeholder="Raison de l'échange..."></textarea></div>
        </div>
    `;
    
    openPopup("🔄 Échanger Shifts", html, `
        <button class="popup-button green" onclick="executeShiftExchange()">🔄 Exécuter l'échange</button>
        <button class="popup-button gray" onclick="displayPlanningMenu()">Annuler</button>
    `);
}

function executeShiftExchange() {
    if (!checkPassword()) return;
    
    const agent1Code = document.getElementById('agent1').value;
    const date1 = document.getElementById('date1').value;
    const agent2Code = document.getElementById('agent2').value;
    const date2 = document.getElementById('date2').value;
    const comment = document.getElementById('exchangeComment').value;
    
    const shift1 = getShiftForAgent(agent1Code, date1);
    const shift2 = getShiftForAgent(agent2Code, date2);
    
    const monthKey1 = date1.substring(0, 7);
    const monthKey2 = date2.substring(0, 7);
    
    if (!planningData[monthKey1]) planningData[monthKey1] = {};
    if (!planningData[monthKey1][agent1Code]) planningData[monthKey1][agent1Code] = {};
    if (!planningData[monthKey2]) planningData[monthKey2] = {};
    if (!planningData[monthKey2][agent2Code]) planningData[monthKey2][agent2Code] = {};
    
    planningData[monthKey1][agent1Code][date1] = {
        shift: shift2,
        type: 'echange',
        comment: `Échangé avec ${agent2Code} - ${comment}`,
        exchanged_at: new Date().toISOString()
    };
    
    planningData[monthKey2][agent2Code][date2] = {
        shift: shift1,
        type: 'echange',
        comment: `Échangé avec ${agent1Code} - ${comment}`,
        exchanged_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ Échange effectué entre ${agent1Code} et ${agent2Code}`);
    closePopup();
}

function showTrimestrialPlanning() {
    showSnackbar("📊 Planning Trimestriel - fonctionnalité à venir");
}

// ==================== STATISTIQUES ====================

function displayStatisticsMenu() {
    displaySubMenu("STATISTIQUES & CLASSEMENT", [
        { text: "📈 Statistiques Globales", handler: () => showGlobalStats() },
        { text: "👤 Statistiques par Agent", handler: () => showAgentStatsSelection() },
        { text: "🏆 Classement des Agents", handler: () => runClassement() },
        { text: "📊 Jours Travaillés", handler: () => showWorkedDaysMenu() },
        { text: "📉 Statistiques par Groupe", handler: () => showGroupStatsSelection() },
        { text: "📅 Statistiques Mensuelles", handler: () => showMonthlyStats() },
        { text: "📋 Rapport Complet", handler: () => generateFullReport() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showGlobalStats() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const inactiveAgents = agents.filter(a => a.statut === 'inactif');
    
    const groupStats = {};
    activeAgents.forEach(agent => {
        groupStats[agent.groupe] = (groupStats[agent.groupe] || 0) + 1;
    });
    
    let html = `
        <div class="info-section">
            <h3>📈 Statistiques Globales</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 15px; background: #2c3e50; border-radius: 8px;">
                    <div style="font-size: 2.5em; font-weight: bold; color: #3498db;">${activeAgents.length}</div>
                    <div style="font-size: 0.9em;">Agents actifs</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #2c3e50; border-radius: 8px;">
                    <div style="font-size: 2.5em; font-weight: bold; color: #7f8c8d;">${inactiveAgents.length}</div>
                    <div style="font-size: 0.9em;">Agents inactifs</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #2c3e50; border-radius: 8px;">
                    <div style="font-size: 2.5em; font-weight: bold; color: #f39c12;">${Object.keys(groupStats).length}</div>
                    <div style="font-size: 0.9em;">Groupes</div>
                </div>
            </div>
            <h4>👥 Répartition par Groupe</h4>
            ${Object.entries(groupStats).map(([group, count]) => {
                const percentage = ((count / activeAgents.length) * 100).toFixed(1);
                return `
                    <div style="margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Groupe ${group}:</span>
                            <span style="font-weight: bold;">${count} (${percentage}%)</span>
                        </div>
                        <div style="height: 10px; background: #34495e; border-radius: 5px;">
                            <div style="height: 100%; width: ${percentage}%; background: #3498db; border-radius: 5px;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    openPopup("📈 Statistiques Globales", html, `
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Retour</button>
    `);
}

function showAgentStatsSelection() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>👤 Statistiques par Agent</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="agentStatsSelect" class="form-input">
                    <option value="">-- Choisir un agent --</option>
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code}) - Groupe ${a.groupe}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Période:</label>
                <select id="agentStatsPeriod" class="form-input">
                    <option value="current_month">Ce mois</option>
                    <option value="last_3_months">3 derniers mois</option>
                    <option value="current_year">Cette année</option>
                    <option value="all_time">Toute la période</option>
                </select>
            </div>
        </div>
    `;
    
    openPopup("👤 Statistiques par Agent", html, `
        <button class="popup-button green" onclick="generateAgentStats()">📊 Générer</button>
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Retour</button>
    `);
}

function generateAgentStats() {
    const agentCode = document.getElementById('agentStatsSelect').value;
    const period = document.getElementById('agentStatsPeriod').value;
    
    if (!agentCode) {
        showSnackbar("⚠️ Veuillez sélectionner un agent");
        return;
    }
    
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) {
        showSnackbar("⚠️ Agent non trouvé");
        return;
    }
    
    const today = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_3_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'current_year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;
        default:
            startDate = new Date(2024, 0, 1);
            endDate = new Date(2030, 11, 31);
    }
    
    const stats = calculateAgentDetailedStats(agentCode, startDate, endDate);
    
    let html = `
        <div class="info-section">
            <h3>📊 Statistiques de ${agent.nom} ${agent.prenom}</h3>
            <p><strong>Code:</strong> ${agent.code} | <strong>Groupe:</strong> ${agent.groupe} | <strong>Poste:</strong> ${agent.poste || 'Non spécifié'}</p>
            <p style="color: #7f8c8d;">Période: ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0;">
                <div style="text-align: center; padding: 15px; background: #2c3e50; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: #3498db;">${stats.totalDays}</div>
                    <div style="font-size: 0.9em;">Jours total</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #27ae60; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: white;">${stats.workedDays}</div>
                    <div style="font-size: 0.9em;">Jours travaillés</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f39c12; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: white;">${stats.workRate}%</div>
                    <div style="font-size: 0.9em;">Taux de travail</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #e74c3c; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: white;">${stats.absenceRate}%</div>
                    <div style="font-size: 0.9em;">Taux d'absence</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4>📅 Répartition des Shifts</h4>
                    ${Object.entries(stats.shifts).filter(([s, c]) => c > 0 && s !== '-').map(([shift, count]) => {
                        const percentage = ((count / stats.totalDays) * 100).toFixed(1);
                        const color = SHIFT_COLORS[shift] || '#7f8c8d';
                        return `
                            <div style="margin: 8px 0;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>${SHIFT_LABELS[shift]}:</span>
                                    <span style="font-weight: bold;">${count} (${percentage}%)</span>
                                </div>
                                <div style="height: 8px; background: #34495e; border-radius: 4px;">
                                    <div style="height: 100%; width: ${percentage}%; background: ${color}; border-radius: 4px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div>
                    <h4>📊 Détails supplémentaires</h4>
                    <div style="margin: 10px 0; padding: 10px; background: #34495e; border-radius: 5px;">
                        <div><strong>Jours de weekend:</strong> ${stats.weekendDays}</div>
                        <div><strong>Jours fériés:</strong> ${stats.holidayDays}</div>
                        <div><strong>Congés:</strong> ${stats.leaves}</div>
                        <div><strong>Maladie:</strong> ${stats.sickDays}</div>
                        <div><strong>Autres absences:</strong> ${stats.otherAbsences}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    openPopup(`📊 Statistiques ${agent.code}`, html, `
        <button class="popup-button blue" onclick="showAgentStatsSelection()">👤 Autre Agent</button>
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Retour</button>
    `);
}

function runClassement() {
    const groups = [...new Set(agents.filter(a => a.statut === 'actif').map(a => a.groupe))].sort();
    
    let html = `
        <div class="info-section">
            <h3>Calculer le classement</h3>
            <p>Sélectionnez un groupe pour voir les performances :</p>
            <select id="classementGroup" class="form-input" style="width:100%; padding:10px; margin-top:10px;">
                <option value="ALL">Tous les Groupes</option>
                ${groups.map(g => `<option value="${g}">Groupe ${g}</option>`).join('')}
            </select>
        </div>
    `;
    
    openPopup("🏆 Classement des Agents", html, `
        <button class="popup-button green" onclick="generateClassement()">🏆 Générer Classement</button>
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Annuler</button>
    `);
}

function generateClassement() {
    const group = document.getElementById('classementGroup').value;
    let filtered = group === "ALL" ? agents.filter(a => a.statut === 'actif') : agents.filter(a => a.groupe === group && a.statut === 'actif');
    
    // Calculer les jours travaillés pour chaque agent
    const today = new Date();
    const startDate = new Date(today.getFullYear(), 0, 1);
    const endDate = new Date(today.getFullYear(), 11, 31);
    
    const sortedData = filtered.map(agent => {
        const stats = calculateAgentDetailedStats(agent.code, startDate, endDate);
        return { ...agent, total: stats.workedDays };
    }).sort((a, b) => b.total - a.total);
    
    let html = `
        <div class="info-section">
            <h3>Classement ${group === "ALL" ? "Général" : "Groupe " + group} - ${new Date().getFullYear()}</h3>
            <table class="classement-table">
                <thead><tr><th>Rang</th><th>Agent</th><th>Groupe</th><th>Total Jours</th></thead>
                <tbody>
                    ${sortedData.map((a, index) => `
                        <tr>
                            <td class="${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">${index + 1}</td>
                            <td>${a.nom} ${a.prenom} (${a.code})</td>
                            <td>${a.groupe}</td>
                            <td class="total-value">${a.total} j</td>
                         </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup(`🏆 Classement ${group === "ALL" ? "Général" : "Groupe " + group}`, html, `
        <button class="popup-button blue" onclick="runClassement()">🔄 Nouveau calcul</button>
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Retour</button>
    `);
}

function showWorkedDaysMenu() {
    showSnackbar("📊 Jours Travaillés - fonctionnalité complète à venir");
}

function showGroupStatsSelection() {
    showSnackbar("📉 Statistiques par Groupe - fonctionnalité complète à venir");
}

function showMonthlyStats() {
    showSnackbar("📅 Statistiques Mensuelles - fonctionnalité complète à venir");
}

function generateFullReport() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const today = new Date();
    
    let html = `
        <div class="info-section">
            <h2>📋 Rapport Complet SGA</h2>
            <p style="color: #7f8c8d;">Généré le ${today.toLocaleDateString('fr-FR')}</p>
            
            <div style="background: #2c3e50; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📊 Vue d'ensemble</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                    <div><strong>Agents actifs:</strong> ${activeAgents.length}</div>
                    <div><strong>Agents inactifs:</strong> ${agents.filter(a => a.statut === 'inactif').length}</div>
                </div>
            </div>
            
            <div style="background: #2c3e50; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">👥 Liste des Agents</h3>
                <table class="classement-table">
                    <thead><tr><th>Code</th><th>Nom</th><th>Prénom</th><th>Groupe</th><th>Statut</th></thead>
                    <tbody>
                        ${activeAgents.map(a => `
                            <tr><td>${a.code}</td><td>${a.nom}</td><td>${a.prenom}</td><td>${a.groupe}</td><td>${a.statut}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    openPopup("📋 Rapport Complet", html, `
        <button class="popup-button gray" onclick="displayStatisticsMenu()">Retour</button>
    `);
}

// ==================== CONGÉS & ABSENCES ====================

function displayLeavesMenu() {
    displaySubMenu("CONGÉS & ABSENCES", [
        { text: "➕ Ajouter Congé", handler: () => showAddLeaveForm() },
        { text: "🗑️ Supprimer Congé", handler: () => showDeleteLeaveForm() },
        { text: "📋 Liste des Congés", handler: () => showLeavesList() },
        { text: "📅 Congés par Agent", handler: () => showAgentLeavesSelection() },
        { text: "📊 Congés par Groupe", handler: () => showGroupLeavesSelection() },
        { text: "⚠️ Ajouter Absence Maladie", handler: () => showSickLeaveForm() },
        { text: "🚫 Ajouter Autre Absence", handler: () => showOtherAbsenceForm() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showAddLeaveForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>Ajouter un congé ou une absence</h3>
            <div class="form-group"><label>Type d'absence:</label>
                <select id="leaveType" class="form-input">
                    <option value="C">Congé payé (C)</option>
                    <option value="M">Maladie (M)</option>
                    <option value="A">Autre absence (A)</option>
                </select>
            </div>
            <div class="form-group"><label>Agent:</label>
                <select id="leaveAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Date:</label><input type="date" id="leaveDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Commentaire:</label><textarea id="leaveComment" class="form-input" rows="3" placeholder="Raison du congé/absence..."></textarea></div>
        </div>
    `;
    
    openPopup("🏖️ Ajouter Congé/Absence", html, `
        <button class="popup-button green" onclick="saveLeave()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Annuler</button>
    `);
}

function saveLeave() {
    if (!checkPassword()) return;
    
    const leaveType = document.getElementById('leaveType').value;
    const agentCode = document.getElementById('leaveAgent').value;
    const leaveDate = document.getElementById('leaveDate').value;
    const comment = document.getElementById('leaveComment').value;
    
    if (!agentCode || !leaveDate) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const monthKey = leaveDate.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][leaveDate] = {
        shift: leaveType,
        type: 'absence',
        comment: comment,
        recorded_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ Absence (${SHIFT_LABELS[leaveType]}) enregistrée pour ${agentCode} le ${leaveDate}`);
    closePopup();
}

function showDeleteLeaveForm() {
    showSnackbar("🗑️ Supprimer Congé - fonctionnalité complète à venir");
}

function showLeavesList() {
    const leavesList = [];
    
    Object.keys(planningData).forEach(monthKey => {
        Object.keys(planningData[monthKey]).forEach(agentCode => {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C', 'M', 'A'].includes(record.shift)) {
                    leavesList.push({ agentCode, date: dateStr, type: record.shift, comment: record.comment });
                }
            });
        });
    });
    
    if (leavesList.length === 0) {
        showSnackbar("ℹ️ Aucun congé enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Liste des Congés/Absences</h3>
            <table class="classement-table">
                <thead><tr><th>Agent</th><th>Date</th><th>Type</th><th>Commentaire</th></thead>
                <tbody>
                    ${leavesList.map(l => {
                        const agent = agents.find(a => a.code === l.agentCode);
                        return `<tr><td>${agent ? agent.nom + ' ' + agent.prenom : l.agentCode}</td><td>${l.date}</td><td>${SHIFT_LABELS[l.type]}</td><td>${l.comment || '-'}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("📋 Liste des Congés", html, `
        <button class="popup-button green" onclick="showAddLeaveForm()">➕ Ajouter</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Retour</button>
    `);
}

function showAgentLeavesSelection() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>Congés par Agent</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="agentLeavesSelect" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
        </div>
    `;
    
    openPopup("📅 Congés par Agent", html, `
        <button class="popup-button green" onclick="showAgentLeaves()">📋 Voir Congés</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Annuler</button>
    `);
}

function showAgentLeaves() {
    const agentCode = document.getElementById('agentLeavesSelect').value;
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    const agentLeaves = [];
    Object.keys(planningData).forEach(monthKey => {
        if (planningData[monthKey][agentCode]) {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C', 'M', 'A'].includes(record.shift)) {
                    agentLeaves.push({ date: dateStr, type: record.shift, comment: record.comment });
                }
            });
        }
    });
    
    if (agentLeaves.length === 0) {
        showSnackbar(`ℹ️ Aucun congé trouvé pour ${agent.nom} ${agent.prenom}`);
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Congés de ${agent.nom} ${agent.prenom}</h3>
            <table class="classement-table">
                <thead><tr><th>Date</th><th>Type</th><th>Commentaire</th></thead>
                <tbody>
                    ${agentLeaves.map(l => `
                        <tr><td>${l.date}</td><td>${SHIFT_LABELS[l.type]}</td><td>${l.comment || '-'}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup(`📅 Congés de ${agent.code}`, html, `
        <button class="popup-button blue" onclick="showAgentLeavesSelection()">👤 Autre Agent</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Retour</button>
    `);
}

function showGroupLeavesSelection() {
    showSnackbar("📊 Congés par Groupe - fonctionnalité complète à venir");
}

function showSickLeaveForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>⚠️ Ajouter une Absence Maladie</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="sickAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Date de début:</label><input type="date" id="sickStartDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Date de fin:</label><input type="date" id="sickEndDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Commentaire:</label><textarea id="sickComment" class="form-input" rows="3" placeholder="Raison de l'absence..."></textarea></div>
        </div>
    `;
    
    openPopup("⚠️ Absence Maladie", html, `
        <button class="popup-button green" onclick="saveSickLeave()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Annuler</button>
    `);
}

function saveSickLeave() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('sickAgent').value;
    const startDate = document.getElementById('sickStartDate').value;
    const endDate = document.getElementById('sickEndDate').value;
    const comment = document.getElementById('sickComment').value;
    
    if (!agentCode || !startDate || !endDate) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const monthKey = dateStr.substring(0, 7);
        
        if (!planningData[monthKey]) planningData[monthKey] = {};
        if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
        
        planningData[monthKey][agentCode][dateStr] = {
            shift: 'M',
            type: 'absence_maladie',
            comment: comment,
            recorded_at: new Date().toISOString()
        };
        
        current.setDate(current.getDate() + 1);
    }
    
    saveData();
    showSnackbar(`✅ Absence maladie enregistrée pour ${agentCode} du ${startDate} au ${endDate}`);
    closePopup();
}

function showOtherAbsenceForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>🚫 Ajouter une Autre Absence</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="otherAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Date:</label><input type="date" id="otherDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Commentaire:</label><textarea id="otherComment" class="form-input" rows="3" placeholder="Raison de l'absence..."></textarea></div>
        </div>
    `;
    
    openPopup("🚫 Autre Absence", html, `
        <button class="popup-button green" onclick="saveOtherAbsence()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayLeavesMenu()">Annuler</button>
    `);
}

function saveOtherAbsence() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('otherAgent').value;
    const date = document.getElementById('otherDate').value;
    const comment = document.getElementById('otherComment').value;
    
    if (!agentCode || !date) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const monthKey = date.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][date] = {
        shift: 'A',
        type: 'autre_absence',
        comment: comment,
        recorded_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ Autre absence enregistrée pour ${agentCode} le ${date}`);
    closePopup();
}

// ==================== CODES PANIQUE ====================

function displayPanicCodesMenu() {
    displaySubMenu("CODES PANIQUE", [
        { text: "➕ Ajouter Code", handler: () => showAddPanicCodeForm() },
        { text: "✏️ Modifier Code", handler: () => showEditPanicCodeList() },
        { text: "🗑️ Supprimer Code", handler: () => showDeletePanicCodeList() },
        { text: "📋 Liste des Codes", handler: () => showPanicCodesList() },
        { text: "🔍 Rechercher Code", handler: () => showSearchPanicCode() },
        { text: "📤 Exporter Codes", handler: () => exportPanicCodes() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showPanicCodesList() {
    if (!panicCodes || panicCodes.length === 0) {
        showSnackbar("ℹ️ Aucun code panique enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>Liste des Codes Panique</h3>
            <table class="classement-table">
                <thead><tr><th>Agent</th><th>Code</th><th>Poste</th><th>Créé le</th></thead>
                <tbody>
                    ${panicCodes.map(code => {
                        const agent = agents.find(a => a.code === code.agent_code);
                        return `<tr><td>${agent ? agent.nom + ' ' + agent.prenom : code.agent_code}</td><td><strong style="color:#e74c3c;">${code.code}</strong></td><td>${code.poste || '-'}</td><td>${code.created_at || '-'}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("🚨 Codes Panique", html, `
        <button class="popup-button green" onclick="showAddPanicCodeForm()">➕ Ajouter</button>
        <button class="popup-button gray" onclick="displayPanicCodesMenu()">Retour</button>
    `);
}

function showAddPanicCodeForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>Ajouter un Code Panique</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="panicAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Code Panique:</label><input type="text" id="panicCode" class="form-input" required placeholder="Ex: PANIC123"></div>
            <div class="form-group"><label>Poste:</label><input type="text" id="panicPoste" class="form-input" placeholder="Poste associé"></div>
        </div>
    `;
    
    openPopup("➕ Ajouter Code Panique", html, `
        <button class="popup-button green" onclick="savePanicCode()">🔐 Enregistrer</button>
        <button class="popup-button gray" onclick="displayPanicCodesMenu()">Annuler</button>
    `);
}

function savePanicCode() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('panicAgent').value;
    const code = document.getElementById('panicCode').value.toUpperCase();
    const poste = document.getElementById('panicPoste').value;
    
    if (!agentCode || !code) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const existingIndex = panicCodes.findIndex(p => p.agent_code === agentCode);
    const panicCode = {
        agent_code: agentCode,
        code: code,
        poste: poste,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
    };
    
    if (existingIndex !== -1) {
        panicCodes[existingIndex] = panicCode;
        showSnackbar(`✅ Code panique mis à jour pour ${agentCode}`);
    } else {
        panicCodes.push(panicCode);
        showSnackbar(`✅ Code panique ajouté pour ${agentCode}`);
    }
    
    saveData();
    showPanicCodesList();
    closePopup();
}

function showEditPanicCodeList() {
    showSnackbar("✏️ Modification des codes panique - utilisez 'Liste des Codes' puis Modifier");
}

function showDeletePanicCodeList() {
    showSnackbar("🗑️ Suppression des codes panique - utilisez 'Liste des Codes' puis Supprimer");
}

function showSearchPanicCode() {
    showSnackbar("🔍 Recherche de code panique - utilisez 'Liste des Codes' et filtrez");
}

function exportPanicCodes() {
    if (!panicCodes || panicCodes.length === 0) {
        showSnackbar("ℹ️ Aucun code panique à exporter");
        return;
    }
    
    let csvContent = "Agent;Code Panique;Poste;Créé le;Mis à jour le\n";
    panicCodes.forEach(code => {
        const agent = agents.find(a => a.code === code.agent_code);
        const agentName = agent ? `${agent.nom} ${agent.prenom}` : code.agent_code;
        csvContent += `${agentName};${code.code};${code.poste || ''};${code.created_at};${code.updated_at}\n`;
    });
    
    downloadCSV(csvContent, `Codes_Panique_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Export des codes panique terminé");
}

// ==================== GESTION RADIOS ====================

function displayRadiosMenu() {
    displaySubMenu("GESTION RADIOS", [
        { text: "➕ Ajouter Radio", handler: () => showAddRadioForm() },
        { text: "✏️ Modifier Radio", handler: () => showEditRadioList() },
        { text: "📋 Liste des Radios", handler: () => showRadiosList() },
        { text: "📲 Attribuer Radio", handler: () => showAssignRadioForm() },
        { text: "🔄 Retour Radio", handler: () => showReturnRadioForm() },
        { text: "📊 Statut Radios", handler: () => showRadiosStatus() },
        { text: "📋 Historique", handler: () => showRadiosHistory() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showRadiosList() {
    if (!radios || radios.length === 0) {
        showSnackbar("ℹ️ Aucune radio enregistrée");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>📻 Liste des Radios</h3>
            <table class="classement-table">
                <thead><tr><th>ID</th><th>Modèle</th><th>Série</th><th>Statut</th><th>Attribuée à</th></thead>
                <tbody>
                    ${radios.map(radio => {
                        const agent = radio.attributed_to ? agents.find(a => a.code === radio.attributed_to) : null;
                        let statusColor = radio.statut === 'DISPONIBLE' ? '#27ae60' : radio.statut === 'ATTRIBUEE' ? '#f39c12' : '#e74c3c';
                        return `<tr>
                            <td><strong>${radio.id}</strong></td>
                            <td>${radio.modele}</td>
                            <td>${radio.serial || '-'}</td>
                            <td><span style="background-color:${statusColor}; color:white; padding:2px 8px; border-radius:12px;">${radio.statut}</span></td>
                            <td>${agent ? agent.nom + ' ' + agent.prenom : '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("📻 Gestion des Radios", html, `
        <button class="popup-button green" onclick="showAddRadioForm()">➕ Ajouter</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Retour</button>
    `);
}

function showAddRadioForm() {
    if (!checkPassword()) return;
    
    let html = `
        <div class="info-section">
            <h3>➕ Ajouter une Radio</h3>
            <div class="form-group"><label>ID Radio:</label><input type="text" id="radioId" class="form-input" required placeholder="Ex: RAD001"></div>
            <div class="form-group"><label>Modèle:</label><input type="text" id="radioModel" class="form-input" required placeholder="Ex: Motorola XPR 7550"></div>
            <div class="form-group"><label>Numéro de série:</label><input type="text" id="radioSerial" class="form-input" placeholder="Ex: SN123456"></div>
            <div class="form-group"><label>Statut:</label>
                <select id="radioStatus" class="form-input">
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="ATTRIBUEE">Attribuée</option>
                    <option value="HS">Hors Service</option>
                </select>
            </div>
        </div>
    `;
    
    openPopup("➕ Ajouter Radio", html, `
        <button class="popup-button green" onclick="saveNewRadio()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Annuler</button>
    `);
}

function saveNewRadio() {
    if (!checkPassword()) return;
    
    const id = document.getElementById('radioId').value.toUpperCase();
    const modele = document.getElementById('radioModel').value;
    const serial = document.getElementById('radioSerial').value;
    const statut = document.getElementById('radioStatus').value;
    
    if (!id || !modele) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    if (radios.find(r => r.id === id)) {
        showSnackbar(`⚠️ La radio ${id} existe déjà`);
        return;
    }
    
    radios.push({
        id: id,
        modele: modele,
        serial: serial || '',
        statut: statut,
        acquisition_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
    });
    
    saveData();
    showSnackbar(`✅ Radio ${id} ajoutée avec succès`);
    showRadiosList();
    closePopup();
}

function showEditRadioList() {
    showSnackbar("✏️ Modification des radios - utilisez 'Liste des Radios' puis Modifier");
}

function showAssignRadioForm() {
    const availableRadios = radios.filter(r => r.statut === 'DISPONIBLE');
    if (availableRadios.length === 0) {
        showSnackbar("⚠️ Aucune radio disponible à attribuer");
        return;
    }
    
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>📲 Attribuer une Radio</h3>
            <div class="form-group"><label>Radio:</label>
                <select id="assignRadioSelect" class="form-input">
                    ${availableRadios.map(r => `<option value="${r.id}">${r.id} - ${r.modele}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Agent:</label>
                <select id="assignAgentSelect" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Motif:</label><input type="text" id="assignMotif" class="form-input" placeholder="Raison de l'attribution"></div>
        </div>
    `;
    
    openPopup("📲 Attribuer Radio", html, `
        <button class="popup-button green" onclick="executeAssignRadio()">✅ Attribuer</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Annuler</button>
    `);
}

function executeAssignRadio() {
    if (!checkPassword()) return;
    
    const radioId = document.getElementById('assignRadioSelect').value;
    const agentCode = document.getElementById('assignAgentSelect').value;
    const motif = document.getElementById('assignMotif').value;
    
    const radioIndex = radios.findIndex(r => r.id === radioId);
    if (radioIndex === -1) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    radios[radioIndex].statut = 'ATTRIBUEE';
    radios[radioIndex].attributed_to = agentCode;
    radios[radioIndex].attribution_date = new Date().toISOString().split('T')[0];
    radios[radioIndex].attribution_motif = motif;
    
    saveData();
    showSnackbar(`✅ Radio ${radioId} attribuée à ${agentCode}`);
    closePopup();
    showRadiosList();
}

function showReturnRadioForm() {
    const attributedRadios = radios.filter(r => r.statut === 'ATTRIBUEE');
    if (attributedRadios.length === 0) {
        showSnackbar("⚠️ Aucune radio attribuée à retourner");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>🔄 Retourner une Radio</h3>
            <div class="form-group"><label>Radio:</label>
                <select id="returnRadioSelect" class="form-input">
                    ${attributedRadios.map(r => {
                        const agent = agents.find(a => a.code === r.attributed_to);
                        return `<option value="${r.id}">${r.id} - ${r.modele} (${agent ? agent.nom + ' ' + agent.prenom : r.attributed_to})</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group"><label>État retour:</label>
                <select id="returnCondition" class="form-input">
                    <option value="BON">Bon état</option>
                    <option value="USAGE">Légère usure</option>
                    <option value="DOMMAGE">Dommage</option>
                </select>
            </div>
        </div>
    `;
    
    openPopup("🔄 Retourner Radio", html, `
        <button class="popup-button green" onclick="executeReturnRadio()">✅ Retourner</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Annuler</button>
    `);
}

function executeReturnRadio() {
    if (!checkPassword()) return;
    
    const radioId = document.getElementById('returnRadioSelect').value;
    const condition = document.getElementById('returnCondition').value;
    
    const radioIndex = radios.findIndex(r => r.id === radioId);
    if (radioIndex === -1) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    radios[radioIndex].statut = 'DISPONIBLE';
    radios[radioIndex].return_date = new Date().toISOString().split('T')[0];
    radios[radioIndex].return_condition = condition;
    radios[radioIndex].attributed_to = null;
    
    saveData();
    showSnackbar(`✅ Radio ${radioId} retournée avec succès`);
    closePopup();
    showRadiosList();
}

function showRadiosStatus() {
    if (!radios || radios.length === 0) {
        showSnackbar("ℹ️ Aucune radio enregistrée");
        return;
    }
    
    const disponible = radios.filter(r => r.statut === 'DISPONIBLE').length;
    const attribuee = radios.filter(r => r.statut === 'ATTRIBUEE').length;
    const hs = radios.filter(r => r.statut === 'HS').length;
    
    let html = `
        <div class="info-section">
            <h3>📊 Statut des Radios</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                <div style="text-align: center; padding: 15px; background: #27ae60; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${disponible}</div>
                    <div>Disponibles</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f39c12; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${attribuee}</div>
                    <div>Attribuées</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #e74c3c; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${hs}</div>
                    <div>Hors Service</div>
                </div>
            </div>
            <div style="margin-top: 20px;"><strong>Total:</strong> ${radios.length} radios</div>
        </div>
    `;
    
    openPopup("📊 Statut des Radios", html, `
        <button class="popup-button gray" onclick="showRadiosList()">Retour</button>
    `);
}

function showRadiosHistory() {
    showSnackbar("📋 Historique des radios - fonctionnalité complète à venir");
}

// ==================== HABILLEMENT ====================

function displayUniformMenu() {
    displaySubMenu("HABILLEMENT", [
        { text: "➕ Enregistrer Habillement", handler: () => showAddUniformForm() },
        { text: "✏️ Modifier Habillement", handler: () => showEditUniformList() },
        { text: "📋 Rapport Habillement", handler: () => showUniformReport() },
        { text: "📊 Statistiques Tailles", handler: () => showUniformStats() },
        { text: "📅 Échéances", handler: () => showUniformDeadlines() },
        { text: "📤 Exporter Rapport", handler: () => exportUniformReport() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showAddUniformForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>👔 Enregistrer un Équipement d'Habillement</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="uniformAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Chemise (taille):</label><input type="text" id="uniformShirt" class="form-input" placeholder="S, M, L, XL, XXL"></div>
            <div class="form-group"><label>Pantalon (taille):</label><input type="text" id="uniformPants" class="form-input" placeholder="38, 40, 42, 44"></div>
            <div class="form-group"><label>Veste (taille):</label><input type="text" id="uniformJacket" class="form-input" placeholder="S, M, L, XL"></div>
            <div class="form-group"><label>Cravate:</label>
                <select id="uniformTie" class="form-input"><option value="oui">Oui</option><option value="non">Non</option></select>
            </div>
        </div>
    `;
    
    openPopup("👔 Enregistrer Habillement", html, `
        <button class="popup-button green" onclick="saveUniform()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayUniformMenu()">Annuler</button>
    `);
}

function saveUniform() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('uniformAgent').value;
    const shirt = document.getElementById('uniformShirt').value;
    const pants = document.getElementById('uniformPants').value;
    const jacket = document.getElementById('uniformJacket').value;
    const tie = document.getElementById('uniformTie').value;
    
    if (!agentCode || !shirt || !pants) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const existingIndex = uniforms.findIndex(u => u.agent_code === agentCode);
    const uniformData = {
        agent_code: agentCode,
        chemise_taille: shirt,
        chemise_date: new Date().toISOString().split('T')[0],
        pantalon_taille: pants,
        pantalon_date: new Date().toISOString().split('T')[0],
        jacket_taille: jacket || '',
        jacket_date: jacket ? new Date().toISOString().split('T')[0] : '',
        cravate_oui: tie === 'oui',
        cravate_date: tie === 'oui' ? new Date().toISOString().split('T')[0] : '',
        updated_at: new Date().toISOString()
    };
    
    if (existingIndex !== -1) {
        uniforms[existingIndex] = uniformData;
        showSnackbar(`✅ Habillement mis à jour pour ${agentCode}`);
    } else {
        uniforms.push(uniformData);
        showSnackbar(`✅ Habillement enregistré pour ${agentCode}`);
    }
    
    saveData();
    closePopup();
    showUniformReport();
}

function showEditUniformList() {
    if (!uniforms || uniforms.length === 0) {
        showSnackbar("ℹ️ Aucun habillement enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>✏️ Modifier Habillement</h3>
            <div class="form-group"><label>Sélectionner un agent:</label>
                <select id="editUniformSelect" class="form-input">
                    ${uniforms.map(u => {
                        const agent = agents.find(a => a.code === u.agent_code);
                        return `<option value="${u.agent_code}">${agent ? agent.nom + ' ' + agent.prenom : u.agent_code}</option>`;
                    }).join('')}
                </select>
            </div>
        </div>
    `;
    
    openPopup("✏️ Modifier Habillement", html, `
        <button class="popup-button green" onclick="editUniform()">✏️ Modifier</button>
        <button class="popup-button gray" onclick="displayUniformMenu()">Retour</button>
    `);
}

function editUniform() {
    const agentCode = document.getElementById('editUniformSelect').value;
    showAddUniformForm();
    setTimeout(() => {
        const uniform = uniforms.find(u => u.agent_code === agentCode);
        if (uniform) {
            document.getElementById('uniformAgent').value = uniform.agent_code;
            document.getElementById('uniformShirt').value = uniform.chemise_taille;
            document.getElementById('uniformPants').value = uniform.pantalon_taille;
            document.getElementById('uniformJacket').value = uniform.jacket_taille || '';
            document.getElementById('uniformTie').value = uniform.cravate_oui ? 'oui' : 'non';
        }
    }, 100);
}

function showUniformReport() {
    if (!uniforms || uniforms.length === 0) {
        showSnackbar("ℹ️ Aucun habillement enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>📋 Rapport d'Habillement</h3>
            <table class="classement-table">
                <thead><tr><th>Agent</th><th>Chemise</th><th>Pantalon</th><th>Veste</th><th>Cravate</th></thead>
                <tbody>
                    ${uniforms.map(u => {
                        const agent = agents.find(a => a.code === u.agent_code);
                        return `<tr>
                            <td>${agent ? agent.nom + ' ' + agent.prenom : u.agent_code}
                            <td>${u.chemise_taille}</td>
                            <td>${u.pantalon_taille}</td>
                            <td>${u.jacket_taille || '-'}</td>
                            <td>${u.cravate_oui ? 'Oui' : 'Non'}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("📋 Rapport Habillement", html, `
        <button class="popup-button green" onclick="showAddUniformForm()">➕ Ajouter</button>
        <button class="popup-button blue" onclick="exportUniformReport()">📤 Exporter</button>
        <button class="popup-button gray" onclick="displayUniformMenu()">Retour</button>
    `);
}

function showUniformStats() {
    if (!uniforms || uniforms.length === 0) {
        showSnackbar("ℹ️ Aucune donnée d'habillement disponible");
        return;
    }
    
    const shirtSizes = {};
    const pantsSizes = {};
    
    uniforms.forEach(u => {
        shirtSizes[u.chemise_taille] = (shirtSizes[u.chemise_taille] || 0) + 1;
        pantsSizes[u.pantalon_taille] = (pantsSizes[u.pantalon_taille] || 0) + 1;
    });
    
    let html = `
        <div class="info-section">
            <h3>📊 Statistiques des Tailles</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4>Chemises</h4>
                    ${Object.entries(shirtSizes).sort((a,b) => b[1] - a[1]).map(([size, count]) => `
                        <div style="margin: 5px 0; padding: 8px; background: #34495e; border-radius: 5px;">
                            <span style="font-weight: bold;">Taille ${size}:</span>
                            <span style="float: right;">${count}</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <h4>Pantalons</h4>
                    ${Object.entries(pantsSizes).sort((a,b) => b[1] - a[1]).map(([size, count]) => `
                        <div style="margin: 5px 0; padding: 8px; background: #34495e; border-radius: 5px;">
                            <span style="font-weight: bold;">Taille ${size}:</span>
                            <span style="float: right;">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #2c3e50; border-radius: 5px;">
                <strong>Total agents équipés:</strong> ${uniforms.length}
            </div>
        </div>
    `;
    
    openPopup("📊 Statistiques Tailles", html, `
        <button class="popup-button gray" onclick="showUniformReport()">Retour</button>
    `);
}

function showUniformDeadlines() {
    showSnackbar("📅 Échéances Habillement - fonctionnalité complète à venir");
}

function exportUniformReport() {
    if (!uniforms || uniforms.length === 0) {
        showSnackbar("ℹ️ Aucune donnée d'habillement à exporter");
        return;
    }
    
    let csvContent = "Agent;Code;Chemise Taille;Chemise Date;Pantalon Taille;Pantalon Date;Veste Taille;Veste Date;Cravate;Cravate Date;Dernière mise à jour\n";
    
    uniforms.forEach(u => {
        const agent = agents.find(a => a.code === u.agent_code);
        csvContent += `${agent ? agent.nom + ' ' + agent.prenom : u.agent_code};${u.agent_code};`;
        csvContent += `${u.chemise_taille};${u.chemise_date};${u.pantalon_taille};${u.pantalon_date};`;
        csvContent += `${u.jacket_taille || ''};${u.jacket_date || ''};${u.cravate_oui ? 'OUI' : 'NON'};${u.cravate_date || ''};${u.updated_at}\n`;
    });
    
    downloadCSV(csvContent, `Rapport_Habillement_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Rapport d'habillement exporté");
}

// ==================== AVERTISSEMENTS ====================

function displayWarningsMenu() {
    displaySubMenu("AVERTISSEMENTS DISCIPLINAIRES", [
        { text: "⚠️ Ajouter Avertissement", handler: () => showAddWarningForm() },
        { text: "📋 Liste Avertissements", handler: () => showWarningsList() },
        { text: "👤 Avertissements par Agent", handler: () => showAgentWarningsSelection() },
        { text: "📊 Statistiques", handler: () => showWarningsStats() },
        { text: "📤 Exporter Rapport", handler: () => exportWarningsReport() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showAddWarningForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>⚠️ Ajouter un Avertissement</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="warningAgent" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Type:</label>
                <select id="warningType" class="form-input">
                    <option value="ORAL">Avertissement Oral</option>
                    <option value="ECRIT">Avertissement Écrit</option>
                    <option value="MISE_A_PIED">Mise à pied</option>
                </select>
            </div>
            <div class="form-group"><label>Date:</label><input type="date" id="warningDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Description:</label><textarea id="warningDesc" class="form-input" rows="3" placeholder="Description des faits..."></textarea></div>
            <div class="form-group"><label>Sanctions:</label><textarea id="warningSanctions" class="form-input" rows="2" placeholder="Sanctions appliquées..."></textarea></div>
        </div>
    `;
    
    openPopup("⚠️ Ajouter Avertissement", html, `
        <button class="popup-button green" onclick="saveWarning()">⚖️ Enregistrer</button>
        <button class="popup-button gray" onclick="displayWarningsMenu()">Annuler</button>
    `);
}

function saveWarning() {
    if (!checkPassword()) return;
    
    const agentCode = document.getElementById('warningAgent').value;
    const type = document.getElementById('warningType').value;
    const date = document.getElementById('warningDate').value;
    const description = document.getElementById('warningDesc').value;
    const sanctions = document.getElementById('warningSanctions').value;
    
    if (!agentCode || !type || !date || !description) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    warnings.push({
        id: 'WARN' + Date.now(),
        agent_code: agentCode,
        type: type,
        date: date,
        description: description,
        sanctions: sanctions,
        status: 'active',
        created_at: new Date().toISOString(),
        created_by: 'Admin'
    });
    
    saveData();
    showSnackbar(`✅ Avertissement enregistré pour ${agentCode}`);
    closePopup();
    showWarningsList();
}

function showWarningsList() {
    if (!warnings || warnings.length === 0) {
        showSnackbar("ℹ️ Aucun avertissement enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>📋 Liste des Avertissements</h3>
            <table class="classement-table">
                <thead>
                    <tr><th>Agent</th><th>Type</th><th>Date</th><th>Description</th><th>Statut</th></tr>
                </thead>
                <tbody>
                    ${warnings.map(w => {
                        const agent = agents.find(a => a.code === w.agent_code);
                        const typeLabel = w.type === 'ORAL' ? 'Oral' : w.type === 'ECRIT' ? 'Écrit' : 'Mise à pied';
                        const typeColor = w.type === 'ORAL' ? '#f39c12' : w.type === 'ECRIT' ? '#e74c3c' : '#c0392b';
                        return `
                            <tr>
                                <td>${agent ? agent.nom + ' ' + agent.prenom : w.agent_code}</td>
                                <td><span style="background-color:${typeColor}; color:white; padding:2px 8px; border-radius:12px;">${typeLabel}</span></td>
                                <td>${w.date}</td>
                                <td>${w.description.substring(0, 50)}${w.description.length > 50 ? '...' : ''}</td>
                                <td>${w.status === 'active' ? 'Actif' : 'Archivé'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("⚠️ Avertissements", html, `
        <button class="popup-button green" onclick="showAddWarningForm()">⚠️ Ajouter</button>
        <button class="popup-button gray" onclick="displayWarningsMenu()">Retour</button>
    `);
}

function showAgentWarningsSelection() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>👤 Avertissements par Agent</h3>
            <div class="form-group"><label>Agent:</label>
                <select id="agentWarningsSelect" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
        </div>
    `;
    
    openPopup("👤 Avertissements par Agent", html, `
        <button class="popup-button green" onclick="showAgentWarnings()">📋 Voir</button>
        <button class="popup-button gray" onclick="displayWarningsMenu()">Retour</button>
    `);
}

function showAgentWarnings() {
    const agentCode = document.getElementById('agentWarningsSelect').value;
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    const agentWarnings = warnings.filter(w => w.agent_code === agentCode);
    
    if (agentWarnings.length === 0) {
        showSnackbar(`ℹ️ Aucun avertissement pour ${agent.nom} ${agent.prenom}`);
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>⚠️ Avertissements de ${agent.nom} ${agent.prenom}</h3>
            <table class="classement-table">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Sanctions</th><th>Statut</th></tr></thead>
                <tbody>
                    ${agentWarnings.map(w => {
                        const typeLabel = w.type === 'ORAL' ? 'Oral' : w.type === 'ECRIT' ? 'Écrit' : 'Mise à pied';
                        return `
                            <tr>
                                <td>${w.date}</td>
                                <td>${typeLabel}</td>
                                <td>${w.description}</td>
                                <td>${w.sanctions || '-'}</td>
                                <td>${w.status === 'active' ? 'Actif' : 'Archivé'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup(`⚠️ Avertissements de ${agent.code}`, html, `
        <button class="popup-button blue" onclick="showAgentWarningsSelection()">👤 Autre Agent</button>
        <button class="popup-button gray" onclick="displayWarningsMenu()">Retour</button>
    `);
}

function showWarningsStats() {
    if (!warnings || warnings.length === 0) {
        showSnackbar("ℹ️ Aucune donnée statistique disponible");
        return;
    }
    
    const stats = {
        total: warnings.length,
        oral: warnings.filter(w => w.type === 'ORAL').length,
        ecrit: warnings.filter(w => w.type === 'ECRIT').length,
        miseAPied: warnings.filter(w => w.type === 'MISE_A_PIED').length,
        actifs: warnings.filter(w => w.status === 'active').length,
        archives: warnings.filter(w => w.status === 'archived').length
    };
    
    let html = `
        <div class="info-section">
            <h3>📊 Statistiques des Avertissements</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 15px; background: #2c3e50; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: #3498db;">${stats.total}</div>
                    <div>Total</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f39c12; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${stats.oral}</div>
                    <div>Orals</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #e74c3c; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${stats.ecrit}</div>
                    <div>Écrits</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #c0392b; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold;">${stats.miseAPied}</div>
                    <div>Mise à pied</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="text-align: center; padding: 10px; background: #27ae60; border-radius: 5px;">
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.actifs}</div>
                    <div>Actifs</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #7f8c8d; border-radius: 5px;">
                    <div style="font-size: 1.5em; font-weight: bold;">${stats.archives}</div>
                    <div>Archivés</div>
                </div>
            </div>
        </div>
    `;
    
    openPopup("📊 Statistiques Avertissements", html, `
        <button class="popup-button blue" onclick="exportWarningsReport()">📤 Exporter</button>
        <button class="popup-button gray" onclick="showWarningsList()">Retour</button>
    `);
}

function exportWarningsReport() {
    if (!warnings || warnings.length === 0) {
        showSnackbar("ℹ️ Aucun avertissement à exporter");
        return;
    }
    
    let csvContent = "Agent;Code;Type;Date;Description;Sanctions;Statut;Créé le\n";
    
    warnings.forEach(w => {
        const agent = agents.find(a => a.code === w.agent_code);
        csvContent += `${agent ? agent.nom + ' ' + agent.prenom : w.agent_code};${w.agent_code};`;
        csvContent += `${w.type};${w.date};"${w.description.replace(/"/g, '""')}";"${(w.sanctions || '').replace(/"/g, '""')}";${w.status};${w.created_at}\n`;
    });
    
    downloadCSV(csvContent, `Rapport_Avertissements_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Rapport des avertissements exporté");
}

// ==================== JOURS FÉRIÉS ====================

function displayHolidaysMenu() {
    displaySubMenu("GESTION JOURS FÉRIÉS", [
        { text: "➕ Ajouter Jour Férié", handler: () => showAddHolidayForm() },
        { text: "🗑️ Supprimer Jour Férié", handler: () => showDeleteHolidayList() },
        { text: "📋 Liste Jours Fériés", handler: () => showHolidaysList() },
        { text: "🔄 Générer Annuelle", handler: () => generateYearlyHolidays() },
        { text: "📅 Voir par Année", handler: () => showHolidaysByYear() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showAddHolidayForm() {
    const currentYear = new Date().getFullYear();
    
    let html = `
        <div class="info-section">
            <h3>🎉 Ajouter un jour férié</h3>
            <div class="form-group"><label>Date:</label><input type="date" id="holidayDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Description:</label><input type="text" id="holidayDesc" class="form-input" placeholder="Ex: Nouvel An, Fête du Travail..."></div>
            <div class="form-group"><label>Type:</label>
                <select id="holidayType" class="form-input">
                    <option value="fixe">Fête fixe</option>
                    <option value="religieux">Fête religieuse</option>
                    <option value="national">Fête nationale</option>
                </select>
            </div>
        </div>
    `;
    
    openPopup("🎉 Ajouter Jour Férié", html, `
        <button class="popup-button green" onclick="saveHoliday()">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="displayHolidaysMenu()">Annuler</button>
    `);
}

function saveHoliday() {
    if (!checkPassword()) return;
    
    const date = document.getElementById('holidayDate').value;
    const description = document.getElementById('holidayDesc').value;
    const type = document.getElementById('holidayType').value;
    
    if (!date || !description) {
        showSnackbar("⚠️ Veuillez remplir les champs obligatoires");
        return;
    }
    
    const existingIndex = holidays.findIndex(h => h.date === date);
    const holiday = { date: date, description: description, type: type, created_at: new Date().toISOString() };
    
    if (existingIndex !== -1) {
        holidays[existingIndex] = holiday;
        showSnackbar(`✅ Jour férié mis à jour pour le ${date}`);
    } else {
        holidays.push(holiday);
        showSnackbar(`✅ Jour férié ajouté pour le ${date}`);
    }
    
    saveData();
    closePopup();
    showHolidaysList();
}

function showDeleteHolidayList() {
    if (!holidays || holidays.length === 0) {
        showSnackbar("ℹ️ Aucun jour férié à supprimer");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>🗑️ Supprimer un jour férié</h3>
            <div class="form-group"><label>Sélectionner:</label>
                <select id="deleteHolidaySelect" class="form-input">
                    ${holidays.map(h => `<option value="${h.date}">${h.date} - ${h.description}</option>`).join('')}
                </select>
            </div>
        </div>
    `;
    
    openPopup("🗑️ Supprimer Jour Férié", html, `
        <button class="popup-button red" onclick="deleteSelectedHoliday()">🗑️ Supprimer</button>
        <button class="popup-button gray" onclick="displayHolidaysMenu()">Retour</button>
    `);
}

function deleteSelectedHoliday() {
    if (!checkPassword()) return;
    
    const date = document.getElementById('deleteHolidaySelect').value;
    const index = holidays.findIndex(h => h.date === date);
    if (index !== -1) {
        holidays.splice(index, 1);
        saveData();
        showSnackbar(`✅ Jour férié du ${date} supprimé`);
        closePopup();
        showHolidaysList();
    }
}

function showHolidaysList() {
    if (!holidays || holidays.length === 0) {
        showSnackbar("ℹ️ Aucun jour férié enregistré");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>📋 Liste des Jours Fériés</h3>
            <table class="classement-table">
                <thead><tr><th>Date</th><th>Description</th><th>Type</th></tr></thead>
                <tbody>
                    ${holidays.map(h => `
                        <tr>
                            <td>${h.date}</td>
                            <td>${h.description}</td>
                            <td>${h.type}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    openPopup("📋 Jours Fériés", html, `
        <button class="popup-button green" onclick="showAddHolidayForm()">➕ Ajouter</button>
        <button class="popup-button gray" onclick="displayHolidaysMenu()">Retour</button>
    `);
}

function generateYearlyHolidays() {
    if (!checkPassword()) return;
    
    const currentYear = new Date().getFullYear();
    const defaultHolidays = [
        { date: `${currentYear}-01-01`, description: 'Nouvel An', type: 'fixe' },
        { date: `${currentYear}-01-11`, description: 'Manifeste de l\'Indépendance', type: 'fixe' },
        { date: `${currentYear}-05-01`, description: 'Fête du Travail', type: 'fixe' },
        { date: `${currentYear}-07-30`, description: 'Fête du Trône', type: 'national' },
        { date: `${currentYear}-08-14`, description: 'Allégeance Oued Eddahab', type: 'national' },
        { date: `${currentYear}-08-20`, description: 'Révolution du Roi et du Peuple', type: 'national' },
        { date: `${currentYear}-08-21`, description: 'Fête de la Jeunesse', type: 'national' },
        { date: `${currentYear}-11-06`, description: 'Marche Verte', type: 'national' },
        { date: `${currentYear}-11-18`, description: 'Fête de l\'Indépendance', type: 'national' }
    ];
    
    let added = 0;
    defaultHolidays.forEach(h => {
        if (!holidays.find(existing => existing.date === h.date)) {
            holidays.push(h);
            added++;
        }
    });
    
    saveData();
    showSnackbar(`✅ ${added} jours fériés ajoutés pour ${currentYear}`);
    showHolidaysList();
}

function showHolidaysByYear() {
    const currentYear = new Date().getFullYear();
    
    let html = `
        <div class="info-section">
            <h3>📅 Jours Fériés par Année</h3>
            <div class="form-group"><label>Année:</label>
                <select id="holidaysYearSelect" class="form-input">
                    ${Array.from({length: 5}, (_, i) => currentYear - 2 + i).map(y => 
                        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
                    ).join('')}
                </select>
            </div>
            <div id="yearHolidaysList" style="margin-top: 15px;"></div>
        </div>
    `;
    
    openPopup("📅 Voir par Année", html, `
        <button class="popup-button green" onclick="displayYearHolidays()">📋 Afficher</button>
        <button class="popup-button gray" onclick="displayHolidaysMenu()">Retour</button>
    `);
}

function displayYearHolidays() {
    const year = parseInt(document.getElementById('holidaysYearSelect').value);
    const yearHolidays = holidays.filter(h => h.date.startsWith(year.toString()));
    
    if (yearHolidays.length === 0) {
        document.getElementById('yearHolidaysList').innerHTML = '<p style="color:#7f8c8d;">Aucun jour férié pour cette année</p>';
        return;
    }
    
    let html = `
        <table class="classement-table">
            <thead><tr><th>Date</th><th>Description</th><th>Type</th></tr></thead>
            <tbody>
                ${yearHolidays.map(h => `
                    <tr><td>${h.date}</td><td>${h.description}</td><td>${h.type}</td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('yearHolidaysList').innerHTML = html;
}

// ==================== EXPORTATIONS ====================

function displayExportMenu() {
    displaySubMenu("EXPORTATIONS", [
        { text: "📊 Statistiques Excel", handler: () => exportStatsExcel() },
        { text: "📅 Planning Excel", handler: () => exportPlanningExcel() },
        { text: "👥 Agents CSV", handler: () => exportAgentsToCSV() },
        { text: "📋 Congés PDF", handler: () => exportLeavesPDF() },
        { text: "📊 Rapport Complet", handler: () => exportFullReportCSV() },
        { text: "💾 Sauvegarde Complète", handler: () => backupAllData() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function exportStatsExcel() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let csvContent = `Statistiques Mensuelles - ${getMonthName(month)} ${year}\n\n`;
    csvContent += "Agent;Code;Groupe;Matin (1);Après-midi (2);Nuit (3);Repos (R);Congés (C);Maladie (M);Autre (A);Total Jours;Total Travaillés\n";
    
    activeAgents.forEach(agent => {
        const stats = { '1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0 };
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const shift = getShiftForAgent(agent.code, dateStr);
            if (stats[shift] !== undefined) stats[shift]++;
        }
        const totalTravailles = stats['1'] + stats['2'] + stats['3'];
        csvContent += `${agent.nom} ${agent.prenom};${agent.code};${agent.groupe};${stats['1']};${stats['2']};${stats['3']};${stats['R']};${stats['C']};${stats['M']};${stats['A']};${daysInMonth};${totalTravailles}\n`;
    });
    
    downloadCSV(csvContent, `Statistiques_${getMonthName(month)}_${year}.csv`);
    showSnackbar("✅ Fichier téléchargé");
}

function exportPlanningExcel() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let csvContent = `Planning ${getMonthName(month)} ${year}\n\n`;
    csvContent += "Agent;Code;Groupe;";
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        csvContent += `Jour ${day} (${JOURS_FRANCAIS[date.getDay()]});`;
    }
    csvContent += "\n";
    
    activeAgents.forEach(agent => {
        csvContent += `${agent.nom} ${agent.prenom};${agent.code};${agent.groupe};`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const shift = getShiftForAgent(agent.code, dateStr);
            csvContent += `${shift};`;
        }
        csvContent += "\n";
    });
    
    downloadCSV(csvContent, `Planning_${getMonthName(month)}_${year}.csv`);
    showSnackbar("✅ Planning exporté");
}

function exportLeavesPDF() {
    const leavesList = [];
    Object.keys(planningData).forEach(monthKey => {
        Object.keys(planningData[monthKey]).forEach(agentCode => {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C', 'M', 'A'].includes(record.shift)) {
                    leavesList.push({ agentCode, date: dateStr, type: record.shift, comment: record.comment });
                }
            });
        });
    });
    
    if (leavesList.length === 0) {
        showSnackbar("ℹ️ Aucun congé à exporter");
        return;
    }
    
    let csvContent = "Rapport des Congés et Absences\n\n";
    csvContent += "Agent;Code;Date;Type;Commentaire\n";
    
    leavesList.forEach(l => {
        const agent = agents.find(a => a.code === l.agentCode);
        csvContent += `${agent ? agent.nom + ' ' + agent.prenom : l.agentCode};${l.agentCode};${l.date};${SHIFT_LABELS[l.type]};${l.comment || ''}\n`;
    });
    
    downloadCSV(csvContent, `Rapport_Conges_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Rapport des congés exporté");
}

function exportFullReportCSV() {
    let csvContent = "Rapport Complet SGA\n\n";
    csvContent += "=== AGENTS ===\n";
    csvContent += "Code;Nom;Prénom;Groupe;Statut;Poste;Téléphone;Matricule;CIN;Date Entrée\n";
    agents.forEach(a => {
        csvContent += `${a.code};${a.nom};${a.prenom};${a.groupe};${a.statut};${a.poste || ''};${a.tel || ''};${a.matricule || ''};${a.cin || ''};${a.date_entree || ''}\n`;
    });
    
    downloadCSV(csvContent, `Rapport_Complet_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("✅ Rapport complet exporté");
}

function backupAllData() {
    const backup = {
        agents: agents,
        planningData: planningData,
        holidays: holidays,
        panicCodes: panicCodes,
        radios: radios,
        uniforms: uniforms,
        warnings: warnings,
        leaves: leaves,
        radioHistory: radioHistory,
        backupDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    downloadCSV(dataStr, `backup_sga_${new Date().toISOString().split('T')[0]}.json`);
    showSnackbar("💾 Sauvegarde complète effectuée");
}

// ==================== CONFIGURATION ====================

function displayConfigMenu() {
    displaySubMenu("CONFIGURATION", [
        { text: "⚙️ Paramètres", handler: () => showSettings() },
        { text: "🗃️ Gestion Base de Données", handler: () => showDatabaseManagement() },
        { text: "💾 Sauvegarde", handler: () => backupAllData() },
        { text: "📤 Restauration", handler: () => showRestoreOptions() },
        { text: "🗑️ Effacer Données", handler: () => showClearDataConfirm() },
        { text: "🔄 Réinitialiser", handler: () => showResetConfirm() },
        { text: "ℹ️ A propos", handler: () => showAbout() },
        { text: "↩️ Retour Menu Principal", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showSettings() {
    showSnackbar("⚙️ Paramètres - fonctionnalité à venir");
}

function showDatabaseManagement() {
    showSnackbar("🗃️ Gestion Base de Données - utilisez les options de sauvegarde");
}

function showRestoreOptions() {
    showSnackbar("📤 Restauration - fonctionnalité à venir");
}

function showClearDataConfirm() {
    if (!checkPassword()) return;
    if (confirm("⚠️ Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.")) {
        localStorage.clear();
        location.reload();
    }
}

function showResetConfirm() {
    showClearDataConfirm();
}

function showAbout() {
    showSnackbar("ℹ️ SGA - Système de Gestion des Agents v1.0\nDéveloppé pour CleanCo Service");
}

// ==================== FONCTIONS PLACEHOLDER (pour compatibilité) ====================

function showAgentPlanning(agentCode) {
    const today = new Date();
    showAgentPlanningDetails(agentCode, today.getMonth() + 1, today.getFullYear());
}

function showAgentPlanningDetails(agentCode, month, year) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let html = `
        <div class="info-section">
            <h3>Planning de ${agent.nom} ${agent.prenom}</h3>
            <div style="overflow-x: auto;">
                <table class="planning-table">
                                        <thead>
                        <tr><th>Date</th><th>Jour</th><th>Shift</th><th>Description</th></thead>
                    <tbody>
                        ${Array.from({length: daysInMonth}, (_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month - 1, day);
                            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                            const dayName = JOURS_FRANCAIS[date.getDay()];
                            const shift = getShiftForAgent(agentCode, dateStr);
                            const shiftLabel = SHIFT_LABELS[shift] || shift;
                            const color = SHIFT_COLORS[shift] || '#7f8c8d';
                            return `
                                <tr>
                                    <td>${dateStr}</td>
                                    <td>${dayName}</td>
                                    <td style="background-color:${color}; color:white; text-align:center;">${shift}</td>
                                    <td>${shiftLabel}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    openPopup(`📅 Planning ${agent.code}`, html, `
        <button class="popup-button gray" onclick="closePopup()">Fermer</button>
    `);
}

function showAgentStats(agentCode) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    const today = new Date();
    const startDate = new Date(today.getFullYear(), 0, 1);
    const endDate = new Date(today.getFullYear(), 11, 31);
    const stats = calculateAgentDetailedStats(agentCode, startDate, endDate);
    
    let html = `
        <div class="info-section">
            <h3>📊 Statistiques de ${agent.nom} ${agent.prenom}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 15px 0;">
                <div style="text-align: center; padding: 10px; background: #2c3e50; border-radius: 5px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${stats.workedDays}</div>
                    <div>Jours travaillés</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #2c3e50; border-radius: 5px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #f39c12;">${stats.workRate}%</div>
                    <div>Taux présence</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #2c3e50; border-radius: 5px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #e74c3c;">${stats.leaves + stats.sickDays + stats.otherAbsences}</div>
                    <div>Absences</div>
                </div>
            </div>
        </div>
    `;
    
    openPopup(`📊 Stats ${agent.code}`, html, `
        <button class="popup-button gray" onclick="closePopup()">Fermer</button>
    `);
}

function showAddLeaveForAgent(agentCode) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    let html = `
        <div class="info-section">
            <h3>🏖️ Ajouter un Congé pour ${agent.nom} ${agent.prenom}</h3>
            <div class="form-group"><label>Type:</label>
                <select id="leaveTypeForAgent" class="form-input">
                    <option value="C">Congé payé</option>
                    <option value="M">Maladie</option>
                    <option value="A">Autre absence</option>
                </select>
            </div>
            <div class="form-group"><label>Date:</label><input type="date" id="leaveDateForAgent" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Commentaire:</label><textarea id="leaveCommentForAgent" class="form-input" rows="3"></textarea></div>
        </div>
    `;
    
    openPopup(`🏖️ Congé pour ${agent.code}`, html, `
        <button class="popup-button green" onclick="saveLeaveForAgent('${agentCode}')">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function saveLeaveForAgent(agentCode) {
    if (!checkPassword()) return;
    
    const leaveType = document.getElementById('leaveTypeForAgent').value;
    const leaveDate = document.getElementById('leaveDateForAgent').value;
    const comment = document.getElementById('leaveCommentForAgent').value;
    
    if (!leaveDate) {
        showSnackbar("⚠️ Veuillez sélectionner une date");
        return;
    }
    
    const monthKey = leaveDate.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][leaveDate] = {
        shift: leaveType,
        type: 'absence',
        comment: comment,
        recorded_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ ${SHIFT_LABELS[leaveType]} enregistré pour ${agentCode} le ${leaveDate}`);
    closePopup();
}

function showAbsenceFormForDate(agentCode, dateStr) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    let html = `
        <div class="info-section">
            <h3>🚫 Ajouter une Absence pour ${agent.nom} ${agent.prenom}</h3>
            <p>Date: <strong>${dateStr}</strong></p>
            <div class="form-group"><label>Type:</label>
                <select id="absenceType" class="form-input">
                    <option value="C">Congé payé</option>
                    <option value="M">Maladie</option>
                    <option value="A">Autre absence</option>
                </select>
            </div>
            <div class="form-group"><label>Commentaire:</label><textarea id="absenceComment" class="form-input" rows="3"></textarea></div>
        </div>
    `;
    
    openPopup(`🚫 Absence pour ${agent.code}`, html, `
        <button class="popup-button green" onclick="saveAbsenceForDate('${agentCode}', '${dateStr}')">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function saveAbsenceForDate(agentCode, dateStr) {
    if (!checkPassword()) return;
    
    const absenceType = document.getElementById('absenceType').value;
    const comment = document.getElementById('absenceComment').value;
    
    const monthKey = dateStr.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][dateStr] = {
        shift: absenceType,
        type: 'absence',
        comment: comment,
        recorded_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ ${SHIFT_LABELS[absenceType]} enregistré pour ${agentCode} le ${dateStr}`);
    closePopup();
}

function showShiftModification(agentCode, dateStr, currentShift) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    
    let html = `
        <div class="info-section">
            <h3>✏️ Modifier le Shift pour ${agent.nom} ${agent.prenom}</h3>
            <p>Date: <strong>${dateStr}</strong></p>
            <p>Shift actuel: <strong style="background-color:${SHIFT_COLORS[currentShift]}; color:white; padding:2px 8px; border-radius:12px;">${currentShift} - ${SHIFT_LABELS[currentShift] || currentShift}</strong></p>
            <div class="form-group"><label>Nouveau shift:</label>
                <select id="newShiftModify" class="form-input">
                    ${Object.entries(SHIFT_LABELS).map(([code, label]) => `
                        <option value="${code}" ${code === currentShift ? 'selected' : ''}>${code} - ${label}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group"><label>Commentaire:</label><textarea id="shiftModifyComment" class="form-input" rows="3" placeholder="Raison du changement..."></textarea></div>
        </div>
    `;
    
    openPopup(`✏️ Modifier Shift ${agent.code}`, html, `
        <button class="popup-button green" onclick="saveShiftModification('${agentCode}', '${dateStr}')">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="closePopup()">Annuler</button>
    `);
}

function saveShiftModification(agentCode, dateStr) {
    if (!checkPassword()) return;
    
    const newShift = document.getElementById('newShiftModify').value;
    const comment = document.getElementById('shiftModifyComment').value;
    
    const monthKey = dateStr.substring(0, 7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    
    planningData[monthKey][agentCode][dateStr] = {
        shift: newShift,
        type: 'modification_manuelle',
        comment: comment,
        modified_at: new Date().toISOString()
    };
    
    saveData();
    showSnackbar(`✅ Shift modifié pour ${agentCode} le ${dateStr}`);
    closePopup();
}

function printPlanning() {
    window.print();
}

function printAgentPlanning(agentCode, month, year) {
    window.print();
}

function previewShiftExchange() {
    showSnackbar("👁️ Prévisualisation échange - utilisez le formulaire d'échange");
}

function showGroupStats(group, month, year) {
    showSnackbar(`📊 Stats Groupe ${group} - fonctionnalité à venir`);
}

function generatePlanningForGroup(group, month, year) {
    showSnackbar(`🔄 Génération planning Groupe ${group} - fonctionnalité à venir`);
}

function showTrimesterDetailed(startMonth, year) {
    showSnackbar("📊 Détail trimestriel - fonctionnalité à venir");
}

function previewLeave() {
    showSnackbar("👁️ Prévisualisation congé - fonctionnalité à venir");
}

function showEditPanicCode(agentCode) {
    showSnackbar("✏️ Modifier code panique - utilisez la liste des codes");
}

function deletePanicCode(agentCode) {
    if (!checkPassword()) return;
    
    const index = panicCodes.findIndex(p => p.agent_code === agentCode);
    if (index !== -1) {
        panicCodes.splice(index, 1);
        saveData();
        showSnackbar(`✅ Code panique supprimé pour ${agentCode}`);
        showPanicCodesList();
    }
}

function filterPanicCodes() {
    showSnackbar("🔍 Filtre codes panique - utilisez la recherche dans la liste");
}

function showAssignRadioForm() {
    const availableRadios = radios.filter(r => r.statut === 'DISPONIBLE');
    if (availableRadios.length === 0) {
        showSnackbar("⚠️ Aucune radio disponible à attribuer");
        return;
    }
    
    const activeAgents = agents.filter(a => a.statut === 'actif');
    
    let html = `
        <div class="info-section">
            <h3>📲 Attribuer une Radio</h3>
            <div class="form-group"><label>Radio:</label>
                <select id="assignRadioSelect" class="form-input">
                    ${availableRadios.map(r => `<option value="${r.id}">${r.id} - ${r.modele}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Agent:</label>
                <select id="assignAgentSelect" class="form-input">
                    ${activeAgents.map(a => `<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Motif:</label><input type="text" id="assignMotif" class="form-input" placeholder="Raison de l'attribution"></div>
        </div>
    `;
    
    openPopup("📲 Attribuer Radio", html, `
        <button class="popup-button green" onclick="executeAssignRadio()">✅ Attribuer</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Annuler</button>
    `);
}

function executeAssignRadio() {
    if (!checkPassword()) return;
    
    const radioId = document.getElementById('assignRadioSelect').value;
    const agentCode = document.getElementById('assignAgentSelect').value;
    const motif = document.getElementById('assignMotif').value;
    
    const radioIndex = radios.findIndex(r => r.id === radioId);
    if (radioIndex === -1) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    radios[radioIndex].statut = 'ATTRIBUEE';
    radios[radioIndex].attributed_to = agentCode;
    radios[radioIndex].attribution_date = new Date().toISOString().split('T')[0];
    radios[radioIndex].attribution_motif = motif;
    
    // Ajouter à l'historique
    if (!radioHistory) radioHistory = [];
    radioHistory.push({
        id: 'H' + Date.now(),
        radioId: radioId,
        agentCode: agentCode,
        action: 'ATTRIBUTION',
        date: new Date().toISOString().split('T')[0],
        details: `Attribuée à ${agentCode} - Motif: ${motif}`,
        createdBy: 'Admin'
    });
    
    saveData();
    showSnackbar(`✅ Radio ${radioId} attribuée à ${agentCode}`);
    closePopup();
    showRadiosList();
}

function showReturnRadioForm() {
    const attributedRadios = radios.filter(r => r.statut === 'ATTRIBUEE');
    if (attributedRadios.length === 0) {
        showSnackbar("⚠️ Aucune radio attribuée à retourner");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>🔄 Retourner une Radio</h3>
            <div class="form-group"><label>Radio:</label>
                <select id="returnRadioSelect" class="form-input">
                    ${attributedRadios.map(r => {
                        const agent = agents.find(a => a.code === r.attributed_to);
                        return `<option value="${r.id}">${r.id} - ${r.modele} (${agent ? agent.nom + ' ' + agent.prenom : r.attributed_to})</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group"><label>État retour:</label>
                <select id="returnCondition" class="form-input">
                    <option value="BON">Bon état</option>
                    <option value="USAGE">Légère usure</option>
                    <option value="DOMMAGE">Dommage</option>
                </select>
            </div>
            <div class="form-group"><label>Commentaire:</label><textarea id="returnComment" class="form-input" rows="2"></textarea></div>
        </div>
    `;
    
    openPopup("🔄 Retourner Radio", html, `
        <button class="popup-button green" onclick="executeReturnRadio()">✅ Retourner</button>
        <button class="popup-button gray" onclick="displayRadiosMenu()">Annuler</button>
    `);
}

function executeReturnRadio() {
    if (!checkPassword()) return;
    
    const radioId = document.getElementById('returnRadioSelect').value;
    const condition = document.getElementById('returnCondition').value;
    const comment = document.getElementById('returnComment').value;
    
    const radioIndex = radios.findIndex(r => r.id === radioId);
    if (radioIndex === -1) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    const oldAgent = radios[radioIndex].attributed_to;
    
    radios[radioIndex].statut = 'DISPONIBLE';
    radios[radioIndex].return_date = new Date().toISOString().split('T')[0];
    radios[radioIndex].return_condition = condition;
    radios[radioIndex].return_comment = comment;
    radios[radioIndex].attributed_to = null;
    
    // Ajouter à l'historique
    if (!radioHistory) radioHistory = [];
    radioHistory.push({
        id: 'H' + Date.now(),
        radioId: radioId,
        agentCode: oldAgent,
        action: 'RETOUR',
        date: new Date().toISOString().split('T')[0],
        details: `Retournée par ${oldAgent} - État: ${condition}`,
        comments: comment,
        createdBy: 'Admin'
    });
    
    saveData();
    showSnackbar(`✅ Radio ${radioId} retournée avec succès`);
    closePopup();
    showRadiosList();
}

function showEditRadioForm(radioId) {
    const radio = radios.find(r => r.id === radioId);
    if (!radio) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    let html = `
        <div class="info-section">
            <h3>✏️ Modifier Radio ${radioId}</h3>
            <div class="form-group"><label>Modèle:</label><input type="text" id="editRadioModel" value="${radio.modele}" class="form-input"></div>
            <div class="form-group"><label>Numéro de série:</label><input type="text" id="editRadioSerial" value="${radio.serial || ''}" class="form-input"></div>
            <div class="form-group"><label>Statut:</label>
                <select id="editRadioStatus" class="form-input">
                    <option value="DISPONIBLE" ${radio.statut === 'DISPONIBLE' ? 'selected' : ''}>Disponible</option>
                    <option value="ATTRIBUEE" ${radio.statut === 'ATTRIBUEE' ? 'selected' : ''}>Attribuée</option>
                    <option value="HS" ${radio.statut === 'HS' ? 'selected' : ''}>Hors Service</option>
                </select>
            </div>
        </div>
    `;
    
    openPopup(`✏️ Modifier Radio ${radioId}`, html, `
        <button class="popup-button green" onclick="saveEditRadio('${radioId}')">💾 Enregistrer</button>
        <button class="popup-button gray" onclick="showRadiosList()">Annuler</button>
    `);
}

function saveEditRadio(radioId) {
    if (!checkPassword()) return;
    
    const radioIndex = radios.findIndex(r => r.id === radioId);
    if (radioIndex === -1) {
        showSnackbar("⚠️ Radio non trouvée");
        return;
    }
    
    radios[radioIndex].modele = document.getElementById('editRadioModel').value;
    radios[radioIndex].serial = document.getElementById('editRadioSerial').value;
    radios[radioIndex].statut = document.getElementById('editRadioStatus').value;
    radios[radioIndex].updated_at = new Date().toISOString();
    
    saveData();
    showSnackbar(`✅ Radio ${radioId} mise à jour`);
    closePopup();
    showRadiosList();
}

function deleteRadio(radioId) {
    if (!checkPassword()) return;
    
    const index = radios.findIndex(r => r.id === radioId);
    if (index !== -1) {
        radios.splice(index, 1);
        saveData();
        showSnackbar(`✅ Radio ${radioId} supprimée`);
        showRadiosList();
    }
}

function filterRadios() {
    showSnackbar("🔍 Filtre radios - utilisez la recherche dans la liste");
}

function reportRadioProblem(radioId) {
    showSnackbar(`⚠️ Problème signalé pour la radio ${radioId} - contactez l'administrateur`);
}

// ==================== INITIALISATION ====================

function initApp() {
    loadData();
    console.log("✅ SGA initialisé - Version Complète");
    console.log(`📊 ${agents.length} agents chargés`);
}

// ==================== DÉMARRAGE DE L'APPLICATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    displayMainMenu();
    checkExpiredWarnings();
});

function checkExpiredWarnings() {
    const today = new Date();
    if (warnings) {
        warnings.forEach(warning => {
            if (warning.status === 'active' && warning.end_date && new Date(warning.end_date) < today) {
                warning.status = 'archived';
                warning.auto_archived = true;
            }
        });
        saveData();
    }
}

// Ajout des animations CSS si non présentes
if (!document.querySelector('#dynamic-styles')) {
    const style = document.createElement('style');
    style.id = 'dynamic-styles';
    style.textContent = `
        @keyframes fadein {
            from {bottom: 0; opacity: 0;}
            to {bottom: 30px; opacity: 1;}
        }
        @keyframes fadeout {
            from {bottom: 30px; opacity: 1;}
            to {bottom: 0; opacity: 0;}
        }
        #snackbar.show {
            visibility: visible;
            animation: fadein 0.5s, fadeout 0.5s 2.5s;
        }
        .shift-cell {
            cursor: pointer;
            transition: transform 0.2s;
        }
        .shift-cell:hover {
            transform: scale(1.05);
        }
        .weekend {
            color: #e74c3c;
        }
        .holiday {
            background-color: rgba(231, 76, 60, 0.2);
        }
    `;
    document.head.appendChild(style);
}

console.log("✅ app.js complet chargé avec tous les modules intégrés");
                    
