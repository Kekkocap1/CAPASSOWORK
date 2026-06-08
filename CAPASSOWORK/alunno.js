import { db, studentAuth } from "./firebase.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

import { getUIIconSVG, getFileIconSVG } from './icons.js';

const loginBox = document.getElementById("studentLoginBox");
const homeBox = document.getElementById("studentHomeBox");

const usernameInput = document.getElementById("studentLoginUsername");
const passwordInput = document.getElementById("studentLoginPassword");

const loginBtn = document.getElementById("studentLoginBtn");
const loginError = document.getElementById("studentLoginError");

const studentWelcome = document.getElementById("studentWelcome");
const studentInfo = document.getElementById("studentInfo");
const studentSummary = document.getElementById("studentSummary");
const studentArchive = document.getElementById("studentArchive");

let unsubscribeArchivio = null;
let consegneAlunno = [];
let graficoVoti = null;

loginBtn.addEventListener("click", async () => {
    loginError.style.display = "none";

    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    

    try {
        const emailTecnica = usernameToEmail(username);

        await signInWithEmailAndPassword(
            studentAuth,
            emailTecnica,
            password
        );

    } catch (error) {
        loginError.textContent =
            "Errore login: credenziali non corrette.";

        loginError.style.display = "block";
    }
});

onAuthStateChanged(studentAuth, async user => {
    if (!user) {
        loginBox.classList.remove("hidden");
        homeBox.classList.add("hidden");
        return;
    }

    try {
        const profiloRef = doc(db, "alunni", user.uid);
        const profiloSnap = await getDoc(profiloRef);

        if (!profiloSnap.exists()) {
            await signOut(studentAuth);
            throw new Error("Profilo alunno non trovato.");
        }

        const alunno = profiloSnap.data();

        const profiloCorrente = {
    uid: user.uid,
    nome: alunno.nome || "",
    cognome: alunno.cognome || "",
    classe: alunno.classe || "",
    username: alunno.username || "",
    email: alunno.email || ""
};
        localStorage.setItem(
            "capassoStudent",
            JSON.stringify(profiloCorrente)
        );

        mostraAreaAlunno(profiloCorrente);
        caricaConsegneAlunnoRealtime(profiloCorrente);

    } catch (error) {
        console.error(error);

        loginError.textContent =
            "Errore: " + error.message;

        loginError.style.display = "block";
    }
});

function mostraAreaAlunno(alunno) {
    loginBox.classList.add("hidden");
    homeBox.classList.remove("hidden");

    studentWelcome.innerHTML =
        `Ciao ${alunno.nome} ${getUIIconSVG('users')}`;

    studentInfo.textContent =
        "Classe: " + alunno.classe + " | Username: " + alunno.username;

    if (studentSummary) {
        studentSummary.textContent =
            "Calcolo media voti...";
    }
}

function caricaConsegneAlunnoRealtime(alunno) {
    studentArchive.innerHTML = "Caricamento consegne...";

    if (unsubscribeArchivio) {
        unsubscribeArchivio();
    }

    const q = query(
        collection(db, "consegne"),
        where("classe", "==", alunno.classe),
        where("nome", "==", alunno.nome),
        where("cognome", "==", alunno.cognome)
    );

    unsubscribeArchivio = onSnapshot(
        q,
        snapshot => {
            consegneAlunno = snapshot.docs.map(docSnap => {
                const data = docSnap.data();

                return {
                    id: docSnap.id,
                    ...data,
                    allegati: Array.isArray(data.allegati)
                        ? data.allegati
                        : [],
                    data: data.creatoIl && data.creatoIl.toDate
                        ? data.creatoIl.toDate()
                        : new Date()
                };
            });

            mostraConsegneAlunno();
            
            // Aggiorna il grafico con un piccolo delay per assicurare il rendering
            setTimeout(() => {
                mostraGraficoVoti();
            }, 100);
        },
        error => {
            console.error(error);

            studentArchive.innerHTML = `
                <div class="empty-box">
                    Errore caricamento consegne.
                </div>
            `;
        }
    );
}

