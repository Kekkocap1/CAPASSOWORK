exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Metodo non consentito" })
        };
    }

    try {
        const body = JSON.parse(event.body || "{}");

        const codice = body.codice || "";

        if (!codice.trim()) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Nessun codice da analizzare." })
            };
        }

        const prompt = `
Sei un assistente per un docente di informatica.

Analizza il codice consegnato da uno studente e aiuta il docente nella correzione.

DATI CONSEGNA:
Studente: ${body.cognome || ""} ${body.nome || ""}
Classe: ${body.classe || ""}
Verifica: ${body.verifica || ""}

CODICE STUDENTE:
${codice}

Rispondi SOLO con JSON valido, senza markdown, con questa struttura:

{
  "puntiPositivi": ["..."],
  "errori": ["..."],
  "suggerimentoVoto": "7",
  "commentoDocente": "...",
  "codiceCorretto": "..."
}

Regole:
- Il voto è solo un suggerimento.
- Non essere troppo severo.
- Il commento deve essere breve, chiaro e adatto a uno studente.
- Se il codice è molto incompleto, suggerisci un voto basso ma motivato.
- Nel codiceCorretto inserisci una versione corretta o migliorata del codice.
`;

        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-5.5-mini",
                input: prompt
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: data.error?.message || "Errore OpenAI"
                })
            };
        }

        const testo =
            data.output_text ||
            data.output?.[0]?.content?.[0]?.text ||
            "";

        let risultato;

        try {
            risultato = JSON.parse(testo);
        } catch {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "Risposta AI non valida.",
                    raw: testo
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(risultato)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};