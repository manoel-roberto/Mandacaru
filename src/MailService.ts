/**
 * Serviço responsável pela conversão de arquivos gerados (Docs/Slides) para PDF
 * e distribuição de e-mails com anexos via GmailApp.
 */
class MailService {
  /**
   * Converte um arquivo do Drive para PDF e o envia como anexo de e-mail.
   * 
   * @param recipient E-mail de destino.
   * @param subject Assunto do e-mail (suporta tags).
   * @param body Corpo do e-mail em formato de texto.
   * @param file Arquivo gerado (Google Doc ou Slide) que será anexado.
   */
  public static sendDocumentAsPdf(
    recipient: string,
    subject: string,
    body: string,
    file: GoogleAppsScript.Drive.File
  ): void {
    if (!recipient || recipient.trim() === '') {
      throw new Error('O e-mail do destinatário está vazio ou é inválido.');
    }

    // Validação simples de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      throw new Error(`O endereço de e-mail fornecido é inválido: "${recipient}"`);
    }

    try {
      // Aguarda 3 segundos para garantir a sincronização do arquivo e renderização das imagens no Drive
      Utilities.sleep(3000);

      // Converter o arquivo do Drive para PDF
      const pdfBlob = file.getAs('application/pdf');
      
      // Garantir que o nome do anexo coincida com o nome do arquivo gerado
      pdfBlob.setName(`${file.getName()}.pdf`);

      // Enviar o e-mail pelo GmailApp
      GmailApp.sendEmail(recipient, subject, body, {
        attachments: [pdfBlob],
        name: 'Mandacaru Automator'
      });

      console.log(`E-mail com anexo enviado com sucesso para: ${recipient}`);
    } catch (error) {
      console.error(`Erro ao processar/enviar e-mail para ${recipient}:`, error);
      throw error;
    }
  }
}
