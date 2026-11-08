/* Transforma as folhas diagramadas em contrato.js num arquivo PDF. Nao usa a
   impressao do navegador, que muda papel e margens conforme o aparelho. */
(function (global) {
  'use strict';

  const scripts = {};

  function carregarScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = src;
        tag.onload = resolve;
        tag.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
        document.head.appendChild(tag);
      });
    }
    return scripts[src];
  }

  const preparar = () =>
    Promise.all([
      carregarScript('vendor/pdf-lib.min.js'),
      carregarScript('vendor/fontkit.umd.min.js'),
      carregarScript('vendor/recursos-pdf.js'),
    ]);

  function base64ParaBytes(texto) {
    const binario = atob(texto);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  function desenharFolha(pdf, folha, recursos) {
    const { rgb } = global.PDFLib;
    const { largura, altura } = global.Contrato.FOLHA;
    const pagina = pdf.addPage([largura, altura]);
    const preto = rgb(0, 0, 0);
    const y = (valor) => altura - valor;

    for (const op of folha.ops) {
      if (op.tipo === 'texto') {
        pagina.drawText(op.texto, {
          x: op.x,
          y: y(op.y),
          size: op.tamanho,
          font: op.negrito ? recursos.negrito : recursos.regular,
          color: preto,
        });
      } else if (op.tipo === 'linha') {
        pagina.drawLine({
          start: { x: op.x1, y: y(op.y1) },
          end: { x: op.x2, y: y(op.y2) },
          thickness: op.espessura,
          color: preto,
        });
      } else if (op.tipo === 'fundo') {
        pagina.drawRectangle({
          x: op.x,
          y: y(op.y + op.altura),
          width: op.largura,
          height: op.altura,
          color: rgb(0.949, 0.949, 0.949),
        });
      } else if (op.tipo === 'contorno') {
        pagina.drawRectangle({
          x: op.x,
          y: y(op.y + op.altura),
          width: op.largura,
          height: op.altura,
          borderColor: preto,
          borderWidth: op.espessura,
        });
      } else if (op.tipo === 'logo') {
        pagina.drawImage(recursos.logo, {
          x: op.x,
          y: y(op.y + op.altura),
          width: op.largura,
          height: op.altura,
        });
      } else if (op.tipo === 'assinatura') {
        const imagem = recursos.assinaturas.get(op.dados);
        if (imagem) {
          const medida = imagem.scaleToFit(op.largura, op.altura);
          pagina.drawImage(imagem, {
            x: op.x + (op.largura - medida.width) / 2,
            y: y(op.y + op.altura) + (op.altura - medida.height) / 2,
            width: medida.width,
            height: medida.height,
          });
        }
      }
    }
  }

  function dataUrlParaBytes(url) {
    return base64ParaBytes(url.slice(url.indexOf(',') + 1));
  }

  /* Incorpora cada assinatura uma vez. Imagem inválida deixa a linha em branco, sem travar o PDF. */
  async function embutirAssinaturas(pdf, documento) {
    const mapa = new Map();
    for (const folha of documento.folhas) {
      for (const op of folha.ops) {
        if (op.tipo !== 'assinatura' || mapa.has(op.dados)) continue;
        try {
          mapa.set(op.dados, await pdf.embedPng(dataUrlParaBytes(op.dados)));
        } catch (erro) {
          /* Sem imagem: a linha sai em branco para assinar à caneta. */
        }
      }
    }
    return mapa;
  }

  async function montar(contrato, titulo) {
    await preparar();

    const { PDFDocument } = global.PDFLib;
    const dados = global.RecursosPdf;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(global.fontkit);
    pdf.setTitle(titulo);
    pdf.setAuthor('LZ iPhones');
    pdf.setCreator('Gerador de contratos LZ iPhones');
    pdf.setLanguage('pt-BR');

    const recursos = {
      regular: await pdf.embedFont(base64ParaBytes(dados.regular)),
      negrito: await pdf.embedFont(base64ParaBytes(dados.negrito)),
      logo: await pdf.embedJpg(base64ParaBytes(dados.logo)),
    };

    recursos.assinaturas = await embutirAssinaturas(pdf, contrato);
    contrato.folhas.forEach((folha) => desenharFolha(pdf, folha, recursos));
    return pdf.save();
  }

  function baixar(bytes, nomeArquivo) {
    const arquivo = new Blob([bytes], { type: 'application/pdf' });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = endereco;
    link.download = `${nomeArquivo}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(endereco), 60000);
  }

  global.PdfContrato = { preparar, montar, baixar };
})(window);
