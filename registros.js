/* Envia o contrato ao servidor de registros. Sem conexão, guarda o envio na fila do navegador
   e tenta de novo na próxima vez que a página abrir. O PDF continua funcionando sem isso. */
const Registros = (function () {
  'use strict';

  const URL_SALVAR = 'https://lz-registros.netlify.app/.netlify/functions/salvar';
  const CHAVE_FILA = 'lz-registros-pendentes';

  function lerFila() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_FILA)) || [];
    } catch (erro) {
      return [];
    }
  }

  function gravarFila(fila) {
    try {
      localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
    } catch (erro) {
      /* Armazenamento cheio ou bloqueado: o envio atual ainda é tentado. */
    }
  }

  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  async function enviarUm(item) {
    const resposta = await fetch(URL_SALVAR, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
      keepalive: true,
    });
    if (!resposta.ok) throw new Error('resposta');
  }

  /* Retorna true se o servidor confirmou. Se não, o item fica na fila. */
  async function enviar(tipo, dados) {
    const item = { tipo, idCliente: novoId(), criadoEm: new Date().toISOString(), dados };
    try {
      await enviarUm(item);
      return true;
    } catch (erro) {
      gravarFila([...lerFila(), item]);
      return false;
    }
  }

  /* Reenvia o que ficou pendente. Como o idCliente é fixo, reenviar não duplica. */
  async function reenviarPendentes() {
    const fila = lerFila();
    if (!fila.length) return 0;
    const restantes = [];
    for (const item of fila) {
      try {
        await enviarUm(item);
      } catch (erro) {
        restantes.push(item);
      }
    }
    gravarFila(restantes);
    return fila.length - restantes.length;
  }

  return { enviar, reenviarPendentes };
})();
