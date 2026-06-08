exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Metodo non consentito" })
        };
    }

    try {
        const { nome, cognome, classe, verifica, codice, votoAttuale, commentoAttuale } =
            JSON.parse(event.body || "{}");

        if (!codice || codice.trim() === "") {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Nessun codice da analizzare." })
            };
        }

        const prompt = `
Sei un assistente per un docente di informatica.
Analizza il codice consegnato da uno studente.

Studente: ${cognome} ${nome}
Classe: ${classe}
Verifica: ${verifica}

Codice:
${codice}

Rispondi SOLO in JSON valido con questa struttura:
{
  "puntiPositivi": [],
  "errori": [],
  "suggerimentoVoto": "",
  "commentoDocente": "",
  "codiceCorretto": ""
}

Regole:
- Non essere troppo severo.
- Il voto è solo un suggerimento.
- Il commento deve essere adatto a uno studente.
- Nel codiceCorretto inserisci una versione corretta o annotata del codice.
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
                body: JSON.stringify({ error: data.error?.message || "Errore OpenAI" })
            };
        }

        const text =
            data.output_text ||
            data.output?.[0]?.content?.[0]?.text ||
            "";

        return {
            statusCode: 200,
            body: text
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};