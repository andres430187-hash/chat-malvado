var chat = document.getElementById('chat');
var form = document.getElementById('form');
var input = document.getElementById('input');
var sendBtn = document.getElementById('send');
var cfgModal = document.getElementById('cfgModal');
var apiKeyInput = document.getElementById('apiKey');
var modelSelect = document.getElementById('model');
var providerSelect = document.getElementById('provider');
var keyLabel = document.getElementById('keyLabel');

var history = [];
var busy = false;

apiKeyInput.value = localStorage.getItem('malvado_key') || '';
modelSelect.value = localStorage.getItem('malvado_model') || 'llama-3.3-70b-versatile';
providerSelect.value = localStorage.getItem('malvado_provider') || 'groq';

function syncKeyHint() {
  if (providerSelect.value === 'openrouter') {
    keyLabel.textContent = 'API Key de OpenRouter (openrouter.ai/keys)';
    apiKeyInput.placeholder = 'sk-or-...';
  } else {
    keyLabel.textContent = 'API Key de Groq (console.groq.com/keys)';
    apiKeyInput.placeholder = 'gsk_...';
  }
}
syncKeyHint();
providerSelect.addEventListener('change', syncKeyHint);

document.getElementById('cfgBtn').onclick = function () { cfgModal.classList.remove('hidden'); };
document.getElementById('closeCfg').onclick = function () { cfgModal.classList.add('hidden'); };

document.getElementById('saveCfg').onclick = function () {
  localStorage.setItem('malvado_key', apiKeyInput.value.trim());
  localStorage.setItem('malvado_model', modelSelect.value);
  localStorage.setItem('malvado_provider', providerSelect.value);
  cfgModal.classList.add('hidden');
  addMsg('bot', 'Configuracion guardada.');
};

function addMsg(role, text) {
  var div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.onsubmit = async function (e) {
  e.preventDefault();
  if (busy) return;
  var text = input.value.trim();
  if (!text) return;

  var key = localStorage.getItem('malvado_key');
  if (!key) { cfgModal.classList.remove('hidden'); return; }

  addMsg('user', text);
  history.push({ role: 'user', content: text });
  input.value = '';
  sendBtn.disabled = true;
  busy = true;

  var typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.textContent = '...';
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;

  try {
    var r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        apiKey: key,
        model: localStorage.getItem('malvado_model'),
        provider: localStorage.getItem('malvado_provider') || 'groq'
      })
    });
    var data = await r.json();
    typing.remove();
    if (!r.ok || data.error) throw new Error(data.error || 'Error');
    addMsg('bot', data.reply);
    history.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    typing.remove();
    addMsg('err', 'Error: ' + err.message);
    history.pop();
  } finally {
    sendBtn.disabled = false;
    busy = false;
    input.focus();
  }
};

addMsg('bot', 'Configura tu API key con el boton Ajustes (gratis en console.groq.com/keys).');
