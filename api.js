// Conversa com o servidor do app (serve.py): conta, faixas e progressões.
// Se o app estiver num servidor só de arquivos (sem API), `temServidor` fica falso e o resto do app funciona igual.
const H = { 'X-Braco': '1' }; // o servidor recusa pedidos que mudam dados sem este cabeçalho
export let temServidor = false;

async function req(metodo, rota, corpo, extra = {}) {
  const op = { method: metodo, headers: { ...H, ...extra }, credentials: 'same-origin', cache: 'no-store' };
  if (corpo instanceof Blob) op.body = corpo;
  else if (corpo !== undefined) { op.body = JSON.stringify(corpo); op.headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(rota, op); } catch { throw Object.assign(new Error('Sem conexão com o servidor do app.'), { status: 0 }); }
  const tipo = r.headers.get('Content-Type') || '';
  const dados = tipo.includes('application/json') ? await r.json() : null;
  if (!r.ok || !dados) throw Object.assign(new Error((dados && dados.erro) || 'O servidor não respondeu como esperado.'), { status: r.status });
  return dados;
}

export async function estado() {
  try { const d = await req('GET', '/api/estado'); temServidor = true; return d; }
  catch { temServidor = false; return { usuario: null, cadastro: false }; }
}
export const entrar = (email, senha) => req('POST', '/api/entrar', { email, senha });
export const cadastrar = (nome, email, senha) => req('POST', '/api/cadastro', { nome, email, senha });
export const sair = () => req('POST', '/api/sair', {});
export const trocarSenha = (atual, nova) => req('POST', '/api/senha', { atual, nova });

export const faixas = () => req('GET', '/api/faixas');
// `pasta` = onde guardar, com '/' entre as pastas ('A maior/Blues'). WAV é diminuído pelo servidor.
export function enviarFaixa(arquivo, pasta) {
  const q = new URLSearchParams({ arquivo: arquivo.name, pasta: pasta || '' });
  return req('POST', '/api/faixas?' + q, arquivo, { 'Content-Type': arquivo.type || 'application/octet-stream' });
}
export const moverPasta = (de, para) => req('POST', '/api/pastas/mover', { de, para });
export const apagarPasta = pasta => req('POST', '/api/pastas/apagar', { pasta });
export const mudarFaixa = (id, dados) => req('PATCH', `/api/faixas/${id}`, dados);
export const apagarFaixa = id => req('DELETE', `/api/faixas/${id}`);
export const audioUrl = id => `/api/faixas/${id}/audio`;

export const lerProgs = () => req('GET', '/api/progressoes');
export const gravarProgs = lista => req('PUT', '/api/progressoes', { progressoes: lista });
