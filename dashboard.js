const PASSWORD_DOCENTE = "Capasso2026";

const loginBox = document.getElementById("loginBox");
const dashboardBox = document.getElementById("dashboardBox");
const loginBtn = document.getElementById("loginBtn");
const passwordDocente = document.getElementById("passwordDocente");
const loginError = document.getElementById("loginError");

loginBtn.addEventListener("click", () => {

    if(passwordDocente.value === PASSWORD_DOCENTE) {

        loginBox.classList.add("hidden");
        dashboardBox.classList.remove("hidden");

        caricaConsegne();

    } else {

        loginError.textContent = "Password non corretta";
        loginError.style.display = "block";

    }

});

function caricaConsegne() {

    const table = document.getElementById("submissionsTable");

    table.innerHTML = `

        <tr>
            <td>13/05/2026</td>
            <td>Mario Rossi</td>
            <td>2A INF</td>
            <td>Vettori e Cicli</td>
            <td>
                <span class="status-pill status-wait">
                    Da correggere
                </span>
            </td>
            <td>-</td>
            <td>
                <button onclick="apriCompito()">
                    Apri
                </button>
            </td>
        </tr>

    `;

}

function apriCompito() {

    alert("Qui apriremo il dettaglio della consegna.");

}