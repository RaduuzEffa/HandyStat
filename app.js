/**
 * Handball Stats App Logic
 * 
 * Includes MOCK BACKEND for local development.
 * When deployed to Google Apps Script, 'google.script.run' is available globally.
 */

// --- FIREBASE CONFIGURATION (Výměna za Google Sheets) ---
// ! DŮLEŽITÉ: Zde doplňte "API KEY" a "APP ID" z Firebase Console !
// Projekt: HandyStat (ID: handystat)
const firebaseConfig = {
    apiKey: "AIzaSyCGUjms7UdJezGcUT5xeBZljqv1k-6TBhU",
    authDomain: "handystat.firebaseapp.com",
    projectId: "handystat",
    storageBucket: "handystat.firebasestorage.app",
    messagingSenderId: "118412854663",
    appId: "1:118412854663:web:cc91c20149e09d54533f22"
};

// Initialize Firebase (Compat)
let db, auth;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        // Enable Offline Persistence
        db.enablePersistence().catch(err => {
            if (err.code == 'failed-precondition') {
                console.warn("Persistence failed: Multiple tabs open.");
            } else if (err.code == 'unimplemented') {
                console.warn("Persistence not supported by browser.");
            }
        });
        console.log("Firebase Initialized Successfully.");
    } else {
        console.error("Firebase SDK not found!");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
    // Continue loading app so UI doesn't freeze completely
}


// const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyMlQZauoNGvCSZTGyAqbmzjIaIVCDRXec5W54NdZFC0FSKvcay0NPLW9Vy383dQlGE/exec";
const BACKEND_URL = null; // Disabled for Firebase migration



// --- MOCK BACKEND REMOVED (Force Real Connection) ---
// if (typeof google === 'undefined') { ... }



