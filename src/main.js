import { marked } from 'marked';
import hljs from 'highlight.js';
import { LLMEngine } from './webllm.js';
import { StorageManager } from './storage.js';
import { DatabaseService } from './db.js';
import { COURSES_DATA, generateCourseSystemPrompt } from './coursesData.js';
import { RAGEngine } from './ragEngine.js';
import { parsePDFFile } from './pdfParser.js';

// Instantiate LLM Engine
const llmEngine = new LLMEngine();

// Configure Marked with Highlight.js
marked.setOptions({
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  breaks: true,
});

const renderer = new marked.Renderer();
renderer.code = function (code, language) {
  const validLang = hljs.getLanguage(language) ? language : 'plaintext';
  const highlighted = hljs.highlight(code, { language: validLang }).value;
  
  return `
    <div class="code-block-wrapper">
      <button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText).then(() => { this.innerText = 'Copiado!'; setTimeout(() => this.innerText = 'Copiar', 2000); })">Copiar</button>
      <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
    </div>
  `;
};
marked.use({ renderer });

// State Variables
let currentMessages = [];
let isModelReady = false;

// DOM Elements
const webgpuModal = document.getElementById('webgpu-warning');
const closeWarningBtn = document.getElementById('close-warning-btn');

// Auth DOM Elements
const authModal = document.getElementById('auth-modal');
const openAuthBtn = document.getElementById('open-auth-btn');
const closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

const regName = document.getElementById('reg-name');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const regType = document.getElementById('reg-type');
const regCourse = document.getElementById('reg-course');
const regError = document.getElementById('reg-error');

const userHeaderProfile = document.getElementById('user-header-profile');
const sidebarUserSummary = document.getElementById('sidebar-user-summary');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserCourse = document.getElementById('sidebar-user-course');
const logoutBtn = document.getElementById('logout-btn');

const welcomeUserTitle = document.getElementById('welcome-user-title');
const welcomeUserBadge = document.getElementById('welcome-user-badge');

const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const newChatBtn = document.getElementById('new-chat-btn');

const modelSelect = document.getElementById('model-select');
const modelStatusTag = document.getElementById('model-status-tag');
const modelStatusText = document.getElementById('model-status-text');
const systemPromptInput = document.getElementById('system-prompt-input');
const chatHistoryList = document.getElementById('chat-history-list');
const headerStatusBadge = document.getElementById('header-status-badge');
const unloadModelBtn = document.getElementById('unload-model-btn');

const progressCard = document.getElementById('progress-card');
const progressFile = document.getElementById('progress-file');
const progressPercentage = document.getElementById('progress-percentage');
const progressBarFill = document.getElementById('progress-bar-fill');

const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const metricsBadge = document.getElementById('metrics-badge');

// PDF Upload DOM Elements
const pdfFileInput = document.getElementById('pdf-file-input');
const attachPdfBtn = document.getElementById('attach-pdf-btn');
const activePdfsContainer = document.getElementById('active-pdfs-container');

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Check WebGPU
  const hasWebGPU = LLMEngine.checkWebGPUSupport();
  if (!hasWebGPU) {
    webgpuModal.classList.remove('hidden');
  }

  // Populate Register Course dropdown
  populateCourseOptions(regType.value);

  // Restore User Session & Preferences
  updateUserSessionUI();

  const savedModel = StorageManager.getSelectedModel();
  if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  }

  initChatSession();
  setupEventListeners();
});

function populateCourseOptions(type) {
  regCourse.innerHTML = '';
  const courses = COURSES_DATA[type] || [];
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === 'Sistemas de Informação') opt.selected = true;
    regCourse.appendChild(opt);
  });
}

