/**
 * Evento acionado ao abrir a Planilha do Google Sheets.
 * Adiciona o menu Mandacaru com as opções de controle do Add-on.
 */
function onOpen(e: GoogleAppsScript.Events.SheetsOnOpen) {
  SpreadsheetApp.getUi()
    .createMenu('🌵 Mandacaru')
    .addItem('Configurações & Mapeamento', 'showMappingDialog')
    .addSeparator()
    .addItem('Executar Mesclagem Manual', 'startManualMerge')
    .addSeparator()
    .addItem('Ativar Automação (Gatilho Form)', 'registerFormTrigger')
    .addItem('Desativar Automação', 'unregisterFormTrigger')
    .addSeparator()
    .addItem('Executar Teste Rápido (Linha 2)', 'testMandacaru')
    .addToUi();
}

/**
 * Abre a interface gráfica de Mapeamento (HTML) em formato de Modal Dialog.
 */
function showMappingDialog() {
  const html = HtmlService.createTemplateFromFile('sidebar')
    .evaluate()
    .setWidth(650)
    .setHeight(550)
    .setTitle('Configurações do Mandacaru');
  SpreadsheetApp.getUi().showModalDialog(html, 'Mandacaru - Automação & Mesclagem');
}

/**
 * Função executada automaticamente ao receber uma submissão de Formulário do Google (Forms).
 */
function onFormSubmitTrigger(e: GoogleAppsScript.Events.SheetsOnFormSubmit) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const rowIndex = range.getRow();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const config = ConfigStore.getConfig();

    // Validar se as configurações mínimas existem antes de prosseguir
    if (!config.templateId || !config.emailColumn) {
      console.warn('Gatilho disparado, mas as configurações do Mandacaru estão incompletas.');
      return;
    }

    let statusColIndex = headers.indexOf('Status Mandacaru') + 1;
    if (statusColIndex === 0) {
      statusColIndex = lastCol + 1;
      sheet.getRange(1, statusColIndex).setValue('Status Mandacaru');
      headers.push('Status Mandacaru');
    }

    try {
      MergeProcessor.processRow(sheet, rowIndex, headers, config);
      const statusCell = sheet.getRange(rowIndex, statusColIndex);
      statusCell.setValue(`Sucesso (Gatilho) em ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')}`);
      statusCell.setBackground('#d4edda').setFontColor('#155724');
    } catch (err: any) {
      console.error(`Erro ao processar linha disparada pelo gatilho (${rowIndex}):`, err);
      const statusCell = sheet.getRange(rowIndex, statusColIndex);
      statusCell.setValue(`Erro (Gatilho): ${err.message}`);
      statusCell.setBackground('#f8d7da').setFontColor('#721c24');
    }
  } catch (outerError) {
    console.error('Falha geral no handler do gatilho onFormSubmitTrigger:', outerError);
  }
}

// ==========================================
// FUNÇÕES DE COMUNICAÇÃO RPC (UI <-> SCRIPT)
// ==========================================

/**
 * Retorna as configurações salvas na planilha.
 */
function getSavedConfigJson(): string {
  try {
    const config = ConfigStore.getConfig();
    return JSON.stringify(config);
  } catch (e: any) {
    throw new Error('Falha ao ler as configurações: ' + e.message);
  }
}

/**
 * Salva as configurações recebidas da interface.
 */
function saveConfigJson(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson);
    ConfigStore.saveConfig({
      templateId: parsed.templateId || '',
      templateType: parsed.templateType || 'DOC',
      destinationFolderId: parsed.destinationFolderId || '',
      emailColumn: parsed.emailColumn || '',
      emailSubject: parsed.emailSubject || '',
      emailBody: parsed.emailBody || '',
      emailTemplateId: parsed.emailTemplateId || '',
      useDocAsEmailBody: parsed.useDocAsEmailBody === true,
      mappingConfig: parsed.mappingConfig || {}
    });
    return 'Configurações salvas com sucesso!';
  } catch (e: any) {
    throw new Error('Erro ao salvar configurações: ' + e.message);
  }
}

/**
 * Retorna as colunas de cabeçalho da planilha ativa.
 */
function getSpreadsheetHeaders(): string[] {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()).filter(h => h !== '');
  } catch (e: any) {
    throw new Error('Erro ao obter os cabeçalhos: ' + e.message);
  }
}

/**
 * Executa a mesclagem manual.
 */
function startManualMerge() {
  try {
    MergeProcessor.runAll();
  } catch (e: any) {
    SpreadsheetApp.getUi().alert('Erro na Mesclagem', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Registra o gatilho de formulário.
 */
function registerFormTrigger() {
  try {
    TriggerManager.setupFormSubmitTrigger();
    SpreadsheetApp.getUi().alert(
      'Gatilho Registrado',
      'O gatilho de formulário foi configurado com sucesso e executará automaticamente a cada nova resposta.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e: any) {
    SpreadsheetApp.getUi().alert('Erro ao registrar gatilho', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Remove o gatilho de formulário.
 */
function unregisterFormTrigger() {
  try {
    TriggerManager.clearTriggers();
    SpreadsheetApp.getUi().alert(
      'Gatilho Desativado',
      'Os gatilhos automáticos do Mandacaru foram desativados para esta planilha.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e: any) {
    SpreadsheetApp.getUi().alert('Erro ao remover gatilho', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Função de teste isolado para validar a substituição de tags em um documento fixo
 * utilizando os dados contidos na linha 2 da planilha ativa.
 */
function testMandacaru(): void {
  const ui = SpreadsheetApp.getUi();
  try {
    const config = ConfigStore.getConfig();
    if (!config.templateId) {
      ui.alert('Erro', 'Por favor, abra a tela de configurações e mapeie um template de documento primeiro.', ui.ButtonSet.OK);
      return;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

    // Utiliza a linha 2 como dados de teste
    if (sheet.getLastRow() < 2) {
      ui.alert('Erro', 'A planilha precisa ter pelo menos uma linha de dados (linha 2) para realizar o teste.', ui.ButtonSet.OK);
      return;
    }

    ui.alert('Iniciando Teste', 'O teste utilizará a linha 2 da planilha para gerar o documento e enviar o e-mail.', ui.ButtonSet.OK);
    
    // Executa o processo de mesclagem específico para a linha 2
    MergeProcessor.processRow(sheet, 2, headers, config);
    
    ui.alert('Teste Concluído', 'Mesclagem e envio de e-mail efetuados com sucesso!', ui.ButtonSet.OK);
  } catch (e: any) {
    console.error('Falha no teste isolado:', e);
    ui.alert('Falha no Teste', `Ocorreu um erro ao processar o teste:\n${e.message}`, ui.ButtonSet.OK);
  }
}