// --- AUTH MANAGER (Simulation) ---
const authManager = {
    currentUser: null,
    isLoginMode: true,
    monthlyPrice: 60, // Fallback default

    async init() {
        if (!auth) { console.error("Firebase Auth not initialized"); return; }

        // FIREBASE AUTH LISTENER
        auth.onAuthStateChanged(async (firebaseUser) => {
            // Load Global Settings immediately when state is known (Auth or No Auth)
            // Ideally we want pricing visible even if not logged in?
            // If rules allow public read, we can keep it outside.
            // But if rules default to "auth required", we must be inside.
            // Let's try inside IF checks failed previously.

            if (firebaseUser) {
                console.log("Firebase Auth: Logged in as", firebaseUser.email);

                // Load Settings as authenticated user
                await this.loadSettings();

                // Fetch extra data from Firestore (Plan, Role)
                try {
                    const docRef = db.collection('users').doc(firebaseUser.uid);
                    const docSnap = await docRef.get();

                    if (docSnap.exists) {
                        const userData = docSnap.data();
                        this.currentUser = {
                            email: firebaseUser.email,
                            uid: firebaseUser.uid,
                            ...userData
                        };
                    } else {
                        // User exists in Auth but not DB (Should trigger register logic or create default)
                        console.warn("User has no Firestore profile. Creating default.");
                        const newUser = {
                            email: firebaseUser.email,
                            plan: 'free',
                            role: 'user',
                            subExpiry: null,
                            registeredAt: new Date().toISOString()
                        };
                        await docRef.set(newUser);
                        this.currentUser = { uid: firebaseUser.uid, ...newUser };
                    }

                    this.checkSubscription();

                    // AUTO-FIX: Ensure admin@handystat.com is always Admin/Pro
                    if (this.currentUser.email === 'admin@handystat.com' && (this.currentUser.role !== 'admin' || this.currentUser.plan !== 'pro')) {
                        console.log("Auto-Fixing Admin Account...");
                        this.currentUser.role = 'admin';
                        this.currentUser.plan = 'pro';
                        await db.collection('users').doc(this.currentUser.uid).set({ role: 'admin', plan: 'pro' }, { merge: true });
                        app.showNotification("Účet upgradován na ADMIN (Auto-Fix)", "success");
                    }

                    this.updateUI();

                } catch (e) {
                    console.error("Firestore Profile Error:", e);
                    alert("Chyba načítání profilu: " + e.message);
                }
            } else {
                console.log("Firebase Auth: Signed out");
                this.currentUser = null;
                this.updateUI();

                // Optional: Show Login if explicit app policy
                // this.openLogin(); 
            }
        });
    },

    checkSubscription() {
        if (!this.currentUser) return;
        if (this.currentUser.plan === 'pro') {
            const now = new Date();
            const expiry = new Date(this.currentUser.subExpiry);
            if (now > expiry) {
                this.currentUser.plan = 'free';
                this.currentUser.subExpiry = null;
                this.saveUser();
                app.showNotification("Vaše PRO předplatné vypršelo.", "warning");
            }
        }
    },

    saveUser() {
        // Sync local changes to Firestore
        if (this.currentUser && this.currentUser.uid) {
            const docRef = db.collection('users').doc(this.currentUser.uid);
            // Don't overwrite whole doc blindly if we just want to update plan/expiry
            // But for simplicity of this migration, set merge = true
            const dataToSave = { ...this.currentUser };
            delete dataToSave.uid; // don't store uid inside doc if using doc-id

            docRef.set(dataToSave, { merge: true }).catch(err => console.error("Save User Error:", err));
        }
        this.updateUI();
    },

    updateUI() {
        // alert("DEBUG UI UPDATE: User=" + (this.currentUser ? this.currentUser.email : 'null'));
        const emailDisplay = document.getElementById('user-email-display');
        const planBadge = document.getElementById('user-plan-badge');
        const btnAuth = document.getElementById('btn-auth-action');
        const btnUpgrade = document.getElementById('btn-upgrade-pro');
        const btnAdmin = document.getElementById('btn-admin-dashboard');

        if (!emailDisplay) return;

        // Reset Admin Button Logic
        if (btnAdmin) btnAdmin.style.display = 'none';

        if (this.currentUser) {
            emailDisplay.textContent = this.currentUser.email;
            btnAuth.textContent = "Odhlásit";
            btnAuth.className = "btn-secondary"; // NEUTRAL STYLE
            btnAuth.style.border = "1px solid rgba(255,255,255,0.3)"; // THIN BORDER
            btnAuth.setAttribute('onclick', 'authManager.logout()');

            // ADMIN LOGIC
            if (this.currentUser.role === 'admin' && btnAdmin) {
                btnAdmin.style.display = 'inline-block';
            }

            if (this.currentUser.plan === 'pro') {
                planBadge.textContent = "PRO";
                planBadge.style.background = "#2ecc71";
                btnUpgrade.style.display = 'none';
                this.enableProFeatures();
            } else {
                planBadge.textContent = "FREE";
                planBadge.style.background = "#95a5a6";
                btnUpgrade.style.display = 'inline-block';
                this.disableProFeatures();
            }
        } else {
            emailDisplay.textContent = "Nepřihlášen";
            planBadge.textContent = "-";
            btnAuth.textContent = "Přihlásit";
            btnAuth.className = "btn-primary"; // PRIMARY STYLE
            btnAuth.style.border = ""; // RESET BORDER
            btnAuth.setAttribute('onclick', 'authManager.openLogin()');
            btnUpgrade.style.display = 'none';
            this.disableProFeatures();
        }
    },

    openLogin() {
        this.isLoginMode = true;
        // Don't overwrite title "HandyStat". If we want to say "Login", maybe add a subtitle?
        // precise requirements: "Logo a název HandyStat ... do úvodního vyskakovacího okna".
        // The button says "Přihlásit". That is enough context.
        // document.getElementById('auth-modal-title').textContent = "HandyStat"; // Keep static

        document.getElementById('btn-submit-auth').textContent = "Přihlásit";
        document.getElementById('auth-switch-text').innerHTML = 'Nemáte účet? <span style="text-decoration: underline;">Zaregistrujte se</span>';
        document.getElementById('modal-auth').classList.add('show');

        // Reset Error
        const errMsg = document.getElementById('auth-error-msg');
        if (errMsg) { errMsg.style.display = 'none'; errMsg.textContent = ''; }
    },

    openUpgrade() {
        document.getElementById('modal-upgrade').classList.add('show');
    },

    async openAdmin() {
        // Show modal locally immediately
        this.renderUserList();
        document.getElementById('modal-admin').classList.add('show');

        // SYNC WITH FIREBASE (Cloud)
        try {
            const snapshot = await db.collection('users').get();
            console.log(`Sync: Loaded ${snapshot.size} users from Firestore.`);

            // Clear old local cache related to users? Maybe risky if offline.
            // Let's just overwrite/update
            snapshot.forEach(doc => {
                const userData = doc.data();
                // We store in localStorage format 'ag_user_EMAIL' to reuse existing renderUserList
                if (userData.email) {
                    localStorage.setItem('ag_user_' + userData.email, JSON.stringify(userData));
                }
            });

            this.renderUserList();
            app.showNotification("Seznam uživatelů aktualizován", "success");

        } catch (error) {
            console.error("Admin Sync Error:", error);
            app.showNotification("Chyba načítání uživatelů z cloudu", "warning");
        }
    },

    renderUserList() {
        const tbody = document.getElementById('admin-user-list');
        tbody.innerHTML = '';

        const searchQ = document.getElementById('admin-search-input').value.toLowerCase();
        const planFilter = document.getElementById('admin-filter-plan').value;

        const users = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('ag_user_')) {
                users.push(JSON.parse(localStorage.getItem(key)));
            }
        }

        // Sort: Admins first, then by email
        users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return a.email.localeCompare(b.email);
        });

        users.forEach(u => {
            // FILTERING logic
            if (searchQ && !u.email.toLowerCase().includes(searchQ)) return;
            if (planFilter !== 'all' && u.plan !== planFilter) return;

            const isPro = u.plan === 'pro';
            const isAdmin = u.role === 'admin';

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #333";
            tr.style.background = "#222"; // Dark style
            tr.style.color = "#eee";

            // Format Expiry
            let dateVal = '';
            if (u.subExpiry) {
                try { dateVal = new Date(u.subExpiry).toISOString().split('T')[0]; } catch (e) { }
            }

            // ACTIONS COLUMN
            // User requested: "Roztáhni oko", "Upgrade/Downgrade", "Smazat"
            // We ensure buttons are visible.

            let actionsHTML = '';

            // 1. Eye (Detail) - Expanded
            // Using a wider specific style for "Eye"
            actionsHTML += `
                <button class="btn-secondary" onclick="alert('Detail uživatele: ' + '${u.email}')" 
                    style="padding: 6px 20px; font-weight:bold; margin-right: 5px; color: #3498db; border-color: #3498db;" title="Detail">
                    <i class="material-icons-round">visibility</i>
                </button>
            `;

            // 2. Modifiers (Skip for self if safest, but generally show)
            if (!isAdmin || (this.currentUser && this.currentUser.role === 'admin')) {
                actionsHTML += `
                    <button onclick="authManager.adminTogglePlan('${u.email}')" class="btn-primary" 
                        style="padding: 6px 12px; font-size: 0.8rem; margin-right: 5px; background-color: ${isPro ? '#f39c12' : '#2ecc71'}; border:none;">
                        ${isPro ? 'Downgrade' : 'Upgrade'}
                    </button>
                    <button onclick="authManager.adminDeleteUser('${u.email}')" class="btn-secondary" 
                        style="padding: 6px 12px; font-size: 0.8rem; border-color: #e74c3c; color: #e74c3c;">
                        Smazat
                    </button>
                 `;
            }

            tr.innerHTML = `
                <td style="padding: 12px;">${u.email} ${isAdmin ? '<span style="color:#9b59b6; font-weight:bold;">(ADMIN)</span>' : ''}</td>
                <td style="padding: 12px;">
                    <span style="background: ${isPro ? '#2ecc71' : '#95a5a6'}; color: #222; padding: 4px 8px; border-radius: 4px; font-weight:bold; font-size: 0.8rem;">
                        ${isPro ? 'PRO' : 'FREE'}
                    </span>
                </td>
                <td style="padding: 12px;">
                    ${isPro ?
                    `<input type="date" value="${dateVal}" 
                            onchange="authManager.adminSetExpiry('${u.email}', this.value)" 
                            style="border: 1px solid #555; padding: 4px; border-radius: 4px; background: #444; color: white;">`
                    : '<span style="opacity:0.5">-</span>'}
                </td>
                <td style="padding: 12px; text-align: right; white-space: nowrap;">
                    ${actionsHTML}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async adminSetExpiry(email, dateStr) {
        if (!dateStr) return;

        try {
            // Find user by email
            const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
            if (snapshot.empty) { alert("Uživatel nenalezen v DB."); return; }

            const doc = snapshot.docs[0];
            const newExpiry = new Date(dateStr).toISOString();

            await doc.ref.update({ subExpiry: newExpiry });

            // Update Local Cache
            const key = 'ag_user_' + email;
            const u = JSON.parse(localStorage.getItem(key)) || {};
            u.subExpiry = newExpiry;
            localStorage.setItem(key, JSON.stringify(u));

            app.showNotification("Expirace uložena", "success");

            if (this.currentUser && this.currentUser.email === email) {
                this.currentUser.subExpiry = newExpiry;
                this.saveUser(); // syncs active session
            }

        } catch (e) {
            console.error(e);
            app.showNotification("Chyba ukládání expirace", "error");
        }
    },

    // filterUsers Removed

    async adminTogglePlan(email) {
        if (!confirm(`Změnit plán pro uživatele ${email}?`)) return;

        try {
            const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
            if (snapshot.empty) { alert("Uživatel nenalezen v cloudu."); return; }

            const doc = snapshot.docs[0];
            const data = doc.data();

            let newPlan, newExpiry;
            if (data.plan === 'pro') {
                newPlan = 'free';
                newExpiry = null;
            } else {
                newPlan = 'pro';
                const d = new Date();
                d.setDate(d.getDate() + 30);
                newExpiry = d.toISOString();
            }

            await doc.ref.update({ plan: newPlan, subExpiry: newExpiry });

            // Update Local
            const key = 'ag_user_' + email;
            const u = JSON.parse(localStorage.getItem(key)) || data;
            u.plan = newPlan;
            u.subExpiry = newExpiry;
            localStorage.setItem(key, JSON.stringify(u));

            this.renderUserList();
            app.showNotification("Plán změněn (uloženo)", "success");

        } catch (e) {
            console.error(e);
            app.showNotification("Chyba změny plánu: " + e.message, "error");
        }
    },

    async adminDeleteUser(email) {
        if (!confirm(`POZOR: Opravdu smazat uživatele ${email}? \nAkce je nevratná!`)) return;

        try {
            const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
            if (snapshot.empty) { alert("Uživatel nenalezen v cloudu."); return; }

            await snapshot.docs[0].ref.delete();

            localStorage.removeItem('ag_user_' + email);
            this.renderUserList();

            app.showNotification("Uživatel smazán", "success");

        } catch (e) {
            console.error(e);
            app.showNotification("Chyba mazání: " + e.message, "error");
        }
    },

    toggleAuthMode() {
        this.isLoginMode = !this.isLoginMode;
        const verifyInput = document.getElementById('auth-password-verify');
        // Reset Error
        const errMsg = document.getElementById('auth-error-msg');
        if (errMsg) { errMsg.style.display = 'none'; errMsg.textContent = ''; }

        if (this.isLoginMode) {
            // document.getElementById('auth-modal-title').textContent = "Přihlášení"; // Keep Static
            document.getElementById('btn-submit-auth').textContent = "Přihlásit";
            document.getElementById('auth-switch-text').innerHTML = 'Nemáte účet? <span style="text-decoration: underline;">Zaregistrujte se</span>';
            if (verifyInput) verifyInput.style.display = 'none';
        } else {
            // document.getElementById('auth-modal-title').textContent = "Registrace"; // Keep Static
            document.getElementById('btn-submit-auth').textContent = "Zaregistrovat";
            document.getElementById('auth-switch-text').innerHTML = 'Máte účet? <span style="text-decoration: underline;">Přihlaste se</span>';
            if (verifyInput) verifyInput.style.display = 'block';
        }
    },

    async submitAuth() {
        console.log("submitAuth ENTRY (Firebase)");
        const btn = document.getElementById('btn-submit-auth');
        if (btn) btn.textContent = "Pracuji...";

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errMsg = document.getElementById('auth-error-msg');

        // Validation
        if (!email || !password) {
            if (errMsg) { errMsg.style.display = 'block'; errMsg.textContent = "Vyplňte všechna pole."; }
            if (btn) btn.textContent = this.isLoginMode ? "Přihlásit" : "Zaregistrovat";
            return;
        }

        try {
            if (this.isLoginMode) {
                await auth.signInWithEmailAndPassword(email, password);
                app.showNotification("Přihlášeno", "success");
            } else {
                const passwordVerify = document.getElementById('auth-password-verify').value;
                if (password !== passwordVerify) {
                    throw new Error("Hesla se neshodují.");
                }
                if (password.length < 6) {
                    throw new Error("Heslo musí mít alespoň 6 znaků.");
                }

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);

                // Auto-Admin Check
                const isAdmin = (email === 'admin@handystat.com');

                // Create Profile
                await db.collection('users').doc(userCredential.user.uid).set({
                    email: email,
                    plan: isAdmin ? 'pro' : 'free',
                    role: isAdmin ? 'admin' : 'user',
                    registeredAt: new Date().toISOString()
                }, { merge: true });

                app.showNotification("Registrace úspěšná", "success");
            }

            // CLOSING MODAL EXPLICITLY
            document.getElementById('modal-auth').classList.remove('show');

        } catch (error) {
            console.error("Auth Error:", error);
            if (errMsg) {
                errMsg.style.display = 'block';
                // Translate common firebase errors
                let msg = error.message;
                if (msg.includes('email-already-in-use')) msg = "Email je již používán.";
                if (msg.includes('wrong-password')) msg = "Špatné heslo.";
                if (msg.includes('user-not-found')) msg = "Uživatel nenalezen.";
                if (msg.includes('weak-password')) msg = "Heslo je příliš slabé.";
                errMsg.textContent = msg;
            }
        } finally {
            if (btn) btn.textContent = this.isLoginMode ? "Přihlásit" : "Zaregistrovat";
        }
    },

    sendRegistrationEmail(email, password) {
        // Mask Password: First char + ***** + Last 2 chars
        let masked = password;
        if (password.length > 3) {
            const first = password.charAt(0);
            const lastTwo = password.slice(-2);
            const stars = '*'.repeat(password.length - 3);
            masked = `${first}${stars}${lastTwo}`;
        } else {
            masked = '***'; // Fallback for short (shouldnt happen due to regex)
        }

        console.group("📧 SIMULACE EMAILU: Nová Registrace");

        console.groupEnd();

        // OPEN PROFESSIONAL MODAL
        const modal = document.getElementById('modal-email-sent');
        const details = document.getElementById('email-sent-details');

        if (modal && details) {
            details.innerHTML = `<strong>Email:</strong> ${email}<br><strong>Heslo:</strong> ${masked}`;

            // Try to open mail client for "Effect" (Optional)
            // const mailtoLink = `mailto:${email}?subject=Vítejte v HandyStat&body=Váš účet byl vytvořen.%0D%0ALogin: ${email}%0D%0AHeslo: ${masked}`;
            // window.open(mailtoLink, '_blank'); // Might be blocked by popup blocker

            modal.classList.add('show');
            modal.style.display = 'flex'; // Flex for centering
        }
    },

    logout() {
        auth.signOut().then(() => {
            app.showNotification("Odhlášeno", "info");
            // location.reload(); // Not strictly needed as listener handles UI, but good for cleanup
        });
    },

    processPayment() {
        if (!this.currentUser) return;

        // Populate Email
        const emailEl = document.getElementById('payment-email');
        if (emailEl) emailEl.textContent = "Váš e-mail";

        // Populate Price (just in case)
        this.updatePriceUI();

        // Close Upgrade Modal
        document.getElementById('modal-upgrade').classList.remove('show');

        // Open Payment Info Modal
        const m = document.getElementById('modal-payment-info');
        if (m) {
            m.classList.add('show');
            m.style.zIndex = '100005';
        } else {
            console.error("Payment modal missing");
        }
    },

    async loadSettings() {
        try {
            const doc = await db.collection('settings').doc('global_config').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.monthlyPrice) {
                    this.monthlyPrice = data.monthlyPrice;
                    this.updatePriceUI();
                }
            }
        } catch (e) {
            console.warn("Settings Load Failed:", e);
        }
    },

    updatePriceUI() {
        // Update all price instances in DOM
        const priceEls = document.querySelectorAll('.pricing-price');
        priceEls.forEach(el => {
            // Only update the one inside .pro card or just check text
            // The free one is 0 Kč, we shouldn't touch it unless we know it's PRO.
            // The DOM structure: <div class="pricing-card pro"> ... <div class="pricing-price">60 Kč</div>
            if (el.closest('.pro')) {
                el.textContent = `${this.monthlyPrice} Kč`;
            }
        });

        // Update Button Text in Upgrade Modal
        const buyBtn = document.querySelector('#modal-upgrade .btn-success');
        if (buyBtn) buyBtn.textContent = `Přejít na PRO (${this.monthlyPrice} Kč)`;

        // Update Payment Modal Text
        const paymentAmount = document.getElementById('payment-amount');
        if (paymentAmount) paymentAmount.textContent = this.monthlyPrice;

        // Update Admin Input Placeholder/Value
        const adminInput = document.getElementById('admin-price-setter');
        if (adminInput && document.activeElement !== adminInput) {
            adminInput.value = this.monthlyPrice;
        }
    },

    async adminSetPrice(val) {
        const price = parseInt(val);
        if (!price || price < 0) return;

        try {
            await db.collection('settings').doc('global_config').set({ monthlyPrice: price }, { merge: true });
            this.monthlyPrice = price;
            this.updatePriceUI();
            app.showNotification("Cena aktualizována", "success");
        } catch (e) {
            console.error(e);
            app.showNotification("Chyba při změně ceny", "error");
        }
    },

    // VALUES CHECK
    checkLimit(currentCount, isGK) {
        if (!this.currentUser) {
            this.openLogin();
            return false;
        }
        if (this.currentUser.plan === 'pro') return true;

        const limit = isGK ? 1 : 3;
        if (currentCount >= limit) {
            this.openUpgrade();
            app.showNotification(`Verze FREE: Limit ${limit} ${isGK ? 'brankáře' : 'hráčů'} naplněn!`, 'error');
            return false;
        }
        return true;
    },

    disableProFeatures() {
        const printBtns = document.querySelectorAll('.btn-print-pdf');
        printBtns.forEach(b => {
            b.classList.add('disabled-feature');
            b.title = "Dostupné pouze v PRO verzi";
            b.onclick = (e) => { e.stopPropagation(); authManager.openUpgrade(); };
        });
    },

    enableProFeatures() {
        const printBtns = document.querySelectorAll('.btn-print-pdf');
        printBtns.forEach(b => {
            b.classList.remove('disabled-feature');
            b.title = "";
            b.onclick = () => window.print();
        });
    }
};

// --- HISTORY MANAGER ---
const historyManager = {
    matches: [],

    async refresh() {
        const list = document.getElementById('history-list');
        const loading = document.getElementById('history-loading');
        if (!list || !loading) return;

        list.innerHTML = '';
        loading.style.display = 'block';

        try {
            if (!authManager.currentUser || !authManager.currentUser.uid) {
                list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Musíte být přihlášen.</td></tr>';
                return;
            }

            const uid = authManager.currentUser.uid;
            // Fetch matches mostly recent first
            const snapshot = await db.collection('matches')
                .where('uid', '==', uid)
                .orderBy('date', 'desc')
                .limit(20)
                .get();

            this.matches = [];
            if (snapshot.empty) {
                list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Žádné uložené zápasy.</td></tr>';
            } else {
                let html = '';
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const d = new Date(data.date);
                    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    this.matches.push(data);

                    html += `
                        <tr>
                            <td>${dateStr}</td>
                            <td>${data.home} vs ${data.guest}</td>
                            <td>${data.score || '-:-'}</td>
                            <td>
                                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" 
                                    onclick="historyManager.loadMatch('${data.matchId}')">
                                    Načíst
                                </button>
                            </td>
                        </tr>
                    `;
                });
                list.innerHTML = html;
            }

        } catch (e) {
            console.error("History Error:", e);
            // Index required error is common here first time
            if (e.message.includes('index')) {
                list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Chybí index. (Vytvořte index ve Firebase Console). Zobrazuji zatím bez řazení...</td></tr>';
            } else {
                list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Chyba načítání dat.</td></tr>';
            }
        } finally {
            loading.style.display = 'none';
        }
    },

    async loadMatch(matchId) {
        if (!confirm("Načtení historie přepíše aktuální data na dashboardu. Chcete pokračovat?")) return;

        try {
            document.getElementById('modal-history').classList.remove('show');
            app.showNotification("Načítám zápas...", "info");

            // 1. Fetch Events
            const snapshot = await db.collection('events')
                .where('matchId', '==', matchId)
                // .orderBy('timestamp') // optional if we trust client sorting or add index
                .get();

            const events = [];
            snapshot.forEach(doc => {
                events.push(doc.data());
            });

            // Sort by timestamp if possible, or ID
            events.sort((a, b) => a.id - b.id);

            // 2. Load into App
            app.events = events;
            app.currentMatchId = matchId; // Set context to this old match? 

            app.updateSidebarCounters();
            dashboard.updateStats();

            // Update Teams Names if stored in metadata
            const matchMeta = this.matches.find(m => m.matchId === matchId);
            if (matchMeta) {
                app.teams.home.name = matchMeta.home;
                app.teams.guest.name = matchMeta.guest;
                document.getElementById('sb-home-name').textContent = matchMeta.home;
                document.getElementById('sb-guest-name').textContent = matchMeta.guest;
            }

            app.showNotification(`Načteno ${events.length} událostí.`, "success");

        } catch (e) {
            console.error("Load Match Error", e);
            app.showNotification("Chyba načítání zápasu", "error");
        }
    }
};

// --- FILE SYSTEM MANAGER (OFFLINE MODE) ---
const fsManager = {
    handle: null,

    async selectDirectory() {
        // NO-OP for now, or maybe specific Logic if we ever want to re-enable
        // For this version "AAA", we skip directory selection and use localStorage fallback
        // app.init(); // Init is called directly now
    },

    async saveFile(filename, content) {
        if (this.handle) {
            try {
                const fileHandle = await this.handle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            } catch (e) {
                console.error(`Failed to save ${filename} to FS`, e);
                app.showNotification(`Chyba ukládání do souboru: ${filename}`, 'error');
            }
        } else {
            // FALLBACK: LocalStorage
            try {
                localStorage.setItem('fs_' + filename, content);
            } catch (e) {
                console.error("LocalStorage Save Error", e);
            }
        }
    },

    async readFile(filename) {
        if (this.handle) {
            try {
                const fileHandle = await this.handle.getFileHandle(filename, { create: false });
                const file = await fileHandle.getFile();
                const text = await file.text();
                return text;
            } catch (e) {
                // File not found is common on first run
                console.log(`File not found or read error (FS): ${filename}`);
                return null;
            }
        } else {
            // FALLBACK: LocalStorage
            return localStorage.getItem('fs_' + filename);
        }
    }
};

// --- APP STATE ---
const app = {
    view: 'setup',
    matchId: Date.now(),
    teams: {
        home: { name: 'Domácí', players: [] },
        guest: { name: 'Hosté', players: [] }
    },
    events: [],

    // --- FIREBASE SYNC HELPER ---
    currentMatchId: null,

    async saveEventToCloud(event) {
        if (!db || !this.currentMatchId) return;
        try {
            const docData = {
                matchId: this.currentMatchId,
                uid: authManager.currentUser ? authManager.currentUser.uid : 'anon',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ...event
            };
            await db.collection('events').add(docData);
        } catch (e) { console.error("Cloud Sync Error:", e); }
    },

    // SYNC MATCH METADATA (For History List)
    async saveMatchMetadata() {
        if (!db || !this.currentMatchId || !authManager.currentUser) return;
        try {
            const meta = {
                matchId: this.currentMatchId,
                uid: authManager.currentUser.uid,
                date: new Date().toISOString(),
                home: this.teams.home.name || 'Domácí',
                guest: this.teams.guest.name || 'Hosté',
                score: `${matchTimer.goals.home}:${matchTimer.goals.guest}`
            };
            await db.collection('matches').doc(this.currentMatchId).set(meta, { merge: true });
        } catch (e) { console.error("Meta Sync Error:", e); }
    },

    // UI Helpers
    navigateTo(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        this.view = viewId;

        if (viewId === 'dashboard') {
            dashboard.update();
            dashboard.updateSelectors(); // Ensure selectors are populated
        }
    },

    // PRINT HELPERS
    printMap: () => {
        document.body.classList.add('printing-map');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-map'), 500);
    },

    printLog: () => {
        document.body.classList.add('printing-log');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-log'), 500);
    },

    startMatch() {
        teamManager.showConfirm("Zahájit utkání?", async () => {
            // Explicit Save
            await this.saveSettings();

            const homeName = document.getElementById('setup-home-name').value;
            const guestName = document.getElementById('setup-guest-name').value;
            const homeText = document.getElementById('setup-home-roster').value;
            const guestText = document.getElementById('setup-guest-roster').value;

            this.teams.home.name = homeName;
            this.teams.guest.name = guestName;

            const homePlayers = this.parseRoster(homeText);
            const guestPlayers = this.parseRoster(guestText);

            // LIMIT CHECK FOR ROSTER TEXT INPUT
            if (authManager.currentUser && authManager.currentUser.plan !== 'pro') {
                const validateTeam = (players, teamName) => {
                    const gks = players.filter(p => p.position === 'GK').length;
                    const field = players.length - gks;

                    if (gks > 1) {
                        app.showNotification(`Verze FREE (${teamName}): Max 1 brankář!`, 'error');
                        authManager.openUpgrade();
                        return false;
                    }
                    if (field > 3) {
                        app.showNotification(`Verze FREE (${teamName}): Max 3 hráči!`, 'error');
                        authManager.openUpgrade();
                        return false;
                    }
                    return true;
                };

                if (!validateTeam(homePlayers, 'Domácí')) return;
                if (!validateTeam(guestPlayers, 'Hosté')) return;
            }

            this.teams.home.players = homePlayers;
            this.teams.guest.players = guestPlayers;

            // Parse Match Duration
            const durationVal = document.getElementById('setup-match-duration').value;
            const parts = durationVal.split('x'); // e.g. "2x30"
            if (parts.length === 2) {
                const mins = parseInt(parts[1]);
                if (!isNaN(mins)) {
                    matchTimer.limit = mins * 60;
                    matchTimer.currentMatchDuration = mins; // Store for logic
                    // Update Period Text with styled subtitle
                    document.getElementById('match-period').innerHTML = `1. poločas <span class="period-subtitle">(${mins} min)</span>`;
                }
            }
            matchTimer.reset(true); // Force reset to 00:00

            // Update Match UI
            document.getElementById('sb-home-name').textContent = homeName;
            document.getElementById('sb-guest-name').textContent = guestName;

            match.setActiveTeam('home');
            this.navigateTo('match');

            // Sync Metadata
            this.saveMatchMetadata();

            app.showNotification("Utkání zahájeno", "success");
        }, "Ano");
    },

    parseRoster(text) {
        if (!text || typeof text !== 'string') return [];
        return text.split('\n').filter(line => line.trim().length > 0).map((line, index) => {
            const parts = line.trim().split(' ');
            const number = parts[0];
            let name = parts.slice(1).join(' ');
            let position = null;

            // Extract position in parentheses, e.g. "Novák (BR)"
            const posMatch = name.match(/\(([^)]+)\)$/);
            if (posMatch) {
                position = posMatch[1];
                // Clean up name for display if needed
                // name = name.replace(/\s*\([^)]+\)$/, '');
                // If I remove (BR), then (BR) disappears from the match button label. 
                // Maybe keep it in name for now to avoid side effects of disappearing info, 
                // BUT store `position` property for logic.
                // name = name; // Don't strip.
            }

            return { number, name, position, isOnCourt: index < 7 };
        });
    },

    exportToCSV() {
        if (this.events.length === 0) {
            alert("Žádná data k exportu.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,ID,Cas,Tym,Hrac,Akce,Vysledek,X,Y\n";
        this.events.forEach(e => {
            csvContent += `${e.id},${e.matchTime},${e.team},${e.playerNumber},${e.actionType},${e.result},${e.positionX},${e.positionY}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `hazena_statistiky_${this.matchId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    exportDataJSON() {
        const dataToExport = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('fs_') || key.startsWith('hb_') || key === 'matchHistory' || key.startsWith('ag_')) {
                dataToExport[key] = localStorage.getItem(key);
            }
        }
        
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `HandyStat_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importDataJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                for (const key in importedData) {
                    if (importedData.hasOwnProperty(key)) {
                        localStorage.setItem(key, importedData[key]);
                    }
                }
                this.showNotification("Záloha úspěšně načtena! Aplikace se restartuje.", "success");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } catch (err) {
                console.error("Chyba při načítání zálohy:", err);
                this.showNotification("Chyba: Neplatný soubor zálohy.", "error");
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    },

    // LOADING SPINNER
    showLoading(isLoading) {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);";
            overlay.innerHTML = '<div class="spinner" style="width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.3); border-top-color: #e74c3c; border-radius: 50%; animation: spin 1s linear infinite;"></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
            document.body.appendChild(overlay);
        }
        overlay.style.display = isLoading ? 'flex' : 'none';
    },

    // NOTIFICATIONS
    showNotification(message, type = 'error') {
        // GLOBAL NOTIFICATION SYSTEM
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            // REMOVED INLINE STYLES - Handled by CSS to avoid conflicts
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        // Allow clicking off (click to dismiss)
        toast.onclick = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        };

        let icon = 'error_outline';
        if (type === 'success' || type === 'guest-success') icon = 'check_circle';

        toast.innerHTML = `<i class="material-icons-round">${icon}</i><span>${message}</span>`;
        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3s
        setTimeout(() => {
            if (toast && toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentElement) toast.remove();
                }, 300);
            }
        }, 3000);
    },
    async init() {
        // MATCH ID (Session)
        this.currentMatchId = sessionStorage.getItem('hs_match_id');
        if (!this.currentMatchId) {
            this.currentMatchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('hs_match_id', this.currentMatchId);
        }
        console.log("Match ID:", this.currentMatchId);

        // 1. Load Settings (Input fields)
        const settingsJson = await fsManager.readFile('settings.json');
        if (settingsJson) {
            try {
                const settings = JSON.parse(settingsJson);
                Object.keys(settings).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = settings[id];
                });

                // Hydrate Teams from Settings immediately (Fix for empty dropdowns on reload)
                if (settings['setup-home-name']) this.teams.home.name = settings['setup-home-name'];
                if (settings['setup-guest-name']) this.teams.guest.name = settings['setup-guest-name'];

                if (settings['setup-home-roster']) {
                    this.teams.home.players = this.parseRoster(settings['setup-home-roster']);
                }
                if (settings['setup-guest-roster']) {
                    this.teams.guest.players = this.parseRoster(settings['setup-guest-roster']);
                }
                // Update match UI names in case we are already in match view logic
                document.getElementById('sb-home-name').textContent = this.teams.home.name;
                document.getElementById('sb-guest-name').textContent = this.teams.guest.name;

            } catch (e) { console.error("Error loading settings", e); }
        }

        // 2. Init Team Manager (Async Load)
        await teamManager.init();

        // 3. Setup Change Listeners for Settings
        this.bindSettingsListeners();

        // 4. Load Match Events (Crash Recovery)
        const eventsJson = await fsManager.readFile('match_events.json');
        if (eventsJson) {
            try {
                this.events = JSON.parse(eventsJson);
                // Replay events or just load them?
                // For now, just load into array.
                // Replaying requires updating Score and Dashboard.
                // We should probably implement replaying or rely on `match_state.json` if we had it.
                // Simple version: Load array.
                console.log("Restored events:", this.events.length);
            } catch (e) { console.error("Error loading events", e); }
        }

        // 5. Initial Counter Update
        if (typeof match !== 'undefined') {
            match.updateSidebarCounters();
        }
    },

    bindSettingsListeners() {
        const fields = [
            'setup-date', 'setup-time',
            'setup-home-name', 'setup-guest-name',
            'setup-home-roster', 'setup-guest-roster',
            'setup-match-duration'
        ];

        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this.saveSettings();
                });
            }
        });
    },

    async saveSettings() {
        const data = {};
        const fields = [
            'setup-date', 'setup-time',
            'setup-home-name', 'setup-guest-name',
            'setup-home-roster', 'setup-guest-roster',
            'setup-match-duration'
        ];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) data[id] = el.value;
        });
        await fsManager.saveFile('settings.json', JSON.stringify(data, null, 2));
    },

    parseRoster(text) {
        if (!text) return [];
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // formatting: "10 Jan Novak (GK)" or "10 Jan Novak"
                // Extract Number (Start)
                const match = line.match(/^(\d+)\s+(.+)$/);
                if (!match) return null;

                const number = match[1];
                let rest = match[2];
                let position = '';

                // Extract Position (End in parens)
                const posMatch = rest.match(/\(([^)]+)\)$/);
                if (posMatch) {
                    position = posMatch[1];
                    rest = rest.replace(/\(([^)]+)\)$/, '').trim();
                }

                // Cleanup " - " if present
                if (rest.startsWith('-') || rest.startsWith('–')) {
                    rest = rest.substring(1).trim();
                }

                return { number, name: rest, position };
            })
            .filter(p => p);
    },



};

