import { db, auth, secondaryAuth } from "./firebase.js";

import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import {
  getStorage,
  ref,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js";

const storage = getStorage();

const DOCENTE_EMAIL = "profcapasso1994@gmail.com";

let alunni = [];
let consegne = [];
let cartelle = [];
let classiNascoste =
    JSON.parse(
        localStorage.getItem("classiNascoste")
    ) || [];
	let consegneLette =
    JSON.parse(
        localStorage.getItem("consegneLette")
    ) || [];

let unsubscribeConsegne = null;
let consegneAttive = true;

const loginBox =
    document.getElementById("loginBox");

const dashboardBox =
    document.getElementById("dashboardBox");

const passwordInput =
    document.getElementById("passwordDocente");

const loginBtn =
    document.getElementById("loginBtn");

const loginError =
    document.getElementById("loginError");

const otpBox =
    document.getElementById("otpBox");

const classiContainer =
    document.getElementById("classiContainer");

const dettaglioClasse =
    document.getElementById("dettaglioClasse");

const statClassi =
    document.getElementById("statClassi");

const statAlunni =
    document.getElementById("statAlunni");

const statConsegne =
    document.getElementById("statConsegne");

const deliveryStatusText =
    document.getElementById("deliveryStatusText");

const toggleDeliveryBtn =
    document.getElementById("toggleDeliveryBtn");

if (otpBox) {
    otpBox.classList.add("hidden");
}

if (toggleDeliveryBtn) {
    toggleDeliveryBtn.addEventListener(
        "click",
        cambiaStatoConsegne
    );
}

/* =========================
   LOGIN DOCENTE
   ========================= */

loginBtn.addEventListener(
    "click",
    async () => {

        loginError.style.display = "none";

        const password =
            passwordInput.value.trim();

        if (!password) {

            loginError.textContent =
                "Inserisci la password docente.";

            loginError.style.display = "block";
            return;
        }

        try {

            await signInWithEmailAndPassword(
                auth,
                DOCENTE_EMAIL,
                password
            );

        } catch (error) {

            loginError.textContent =
                "Errore login: credenziali non corrette.";

            loginError.style.display = "block";

            console.error(error);
        }
    }
);

onAuthStateChanged(auth, user => {

    if (
        user &&
        user.email === DOCENTE_EMAIL
    ) {

        loginBox.classList.add("hidden");

        dashboardBox.classList.remove(
            "hidden"
        );

        caricaConsegne();
        caricaStatoConsegne();

    } else {

        loginBox.classList.remove("hidden");

        dashboardBox.classList.add(
            "hidden"
        );

        if (classiContainer)
            classiContainer.innerHTML = "";

        if (dettaglioClasse)
            dettaglioClasse.innerHTML = "";
    }
});

/* =========================
   CONSEGNE
   ========================= */

async function caricaConsegne() {

    classiContainer.innerHTML =
        "Caricamento consegne...";

    await caricaAlunni();
	await caricaCartelle();

    if (unsubscribeConsegne) {
        unsubscribeConsegne();
    }

    const consegneQuery = query(
        collection(db, "consegne"),
        where("annoScolastico", "==", annoScolasticoSelezionato)
    );

    unsubscribeConsegne = onSnapshot(

        consegneQuery,

        snapshot => {

            consegne =
                snapshot.docs.map(docSnap => {

                    const data =
                        docSnap.data();

                    return {

                        id: docSnap.id,

                        ...data,

                        allegati:
                            Array.isArray(data.allegati)
                                ? data.allegati
                                : [],

                        classePulita:
                            normalizzaClasse(
                                data.classe
                            ),

                        data:
                            data.creatoIl &&
                            data.creatoIl.toDate
                                ? data.creatoIl.toDate()
                                : new Date()
                    };
                });

            mostraClassi();
			aggiornaDashboardLive();
        },

        error => {

            console.error(
                "Errore realtime Firestore:",
                error
            );

            classiContainer.innerHTML =
                "Errore nel caricamento realtime.";
        }
    );
}

/* =========================
   STATO CONSEGNE
   ========================= */

async function caricaStatoConsegne() {

    const ref =
        doc(db, "settings", "consegne");

    const snap =
        await getDoc(ref);

    if (!snap.exists()) {

        await setDoc(ref, {
            attive: true
        });

        consegneAttive = true;

    } else {

        consegneAttive =
            snap.data().attive === true;
    }

    aggiornaStatoConsegneUI();
}

async function cambiaStatoConsegne() {

    const nuovoStato =
        !consegneAttive;

    await updateDoc(

        doc(db, "settings", "consegne"),

        {
            attive: nuovoStato
        }
    );

    consegneAttive =
        nuovoStato;

    aggiornaStatoConsegneUI();
}

function aggiornaStatoConsegneUI() {

    const panel =
        document.querySelector(
            ".premium-delivery-panel"
        );

    if (consegneAttive) {

        deliveryStatusText.textContent =
            "Stato consegne: ATTIVE";

        toggleDeliveryBtn.textContent =
            "Disattiva consegne";

        if (panel) {

            panel.classList.remove(
                "delivery-closed"
            );

            panel.classList.add(
                "delivery-open"
            );
        }

        toggleDeliveryBtn.classList.remove(
            "danger-btn"
        );

    } else {

        deliveryStatusText.textContent =
            "Stato consegne: CHIUSE";

        toggleDeliveryBtn.textContent =
            "Riattiva consegne";

        if (panel) {

            panel.classList.remove(
                "delivery-open"
            );

            panel.classList.add(
                "delivery-closed"
            );
        }

        toggleDeliveryBtn.classList.add(
            "danger-btn"
        );
    }
}

/* =========================
   CLASSI
   ========================= */

function normalizzaClasse(classe) {

    let c =
        String(classe || "")
            .toUpperCase()
            .trim();

    c =
        c.replace(/[^A-Z0-9]/g, "");

    const match =
        c.match(/^(\d)([A-Z])(.+)$/);

    if (match) {

        return `
${match[1]}${match[2]} ${match[3]}
        `.trim();
    }

    return c;
}

function mostraClassi() {

    aggiornaStatistiche();

    dettaglioClasse.innerHTML = "";

    const classiConsegne = consegne.map(c => c.classePulita);

    const classiAlunni = alunni.map(a =>
        normalizzaClasse(a.classe)
    );

    const classi = [
        ...new Set([
            ...classiConsegne,
            ...classiAlunni
        ])
    ]
    .filter(c => c && !classiNascoste.includes(c))
    .sort();

    if (classi.length === 0) {
        classiContainer.innerHTML = `
            <div class="empty-box">
                Nessuna classe da mostrare.
            </div>
        `;
        return;
    }

    classiContainer.innerHTML = classi.map(classe => {

        const totale = consegne.filter(
            c => c.classePulita === classe
        ).length;

        const nuoveConsegne = consegne.filter(
            c =>
                c.classePulita === classe &&
                !consegneLette.includes(c.id)
        ).length;

        const totaleAlunni = alunni.filter(
            a => normalizzaClasse(a.classe) === classe
        ).length;

        const icone = [
            getUIIconSVG('users'),
            getUIIconSVG('graduation'),
            getUIIconSVG('brain'),
            getUIIconSVG('books'),
            getUIIconSVG('coder'),
            getUIIconSVG('lab'),
            getUIIconSVG('book'),
            getUIIconSVG('idea')
        ];

        const glowIndex = (classe.charCodeAt(0) % 5) + 1;

        const emoji = icone[
            classe.charCodeAt(0) % icone.length
        ];

       const ultimaClasse = consegne
    .filter(c => c.classePulita === classe)
    .sort((a, b) => b.data - a.data)[0];

return `
    <div class="
        classe-card
        premium-classe-card
        teacher-class-card-clean
        ${nuoveConsegne > 0 ? `classe-glow-${glowIndex}` : ""}
    ">

        <div class="class-card-head">
            <div>
                <span class="class-label">Classe</span>
                <h3>${classe}</h3>
            </div>

            <button
                class="classe-menu"
                onclick="toggleMenuClasse('${classe}')"
            >
                ⋮
            </button>

            <div class="classe-dropdown" id="menu-${classe}">
                <button onclick="eliminaClasse('${classe}')">
                    ${getUIIconSVG('trash')} Elimina classe
                </button>
            </div>
        </div>

        <div class="class-card-stats">
            <span>${totaleAlunni} alunni</span>
            <span>${totale} consegne</span>
        </div>

        ${
            nuoveConsegne > 0
            ? `<div class="new-badge">${nuoveConsegne} nuove consegne</div>`
            : ""
        }

        <div class="class-last-delivery">
            <small>Ultima consegna</small>
            <strong>
                ${
                    ultimaClasse
                    ? `${escapeHtml(ultimaClasse.cognome || "")} ${escapeHtml(ultimaClasse.nome || "")}`
                    : "Nessuna consegna"
                }
            </strong>
            <p>
                ${
                    ultimaClasse
                    ? escapeHtml(ultimaClasse.verifica || "Senza titolo")
                    : "La classe non ha ancora consegne."
                }
            </p>
        </div>

        <button
            class="open-class-btn"
            onclick="apriClasse('${classe}')"
        >
            Apri classe →
        </button>

    </div>
`;
    }).join("");
}

function apriClasse(classe) {

    consegne
        .filter(c => c.classePulita === classe)
        .forEach(c => {
            if (!consegneLette.includes(c.id)) {
                consegneLette.push(c.id);
            }
        });

    localStorage.setItem("consegneLette", JSON.stringify(consegneLette));

    const consegneClasse = consegne.filter(c => c.classePulita === classe);

    const cartelleClasse = cartelle.filter(
        cartella => normalizzaClasse(cartella.classe) === classe
    );

    const consegneNonAssegnate = consegneClasse.filter(
        c => !c.cartellaId
    );

    classiContainer.innerHTML = "";

    dettaglioClasse.innerHTML = `
        <div class="classe-detail">

            <button class="back-btn" onclick="mostraClassi()">
                ← Torna alle classi
            </button>

            <h2>${classe}</h2>

            <div class="folder-actions">
                <button
                    class="create-folder-btn"
                    onclick="creaCartellaClasse('${classe}')"
                >
                    ➕ Crea cartella
                </button>
            </div>

            ${cartelleClasse.map(cartella => {
                const consegneCartella = consegneClasse.filter(
                    c => c.cartellaId === cartella.id
                );

                return `
                    <div class="mese-box verifica-folder">

                        <div
                            class="folder-header"
                            onclick="toggleFolder('${cartella.id}')"
                        >
                            <div class="folder-left">
                                ${getUIIconSVG('folder')}
                                <span>${cartella.nome}</span>
                            </div>

                            <div class="folder-right">
                                <div class="folder-count">
                                    ${consegneCartella.length}
                                </div>

                                <button
                                    class="folder-menu-btn"
                                    onclick="event.stopPropagation(); toggleFolderMenu('${cartella.id}')"
                                >
                                    ⋮
                                </button>
                            </div>
                        </div>

                        <div
                            class="folder-dropdown"
                            id="folder-menu-${cartella.id}"
                        >
                            <button
                                onclick="rinominaCartella('${cartella.id}')"
                            >
                                ${getUIIconSVG('edit')} Rinomina
                            </button>

                            <button
                                onclick="eliminaCartella('${cartella.id}')"
                            >
                                ${getUIIconSVG('trash')} Elimina
                            </button>
                        </div>

                        <div
                            class="folder-content"
                            id="folder-${cartella.id}"
                        >
                            ${consegneCartella.map(c => creaCardConsegna(c)).join("")}
                        </div>

                    </div>
                `;
            }).join("")}

            <div class="mese-box verifica-folder">

                <div
                    class="folder-header"
                    onclick="toggleFolder('non-assegnate')"
                >
                            <div class="folder-left">
                        ${getUIIconSVG('inbox')}
                        <span>Non assegnate</span>
                    </div>

                    <div class="folder-count">
                        ${consegneNonAssegnate.length}
                    </div>
                </div>

                <div
                    class="folder-content"
                    id="folder-non-assegnate"
                >
                    ${consegneNonAssegnate.map(c => creaCardConsegna(c)).join("")}
                </div>

            </div>

        </div>
    `;
}

function creaCardConsegna(c) {
    const corretta = c.statoCorrezione === "corretta";

    return `
        <div class="teacher-assignment-card">

            <div class="assignment-main">
                <div class="assignment-student">
                    <strong>${escapeHtml(c.cognome)} ${escapeHtml(c.nome)}</strong>
                    <span>${escapeHtml(c.verifica || "Senza titolo")}</span>
                    <small>${escapeHtml(c.classePulita || c.classe || "")} · ${formattaData(c.data)}</small>
                </div>

                <div class="assignment-content">
                    ${creaContenutiConsegna(c)}
                </div>
            </div>

            <div class="assignment-correction">
                <span class="${corretta ? "status-ok-mini" : "status-wait-mini"}">
                    ${corretta ? "Corretta" : "Da correggere"}
                </span>

                ${
                    c.voto
                    ? `<span class="${getClasseVoto(c.voto)}">Voto: ${escapeHtml(c.voto)}</span>`
                    : `<span class="voto-empty">Senza voto</span>`
                }

                ${
                    c.commentoDocente
                    ? `<p>${escapeHtml(c.commentoDocente)}</p>`
                    : `<p class="muted-text">Nessun commento inserito.</p>`
                }

                <button
                    class="teacher-correct-btn"
                    type="button"
                    onclick="apriOverlayCorrezione('${c.id}')"
                >
                    ${corretta ? "Rivedi correzione" : "Correggi"}
                </button>
            </div>

            <button
                class="compito-menu-btn"
                onclick="toggleCompitoMenu('${c.id}')"
            >
                ⋮
            </button>

            <div class="compito-dropdown" id="compito-menu-${c.id}">
                <button onclick="spostaConsegnaInCartella('${c.id}')">
                    ${getUIIconSVG('folder')} Sposta in cartella
                </button>

                <button onclick="eliminaConsegna('${c.id}')">
                    ${getUIIconSVG('trash')} Elimina consegna
                </button>
            </div>

        </div>
    `;
}

import { getUIIconSVG, getFileIconSVG } from './icons.js';

function creaContenutiConsegna(c) {
    let html = "";

    const haFile = c.allegati && c.allegati.length > 0;
    const haCodice = c.codice && c.codice.trim() !== "";
    const haUrl = c.urlConsegna && c.urlConsegna.trim() !== "";

    if (haFile && haCodice && haUrl) html += `<span class="mini-badge">MISTA</span>`;
    else if (haFile && haCodice) html += `<span class="mini-badge">FILE + CODICE</span>`;
    else if (haFile && haUrl) html += `<span class="mini-badge">FILE + URL</span>`;
    else if (haCodice && haUrl) html += `<span class="mini-badge">CODICE + URL</span>`;
    else if (haFile) html += `<span class="mini-badge">FILE</span>`;
    else if (haCodice) html += `<span class="mini-badge">CODICE</span>`;
    else if (haUrl) html += `<span class="mini-badge">URL</span>`;

    if (haFile) {
        html += c.allegati.map(file => {
            const fileName = file.fileName || "documento";
            const type = fileName.split(".").pop().toLowerCase();

            let className = "file-doc";
            if (type === "pdf") {
                className = "file-pdf";
            } else if (["c","cpp","h","hpp","js","java","py","html","css","txt"].includes(type)) {
                className = "file-code";
            } else if (["zip","rar"].includes(type)) {
                className = "file-zip";
            } else if (["doc","docx"].includes(type)) {
                className = "file-doc";
            } else if (["xls","xlsx","csv"].includes(type)) {
                className = "file-doc";
            } else if (["jpg","jpeg","png"].includes(type)) {
                className = "file-image";
            }

            return `
                <a href="${file.fileURL}" target="_blank" class="open-link ${className}">
                    <div class="file-icon">${getFileIconSVG(type)}</div>
                    <div class="file-name">${fileName}</div>
                </a>
            `;
        }).join("");
    }

    if (haCodice) {
        html += `
            <button class="open-link file-code" onclick="mostraCodiceConsegna('${c.id}')">
                <div class="file-icon">${getFileIconSVG('code')}</div>
                <div class="file-name">Apri codice</div>
            </button>
        `;
    }

    if (haUrl) {
        html += `
            <a href="${c.urlConsegna}" target="_blank" class="open-link file-link">
                <div class="file-icon">${getFileIconSVG('link')}</div>
                <div class="file-name">Apri link</div>
            </a>
        `;
    }

    if (!haFile && !haCodice && !haUrl) {
        return `<span>Nessun contenuto</span>`;
    }

    return html;
}

/* =========================
   CODICE
   ========================= */

function mostraCodiceConsegna(id) {

    const consegna =
        consegne.find(c => c.id === id);

    if (
        !consegna ||
        !consegna.codice
    ) {

        alert(
            "Nessun codice trovato."
        );

        return;
    }

    const win =
        window.open("", "_blank");

    win.document.write(`

        <html>

        <body
            style="
                font-family:Arial;
                padding:30px;
                background:#f4f6f8;
            "
        >

            <h2>
                Codice consegnato
            </h2>

            <pre
                style="
                    background:white;
                    padding:20px;
                    border-radius:12px;
                    white-space:pre-wrap;
                "
            >

${String(consegna.codice)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}

            </pre>

        </body>

        </html>
    `);

    win.document.close();
}
/* =========================
   NASCONDI CLASSE
   ========================= */

function nascondiClasse(classe) {

    if (!classiNascoste.includes(classe)) {
        classiNascoste.push(classe);
    }

    localStorage.setItem(
        "classiNascoste",
        JSON.stringify(classiNascoste)
    );

    mostraClassi();
}

/* =========================
   DATE
   ========================= */

function formattaData(value) {

    const data =
        new Date(value);

    if (isNaN(data))
        return value;

    return data.toLocaleDateString(
        "it-IT"
    );
}

function formattaMese(value) {

    const data =
        new Date(value);

    if (isNaN(data))
        return "SENZA DATA";

    return data.toLocaleDateString(
        "it-IT",
        {
            month: "long",
            year: "numeric"
        }
    ).toUpperCase();
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getClasseVoto(voto) {
    if (!voto) return "";

    const testo = String(voto)
        .toLowerCase()
        .trim()
        .replace(",", ".")
        .replace("½", ".5");

    let numero = parseFloat(testo);

    if (isNaN(numero)) {
        return "";
    }

    if (testo.includes("-") && numero >= 6) {
        numero = numero - 0.25;
    }

    if (numero < 5) {
        return "voto-rosso";
    }

    if (numero < 6) {
        return "voto-giallo";
    }

    return "voto-verde";
}

/* =========================
   ALUNNI FIREBASE
   ========================= */

const studentNome =
    document.getElementById("studentNome");

const studentCognome =
    document.getElementById("studentCognome");

const studentClasse =
    document.getElementById("studentClasse");

const studentUsername =
    document.getElementById("studentUsername");

const studentPassword =
    document.getElementById("studentPassword");

const createStudentBtn =
    document.getElementById("createStudentBtn");

const studentSuccess =
    document.getElementById("studentSuccess");

const studentError =
    document.getElementById("studentError");

const studentList =
    document.getElementById("studentList");

if (createStudentBtn) {
    createStudentBtn.addEventListener(
        "click",
        creaAlunno
    );
}

async function creaAlunno() {

    studentSuccess.style.display = "none";
    studentError.style.display = "none";

    const nome =
        studentNome.value.trim();

    const cognome =
        studentCognome.value.trim();

    const classe =
        studentClasse.value.trim();

    const username =
        studentUsername.value
            .trim()
            .toLowerCase();

    const password =
        studentPassword.value.trim();

    if (
        !nome ||
        !cognome ||
        !classe ||
        !username ||
        !password
    ) {

        studentError.textContent =
            "Compila tutti i campi dell'alunno.";

        studentError.style.display =
            "block";

        return;
    }

    try {

        const emailAlunno =
            usernameToEmail(username);

        const cred =
            await createUserWithEmailAndPassword(
                secondaryAuth,
                emailAlunno,
                password
            );

        await setDoc(
            doc(db, "alunni", cred.user.uid),
            {
                uid: cred.user.uid,
                nome,
                cognome,
                classe,
                username,
                email: emailAlunno,
                ruolo: "alunno",
                attivo: true,
                annoScolastico: annoScolasticoSelezionato,
                creatoIl: new Date()
            }
        );

        await signOut(secondaryAuth);

        studentSuccess.textContent =
            "✅ Alunno creato correttamente! Riceverà un'email con le credenziali.";

        studentSuccess.style.display =
            "block";

        studentNome.value = "";
        studentCognome.value = "";
        studentClasse.value = "";
        studentUsername.value = "";
        studentPassword.value = "";

        caricaAlunni();
        
        setTimeout(() => {
            studentSuccess.style.display = "none";
        }, 5000);

    } catch (error) {

        studentError.textContent =
            "Errore: " + error.message;

        studentError.style.display =
            "block";

        console.error(error);
    }
}

async function caricaCartelle() {
    const snapshot = await getDocs(
        query(
            collection(db, "cartelle"),
            where("annoScolastico", "==", annoScolasticoSelezionato)
        )
    );

    cartelle = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

async function caricaAlunni() {
        try {
        const q = query(
            collection(db, "alunni"),
            where("annoScolastico", "==", annoScolasticoSelezionato)
        );

        const snapshot = await getDocs(q);

        alunni =
            snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

        if (alunni.length === 0) {

            studentList.innerHTML = `
                <div class="empty-box">
                    Nessun alunno creato.
                </div>
            `;

            return;
        }

        studentList.innerHTML =
            alunni.map(a => `

                <div class="student-item">

                    <div>

                        <strong>
                            ${a.cognome} ${a.nome}
                        </strong>

                        <p>
                            ${a.classe}
                        </p>

                    </div>

                    <div class="student-actions">

                        <span class="student-username">
                            ${a.username}
                        </span>

                        <button
                            class="delete-student-btn"
                            onclick="eliminaAlunno('${a.id}')"
                        >
                            Elimina
                        </button>

                    </div>

                </div>

            `).join("");
    } catch (error) {

        studentList.innerHTML = `
            <div class="empty-box">
                Errore caricamento alunni.
            </div>
        `;

        console.error(error);
    }
}

async function eliminaAlunno(id) {

    const conferma =
        confirm(
            "Vuoi eliminare questo alunno?"
        );

    if (!conferma) return;

    try {

        await deleteDoc(
            doc(db, "alunni", id)
        );

        caricaAlunni();

    } catch (error) {

        alert(
            "Errore: " + error.message
        );
    }
}

function usernameToEmail(username) {

    return username
        .toLowerCase()
        .replace(/\s+/g, "")
        + "@capassowork.local";
}

function mostraSezioneDashboard(sezione) {

    document
        .getElementById("sezioneDashboard")
        ?.classList.add("hidden");

    document
        .getElementById("sezioneClassi")
        ?.classList.add("hidden");

    document
        .getElementById("sezioneAlunni")
        ?.classList.add("hidden");

    if (sezione === "dashboard") {

        document
            .getElementById("sezioneDashboard")
            ?.classList.remove("hidden");

    }

    if (sezione === "classi") {

        document
            .getElementById("sezioneClassi")
            ?.classList.remove("hidden");

    }

    if (sezione === "alunni") {

        document
            .getElementById("sezioneAlunni")
            ?.classList.remove("hidden");

    }

    document
        .querySelectorAll(".side-link")
        .forEach(link => {
            link.classList.remove("active");
        });

    const buttons =
        document.querySelectorAll(".side-link");

    if (sezione === "dashboard") {

        buttons[0]?.classList.add("active");

    }

    if (sezione === "classi") {

        buttons[1]?.classList.add("active");

    }

    if (sezione === "alunni") {

        buttons[2]?.classList.add("active");

    }
}
function aggiornaStatistiche() {

    statClassi.textContent =
        [...new Set(
            alunni.map(a => a.classe)
        )].length;

    statAlunni.textContent =
        alunni.length;

    statConsegne.textContent =
        consegne.length;
}

function aggiornaDataOraDashboard() {

    const dateBox =
        document.getElementById(
            "currentDate"
        );

    const timeBox =
        document.getElementById(
            "currentTime"
        );

    if (!dateBox || !timeBox)
        return;

    const now = new Date();

    dateBox.innerHTML =
        `${getUIIconSVG('calendar')} ` +
        now.toLocaleDateString(
            "it-IT",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    timeBox.innerHTML =
        `${getUIIconSVG('clock')} ` +
        now.toLocaleTimeString(
            "it-IT",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}

aggiornaDataOraDashboard();

setInterval(
    aggiornaDataOraDashboard,
    30000
);

function toggleMenuClasse(classe) {
    const menu = document.getElementById(`menu-${classe}`);

    if (!menu) return;

    const isOpen = menu.style.display === "block";

    document.querySelectorAll(".classe-dropdown").forEach(m => {
        m.style.display = "none";
    });

    menu.style.display = isOpen ? "none" : "block";
}

async function eliminaClasse(classe) {
    const conferma = confirm(
        `Vuoi eliminare completamente la classe ${classe}?\n\nSaranno eliminate consegne, alunni e file collegati.`
    );

    if (!conferma) return;

    const confermaFinale = confirm(
        `ATTENZIONE: operazione irreversibile.\n\nConfermi eliminazione definitiva di ${classe}?`
    );

    if (!confermaFinale) return;

    try {
        const consegneDaEliminare = consegne.filter(
            c => c.classePulita === classe
        );

        for (const consegna of consegneDaEliminare) {
            if (consegna.allegati && consegna.allegati.length > 0) {
                for (const file of consegna.allegati) {
                    try {
                        if (file.storagePath) {
                            await deleteObject(ref(storage, file.storagePath));
                        }
                    } catch (error) {
                        console.warn("File non eliminato:", error);
                    }
                }
            }

            await deleteDoc(doc(db, "consegne", consegna.id));
        }

        const alunniDaEliminare = alunni.filter(
            a => normalizzaClasse(a.classe) === classe
        );

        for (const alunno of alunniDaEliminare) {
            await deleteDoc(doc(db, "alunni", alunno.id));
        }

        localStorage.removeItem("classiNascoste");

        alert(`Classe ${classe} eliminata correttamente.`);

        await caricaAlunni();
        mostraClassi();

    } catch (error) {
        console.error(error);
        alert("Errore durante l'eliminazione della classe.");
    }
}


function toggleCompitoMenu(id) {
    const menu =
        document.getElementById(
            `compito-menu-${id}`
        );

    if (!menu) return;

    const open =
        menu.style.display === "block";

    document
        .querySelectorAll(".compito-dropdown")
        .forEach(m => {
            m.style.display = "none";
        });

    menu.style.display =
        open ? "none" : "block";
}

async function eliminaConsegna(id) {

    const conferma =
        confirm(
            "Eliminare questa consegna?"
        );

    if (!conferma) return;

    try {

        const consegna =
            consegne.find(
                c => c.id === id
            );

        if (!consegna) return;

        await deleteDoc(
            doc(db, "consegne", id)
        );

        alert(
            "Consegna eliminata."
        );

    } catch(error) {

        console.error(error);

        alert(
            "Errore eliminazione."
        );
    }
}
function toggleFolder(id) {

    const folder =
        document.getElementById(
            `folder-${id}`
        );

    if (!folder) return;

    if (
        folder.style.display === "none"
    ) {

        folder.style.display = "block";

    } else {

        folder.style.display = "none";
    }
}


async function spostaConsegnaInCartella(id) {

    const consegna = consegne.find(c => c.id === id);
    if (!consegna) return;

    const cartelleClasse = cartelle.filter(
        cartella =>
            normalizzaClasse(cartella.classe) === consegna.classePulita
    );

    if (cartelleClasse.length === 0) {
        alert("Nessuna cartella disponibile.");
        return;
    }

    const contenitore = document.createElement("div");
    contenitore.className = "folder-choice-modal";

    contenitore.innerHTML = `
        <div class="folder-choice-box">
            <h3>Sposta in cartella</h3>

            ${cartelleClasse.map(cartella => `
                <button onclick="confermaSpostaCartella('${id}', '${cartella.id}')">
                    ${getUIIconSVG('folder')} ${cartella.nome}
                </button>
            `).join("")}

            <button class="cancel-folder-btn" onclick="chiudiSceltaCartella()">
                Annulla
            </button>
        </div>
    `;

    document.body.appendChild(contenitore);
}

async function confermaSpostaCartella(id, cartellaId) {

    const cartella = cartelle.find(c => c.id === cartellaId);
    const consegna = consegne.find(c => c.id === id);

    if (!cartella || !consegna) return;

    await updateDoc(
        doc(db, "consegne", id),
        {
            cartellaId: cartella.id,
            cartellaNome: cartella.nome
        }
    );

    chiudiSceltaCartella();
    apriClasse(consegna.classePulita);
}

function chiudiSceltaCartella() {
    const modal = document.querySelector(".folder-choice-modal");

    if (modal) {
        modal.remove();
    }
}

async function creaCartellaClasse(classe) {

    const nome = prompt("Nome nuova cartella:");

    if (!nome || nome.trim() === "") return;

    await addDoc(collection(db, "cartelle"), {
        classe: classe,
        nome: nome.trim(),
        annoScolastico: annoScolasticoSelezionato,
        creataIl: new Date()
    });

    await caricaCartelle();
    apriClasse(classe);
}

function toggleFolderMenu(id) {
    const menu = document.getElementById(`folder-menu-${id}`);
    if (!menu) return;

    const open = menu.style.display === "block";

    document.querySelectorAll(".folder-dropdown").forEach(m => {
        m.style.display = "none";
    });

    menu.style.display = open ? "none" : "block";
}

async function rinominaCartella(id) {
    const cartella = cartelle.find(c => c.id === id);
    if (!cartella) return;

    const nuovoNome = prompt("Nuovo nome cartella:", cartella.nome);

    if (!nuovoNome || nuovoNome.trim() === "") return;

    await updateDoc(doc(db, "cartelle", id), {
        nome: nuovoNome.trim()
    });

    await caricaCartelle();
    apriClasse(normalizzaClasse(cartella.classe));
}

async function eliminaCartella(id) {
    const cartella = cartelle.find(c => c.id === id);
    if (!cartella) return;

    const conferma = confirm(
        `Eliminare la cartella "${cartella.nome}"?\n\nLe consegne NON verranno eliminate, torneranno in Non assegnate.`
    );

    if (!conferma) return;

    const consegneCartella = consegne.filter(c => c.cartellaId === id);

    for (const c of consegneCartella) {
        await updateDoc(doc(db, "consegne", c.id), {
            cartellaId: "",
            cartellaNome: ""
        });
    }

    await deleteDoc(doc(db, "cartelle", id));

    await caricaCartelle();
    apriClasse(normalizzaClasse(cartella.classe));
}

function aggiornaDashboardLive() {

    const ultime = [...consegne].sort((a, b) => b.data - a.data);

    const ultima = ultime[0];

    const nonLette = consegne.filter(
        c => !consegneLette.includes(c.id)
    ).length;

    const boxUltima = document.getElementById("overviewUltimaConsegna");
    const boxUltimaInfo = document.getElementById("overviewUltimaInfo");
    const boxNotifiche = document.getElementById("overviewNotifiche");
    const boxCartelle = document.getElementById("overviewCartelle");
    const boxAttivita = document.getElementById("overviewAttivita");
    const boxAttivitaInfo = document.getElementById("overviewAttivitaInfo");

    if (ultima) {
        boxUltima.textContent = `${ultima.cognome || ""} ${ultima.nome || ""}`.trim();
        boxUltimaInfo.textContent = `${ultima.classePulita || ""} · ${ultima.verifica || "Senza titolo"}`;

        boxAttivita.textContent = "Nuova consegna";
        boxAttivitaInfo.textContent = `${formattaData(ultima.data)} · ${ultima.classePulita}`;
    } else {
        boxUltima.textContent = "--";
        boxUltimaInfo.textContent = "Nessuna consegna recente.";
        boxAttivita.textContent = "--";
        boxAttivitaInfo.textContent = "In attesa di attività.";
    }

    boxNotifiche.textContent = nonLette;
    boxCartelle.textContent = cartelle.length;
}

function apriOverlayNotifiche() {

    const overlay =
        document.getElementById(
            "dashboardOverlay"
        );

    const title =
        document.getElementById(
            "overlayTitle"
        );

    const content =
        document.getElementById(
            "overlayContent"
        );

    const notifiche =
        consegne.filter(
            c =>
                !consegneLette.includes(c.id)
        );

    title.innerHTML =
        `${getUIIconSVG('bell')} Nuove notifiche`;

    if (notifiche.length === 0) {

        content.innerHTML = `
            <p>
                Nessuna nuova notifica.
            </p>
        `;

    } else {

        content.innerHTML =
            notifiche.map(c => `

                <div class="overlay-item">

                    <div>

                        <strong>
                            ${c.cognome}
                            ${c.nome}
                        </strong>

                        <p>
                            ${c.verifica || "Senza titolo"}
                        </p>

                        <small>
                            ${c.classePulita}
                        </small>

                    </div>

                    <button
                        onclick="
                            apriNotificaConsegna(
                                '${c.id}'
                            )
                        "
                    >
                        Apri
                    </button>

                </div>

            `).join("");
    }

    overlay.classList.remove(
        "hidden"
    );
}

function chiudiDashboardOverlay() {

    document
        .getElementById(
            "dashboardOverlay"
        )
        .classList.add("hidden");
}

function apriNotificaConsegna(id) {

    const consegna =
        consegne.find(
            c => c.id === id
        );

    if (!consegna) return;

    chiudiDashboardOverlay();

    mostraSezioneDashboard(
        "classi"
    );

    apriClasse(
        consegna.classePulita
    );
}

function apriOverlayCorrezione(id) {
    const consegna = consegne.find(c => c.id === id);
    if (!consegna) return;

    const title = document.getElementById("overlayTitle");
    const content = document.getElementById("overlayContent");

    title.textContent = "Correzione consegna";

    const codice = consegna.codice || "";
    const codiceCorretto = consegna.codiceCorretto || "";
    const url = consegna.urlConsegna || "";
    const allegati = Array.isArray(consegna.allegati) ? consegna.allegati : [];

    content.innerHTML = `
        <div class="teacher-correction-layout">

            <div class="correction-student-header">
                <div>
                    <span class="chip">${escapeHtml(consegna.classe || "Classe")}</span>
                    ${
                        consegna.statoCorrezione === "corretta"
                        ? `<span class="chip chip-success">Corretta</span>`
                        : `<span class="chip chip-warning">Da correggere</span>`
                    }

                    <h3>${escapeHtml(consegna.cognome)} ${escapeHtml(consegna.nome)}</h3>
                    <p>${escapeHtml(consegna.verifica || "Senza titolo")} · ${formattaData(consegna.data)}</p>
                </div>

                <div class="ai-placeholder">
                    <button type="button" class="ai-btn" onclick="analizzaConsegnaAI('${id}')">
    🤖 Analizza con AI
</button>
<small id="aiStatus-${id}">Assistente correzione codice</small>
                </div>
            </div>

            <div class="correction-two-columns">

                <section class="correction-column">
                    <h4>Materiale consegnato</h4>

                    ${
                        codice
                        ? `
                            <div class="code-box">
                                <strong>Codice inviato</strong>
                                <pre>${escapeHtml(codice)}</pre>
                            </div>
                        `
                        : `<div class="empty-note">Nessun codice inviato.</div>`
                    }

                    ${
                        url
                        ? `
                            <a class="panel-link" href="${escapeHtml(url)}" target="_blank">
                                ${getUIIconSVG('attachment')} Apri link consegna
                            </a>
                        `
                        : ""
                    }

                    ${
                        allegati.length > 0
                        ? `
                            <div class="attachment-list">
                                ${allegati.map(file => `
                                    <a class="panel-link" href="${escapeHtml(file.fileURL)}" target="_blank">
                                        ${getUIIconSVG('attachment')} ${escapeHtml(file.fileName || "Allegato")}
                                    </a>
                                `).join("")}
                            </div>
                        `
                        : ""
                    }
                </section>

                <section class="correction-column correction-form-column">
                    <h4>Correzione docente</h4>

                    <label>Codice corretto / annotazioni</label>
                    <textarea
                        id="codiceCorretto-${id}"
                        class="correction-textarea"
                        placeholder="Scrivi qui eventuali correzioni o annotazioni sul codice..."
                    >${escapeHtml(codiceCorretto || codice)}</textarea>

                    <div class="correction-mini-grid">
                        <div>
                            <label>Voto</label>
                            <input
                                id="voto-${id}"
                                type="text"
                                placeholder="Es. 7"
                                value="${escapeHtml(consegna.voto || "")}"
                            >
                        </div>

                        <div>
                            <label>Commento docente</label>
                            <textarea
                                id="commento-${id}"
                                class="correction-note"
                                placeholder="Commento visibile all'alunno..."
                            >${escapeHtml(consegna.commentoDocente || "")}</textarea>
                        </div>
                    </div>

                    <div class="action-row">
                        <button type="button" onclick="salvaCorrezione('${id}')">
                            Salva correzione
                        </button>

                        <button type="button" class="secondary-btn" onclick="chiudiDashboardOverlay()">
                            Annulla
                        </button>
                    </div>
                </section>

            </div>
        </div>
    `;

    document.getElementById("dashboardOverlay").classList.remove("hidden");
}

function apriOverlayUltimeConsegne() {
    const ultime = [...consegne].sort((a, b) => b.data - a.data).slice(0, 5);
    apriOverlayLista(`${getUIIconSVG('inbox')} Ultime consegne`, ultime);
}

function apriOverlayAttivita() {
    const ultime = [...consegne].sort((a, b) => b.data - a.data).slice(0, 5);
    apriOverlayLista(`${getUIIconSVG('lab')} Attività recenti`, ultime);
}

function apriOverlayLista(titolo, lista) {
    document.getElementById("overlayTitle").innerHTML = titolo;

    document.getElementById("overlayContent").innerHTML = lista.length === 0
        ? "<p>Nessuna attività disponibile.</p>"
        : lista.map(c => `
            <div class="overlay-item">
                <div>
                    <strong>${c.cognome} ${c.nome}</strong>
                    <p>${c.verifica || "Senza titolo"}</p>
                    <small>${c.classePulita}</small>
                </div>

                <button onclick="apriNotificaConsegna('${c.id}')">
                    Apri
                </button>
            </div>
        `).join("");

    document.getElementById("dashboardOverlay").classList.remove("hidden");
}

function apriOverlayCartelle() {
    document.getElementById("overlayTitle").innerHTML = `${getUIIconSVG('folder')} Cartelle attive`;

    document.getElementById("overlayContent").innerHTML = cartelle.length === 0
        ? "<p>Nessuna cartella creata.</p>"
        : cartelle.map(cartella => `
            <div class="overlay-item">
                <div>
                    <strong>${getUIIconSVG('folder')} ${cartella.nome}</strong>
                    <p>${cartella.classe}</p>
                </div>

                <button onclick="apriCartellaDaOverlay('${cartella.id}')">
                    Apri
                </button>
            </div>
        `).join("");

    document.getElementById("dashboardOverlay").classList.remove("hidden");
}

function apriCartellaDaOverlay(id) {
    const cartella = cartelle.find(c => c.id === id);
    if (!cartella) return;

    chiudiDashboardOverlay();
    mostraSezioneDashboard("classi");
    apriClasse(normalizzaClasse(cartella.classe));

    setTimeout(() => {
        const folder = document.getElementById(`folder-${id}`);
        if (folder) {
            folder.style.display = "block";
            folder.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, 300);
}

async function salvaCorrezione(id) {

    const voto =
        document.getElementById(`voto-${id}`).value.trim();

    const commento =
        document.getElementById(`commento-${id}`).value.trim();

    try {
        const codiceCorretto =
            document.getElementById(`codiceCorretto-${id}`).value.trim();

        await updateDoc(
            doc(db, "consegne", id),
            {
                voto: voto,
                commentoDocente: commento,
                codiceCorretto: codiceCorretto,
                statoCorrezione: "corretta",
                correttoIl: new Date()
            }
        );

        alert("✅ Correzione salvata! L'alunno vedrà l'aggiornamento tra pochi secondi.");

        chiudiDashboardOverlay();
        caricaConsegne();
    } catch (error) {
        alert("❌ Errore nel salvataggio: " + error.message);
        console.error(error);
    }
}
async function analizzaConsegnaAI(id) {
    const consegna = consegne.find(c => c.id === id);
    if (!consegna) return;

    const aiStatus = document.getElementById(`aiStatus-${id}`);
    const aiBtn = document.querySelector(".ai-btn");

    try {
        if (aiStatus) aiStatus.textContent = "Analisi in corso...";

        if (aiBtn) {
            aiBtn.disabled = true;
            aiBtn.textContent = "⏳ Analisi...";
        }

       const response = await fetch("https://capassowork.netlify.app/.netlify/functions/correggi-ai", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome: consegna.nome || "",
                cognome: consegna.cognome || "",
                classe: consegna.classe || "",
                verifica: consegna.verifica || "",
                codice: consegna.codice || ""
            })
        });

        const text = await response.text();
        console.log("RISPOSTA AI RAW:", text);

        if (!text) {
            throw new Error("Risposta vuota dalla funzione AI");
        }

        const risultato = JSON.parse(text);

        if (!response.ok) {
            throw new Error(risultato.error || "Errore analisi AI");
        }

        document.getElementById(`voto-${id}`).value = risultato.suggerimentoVoto || "";
        document.getElementById(`commento-${id}`).value = risultato.commentoDocente || "";
        document.getElementById(`codiceCorretto-${id}`).value = risultato.codiceCorretto || "";

        if (aiStatus) {
            aiStatus.textContent = "Analisi completata. Controlla e salva.";
        }

    } catch (error) {
        console.error("ERRORE AI:", error);
        if (aiStatus) aiStatus.textContent = "Errore: " + error.message;
        alert("Errore AI: " + error.message);
    } finally {
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.textContent = "🤖 Analizza con AI";
        }
    }
}
/* =========================
   WINDOW
   ========================= */

window.apriClasse =
    apriClasse;

window.mostraClassi =
    mostraClassi;

window.nascondiClasse =
    nascondiClasse;

window.eliminaAlunno =
    eliminaAlunno;

window.mostraSezioneDashboard =
    mostraSezioneDashboard;

window.mostraCodiceConsegna =
    mostraCodiceConsegna;

window.logoutDocente =
    () => signOut(auth);
	window.toggleMenuClasse =
    toggleMenuClasse;

window.eliminaClasse =
    eliminaClasse;
	
	window.toggleCompitoMenu = toggleCompitoMenu;
window.eliminaConsegna = eliminaConsegna;

window.toggleFolder =
    toggleFolder;
	
	window.creaCartellaClasse = creaCartellaClasse;
	
	window.spostaConsegnaInCartella =
    spostaConsegnaInCartella;
	
	window.confermaSpostaCartella = confermaSpostaCartella;
window.chiudiSceltaCartella = chiudiSceltaCartella;

window.creaCartellaClasse =
    creaCartellaClasse;

window.spostaConsegnaInCartella =
    spostaConsegnaInCartella;

window.confermaSpostaCartella =
    confermaSpostaCartella;

window.chiudiSceltaCartella =
    chiudiSceltaCartella
	
	window.toggleFolderMenu = toggleFolderMenu;
window.rinominaCartella = rinominaCartella;
window.eliminaCartella = eliminaCartella;

window.apriOverlayNotifiche =
    apriOverlayNotifiche;

window.chiudiDashboardOverlay =
    chiudiDashboardOverlay;

window.apriNotificaConsegna =
    apriNotificaConsegna;

window.apriOverlayCorrezione =
    apriOverlayCorrezione;

window.apriOverlayUltimeConsegne = apriOverlayUltimeConsegne;
window.apriOverlayCartelle = apriOverlayCartelle;
window.apriOverlayAttivita = apriOverlayAttivita;
window.apriCartellaDaOverlay = apriCartellaDaOverlay;

window.salvaCorrezione =
    salvaCorrezione;
	window.analizzaConsegnaAI = analizzaConsegnaAI;

function getCurrentSchoolYear() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (month >= 8) {
        return `${year}-${String(year + 1).slice(-2)}`;
    }

    return `${year - 1}-${String(year).slice(-2)}`;
}

function ensureSchoolYearOption(select, year) {
    if (!Array.from(select.options).some(option => option.value === year)) {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

function updateYearModeText() {
    const yearModeText = document.getElementById("yearModeText");
    if (!yearModeText) return;

    if (annoScolasticoSelezionato === "2025-26") {
        yearModeText.textContent = "Modalità TEST: usi l'anno 2025-26";
    } else {
        yearModeText.textContent = "Anno BUONO: usi l'anno " + annoScolasticoSelezionato;
    }
}

const schoolYearSelect = document.getElementById("schoolYearSelect");
let annoScolasticoSelezionato =
    localStorage.getItem("annoScolastico") || getCurrentSchoolYear();

if (schoolYearSelect) {
    ensureSchoolYearOption(schoolYearSelect, annoScolasticoSelezionato);
    schoolYearSelect.value = annoScolasticoSelezionato;
    updateYearModeText();

    schoolYearSelect.addEventListener("change", () => {
        annoScolasticoSelezionato = schoolYearSelect.value;
        localStorage.setItem("annoScolastico", annoScolasticoSelezionato);
        updateYearModeText();
        
        // Effetto visuale di cambio
        schoolYearSelect.parentElement.style.opacity = "0.5";
        schoolYearSelect.disabled = true;
        
        // Ricarica i dati
        Promise.all([
            caricaConsegne(),
            caricaAlunni(),
            caricaCartelle(),
            mostraClassi(),
            aggiornaStatistiche()
        ]).then(() => {
            // Ripristina lo stile
            schoolYearSelect.parentElement.style.opacity = "1";
            schoolYearSelect.disabled = false;
        });
    });
}
function inizializzaTemaDashboard() {
    const teacherThemeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("capassoTeacherTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
    }

    if (teacherThemeToggle) {
        teacherThemeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark-theme");

            if (document.body.classList.contains("dark-theme")) {
                localStorage.setItem("capassoTeacherTheme", "dark");
            } else {
                localStorage.setItem("capassoTeacherTheme", "light");
            }
        });
    }
}

inizializzaTemaDashboard();
