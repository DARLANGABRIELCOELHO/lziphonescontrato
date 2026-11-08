/* Diagrama o contrato a partir dos dados do formulario. Calcula a posicao de cada
   palavra com as larguras reais da fonte (metricas.js), sem perguntar nada ao
   navegador: assim a previa e o PDF saem iguais em computador e celular.
   As medidas estao em pontos, com y a partir do topo, e vem do contrato original. */
(function (global) {
  'use strict';

  const LOJA = {
    nome: 'LZ IPHONES',
    endereco: 'Rua Conselheiro Antônio Prado, 291',
    cidade: 'Boituva - SP  |  CEP 18.550-010',
    instagram: '@_lziphones',
    foro: 'Boituva - SP',
  };

  const GARANTIA_DIAS = 90;
  const FOLHA = { largura: 595.28, altura: 841.89 };
  const CENTRO = 297.75;
  const LIMITE = 813.75;

  const NB = ' ';
  const nb = (texto) => texto.replace(/ /g, NB);

  const lista = (itens) => {
    if (itens.length < 2) return itens.join('');
    return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
  };

  /* Trechos de texto */

  const T = (texto) => ({ texto });
  const B = (texto) => ({ texto, negrito: true });
  /* Valor digitado (azul na previa); sem valor, sai a linha para preencher a caneta. */
  const V = (valor, linha = 0, negrito = false) =>
    valor ? { texto: valor, valor: true, negrito } : { texto: '_'.repeat(linha), negrito };
  const ESPACOS = (quantidade) => ({ espacos: quantidade });
  const FOLGA = (largura) => ({ folga: largura });
  const CAIXA = (marcada) => ({ caixa: true, marcada });

  /* Medida e quebra de linha */

  function largura(texto, negrito, tamanho) {
    const fonte = negrito ? global.Metricas.negrito : global.Metricas.regular;
    let soma = 0;
    for (const letra of texto) {
      const medida = fonte.larguras[letra.codePointAt(0)];
      soma += medida === undefined ? fonte.padrao : medida;
    }
    return (soma / fonte.unidades) * tamanho;
  }

  const LARGURA_CAIXA = 11.79;

  /* Agrupa os trechos em blocos que nao podem ser separados por quebra de linha. */
  function separar(trechos, tamanho) {
    const espaco = largura(' ', false, tamanho);
    const grupos = [];
    let pecas = [];
    let antes = null;

    const fechar = (proximo) => {
      if (pecas.length) {
        grupos.push({ pecas, antes });
        pecas = [];
        antes = null;
      }
      antes = { largura: (antes ? antes.largura : 0) + proximo.largura, estica: proximo.estica };
    };

    for (const trecho of trechos) {
      if (trecho.espacos) {
        fechar({ largura: espaco * trecho.espacos, estica: false });
      } else if (trecho.folga) {
        pecas.push({ largura: trecho.folga });
      } else if (trecho.caixa) {
        pecas.push({ caixa: true, marcada: trecho.marcada, largura: LARGURA_CAIXA });
      } else {
        for (const parte of trecho.texto.split(/( | )/)) {
          if (parte === ' ') fechar({ largura: espaco, estica: true });
          else if (parte === NB) pecas.push({ cola: true, largura: espaco });
          else if (parte) {
            pecas.push({
              texto: parte,
              negrito: trecho.negrito,
              valor: trecho.valor,
              largura: largura(parte, trecho.negrito, tamanho),
            });
          }
        }
      }
    }
    fechar({ largura: 0 });
    return grupos;
  }

  const larguraGrupo = (grupo) => grupo.pecas.reduce((soma, peca) => soma + peca.largura, 0);

  /* Texto sem espacos maior que a linha (e-mail longo) e cortado letra a letra. */
  function dividirLongo(grupo, maximo, tamanho) {
    const partes = [];
    let pecas = [];
    let usado = 0;

    for (const peca of grupo.pecas) {
      const letras = peca.texto ? [...peca.texto] : [null];
      for (const letra of letras) {
        const medida = letra ? largura(letra, peca.negrito, tamanho) : peca.largura;
        if (usado + medida > maximo && pecas.length) {
          partes.push({ pecas, antes: partes.length ? null : grupo.antes });
          pecas = [];
          usado = 0;
        }
        const ultima = pecas[pecas.length - 1];
        if (letra && ultima && ultima.texto && ultima.negrito === peca.negrito && ultima.valor === peca.valor) {
          ultima.texto += letra;
          ultima.largura += medida;
        } else {
          pecas.push(letra ? { ...peca, texto: letra, largura: medida } : peca);
        }
        usado += medida;
      }
    }
    partes.push({ pecas, antes: partes.length ? null : grupo.antes });
    return partes;
  }

  function quebrar(trechos, tamanho, maximo) {
    const linhas = [];
    let atual = { grupos: [], natural: 0 };

    const grupos = separar(trechos, tamanho).flatMap((grupo) =>
      larguraGrupo(grupo) > maximo ? dividirLongo(grupo, maximo, tamanho) : [grupo]
    );

    for (const grupo of grupos) {
      const medida = larguraGrupo(grupo);
      const espaco = atual.grupos.length && grupo.antes ? grupo.antes.largura : 0;
      if (atual.grupos.length && atual.natural + espaco + medida > maximo) {
        linhas.push(atual);
        atual = { grupos: [], natural: 0 };
        atual.grupos.push({ ...grupo, espaco: 0 });
        atual.natural = medida;
      } else {
        atual.grupos.push({ ...grupo, espaco });
        atual.natural += espaco + medida;
      }
    }
    linhas.push(atual);
    return linhas;
  }

  /* Desenho */

  const texto = (ops, peca, x, y, tamanho) =>
    ops.push({ tipo: 'texto', texto: peca.texto, x, y, tamanho, negrito: Boolean(peca.negrito), valor: Boolean(peca.valor) });

  const traco = (ops, x1, y1, x2, y2, espessura) =>
    ops.push({ tipo: 'linha', x1, y1, x2, y2, espessura });

  function desenharCaixa(ops, x, base, marcada) {
    const lado = 8.25;
    const topo = base - 7.875;
    const esquerda = x + 0.375;
    ops.push({ tipo: 'contorno', x: esquerda, y: topo, largura: lado, altura: lado, espessura: 0.75 });
    if (marcada) {
      traco(ops, esquerda + 1.5, topo + 1.5, esquerda + lado - 1.5, topo + lado - 1.5, 0.75);
      traco(ops, esquerda + lado - 1.5, topo + 1.5, esquerda + 1.5, topo + lado - 1.5, 0.75);
    }
  }

  function desenharLinha(ops, linha, x, y, tamanho, sobra = 0) {
    let colas = 0;
    linha.grupos.forEach((grupo, i) => {
      if (i && grupo.antes && grupo.antes.estica) colas += 1;
      colas += grupo.pecas.filter((peca) => peca.cola).length;
    });
    const extra = colas ? sobra / colas : 0;

    let cursor = x;
    linha.grupos.forEach((grupo, i) => {
      cursor += grupo.espaco;
      if (i && grupo.antes && grupo.antes.estica) cursor += extra;
      for (const peca of grupo.pecas) {
        if (peca.texto) texto(ops, peca, cursor, y, tamanho);
        if (peca.caixa) desenharCaixa(ops, cursor, y, peca.marcada);
        cursor += peca.largura + (peca.cola ? extra : 0);
      }
    });
  }

  /* Uma linha so, alinhada por um ponto: { x }, { direita } ou { centro }. */
  function escrever(ops, trechos, alinhamento, y, tamanho) {
    const linhas = quebrar(trechos, tamanho, Infinity);
    const { natural } = linhas[0];
    let { x } = alinhamento;
    if (alinhamento.direita !== undefined) x = alinhamento.direita - natural;
    if (alinhamento.centro !== undefined) x = alinhamento.centro - natural / 2;
    desenharLinha(ops, linhas[0], x, y, tamanho);
  }

  /* Pagina 1 */

  const ALTURA_LINHA_TABELA = 20;
  const LINHA_P1 = 11.5;
  const BASE_CELULA = 13.65;
  const ENTRE_TABELAS = 23.5;
  const BORDA = 0.5;
  const ESQUERDA = 72.3;
  const DIREITA = 522.3;

  function grade(ops, colunas, topos) {
    for (const y of topos) traco(ops, colunas[0] - 0.25, y, colunas[colunas.length - 1] + 0.25, y, BORDA);
    for (const x of colunas) traco(ops, x, topos[0], x, topos[topos.length - 1], BORDA);
  }

  /* Celula: { trechos, largura, x | direita, fundo?, centralizar? } */
  function linhaTabela(ops, colunas, topo, celulas) {
    const quebradas = celulas.map((c) => quebrar(c.trechos, 10, c.largura));
    const maior = Math.max(...quebradas.map((linhas) => linhas.length));
    const altura = ALTURA_LINHA_TABELA + (maior - 1) * LINHA_P1;

    celulas.forEach((celula, i) => {
      if (celula.fundo) {
        ops.push({ tipo: 'fundo', x: colunas[i], y: topo, largura: colunas[i + 1] - colunas[i], altura });
      }
    });
    celulas.forEach((celula, i) => {
      const inicio = topo + BASE_CELULA + (celula.centralizar ? (altura - ALTURA_LINHA_TABELA) / 2 : 0);
      quebradas[i].forEach((linha, n) => {
        const x = celula.direita !== undefined ? celula.direita - linha.natural : celula.x;
        desenharLinha(ops, linha, x, inicio + n * LINHA_P1, 10);
      });
    });
    return altura;
  }

  function tabela(ops, colunas, topo, linhas) {
    const topos = [topo];
    for (const celulas of linhas) {
      topos.push(topos[topos.length - 1] + linhaTabela(ops, colunas, topos[topos.length - 1], celulas));
    }
    grade(ops, colunas, topos);
    return topos[topos.length - 1];
  }

  function observacoes(ops, topo, d) {
    const x = 77.35;
    const maximo = 440;
    let y = topo + BASE_CELULA;

    const paragrafo = (trechos, antes) => {
      y += antes;
      quebrar(trechos, 10, maximo).forEach((linha, i) => {
        if (i) y += LINHA_P1;
        desenharLinha(ops, linha, x, y, 10);
      });
    };

    paragrafo([B('Observações')], 0);
    paragrafo([B('OBSERVAÇÕES DA NEGOCIAÇÃO')], 15.5);
    (d.negociacao || '').split('\n').forEach((linha, i) => {
      paragrafo([V(linha, i ? 0 : 40)], i ? LINHA_P1 : 13.5);
    });
    paragrafo([B('OBSERVAÇÕES DO APARELHO VENDIDO')], 17.5);
    paragrafo([T('Modelo: '), V(d.modelo, 24)], 13.5);
    paragrafo([T('Número de Série: '), V(d.serie, 23)], 12.5);
    if (d.imei2) {
      paragrafo([T('IMEI 1: '), V(nb(d.imei1), 18)], 12.5);
      paragrafo([T('IMEI 2: '), V(nb(d.imei2))], 12.5);
    } else {
      paragrafo([T('IMEI: '), V(nb(d.imei1), 18)], 12.5);
    }
    paragrafo([T('Saúde da Bateria: '), V(d.bateriaTexto, 4)], 12.5);
    paragrafo([T('Acessórios entregues: '), V(d.acessoriosTexto), T('.')], 12.5);
    paragrafo([T('Garantia: 90 (noventa) dias a contar da data de recebimento.')], 12.5);

    const base = Math.max(topo + 155, y + 6.35);
    grade(ops, [ESQUERDA, DIREITA], [topo, base]);
    return base;
  }

  function pagina1(d) {
    const ops = [];

    ops.push({ tipo: 'logo', x: 77.4, y: 50, largura: 150, altura: 52.5 });
    escrever(ops, [B(LOJA.nome)], { direita: 516.7 }, 62.85, 10);
    escrever(ops, [T(LOJA.endereco)], { direita: 516.7 }, 74.4, 9);
    escrever(ops, [T(nb(LOJA.cidade))], { direita: 516.7 }, 85.75, 9);
    escrever(ops, [T(LOJA.instagram)], { direita: 516.7 }, 97.1, 9);
    escrever(ops, [B('CONTRATO DE VENDA')], { centro: CENTRO }, 136.2, 13);

    const rotulo = (nome) => ({ trechos: [B(nome)], largura: 80, x: 77.35, fundo: true, centralizar: true });
    const valor = (trechos) => ({ trechos, largura: 349.9, x: 167.35 });

    let y = tabela(ops, [ESQUERDA, 162.3, DIREITA], 151.25, [
      [rotulo('Cliente'), valor([V(d.nome, 40)])],
      [rotulo('CPF'), valor([V(d.cpf, 14)])],
      [rotulo('Endereço'), valor([V(d.endereco, 34), ESPACOS(5), T('Cidade: '), V(d.cidade, 14)])],
      [rotulo('Contato'), valor([T('Celular: '), V(nb(d.celular), 16), ESPACOS(16), T('E-mail: '), V(d.email)])],
    ]);

    y = tabela(ops, [ESQUERDA, 362.2, 447.2, DIREITA], y + ENTRE_TABELAS, [
      [
        { trechos: [B('Item')], largura: 280, x: 77.35, fundo: true },
        { trechos: [B('Desconto')], largura: 75, direita: 442.35, fundo: true },
        { trechos: [B('Total')], largura: 65, direita: 517.35, fundo: true },
      ],
      [
        { trechos: [B('Modelo: '), V(d.modelo, 24, true)], largura: 280, x: 77.35 },
        { trechos: [d.descontoTexto ? V(nb(d.descontoTexto)) : T('—')], largura: 75, direita: 442.35 },
        { trechos: [V(nb(d.totalTexto), 10, true)], largura: 65, direita: 517.35 },
      ],
    ]);

    y = tabela(ops, [ESQUERDA, 152.3, 272.2, DIREITA], y + ENTRE_TABELAS, [
      [
        { trechos: [B('Valor')], largura: 70, x: 77.35, fundo: true },
        { trechos: [B('Data')], largura: 110, x: 157.35, fundo: true },
        { trechos: [B('Forma de Pagamento')], largura: 240, x: 277.3, fundo: true },
      ],
      [
        { trechos: [V(nb(d.totalTexto), 10, true)], largura: 70, x: 77.35 },
        { trechos: [V(d.dataTexto, 10)], largura: 110, x: 157.35 },
        { trechos: [V(d.formaTexto, 20)], largura: 240, x: 277.3 },
      ],
    ]);

    y = observacoes(ops, y + ENTRE_TABELAS, d);

    const linha = y + 55.15;
    traco(ops, 77.4, linha, 236.55, linha, 0.75);
    traco(ops, 257.4, linha, 516.55, linha, 0.75);
    if (d.recebimentoTexto) escrever(ops, [V(d.recebimentoTexto)], { centro: 157 }, y + 52.65, 10);
    escrever(ops, [T('Data de Recebimento')], { centro: 157 }, y + 64, 8);
    escrever(ops, [T('Assinatura do Comprador')], { centro: 387 }, y + 64, 8);

    return { ops, estourou: y + 67 > LIMITE };
  }

  /* Clausulas */

  const X_CLAUSULAS = 72;
  const LARGURA_CLAUSULAS = 451.5;
  const LINHA_P2 = 13.8;
  const ENTRE_CLAUSULAS = 4.2;
  const ENTRE_FECHOS = 7.2;
  const PRIMEIRA_BASE = 122.25;
  const COLUNAS_ASSINATURA = [
    { esquerda: 72, centro: 178.125 },
    { esquerda: 311.25, centro: 417.375 },
  ];
  const LARGURA_ASSINATURA = 212.25;

  function textosDasClausulas(d) {
    const loja = T(nb(LOJA.nome));
    const imeis = d.imei2
      ? [T('IMEI 1: '), V(nb(d.imei1), 18), T(' e IMEI 2: '), V(nb(d.imei2))]
      : [T('IMEI: '), V(nb(d.imei1), 18)];
    const comAcessorios = d.acessorios.length ? [T(', com '), V(lista(d.acessorios))] : [];
    const recebeu = d.acessorios.length ? 'o aparelho e os acessórios' : 'o aparelho';

    const clausulas = [
      [
        B('OBJETO E PREÇO.'), T(' Venda de 1 (um) aparelho '), V(d.modelo, 24), T(', '), ...imeis, ...comAcessorios,
        T(', por '), V(nb(d.totalTexto), 10), T(', pagos '), V(d.pagosTexto, 12), T(' em '), V(d.dataTexto, 10),
        T('. Condição do aparelho: '),
        CAIXA(d.condicao === 'novo'), T('novo'), FOLGA(6.1), CAIXA(d.condicao === 'seminovo'), T('seminovo/usado.'),
      ],
      [B('PROCEDÊNCIA.'), T(' '), loja, T(' garante que o aparelho tem origem lícita, sem registro de roubo, furto ou extravio, e foi entregue sem bloqueio de iCloud.')],
      [
        B('ENTREGA.'), T(` CLIENTE declara, sem prejuízo da garantia, que recebeu ${recebeu} e testou tela, câmeras, som, Face${NB}ID, carregamento, chip e conexões, que estavam funcionando. `),
        B('Eventuais marcas de uso visíveis na entrega não são defeito.'),
      ],
      [
        B('GARANTIA.'), T(` A garantia de 90 (noventa) dias da primeira página é a garantia legal do art.${NB}26,${NB}II, do Código de Defesa do Consumidor (CDC) e vai da data de recebimento até `),
        V(d.fimGarantiaTexto, 10),
        T(`. Em caso de vício oculto, o prazo começa quando o defeito ficar evidenciado (art.${NB}26,${NB}§${NB}3º). Para usar a garantia, CLIENTE deve levar o aparelho à loja, com este contrato. `),
        loja,
        T(` terá até 30 (trinta) dias para sanar o defeito; se não o fizer, CLIENTE escolherá entre a substituição por outro aparelho da mesma espécie, em perfeitas condições de uso, a devolução do valor pago, atualizado, ou o abatimento proporcional do preço (art.${NB}18,${NB}§${NB}1º, do CDC).`),
      ],
      [
        B('O QUE A GARANTIA NÃO COBRE. Danos causados por queda, impacto, líquidos, mau uso, abertura ou reparo por terceiros e alteração do sistema (jailbreak), além de perda, furto ou roubo. A redução gradual da saúde da bateria ('),
        V(d.bateriaTexto, 4, true),
        B(' na venda) pelo uso normal e o desgaste natural de capinha, película e acessórios não são defeitos.'),
      ],
      [B('CONTA E DADOS DO APARELHO.'), T(` CLIENTE é responsável por sua conta Apple,${NB}senhas e backups e, antes de deixar o aparelho para reparo, deve fazer backup e desativar o Buscar iPhone.`)],
      [
        B('ARREPENDIMENTO. Na compra feita na loja, a lei não garante troca ou devolução por arrependimento, somente por defeito.'),
        T(` Na compra feita fora da loja${NB}(internet, telefone, redes sociais ou domicílio), CLIENTE pode desistir em até 7${NB}(sete) dias da assinatura ou do recebimento, com devolução imediata do valor pago, atualizado (art.${NB}49 do CDC).`),
      ],
    ];

    if (d.pagoComCartao) {
      clausulas.push([B('CARTÃO.'), T(' CLIENTE declara ser titular do cartão usado ou estar autorizado pelo titular e reconhece esta compra. Se o pagamento for cancelado por contestação indevida, o valor continua devido.')]);
    }

    clausulas.push(
      [B('DADOS PESSOAIS.'), T(` Os dados de CLIENTE serão usados apenas para esta venda, garantia, atendimento e obrigações legais (LGPD, Lei${NB}nº${NB}13.709/2018).`)],
      [B('FORO.'), T(` Fica eleito o foro da comarca de ${nb(LOJA.foro)}, sem prejuízo do direito de CLIENTE de propor ação no foro de seu domicílio (art.${NB}101,${NB}I, do CDC).`)]
    );

    return clausulas.map((trechos, i) => [B(`${i + 1}. `), ...trechos]);
  }

  const paragrafoClausula = (trechos, margem, justificar = true) => ({
    linhas: quebrar(trechos, 12, LARGURA_CLAUSULAS),
    margem,
    justificar,
  });

  function montarBlocos(d) {
    const clausulas = textosDasClausulas(d).map((trechos) => paragrafoClausula(trechos, ENTRE_CLAUSULAS));
    const intro = paragrafoClausula(
      [T('Estas cláusulas integram o Contrato de Venda de '), V(d.dataTexto, 10), T(' entre '), T(nb(LOJA.nome)), T(' e '), V(d.nome, 30), T(' (CLIENTE), junto com a primeira página.')],
      0
    );

    const assinaturas = quebrar([V(d.nome, 30)], 10, LARGURA_ASSINATURA);
    const fechamento = {
      itens: [
        clausulas[clausulas.length - 1],
        paragrafoClausula([T('CLIENTE leu, entendeu e aceita estas cláusulas e recebeu uma via do contrato.')], ENTRE_FECHOS, false),
        paragrafoClausula([T(`${nb(LOJA.foro)}, ____/____/________`)], ENTRE_FECHOS, false),
      ],
      assinaturas,
    };

    return [{ itens: [intro] }, ...clausulas.slice(0, -1).map((item) => ({ itens: [item] })), fechamento];
  }

  /* Distancia da primeira a ultima linha de um bloco. */
  function alturaBloco(bloco) {
    let altura = 0;
    bloco.itens.forEach((item, i) => {
      if (i) altura += LINHA_P2 + item.margem;
      altura += (item.linhas.length - 1) * LINHA_P2;
    });
    if (bloco.assinaturas) altura += 57 + (bloco.assinaturas.length - 1) * 12;
    return altura;
  }

  function desenharBloco(ops, bloco, base, d) {
    let y = base;
    bloco.itens.forEach((item, i) => {
      if (i) y += LINHA_P2 + item.margem;
      item.linhas.forEach((linha, n) => {
        if (n) y += LINHA_P2;
        const ultima = n === item.linhas.length - 1;
        const sobra = item.justificar && !ultima ? LARGURA_CLAUSULAS - linha.natural : 0;
        desenharLinha(ops, linha, X_CLAUSULAS, y, 12, sobra);
      });
    });
    if (!bloco.assinaturas) return y;

    const [cliente, loja] = COLUNAS_ASSINATURA;
    const linha = y + 33.375;
    traco(ops, cliente.esquerda, linha, cliente.esquerda + LARGURA_ASSINATURA, linha, 0.75);
    traco(ops, loja.esquerda, linha, loja.esquerda + LARGURA_ASSINATURA, linha, 0.75);

    let nome = y + 45;
    for (const parte of bloco.assinaturas) {
      desenharLinha(ops, parte, cliente.centro - parte.natural / 2, nome, 10);
      nome += 12;
    }
    escrever(ops, [T('CPF: '), V(d.cpf, 14)], { centro: cliente.centro }, nome, 10);
    escrever(ops, [T(LOJA.nome)], { centro: loja.centro }, y + 45, 10);
    escrever(ops, [T('CNPJ/CPF: '), V(d.cnpj, 20)], { centro: loja.centro }, y + 57, 10);
    return y;
  }

  function desenharCabecalho(ops, d, numero, total) {
    ops.push({ tipo: 'logo', x: 72, y: 39.75, largura: 102.75, altura: 36 });
    escrever(ops, [B(LOJA.nome)], { direita: 523.5 }, 49.5, 10);
    escrever(ops, [T('Contrato de Venda de '), V(d.dataTexto, 10)], { direita: 523.5 }, 60.75, 9);
    escrever(ops, [T(`Página ${numero} de ${total}`)], { direita: 523.5 }, 72, 9);
    const titulo = `CLÁUSULAS E CONDIÇÕES DA VENDA${numero > 2 ? ' (CONTINUAÇÃO)' : ''}`;
    escrever(ops, [B(titulo)], { centro: CENTRO }, 99.75, 13);
  }

  /* O que nao cabe vai para outra folha, sem reduzir a letra das clausulas.
     O ultimo bloco leva a ultima clausula com as assinaturas, para que a folha
     assinada nunca fique sem texto do contrato. */
  function paginasClausulas(d) {
    const folhas = [[]];
    let y = PRIMEIRA_BASE;

    for (const bloco of montarBlocos(d)) {
      let atual = folhas[folhas.length - 1];
      const margem = atual.length ? LINHA_P2 + bloco.itens[0].margem : 0;
      if (atual.length && y + margem + alturaBloco(bloco) > LIMITE) {
        atual = [];
        folhas.push(atual);
        y = PRIMEIRA_BASE;
        atual.push({ bloco, base: y });
      } else {
        y += margem;
        atual.push({ bloco, base: y });
      }
      y += alturaBloco(bloco);
    }

    const total = folhas.length + 1;
    return folhas.map((itens, i) => {
      const ops = [];
      desenharCabecalho(ops, d, i + 2, total);
      for (const { bloco, base } of itens) desenharBloco(ops, bloco, base, d);
      return { ops };
    });
  }

  function montar(d) {
    const primeira = pagina1(d);
    return {
      folhas: [{ ops: primeira.ops }, ...paginasClausulas(d)],
      estourou: primeira.estourou,
    };
  }

  global.Contrato = { GARANTIA_DIAS, FOLHA, lista, montar };
})(window);