const teamManager = {
    teams: [],

    async init() {
        const saved = await fsManager.readFile('teams.json');
        if (saved) {
            try {
                this.teams = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved teams", e);
                this.teams = [];
            }
        }
        this.renderList();
        this.initRosterRows();
    },

    initRosterRows() {
        const container = document.getElementById('mgr-roster-rows');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 14; i++) {
            this.addRosterRow();
        }
    },

    addRosterRow(data = null) {
        const container = document.getElementById('mgr-roster-rows');
        const div = document.createElement('div');
        div.className = 'roster-row';
        div.innerHTML = `
            <input type="number" class="input-number" placeholder="#" value="${data ? data.number : ''}">
            <input type="text" class="input-name" placeholder="Jméno (max 15)" maxlength="15" value="${data ? data.name : ''}">
            <select class="select-position placeholder" onchange="this.classList.toggle('placeholder', this.value === '')">
                <option value="">&#9660;</option>
                <option value="GK">GK</option>
                <option value="LW">LW</option>
                <option value="LB">LB</option>
                <option value="CB">CB</option>
                <option value="RB">RB</option>
                <option value="RW">RW</option>
                <option value="P">P</option>
            </select>
        `;

        const select = div.querySelector('.select-position');
        if (data && data.pos) {
            select.value = data.pos;
            select.classList.remove('placeholder'); // Remove small font if has value
        }

        container.appendChild(div);
    },

    saveTeam() {
        const nameInput = document.getElementById('mgr-team-name');
        //const rosterInput = document.getElementById('mgr-team-roster'); // Removed

        const name = nameInput.value.trim();

        // Harvest Rows
        const rows = document.querySelectorAll('.roster-row');
        let lines = [];

        rows.forEach(row => {
            const num = row.querySelector('.input-number').value.trim();
            const playerName = row.querySelector('.input-name').value.trim();
            const pos = row.querySelector('.select-position').value;

            if (num && playerName) {
                // Format: "10 Novák (SS)" or just "10 Novák" if no pos
                let line = `${num} ${playerName}`;
                if (pos) line += ` (${pos})`;
                lines.push(line);
            }
        });

        const roster = lines.join('\n');

        if (!name) {
            app.showNotification("Zadejte název týmu", 'error');
            return;
        }

        // Count players approximation
        const count = lines.length;
        if (count > 30) {
            app.showNotification(`Soupiska má ${count} hráčů. Maximum je 30.`, 'error');
            return;
        }

        this.teams.push({
            id: Date.now(),
            name: name,
            roster: roster,
            playerCount: count
        });

        this.persist();
        this.renderList();

        // Clear inputs
        nameInput.value = '';
        this.initRosterRows(); // Reset rows
        app.showNotification("Tým úspěšně uložen", 'success');
    },

    deleteTeam(id) {
        // Use Global Confirm for Team Deletion too (Consistent UI)
        this.showConfirm("Opravdu chcete smazat tým?", () => {
            this.teams = this.teams.filter(t => t.id !== id);
            this.persist();
            this.renderList();
        });
    },

    getActiveCounts() {
        const active = this.currentSelection.players.filter(p => p.active);
        const gks = active.filter(p => p.originalLine.includes('(GK)') || p.originalLine.includes('(BR)')).length;
        return { gks, players: active.length - gks };
    },

    loadTo(id, type) {
        const team = this.teams.find(t => t.id === id);
        if (!team) return;

        const nameId = type === 'home' ? 'setup-home-name' : 'setup-guest-name';
        const rosterId = type === 'home' ? 'setup-home-roster' : 'setup-guest-roster';

        const nameEl = document.getElementById(nameId);
        const rosterEl = document.getElementById(rosterId);

        if (nameEl && rosterEl) {
            nameEl.value = team.name;

            // LOGIC: Use Active Players if available, otherwise full roster
            if (team.activePlayers && Array.isArray(team.activePlayers)) {
                rosterEl.value = team.activePlayers.join('\n');
            } else {
                rosterEl.value = team.roster;
            }

            // Trigger input event to save to persistence
            nameEl.dispatchEvent(new Event('input'));
            rosterEl.dispatchEvent(new Event('input'));

            const typeLabel = type === 'home' ? 'DOMÁCÍ' : 'HOSTÉ';
            const context = type === 'home' ? 'success' : 'guest-success';
            app.showNotification(`Tým "${team.name}" načten jako ${typeLabel}`, context);
        }
    },

    // --- PLAYER SELECTION FEATURE ---
    currentSelection: null, // Temporary state { teamId, players: [] }
    pendingConfirmCallback: null,

    showConfirm(message, callback, confirmLabel = 'Ano, smazat') {
        document.getElementById('confirm-message').textContent = message;
        // Updated selector for title (removed .text-danger)
        const titleEl = document.getElementById('modal-confirm-title');
        if (titleEl) titleEl.textContent = "Upozornění";

        const btnYes = document.getElementById('btn-confirm-yes');
        btnYes.textContent = confirmLabel;

        const modal = document.getElementById('modal-confirm');
        modal.classList.add('open');

        // Unbind previous
        btnYes.onclick = async () => {
            try {
                if (callback) await callback();
            } catch (e) {
                console.error("Confirm callback error:", e);
                app.showNotification("Chyba při akci.", "error");
            } finally {
                this.closeConfirm();
            }
        };
    },

    closeConfirm() {
        document.getElementById('modal-confirm').classList.remove('open');
    },

    openSelection(teamId) {
        const team = this.teams.find(t => t.id === teamId);
        if (!team) return;

        // Update Modal Header with Team Name
        const headerTitle = document.querySelector('#modal-player-selection .modal-header h3');
        if (headerTitle) headerTitle.textContent = `Vyber hráče: ${team.name}`;

        // Parse roster into objects
        // Source of Truth is `team.roster` (Master List)
        const lines = team.roster ? team.roster.split('\n').filter(l => l.trim()) : [];

        // Active Status: check against `team.activePlayers`
        // If `team.activePlayers` exists, use it. If not, default ALL to true.
        const activeList = team.activePlayers || lines;

        const players = lines.map(line => {
            return {
                originalLine: line,
                active: activeList.includes(line)
            };
        });

        this.currentSelection = {
            teamId: team.id,
            players: players
        };

        this.renderSelectionModal();
        document.getElementById('modal-player-selection').classList.add('open');
    },

    closeSelection() {
        document.getElementById('modal-player-selection').classList.remove('open');
        this.currentSelection = null;
    },

    renderSelectionModal() {
        if (!this.currentSelection) return;
        const list = document.getElementById('selection-list');
        list.innerHTML = '';

        // Add "New Player" Input Row (Structured)
        const addRow = document.createElement('div');
        addRow.className = 'add-player-row';
        addRow.innerHTML = `
            <div class="roster-row" style="flex: 1; margin-bottom: 0;">
                <input type="number" id="modal-input-number" class="input-number" placeholder="#">
                <input type="text" id="modal-input-name" class="input-name" placeholder="Jméno (max 15)" maxlength="15">
                <select id="modal-select-pos" class="select-position placeholder" onchange="this.classList.toggle('placeholder', this.value === '')">
                    <option value="">&#9660;</option>
                    <option value="GK">GK</option>
                    <option value="LW">LW</option>
                    <option value="LB">LB</option>
                    <option value="CB">CB</option>
                    <option value="RB">RB</option>
                    <option value="RW">RW</option>
                    <option value="P">P</option>
                </select>
            </div>
            <button class="btn-icon-add" onclick="teamManager.addPlayerFromInput()">
                <i class="material-icons-round">add</i>
            </button>
        `;
        list.appendChild(addRow);

        this.currentSelection.players.forEach((p, index) => {
            const item = document.createElement('div');
            item.className = `selection-item ${p.active ? 'selected' : ''}`;

            // Inner HTML structure with separate click handling
            item.innerHTML = `
                <div class="selection-content" onclick="teamManager.togglePlayerActive(${index})">
                    <i class="material-icons-round" style="margin-right:10px;">${p.active ? 'check_box' : 'check_box_outline_blank'}</i>
                    <span>${p.originalLine}</span>
                </div>
                <div class="selection-actions">
                    <button class="btn-icon-delete" onclick="teamManager.deletePlayerFromSelection(${index})">
                        <i class="material-icons-round">delete</i>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });
    },

    addPlayerFromInput() {
        const numInput = document.getElementById('modal-input-number');
        const nameInput = document.getElementById('modal-input-name');
        const posInput = document.getElementById('modal-select-pos');

        const num = numInput.value.trim();
        const playerName = nameInput.value.trim();
        const pos = posInput.value;

        if (!num || !playerName) return;

        // AUTH CHECK
        const isGK = (pos === 'GK');
        const counts = this.getActiveCounts();
        if (!authManager.checkLimit(isGK ? counts.gks : counts.players, isGK)) return;

        // Construct formatting: "10 Novák (SS)"
        let val = `${num} ${playerName}`;
        if (pos) val += ` (${pos})`;

        this.currentSelection.players.push({
            originalLine: val,
            active: true // New players default to active
        });

        this.renderSelectionModal();
        // Refocus handled by render, ideally we'd focus the number input back
        setTimeout(() => {
            const newNumInput = document.getElementById('modal-input-number');
            if (newNumInput) newNumInput.focus();
        }, 50);
    },

    deletePlayerFromSelection(index) {
        // Use Custom Red Confirmation
        this.showConfirm("Opravdu chcete smazat hráče?", () => {
            this.currentSelection.players.splice(index, 1);
            this.renderSelectionModal();
        });
    },

    togglePlayerActive(index) {
        if (!this.currentSelection) return;
        const p = this.currentSelection.players[index];

        // ENFORCE LIMITS FOR FREE PLAN
        if (!p.active) { // If trying to activate
            const isGK = p.originalLine.includes('(GK)') || p.originalLine.includes('(BR)');
            const counts = this.getActiveCounts();
            if (!authManager.checkLimit(isGK ? counts.gks : counts.players, isGK)) return;
        }

        p.active = !p.active;
        this.renderSelectionModal();
    },

    saveSelection() {
        if (!this.currentSelection) return;

        // 1. Update Master Roster (String)
        const allLines = this.currentSelection.players
            .map(p => p.originalLine)
            .join('\n');

        // 2. Update Active Players (Array)
        const activeLines = this.currentSelection.players
            .filter(p => p.active)
            .map(p => p.originalLine);

        const team = this.teams.find(t => t.id === this.currentSelection.teamId);
        if (team) {
            team.roster = allLines; // Save master list
            team.activePlayers = activeLines; // Save active state

            // Store ACTIVE count
            team.playerCount = activeLines.length;

            this.persist();
            this.renderList();
            app.showNotification("Soupiska a výběr uloženy", 'success');
        }

        this.closeSelection();
    },

    renderList() {
        const container = document.getElementById('saved-teams-list');
        container.innerHTML = '';

        this.teams.slice().reverse().forEach(team => {
            // Calculate Active Count
            let activeCount = 0;
            if (team.activePlayers && Array.isArray(team.activePlayers)) {
                activeCount = team.activePlayers.length;
            } else if (team.roster) {
                // Default: All players active
                activeCount = team.roster.split('\n').filter(l => l.trim()).length;
            }

            const card = document.createElement('div');
            card.className = 'team-card';
            card.innerHTML = `
                <div class="team-header">
                    <strong>${team.name}</strong>
                    <span class="label-note">(${activeCount})</span>
                </div>
                <div class="team-actions">
                    <button class="btn-select" onclick="teamManager.openSelection(${team.id})" title="Vyber hráče">
                        Výběr hráčů
                    </button>
                    <button class="btn-load-home" onclick="teamManager.loadTo(${team.id}, 'home')">Načíst DOMÁCÍ</button>
                    <button class="btn-load-guest" onclick="teamManager.loadTo(${team.id}, 'guest')">Načíst HOSTÉ</button>
                    <button class="btn-delete-subtle" onclick="teamManager.deleteTeam(${team.id})" title="Smazat">
                        <i class="material-icons-round">delete_outline</i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    async persist() {
        // localStorage.setItem('hb_stats_saved_teams', JSON.stringify(this.teams));
        await fsManager.saveFile('teams.json', JSON.stringify(this.teams, null, 2));
    }
};

// --- MATCH LOGIC ---
const match = {
    // State
    selectedPlayer: null,
    activeTeamKey: 'home', // 'home' or 'guest'
    pendingSector: null,
    pendingCoords: null, // {x, y} for sector click
    pendingShotResult: null, // 'Gól', 'Neúspěšná střela'
    waitingForPlacement: false, // NEW: Direct input mode
    hasShownPlacementHint: false, // NEW: Only show hint once
    is7mMode: false, // Track if 7m mode is active
    halftimeScore: null, // NEW: Stores {home, guest} at end of H1

    // Shot Logic State
    // pendingCoords: null, // For modal flow (This was moved and updated above)
    // pendingShotResult: null, // For modal flow (This was moved and updated above)
    tempResult: null, // For modal flow

    // pendingAction: null, // New: track action waiting for court click (This is replaced by the new comment on score)
    tempShotCoords: null, // New: coords waiting for result selection
    shotTimer: null, // Timer regarding the 2s limit
    lastPosition: null, // {x: 0.5, y: 0.5} relative
    score: { home: 0, guest: 0 }, // New: track action waiting for court click

    // Substitution Logic
    subOutMode: false,
    tempSubInPlayer: null, // Track player to be subbed in

    setActiveTeam(teamKey) {
        this.activeTeamKey = teamKey;

        // Update UI
        document.getElementById('btn-team-home').classList.toggle('active', teamKey === 'home');
        document.getElementById('btn-team-guest').classList.toggle('active', teamKey === 'guest');

        // Update Global Context (for colors)
        document.body.classList.toggle('guest-mode', teamKey === 'guest');

        // Update Grid context for CSS styling
        const container = document.querySelector('.players-panel');
        if (container) container.dataset.activeTeam = teamKey;

        this.renderPlayers();
        this.updateSidebarCounters(); // Refresh stats counters for the active team
    },

    toggleSubOutMode() {
        this.subOutMode = !this.subOutMode;

        // Update Button Visual
        const btn = document.getElementById('btn-sub-out-toggle');
        if (btn) {
            if (this.subOutMode) {
                btn.classList.add('active'); // CSS should handle red border
            } else {
                btn.classList.remove('active');
            }
        }
    },

    confirmSubIn() {
        if (!this.tempSubInPlayer) return;

        // Logic: Add to Court
        const team = app.teams[this.activeTeamKey];
        const p = team.players.find(x => x.number === this.tempSubInPlayer);

        if (p) {
            // Check limit
            const currentCourt = team.players.filter(px => px.isOnCourt).length;
            if (currentCourt >= 7) {
                app.showNotification("Na hřišti je již max 7 hráčů!", "warning");
                // We allow it? User said "Activate na hřiště", implied force. 
                // Let's allow but warn.
            }
            p.isOnCourt = true;
            this.renderPlayers();
        }

        // Close Modal
        document.getElementById('modal-sub-in-confirm').classList.remove('show');
        this.tempSubInPlayer = null;
    },

    handlePlayerClick(number) {
        // Prevent click if dragging
        // (Handled by onclick vs ondrag logic usually, but here we are explicit)

        const team = app.teams[this.activeTeamKey];
        const player = team.players.find(p => p.number == number); // Loose equality safe
        if (!player) return;

        // SCENARIO 1: Sub Out Mode Active
        if (this.subOutMode) {
            if (player.isOnCourt) {
                player.isOnCourt = false;
                this.renderPlayers();

                // FIX: Clear selection so button doesn't stay green/selected
                this.selectedPlayer = null;
                document.querySelectorAll('.player-btn.active').forEach(b => b.classList.remove('active'));

                // Optional: Turn off sub mode after one action? 
                // User said "Po stisknutí se tlačítko deaktivuje" -> YES
                this.toggleSubOutMode();
            } else {
                app.showNotification("Hráč není na hřišti", "warning");
            }
            return;
        }

        // SCENARIO 2: Player IS ON COURT (Game Action or Selection)
        // GK IS A PLAYER. No special logic here.
        if (player.isOnCourt) {
            // CRITICAL FIX: Reset Placement Mode if user selects a new player
            // This prevents "Modal Not Opening" if previous action was interrupted
            if (this.waitingForPlacement) {
                this.waitingForPlacement = false;
                document.getElementById('court-alert-overlay').style.display = 'none';
                document.querySelector('.goal-structure').style.cursor = 'default';
            }

            // Existing Selection Logic
            this.selectPlayer(player.number);
            return;
        }

        // SCENARIO 3: Player IS BENCH (Sub In)
        if (!player.isOnCourt) {
            this.tempSubInPlayer = player.number;
            const modal = document.getElementById('modal-sub-in-confirm');
            document.getElementById('sub-in-player-name').textContent = `${player.number} ${player.name}`;
            modal.classList.add('show');

            // Re-bind confirm button to ensure clean state
            const btnConfirm = document.getElementById('btn-confirm-sub-in');
            btnConfirm.onclick = () => this.confirmSubIn();
        }
    },

    renderPlayers() {
        const grid = document.getElementById('roster-all');
        if (!grid) return;

        grid.innerHTML = '';
        const players = app.teams[this.activeTeamKey].players;

        // Sort: OnCourt First? Or By Number? 
        // User said "Jedním prostorem". Usually by number is standard, 
        // but maybe grouped is better visual. Let's stick to Number sort for "Roster" feel.
        // Or keep existing order from input.

        // Assuming players are sorted by number string or input order.

        // Render ALL players
        players.forEach(p => {
            const btn = document.createElement('div');
            const isActive = (this.selectedPlayer == p.number);
            const isOnCourt = p.isOnCourt;

            // Classes
            // .player-btn (Base)
            // .on-court (Green Border)
            // .active (Full Green Background - Selection)

            let cls = `player-btn ${isOnCourt ? 'on-court' : ''} ${isActive ? 'active' : ''}`;

            btn.className = cls;

            // FORCE STYLES (User request: Align left with 16px offset, Force Green on Active)
            // Using inline styles to guarantee overrides
            btn.style.justifyContent = 'flex-start';
            btn.style.paddingLeft = '16px'; // "o 16px" - updated as requested

            if (isActive) {
                btn.style.setProperty('background-color', '#2ecc71', 'important');
                btn.style.setProperty('border-color', '#2ecc71', 'important');
                btn.style.setProperty('color', '#ffffff', 'important');
            }

            // Content
            let displayName = p.name;
            if (displayName.length > 12) displayName = displayName.substring(0, 12);
            let label = `${p.number} ${displayName}`;
            if (p.position) label += ` <span style="font-size:0.7em; opacity:0.7;">(${p.position})</span>`;

            btn.innerHTML = `<span>${label}</span>`;

            // Click (New Logic)
            btn.onclick = () => this.handlePlayerClick(p.number);

            grid.appendChild(btn);
        });

        // Count update (if needed) - removed old counters
    },

    // --- PENALTY COMPONENT ---
    openPenaltyModal() {
        if (!this.selectedPlayer) {
            app.showNotification("Vyber hráče, kterému chceš udělit trest.", "warning");
            return;
        }

        // Highlight Trigger Button
        const trigger = document.getElementById('btn-tresty-trigger');
        if (trigger) trigger.classList.add('active-tresty');

        // Open Modal
        const modal = document.getElementById('modal-penalty-selection');
        if (modal) modal.classList.add('open');
    },

    closePenaltyModal() {
        const modal = document.getElementById('modal-penalty-selection');
        if (modal) {
            modal.classList.remove('open');
            modal.classList.remove('show');
            // Force hide to be sure
            // modal.style.display = 'none'; // Removing this might break transition if used, but safe fallback
        }

        // Remove Highlight
        const trigger = document.getElementById('btn-tresty-trigger');
        if (trigger) trigger.classList.remove('active-tresty');
    },

    handlePenaltyAction(type) {
        try {
            // type: 'Žlutá karta', '2min', 'Červená karta', 'Modrá karta'

            // 1. Log Action (Red)
            // logActionWithCoords handles colors based on type string.
            // I need to ensure 'Žlutá karta' etc triggers Red color. 
            // Checking logActionUI logic (Line 1601): includes 'Karta', 'Červená', 'Modrá', '2m'.
            // So standard names work.

            // 2. Move Player Logic
            if (type === '2min' || type === 'Červená karta' || type === 'Modrá karta') {
                const team = app.teams[this.activeTeamKey];
                const p = team.players.find(pl => pl.number == this.selectedPlayer);
                if (p && p.isOnCourt) {
                    p.isOnCourt = false;
                    // Re-render handled by logActionWithCoords -> renderPlayers?? 
                    // logActionWithCoords calls renderPlayers IF it's '2min'.
                    // I should update logActionWithCoords to handle Red/Blue too, OR just do it here.
                    // Doing it here is safer/explicit.
                }
            }

            // 3. Log it
            this.logActionWithCoords(type, null, null);

            // 4. Force Render (to show bench move)
            this.renderPlayers();

        } catch (e) {
            console.error("Penalty Action Error:", e);
            app.showNotification("Chyba při zápisu trestu", "error");
        } finally {
            // 5. Close & Reset - ALWAYS
            this.closePenaltyModal();
            this.selectedPlayer = null;
            document.querySelectorAll('.player-btn.active').forEach(b => b.classList.remove('active'));
        }
    },

    // --- TECHNICAL FAULTS COMPONENT ---
    openTechnicalModal() {
        if (!this.selectedPlayer) {
            app.showNotification("Vyber hráče pro technickou chybu.", "warning");
            return;
        }

        // Highlight Trigger (Reuse Tresty Highlight or Create New?)
        // User said "stejnou logikou". I will assume Highlight Red for "Negative" action.
        const trigger = document.getElementById('btn-tech-faults-trigger');
        if (trigger) trigger.classList.add('active-tresty');
        // Using 'active-tresty' ensures Red Flash assuming the button base supports it.
        // The button is 'defense-btn btn-dark-gray'.
        // Adding 'active-tresty' makes it Red + Pulse.

        // Open Modal
        const modal = document.getElementById('modal-tech-faults');
        if (modal) {
            modal.classList.add('open');
            modal.classList.add('show');
        }
    },

    closeTechnicalModal() {
        const modal = document.getElementById('modal-tech-faults');
        if (modal) {
            modal.classList.remove('open');
            modal.classList.remove('show');
        }

        // Remove Highlight
        const trigger = document.getElementById('btn-tech-faults-trigger');
        if (trigger) trigger.classList.remove('active-tresty');
    },

    handleTechnicalAction(type) {
        try {
            // type: 'Přihrávkou', 'Kroky', 'Přešlap'
            // User Formatting Request: "T.CH. type"
            // Also handle "Technická chyba" generic if used?

            let logType = type;
            // Don't double prepend if already there (defensive)
            if (!type.startsWith('T.CH.')) {
                logType = `T.CH. ${type}`;
            }

            // Log it
            this.logActionWithCoords(logType, null, null);

        } catch (e) {
            console.error("Tech Fault Error:", e);
            app.showNotification("Chyba při zápisu chyby", "error");
        } finally {
            // Close & Reset - ALWAYS
            this.closeTechnicalModal();
            this.selectedPlayer = null;
            document.querySelectorAll('.player-btn.active').forEach(b => b.classList.remove('active'));
        }
    },



    toggleCourtStatus(number) {
        const players = app.teams[this.activeTeamKey].players;
        const player = players.find(p => p.number === number);
        if (!player) return;

        if (!player.isOnCourt) {
            // Moving to court
            const currentOnCourt = players.filter(p => p.isOnCourt).length;
            if (currentOnCourt >= 7) {
                app.showNotification("Překročen počet hráčů na hřišti (max 7)!");
                return;
            }
        }

        player.isOnCourt = !player.isOnCourt;
        this.renderPlayers();
    },

    openGKSelection() {
        // Filter Bench Players who are GKs (Supports legacy 'BR' and new 'GK')
        const players = app.teams[this.activeTeamKey].players;
        const benchGKs = players.filter(p =>
            !p.isOnCourt && (p.position === 'GK' || p.position === 'BR' || p.name.includes('(GK)') || p.name.includes('(BR)'))
        );

        const list = document.getElementById('gk-select-list');
        list.innerHTML = '';

        if (benchGKs.length === 0) {
            list.innerHTML = '<p style="padding: 20px; color: #aaa; text-align: center;">Žádný dostupný brankář na lavičce.</p>';
        } else {
            benchGKs.forEach(p => {
                const btn = document.createElement('button');
                btn.className = 'btn-secondary btn-full';
                btn.style.marginBottom = '10px';
                btn.textContent = `${p.number} ${p.name}`;
                btn.onclick = () => {
                    this.toggleCourtStatus(p.number);
                    document.getElementById('modal-gk-select').classList.remove('open');
                };
                list.appendChild(btn);
            });
        }

        document.getElementById('modal-gk-select').classList.add('open');
    },

    handleDragStart(e, number) {
        e.dataTransfer.setData('text/plain', number);
        e.dataTransfer.effectAllowed = 'move';
    },

    handleDrop(e, targetIsOnCourt) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const number = e.dataTransfer.getData('text/plain');
        if (!number) return;

        const players = app.teams[this.activeTeamKey].players;
        const player = players.find(p => p.number == number); // lax comparison for string/int

        if (player) {
            // Restriction: If dropped explicitly on GK Slot, check if player is GK
            const dropTarget = e.target.closest('.gk-slot');
            if (dropTarget && targetIsOnCourt) {
                const isGK = player.position === 'GK' || player.position === 'BR' || player.name.includes('(GK)');
                if (!isGK) {
                    app.showNotification("Na pozici brankáře lze vložit pouze hráče s označením GK!", "error");
                    return;
                }
            }

            if (player.isOnCourt !== targetIsOnCourt) {
                this.toggleCourtStatus(player.number);
            }
        }
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(e) {
        // Prevent flickering when dragging over children
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
        e.currentTarget.classList.remove('drag-over');
    },

    selectPlayer(number, element) {
        // RESET Placement Mode if active (User changed mind / clicked player instead of goal)
        if (this.waitingForPlacement) {
            this.waitingForPlacement = false;
            document.getElementById('court-alert-overlay').style.display = 'none';
            document.querySelector('.goal-structure').style.cursor = 'default';
            this.pendingShotResult = null; // Clear pending shot
        }

        // Update State
        this.selectedPlayer = number;

        // Re-Render to apply all styles (Green Highlight, etc.)
        this.renderPlayers();

        // Auto-Open Pending Sector if strictly waiting
        if (this.pendingSector) {
            // Pass the object to handleSectorClick
            this.handleSectorClick(null, this.pendingSector);
            this.pendingSector = null;
        }
    },

    updateSidebarCounters() {
        console.log("Updating Sidebar Counters...");

        // 1. Safety Checks
        if (!app.events || !Array.isArray(app.events)) {
            console.warn("App events not initialized or not an array.");
            return;
        }

        const team = this.activeTeamKey; // 'home' or 'guest'
        console.log("Active Team for Counters:", team);

        // 2. Filter Events for Active Team
        const teamEvents = app.events.filter(e => e.teamKey === team);

        // 3. Calculate Counts
        let countFast = 0;
        let countGradual = 0;
        let countDefPlus = 0;
        let countDefMinus = 0;
        let countTech = 0;
        let countPen = 0;

        teamEvents.forEach(e => {
            const type = e.actionType || "";

            if (type === 'Rychlý protiútok') countFast++;
            else if (type === 'Postupný útok') countGradual++;
            else if (type === 'Obrana +') countDefPlus++;
            else if (type === 'Obrana -') countDefMinus++;
            else if (type.startsWith('T.CH.') || ['Technická chyba', 'Kroky', 'Přešlap', 'Prorážení', 'Přihrávkou'].includes(type)) countTech++;
            else if (['Žlutá karta', '2min', 'Červená karta', 'Modrá karta'].includes(type)) countPen++;
        });

        // 4. Update DOM Elements
        const safeUpdate = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = val;
                // Optional: Add a subtle animation class to show update
                el.classList.remove('pulse-update');
                void el.offsetWidth; // Trigger reflow
                el.classList.add('pulse-update');
            } else {
                console.warn(`Counter element #${id} not found.`);
            }
        };

        safeUpdate('count-gradual-btn', countGradual);
        safeUpdate('count-fast-btn', countFast);
        safeUpdate('count-defense-plus', countDefPlus);
        safeUpdate('count-defense-minus', countDefMinus);
        safeUpdate('count-tech-faults', countTech);
        safeUpdate('count-penalties', countPen);

        console.log(`Counters Updated: Fast=${countFast}, Grad=${countGradual}, Def+=${countDefPlus}, Def-=${countDefMinus}, Tech=${countTech}, Pen=${countPen}`);
    },

    // --- 7m Logic Fixed for Buttons ---
    handle7mClick(e) {
        e.stopPropagation();

        if (!this.selectedPlayer) {
            app.showNotification("Vyber hráče!", "error");
            return;
        }

        this.is7mMode = true;

        // Setup Modal Buttons
        const player = app.teams[this.activeTeamKey].players.find(p => p.number === this.selectedPlayer);
        const btnSuccess = document.getElementById('btn-shot-success');
        const btnFail = document.getElementById('btn-shot-fail');
        const btnOffTarget = document.getElementById('btn-shot-off-target');

        // Hide Off-Target for 7m usually? Or keep? Usually "Mimo" is possible.
        // Assuming we keep existing flow but fix classes.

        // Counters update (omitted for brevity, assume existing)
        const elTotal = document.getElementById('counter-total-attacks');
        const elFb = document.getElementById('counter-fast-breaks');
        const elGradualBtn = document.getElementById('count-gradual-btn');
        const elFastBtn = document.getElementById('count-fast-btn');
        // ... (Update counters if needed)

        // ROBUST GK CHECK (GK or BR)
        const isGK = player && (player.position === 'GK' || player.position === 'BR' || (player.name && player.name.includes('GK')));

        if (isGK) {
            // GK Logic
            btnSuccess.innerText = "ÚSPĚŠNÝ ZÁKROK";
            btnSuccess.setAttribute('onclick', "match.confirmResult('Zákrok')");

            // GK Success: Purple
            btnSuccess.classList.remove('btn-success');
            btnSuccess.classList.add('btn-purple');

            btnFail.innerText = "OBDRŽENÝ GÓL";
            btnFail.setAttribute('onclick', "match.confirmResult('Obdržený gól')");

            // GK Specific: Fail button is Red
            btnFail.classList.remove('btn-yellow');
            btnFail.classList.add('btn-danger');

            if (btnOffTarget) btnOffTarget.style.display = 'block';
        } else {
            btnSuccess.innerText = "7m GÓL";
            btnSuccess.setAttribute('onclick', "match.confirmResult('Gól')");
            btnFail.innerText = "7m NEÚSPĚŠNÁ";
            btnFail.setAttribute('onclick', "match.confirmResult('Neúspěšná střela')");

            // Player Specific: Fail button is Yellow
            btnFail.classList.remove('btn-danger');
            btnFail.classList.add('btn-yellow');

            // Hide Off-Target for 7m shooter? Or Show? usually 7m can be missed/saved.
            // If missed, it's missed. 
            // In OpenShotModal we hide off-target for players?
            // "btnOffTarget.style.display = 'none'" in OpenShotModal for players. 
            // We should replicate that here for consistency unless 7m differs.
            if (btnOffTarget) btnOffTarget.style.display = 'none';
        }

        document.getElementById('modal-shot-result').classList.add('show');
    },

    // --- OLD MODAL LOGIC RESTORED ---


    // --- SHOT LOGIC & VALIDATION ---

    handleSectorClick(e, sector) {
        if (e) e.stopPropagation();

        // FIX: If we are in "Shot Placement Mode" (waiting for goal click),
        // clicking a sector zone (which covers the court) should trigger placement (Miss/Goal),
        // NOT open the modal again.

        // HOWEVER, if the user explicitly clicked a player (resetting state) OR if they are blocked:
        // Let's rely on the fact that handlePlayerClick forces reset.
        // But if they clicked the SAME player, it might toggle?

        // Refined Logic:
        // Only return if waitingForPlacement AND no new intent.
        // But sector click IS placement if waiting.

        // Use Case: User wants to override/start new.
        // If they click player -> Reset -> Select -> Then Click Court -> Should work.

        if (this.waitingForPlacement) {
            // Standard behavior: completing previous action
            this.handleGoalPlacement(e, 0);
            return;
        }

        // 1. Calculate Exact Coords from Event
        let finalX = 0.5, finalY = 0.5;
        if (e) {
            const rect = document.getElementById('court-heatmap').getBoundingClientRect();
            finalX = (e.clientX - rect.left) / rect.width;
            finalY = (e.clientY - rect.top) / rect.height;
        } else if (typeof sector === 'object' && sector.x) {
            // Re-entry from Pending with stored coords
            finalX = sector.x;
            finalY = sector.y;
            sector = sector.id;
        } else {
            // Fallback (e.g. keyboard trig?) - Should not happen usually
            const defaults = {
                'LW': { x: 0.08, y: 0.20 }, 'LB': { x: 0.20, y: 0.75 }, 'CB': { x: 0.50, y: 0.80 },
                'RB': { x: 0.80, y: 0.75 }, 'RW': { x: 0.92, y: 0.20 }, 'LP': { x: 0.35, y: 0.55 }, 'RP': { x: 0.65, y: 0.55 }
            };
            const def = defaults[sector] || { x: 0.5, y: 0.5 };
            finalX = def.x; finalY = def.y;
        }

        if (!this.selectedPlayer) {
            this.pendingSector = { id: sector, x: finalX, y: finalY }; // Store full pending object
            app.showNotification("Vyber hráče!", "error");
            return;
        }

        // 2. Open Modal with Exact Coords
        this.openShotModal(finalX, finalY);
    },

    // Guard for Goal Grid & Court Clicks
    handleShotGuard(e) {
        if (e) e.stopPropagation();

        // If in Placement Mode, treat ANY click on court/guard as a "Miss" (Zone 0)
        // unless it bubbled from Grid (which is handled separately by stopPropagation in handleGoalPlacement)
        if (this.waitingForPlacement) {
            this.handleGoalPlacement(e, 0);
            return;
        }

        if (!this.selectedPlayer) {
            // Only show notification if NOT just closing a modal or something
            // But usually this IS the error case.
            app.showNotification("Není vybraný hráč. Označ hráče a potom sektor střelby!", "warning");
        } else {
            // Player is selected, but they clicked Grid/Court instead of Sector
            app.showNotification("Vyber sektor střelby!", "warning");
        }
        // NEVER Open Modal
    },

    openShotModal(x, y) {
        const team = app.teams[this.activeTeamKey];
        const player = team.players.find(p => p.number == this.selectedPlayer);
        const btnSuccess = document.getElementById('btn-shot-success');
        const btnFail = document.getElementById('btn-shot-fail');
        const btnOffTarget = document.getElementById('btn-shot-off-target');

        const btnGKOffensive = document.getElementById('gk-offensive-actions');

        // ROBUST GK CHECK (GK or BR)
        const isGK = player && (player.position === 'GK' || player.position === 'BR' || (player.name && player.name.includes('GK')));

        if (isGK) {
            btnSuccess.innerText = "ÚSPĚŠNÝ ZÁKROK";
            btnSuccess.setAttribute('onclick', "match.confirmResult('Zákrok')");

            // GK Success: Purple
            btnSuccess.classList.remove('btn-success');
            btnSuccess.classList.add('btn-purple');

            btnFail.innerText = "OBDRŽENÝ GÓL";
            btnFail.setAttribute('onclick', "match.confirmResult('Obdržený gól')");

            // GK Fail: Red
            btnFail.classList.remove('btn-yellow');
            btnFail.classList.add('btn-danger');

            if (btnOffTarget) btnOffTarget.style.display = 'block';

            // SHOW GK OFFENSIVE ACTIONS
            if (btnGKOffensive) btnGKOffensive.style.display = 'block';

        } else {
            btnSuccess.innerText = "GÓL";
            btnSuccess.setAttribute('onclick', "match.confirmResult('Gól')");

            // Player Success: Green
            btnSuccess.classList.remove('btn-purple');
            btnSuccess.classList.add('btn-success');

            btnFail.innerText = "NEÚSPĚŠNÁ STŘELA";
            btnFail.setAttribute('onclick', "match.confirmResult('Neúspěšná střela')");

            // Player Fail: Yellow
            btnFail.classList.remove('btn-danger');
            btnFail.classList.add('btn-yellow');

            if (btnOffTarget) btnOffTarget.style.display = 'none';

            // HIDE GK OFFENSIVE ACTIONS
            if (btnGKOffensive) btnGKOffensive.style.display = 'none';
        }

        this.pendingCoords = { x, y };
        document.getElementById('modal-shot-result').classList.add('show');
    },

    handleCourtClick(e) {
        // This is now purely a Guard, same as Grid logic
        this.handleShotGuard(e);
    },

    confirmResult(resultType) {
        this.pendingShotResult = resultType;
        document.getElementById('modal-shot-result').classList.remove('show');

        // Enter Placement Mode
        this.waitingForPlacement = true;

        // Show Instruction Overlay ONLY for the first time
        if (!this.hasShownPlacementHint) {
            const overlay = document.getElementById('court-alert-overlay');
            overlay.style.display = 'block';
            overlay.style.backgroundColor = 'rgba(44, 62, 80, 0.9)'; // Darker for instruction
            overlay.textContent = "Klikni do branky pro umístění střely (nebo mimo pro aut)";
            this.hasShownPlacementHint = true;
        }

        // Highlight Goal Structure to indicate interactivity?
        document.querySelector('.goal-structure').style.cursor = 'crosshair';
    },

    handleGoalPlacement(event, zoneIndex) {
        try {
            if (!this.waitingForPlacement) return;

            event.stopPropagation(); // specific click handled

            let result = this.pendingShotResult;

            // Validation: Goal MUST be in Zone 1-9
            // Also validate "Obdržený gól" (must be in goal)
            if ((result === 'Gól' || result === '7m Gól' || result === 'Obdržený gól' || result === '7m Obdržený gól') && zoneIndex === 0) {
                app.showNotification("Gól musí být umístěn do branky!", "error");
                return; // Keep waiting
            }

            // Validation: Miss (Grey) MUST be outside Goal (Zone 0)
            // User Request: "zakázat umístění šedé střely (mimo bránu) do brány"
            if (result === 'Mimo branku' && zoneIndex > 0) {
                app.showNotification("Střela mimo bránu musí být umístěna mimo brankovou konstrukci!", "error");
                return;
            }

            let goalX = 50, goalY = 50;
            let finalZone = zoneIndex;

            if (zoneIndex > 0) {
                // Clicked Grid Cell (1-9)
                const rect = event.target.getBoundingClientRect();
                goalX = ((event.clientX - rect.left) / rect.width) * 100;
                goalY = ((event.clientY - rect.top) / rect.height) * 100;
            } else {
                // Clicked Structure or Outside (Zone 0) - Global Goal Coords
                // IRRESPECTIVE of what was clicked (goal-are, court, etc.), we map it relative to goal-structure

                const structure = document.querySelector('.goal-structure');
                if (structure) {
                    const rect = structure.getBoundingClientRect();
                    goalX = ((event.clientX - rect.left) / rect.width) * 100;
                    goalY = ((event.clientY - rect.top) / rect.height) * 100;
                    finalZone = 0;
                }
            }

            // Log Action
            // result already defined above

            // 7m Mapping
            if (this.is7mMode) {
                if (result === 'Gól') result = '7m Gól';
                else if (result === 'Neúspěšná střela') result = '7m Neúspěšná';
                // 7m Court Coords (Fixed)
                this.logActionWithCoords(result, 0.5, 0.60, finalZone, goalX, goalY);
            } else {
                // Standard Court Coords (Stored from Sector Click)
                const { x, y } = this.pendingCoords || { x: 0.5, y: 0.5 };
                this.logActionWithCoords(result, x, y, finalZone, goalX, goalY);
            }

            app.showNotification("Střela byla zapsána", "success");

        } catch (e) {
            console.error("Error in handleGoalPlacement:", e);
            app.showNotification("Chyba při zápisu střely!", "error");
        } finally {
            // Cleanup - ALWAYS Run
            this.waitingForPlacement = false;
            const overlay = document.getElementById('court-alert-overlay');
            if (overlay) overlay.style.display = 'none';
            const structure = document.querySelector('.goal-structure');
            if (structure) structure.style.cursor = 'default';

            this.is7mMode = false;
            this.selectedPlayer = null;
            document.querySelectorAll('.player-btn.active').forEach(b => b.classList.remove('active'));
            this.renderPlayers();
        }
    },

    // VISUALIZATION LOGIC
    renderShotVisuals(actionType, zoneIndex, x, y, goalX = null, goalY = null) {
        try {
            // Color Mapping
            let colorClass = '';
            // Normalize actionType
            const t = actionType ? actionType.toString().trim() : '';
            const tLow = t.toLowerCase();

            if (tLow === 'mimo branku') {
                colorClass = 'marker-grey';
            } else if (tLow.includes('gól') && !tLow.includes('obdržený') && !tLow.includes('gol')) {
                colorClass = 'marker-green';
            } else if (tLow.includes('gól') && !tLow.includes('obdržený')) {
                colorClass = 'marker-green';
            } else if (tLow.includes('obdržený')) {
                colorClass = 'marker-red';
            } else if (tLow.includes('zákrok') || tLow.includes('zakrok') || tLow.includes('krok') || tLow.includes('chyceno')) {
                colorClass = 'marker-purple';
            } else {
                colorClass = 'marker-yellow';
            }

            // 1. Draw in Goal Grid (or Structure if Zone 0)
            let targetContainer = null;
            let isGlobal = false;

            if (zoneIndex === 0) {
                targetContainer = document.querySelector('.goal-structure');
                isGlobal = true;
            } else if (zoneIndex) {
                // Try to find grid container. If grid items missing, fallback gracefully.
                targetContainer = document.querySelector(`.goal-grid-numbers div:nth-child(${zoneIndex})`);
            }

            if (targetContainer) {
                const marker = document.createElement('div');
                marker.className = `goal-marker ${colorClass}`;

                if (colorClass === 'marker-purple' || tLow.includes('krok')) {
                    marker.style.backgroundColor = '#9b59b6';
                }

                let gx, gy;
                if (goalX !== null && goalY !== null) {
                    gx = goalX;
                    gy = goalY;
                } else {
                    gx = 35 + (Math.random() - 0.5) * 40;
                    gy = 40 + (Math.random() - 0.5) * 40;
                }

                marker.style.left = `${gx}%`;
                marker.style.top = `${gy}%`;
                marker.style.transform = 'translate(-50%, -50%)';

                if (isGlobal) marker.style.zIndex = 60;

                targetContainer.appendChild(marker);
                setTimeout(() => marker.remove(), 4000);
            }

            // 2. Draw in Sector (Court)
            // Ensure container exists
            let container = document.getElementById('shot-markers');
            if (!container) {
                console.warn("Shot markers container missing! Creating...");
                container = document.createElement('div');
                container.id = 'shot-markers';
                const court = document.querySelector('.court-area');
                if (court) court.appendChild(container); // Re-attach
            }

            if (container && x !== null && y !== null) {
                const marker = document.createElement('div');
                marker.className = `shot-marker ${colorClass}`;

                if (colorClass === 'marker-purple' || tLow.includes('krok')) {
                    marker.style.backgroundColor = '#9b59b6';
                }

                let jX = 0, jY = 0;
                const is7m = (Math.abs(x - 0.5) < 0.01 && Math.abs(y - 0.60) < 0.01);
                if (is7m) {
                    jX = (Math.random() - 0.5) * 0.04;
                    jY = (Math.random() - 0.5) * 0.02;
                }

                marker.style.left = ((x + jX) * 100) + '%';
                marker.style.top = ((y + jY) * 100) + '%';

                container.appendChild(marker);
                setTimeout(() => marker.remove(), 4000);
            }
        } catch (err) {
            console.error("Render Visuals Error (Ignored):", err);
            // Ignore error so we don't block the main flow success message
        }
    },

    startShotTimer() {
        // ... (Existing Timer Logic if needed, likely irrelevant for Modal Flow but kept if referenced) ...
        // Re-implement if needed for dashboard highlights, but currently unused in Modal flow.
    },

    clearShotTimer() {
        if (this.shotTimer) clearTimeout(this.shotTimer);
        const overlay = document.getElementById('court-alert-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    setAction(actionType) {
        // Special case for Attacks: No player required
        if (actionType === 'Postupný útok' || actionType === 'Rychlý protiútok') {
            const team = this.activeTeamKey; // Guaranteed to be 'home' or 'guest'

            const event = {
                id: Date.now(),
                matchTime: matchTimer.getFormattedTime(), // Use getFormattedTime for consistency
                teamKey: team,
                playerNumber: null, // No specific player
                playerName: team === 'home' ? app.teams.home.name : app.teams.guest.name, // Team Name
                actionType: actionType,
                positionX: null, // No spatial data for attacks
                positionY: null,
                goalZone: null,
                goalX: null,
                goalY: null
            };

            // Save
            app.events.push(event);
            app.saveEventToCloud(event); // SYNC TO FIREBASE

            if (fsManager.handle) fsManager.saveFile('match_events.json', JSON.stringify(app.events, null, 2));

            this.updateSidebarCounters();
            dashboard.updateStats();

            app.showNotification(`Zapsáno: ${actionType}`, 'success');

            // UI Update
            this.logActionUI(event);

            // Sync Metadata (Update Score/Time)
            app.saveMatchMetadata();

            return;
        }

        if (!this.selectedPlayer) {
            app.showNotification('Vyber hráče!', 'error');
            return;
        }

        // Only for Non-Spatial Actions now (Cards, 2min, etc.)
        // OR distinct actions like 'Technical Fault' if added.

        // If it's a shot type button clicked directly, we might ignore or prompt?
        // But the user UI for shots is Court Click.
        // If there are buttons for "Mobile view" or specific actions like "2min":

        if (actionType === '2min' || actionType === 'Yellow Card' || actionType === 'Red Card') {
            // Player selection already checked above
            this.logActionWithCoords(actionType, null, null);
            return;
        }

        // Fallback for other buttons
        // Player selection already checked above
        this.logActionWithCoords(actionType, null, null);
    },

    logActionWithCoords(actionType, x, y, goalZone = null, goalX = null, goalY = null) {
        const teamKey = this.activeTeamKey;
        const team = app.teams[teamKey];
        const playerNum = this.selectedPlayer; // Might be null for non-player actions?

        // ... (Existing Logic for Player Name) ...
        let pName = null;
        if (playerNum) {
            const p = team.players.find(pl => pl.number == playerNum);
            if (p) {
                pName = p.name;
                // Auto-Bench 2min
                if (actionType === '2min' && p.isOnCourt) {
                    p.isOnCourt = false;
                    this.renderPlayers();
                }
            }
        }

        // Score Up
        if (actionType === 'Gól' || actionType === '7m Gól') {
            this.score[teamKey]++;
            this.updateScoreboard();
        } else if (actionType === 'Obdržený gól') {
            // GK conceded -> Opponent scores
            const oppKey = teamKey === 'home' ? 'guest' : 'home';
            this.score[oppKey]++;
            this.updateScoreboard();
        }

        // IDENTIFY ACTIVE GOALKEEPER (for filtering shots faced)
        // Find player with position 'GK' (or user defined) who is currently 'isOnCourt'
        // If multiple, maybe take the first or none.
        let currentGoalie = null;
        const teamPlayers = app.teams[teamKey] ? app.teams[teamKey].players : [];
        const activeGK = teamPlayers.find(p => (p.position === 'GK' || p.position === 'BR') && p.isOnCourt);
        if (activeGK) currentGoalie = activeGK.number;

        // For "Opponent Shots" (conceded goals), we need the GK of the DEFENDING team (activeTeamKey is Opponent/Shooter)
        // Actually, logActionWithCoords is called by the "Active Team" (who does the action).
        // If Team A shoots (Active), Team B is defending. We need Team B's GK.
        // BUT we usually track events from the perspective of the action doer.
        // Wait, 'goalieNumber' in the event should refer to the GK involved.
        // If Action is "Goal" (by Team A), involved GK is Team B's GK.

        let involvedGoalie = currentGoalie; // Default to own GK (e.g. for Saves)

        // If this is an offensive action (Goal/Miss) by Team A, we want Team B's GK.
        const isOffensive = ['Gól', '7m Gól', 'Neúspěšná střela', 'Mimo', 'Tyč'].some(t => actionType.includes(t));
        if (isOffensive) {
            const oppKey = teamKey === 'home' ? 'guest' : 'home';
            const oppPlayers = app.teams[oppKey] ? app.teams[oppKey].players : [];
            const oppGK = oppPlayers.find(p => (p.position === 'GK' || p.position === 'BR') && p.isOnCourt);
            if (oppGK) involvedGoalie = oppGK.number;
        }

        const eventData = {
            id: Date.now(),
            matchTime: matchTimer.getFormattedTime(),
            team: team.name,
            teamKey: teamKey,
            playerNumber: playerNum,
            playerName: pName,
            actionType: actionType,
            positionX: x,
            positionY: y,
            goalZone: goalZone !== null ? goalZone : null,
            goalX: goalX,
            goalY: goalY,
            goalieNumber: involvedGoalie // NEW: Track who was in goal
        };

        // Save
        // Save
        app.events.push(eventData);
        app.saveEventToCloud(eventData); // SYNC TO FIREBASE

        if (fsManager.handle) fsManager.saveFile('match_events.json', JSON.stringify(app.events, null, 2));

        try {
            this.updateSidebarCounters();
            this.updateStats();
        } catch (e) {
            console.warn("Stats Update Minor Error:", e);
        }

        // UI Feedback
        try {
            this.logActionUI(eventData);
        } catch (e) { console.warn("Log UI Failed", e); }

        // Visual Marker Logic
        this.renderShotVisuals(actionType, goalZone, x, y, goalX, goalY);

        // Sync Metadata (Update Score)
        try {
            app.saveMatchMetadata();
        } catch (e) { console.warn("Metadata Save Failed", e); }

        // TRIGGER DASHBOARD UPDATE (Timeline & Stats Table)
        try {
            if (typeof dashboard !== 'undefined' && dashboard.update) {
                dashboard.update();
            }
        } catch (e) {
            console.error("Dashboard Update Failed:", e);
            // Do not throw, as data is saved based on user report
        }

        // Clear selection is done by caller in some cases, or here?
        // Caller `handleCourtClick` clears it. `confirmPlacement` should too.
    },

    // GK Auto-Save (Opposite logic)
    // If action is "Neúspěšná" -> "Mimo"? 
    // User asked for "Neúspěšná" button.
    // If "Mimo" -> No GK save usually.
    // If "Chyceno" -> GK Save.
    // I will assume "Mimo" for now implies Miss.

    updateScoreboard() {
        document.getElementById('sb-home-score').textContent = this.score.home;
        document.getElementById('sb-guest-score').textContent = this.score.guest;
    },

    logActionUI(data) {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.style.display = 'flex';
        div.style.alignItems = 'center';

        // Colored Dot for Log
        const dot = document.createElement('span');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.marginRight = '8px';
        dot.style.flexShrink = '0';

        // Determine Color (Inline Logic for Log)
        let c = 'gray'; // default
        const t = data.actionType ? data.actionType.toString().toLowerCase() : '';
        if (t.includes('gól') && !t.includes('obdržený')) c = '#2ecc71'; // Green
        else if (t.includes('obdržený')) c = '#e74c3c'; // Red
        else if (t.includes('zákrok') || t.includes('chyceno') || t.includes('krok')) c = '#9b59b6'; // Purple (Matches Marker)
        else if (t.includes('mimo')) c = '#95a5a6'; // Grey
        else if (t.includes('neúspěšná') || t.includes('tyč')) c = '#f1c40f'; // Yellow
        else c = '#f1c40f'; // Fallback Yellow

        dot.style.backgroundColor = c;
        div.appendChild(dot);

        // Handle null player (Team Action)
        const playerStr = data.playerNumber ? `#${data.playerNumber} ${data.playerName || ''}` : `${data.playerName || 'Tým'}`;

        const textSpan = document.createElement('span');
        textSpan.textContent = `${data.matchTime} | ${playerStr} - ${data.actionType}`;
        div.appendChild(textSpan);

        const container = document.getElementById('action-logs');
        container.insertBefore(div, container.firstChild);
    },


};

// EXPOSE MATCH GLOBALLY FOR HTML ONCLICK HANDLERS
window.match = match;

// --- TIMER ---
const matchTimer = {
    interval: null,
    seconds: 0,
    state: 'h1', // 'h1', 'break', 'h2', 'overtime'
    limit: 1800, // Default 30 min
    currentMatchDuration: 30, // Derived from setup
    isRunning: false,

    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.interval = setInterval(() => {
            if (this.state === 'break' || this.state === 'overtime') {
                // Countdown logic for Break AND Overtime
                this.seconds--;
                if (this.seconds <= 0) {
                    this.seconds = 0;
                    this.stop();
                    if (this.state === 'break') {
                        this.setupSecondHalf();
                        app.showNotification("Přestávka skončila. 2. poločas připraven.", "info");
                    } else {
                        // Overtime end
                        this.handlePeriodEnd();
                    }
                }
            } else {
                // Count-up logic for Match
                this.seconds++;
                if (this.seconds >= this.limit) {
                    this.stop();
                    this.handlePeriodEnd();
                }
            }
            this.render();
        }, 1000);
    },

    stop() {
        this.isRunning = false;
        clearInterval(this.interval);
    },

    handlePeriodEnd() {
        if (this.state === 'h1') {
            app.showNotification("Konec 1. poločasu.", 'success');

            // Capture Halftime Score
            match.halftimeScore = { ...match.score };

            // 5s Delay before starting break
            app.showNotification("Přestávka začne za 5 sekund...", 'info');
            setTimeout(() => {
                this.startBreak();
            }, 5000);

        } else if (this.state === 'h2') {
            // Show Modal
            const modal = document.getElementById('modal-end-match');
            if (modal) modal.classList.add('open');
            app.showNotification("Konec základní hrací doby.", 'success');
        } else if (this.state === 'overtime') {
            app.showNotification("Konec prodloužení.", 'success');
        }
    },

    startBreak() {
        this.state = 'break';
        this.currentBreakDuration = 10; // Store for label
        this.seconds = this.currentBreakDuration * 60;
        this.render();
        // Auto-start break
        this.start();
    },

    setupSecondHalf() {
        this.state = 'h2';
        // Logic: 30-60.
        // If duration was 30, H2 starts at 1800, Limit 3600.
        const halfSec = this.currentMatchDuration * 60;
        this.seconds = halfSec;
        this.limit = halfSec * 2;
        this.render();
    },

    setupOvertime() {
        // Called from Modal
        document.getElementById('modal-end-match').classList.remove('open');
        this.state = 'overtime';
        // Overtime 15 mins (Independent? Or 60-75?).
        // User requested "nastaví se na 15 minut".
        // Let's use 0->900 (15 min) for clarity as a separate block.
        // OR 60->75. 
        // Given timeline logic uses absolute time from 0..30..60, 60+ is safer if timeline supports it.
        // Let's stick to 0-15 independent Overtime clock, but maybe log events with "OT"?
        // Actually, let's allow counting from 0 to 15 (900s).
        this.currentOvertimeDuration = 15;
        this.seconds = this.currentOvertimeDuration * 60;
        this.limit = 0;
        this.render();
    },

    confirmEndMatch() {
        document.getElementById('modal-end-match').classList.remove('open');
        this.reset(true); // Soft reset? Or full? 
        // User says: "vyresetuje se časomíra, statistiky zůstanou zachovány".
        // reset(true) resets seconds to 0. Not stats.
        app.showNotification("Utkání ukončeno.", "success");
    },


    reset(force = false) {
        if (!force && this.isRunning) {
            app.showNotification("Nelze resetovat běžící čas. Nejdříve jej zastavte.", "error");
            return;
        }

        if (force) {
            this.seconds = 0;
            this.state = 'h1'; // Reset to H1?
            this.limit = this.currentMatchDuration * 60;
            this.render();
            this.stop();
        } else {
            teamManager.showConfirm("Opravdu chcete resetovat čas?", () => {
                this.reset(true);
            }, "Ano, resetovat");
        }
    },

    edit() {
        if (this.isRunning) {
            app.showNotification("Zastavte časomíru před úpravou.", "warning");
            return;
        }
        const timeStr = this.getFormattedTime();
        const input = document.getElementById('time-edit-input');
        input.value = timeStr;
        document.getElementById('modal-time-edit').classList.add('show');
    },

    saveEdit() {
        const val = document.getElementById('time-edit-input').value.trim();
        const parts = val.split(':');

        if (parts.length !== 2) {
            app.showNotification("Špatný formát! Použijte MM:SS", "error");
            return;
        }

        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);

        if (isNaN(mins) || isNaN(secs) || secs >= 60) {
            app.showNotification("Neplatný čas!", "error");
            return;
        }

        this.seconds = mins * 60 + secs;

        // If in Break or Overtime, update the "Set Duration" label based on new time
        if (this.state === 'break') {
            this.currentBreakDuration = Math.ceil(this.seconds / 60);
        } else if (this.state === 'overtime') {
            this.currentOvertimeDuration = Math.ceil(this.seconds / 60);
        }

        this.render();
        document.getElementById('modal-time-edit').classList.remove('show');
        app.showNotification("Čas upraven", "success");
    },

    getFormattedTime() {
        let sc = this.seconds;
        if (sc < 0) sc = 0;
        const m = Math.floor(sc / 60);
        const s = sc % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    render() {
        document.getElementById('match-timer').innerText = this.getFormattedTime();

        const el = document.getElementById('match-period');
        if (this.state === 'h1') {
            el.innerHTML = `1. poločas <span class="period-subtitle">(${this.currentMatchDuration} min)</span>`;
        } else if (this.state === 'break') {
            // Display Break Duration (Start value / 60) or stored logic
            // For now assuming 10 min default, but if variable?
            const dur = this.currentBreakDuration || 10;
            el.innerHTML = `Přestávka <span class="period-subtitle">(${dur} min)</span>`;
        } else if (this.state === 'h2') {
            el.innerHTML = `2. poločas <span class="period-subtitle">(${this.currentMatchDuration} min)</span>`;
        } else if (this.state === 'overtime') {
            const dur = this.currentOvertimeDuration || 15;
            el.innerHTML = `Prodloužení <span class="period-subtitle">(${dur} min)</span>`;
        }
    }
};