function mostraConsegneAlunno() {
    if (consegneAlunno.length === 0) {
        studentArchive.innerHTML = `
            <div class="empty-box">
                Nessuna consegna trovata.
            </div>
        `;
        return;
    }

    consegneAlunno.sort((a, b) => {
        return new Date(b.data).getTime() - new Date(a.data).getTime();
    });

    studentArchive.innerHTML = `
        <div class="student-archive-header">
            <h3>Le mie consegne</h3>
        </div>

        <div class="student-table">
            <div class="student-table-row student-table-head">
                <div>Verifica</div>
                <div>Data</div>
                <div>Stato</div>
                <div>Voto</div>
                <div>Azioni</div>
            </div>

            ${consegneAlunno.map(c => `
                <div class="student-table-row">
                    <div>
                        <strong>${escapeHtml(c.verifica || "Verifica")}</strong>
                        <small>${escapeHtml(c.classe || "")}</small>
                    </div>

                    <div>${formattaData(c.data)}</div>

                    <div>
                        ${
                            c.statoCorrezione === "corretta"
                            ? `<span class="status-ok-mini">Corretta</span>`
                            : `<span class="status-wait-mini">In attesa</span>`
                        }
                    </div>

                    <div>
                        ${
                            c.voto
                            ? `<span class="${getClasseVoto(c.voto)}">${escapeHtml(c.voto)}</span>`
                            : `<span class="voto-empty">--</span>`
                        }
                    </div>

                    <div class="student-actions-table">
                        ${creaLinkDocumenti(c)}

                        ${
                            c.statoCorrezione === "corretta"
                            ? `
                                <button
                                    class="student-action-btn"
                                    type="button"
                                    onclick="apriCorrezione('${c.id}')"
                                >
                                    Correzione
                                </button>
                            `
                            : ""
                        }
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function creaLinkDocumenti(c) {
    let html = "";

    const haFile =
        c.allegati &&
        c.allegati.length > 0;

    const haCodice =
        c.codice &&
        c.codice.trim() !== "";

    const haUrl =
        c.urlConsegna &&
        c.urlConsegna.trim() !== "";

    let badge = "";

    if (haFile && haCodice && haUrl) {
        badge = `<span class="mini-badge">MISTA</span>`;
    } else if (haFile && haCodice) {
        badge = `<span class="mini-badge">FILE + CODICE</span>`;
    } else if (haFile && haUrl) {
        badge = `<span class="mini-badge">FILE + URL</span>`;
    } else if (haCodice && haUrl) {
        badge = `<span class="mini-badge">CODICE + URL</span>`;
    } else if (haFile) {
        badge = `<span class="mini-badge">FILE</span>`;
    } else if (haCodice) {
        badge = `<span class="mini-badge">CODICE</span>`;
    } else if (haUrl) {
        badge = `<span class="mini-badge">URL</span>`;
    }

    html += badge;

    if (haFile) {
        html += c.allegati.map((file, index) => `
            <a
                href="${file.fileURL}"
                target="_blank"
                class="open-link"
            >
                ${getUIIconSVG('attachment')} ${escapeHtml(file.fileName || "file " + (index + 1))}
            </a>
        `).join("");
    }

    if (haCodice) {
        html += `
            <button
                class="open-link"
                onclick="apriCodiceAlunno('${c.id}')"
            >
                ${getFileIconSVG('code')} Apri codice
            </button>
        `;
    }

    if (haUrl) {
        html += `
            <a
                href="${c.urlConsegna}"
                target="_blank"
                class="open-link"
            >
                ${getFileIconSVG('link')} Apri link
            </a>
        `;
    }

    if (!haFile && !haCodice && !haUrl) {
        return `<span>Nessun contenuto</span>`;
    }

    return html;
}

function apriCodiceAlunno(id) {
    const consegna = consegneAlunno.find(c => c.id === id);

    if (!consegna || !consegna.codice) {
        alert("Nessun codice trovato.");
        return;
    }

    const win = window.open("", "_blank");

    win.document.write(`
        <html>
        <head>
            <title>Codice consegnato</title>

            <style>
                body {
                    font-family: Arial;
                    padding: 30px;
                    background: #f4f6f8;
                }

                pre {
                    background: white;
                    padding: 20px;
                    border-radius: 12px;
                    white-space: pre-wrap;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
                }
            </style>
        </head>

        <body>
            <h2>Codice consegnato</h2>

            <pre>${escapeHtml(consegna.codice)}</pre>
        </body>
        </html>
    `);

    win.document.close();
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

function parseVoto(voto) {

    if (!voto) return NaN;

    const testo =
        String(voto)
            .trim()
            .replace(",", ".");

    const numero =
        parseFloat(testo);

    return numero;
}

function mostraGraficoVoti() {

    const canvas =
        document.getElementById("graficoVoti");

    if (!canvas) return;

    const verificheCorrette =
        consegneAlunno
            .filter(c =>
                c.statoCorrezione === "corretta" &&
                c.voto &&
                !isNaN(parseVoto(c.voto))
            )
            .sort(
                (a, b) =>
                    new Date(a.data) -
                    new Date(b.data)
            );

    aggiornaRiepilogoStudente();

    if (verificheCorrette.length === 0) {

        if (graficoVoti) {
            graficoVoti.destroy();
            graficoVoti = null;
        }

        const studentChartCard = document.getElementById("studentChartCard");
        if (studentChartCard) {
            studentChartCard.style.display = "none";
        }
        return;
    }

    const labels =
        verificheCorrette.map(
            c => c.verifica || "Verifica"
        );

    const dati =
        verificheCorrette.map(
            c => parseVoto(c.voto)
        );

    // Mostra la card del grafico
    const studentChartCard = document.getElementById("studentChartCard");
    if (studentChartCard) {
        studentChartCard.style.display = "block";
    }

    // Destroy il vecchio grafico
    if (graficoVoti) {
        graficoVoti.destroy();
    }

    // Crea il nuovo grafico con animazione
    graficoVoti =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels: labels,

                    datasets: [
                        {
                            label: "Voti",

                            data: dati,

                            borderColor: "#2563eb",

                            backgroundColor: "rgba(37, 99, 235, 0.1)",

                            borderWidth: 3,

                            pointRadius: 6,

                            pointBackgroundColor: "#2563eb",

                            pointBorderColor: "white",

                            pointBorderWidth: 2,

                            tension: 0.4,

                            fill: true,

                            pointHoverRadius: 8
                        }
                    ]
                },

                options: {

                    responsive: true,
                    
                    animation: {
                        duration: 500,
                        easing: "easeInOutQuart"
                    },

                    scales: {

                        y: {

                            min: 0,

                            max: 10,

                            ticks: {
                                stepSize: 1,
                                color: "#64748b",
                                font: {
                                    weight: "bold"
                                }
                            },

                            grid: {
                                color: "rgba(37, 99, 235, 0.08)"
                            }
                        },

                        x: {
                            ticks: {
                                color: "#64748b",
                                font: {
                                    weight: "bold"
                                }
                            },

                            grid: {
                                color: "rgba(37, 99, 235, 0.08)"
                            }
                        }
                    },

                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: "#0f172a",
                                font: {
                                    weight: "bold",
                                    size: 14
                                }
                            }
                        }
                    }
                }
            }
        );
}