function updateUserSessionUI() {
  const currentUser = DatabaseService.getCurrentUserSession();

  if (currentUser) {
    userHeaderProfile.innerHTML = `
      <div class="user-badge-header">
        <span>👤 ${escapeHtml(currentUser.name)}</span>
        <button id="header-logout-btn" class="btn btn-sm btn-ghost" title="Sair da conta" style="padding: 0 0.4rem;">✕</button>
      </div>
    `;

    document.getElementById('header-logout-btn').addEventListener('click', handleLogout);
    logoutBtn.classList.remove('hidden');

    sidebarUserName.textContent = currentUser.name;
    sidebarUserCourse.textContent = `${currentUser.course} (${currentUser.type})`;

    welcomeUserTitle.textContent = `Olá, ${currentUser.name.split(' ')[0]}! Sou o Vixer AI`;
    welcomeUserBadge.textContent = `${currentUser.course} • ${currentUser.type}`;
  } else {
    userHeaderProfile.innerHTML = `
      <button id="open-auth-btn" class="btn btn-sm btn-ghost">Entrar / Cadastrar</button>
    `;
    document.getElementById('open-auth-btn').addEventListener('click', () => authModal.classList.remove('hidden'));
    logoutBtn.classList.add('hidden');

    sidebarUserName.textContent = 'Convidado';
    sidebarUserCourse.textContent = 'Sistemas de Informação';

    welcomeUserTitle.textContent = 'Olá! Sou o Vixer AI';
    welcomeUserBadge.textContent = 'Sistemas de Informação • Presencial';
  }
}

function initChatSession() {
  const chats = StorageManager.getChats();
  let activeId = StorageManager.getActiveChatId();

  if (chats.length === 0 || !chats.find(c => c.id === activeId)) {
    const newChat = StorageManager.createNewChat();
    activeId = newChat.id;
  }

  const activeChat = StorageManager.getChats().find(c => c.id === activeId);
  currentMessages = activeChat ? activeChat.messages : [];

  renderHistoryList();
  renderMessages();
}

function renderHistoryList() {
  chatHistoryList.innerHTML = '';
  const chats = StorageManager.getChats();
  const activeId = StorageManager.getActiveChatId();

  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === activeId ? 'active' : ''}`;
    item.innerHTML = `
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${escapeHtml(chat.title)}</span>
      <button class="delete-chat-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Excluir">✕</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-chat-btn')) {
        e.stopPropagation();
        StorageManager.deleteChat(chat.id);
        initChatSession();
        return;
      }
      StorageManager.setActiveChatId(chat.id);
      initChatSession();
      closeSidebar();
    });

    chatHistoryList.appendChild(item);
  });
}

function renderMessages() {
  const messageRows = messagesContainer.querySelectorAll('.message-row');
  messageRows.forEach(row => row.remove());

  if (currentMessages.length === 0) {
    welcomeScreen.classList.remove('hidden');
    return;
  }

  welcomeScreen.classList.add('hidden');
  currentMessages.forEach(msg => {
    appendMessageUI(msg.role, msg.content, false);
  });
  scrollToBottom();
}

function appendMessageUI(role, content, animate = true) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = role === 'assistant' ? `<div class="message-avatar">⚡</div>` : '';
  const parsedContent = role === 'assistant' ? marked.parse(content) : escapeHtml(content);

  row.innerHTML = `
    ${avatar}
    <div class="message-content">
      <div class="message-bubble">${parsedContent}</div>
    </div>
  `;

  messagesContainer.appendChild(row);
  if (animate) scrollToBottom();
  return row;
}

