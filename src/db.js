import { generateCourseSystemPrompt } from './coursesData.js';

const CONFIGURED_REMOTE_URL = (import.meta.env.VITE_OLLAMA_API_URL || localStorage.getItem('vixer_remote_api_url') || 'https://demeanor-unlocked-kilobyte.ngrok-free.dev').replace(/\/$/, '');

function getApiBaseUrl() {
  const remoteUrl = localStorage.getItem('vixer_remote_api_url') || CONFIGURED_REMOTE_URL;
  return `${remoteUrl.replace(/\/$/, '')}/api`;
}

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Bypass-Tunnel-Reminder': 'true',
  'ngrok-skip-browser-warning': 'true'
};

const DB_NAME = 'VixerDB_v1';
const DB_VERSION = 1;
const SESSION_STORAGE_KEY = 'vixer_active_user_session';

export class DatabaseService {
  /**
   * Tenta cadastrar o usuário na API PostgreSQL (Backend), caindo de volta para IndexedDB se offline
   */
  static async registerUser({ name, email, password, type, course }) {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: COMMON_HEADERS,
        body: JSON.stringify({ name, email, password, type, course })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro no cadastro.');
      }

      this.setCurrentUserSession(data.user);
      return data.user;
    } catch (apiError) {
      console.warn('API PostgreSQL indisponível. Usando banco local IndexedDB:', apiError.message);
      return this.registerUserLocal({ name, email, password, type, course });
    }
  }

  /**
   * Tenta autenticar o usuário na API PostgreSQL, caindo de volta para IndexedDB se offline
   */
  static async loginUser(email, password) {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: COMMON_HEADERS,
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha no login.');
      }

      this.setCurrentUserSession(data.user);
      return data.user;
    } catch (apiError) {
      console.warn('API PostgreSQL indisponível. Tentando login via banco local IndexedDB:', apiError.message);
      return this.loginUserLocal(email, password);
    }
  }

  /**
   * Atualiza a instrução/prompt do sistema do usuário no Banco de Dados
   */
  static async updateUserSystemPrompt(userId, newPrompt) {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/user/prompt`, {
        method: 'PUT',
        headers: COMMON_HEADERS,
        body: JSON.stringify({ userId, prompt: newPrompt })
      });
    } catch (e) {
      console.warn('Não foi possível sincronizar o prompt com o servidor remoto.');
    }

    const current = this.getCurrentUserSession();
    if (current && current.id === userId) {
      current.systemPrompt = newPrompt;
      this.setCurrentUserSession(current);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* FALLBACK BANCO DE DADOS LOCAL INDEXEDDB + HASH SHA-256 PARA MODO CLIENTE  */
  /* -------------------------------------------------------------------------- */

  static async registerUserLocal({ name, email, password, type, course }) {
    const db = await this.getDB();
    const normalizedEmail = email.trim().toLowerCase();
    
    const existingUser = await this.getUserByEmailLocal(normalizedEmail);
    if (existingUser) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    const { hash, salt } = await this.hashPasswordLocal(password);
    const systemPrompt = generateCourseSystemPrompt(name, type, course);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hash,
      salt: salt,
      type: type,
      course: course,
      systemPrompt: systemPrompt,
      createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.add(newUser);

      req.onsuccess = () => {
        const safeUser = this.sanitizeUserSession(newUser);
        this.setCurrentUserSession(safeUser);
        resolve(safeUser);
      };
      req.onerror = () => reject(new Error('Erro ao salvar no banco local.'));
    });
  }

  static async loginUserLocal(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.getUserByEmailLocal(normalizedEmail);

    if (!user) throw new Error('E-mail ou senha incorretos.');

    const { hash } = await this.hashPasswordLocal(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const safeUser = this.sanitizeUserSession(user);
    this.setCurrentUserSession(safeUser);
    return safeUser;
  }

  static async getUserByEmailLocal(email) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const index = store.index('email');
      const req = index.get(email.trim().toLowerCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  static async hashPasswordLocal(password, saltHex = null) {
    const encoder = new TextEncoder();
    let saltHexValue = saltHex;
    if (!saltHexValue) {
      const saltBuffer = new Uint8Array(16);
      crypto.getRandomValues(saltBuffer);
      saltHexValue = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const saltedData = encoder.encode(password + saltHexValue);
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashHex, salt: saltHexValue };
  }

  static getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static sanitizeUserSession(user) {
    const { passwordHash, salt, ...safeUser } = user;
    return safeUser;
  }

  static getCurrentUserSession() {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  static setCurrentUserSession(user) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  }

  static logoutUser() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
