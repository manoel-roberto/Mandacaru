/**
 * Orchestrator responsável por ler a planilha, cruzar os dados com o ConfigStore,
 * disparar a geração de documentos (TemplateEngine) e disparar o envio (MailService).
 */
class MergeProcessor {
  /**
   * Escapa caracteres especiais de expressões regulares.
   */
  public static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Processa uma única linha da planilha com base nas configurações informadas.
   */
  public static processRow(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    rowIndex: number,
    headers: string[],
    config: ReturnType<typeof ConfigStore.getConfig>
  ): void {
    const lastCol = sheet.getLastColumn();
    const rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getDisplayValues()[0];
    
    // Mapear cabeçalhos para seus respectivos valores da linha
    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header] = String(rowValues[index] !== undefined && rowValues[index] !== null ? rowValues[index] : '').trim();
    });

    // Encontrar o e-mail do destinatário usando a coluna configurada
    const emailRecipient = rowData[config.emailColumn];
    if (!emailRecipient || emailRecipient.trim() === '') {
      throw new Error(`A coluna de e-mail "${config.emailColumn}" está vazia nesta linha.`);
    }

    // Gerar o nome do arquivo com base na primeira coluna preenchida ou no índice
    const identifier = rowData[headers[0]] || `Linha_${rowIndex}`;
    const outputName = `Mandacaru - ${identifier} - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;

    if (config.useDocAsEmailBody) {
      if (!config.emailTemplateId || config.emailTemplateId.trim() === '') {
        throw new Error('ID do template de e-mail ausente ou inválido');
      }

      let attachments: GoogleAppsScript.Base.Blob[] = [];
      let generatedFile: GoogleAppsScript.Drive.File | null = null;

      if (!config.sendOnlyEmail && config.templateId && config.templateId.trim() !== '') {
        generatedFile = TemplateEngine.generateDocument(
          config.templateId,
          config.templateType,
          rowData,
          config.mappingConfig,
          config.destinationFolderId,
          outputName
        );
        Utilities.sleep(3000);
        const pdfBlob = generatedFile.getAs('application/pdf');
        pdfBlob.setName(`${generatedFile.getName()}.pdf`);
        attachments.push(pdfBlob);
      }

      MailService.sendDocAsEmailBody(
        emailRecipient,
        config.emailSubject,
        config.emailTemplateId,
        rowData,
        config.mappingConfig,
        attachments
      );

      if (generatedFile) {
        generatedFile.setTrashed(true);
      }
    } else {
      // 1. Substituir marcadores dinâmicos no Assunto e no Corpo do e-mail
      let customizedSubject = config.emailSubject;
      let customizedBody = config.emailBody;

      for (const [tag, columnName] of Object.entries(config.mappingConfig)) {
        const val = rowData[columnName] || '';
        const escapedTag = MergeProcessor.escapeRegExp(tag);
        const regexTag = new RegExp(`<<${escapedTag}>>|\\{\\{${escapedTag}\\}\\}`, 'g');
        customizedSubject = customizedSubject.replace(regexTag, val);
        customizedBody = customizedBody.replace(regexTag, val);
      }

      if (config.sendOnlyEmail) {
        // Enviar apenas e-mail personalizado sem anexo
        MailService.sendPersonalizedEmail(emailRecipient, customizedSubject, customizedBody);
      } else {
        // 1. Gerar documento/slide utilizando o TemplateEngine
        const generatedFile = TemplateEngine.generateDocument(
          config.templateId,
          config.templateType,
          rowData,
          config.mappingConfig,
          config.destinationFolderId,
          outputName
        );

        // 2. Disparar envio de e-mail com PDF anexo
        MailService.sendDocumentAsPdf(emailRecipient, customizedSubject, customizedBody, generatedFile);

        // Mover o ficheiro gerado para o lixo em caso de sucesso total
        generatedFile.setTrashed(true);
      }
    }
  }

  /**
   * Executa a mesclagem em todas as linhas pendentes da planilha ativa.
   */
  public static runAll(): void {
    MailService.clearCache();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const config = ConfigStore.getConfig();

    if (config.sendOnlyEmail) {
      if (!config.emailSubject || config.emailSubject.trim() === '') {
        throw new Error('Configuração incompleta: Assunto do e-mail não configurado.');
      }
      if (config.useDocAsEmailBody) {
        if (!config.emailTemplateId || config.emailTemplateId.trim() === '') {
          throw new Error('Configuração incompleta: ID do Template de E-mail não configurado.');
        }
      } else {
        if (!config.emailBody || config.emailBody.trim() === '') {
          throw new Error('Configuração incompleta: Corpo do e-mail não configurado.');
        }
      }
    } else {
      if (config.useDocAsEmailBody) {
        if (!config.emailTemplateId || config.emailTemplateId.trim() === '') {
          throw new Error('Configuração incompleta: ID do Template de E-mail não configurado.');
        }
      } else {
        if (!config.templateId || config.templateId.trim() === '') {
          throw new Error('Configuração incompleta: ID do Template não configurado.');
        }
      }
    }
    if (!config.emailColumn) {
      throw new Error('Configuração incompleta: Coluna de E-mail de destino não configurada.');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error('A planilha está vazia ou contém apenas os cabeçalhos.');
    }

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

    // Encontrar ou injetar a coluna "Status Mandacaru"
    let statusColIndex = headers.indexOf('Status Mandacaru') + 1;
    if (statusColIndex === 0) {
      statusColIndex = lastCol + 1;
      sheet.getRange(1, statusColIndex).setValue('Status Mandacaru');
      // Formatar cabeçalho do status
      sheet.getRange(1, statusColIndex).setFontWeight('bold').setBackground('#efefef');
      headers.push('Status Mandacaru');
    }

    let successCount = 0;
    let errorCount = 0;

    // Obter o intervalo correspondente à coluna de Status para as linhas do loop
    const statusRange = sheet.getRange(2, statusColIndex, lastRow - 1, 1);
    const statusValues = statusRange.getValues();
    const statusBackgrounds = statusRange.getBackgrounds();
    const statusFontColors = statusRange.getFontColors();

    for (let i = 2; i <= lastRow; i++) {
      const arrayIdx = i - 2;
      const currentStatus = String(statusValues[arrayIdx][0] || '').trim();
      
      // Ignora linhas que já foram processadas com sucesso
      if (currentStatus.startsWith('Sucesso')) {
        continue;
      }

      try {
        MergeProcessor.processRow(sheet, i, headers, config);
        
        // Atualizar status para Sucesso no array
        statusValues[arrayIdx][0] = `Sucesso em ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')}`;
        statusBackgrounds[arrayIdx][0] = '#d4edda';
        statusFontColors[arrayIdx][0] = '#155724';
        successCount++;
      } catch (error: any) {
        console.error(`Falha ao processar linha ${i}:`, error);
        
        // Registrar erro no array
        statusValues[arrayIdx][0] = `Erro: ${error.message || error}`;
        statusBackgrounds[arrayIdx][0] = '#f8d7da';
        statusFontColors[arrayIdx][0] = '#721c24';
        errorCount++;
      }
    }

    // Gravar todas as atualizações de uma só vez na planilha
    statusRange.setValues(statusValues);
    statusRange.setBackgrounds(statusBackgrounds);
    statusRange.setFontColors(statusFontColors);

    // Exibir alerta final ao usuário
    SpreadsheetApp.getUi().alert(
      'Mesclagem Concluída',
      `Processamento finalizado.\nSucessos: ${successCount}\nFalhas: ${errorCount}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