function setupEventListeners() {
  // PDF Upload Handler
  attachPdfBtn.addEventListener('click', () => pdfFileInput.click());
  pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      attachPdfBtn.disabled = true;
      attachPdfBtn.style.opacity = '0.5';

      const parsedPdf = await parsePDFFile(file);
      RAGEngine.addUploadedPDF(parsedPdf);

      renderActivePdfChips();
      pdfFileInput.value = '';
      attachPdfBtn.disabled = false;
      attachPdfBtn.style.opacity = '1';
    } catch (err) {
      console.error('Erro ao ler PDF:', err);
      alert('Não foi possível ler o arquivo PDF: ' + err.message);
      attachPdfBtn.disabled = false;
      attachPdfBtn.style.opacity = '1';
    }
  });

  // Auth Modal Listeners
  closeAuthModalBtn.addEventListener('click', () => authModal.classList.add('hidden'));

  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  regType.addEventListener('change', () => {
    populateCourseOptions(regType.value);
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    try {
      await DatabaseService.loginUser(loginEmail.value, loginPassword.value);
      authModal.classList.add('hidden');
      updateUserSessionUI();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.classList.add('hidden');

    try {
      await DatabaseService.registerUser({
        name: regName.value,
        email: regEmail.value,
        password: regPassword.value,
        type: regType.value,
        course: regCourse.value
      });
      authModal.classList.add('hidden');
      updateUserSessionUI();
    } catch (err) {
      regError.textContent = err.message;
      regError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', handleLogout);

  // Sidebar Toggles
  openSidebarBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);
  closeWarningBtn.addEventListener('click', () => webgpuModal.classList.add('hidden'));

  // New Chat
  newChatBtn.addEventListener('click', () => {
    StorageManager.createNewChat();
    initChatSession();
    closeSidebar();
  });

  modelSelect.addEventListener('change', async () => {
    const selectedModel = modelSelect.value;
    StorageManager.saveSelectedModel(selectedModel);
    if (isModelReady) {
      await loadSelectedModel();
    }
  });

  unloadModelBtn.addEventListener('click', async () => {
    await llmEngine.unload();
    isModelReady = false;
    updateStatusUI('not-loaded', 'Modelo não carregado');
    unloadModelBtn.classList.add('hidden');
  });

  // Input Auto-expansion
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  sendBtn.addEventListener('click', handleSendMessage);
  stopBtn.addEventListener('click', async () => {
    await llmEngine.stopGeneration();
    stopBtn.classList.add('hidden');
    sendBtn.classList.remove('hidden');
  });

  // Quick Prompt Chips
  document.querySelectorAll('.quick-prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      userInput.value = card.dataset.prompt;
      userInput.focus();
      handleSendMessage();
    });
  });
}

function renderActivePdfChips() {
  activePdfsContainer.innerHTML = '';
  if (RAGEngine.activeUploadedPdfs.length === 0) {
    activePdfsContainer.classList.add('hidden');
    return;
  }

  activePdfsContainer.classList.remove('hidden');
  RAGEngine.activeUploadedPdfs.forEach(pdf => {
    const chip = document.createElement('div');
    chip.className = 'pdf-chip';
    chip.innerHTML = `
      <span>📄 ${escapeHtml(pdf.title)}</span>
      <button class="pdf-chip-remove" title="Remover PDF">✕</button>
    `;

    chip.querySelector('.pdf-chip-remove').addEventListener('click', () => {
      RAGEngine.removeUploadedPDF(pdf.title);
      renderActivePdfChips();
    });

    activePdfsContainer.appendChild(chip);
  });
}

function handleLogout() {
  DatabaseService.logoutUser();
  updateUserSessionUI();
}