// --- DASHBOARD ---
const dashboard = {
    activeStatsTeam: 'home', // 'home' or 'guest'

    setStatsTeam(teamKey) {
        this.activeStatsTeam = teamKey;
        // Update UI Toggle
        const btnHome = document.getElementById('stat-toggle-home');
        const btnGuest = document.getElementById('stat-toggle-guest');

        if (teamKey === 'home') {
            btnHome.classList.add('active');
            btnGuest.classList.remove('active');
            document.querySelector('.dashboard-controls').classList.remove('guest-mode');
        } else {
            btnHome.classList.remove('active');
            btnGuest.classList.add('active');
            document.querySelector('.dashboard-controls').classList.add('guest-mode');
        }

        this.update();
    },

    update() {
        // this.renderTimeline(); // Removed to ensure table updates first (Logic moved to end)

        const tableBody = document.querySelector('#events-table tbody');
        if (!tableBody) return;

        // Calc Scores for Header
        // Home Score = Home Goals + Guest Conceded (robust check)
        const homeGoals = app.events.filter(e => e.teamKey === 'home' && (e.actionType === 'Gól' || e.actionType === '7m Gól')).length;
        const guestConceded = app.events.filter(e => e.teamKey === 'guest' && (e.actionType.includes('Obdržený'))).length;
        const totalHome = homeGoals + guestConceded;

        const guestGoals = app.events.filter(e => e.teamKey === 'guest' && (e.actionType === 'Gól' || e.actionType === '7m Gól')).length;
        const homeConceded = app.events.filter(e => e.teamKey === 'home' && (e.actionType.includes('Obdržený'))).length;
        const totalGuest = guestGoals + homeConceded;

        const header = document.getElementById('match-log-header');
        if (header) {
            header.textContent = `${app.teams.home.name} ${totalHome} : ${totalGuest} ${app.teams.guest.name} `;
        }

        tableBody.innerHTML = '';

        // Filter events (if needed, currently shows all)
        // Reverse order to show newest first
        const sortedEvents = [...app.events].reverse();

        sortedEvents.forEach(ev => {
            try {
                const tr = document.createElement('tr');

                // Find player safely
                let p = null;
                if (ev.teamKey && app.teams[ev.teamKey] && app.teams[ev.teamKey].players) {
                    p = app.teams[ev.teamKey].players.find(x => x.number === ev.playerNumber);
                }
                const teamName = (app.teams[ev.teamKey] ? app.teams[ev.teamKey].name : ev.teamKey) || 'Tým';

                // Format time
                let timeStr = ev.matchTime || "00:00";

                // Calculate Sector (Safe)
                let sector = '-';
                try {
                    const isGeometric7m = (ev.positionX !== undefined && Math.abs(ev.positionX - 0.5) < 0.05 && Math.abs(ev.positionY - 0.60) < 0.05);

                    if (ev.actionType && (ev.actionType.includes('7m') || isGeometric7m)) {
                        sector = '7m';
                    } else if (ev.positionX !== undefined && ev.positionX !== '') {
                        const x = parseFloat(ev.positionX);
                        const y = parseFloat(ev.positionY);

                        if (!isNaN(x) && !isNaN(y) && typeof this.getSectorName === 'function') {
                            sector = this.getSectorName(x, y);
                        }
                    }
                } catch (err) {
                    console.warn("Sector calc error", err);
                }

                // Color Logic
                const act = ev.actionType || '';
                let actionClass = '';

                if (act.includes('Gól') && !act.includes('Obdržený')) {
                    actionClass = 'text-success';
                } else if (act.includes('Obdržený') || act.includes('2m') || act.includes('Karta') || act.includes('Červená') || act.includes('Modrá')) {
                    actionClass = 'text-danger';
                }

                tr.innerHTML = `
                    <td>${timeStr}</td>
                    <td class="${ev.teamKey === 'home' ? 'row-home' : 'row-guest'}">${teamName}</td>
                    <td>${ev.playerNumber || ''} - ${p ? p.name : ev.playerName || ''}</td>
                    <td class="${actionClass}">${act}</td>
                    <td>${sector}</td>
                `;
                tableBody.appendChild(tr);
            } catch (e) {
                console.error("Error rendering log row", e, ev);
            }
        });

        this.updateStats();

        try {
            this.updateSelectors();
        } catch (e) { console.warn("Selector update failed", e); }

        try {
            this.renderTimeline();
        } catch (e) {
            console.warn("Timeline render failed", e);
        }
    },

    updateSelectors() {
        const populate = (teamKey, type) => {
            // Self-Healing: Check DOM if memory empty
            if (!app.teams[teamKey] || !app.teams[teamKey].players || app.teams[teamKey].players.length === 0) {
                const domId = `setup-${teamKey}-roster`;
                const domEl = document.getElementById(domId);
                if (domEl && domEl.value && app.parseRoster) {
                    console.log(`Auto-repairing roster for ${teamKey} from DOM`);
                    if (!app.teams[teamKey]) app.teams[teamKey] = { name: 'Team', players: [] };
                    app.teams[teamKey].players = app.parseRoster(domEl.value);
                }
            }

            const players = app.teams[teamKey] ? (app.teams[teamKey].players || []) : [];
            const selectId = `stat-select-${teamKey}-${type}`;
            const select = document.getElementById(selectId);
            if (!select) {
                console.warn(`Selector not found: ${selectId}`);
                return;
            }

            // Create Default Option Explicitly (Safe against empty DOM)
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.disabled = true;
            defaultOpt.selected = true;

            // Set Label
            if (type === 'gk') {
                defaultOpt.textContent = 'Brankáři';
            } else {
                defaultOpt.textContent = 'Hráči';
            }

            // Clear and Append Default
            select.innerHTML = '';
            select.appendChild(defaultOpt);

            // Filter logic
            let filtered = [];
            if (type === 'gk') {
                filtered = players.filter(p => p.position === 'GK' || p.position === 'BR' || p.name.includes('(GK)') || p.name.includes('(BR)'));
            } else {
                // Field players (exclude GK)
                filtered = players.filter(p => !(p.position === 'GK' || p.position === 'BR' || p.name.includes('(GK)') || p.name.includes('(BR)')));
            }

            // Debug / Fallback
            if (filtered.length === 0) {
                const debugOpt = document.createElement('option');
                debugOpt.disabled = true;
                debugOpt.textContent = "(Žádní hráči v systému)";
                select.appendChild(debugOpt);
            }

            // Sort by number
            filtered.sort((a, b) => parseInt(a.number) - parseInt(b.number));

            filtered.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.number;
                opt.style.color = 'black'; // Force visibility (Mac dark mode fix)
                // Check if name already contains position to avoid duplicates
                const pos = (p.position && !p.name.includes(p.position)) ? ` (${p.position})` : '';
                opt.textContent = `${p.number} - ${p.name}${pos} `;
                select.appendChild(opt);
            });
        };

        populate('home', 'player');
        populate('home', 'gk');
        populate('guest', 'player');
        populate('guest', 'gk');
    },

    // flashSelector removed as unused

    showPlayerStats(teamKey, playerNumber) {
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('view-team-stats').style.display = 'block';

        // Find Player Name
        let playerName = playerNumber;
        let playerPos = ''; // Add Position Label
        if (app.teams[teamKey] && app.teams[teamKey].players) {
            const p = app.teams[teamKey].players.find(x => x.number === playerNumber);
            if (p) {
                playerName = p.name;
                if (p.position) playerPos = ` (${p.position})`;
            }
        }

        const teamName = teamKey === 'home' ? 'Domácí' : 'Hosté'; // Or use App team name
        // Enhanced Header with Position
        document.getElementById('team-stats-title').innerHTML = `<strong>${playerName}${playerPos}</strong>`;

        // Ensure both timeline sections are visible
        document.getElementById('timeline-section-h1').style.display = 'block';
        document.getElementById('timeline-section-h2').style.display = 'block';

        try {
            this.renderTimeline({
                h1: 'timeline-team-h1',
                h2: 'timeline-team-h2',
                teamKey: teamKey,
                playerFilter: playerNumber
            });
        } catch (e) {
            console.error("Error rendering timeline:", e);
        }

        try {
            this.renderTeamCourt(teamKey, playerNumber); // Pass player filter
        } catch (e) {
            console.error("Error rendering team court:", e);
        }
    },

    showPositionStats(teamKey, position) {
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('view-team-stats').style.display = 'block';

        // RESET OTHER SELECTORS
        if (document.getElementById(`stat-select-${teamKey}-player`)) document.getElementById(`stat-select-${teamKey}-player`).value = "";
        if (document.getElementById(`stat-select-${teamKey}-gk`)) document.getElementById(`stat-select-${teamKey}-gk`).value = "";

        const teamName = teamKey === 'home' ? app.teams.home.name : app.teams.guest.name;
        // Enhanced Header for Position View
        document.getElementById('team-stats-title').innerHTML = `<strong>${position.toUpperCase()}</strong>`;

        // Ensure both timeline sections are visible
        document.getElementById('timeline-section-h1').style.display = 'block';
        document.getElementById('timeline-section-h2').style.display = 'block';

        // Filter Logic: Get list of player numbers for this position
        let playerNumbers = [];
        if (app.teams[teamKey] && app.teams[teamKey].players) {
            // Special Handling for GK/BR variants
            if (position === 'GK') {
                playerNumbers = app.teams[teamKey].players
                    .filter(p => p.position === 'GK' || p.position === 'BR' || (p.name && p.name.includes('(GK)')))
                    .map(p => p.number);
            } else {
                playerNumbers = app.teams[teamKey].players
                    .filter(p => p.position && p.position.includes(position))
                    .map(p => p.number);
            }
        }

        // Pass array of numbers as filter
        try {
            this.renderTimeline({
                h1: 'timeline-team-h1',
                h2: 'timeline-team-h2',
                teamKey: teamKey,
                playerFilter: playerNumbers
            });
        } catch (e) { console.error("Error rendering timeline:", e); }

        try {
            this.renderTeamCourt(teamKey, playerNumbers);
        } catch (e) { console.error("Error rendering team court:", e); }
    },

    showTeamStats(teamKey) {
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('view-team-stats').style.display = 'block';

        const teamName = teamKey === 'home' ? 'Domácí' : 'Hosté';

        // Use central score source (safer) instead of recalculating
        const scoreString = `${match.score.home}:${match.score.guest}`;

        // Formatted Header: "Statistika týmu | Výsledek utkání 1:1"
        // User asked for "Výsledek utkání" to match "Statistika týmu" style (small), but Score to remain big.
        document.getElementById('team-stats-title').innerHTML = `
            <span style="font-size: 1rem; font-weight: normal; opacity: 0.8; text-transform: none;">Statistika týmu</span>
            <span style="font-size: 1rem; opacity: 0.5; margin: 0 10px;">|</span>
            <span style="font-size: 1rem; font-weight: normal; opacity: 0.8; text-transform: none;">Výsledek utkání</span>
            <span style="font-size: 1.8rem; font-weight: bold; margin-left: 10px;">${scoreString}</span>
        `;

        // Ensure both timeline sections are visible (Revert from filtering)
        document.getElementById('timeline-section-h1').style.display = 'block';
        document.getElementById('timeline-section-h2').style.display = 'block';

        // Render timeline for team view (Full Team)
        try {
            this.renderTimeline({
                h1: 'timeline-team-h1',
                h2: 'timeline-team-h2',
                teamKey: teamKey,
                playerFilter: null // Explicitly null for team view
            });
        } catch (e) {
            console.error("Error rendering timeline:", e);
        }

        try {
            this.renderTeamCourt(teamKey, null); // Null filter
        } catch (e) {
            console.error("Error rendering team court:", e);
        }
    },



    toggleHalf(half) {
        const section = document.getElementById(`timeline-section-h${half}`);
        const btn = document.getElementById(`btn-toggle-h${half}`);

        if (section.style.display === 'none') {
            section.style.display = 'block';
            btn.classList.add('active');
        } else {
            section.style.display = 'none';
            btn.classList.remove('active');
        }
    },

    // Helper for Sector Names
    getSectorName(x, y) {
        if (y > 0.70) {
            // Backcourt
            if (x < 0.35) return 'LB'; // Left Back
            else if (x > 0.65) return 'RB'; // Right Back
            else return 'CB'; // Center Back
        } else {
            // Forecourt
            if (x < 0.15) return 'LW'; // Left Wing
            else if (x > 0.85) return 'RW'; // Right Wing
            else if (x < 0.50) return 'LP'; // Line Player Left
            else return 'RP'; // Line Player Right
        }
    },

    renderTeamCourt(teamKey, playerFilter = null) {
        const container = document.getElementById('team-stats-markers');
        if (!container) return;

        // Goal Structure Container (Sibling) - Target for Goal Markers
        const goalContainer = container.parentElement ? container.parentElement.querySelector('.goal-structure') : null;

        container.innerHTML = '';

        // Clear Goal Markers (preserve grid numbers)
        if (goalContainer) {
            goalContainer.querySelectorAll('.goal-marker').forEach(el => el.remove());
        }

        // Render Sector Labels
        const labels = [
            { txt: 'LW', x: 5, y: 20, rot: -90 },
            { txt: 'LB', x: 10, y: 90, rot: 0 },
            { txt: 'CB', x: 50, y: 90, rot: 0 },
            { txt: 'RB', x: 90, y: 90, rot: 0 },
            { txt: 'RW', x: 95, y: 20, rot: -90 },
            { txt: 'LP', x: 25, y: 60, rot: 0 },
            { txt: 'RP', x: 75, y: 60, rot: 0 },
        ];

        labels.forEach(l => {
            const el = document.createElement('div');
            el.className = 'sector-label';
            el.textContent = l.txt;
            el.style.left = l.x + '%';
            el.style.top = l.y + '%';
            el.style.transform = `translate(-50%, -50%) rotate(${l.rot}deg)`;
            container.appendChild(el);
        });

        if (!app.events) return;

        // --- FILTER CONFIGURATION ---
        let isGKView = false;

        // 1. Determine View Mode (GK or Field)
        if (playerFilter) {
            const teamPlayers = app.teams[teamKey].players;
            const gkIds = teamPlayers.filter(p => p.position === 'GK' || p.position === 'BR').map(p => p.number);
            if (Array.isArray(playerFilter)) {
                const filterStrings = playerFilter.map(String);
                isGKView = gkIds.some(id => filterStrings.includes(String(id)));
            } else {
                isGKView = gkIds.some(id => String(id) === String(playerFilter));
            }
        }

        // 2. Event Fetching Logic
        let events = [];
        const oppKey = teamKey === 'home' ? 'guest' : 'home';

        if (isGKView) {
            // GK View: Show ALL Defensive Actions (Shots Faced)
            // Sources: 
            // A) Opponent Shots (Goal, Miss, etc) - logged as Opponent team
            // B) Own Defensive Actions (Save, Conceded) - logged as Own team

            events = app.events.filter(e => {
                const type = e.actionType;

                // Case A: Opponent Shot
                const isOpponent = e.teamKey === oppKey;
                const isGoal = ['Gól', '7m Gól'].includes(type) || type.includes('Gól');
                const missTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok'];
                const isMiss = missTypes.some(t => type.includes(t)) || type.includes('7m Neúspěšná') || type.includes('7m Mimo');

                // Only include Opponent shots if we can NOT filter by specific GK yet (or if we add tracking later)
                // For now, allow them to show up (Combined View restoration)
                if (isOpponent && (isGoal || isMiss)) {
                    // FILTER ATTEMPT: If we have a stored 'goalieNumber' in event, use it.
                    if (playerFilter && e.goalieNumber) {
                        if (Array.isArray(playerFilter)) {
                            // Check if event's goalieNumber is in the allowed list
                            return playerFilter.map(String).includes(String(e.goalieNumber));
                        } else {
                            return String(e.goalieNumber) === String(playerFilter);
                        }
                    }

                    // If no goalieNumber (Legacy), logic from before:
                    if (playerFilter && !e.goalieNumber) {
                        // Legacy/Untracked. If we are strict filtering, we might technically hide it.
                        // But if it's "GK" Position View (Array), maybe we show all legacy?
                        // Or if specific player, we show/hide?
                        // As per user request "Nefiltrují se" (bad) -> "Zmizelo" (bad).
                        // We stick to returning TRUE for legacy events to ensure visibility.
                        return true;
                    }

                    return true;
                }

                // Case B: Own Defensive Record (Saves logged on the GK themselves)
                const isOwn = e.teamKey === teamKey;
                const isDefensiveAction = type.includes('Zákrok') || type.includes('Chyceno') || type.includes('Obdržený') || type === 'Mimo branku';

                if (isOwn && isDefensiveAction) {
                    // Here we CAN filter by playerNumber because the GK is the actor!
                    if (playerFilter) {
                        if (Array.isArray(playerFilter)) {
                            return playerFilter.map(String).includes(String(e.playerNumber));
                        } else {
                            return String(e.playerNumber) === String(playerFilter);
                        }
                    }
                    return true;
                }

                return false;
            });

        } else {
            // Standard Field View: Show Own Offensive Actions
            // EXCLUDE 'Mimo branku' (Defensive log by GK)
            events = app.events.filter(e => e.teamKey === teamKey && (e.positionX !== undefined || e.goalZone) && e.actionType !== 'Mimo branku');

            // Apply Player Filter (Refining the Selection)
            if (playerFilter) {
                if (Array.isArray(playerFilter)) {
                    events = events.filter(e => playerFilter.includes(String(e.playerNumber)));
                } else {
                    events = events.filter(e => String(e.playerNumber) === String(playerFilter));
                }
            }
        }

        // Toggle Legend Item
        const legendItem = document.getElementById('legend-gk-miss');
        if (legendItem) legendItem.style.display = isGKView ? 'flex' : 'none';

        // SVG Container for Lines
        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.pointerEvents = "none";
        container.appendChild(svg);

        // --- NUMBERING CONSISTENCY ---
        const shotMap = new Map();
        let globalShotCounter = 0;

        // Define "Source History" for numbering
        // For GK: The full "Defensive History" of the team (Opponent Shots + Own Saves)
        // For Field: The full "Offensive History" of the team

        let sourceEvents = [];

        if (isGKView) {
            // Generate Full Defensive History for Numbering
            sourceEvents = app.events.filter(e => {
                const type = e.actionType;
                // Opponent Shot
                if (e.teamKey === oppKey) {
                    const isGoal = ['Gól', '7m Gól'].includes(type) || type.includes('Gól');
                    const missTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok'];
                    const isMiss = missTypes.some(t => type.includes(t)) || type.includes('7m Neúspěšná') || type.includes('7m Mimo');
                    return isGoal || isMiss;
                }
                // Own Defensive
                if (e.teamKey === teamKey) {
                    return type.includes('Zákrok') || type.includes('Chyceno') || type.includes('Obdržený');
                }
                return false;
            }).sort((a, b) => a.id - b.id);

        } else {
            // Generate Full Offensive History for Numbering (Same as before)
            sourceEvents = app.events.filter(e => e.teamKey === teamKey).sort((a, b) => a.id - b.id);
        }

        // Build Map
        sourceEvents.forEach(ev => {
            // We count basically everything in the source list as a "Shot Event"
            // But let's apply the standard check just to be safe
            const type = ev.actionType;
            const isSuccess = ['Gól', '7m Gól'].includes(type) || type.includes('Gól');
            const missTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok'];
            const isMiss = missTypes.some(t => type.includes(t)) || type.includes('7m Neúspěšná') || type.includes('7m Mimo');
            const isConceded = type.includes('Obdržený');
            const isSave = type.includes('Zákrok') || type.includes('Chyceno');

            if (isSuccess || isConceded || isSave) {
                // EXCLUDE Mimo branku (Grey) from Numbering
                // User Request: "šedé střely soupeře... Kolečkajsou špatně číslována"
                // Only number Shots on Target (Goals + Saves)
                if (!type.includes('Mimo') && !type.includes('Tyč') && !type.includes('Neúspěšná střela')) {
                    // actually 'Neúspěšná střela' usually implies Save? 
                    // Wait, 'Neúspěšná střela' is generic.
                    // Let's stick to what we know is OFF TARGET: 'Mimo branku'
                    // User said "šedé střely". In renderShotVisuals logic:
                    // isOffTarget = (type === 'Mimo branku'); -> This gets 'marker-grey'.

                    if (type !== 'Mimo branku') {
                        globalShotCounter++;
                        shotMap.set(ev.id, globalShotCounter);
                    }
                } else if (type !== 'Mimo branku') {
                    // If it's a Save (Yellow) it should be numbered.
                    // 'Neúspěšná střela' maps to Yellow/Save usually?
                    // Let's safe check:
                    globalShotCounter++;
                    shotMap.set(ev.id, globalShotCounter);
                }
            } else if (isMiss) {
                // isMiss includes 'Mimo', 'Tyč', 'Chyceno'...
                // We want to count 'Chyceno', 'Zblokováno', 'Zákrok' (Saves)
                // We do NOT want to count 'Mimo' (Off Target)
                const isOffTarget = type.includes('Mimo');
                const isSaveAction = type.includes('Chyceno') || type.includes('Zblokováno') || type.includes('Zákrok') || type === 'Neúspěšná střela';

                if (!isOffTarget && isSaveAction) {
                    globalShotCounter++;
                    shotMap.set(ev.id, globalShotCounter);
                }
            }
        });

        // --- RENDERING ---

        // Sort events to render
        events.sort((a, b) => a.id - b.id);

        let sevenMeterCount = 0;

        events.forEach(ev => {
            const type = ev.actionType;

            // Normalize "Success" vs "Fail" based on VIEW
            // GK View: Goal is Bad (Conceded), Save/Miss is Good.
            // Field View: Goal is Good, Miss is Bad.

            const isGoal = ['Gól', '7m Gól'].includes(type) || type.includes('Gól');
            const isConceded = type.includes('Obdržený');
            const isSaveOrMiss = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok'].some(t => type.includes(t)) || type.includes('Chyceno');

            if (!isGoal && !isConceded && !isSaveOrMiss) return;

            // Get Global Number
            const shotDisplayNumber = shotMap.get(ev.id) || '?';

            // Detect 7m
            const is7m = type.includes('7m') || (ev.positionX !== undefined && Math.abs(ev.positionX - 0.5) < 0.05 && Math.abs(ev.positionY - 0.60) < 0.05);

            let displayX = ev.positionX * 100;
            let displayY = ev.positionY * 100;

            // Fallback for missing coordinates (e.g. generic 'Zákrok' without click)
            // Just center it if undefined? Or skip?
            // Ideally we skip markers without coords, BUT we might want to show them in the Goal Map if goalZone is present.
            const hasCoords = (ev.positionX !== undefined && ev.positionX !== null);

            if (!hasCoords && !is7m && !ev.goalZone) {
                // If absolutely no spatial data, maybe skip rendering marker?
                // But keep in mind 7m logic handles positioning manually.
                // If it's a Goal Map only event?
            }

            if (is7m) {
                const maxRows = 5;
                const col = Math.floor(sevenMeterCount / maxRows);
                const row = sevenMeterCount % maxRows;
                displayY = 60 + (row * 3.5);
                displayX = 50 + (col * 2.3);
                sevenMeterCount++;
            }

            // COLOR LOGIC
            // Standardized: 
            // - Goal/Success (for Shooter) -> Green
            // - Miss/Save (for Shooter) -> Yellow
            // - Conceded (Red)
            // - Zákrok (Purple) [NEW]

            let bg, textColor;
            let isOffTarget = (type === 'Mimo branku');

            // Normalize for logic check
            const typeLow = type ? type.toLowerCase() : '';

            if (isGoal) {
                if (ev.teamKey === teamKey) {
                    bg = 'var(--goal)'; // Green (Our Goal)
                    textColor = 'black';
                } else {
                    bg = 'var(--miss)'; // Red (Conceded)
                    textColor = 'white';
                }
            } else if (isConceded) {
                bg = 'var(--miss)'; // Red
                textColor = 'white';
            } else if (typeLow.includes('zákrok') || typeLow.includes('chyceno') || typeLow.includes('krok')) {
                // SAVES -> PURPLE
                bg = '#9b59b6';
                textColor = 'white';
            } else if (isOffTarget) {
                bg = '#95a5a6'; // Grey
                textColor = 'transparent';
            } else {
                // Miss/Save (Generic) not captured by above
                bg = '#f1c40f'; // Yellow
                textColor = 'black';
            }

            // 1. Shot Marker (Court)
            // Only render if we have coordinates or it's 7m
            if (hasCoords || is7m) {
                const marker = document.createElement('div');
                marker.className = isOffTarget ? 'shot-marker marker-grey' : 'shot-marker';
                marker.style.left = displayX + '%';
                marker.style.top = displayY + '%';
                if (!isOffTarget) marker.style.background = bg; // Class handles grey
                marker.style.color = textColor;
                marker.style.zIndex = 10;
                // No number for off-target
                marker.textContent = isOffTarget ? '' : shotDisplayNumber;
                marker.title = `${ev.matchTime} - ${ev.player || ''} (${ev.actionType})`;

                container.appendChild(marker);
            }

            // 2. Goal Marker (Goal Map)
            const goalContainerTarget = container.parentElement ? container.parentElement.querySelector('.goal-structure') : null;
            let targetContainer = null;
            let isGlobal = false;

            if (ev.goalZone === 0 && goalContainerTarget) {
                targetContainer = goalContainerTarget;
                isGlobal = true;
            } else if (ev.goalZone && goalContainerTarget) {
                targetContainer = goalContainerTarget.querySelector(`.goal-grid-numbers div:nth-child(${ev.goalZone})`);
            }

            if (targetContainer) {
                const goalMarker = document.createElement('div');
                goalMarker.className = 'goal-marker';

                let gx, gy;
                if (ev.goalX !== undefined && ev.goalY !== undefined && ev.goalX !== null) {
                    gx = ev.goalX;
                    gy = ev.goalY;
                } else {
                    gx = 35 + (Math.random() - 0.5) * 40;
                    gy = 40 + (Math.random() - 0.5) * 40;
                }

                goalMarker.style.left = `${gx}%`;
                goalMarker.style.top = `${gy}%`;
                goalMarker.style.transform = 'translate(-50%, -50%)';
                goalMarker.style.background = bg;
                goalMarker.style.color = textColor;
                goalMarker.textContent = shotDisplayNumber;
                goalMarker.style.zIndex = isGlobal ? 60 : 10;

                targetContainer.appendChild(goalMarker);
            }
        });
    },

    // Goal Structure Container (Sibling) - Target for Goal Markers
    showOverview() {
        document.getElementById('view-team-stats').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'block';

        // BUG FIX: Reset Selectors so user can re-select the same player
        if (this.updateSelectors) this.updateSelectors();

        // Restore main timeline
        this.renderTimeline();
    },

    renderTimeline(options = {}) {
        const {
            h1 = 'timeline-h1',
            h2 = 'timeline-h2',
            orientation = 'horizontal', // 'horizontal' or 'vertical'
            teamKey = null
        } = options;

        const isVertical = orientation === 'vertical';

        const h1Container = document.getElementById(h1);
        const h2Container = document.getElementById(h2);

        if (!h1Container || !h2Container) return;



        h1Container.innerHTML = '';
        h2Container.innerHTML = '';

        // Extract options
        const playerFilter = options.playerFilter; // New option

        if (!app.events) return; // Safety check

        // Helper: Create Axis Elements
        const createAxis = (container, offset = 0) => {
            // Main Axis Line
            const axis = document.createElement('div');
            axis.className = 'tm-axis';
            if (isVertical) {
                axis.style.width = '1px';
                axis.style.height = '100%';
                axis.style.top = '0';
                axis.style.left = '50%';
                axis.style.transform = 'translate(-50%, 0)';
            }
            container.appendChild(axis);

            // Ticks 0-30
            for (let i = 0; i <= 30; i++) {
                const tick = document.createElement('div');
                tick.className = 'tm-tick';

                // Position percent
                const pct = (i / 30) * 100;

                if (isVertical) {
                    tick.style.top = `${pct}%`;
                    tick.style.left = '50%';
                    tick.style.transform = 'translate(-50%, -50%)';
                    tick.style.height = '1px';
                } else {
                    tick.style.left = `${pct}%`;
                }

                // Classes
                if (i % 10 === 0) {
                    tick.classList.add('tick-10m');
                    if (isVertical) tick.style.width = '12px';
                } else if (i % 5 === 0) {
                    tick.classList.add('tick-5m');
                    if (isVertical) tick.style.width = '8px';
                } else {
                    tick.classList.add('tick-1m');
                    if (isVertical) tick.style.width = '4px';
                }
                container.appendChild(tick);

                // Labels every 5 mins
                if (i % 5 === 0) {
                    const label = document.createElement('div');
                    label.className = 'tm-label';
                    label.textContent = i + offset;

                    if (isVertical) {
                        label.style.top = `${pct}%`;
                        label.style.left = '60%';
                        label.style.transform = 'translateY(-50%)';
                    } else {
                        label.style.left = `${pct}%`;
                    }
                    container.appendChild(label);
                }
            }
        };

        createAxis(h1Container, 0);
        createAxis(h2Container, 30);

        // Process Events
        // Sort events by time to handle stacking
        const sortedEvents = [...app.events].filter(ev => {
            if (playerFilter) {
                if (Array.isArray(playerFilter)) {
                    const filterStrings = playerFilter.map(String);
                    if (!filterStrings.includes(String(ev.playerNumber))) return false;
                } else {
                    if (String(ev.playerNumber) !== String(playerFilter)) return false;
                }
            }

            // Timeline: Show ONLY Goals (Green) and Conceded (Red)
            const isSuccess = ['Gól', '7m Gól'].includes(ev.actionType);
            const isConceded = ev.actionType === 'Obdržený gól' || ev.actionType === '7m Obdržený gól' || ev.actionType.includes('Obdržený gól');

            // If teamKey is filtered (it is inside team view), we might want to see team's goals
            // But if it's player view:
            // - If I am viewing a player, I want to see THEIR goals (Success)
            // - And maybe errors? 
            // - Standard Logic: Filter by Team Key first?
            // renderTimeline is usually called with teamKey.

            // Basic Team Filter (Only if teamKey is provided)
            if (teamKey && ev.teamKey !== teamKey) return false;

            return isSuccess || isConceded;
        }).sort((a, b) => { // Sort by seconds
            if (!a.matchTime || !b.matchTime) return 0;
            const ta = a.matchTime.split(':').map(Number);
            const tb = b.matchTime.split(':').map(Number);
            return (ta[0] * 60 + ta[1]) - (tb[0] * 60 + tb[1]);
        });

        // Track rendered markers to handle stacking collision
        // Map: Half -> Side -> LastRenderedPercent (to check overlap)
        const stackState = {
            h1: { up: { lastPct: -10, level: 0 }, down: { lastPct: -10, level: 0 } },
            h2: { up: { lastPct: -10, level: 0 }, down: { lastPct: -10, level: 0 } }
        };
        const THRESHOLD = 1.8;

        sortedEvents.forEach(ev => {
            // Parse Time
            const parts = ev.matchTime.split(':');
            const min = parseInt(parts[0]);
            const sec = parseInt(parts[1]);
            const totalSeconds = min * 60 + sec;

            let isH2 = false;
            let relativeSeconds = totalSeconds;

            if (min >= 30) {
                isH2 = true;
                relativeSeconds = totalSeconds - 1800; // Reset for 2nd half
            }

            // Cap at 30:00 (1800s)
            if (relativeSeconds > 1800) relativeSeconds = 1800;
            if (relativeSeconds < 0) relativeSeconds = 0;

            const halfKey = isH2 ? 'h2' : 'h1';
            const pct = (relativeSeconds / 1800) * 100;

            // Determine Context
            const isGoal = ['Gól', '7m Gól'].includes(ev.actionType);
            let isOurEvent = false;
            let isOurSuccess = false;
            let isConceded = false;

            if (teamKey) {
                // Team Stats View context
                if (ev.teamKey === teamKey) {
                    isOurEvent = true;
                    if (isGoal) isOurSuccess = true;
                } else {
                    // Opponent Event
                    // Check if Conceded
                    if (ev.actionType === 'Obdržený gól' || ev.actionType === '7m Obdržený gól' || ev.actionType.includes('Obdržený gól')) {
                        isConceded = true;
                    }
                }
            } else {
                // Global View (Dashboard)
                // Assuming Active Team is 'Home' by default if not filtered?
                // Actually Dashboard Timeline shows ALL.
                // Re-evaluate context.
                // The Timeline always seems to show Matches relative to "Active View"?
                // If TeamKey is null, maybe just show Green for Goals?
                if (isGoal) isOurSuccess = true;
                if (ev.actionType === 'Obdržený gól' || ev.actionType === '7m Obdržený gól' || ev.actionType.includes('Obdržený gól')) {
                    isConceded = true;
                }
            }

            // Skip if irrelevant
            if (teamKey && !isOurEvent && !isConceded) return;

            // Determine Side: Success (Green) UP, Failure/Conceded (Red) DOWN
            // User requested: "červené čtverečky ... pod časovou osu. Nad osou jsou zelené."
            const side = isOurSuccess ? 'up' : 'down';

            // Check Stacking
            const state = stackState[halfKey][side];
            if (pct - state.lastPct < THRESHOLD) {
                state.level++;
            } else {
                state.level = 0;
            }
            state.lastPct = pct;

            // Render Marker
            const marker = document.createElement('div');
            marker.className = 'tm-mark';

            if (isOurSuccess) {
                marker.classList.add('green');
            } else {
                marker.classList.add('red');
            }

            // Tooltip
            marker.title = `${ev.matchTime} - ${ev.player} (${ev.actionType})`;

            // Positioning
            const levelOffset = state.level * 6; // px per level
            const baseOffset = 8; // base px from axis

            if (isVertical) {
                marker.style.top = `${pct}%`;
                marker.style.transform = 'translateY(-50%)';

                if (side === 'up') {
                    marker.style.left = `calc(50% + ${baseOffset + levelOffset}px)`;
                } else {
                    marker.style.left = 'auto'; // Reset left
                    marker.style.right = `calc(50% + ${baseOffset + levelOffset}px)`;
                }
            } else {
                marker.style.left = `${pct}%`;
                if (side === 'up') {
                    marker.style.bottom = `calc(50% + ${baseOffset + levelOffset}px)`;
                } else {
                    marker.style.top = `calc(50% + ${baseOffset + levelOffset}px)`;
                }
            }

            const container = isH2 ? h2Container : h1Container;
            container.appendChild(marker);
        });
    },

    openMatchStats(teamKey) {
        // Add Print Class
        document.body.classList.add('print-stats-modal');

        const team = app.teams[teamKey];
        const events = app.events.filter(e => e.teamKey === teamKey);

        // User request: "závorka menším písmem". 
        // I will attempt simple calc based on events before 'Polčas' event if it exists? 
        // Events don't explicitly mark halftime.
        // I will just put the main score.

        // Header Info
        const date = document.getElementById('setup-date').value || 'Datum neuvedeno';
        const time = document.getElementById('setup-time').value || 'Čas neuveden';
        const homeName = app.teams.home.name;
        const guestName = app.teams.guest.name;
        const score = `${match.score.home} : ${match.score.guest}`;

        // Halftime Score Logic
        let halfScoreStr = "( - : - )";
        if (match.halftimeScore) {
            halfScoreStr = `(${match.halftimeScore.home} : ${match.halftimeScore.guest})`;
        }

        // Attack Stats
        const fastBreaks = events.filter(e => e.actionType === 'Rychlý protiútok').length;
        const gradualAttacks = events.filter(e => e.actionType === 'Postupný útok').length;
        const totalAttacks = fastBreaks + gradualAttacks;

        // TEAM EFFICIENCY CALCS
        // 1. Shooting (FIELD PLAYERS ONLY - Exclude GK)
        // Identify GK Numbers
        const gkNumbers = team.players
            .filter(p => p.position === 'GK' || p.position === 'BR' || p.name.includes('(GK)') || p.name.includes('(BR)'))
            .map(p => p.number);

        const fieldEvents = events.filter(e => !gkNumbers.includes(e.playerNumber));

        const tGoals = fieldEvents.filter(e => e.actionType === 'Gól' || e.actionType === '7m Gól').length;
        const tMissTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok', '7m Neúspěšná', '7m Mimo', '7m Tyč', '7m Chyceno'];
        const tMisses = fieldEvents.filter(e => tMissTypes.some(t => e.actionType.includes(t))).length;

        const tTotalShots = tGoals + tMisses;
        let tShotEff = 0;
        if (tTotalShots > 0) tShotEff = Math.round((tGoals / tTotalShots) * 100);

        // 2. GK
        const tSaves = events.filter(e => e.actionType.includes('Zákrok') || e.actionType.includes('Chyceno')).length;
        const tConceded = events.filter(e => e.actionType.includes('Obdržený')).length;

        // Opponent Goals (for robust total)
        const oppKey = teamKey === 'home' ? 'guest' : 'home';
        const oppEvents = app.events.filter(e => e.teamKey === oppKey);
        const oppGoals = oppEvents.filter(e => e.actionType === 'Gól' || e.actionType === '7m Gól').length;

        const tTotalAgainst = tSaves + tConceded + oppGoals;
        let tSaveEff = 0;
        if (tTotalAgainst > 0) tSaveEff = Math.round((tSaves / tTotalAgainst) * 100);

        // 3. Tech Faults & Defense Totals
        const tTechFaults = events.filter(e => {
            const act = e.actionType || '';
            return ['Technická chyba', 'Kroky', 'Přešlap', 'Přihrávkou', 'Špatná přihrávka', 'Prorážení'].some(t => act.includes(t));
        }).length;

        const tDefPlus = events.filter(e => e.actionType === 'Obrana +').length;
        const tDefMinus = events.filter(e => e.actionType === 'Obrana -').length;

        const headerHTML = `
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${homeName} vs ${guestName}</div>
            <div style="font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;">
                <span>${date} ${time}</span>
                <span style="font-size: 0.6rem; color: #888; text-transform: uppercase;">HandyStat for Handball</span>
                <span>| Výsledek: ${score} <span style="font-size: 0.8rem; color: #aaa;">${halfScoreStr}</span></span>
            </div>
            
            <!-- Turnovers / Attacks Row -->
            <div style="display: flex; justify-content: center; gap: 20px; font-size: 0.9rem; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">Útoky:</span>
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${totalAttacks} (${fastBreaks} RP)</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">Hráči:</span>
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${tShotEff}%</span>
                </div>
                 <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">Brankáři:</span>
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${tSaveEff}%</span>
                </div>
            </div>

            <!-- New Summary Row (Tech Faults & Defense) -->
            <div style="display: flex; justify-content: center; gap: 20px; font-size: 0.9rem; margin-top: 10px;">
                <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">T.CH celkem:</span>
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${tTechFaults}</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">Obrana +:</span>
                    <span style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${tDefPlus}</span>
                </div>
                 <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; margin-right: 5px;">Obrana -:</span>
                    <span style="background: rgba(231, 76, 60, 0.2); color: #e74c3c; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${tDefMinus}</span>
                </div>
            </div>
        `;
        document.getElementById('match-stats-header-info').innerHTML = headerHTML;

        // Sort Players: GK, LW, RW, LB, RB, CB, P
        const posOrder = { 'GK': 1, 'LW': 2, 'RW': 3, 'LB': 4, 'RB': 5, 'CB': 6, 'P': 7 };

        // Clone players to sort
        const sortedPlayers = [...team.players].sort((a, b) => {
            const pa = posOrder[a.position] || 99;
            const pb = posOrder[b.position] || 99;
            if (pa !== pb) return pa - pb;
            return parseInt(a.number) - parseInt(b.number);
        });

        const tbody = document.getElementById('match-stats-body');
        tbody.innerHTML = '';

        sortedPlayers.forEach(p => {
            // Filter events for this player (Robust comparison)
            const pEvents = events.filter(e => String(e.playerNumber) === String(p.number));

            // Stats
            // 1. Penalties
            let penaltyHTML = '';
            pEvents.forEach(e => {
                const act = e.actionType ? e.actionType.trim() : '';
                // Checks against Czech strings from index.html
                // Use specific classes for print targeting
                if (act === 'Žlutá karta') penaltyHTML += '<span class="penalty-card card-yellow">Y</span>';
                if (act === 'Červená karta') penaltyHTML += '<span class="penalty-card card-red">R</span>';
                if (act === 'Modrá karta') penaltyHTML += '<span class="penalty-card card-blue">B</span>';
                if (act === '2min') penaltyHTML += '<span class="penalty-2min">2\' </span>';
            });

            // 1.5 DEFENSE Stats (Obrana)
            let defenseHTML = '';
            pEvents.forEach(e => {
                const act = e.actionType || '';
                if (act === 'Obrana +') defenseHTML += '<span class="text-success" style="font-weight:bold; margin-right:4px;">+ </span>';
                if (act === 'Obrana -') defenseHTML += '<span class="text-danger" style="font-weight:bold; margin-right:4px;">- </span>';
            });

            // 1.6 TECH FAULTS (T.CH.)
            let techHTML = '';
            const techFaults = [];
            pEvents.forEach(e => {
                const act = e.actionType || '';
                if (act.includes('Kroky')) techFaults.push('K');
                else if (act.includes('Přešlap')) techFaults.push('přeš');
                else if (act.includes('Přihrávkou') || act.includes('Špatná přihrávka')) techFaults.push('PŘIH');
                else if (act.includes('Prorážení')) techFaults.push('P'); // User Request "P"
                else if (act.includes('Technická chyba')) techFaults.push('T.CH');
            });
            techHTML = techFaults.join(', ');

            // 2. Shooting (Shots / Goals)
            // Hide shooting stats for GK? NO, User Request: Show them.
            // if (p.position !== 'GK') { -> REMOVED
            const goals = pEvents.filter(e => e.actionType === 'Gól' || e.actionType === '7m Gól').length;
            // Robust miss detection matching renderTeamCourt logic
            const missTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok', '7m Neúspěšná', '7m Mimo', '7m Tyč', '7m Chyceno'];
            const misses = pEvents.filter(e => {
                const isMiss = missTypes.some(t => e.actionType && e.actionType.includes(t));
                if (!isMiss) return false;

                // EXCEPTION: GK Defensive Actions (Mimo, Zákrok) are NOT Offensive Misses
                const isGK = p.position === 'GK' || p.position === 'BR' || (p.name && (p.name.includes('(GK)') || p.name.includes('(BR)')));
                if (isGK) {
                    return e.actionType === 'Neúspěšná střela' || e.actionType === '7m Neúspěšná';
                }
                return true;
            }).length;

            const totalShots = goals + misses;

            let eff = 0;
            if (totalShots > 0) eff = Math.round((goals / totalShots) * 100);

            if (totalShots > 0 || goals > 0) {
                shootingStat = `${totalShots} / ${goals} (${eff}%)`;
            } else {
                shootingStat = '0 / 0';
            }
            // } -> REMOVED

            // 3. GK Stats
            let gkStat = ''; // Empty by default
            if (p.position === 'GK') {
                const saves = pEvents.filter(e => e.actionType.includes('Zákrok') || e.actionType.includes('Chyceno')).length;
                const conceded = pEvents.filter(e => e.actionType.includes('Obdržený')).length;
                const totalAgainst = saves + conceded;

                let eff = 0;
                if (totalAgainst > 0) eff = Math.round((saves / totalAgainst) * 100);

                gkStat = `${saves} / ${totalAgainst} (${eff}%)`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.number}</strong> ${p.name}</td>
                <td style="text-align: center;">${defenseHTML}</td>
                <td style="text-align: center;">${techHTML}</td>
                <td style="text-align: center;">${penaltyHTML}</td>
                <td style="text-align: center;">${shootingStat}</td>
                <td style="text-align: center;">${gkStat}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('modal-match-stats').classList.add('show');
        document.getElementById('modal-match-stats').classList.add('open');
    },

    closeMatchStats() {
        document.body.classList.remove('print-stats-modal');
        const modal = document.getElementById('modal-match-stats');
        modal.classList.remove('open');
        modal.classList.remove('show');
    },

    confirmClear() {
        teamManager.showConfirm("Opravdu chcete vymazat všechny statistiky?", () => {
            this.clearStats();
        }, "Ano, vymazat");
    },

    clearStats() {
        // Reset Events
        app.events = [];

        // Reset Score
        match.score = { home: 0, guest: 0 };
        match.updateScoreboard();

        // Reset Sidebar Counters
        const counters = [
            'count-defense-plus',
            'count-defense-minus',
            'count-gradual-btn',
            'count-fast-btn',
            'count-tech-faults',
            'count-penalties'
        ];
        counters.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });

        // Clear Action Logs (Under Court)
        const logContainer = document.getElementById('action-logs');
        if (logContainer) logContainer.innerHTML = '';


        // Persist Empty State (Fix: Use fsManager directly)
        if (fsManager.handle) {
            fsManager.saveFile('match_events.json', JSON.stringify([], null, 2));
        }

        // Update Dashboard
        this.update();

        app.showNotification("Statistiky byly vymazány.", "success");
    },



    setStatsTeam(teamKey) {
        this.activeStatsTeam = teamKey;

        // Toggle Buttons Visual
        const btnHome = document.getElementById('stat-toggle-home');
        const btnGuest = document.getElementById('stat-toggle-guest');

        if (btnHome && btnGuest) {
            if (teamKey === 'home') {
                btnHome.classList.add('active');
                btnGuest.classList.remove('active');
            } else {
                btnHome.classList.remove('active');
                btnGuest.classList.add('active');
            }
        }

        this.updateStats();
    },

    updateStats() {
        try {
            const teamKey = this.activeStatsTeam || 'home';

            // Safety Check
            if (!app.teams || !app.teams[teamKey]) {
                console.warn("Stats: Team not found for key:", teamKey);
                return;
            }

            const teamEvents = app.events.filter(e => e.teamKey === teamKey);

            // 1. SHOOTING EFFICIENCY (Team Attack) - ALL PLAYERS (Including GK)
            // Updated per user request: "Neúspěšná střela" and "Gol" from GK should count.

            // Previous logic excluded GKs. Now we include everyone.
            const fieldEvents = teamEvents;

            // Identify GK Numbers for filtering exceptions
            const gkNumbers = (app.teams[teamKey].players || [])
                .filter(p => p.position === 'GK' || p.position === 'BR' || (p.name && (p.name.includes('(GK)') || p.name.includes('(BR)'))))
                .map(p => String(p.number));

            // Goals
            const goals = fieldEvents.filter(e => e.actionType === 'Gól' || e.actionType === '7m Gól').length;

            // Misses (Robust)
            const missTypes = ['Neúspěšná střela', 'Mimo', 'Tyč', 'Chyceno', 'Zblokováno', 'Zákrok', '7m Neúspěšná', '7m Mimo', '7m Tyč', '7m Chyceno'];
            const misses = fieldEvents.filter(e => {
                const isMiss = missTypes.some(t => e.actionType && e.actionType.includes(t));
                if (!isMiss) return false;

                // EXCEPTION: GK Defensive Actions (Mimo, Zákrok) are NOT Offensive Misses
                const isGK = e.playerNumber && gkNumbers.includes(String(e.playerNumber));
                if (isGK) {
                    // For GK, Only explicit offensive miss counts
                    return e.actionType === 'Neúspěšná střela' || e.actionType === '7m Neúspěšná';
                }

                return true;
            }).length;

            const totalShots = goals + misses;
            let shotEff = 0;
            if (totalShots > 0) shotEff = Math.round((goals / totalShots) * 100);

            // 2. GK EFFICIENCY (Team Defense)
            // Saves (Logged by Team)
            const saves = teamEvents.filter(e => e.actionType.includes('Zákrok') || e.actionType.includes('Chyceno')).length;

            // Conceded (Logged by Team directly via "Obdržený gól")
            const conceded = teamEvents.filter(e => e.actionType.includes('Obdržený')).length;

            // Opponent Goals (Logged by Opponent as "Gól")
            const oppKey = teamKey === 'home' ? 'guest' : 'home';
            const oppEvents = app.events.filter(e => e.teamKey === oppKey);
            const oppGoals = oppEvents.filter(e => e.actionType === 'Gól' || e.actionType === '7m Gól').length;

            // Total Goals Against = Sum of both distinct logging methods
            // (Assumes user doesn't log the SAME goal twice using both buttons, which is standard behavior)
            const totalGoalsAgainst = conceded + oppGoals;

            // Total Shots ON TARGET Faced = Saves + Goals Allowed
            // (Excludes Misses/Blocks as requested: "střela mimo se nepočítá")
            const totalShotsFaced = saves + totalGoalsAgainst;

            let saveEff = 0;
            if (totalShotsFaced > 0) {
                saveEff = Math.round((saves / totalShotsFaced) * 100);
            }

            // Update UI
            const elShot = document.getElementById('stat-shot-efficiency');
            const elSave = document.getElementById('stat-save-efficiency');

            if (elShot) {
                elShot.textContent = `${shotEff}%`;
                elShot.style.color = teamKey === 'home' ? 'var(--primary)' : '#e74c3c';
            }

            if (elSave) {
                elSave.textContent = `${saveEff}%`;
                elSave.style.color = teamKey === 'home' ? 'var(--primary)' : '#e74c3c';
            }

            // Update Labels
            const lblShot = document.getElementById('lbl-shot-eff');
            const lblSave = document.getElementById('lbl-save-eff');

            if (lblShot) lblShot.textContent = `Úspěšnost střelby (${teamKey === 'home' ? 'Domácí' : 'Hosté'})`;
            if (lblSave) lblSave.textContent = `Úspěšnost brankáře (${teamKey === 'home' ? 'Domácí' : 'Hosté'})`;

        } catch (err) {
            console.error("Error updating stats:", err);
        }
    },


};

