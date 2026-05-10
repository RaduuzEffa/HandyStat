function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Handball Stats Live')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

/**
 * Zapisuje událost do Google Sheetu "Events"
 * @param {Object} data - Objekt s daty události
 */
function zapisUdalost(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Events');
  
  if (!sheet) {
    sheet = ss.insertSheet('Events');
    sheet.appendRow(['CasRazitko', 'CasZapasu', 'Tym', 'CisloHrace', 'TypAkce', 'PoziceX', 'PoziceY', 'Vysledek']);
  }
  
  sheet.appendRow([
    new Date(),
    data.matchTime,
    data.team,
    data.playerNumber,
    data.actionType,
    data.positionX,
    data.positionY,
    data.result
  ]);
  
  return { success: true, message: 'Uloženo' };
}

/**
 * Načte soupisky z Google Sheetu "Rosters"
 * Očekávaná struktura: TeamID, Number, Name, Position
 */
function loadRosters() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Rosters');
  
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const rosters = {};
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const [teamId, number, name, position] = data[i];
    if (!rosters[teamId]) rosters[teamId] = [];
    
    rosters[teamId].push({
      number: number,
      name: name,
      position: position
    });
  }
  
  return rosters;
}

/**
 * --- USER AUTHENTICATION ---
 */

function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    // Header: Email, PasswordHash, Role, Plan, SubExpiry, RegisteredDate
    sheet.appendRow(['Email', 'PasswordHash', 'Role', 'Plan', 'SubExpiry', 'RegisteredDate']);
  }
  return sheet;
}

function registerUser(userData) {
  // Lock to prevent race conditions (simple)
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const email = userData.email.toLowerCase();
    
    // Check Duplicate
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === email) {
        return { success: false, message: 'Uživatel již existuje.' };
      }
    }
    
    // Append
    sheet.appendRow([
      email,
      userData.passwordHash,
      userData.role || 'user',
      userData.plan || 'free',
      userData.subExpiry || '',
      new Date()
    ]);
    
    return { success: true };
    
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function loginUser(email, passwordHash) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const targetEmail = email.toLowerCase();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0].toString().toLowerCase() === targetEmail) {
      // Match found
      if (row[1] === passwordHash) {
        
        let plan = row[3];
        const subExpiry = row[4];
        
        // Líná kontrola (Lazy Check) vypršení předplatného
        if (plan === 'PRO' && subExpiry) {
          const expiryDate = new Date(subExpiry);
          const today = new Date();
          expiryDate.setHours(23, 59, 59, 999); // Konec dne
          
          if (today > expiryDate) {
            plan = 'free';
            sheet.getRange(i + 1, 4).setValue('free'); // Ulož do tabulky
            
            // Odeslat informační email adminovi
            try {
              MailApp.sendEmail({
                to: "pernicky@centrum.cz", // Změň na svůj reálný email
                subject: "HandyStat - Vypršení PRO verze",
                body: `Uživateli ${row[0]} právě vypršelo PRO předplatné (platné do ${subExpiry}) a byl při přihlášení automaticky přepnut do FREE verze.`
              });
            } catch(e) {
              console.log("Nepodařilo se odeslat email.");
            }
          }
        }

        return { 
          success: true, 
          user: {
            email: row[0],
            role: row[2],
            plan: plan, // Může být nově upravený na 'free'
            subExpiry: row[4]
          }
        };
      } else {
        return { success: false, message: 'Chybné heslo.' };
      }
    }
  }
  
  return { success: false, message: 'Uživatel neexistuje.' };
}

/**
 * --- EXTERNAL API SUPPORT (Wedos Hosting) ---
 */
function doPost(e) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result = {};
    
    if (action === 'register') {
      result = registerUser(params);
    } else if (action === 'login') {
      result = loginUser(params.email, params.passwordHash);
    } else if (action === 'getUsers') {
      result = getUsers();
    } else if (action === 'adminSetPlan') {
      result = setUserPlan(params.email, params.plan, params.subExpiry);
    } else if (action === 'adminDeleteUser') {
      result = deleteUser(params.email);
    } else {
      result = { success: false, message: 'Neznámá akce' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUsers() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];
  
  // Skip header (row 0)
  for (let i = 1; i < data.length; i++) {
    // Columns: Email, PasswordHash, Role, Plan, SubExpiry, RegisteredDate
    users.push({
      email: data[i][0],
      passwordHash: data[i][1],
      role: data[i][2],
      plan: data[i][3],
      subExpiry: data[i][4]
    });
  }
  return { success: true, users: users };
}

/**
 * --- ADMIN FUNCTIONS ---
 */

function setUserPlan(email, plan, subExpiry) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  
  try {
    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const targetEmail = email.toLowerCase();
    
    // Find User Row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === targetEmail) {
        // Update Plan (Col 4 -> Index 3) & Expiry (Col 5 -> Index 4)
        // Row is i + 1
        sheet.getRange(i + 1, 4).setValue(plan);
        sheet.getRange(i + 1, 5).setValue(subExpiry || '');
        return { success: true, message: 'Plán nastaven' };
      }
    }
    return { success: false, message: 'Uživatel nenalezen' };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteUser(email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  
  try {
    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const targetEmail = email.toLowerCase();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === targetEmail) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Uživatel smazán' };
      }
    }
    return { success: false, message: 'Uživatel nenalezen' };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * --- CRON JOB: Automatická denní kontrola ---
 * Tuto funkci nastav v Google Apps Script -> Triggery (Spouštěče) 
 * na "Založené na čase" -> "Denně" (např. 2:00 ráno).
 */
function checkExpiredSubscriptions() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  let expiredCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const email = data[i][0];
    const plan = data[i][3];
    const subExpiry = data[i][4];
    
    if (plan === 'PRO' && subExpiry) {
      const expiryDate = new Date(subExpiry);
      expiryDate.setHours(23, 59, 59, 999);
      
      if (today > expiryDate) {
        // Přepnout na FREE
        sheet.getRange(i + 1, 4).setValue('free');
        expiredCount++;
        
        // Notifikace adminovi
        try {
          MailApp.sendEmail({
            to: "pernicky@centrum.cz", // Tvůj email
            subject: "HandyStat Nocní Kontrola - Uživateli vypršelo PRO",
            body: `Uživateli ${email} vypršelo PRO předplatné (platilo do ${subExpiry}). \nAutomatický systém jej přepnul na FREE verzi.\n\nMůžeš mu poslat email a nabídnout prodloužení.`
          });
        } catch(e) {}
      }
    }
  }
  return `Hotovo. Expirovalo: ${expiredCount} uživatelů.`;
}