function aggiornaRiepilogoStudente() {
    if (!studentSummary) return;

    const votiCorrette = consegneAlunno.filter(c =>
        c.statoCorrezione === "corretta" &&
        c.voto &&
        !isNaN(parseVoto(c.voto))
    );

    if (votiCorrette.length === 0) {
        studentSummary.innerHTML = `
            <div class="summary-title">Media voti</div>
            <div class="summary-value">N/D</div>
            <div class="summary-subtitle">Nessuna correzione disponibile</div>
        `;
        return;
    }

    const sum = votiCorrette.reduce(
        (total, c) => total + parseVoto(c.voto),
        0
    );

    const average = sum / votiCorrette.length;

    studentSummary.innerHTML = `
        <div class="summary-title">Media voti</div>
        <div class="summary-value">${average.toFixed(2)}</div>
        <div class="summary-subtitle">Verifiche corrette: ${votiCorrette.length}</div>
    `;
}

function apriCorrezione(id) {
    const consegna = consegneAlunno.find(c => c.id === id);

    if (!consegna) {
        alert("Correzione non trovata.");
        return;
    }

    const voto = consegna.voto || "N/D";
    const commento = consegna.commentoDocente || "Nessun commento dal docente.";
    const codiceInviato = consegna.codice || "";
    const codiceCorretto = consegna.codiceCorretto || "";
    const url = consegna.urlConsegna || "";
    const allegati = Array.isArray(consegna.allegati) ? consegna.allegati : [];
    const data = formattaData(consegna.data);
    const titolo = escapeHtml(consegna.verifica || "Verifica");

    const win = window.open("", "_blank");

    win.document.write(`
        <html>
        <head>
            <title>Compito corretto - ${titolo}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 24px; background: #f8fafc; color: #0f172a; margin: 0; }
                h1 { margin-bottom: 16px; }
                .page { max-width: 1100px; margin: 0 auto; }
                .grid { display: grid; gap: 20px; grid-template-columns: 1.4fr 1fr; }
                .panel { background: white; border-radius: 18px; padding: 20px; box-shadow: 0 14px 40px rgba(15,23,42,0.08); }
                .panel.full { grid-column: 1 / -1; }
                .panel h2 { margin-top: 0; }
                .code-block { width: 100%; font-family: Consolas, Monaco, monospace; font-size: 14px; line-height: 1.55; padding: 18px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; border-radius: 14px; }
                .code-original { background: #eef2ff; border: 1px solid #c7d2fe; }
                .code-corrected { background: #fff1f2; border: 1px solid #fecaca; }
                .code-comment { color: #b91c1c; font-weight: 700; }
                .comment-box { width: 100%; min-height: 260px; border-radius: 18px; padding: 18px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; white-space: pre-wrap; word-wrap: break-word; }
                .info-box { margin-bottom: 12px; padding: 16px; border-radius: 14px; background: #eef2ff; }
                .info-box strong { display: block; margin-bottom: 6px; }
                .attachments { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
                .attachment-link { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 12px 14px; border-radius: 14px; background: #eff6ff; }
                .note { color: #475569; font-size: 14px; margin-top: 8px; }
                .buttons { display: flex; gap: 12px; margin-top: 20px; }
                .button { padding: 12px 18px; border: none; border-radius: 14px; cursor: pointer; font-weight: 700; }
                .button.secondary { background: #e2e8f0; color: #0f172a; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="panel full">
                    <h1>Compito corretto: ${titolo}</h1>
                    <div class="info-box"><strong>Data consegna:</strong> ${data}</div>
                    <div class="info-box"><strong>Voto:</strong> ${escapeHtml(voto)}</div>
                    <div class="info-box"><strong>Stato:</strong> ${escapeHtml(consegna.statoCorrezione || "N/D")}</div>
                </div>

                <div class="grid">
                    <div class="panel">
                        <h2>Codice inviato</h2>
                        ${codiceInviato ? `<pre class="code-block code-original">${escapeHtml(codiceInviato)}</pre>` : `<div class="note">Nessun codice inviato</div>`}
                        ${url ? `<a class="attachment-link" href="${escapeHtml(url)}" target="_blank">${getUIIconSVG('link')} Apri link di consegna</a>` : ""}
                        ${allegati.length > 0 ? `<div class="attachments"><strong>Allegati:</strong>${allegati.map(file => `<a class="attachment-link" href="${escapeHtml(file.fileURL)}" target="_blank">${getUIIconSVG('attachment')} ${escapeHtml(file.fileName || "File")}</a>`).join("")}</div>` : ""}
                    </div>

                    <div class="panel">
                        <h2>Codice corretto</h2>
                        ${codiceCorretto ? `<pre class="code-block code-corrected">${formatCodeWithComments(codiceCorretto)}</pre>` : `<div class="note">Nessuna correzione del codice disponibile.</div>`}
                    </div>
                </div>

                <div class="panel full">
                    <h2>Commento del docente</h2>
                    <div class="comment-box">${escapeHtml(commento)}</div>
                </div>

                <div class="buttons">
                    <button class="button secondary" onclick="window.close()">Chiudi finestra</button>
                </div>
            </div>
        </body>
        </html>
    `);

    win.document.close();
}

