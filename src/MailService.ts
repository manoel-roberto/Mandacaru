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

      // Converter o arquivo do Drive para PDF com lógica de retentativa (máximo de 3 tentativas)
      let pdfBlob: GoogleAppsScript.Base.Blob | null = null;
      const maxAttempts = 3;
      let lastConversionError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          pdfBlob = file.getAs('application/pdf');
          break; // Sucesso na conversão, sai do loop
        } catch (err: any) {
          lastConversionError = err;
          console.warn(`Tentativa ${attempt} de conversão para PDF falhou: ${err.message || err}`);
          if (attempt < maxAttempts) {
            Utilities.sleep(2000); // Aguarda 2 segundos adicionais antes da próxima tentativa
          }
        }
      }

      if (!pdfBlob) {
        throw new Error(`Falha ao converter documento para PDF após ${maxAttempts} tentativas. Erro original: ${lastConversionError?.message || lastConversionError}`);
      }
      
      // Garantir que o nome do anexo coincida com o nome do arquivo gerado
      pdfBlob.setName(`${file.getName()}.pdf`);

      // Converter quebras de linha em <br> para formatação HTML
      const htmlBody = body.replace(/\n/g, '<br>');

      // Enviar o e-mail pelo GmailApp
      GmailApp.sendEmail(recipient, subject, body, {
        htmlBody: htmlBody,
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
