const SCRIPT_URL = "IL_TUO_LINK_GOOGLE_APPS_SCRIPT";

const form = document.getElementById("taskForm");

const successMessage =
    document.getElementById("successMessage");

const errorMessage =
    document.getElementById("errorMessage");

const submitBtn =
    document.getElementById("submitBtn");

const btnText =
    document.getElementById("btnText");

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

    submitBtn.disabled = true;

    submitBtn.classList.add("loading");

    btnText.textContent =
        "INVIO IN CORSO...";

    try {

        let fileData = null;

        if(allegato) {

            btnText.textContent =
                "CARICAMENTO FILE...";

            fileData =
                await fileToBase64(allegato);

        }

        btnText.textContent =
            "GENERAZIONE DOCUMENTO...";

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

        btnText.textContent =
            "INVIO AL DOCENTE...";

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

            successMessage.innerHTML =
                "✅ Compito consegnato correttamente!";

            successMessage.style.display =
                "block";

            btnText.textContent =
                "CONSEGNA COMPLETATA";

            form.reset();

        } else {

            showError(
                result.message ||
                "Errore durante la consegna."
            );

        }

    } catch(error) {

        showError(
            "Errore di collegamento."
        );

        console.error(error);

    } finally {

        setTimeout(() => {

            submitBtn.disabled = false;

            submitBtn.classList.remove(
                "loading"
            );

            btnText.textContent =
                "CONSEGNA COMPITO";

        }, 1500);

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