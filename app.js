const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxP6IKlC8uh2M5Lp1X1eSbYOp26mstlzJFl9I01Ie6-ob_jaaSPW2gaMh9fYm7Wr3Ro/exec";

const form = document.getElementById("taskForm");

const successMessage =
    document.getElementById("successMessage");

const errorMessage =
    document.getElementById("errorMessage");

form.addEventListener(
    "submit",
    async function(event) {

    event.preventDefault();

    hideMessages();

    const nome =
        document.getElementById("nome").value.trim();

    const cognome =
        document.getElementById("cognome").value.trim();

    const classe =
        document.getElementById("classe").value.trim();

    const verifica =
        document.getElementById("verifica").value.trim();

    const codice =
        document.getElementById("codice").value.trim();

    const allegato =
        document.getElementById("allegato").files[0];

    if(codice === "" && !allegato) {

        showError(
            "Inserisci il codice oppure allega un file."
        );

        return;
    }

    try {

        let fileData = null;

        if(allegato) {

            fileData =
                await fileToBase64(allegato);

        }

        const payload = {

            nome,
            cognome,
            classe,
            verifica,
            codice,

            fileName:
                allegato ? allegato.name : "",

            fileType:
                allegato ? allegato.type : "",

            fileData

        };

        const response = await fetch(
            SCRIPT_URL,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        const result =
            await response.json();

        if(result.success) {

            successMessage.style.display =
                "block";

            form.reset();

        } else {

            showError(
                result.message ||
                "Errore durante la consegna."
            );

        }

    } catch(error) {

        showError(
            "Errore di collegamento con Google Apps Script."
        );

        console.error(error);

    }

});

function fileToBase64(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => {

            const base64 =
                reader.result.split(",")[1];

            resolve(base64);

        };

        reader.onerror = reject;

        reader.readAsDataURL(file);

    });

}

function showError(text) {

    errorMessage.textContent = text;

    errorMessage.style.display = "block";

}

function hideMessages() {

    successMessage.style.display = "none";

    errorMessage.style.display = "none";

}