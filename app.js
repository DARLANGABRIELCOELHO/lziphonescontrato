/* Liga o formulario a folha do contrato: le os campos, confere, pagina e imprime. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const documento = $('documento');
  const CHAVE_CNPJ = 'lz-contratos-cnpj';

  const FORMAS = {
    cartao: { rotulo: 'Cartão', frase: 'com cartão' },
    pix: { rotulo: 'Pix', frase: 'via Pix' },
    dinheiro: { rotulo: 'Dinheiro', frase: 'em dinheiro' },
    transferencia: { rotulo: 'Transferência', frase: 'por transferência' },
    troca: { rotulo: 'Aparelho na troca', frase: 'com aparelho usado na troca' },
  };

  const SEM_TROCA = 'Não houve aparelho entregue como parte do pagamento.';

  /* Mascaras */

  const digitos = (texto) => texto.replace(/\D/g, '');

  const mascaras = {
    cpf(t) {
      const d = digitos(t).slice(0, 11);
      return d
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
    },
    celular(t) {
      const d = digitos(t).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : '';
      const corte = d.length === 11 ? 7 : 6;
      if (d.length <= corte) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
    },
    imei(t) {
      const d = digitos(t).slice(0, 15);
      return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 14), d.slice(14)]
        .filter(Boolean)
        .join(' ');
    },
    moeda(t) {
      const centavos = parseInt(digitos(t) || '0', 10);
      return centavos ? formatarCentavos(centavos) : '';
    },
    bateria(t) {
      return digitos(t).slice(0, 3);
    },
  };

  function formatarCentavos(centavos) {
    const reais = Math.floor(centavos / 100);
    const resto = String(centavos % 100).padStart(2, '0');
    return `${String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${resto}`;
  }

  const centavosDe = (campo) => parseInt(digitos(campo.value) || '0', 10);

  /* Conferencias */

  function cpfValido(valor) {
    const d = digitos(valor);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (const tamanho of [9, 10]) {
      let soma = 0;
      for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
      const digito = ((soma * 10) % 11) % 10;
      if (digito !== Number(d[tamanho])) return false;
    }
    return true;
  }

  function imeiValido(valor) {
    const d = digitos(valor);
    if (d.length !== 15) return false;
    let soma = 0;
    for (let i = 0; i < 15; i++) {
      let n = Number(d[i]);
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      soma += n;
    }
    return soma % 10 === 0;
  }

  /* Datas: trabalha com ano, mes e dia para nao sofrer com fuso horario. */

  function dataBr(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function somarDias(iso, dias) {
    const [ano, mes, dia] = iso.split('-').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
    return data.toISOString().slice(0, 10);
  }

  function hojeIso() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${agora.getFullYear()}-${mes}-${dia}`;
  }

  /* Leitura do formulario */

  const marcados = (nome) =>
    [...form.querySelectorAll(`input[name="${nome}"]:checked`)].map((c) => c.value);

  function lerDados() {
    const texto = (id) => $(id).value.trim();

    const preco = centavosDe($('preco'));
    const desconto = centavosDe($('desconto'));
    const total = Math.max(preco - desconto, 0);

    const formas = marcados('forma');
    const detalhe = texto('detalhe');
    const rotulos = formas.map((f) => FORMAS[f].rotulo).join(' + ');
    const temTroca = formas.includes('troca');

    const acessorios = marcados('acessorio');
    const outros = texto('outros');
    if (outros) acessorios.push(outros);

    const recebimento = $('recebimento').value;
    const bateria = texto('bateria');

    return {
      nome: texto('nome'),
      cpf: texto('cpf'),
      endereco: texto('endereco'),
      cidade: texto('cidade'),
      celular: texto('celular'),
      email: texto('email'),
      modelo: texto('modelo'),
      serie: texto('serie'),
      imei1: texto('imei1'),
      imei2: texto('imei2'),
      bateriaTexto: bateria ? `${bateria}%` : '',
      condicao: marcados('condicao')[0] || '',
      acessorios,
      acessoriosTexto: acessorios.length ? Contrato.lista(acessorios) : 'nenhum',
      descontoTexto: desconto ? `R$ ${formatarCentavos(desconto)}` : '',
      totalTexto: preco ? `R$ ${formatarCentavos(total)}` : '',
      formaTexto: rotulos && detalhe ? `${rotulos} (${detalhe})` : rotulos,
      pagosTexto: Contrato.lista(formas.map((f) => FORMAS[f].frase)),
      pagoComCartao: formas.includes('cartao'),
      negociacao: temTroca ? texto('troca') : SEM_TROCA,
      dataTexto: dataBr($('data').value),
      recebimentoTexto: dataBr(recebimento),
      fimGarantiaTexto: recebimento
        ? dataBr(somarDias(recebimento, Contrato.GARANTIA_DIAS))
        : '',
      cnpj: texto('cnpj'),
      formas,
      temTroca,
      preco,
      desconto,
      arquivo: nomeArquivo(texto('nome'), $('data').value),
    };
  }

  function nomeArquivo(nome, dataIso) {
    const partes = nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z ]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const cliente =
      partes.length > 1 ? `${partes[0]}_${partes[partes.length - 1]}` : partes[0] || 'CLIENTE';
    const data = dataBr(dataIso).replace(/\//g, '-');
    return `CONTRATO_LZ_${cliente}_${data}_COM_CLAUSULAS`;
  }

  /* Avisos */

  function mostrarAviso(id, mensagem) {
    const aviso = $(`${id}-aviso`);
    aviso.textContent = mensagem;
    aviso.closest('.campo').classList.toggle('com-erro', Boolean(mensagem));
  }

  function conferir(d) {
    const falta = [];
    const exige = (valor, rotulo) => {
      if (!valor) falta.push(rotulo);
    };
    exige(d.nome, 'nome');
    exige(d.cpf, 'CPF');
    exige(d.modelo, 'modelo');
    exige(d.imei1, 'IMEI 1');
    exige(d.bateriaTexto, 'saúde da bateria');
    exige(d.preco, 'preço');
    exige(d.formas.length, 'forma de pagamento');
    exige(d.dataTexto, 'data da venda');
    exige(d.recebimentoTexto, 'data de recebimento');
    if (d.temTroca) exige(d.negociacao, 'aparelho recebido na troca');

    const erros = [];
    const avisa = (id, condicao, mensagem) => {
      mostrarAviso(id, condicao ? mensagem : '');
      if (condicao) erros.push(mensagem);
    };
    avisa('cpf', d.cpf && !cpfValido(d.cpf), 'CPF inválido. Confira os números.');
    avisa('imei1', d.imei1 && !imeiValido(d.imei1), 'IMEI 1 inválido. Confira os 15 números.');
    avisa('imei2', d.imei2 && !imeiValido(d.imei2), 'IMEI 2 inválido. Confira os 15 números.');
    avisa('bateria', Number(digitos(d.bateriaTexto)) > 100, 'A bateria vai até 100%.');
    avisa('desconto', d.preco && d.desconto >= d.preco, 'O desconto precisa ser menor que o preço.');

    return { falta, erros };
  }

  /* Previa: desenha em SVG as mesmas folhas que vao para o PDF. */

  const escapar = (texto) =>
    texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const n = (valor) => Number(valor.toFixed(3));

  function opParaSvg(op) {
    if (op.tipo === 'texto') {
      const classes = [op.negrito && 'b', op.valor && 'v'].filter(Boolean).join(' ');
      return `<text x="${n(op.x)}" y="${n(op.y)}" font-size="${op.tamanho}" class="${classes}">${escapar(op.texto)}</text>`;
    }
    if (op.tipo === 'linha') {
      return `<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="#000" stroke-width="${op.espessura}"/>`;
    }
    if (op.tipo === 'fundo') {
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.largura)}" height="${n(op.altura)}" fill="#f2f2f2"/>`;
    }
    if (op.tipo === 'contorno') {
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.largura)}" height="${n(op.altura)}" fill="none" stroke="#000" stroke-width="${op.espessura}"/>`;
    }
    return `<image href="assets/logo.jpg" x="${n(op.x)}" y="${n(op.y)}" width="${n(op.largura)}" height="${n(op.altura)}"/>`;
  }

  function folhasEmSvg(contrato) {
    const { largura, altura } = Contrato.FOLHA;
    return contrato.folhas
      .map((folha) => `<svg class="folha" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Folha do contrato">${folha.ops.map(opParaSvg).join('')}</svg>`)
      .join('');
  }

  let contrato = null;
  let situacao = { falta: [], erros: [] };

  function mostrarPendencias() {
    const { falta, erros } = situacao;
    const linhaStatus = $('pendencias');
    const partes = [];
    if (falta.length) partes.push(`Falta preencher: ${falta.join(', ')}.`);
    partes.push(...erros);
    linhaStatus.classList.toggle('pronto', !partes.length);
    linhaStatus.textContent = partes.length
      ? partes.join(' ')
      : 'Contrato pronto. O PDF vai para os seus downloads.';
  }

  function atualizar() {
    const d = lerDados();
    $('total').textContent = `R$ ${formatarCentavos(Math.max(d.preco - d.desconto, 0))}`;
    $('troca-campo').hidden = !d.temTroca;
    $('garantia').textContent = d.fimGarantiaTexto
      ? `Garantia de 90 dias: até ${d.fimGarantiaTexto}.`
      : '';

    contrato = Contrato.montar(d);
    documento.innerHTML = folhasEmSvg(contrato);

    situacao = conferir(d);
    if (contrato.estourou) {
      situacao.erros.push('O texto da troca não cabe na primeira página. Encurte a descrição.');
    }
    mostrarPendencias();
  }

  /* Acoes */

  async function gerarPdf() {
    atualizar();
    if (situacao.falta.length || situacao.erros.length) {
      const primeiro = form.querySelector('.com-erro input') ||
        [...form.querySelectorAll('[required]')].find((c) => !c.value.trim());
      if (primeiro) primeiro.focus();
      return;
    }

    const botao = $('gerar');
    const arquivo = lerDados().arquivo;
    botao.disabled = true;
    botao.textContent = 'Gerando PDF...';
    try {
      PdfContrato.baixar(await PdfContrato.montar(contrato, arquivo), arquivo);
      $('pendencias').textContent = `PDF gerado: ${arquivo}.pdf`;
    } catch (erro) {
      $('pendencias').classList.remove('pronto');
      $('pendencias').textContent = 'O PDF não foi gerado. Recarregue a página e tente de novo.';
    } finally {
      botao.disabled = false;
      botao.textContent = 'Gerar PDF';
    }
  }

  function limpar() {
    const cnpj = $('cnpj').value;
    form.reset();
    $('cnpj').value = cnpj;
    $('data').value = hojeIso();
    $('recebimento').value = hojeIso();
    recebimentoEditado = false;
    atualizar();
    $('nome').focus();
  }

  let recebimentoEditado = false;

  form.addEventListener('submit', (evento) => evento.preventDefault());

  form.addEventListener('input', (evento) => {
    const campo = evento.target;
    if (campo.id === 'cpf') campo.value = mascaras.cpf(campo.value);
    if (campo.id === 'celular') campo.value = mascaras.celular(campo.value);
    if (campo.id === 'imei1' || campo.id === 'imei2') campo.value = mascaras.imei(campo.value);
    if (campo.id === 'bateria') campo.value = mascaras.bateria(campo.value);
    if (campo.classList.contains('moeda')) campo.value = mascaras.moeda(campo.value);
    if (campo.id === 'recebimento') recebimentoEditado = true;
    if (campo.id === 'data' && !recebimentoEditado) $('recebimento').value = campo.value;
    if (campo.id === 'cnpj') guardarCnpj(campo.value);
    atualizar();
  });

  function guardarCnpj(valor) {
    try {
      localStorage.setItem(CHAVE_CNPJ, valor);
    } catch (erro) {
      /* Sem armazenamento, o campo so nao fica lembrado. */
    }
  }

  function lerCnpj() {
    try {
      return localStorage.getItem(CHAVE_CNPJ) || '';
    } catch (erro) {
      return '';
    }
  }

  $('gerar').addEventListener('click', gerarPdf);
  $('novo').addEventListener('click', () => {
    if (window.confirm('Apagar os dados desta venda?')) limpar();
  });

  $('cnpj').value = lerCnpj();
  $('data').value = hojeIso();
  $('recebimento').value = hojeIso();
  atualizar();
  /* Adianta o carregamento para o botao responder na hora; se falhar, tenta de novo ao gerar. */
  PdfContrato.preparar().catch(() => {});
})();
