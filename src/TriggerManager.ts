/**
 * Classe responsável pelo gerenciamento de Triggers (Gatilhos) no Google Workspace.
 */
class TriggerManager {
  private static readonly TRIGGER_FUNCTION_NAME = 'onFormSubmitTrigger';

  /**
   * Configura o gatilho onFormSubmit na planilha ativa para rodar a automação a cada novo formulário.
   */
  public static setupFormSubmitTrigger(): void {
    // Evitar duplicidade limpando gatilhos anteriores
    TriggerManager.clearTriggers();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    try {
      ScriptApp.newTrigger(TriggerManager.TRIGGER_FUNCTION_NAME)
        .forSpreadsheet(ss)
        .onFormSubmit()
        .create();
      
      console.log(`Gatilho criado com sucesso para a função: ${TriggerManager.TRIGGER_FUNCTION_NAME}`);
    } catch (error) {
      console.error('Falha ao registrar o gatilho de formulário:', error);
      throw new Error(`Não foi possível criar o gatilho. Verifique se o projeto possui permissões de execução. Detalhes: ${error}`);
    }
  }

  /**
   * Remove todos os gatilhos de submissão do Mandacaru cadastrados no projeto atual.
   */
  public static clearTriggers(): void {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      let count = 0;
      for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === TriggerManager.TRIGGER_FUNCTION_NAME) {
          ScriptApp.deleteTrigger(trigger);
          count++;
        }
      }
      console.log(`${count} gatilho(s) anterior(es) limpo(s).`);
    } catch (error) {
      console.error('Erro ao tentar limpar gatilhos existentes:', error);
      throw error;
    }
  }
}
