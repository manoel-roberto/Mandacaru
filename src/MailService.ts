/**
 * Serviço responsável pela conversão de arquivos gerados (Docs/Slides) para PDF
 * e distribuição de e-mails com anexos via GmailApp.
 */
class MailService {
  private static docHtmlCache: Record<string, string> = {};

  /**
   * Limpa o cache de templates de e-mail em memória.
   */
  public static clearCache(): void {
    MailService.docHtmlCache = {};
  }

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

  /**
   * Obtém o HTML de um Google Doc, realiza mesclagem de tags no assunto e corpo HTML,
   * e envia via GmailApp com suporte a anexos opcionais.
   */
  public static sendDocAsEmailBody(
    recipient: string,
    subject: string,
    docId: string,
    rowData: Record<string, string>,
    mappingConfig: Record<string, string>,
    attachments?: GoogleAppsScript.Base.Blob[]
  ): void {
    if (!recipient || recipient.trim() === '') {
      throw new Error('O e-mail do destinatário está vazio ou é inválido.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      throw new Error(`O endereço de e-mail fornecido é inválido: "${recipient}"`);
    }

    if (!docId || docId.trim() === '') {
      throw new Error('ID do template de e-mail ausente ou inválido');
    }

    let htmlBody = '';
    if (MailService.docHtmlCache[docId]) {
      htmlBody = MailService.docHtmlCache[docId];
    } else {
      try {
        const url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + docId + '&exportFormat=html';
        const response = UrlFetchApp.fetch(url, {
          method: 'get',
          headers: {
            'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
          },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
          throw new Error(`Código de status HTTP: ${response.getResponseCode()}`);
        }

        htmlBody = response.getContentText();
        MailService.docHtmlCache[docId] = htmlBody;
      } catch (error) {
        console.error(`Erro ao buscar template HTML do documento ${docId}:`, error);
        throw new Error('Falha ao converter o Google Doc em E-mail: Verifique o ID e as permissões de acesso');
      }
    }

    // Processar imagens inline via CID extraídas do Google Drive
    const inlineImages: Record<string, GoogleAppsScript.Base.Blob> = {};
    let imageCount = 0;
    const imageCache: Record<string, string> = {};

    const imageTagRegex = /(?:&lt;&lt;|<<)image:([a-zA-Z0-9_-]+)(?:&gt;&gt;|>>)/g;

    htmlBody = htmlBody.replace(imageTagRegex, (match, fileId) => {
      try {
        if (imageCache[fileId]) {
          const cid = imageCache[fileId];
          return `<img src="cid:${cid}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
        }

        const file = DriveApp.getFileById(fileId);
        const mimeType = file.getMimeType();
        if (!mimeType || !mimeType.startsWith('image/')) {
          throw new Error(`Arquivo com ID ${fileId} não é uma imagem válida (MIME: ${mimeType})`);
        }

        const blob = file.getBlob();
        const cid = `img_${++imageCount}`;
        inlineImages[cid] = blob;
        imageCache[fileId] = cid;

        return `<img src="cid:${cid}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
      } catch (error) {
        console.warn(`Erro ao processar imagem inline para ID ${fileId}:`, error);
        return `<span style="color: #d93025; font-style: italic; font-size: 0.9em;">[Imagem indisponível]</span>`;
      }
    });

    // Processar substituições de tags no Assunto e no HTML
    let customizedSubject = subject;
    for (const [tag, columnName] of Object.entries(mappingConfig)) {
      const val = rowData[columnName] || '';
      const escapedTag = MergeProcessor.escapeRegExp(tag);
      // Delimitadores esquerdos abrangentes
      const leftDelim = '(?:<<|&lt;&lt;|\\{\\{|«|&laquo;)';
      // Delimitadores direitos abrangentes
      const rightDelim = '(?:>>|&gt;&gt;|\\}\\}|»|&raquo;)';
      // Ignora tags HTML, espaços e quebras invisíveis (zero-width space) entre os delimitadores e a chave
      const noise = '(?:<[^>]+>|\\s|\\u200B)*'; 

      // Flag 'gi' para substituir todas as ocorrências e ignorar Case Sensitive
      const regexTag = new RegExp(`${leftDelim}${noise}${escapedTag}${noise}${rightDelim}`, 'gi');
      customizedSubject = customizedSubject.replace(regexTag, () => val);
      htmlBody = htmlBody.replace(regexTag, () => val);
    }

    const options: GoogleAppsScript.Gmail.GmailAdvancedOptions = {
      htmlBody: htmlBody,
      name: 'Mandacaru Automator',
      inlineImages: inlineImages
    };

    if (attachments && attachments.length > 0) {
      options.attachments = attachments;
    }

    try {
      GmailApp.sendEmail(recipient, customizedSubject, '', options);
      console.log(`E-mail de Mala Direta Rica enviado com sucesso para: ${recipient}`);
    } catch (error) {
      console.error(`Erro ao enviar e-mail de Mala Direta Rica para ${recipient}:`, error);
      throw error;
    }
  }

  /**
   * Envia um e-mail personalizado contendo apenas texto formatado em HTML (convertendo quebras de linha em <br>),
   * sem gerar ou anexar qualquer arquivo.
   * 
   * @param recipient E-mail de destino.
   * @param subject Assunto do e-mail.
   * @param body Corpo do e-mail em formato texto com tags mescladas.
   */
  public static sendPersonalizedEmail(
    recipient: string,
    subject: string,
    body: string
  ): void {
    if (!recipient || recipient.trim() === '') {
      throw new Error('O e-mail do destinatário está vazio ou é inválido.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      throw new Error(`O endereço de e-mail fornecido é inválido: "${recipient}"`);
    }

    try {
      // Converter quebras de linha em <br> para formatação HTML
      const htmlBody = body.replace(/\n/g, '<br>');

      // Enviar e-mail sem anexo via GmailApp
      GmailApp.sendEmail(recipient, subject, body, {
        htmlBody: htmlBody,
        name: 'Mandacaru Automator'
      });

      console.log(`E-mail personalizado enviado com sucesso para: ${recipient}`);
    } catch (error) {
      console.error(`Erro ao enviar e-mail personalizado para ${recipient}:`, error);
      throw error;
    }
  }
}
