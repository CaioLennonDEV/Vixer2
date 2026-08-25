/**
 * Vixer Storage Manager
 */
const STORAGE_KEYS = {
  CHATS: 'vixer_chats_v3',
  ACTIVE_CHAT_ID: 'vixer_active_chat_id_v3',
  SYSTEM_PROMPT: 'vixer_system_prompt_v3',
  SELECTED_MODEL: 'vixer_selected_model_v3',
};

const DEFAULT_VIXER_PROMPT =
  'Você auxilia em matérias do curso de Sistemas de Informação, programação, banco de dados e estudos em geral. Responda em português brasileiro de forma motivadora, clara, didática e objetiva.';

export class StorageManager {
  static getChats() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHATS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erro ao ler chats do localStorage:', e);
      return [];
    }
  }

  static saveChats(chats) {
    try {
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    } catch (e) {
      console.error('Erro ao salvar chats no localStorage:', e);
    }
  }

  static getActiveChatId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID) || null;
  }

  static setActiveChatId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
  }

  static getSystemPrompt() {
    return localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || DEFAULT_VIXER_PROMPT;
  }

  static saveSystemPrompt(prompt) {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
  }

  static getSelectedModel() {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
  }

  static saveSelectedModel(modelId) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
  }

  static createNewChat(title = 'Novo Chat') {
    const chats = this.getChats();
    const newChat = {
      id: 'chat_' + Date.now(),
      title,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    chats.unshift(newChat);
    this.saveChats(chats);
    this.setActiveChatId(newChat.id);
    return newChat;
  }

  static updateActiveChatMessages(messages) {
    const activeId = this.getActiveChatId();
    if (!activeId) return;

    const chats = this.getChats();
    const chatIndex = chats.findIndex(c => c.id === activeId);

    if (chatIndex !== -1) {
      chats[chatIndex].messages = messages;
      if (chats[chatIndex].title === 'Novo Chat' && messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          chats[chatIndex].title = firstUserMsg.content.slice(0, 26) + (firstUserMsg.content.length > 26 ? '...' : '');
        }
      }
      this.saveChats(chats);
    }
  }

  static deleteChat(id) {
    let chats = this.getChats();
    chats = chats.filter(c => c.id !== id);
    this.saveChats(chats);
    if (this.getActiveChatId() === id) {
      const nextId = chats.length > 0 ? chats[0].id : null;
      if (nextId) {
        this.setActiveChatId(nextId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
      }
    }
  }
}