function usernameToEmail(username) {
    return username
        .toLowerCase()
        .replace(/\s+/g, "")
        + "@capassowork.local";
}

function formattaData(value) {
    const data = new Date(value);

    if (isNaN(data)) {
        return value || "";
    }

    return data.toLocaleDateString("it-IT");
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCodeWithComments(code) {
    return escapeHtml(code)
        .split('\n')
        .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
                return `<span class="code-comment">${line}</span>`;
            }
            return line;
        })
        .join('\n');
}
function inizializzaTemaAlunno() {
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("capassoStudentTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark-theme");

            if (document.body.classList.contains("dark-theme")) {
                localStorage.setItem("capassoStudentTheme", "dark");
            } else {
                localStorage.setItem("capassoStudentTheme", "light");
            }

            setTimeout(() => {
                mostraGraficoVoti();
            }, 100);
        });
    }
}

inizializzaTemaAlunno();

window.apriCodiceAlunno = apriCodiceAlunno;
window.apriCorrezione = apriCorrezione;

window.logoutAlunno = async function () {
    try {
        localStorage.removeItem("capassoStudent");

        if (unsubscribeArchivio) {
            unsubscribeArchivio();
            unsubscribeArchivio = null;
        }

        if (graficoVoti) {
            graficoVoti.destroy();
            graficoVoti = null;
        }

        consegneAlunno = [];

        usernameInput.value = "";
        passwordInput.value = "";

        studentArchive.innerHTML = "";
        studentSummary.innerHTML = "";

        homeBox.classList.add("hidden");
        loginBox.classList.remove("hidden");

        await signOut(studentAuth);

    } catch (error) {
        console.error("Errore logout alunno:", error);
    }
};
