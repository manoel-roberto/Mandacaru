/**
 * Orchestrator responsável por ler a planilha, cruzar os dados com o ConfigStore,
 * disparar a geração de documentos (TemplateEngine) e disparar o envio (MailService).
 */
class MergeProcessor {
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

    // 1. Gerar documento/slide utilizando o TemplateEngine
    const generatedFile = TemplateEngine.generateDocument(
      config.templateId,
      config.templateType,
      rowData,
      config.mappingConfig,
      config.destinationFolderId,
      outputName
    );

    // 2. Substituir marcadores dinâmicos no Assunto e no Corpo do e-mail
    let customizedSubject = config.emailSubject;
    let customizedBody = config.emailBody;

    for (const [tag, columnName] of Object.entries(config.mappingConfig)) {
      const val = rowData[columnName] || '';
      const regexTag = new RegExp(`<<${tag}>>|\\{\\{${tag}\\}\\}`, 'g');
      customizedSubject = customizedSubject.replace(regexTag, val);
      customizedBody = customizedBody.replace(regexTag, val);
    }

    // 3. Disparar envio de e-mail com PDF anexo
    MailService.sendDocumentAsPdf(emailRecipient, customizedSubject, customizedBody, generatedFile);
  }

  /**
   * Executa a mesclagem em todas as linhas pendentes da planilha ativa.
   */
  public static runAll(): void {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const config = ConfigStore.getConfig();

    if (!config.templateId) {
      throw new Error('Configuração incompleta: ID do Template não configurado.');
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

    for (let i = 2; i <= lastRow; i++) {
      const currentStatus = String(sheet.getRange(i, statusColIndex).getValue() || '').trim();
      
      // Ignora linhas que já foram processadas com sucesso
      if (currentStatus.startsWith('Sucesso')) {
        continue;
      }

      try {
        MergeProcessor.processRow(sheet, i, headers, config);
        
        // Atualizar status para Sucesso
        const statusCell = sheet.getRange(i, statusColIndex);
        statusCell.setValue(`Sucesso em ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')}`);
        statusCell.setBackground('#d4edda').setFontColor('#155724'); // Estilo verde
        successCount++;
      } catch (error: any) {
        console.error(`Falha ao processar linha ${i}:`, error);
        
        // Registrar erro na célula de status
        const statusCell = sheet.getRange(i, statusColIndex);
        statusCell.setValue(`Erro: ${error.message || error}`);
        statusCell.setBackground('#f8d7da').setFontColor('#721c24'); // Estilo vermelho
        errorCount++;
      }
    }

    // Exibir alerta final ao usuário
    SpreadsheetApp.getUi().alert(
      'Mesclagem Concluída',
      `Processamento finalizado.\nSucessos: ${successCount}\nFalhas: ${errorCount}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