// --- EXPOSE TO WINDOW (Compatibility) ---
window.app = app;
window.authManager = authManager;
window.match = match;
window.matchTimer = matchTimer;
window.dashboard = dashboard;
window.teamManager = teamManager;

// Initialize Persistence
// FS Manager handles init

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {

    console.log("App loaded, attaching listeners...");
    authManager.init();

    // 2. Setup Start Button
    // 2. Direct Start (No directory selection)
    // Clear Match Setup on start? user request said "restart development", usually implies fresh state,
    // but app.init() will load from settings if they exist.
    // Let's just init.

    // AUTH CHECK: If not logged in, prompt
    if (!authManager.currentUser) {
        // Delay slightly to let UI render
        setTimeout(() => authManager.openLogin(), 500);
    }

    app.init();

    // 3. Setup UI Listeners (Tabs, etc)
    const btnH1 = document.getElementById('btn-toggle-h1');
    if (btnH1) btnH1.addEventListener('click', () => app.toggleHalf(1));

    const btnH2 = document.getElementById('btn-toggle-h2');
    if (btnH2) btnH2.addEventListener('click', () => app.toggleHalf(2));

    // Stats View Toggles
    const navOverview = document.getElementById('nav-overview');
    if (navOverview) {
        navOverview.addEventListener('click', (e) => {
            e.preventDefault();
            app.showOverview();
        });
    }

    const navHome = document.getElementById('nav-team-home');
    if (navHome) {
        navHome.addEventListener('click', (e) => {
            e.preventDefault();
            app.showTeamStats('home');
        });
    }

    const navGuest = document.getElementById('nav-team-guest');
    if (navGuest) {
        navGuest.addEventListener('click', (e) => {
            e.preventDefault();
            app.showTeamStats('guest');
        });
    }
});

// --- EVENT BINDING (Fix Reload Issue) ---
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-submit-auth');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // STOP FORM SUBMIT / RELOAD
            e.stopPropagation();
            if (typeof authManager !== 'undefined') {
                authManager.submitAuth();
            }
        });
    }
});
