/* Campo de assinatura na tela (dedo, caneta ou mouse). Guarda o traço como pontos relativos
   ao tamanho do campo e gera uma imagem PNG de tamanho fixo, para o PDF sair sempre igual. */
const Assinatura = (function () {
  'use strict';

  const LARGURA_SAIDA = 600;
  const ALTURA_SAIDA = 200;
  const ESPESSURA_TELA = 2.5;
  const ESPESSURA_SAIDA = 5;

  /* Liga um campo <canvas id="..."> e o botão [data-limpar="..."] correspondente. */
  function iniciar(id, aoMudar) {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d');
    const tracos = [];
    let atual = null;

    function tamanho() {
      return canvas.getBoundingClientRect();
    }

    function desenhar(traco, largura, altura, espessura, destino) {
      destino.lineWidth = espessura;
      destino.lineCap = 'round';
      destino.lineJoin = 'round';
      destino.strokeStyle = '#111';
      destino.beginPath();
      traco.forEach((p, i) => {
        const x = p.x * largura;
        const y = p.y * altura;
        if (i) destino.lineTo(x, y);
        else destino.moveTo(x, y);
      });
      destino.stroke();
    }

    function redesenhar() {
      const r = tamanho();
      ctx.clearRect(0, 0, r.width, r.height);
      tracos.forEach((t) => desenhar(t, r.width, r.height, ESPESSURA_TELA, ctx));
    }

    function ajustar() {
      const r = tamanho();
      const escala = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * escala));
      canvas.height = Math.max(1, Math.round(r.height * escala));
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      redesenhar();
    }

    function posicao(evento) {
      const r = tamanho();
      return {
        x: Math.min(1, Math.max(0, (evento.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (evento.clientY - r.top) / r.height)),
      };
    }

    canvas.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      canvas.setPointerCapture(evento.pointerId);
      atual = [posicao(evento)];
      tracos.push(atual);
      redesenhar();
    });

    canvas.addEventListener('pointermove', (evento) => {
      if (!atual) return;
      atual.push(posicao(evento));
      redesenhar();
    });

    const terminar = () => {
      if (!atual) return;
      atual = null;
      if (aoMudar) aoMudar();
    };
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', terminar);

    window.addEventListener('resize', ajustar);

    const limpar = () => {
      tracos.length = 0;
      atual = null;
      redesenhar();
      if (aoMudar) aoMudar();
    };
    const botao = document.querySelector(`[data-limpar="${id}"]`);
    if (botao) botao.addEventListener('click', limpar);

    ajustar();

    return {
      /* Imagem PNG (data URL) ou texto vazio se não houve traço. */
      dataUrl() {
        if (!tracos.length) return '';
        const saida = document.createElement('canvas');
        saida.width = LARGURA_SAIDA;
        saida.height = ALTURA_SAIDA;
        const contexto = saida.getContext('2d');
        contexto.lineCap = 'round';
        contexto.lineJoin = 'round';
        tracos.forEach((t) => desenhar(t, LARGURA_SAIDA, ALTURA_SAIDA, ESPESSURA_SAIDA, contexto));
        return saida.toDataURL('image/png');
      },
      limpar,
      temTraco() {
        return tracos.length > 0;
      },
    };
  }

  return { iniciar };
})();
