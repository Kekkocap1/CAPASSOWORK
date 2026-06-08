const DOCENTE_EMAIL = "profcapasso1994@gmail.com";
const SHEET_NAME = "Consegne";

function doPost(e) {

  try {

    const data = JSON.parse(e.postData.contents);

    const sheet = getSheet();

    const now = new Date();

    const nome = data.nome || "";
    const cognome = data.cognome || "";
    const classe = data.classe || "";
    const verifica = data.verifica || "";
    const codice = data.codice || "";

    const docName =
      cognome + "_" +
      nome + "_" +
      classe + "_" +
      verifica;

    const doc = DocumentApp.create(docName);

    const body = doc.getBody();

    body.appendParagraph(
      "CAPASSOWORK - CONSEGNA COMPITO"
    ).setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );

    body.appendParagraph("Nome: " + nome);
    body.appendParagraph("Cognome: " + cognome);
    body.appendParagraph("Classe: " + classe);
    body.appendParagraph("Verifica: " + verifica);
    body.appendParagraph("Data: " + now);

    body.appendParagraph("");

    body.appendParagraph(
      "CODICE CONSEGNATO"
    ).setHeading(
      DocumentApp.ParagraphHeading.HEADING2
    );

    body.appendParagraph(codice)
        .setFontFamily("Courier New");

    doc.saveAndClose();

    const docId = doc.getId();

    const exportUrl =
      "https://docs.google.com/document/d/" +
      docId +
      "/export?format=docx";

    const token =
      ScriptApp.getOAuthToken();

    const response =
      UrlFetchApp.fetch(exportUrl, {

        headers: {
          Authorization:
            "Bearer " + token
        }

      });

    const docxBlob =
      response.getBlob()
              .setName(docName + ".docx");

    GmailApp.sendEmail(

      DOCENTE_EMAIL,

      "Nuova consegna CapassoWork",

      "Nuova verifica ricevuta",

      {
        attachments: [docxBlob]
      }

    );

    sheet.appendRow([

      now,
      nome,
      cognome,
      classe,
      verifica,
      codice,
      doc.getUrl()

    ]);

    return risposta({
      success: true
    });

  } catch(error) {

    return risposta({

      success: false,
      message: error.toString()

    });

  }

}

function getSheet() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(SHEET_NAME);

  if(!sheet) {

    sheet =
      ss.insertSheet(SHEET_NAME);

    sheet.appendRow([

      "Data",
      "Nome",
      "Cognome",
      "Classe",
      "Verifica",
      "Codice",
      "Documento"

    ]);

  }

  return sheet;

}

function risposta(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getAll") {
      const sheet = getSheet();
      const values = sheet.getDataRange().getValues();

      if (values.length <= 1) {
        return risposta({
          success: true,
          data: []
        });
      }

      const rows = values.slice(1);

      const data = rows.map((row, index) => ({
        id: index + 2,
        data: row[0],
        nome: row[1],
        cognome: row[2],
        classe: row[3],
        verifica: row[4],
        codice: row[5],
        documento: row[6] || ""
      }));

      return risposta({
        success: true,
        data: data
      });
    }

    return risposta({
      success: false,
      message: "Azione non valida"
    });

  } catch (error) {
    return risposta({
      success: false,
      message: error.toString()
    });
  }
}