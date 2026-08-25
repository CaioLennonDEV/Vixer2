/**
 * Storage Manager for localStorage persistence
 */
const STORAGE_KEYS = {
  CHATS: 'vixer_chats_v1',
  ACTIVE_CHAT_ID: 'vixer_active_chat_id',
  SYSTEM_PROMPT: 'vixer_system_prompt',
  SELECTED_MODEL: 'vixer_selected_model',
};

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
    return localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || 
      'Você é o Vixer AI, um assistente virtual inteligente e amigável que responde em português brasileiro. Seja conciso, claro e prestativo.';
  }

  static saveSystemPrompt(prompt) {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
  }

  static getSelectedModel() {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
  }

  static saveSelectedModel(modelId) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
  }

  static createNewChat(title = 'Nova Conversa') {
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
      // Auto update title from first user message if title is default
      if (chats[chatIndex].title === 'Nova Conversa' && messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          chats[chatIndex].title = firstUserMsg.content.slice(0, 28) + (firstUserMsg.content.length > 28 ? '...' : '');
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
