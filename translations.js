const TRANSLATIONS = {
    cs: {
        // HEADER
        "header.login": "Přihlásit",
        "header.logout": "Odhlásit",
        "header.unknown": "Nepřihlášen",
        "header.admin": "ADMINISTRACE",
        "header.upgrade": "UPGRADE",

        // STARTUP
        "startup.welcome": "Vítejte v aplikaci",
        "startup.title": "HandyStat for Handball",
        "startup.select_dir": "Vybrat adresář",
        "startup.hint_dir": "Aplikace bude ukládat data lokálně na váš disk.",
        "startup.continue": "Pro pokračování vyberte adresář pro ukládání dat.",

        // SETUP
        "setup.title": "Nastavení utkání",
        "setup.date": "Datum",
        "setup.time": "Čas",
        "setup.duration": "Délka utkání",
        "setup.home_team": "Domácí tým",
        "setup.guest_team": "Hostující tým",
        "setup.roster_home": "Soupiska DOMÁCÍ",
        "setup.roster_guest": "Soupiska HOSTÉ",
        "setup.roster_placeholder": "Číslo Jméno (jeden na řádek)",
        "setup.roster_hint": "Formát: Číslo Jméno (GK pro brankáře)",
        "setup.start_btn": "Zahájit utkání",
        "setup.library_title": "Knihovna týmů",
        "setup.team_name": "Název týmu",
        "setup.roster_struct": "Soupiska",
        "setup.max_30": "(Max 30 hráčů)",
        "setup.add_player": "Přidat hráče",
        "setup.save_team": "Uložit tým",
        "setup.saved_teams": "Uložené týmy",

        // MATCH - SCOREBOARD & PANELS
        "match.period_1": "1. poločas",
        "match.period_2": "2. poločas",
        "match.overtime": "Prodloužení",
        "match.home": "Domácí",
        "match.guest": "Hosté",
        "match.on_court": "Na hřišti",
        "match.bench": "Lavička",
        "match.overlay_warning": "Pro zapsání statistiky je nutno vybrat sektor, ze kterého byla akce provedena.",

        // ACTIONS
        "action.defense": "Obrana",
        "action.gradual_attack": "Postupný útok",
        "action.fast_attack": "Rychlý protiútok",
        "action.tech_faults": "Technické<br>chyby",
        "action.penalties": "Tresty",
        "action.timeout": "Timeout",

        // MODALS
        "modal.shot_result.title": "Výsledek střelby",
        "modal.shot.goal": "GÓL",
        "modal.shot.save": "NEÚSPĚŠNÁ STŘELA", // Changed per request logic potentially? Or just "Saved"?
        "modal.shot.miss": "MIMO BRANKU",
        "modal.shot.cancel": "Zrušit",
        "modal.shot.back": "Zpět",
        "modal.shot.placement_prompt": "Kam střela směřovala?",

        "modal.gk_select.title": "Vyber brankáře",
        "modal.player_select.title": "Vyber hráče k utkání",
        "modal.player_select.confirm": "Potvrdit výběr",

        "modal.tech.title": "Technická chyba",
        "modal.tech.steps": "Kroky",
        "modal.tech.line": "Přešlap",
        "modal.tech.pass": "Špatná přihrávka",
        "modal.tech.generic": "Technická chyba",
        "modal.tech.charge": "Prorážení",

        "modal.penalty.title": "Trest",
        "modal.penalty.yellow": "Žlutá karta",
        "modal.penalty.2min": "2 minuty",
        "modal.penalty.red": "Červená karta",
        "modal.penalty.blue": "Modrá karta",

        "modal.end_match.title": "Konec utkání",
        "modal.end_match.prompt": "Ukončit utkání nebo nastavit prodloužení?",
        "modal.end_match.setup_ot": "Nastavit prodloužení",
        "modal.end_match.confirm": "Ukončit utkání",

        "modal.confirm.title": "Upozornění",
        "modal.confirm.yes": "Ano, smazat",
        "modal.confirm.no": "Ne",

        // NOTIFICATIONS
        "notif.match_started": "Utkání zahájeno",
        "notif.shot_saved": "Střela zapsána",
        "notif.error_goal_placement": "Gól musí být umístěn do branky!",
        "notif.error_miss_placement": "Střela mimo bránu musí být umístěna mimo brankovou konstrukci!",
        "notif.login_error": "Vyplňte email a heslo!",
        "notif.user_not_found": "Uživatel s tímto emailem neexistuje!",
        "notif.password_error": "Nesprávné heslo.",

        // DASHBOARD
        "dash.title": "Zápis průběhu utkání",
        "dash.shot_eff": "Úspěšnost střelby",
        "dash.save_eff": "Úspěšnost brankáře",
        "dash.clear_stats": "Vymazat statistiky",
        "dash.print_pdf": "Tisk PDF",
        "dash.export_csv": "Export CSV",
        "dash.table_time": "Čas",
        "dash.table_team": "Tým",
        "dash.table_player": "Hráč",
        "dash.table_action": "Akce",
        "dash.table_sector": "Sektor",
        "dash.timeline_1": "1. poločas",
        "dash.timeline_2": "2. poločas",
        "dash.graph_stats": "Grafická statistika",
        "dash.tech_match": "Technický zápis",
        "dash.team_btn": "Tým",
        "dash.select_player": "Hráč",
        "dash.select_gk": "Brankář",
        "dash.select_role": "Herní funkce",

        // STATS MODAL
        "stats.match_title": "Statistika utkání",
        "stats.col_player": "Hráč",
        "stats.col_defense": "Obrana",
        "stats.col_tech": "T.CH.",
        "stats.col_penalties": "Tresty",
        "stats.col_shots_goals": "Počet střel / Gól",
        "stats.col_saves_shots": "Zákroky / Počet střel"

    },
    en: {
        // HEADER
        "header.login": "Login",
        "header.logout": "Logout",
        "header.unknown": "Not Logged In",
        "header.admin": "ADMINISTRATION",
        "header.upgrade": "UPGRADE",

        // STARTUP
        "startup.welcome": "Welcome to",
        "startup.title": "HandyStat for Handball",
        "startup.select_dir": "Select Directory",
        "startup.hint_dir": "Application saves data locally to your drive.",
        "startup.continue": "Select a storage directory to continue.",

        // SETUP
        "setup.title": "Match Setup",
        "setup.date": "Date",
        "setup.time": "Time",
        "setup.duration": "Duration",
        "setup.home_team": "Home Team",
        "setup.guest_team": "Guest Team",
        "setup.roster_home": "Roster HOME",
        "setup.roster_guest": "Roster GUEST",
        "setup.roster_placeholder": "Number Name (one per line)",
        "setup.roster_hint": "Format: Number Name (GK for Goalkeeper)",
        "setup.start_btn": "Start Match",
        "setup.library_title": "Team Library",
        "setup.team_name": "Team Name",
        "setup.roster_struct": "Roster",
        "setup.max_30": "(Max 30 players)",
        "setup.add_player": "Add Player",
        "setup.save_team": "Save Team",
        "setup.saved_teams": "Saved Teams",

        // MATCH
        "match.period_1": "1st Half",
        "match.period_2": "2nd Half",
        "match.overtime": "Overtime",
        "match.home": "Home",
        "match.guest": "Guest",
        "match.on_court": "On Court",
        "match.bench": "Bench",
        "match.overlay_warning": "Select a sector to record the action.",

        // ACTIONS
        "action.defense": "Defense",
        "action.gradual_attack": "Gradual Attack",
        "action.fast_attack": "Fast Break",
        "action.tech_faults": "Technical<br>Faults",
        "action.penalties": "Penalties",
        "action.timeout": "Timeout",

        // MODALS
        "modal.shot_result.title": "Shot Result",
        "modal.shot.goal": "GOAL",
        "modal.shot.save": "MISSED SHOT",
        "modal.shot.miss": "OFF TARGET",
        "modal.shot.cancel": "Cancel",
        "modal.shot.back": "Back",
        "modal.shot.placement_prompt": "Where was the shot aimed?",

        "modal.gk_select.title": "Select Goalkeeper",
        "modal.player_select.title": "Select Players",
        "modal.player_select.confirm": "Confirm Selection",

        "modal.tech.title": "Technical Fault",
        "modal.tech.steps": "Traveling",
        "modal.tech.line": "Line Violation",
        "modal.tech.pass": "Bad Pass",
        "modal.tech.generic": "Technical Fault",
        "modal.tech.charge": "Charging",

        "modal.penalty.title": "Penalty",
        "modal.penalty.yellow": "Yellow Card",
        "modal.penalty.2min": "2 Minutes",
        "modal.penalty.red": "Red Card",
        "modal.penalty.blue": "Blue Card",

        "modal.end_match.title": "End Match",
        "modal.end_match.prompt": "End match or setup overtime?",
        "modal.end_match.setup_ot": "Setup Overtime",
        "modal.end_match.confirm": "End Match",

        "modal.confirm.title": "Warning",
        "modal.confirm.yes": "Yes, delete",
        "modal.confirm.no": "No",

        // NOTIFICATIONS
        "notif.match_started": "Match Started",
        "notif.shot_saved": "Shot Recorded",
        "notif.error_goal_placement": "Goal must be placed inside the goal!",
        "notif.error_miss_placement": "Off-target shot must be placed outside the goal!",
        "notif.login_error": "Enter email and password!",
        "notif.user_not_found": "User not found!",
        "notif.password_error": "Incorrect password.",

        // DASHBOARD
        "dash.title": "Match Log",
        "dash.shot_eff": "Shot Efficiency",
        "dash.save_eff": "Save Efficiency",
        "dash.clear_stats": "Clear Stats",
        "dash.print_pdf": "Print PDF",
        "dash.export_csv": "Export CSV",
        "dash.table_time": "Time",
        "dash.table_team": "Team",
        "dash.table_player": "Player",
        "dash.table_action": "Action",
        "dash.table_sector": "Sector",
        "dash.timeline_1": "1st Half",
        "dash.timeline_2": "2nd Half",
        "dash.graph_stats": "Graphical Stats",
        "dash.tech_match": "Match Report",
        "dash.team_btn": "Team",
        "dash.select_player": "Player",
        "dash.select_gk": "Goalkeeper",
        "dash.select_role": "Position",

        // STATS MODAL
        "stats.match_title": "Match Statistics",
        "stats.col_player": "Player",
        "stats.col_defense": "Defense",
        "stats.col_tech": "Tech. F.",
        "stats.col_penalties": "Penalties",
        "stats.col_shots_goals": "Shots / Goals",
        "stats.col_saves_shots": "Saves / Shots"
    }
};