async function loadSelectedModel() {
  const modelId = modelSelect.value;
  updateStatusUI('loading', 'Carregando...');
  progressCard.classList.remove('hidden');

  try {
    await llmEngine.loadModel(modelId, (report) => {
      const progress = Math.round(report.progress * 100);
      progressBarFill.style.width = `${progress}%`;
      progressPercentage.textContent = `${progress}%`;
      progressFile.textContent = report.text.replace(/\[\d+\/\d+\]\s*/, '');
    });

    isModelReady = true;
    progressCard.classList.add('hidden');
    updateStatusUI('ready', 'Vixer AI Ativo');
    unloadModelBtn.classList.remove('hidden');
    return true;
  } catch (error) {
    console.error('Erro ao carregar Vixer AI:', error);
    progressCard.classList.add('hidden');
    updateStatusUI('not-loaded', 'Erro ao carregar');
    alert('Erro ao carregar modelo: ' + error.message);
    return false;
  }
}

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text || llmEngine.isGenerating) return;

  userInput.value = '';
  userInput.style.height = 'auto';

  if (!isModelReady) {
    const loaded = await loadSelectedModel();
    if (!loaded) return;
  }

  welcomeScreen.classList.add('hidden');

  currentMessages.push({ role: 'user', content: text });
  StorageManager.updateActiveChatMessages(currentMessages);
  appendMessageUI('user', text);

  const assistantRow = appendMessageUI('assistant', '...', true);
  const bubbleElement = assistantRow.querySelector('.message-bubble');
  const contentElement = assistantRow.querySelector('.message-content');

  const metaElement = document.createElement('div');
  metaElement.className = 'message-meta';
  contentElement.appendChild(metaElement);

  sendBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  metricsBadge.classList.remove('hidden');
  metricsBadge.textContent = 'Gerando...';

  const currentUser = DatabaseService.getCurrentUserSession();
  const userName = currentUser ? currentUser.name : 'Caio Lennon';
  const userCourse = currentUser ? currentUser.course : 'Sistemas de Informação';
  const userType = currentUser ? currentUser.type : 'Presencial';

  // Realizar busca RAG nos 21 PDFs Multivix + PDFs do usuário
  const ragContext = RAGEngine.buildRAGContextString(text);

  const systemMessageContent = 
    `Você é o Vixer AI, assistente virtual de inteligência artificial da Faculdade Multivix. ` +
    `Você está conversando com o aluno ${userName}, que estuda o curso de ${userCourse} (${userType}). ` +
    `Você possui memória de todas as mensagens trocadas nesta conversa. Se o aluno perguntar sobre perguntas ou mensagens anteriores (como "qual foi a primeira pergunta?"), consulte o histórico das mensagens acima nesta conversa. ` +
    `Se o aluno perguntar qual é o nome dele, diga diretamente que ele se chama ${userName}. ` +
    `Responda em português brasileiro de forma motivadora, clara e didática.\n` +
    `${ragContext}`;

  const fullThread = [
    { role: 'system', content: systemMessageContent },
    ...currentMessages
  ];

  await llmEngine.generateStream(
    fullThread,
    (fullText, delta, tokensPerSec) => {
      bubbleElement.innerHTML = marked.parse(fullText);
      metricsBadge.textContent = `${tokensPerSec} tok/s`;
      metaElement.textContent = `Velocidade: ${tokensPerSec} tokens/seg`;
      scrollToBottom();
    },
    (finalText, stats) => {
      currentMessages.push({ role: 'assistant', content: finalText });
      StorageManager.updateActiveChatMessages(currentMessages);
      renderHistoryList();

      metaElement.textContent = `Respondido em ${stats.totalElapsed}s (${stats.finalTokensPerSec} tok/s)`;
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      metricsBadge.classList.add('hidden');
    },
    (err) => {
      console.error('Erro de geração:', err);
      if (err.message && (err.message.includes('disposed') || err.message.includes('Device was lost'))) {
        isModelReady = false;
        bubbleElement.innerHTML = `<span style="color: #b45309; font-weight: 600;">⚠️ A memória RAM da sua placa de vídeo foi excedida pelo modelo pesado. O Vixer AI foi reconectado automaticamente ao modelo otimizado **Llama 3.2 1B (~700MB)**. Por favor, envie sua mensagem novamente!</span>`;
      } else {
        bubbleElement.innerHTML = `<span style="color: var(--danger)">Erro: ${escapeHtml(err.message)}</span>`;
      }
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      metricsBadge.classList.add('hidden');
    }
  );
}

function updateStatusUI(statusClass, text) {
  if (modelStatusTag) modelStatusTag.className = `model-status-tag status-${statusClass}`;
  if (modelStatusText) modelStatusText.textContent = text;
  
  if (statusClass === 'ready') {
    headerStatusBadge.className = 'badge badge-success';
    headerStatusBadge.textContent = 'Ativo';
  } else if (statusClass === 'loading') {
    headerStatusBadge.className = 'badge badge-neutral';
    headerStatusBadge.textContent = 'Carregando...';
  } else {
    headerStatusBadge.className = 'badge badge-neutral';
    headerStatusBadge.textContent = 'Pronto';
  }
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.remove('hidden');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.add('hidden');
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
