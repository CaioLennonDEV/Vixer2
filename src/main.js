import { marked } from 'marked';
import hljs from 'highlight.js';
import { LLMEngine } from './webllm.js';
import { StorageManager } from './storage.js';

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

// Custom marked renderer to inject Copy Code Button
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
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const newChatBtn = document.getElementById('new-chat-btn');
const modelSelect = document.getElementById('model-select');
const activeModelTitle = document.getElementById('active-model-title');
const modelStatusTag = document.getElementById('model-status-tag');
const modelStatusText = document.getElementById('model-status-text');
const systemPromptInput = document.getElementById('system-prompt-input');
const chatHistoryList = document.getElementById('chat-history-list');
const headerStatusBadge = document.getElementById('header-status-badge');
const unloadModelBtn = document.getElementById('unload-model-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
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

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check WebGPU Support
  const hasWebGPU = LLMEngine.checkWebGPUSupport();
  if (!hasWebGPU) {
    webgpuModal.classList.remove('hidden');
    document.getElementById('gpu-badge').textContent = 'Sem WebGPU';
    document.getElementById('gpu-badge').className = 'badge badge-neutral';
  }

  // 2. Restore Saved Preferences
  const savedModel = StorageManager.getSelectedModel();
  if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  }
  updateModelTitleDisplay(modelSelect.value);

  systemPromptInput.value = StorageManager.getSystemPrompt();

  // 3. Load or Create Active Chat Session
  initChatSession();

  // 4. Attach Event Listeners
  setupEventListeners();
});

function updateModelTitleDisplay(modelId) {
  const selectedOption = modelSelect.querySelector(`option[value="${modelId}"]`);
  if (selectedOption) {
    // Extract human-friendly name
    const rawText = selectedOption.textContent.split('(')[0].trim();
    activeModelTitle.textContent = rawText;
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
      <span class="history-item-title">${escapeHtml(chat.title)}</span>
      <button class="icon-btn delete-chat-btn" title="Excluir conversa">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-chat-btn')) {
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
  // Clear messages container keeping welcome screen
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
  if (animate) {
    scrollToBottom();
  }
  return row;
}

function setupEventListeners() {
  // Mobile Sidebar Toggles
  openSidebarBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Close Warning Modal
  closeWarningBtn.addEventListener('click', () => {
    webgpuModal.classList.add('hidden');
  });

  // New Chat
  newChatBtn.addEventListener('click', () => {
    StorageManager.createNewChat();
    initChatSession();
    closeSidebar();
  });

  // Clear Chat
  clearChatBtn.addEventListener('click', () => {
    currentMessages = [];
    StorageManager.updateActiveChatMessages([]);
    renderMessages();
  });

  // System Prompt Auto Save
  systemPromptInput.addEventListener('change', () => {
    StorageManager.saveSystemPrompt(systemPromptInput.value);
  });

  // Model Selection Changed
  modelSelect.addEventListener('change', async () => {
    const selectedModel = modelSelect.value;
    StorageManager.saveSelectedModel(selectedModel);
    updateModelTitleDisplay(selectedModel);

    if (isModelReady) {
      // Trigger reloading new model when user requests
      await loadSelectedModel();
    }
  });

  // Unload Model
  unloadModelBtn.addEventListener('click', async () => {
    await llmEngine.unload();
    isModelReady = false;
    updateStatusUI('not-loaded', 'Modelo descarregado');
    unloadModelBtn.classList.add('hidden');
  });

  // Auto-expanding Input
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
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
      const prompt = card.dataset.prompt;
      userInput.value = prompt;
      userInput.focus();
      handleSendMessage();
    });
  });
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

      // Clean display text
      progressFile.textContent = report.text.replace(/\[\d+\/\d+\]\s*/, '');
    });

    isModelReady = true;
    progressCard.classList.add('hidden');
    updateStatusUI('ready', 'Modelo Pronto');
    unloadModelBtn.classList.remove('hidden');
    return true;
  } catch (error) {
    console.error('Erro ao carregar o modelo:', error);
    progressCard.classList.add('hidden');
    updateStatusUI('not-loaded', 'Erro ao carregar');
    alert('Erro ao carregar o modelo WebLLM: ' + error.message);
    return false;
  }
}

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text || llmEngine.isGenerating) return;

  // Clear input
  userInput.value = '';
  userInput.style.height = 'auto';

  // Ensure model is loaded first
  if (!isModelReady) {
    const loaded = await loadSelectedModel();
    if (!loaded) return;
  }

  welcomeScreen.classList.add('hidden');

  // Append user message
  currentMessages.push({ role: 'user', content: text });
  StorageManager.updateActiveChatMessages(currentMessages);
  appendMessageUI('user', text);

  // Prepare Assistant UI streaming bubble
  const assistantRow = appendMessageUI('assistant', '...', true);
  const bubbleElement = assistantRow.querySelector('.message-bubble');
  const contentElement = assistantRow.querySelector('.message-content');

  // Add metrics container
  const metaElement = document.createElement('div');
  metaElement.className = 'message-meta';
  contentElement.appendChild(metaElement);

  sendBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  metricsBadge.classList.remove('hidden');
  metricsBadge.textContent = 'Gerando...';

  // Build full message thread with system prompt
  const fullThread = [
    { role: 'system', content: systemPromptInput.value || StorageManager.getSystemPrompt() },
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

      metaElement.textContent = `Concluído em ${stats.totalElapsed}s (${stats.finalTokensPerSec} tok/s)`;
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      metricsBadge.classList.add('hidden');
    },
    (err) => {
      console.error('Erro de geração:', err);
      bubbleElement.innerHTML = `<span style="color: var(--danger)">Erro durante a geração: ${escapeHtml(err.message)}</span>`;
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      metricsBadge.classList.add('hidden');
    }
  );
}

function updateStatusUI(statusClass, text) {
  modelStatusTag.className = `model-status-tag status-${statusClass}`;
  modelStatusText.textContent = text;
  
  if (statusClass === 'ready') {
    headerStatusBadge.className = 'badge badge-success';
    headerStatusBadge.textContent = 'Modelo Ativo';
  } else if (statusClass === 'loading') {
    headerStatusBadge.className = 'badge badge-neutral';
    headerStatusBadge.textContent = 'Baixando...';
  } else {
    headerStatusBadge.className = 'badge badge-neutral';
    headerStatusBadge.textContent = 'Pronto para carregar';
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
