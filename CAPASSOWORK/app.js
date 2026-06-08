import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-storage.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const storage = getStorage();
const auth = getAuth();

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxP6IKlC8uh2M5Lp1X1eSbYOp26mstlzJFl9I01Ie6-ob_jaaSPW2gaMh9fYm7Wr3Ro/exec";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;

function getCurrentSchoolYear() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (month >= 8) {
        return `${year}-${String(year + 1).slice(-2)}`;
    }

    return `${year - 1}-${String(year).slice(-2)}`;
}

const form = document.getElementById("taskForm");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const studentFormCard = document.getElementById("studentFormCard");
const closedMessageCard = document.getElementById("closedMessageCard");

const fileInput = document.getElementById("allegato");
const fileList = document.getElementById("fileList");
const dropZone = document.getElementById("dropZone");

let selectedFiles = [];

["dragover", "drop"].forEach(eventName => {
    window.addEventListener(eventName, e => {
        e.preventDefault();
    });
});

if (dropZone) {
    dropZone.addEventListener("click", () => {
        fileInput.click();
    });

    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");

        const droppedFiles = Array.from(e.dataTransfer.files);
        aggiungiFile(droppedFiles);
    });
}

fileInput.addEventListener("change", function () {
    const nuoviFile = Array.from(fileInput.files);
    aggiungiFile(nuoviFile);
    fileInput.value = "";
});

function aggiungiFile(nuoviFile) {
    hideMessages();

    if (selectedFiles.length + nuoviFile.length > MAX_FILES) {
        showError("Puoi allegare massimo " + MAX_FILES + " file per consegna.");
        return;
    }

    nuoviFile.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
            showError("Il file " + file.name + " supera il limite massimo di 20 MB.");
            return;
        }

        const giaPresente = selectedFiles.some(f =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
        );

        if (!giaPresente) {
            selectedFiles.push(file);
        }
    });

    mostraFileSelezionati();
}

function mostraFileSelezionati() {
    if (selectedFiles.length === 0) {
        fileList.innerHTML = "";
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span><svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l8.48-8.48a3.5 3.5 0 0 1 4.95 4.95l-7.78 7.78"/></svg> ${file.name}</span>
            <button type="button" class="remove-file" onclick="rimuoviFile(${index})">
                Rimuovi
            </button>
        </div>
    `).join("");
}

window.rimuoviFile = function(index) {
    selectedFiles.splice(index, 1);
    mostraFileSelezionati();
};

form.addEventListener("submit", async function(event) {
    event.preventDefault();

    hideMessages();

    if (!currentUser) {
        showError("Devi effettuare il login come alunno prima di consegnare.");
        return;
    }

    const statoRef = doc(db, "settings", "consegne");
    const statoSnap = await getDoc(statoRef);

    const consegneAttive = statoSnap.exists()
        ? statoSnap.data().attive === true
        : true;

    if (!consegneAttive) {
        showError("Le consegne sono momentaneamente chiuse dal docente.");
        return;
    }

    const nome = document.getElementById("nome").value.trim();
    const cognome = document.getElementById("cognome").value.trim();
    const classe = document.getElementById("classe").value.trim();
    const verifica = document.getElementById("verifica").value.trim();
    const urlConsegna = document.getElementById("urlConsegna").value.trim();
    const codice = document.getElementById("codice").value.trim();

    const files = selectedFiles;

    if (urlConsegna !== "" && !isValidUrl(urlConsegna)) {
        showError("Inserisci un URL valido, ad esempio https://github.com/...");
        return;
    }

    if (codice === "" && files.length === 0 && urlConsegna === "") {
        showError("Inserisci il codice, un link oppure allega almeno un file.");
        return;
    }

    if (files.length > MAX_FILES) {
        showError("Puoi allegare massimo " + MAX_FILES + " file per consegna.");
        return;
    }

    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            showError("Il file " + file.name + " supera il limite massimo di 20 MB.");
            return;
        }
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    btnText.textContent = "INVIO IN CORSO...";

    try {
        let allegati = [];

        if (files.length > 0) {
            btnText.textContent = "UPLOAD FILE CLOUD...";

            for (const file of files) {
                const safeFileName = file.name.replaceAll(" ", "_");
                const uniqueFileName = Date.now() + "_" + safeFileName;

                const storageRef = ref(
                    storage,
                    "consegne/" + currentUser.uid + "/" + uniqueFileName
                );

                await uploadBytes(storageRef, file);

                const downloadURL = await getDownloadURL(storageRef);

                allegati.push({
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    fileURL: downloadURL,
                    storagePath: storageRef.fullPath
                });
            }
        }

        btnText.textContent = "SALVATAGGIO CONSEGNA...";

        const studentSaved = localStorage.getItem("capassoStudent");
        const studentData = studentSaved ? JSON.parse(studentSaved) : null;

        const payload = {
            nome,
            cognome,
            classe,
            verifica,
            codice,
            urlConsegna,
            allegati,
            uidAlunno: currentUser.uid,
            usernameAlunno: studentData && studentData.username ? studentData.username : "",
            emailAlunno: currentUser.email || "",
            annoScolastico: getCurrentSchoolYear(),
            stato: "consegnato",
            creatoIl: serverTimestamp()
        };

        await addDoc(collection(db, "consegne"), payload);

        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                ...payload,
                creatoIl: new Date().toLocaleString("it-IT"),
                origine: "firebase-storage"
            })
        });

        submitBtn.classList.remove("loading");
        btnText.textContent = "CONSEGNA COMPLETATA";

        successMessage.innerHTML = "✅ Compito consegnato correttamente!";
        successMessage.style.display = "block";

        setTimeout(() => {
            form.reset();
            selectedFiles = [];
            mostraFileSelezionati();

            submitBtn.disabled = false;
            btnText.textContent = "CONSEGNA COMPITO";
        }, 2000);

    } catch(error) {
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        btnText.textContent = "CONSEGNA COMPITO";

        showError("Errore: " + error.message);
        console.error(error);
    }
});

function isValidUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function showError(text) {
    errorMessage.textContent = text;
    errorMessage.style.display = "block";
}

function hideMessages() {
    successMessage.style.display = "none";
    errorMessage.style.display = "none";
}

const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("capassoHomeTheme");

if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");

    if (document.body.classList.contains("dark-theme")) {
        localStorage.setItem("capassoHomeTheme", "dark");
    } else {
        localStorage.setItem("capassoHomeTheme", "light");
    }
});

controllaStatoPagina();

async function controllaStatoPagina() {
    try {
        const ref = doc(db, "settings", "consegne");
        const snap = await getDoc(ref);

        const attive = snap.exists() ? snap.data().attive === true : true;

        if (!attive) {
            studentFormCard.classList.add("hidden");
            closedMessageCard.classList.remove("hidden");
        } else {
            studentFormCard.classList.remove("hidden");
            closedMessageCard.classList.add("hidden");
        }

    } catch (error) {
        console.error("Errore controllo stato consegne", error);
    }
}