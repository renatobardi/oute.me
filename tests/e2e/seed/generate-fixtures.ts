#!/usr/bin/env tsx
/**
 * Gera os arquivos de fixture estáticos para o seed.
 * Execute uma vez: npx tsx tests/e2e/seed/generate-fixtures.ts
 *
 * Requer (instalar no e2e):
 *   pdfkit, docx, exceljs, pptxgenjs
 */

import { existsSync } from 'fs';
import path from 'path';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

async function generatePdf() {
  const outPath = path.join(FIXTURES_DIR, 'sample-requirements.pdf');
  if (existsSync(outPath)) { console.log('  PDF já existe, pulando.'); return; }

  const PDFDocument = (await import('pdfkit')).default;
  const fs = await import('fs');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(fs.createWriteStream(outPath));

  doc.fontSize(20).font('Helvetica-Bold').text('Documento de Requisitos', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Projeto: Plataforma de E-commerce', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('1. Visão Geral');
  doc.fontSize(11).font('Helvetica').text(
    'Este documento descreve os requisitos funcionais e não-funcionais para o desenvolvimento ' +
    'de uma plataforma de e-commerce B2C voltada para o mercado brasileiro, com foco em ' +
    'escalabilidade, segurança e experiência do usuário.'
  );
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('2. Requisitos Funcionais');
  const req = [
    'RF-001: O sistema deve permitir cadastro e autenticação de usuários via email/senha e OAuth (Google, Facebook)',
    'RF-002: O sistema deve exibir catálogo de produtos com busca, filtros e paginação',
    'RF-003: O sistema deve gerenciar carrinho de compras com persistência entre sessões',
    'RF-004: O sistema deve processar pagamentos via cartão de crédito, boleto e PIX',
    'RF-005: O sistema deve calcular frete com integração aos Correios e transportadoras',
    'RF-006: O sistema deve enviar notificações por email para pedidos e atualizações',
    'RF-007: O sistema deve exibir histórico de pedidos para o usuário',
    'RF-008: O sistema deve ter painel administrativo para gestão de produtos e pedidos',
  ];
  req.forEach(r => doc.fontSize(11).font('Helvetica').text(`• ${r}`).moveDown(0.3));
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('3. Requisitos Não-Funcionais');
  const nreq = [
    'RNF-001: Disponibilidade de 99.9% (uptime)',
    'RNF-002: Tempo de resposta < 200ms para 95% das requisições',
    'RNF-003: Suporte a 10.000 usuários simultâneos',
    'RNF-004: Conformidade com LGPD',
    'RNF-005: Interface responsiva (mobile-first)',
    'RNF-006: Score > 90 no Google Lighthouse (Performance e Acessibilidade)',
  ];
  nreq.forEach(r => doc.fontSize(11).font('Helvetica').text(`• ${r}`).moveDown(0.3));

  doc.end();
  console.log('  PDF gerado:', outPath);
}

async function generateDocx() {
  const outPath = path.join(FIXTURES_DIR, 'sample-architecture.docx');
  if (existsSync(outPath)) { console.log('  DOCX já existe, pulando.'); return; }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = await import('docx');
  const fs = await import('fs');

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'Documento de Arquitetura de Sistema',
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({ text: 'Versão 1.0 — ERP Industrial' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '1. Visão Geral da Arquitetura', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun(
              'A arquitetura proposta segue o padrão de microserviços com comunicação assíncrona ' +
              'via mensageria (RabbitMQ) e síncrona via REST/gRPC. O sistema é dividido em ' +
              'domínios funcionais independentes: Estoque, Produção, Financeiro e RH.'
            ),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '2. Componentes Principais', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: 'Backend:', bold: true }), new TextRun(' Java 21 + Spring Boot 3.2, múltiplos microserviços')] }),
        new Paragraph({ children: [new TextRun({ text: 'Frontend:', bold: true }), new TextRun(' React 18 + TypeScript + Vite, SPA com micro-frontends')] }),
        new Paragraph({ children: [new TextRun({ text: 'Banco:', bold: true }), new TextRun(' PostgreSQL 16 (principal), Redis (cache), Elasticsearch (busca)')] }),
        new Paragraph({ children: [new TextRun({ text: 'Infraestrutura:', bold: true }), new TextRun(' Kubernetes no GKE, Terraform para IaC')] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '3. Integrações', heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Sistema', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Protocolo', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Propósito', bold: true })] })] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph('SAP FI/CO')] }),
              new TableCell({ children: [new Paragraph('REST/BAPI')] }),
              new TableCell({ children: [new Paragraph('Contabilidade e fiscal')] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph('Dimep Ponto')] }),
              new TableCell({ children: [new Paragraph('SFTP + CSV')] }),
              new TableCell({ children: [new Paragraph('Controle de ponto eletrônico')] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph('Itaú API')] }),
              new TableCell({ children: [new Paragraph('REST OAuth2')] }),
              new TableCell({ children: [new Paragraph('Conciliação bancária')] }),
            ]}),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('  DOCX gerado:', outPath);
}

async function generateXlsx() {
  const outPath = path.join(FIXTURES_DIR, 'sample-budget.xlsx');
  if (existsSync(outPath)) { console.log('  XLSX já existe, pulando.'); return; }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  // Aba 1: Resumo
  const resumo = wb.addWorksheet('Resumo Executivo');
  resumo.columns = [
    { header: 'Componente', key: 'componente', width: 30 },
    { header: 'Cenário Conservador (R$)', key: 'conservador', width: 25 },
    { header: 'Cenário Moderado (R$)', key: 'moderado', width: 25 },
    { header: 'Cenário Otimista (R$)', key: 'otimista', width: 25 },
  ];
  [
    { componente: 'Desenvolvimento Backend', conservador: 180000, moderado: 150000, otimista: 120000 },
    { componente: 'Desenvolvimento Frontend', conservador: 120000, moderado: 100000, otimista: 80000 },
    { componente: 'Infraestrutura / DevOps', conservador: 60000, moderado: 50000, otimista: 40000 },
    { componente: 'Design UX/UI', conservador: 40000, moderado: 35000, otimista: 28000 },
    { componente: 'QA e Testes', conservador: 50000, moderado: 40000, otimista: 32000 },
    { componente: 'Gestão de Projeto', conservador: 36000, moderado: 30000, otimista: 24000 },
    { componente: 'Contingência (20%)', conservador: 97200, moderado: 81000, otimista: 64800 },
    { componente: 'TOTAL', conservador: 583200, moderado: 486000, otimista: 388800 },
  ].forEach(r => resumo.addRow(r));

  // Aba 2: Breakdown de horas
  const horas = wb.addWorksheet('Breakdown Horas');
  horas.columns = [
    { header: 'Fase', key: 'fase', width: 25 },
    { header: 'Tarefa', key: 'tarefa', width: 35 },
    { header: 'Horas Estimadas', key: 'horas', width: 18 },
    { header: 'Perfil', key: 'perfil', width: 20 },
    { header: 'Taxa/h (R$)', key: 'taxa', width: 15 },
    { header: 'Total (R$)', key: 'total', width: 15 },
  ];
  const rows = [
    { fase: 'Fundação', tarefa: 'Setup infraestrutura GCP', horas: 40, perfil: 'DevOps Senior', taxa: 200 },
    { fase: 'Fundação', tarefa: 'Pipeline CI/CD', horas: 32, perfil: 'DevOps Senior', taxa: 200 },
    { fase: 'Backend', tarefa: 'Módulo de Estoque', horas: 120, perfil: 'Backend Senior', taxa: 180 },
    { fase: 'Backend', tarefa: 'Módulo de Produção', horas: 160, perfil: 'Backend Senior', taxa: 180 },
    { fase: 'Backend', tarefa: 'Módulo Financeiro', horas: 140, perfil: 'Backend Senior', taxa: 180 },
    { fase: 'Backend', tarefa: 'Módulo de RH', horas: 100, perfil: 'Backend Pleno', taxa: 150 },
    { fase: 'Frontend', tarefa: 'Dashboard e navegação', horas: 80, perfil: 'Frontend Senior', taxa: 170 },
    { fase: 'Frontend', tarefa: 'Módulos funcionais', horas: 200, perfil: 'Frontend Pleno', taxa: 140 },
    { fase: 'QA', tarefa: 'Testes de integração', horas: 80, perfil: 'QA Engineer', taxa: 130 },
    { fase: 'QA', tarefa: 'Testes E2E', horas: 60, perfil: 'QA Engineer', taxa: 130 },
  ];
  rows.forEach(r => horas.addRow({ ...r, total: r.horas * r.taxa }));

  // Aba 3: Timeline financeiro
  const timeline = wb.addWorksheet('Timeline Financeiro');
  timeline.columns = [
    { header: 'Mês', key: 'mes', width: 15 },
    { header: 'Marco', key: 'marco', width: 35 },
    { header: 'Custo do Mês (R$)', key: 'custo', width: 20 },
    { header: 'Acumulado (R$)', key: 'acumulado', width: 20 },
    { header: '% do Total', key: 'percentual', width: 15 },
  ];
  const timelineData = [
    { mes: 'Mês 1', marco: 'Fundação e Setup', custo: 60000, acumulado: 60000, percentual: '12%' },
    { mes: 'Mês 2', marco: 'Módulo de Estoque', custo: 80000, acumulado: 140000, percentual: '29%' },
    { mes: 'Mês 3', marco: 'Módulo de Produção', custo: 90000, acumulado: 230000, percentual: '47%' },
    { mes: 'Mês 4', marco: 'Módulo Financeiro', custo: 85000, acumulado: 315000, percentual: '65%' },
    { mes: 'Mês 5', marco: 'Módulo RH + Integrações', custo: 95000, acumulado: 410000, percentual: '84%' },
    { mes: 'Mês 6', marco: 'QA, Deploy e Go-live', custo: 76000, acumulado: 486000, percentual: '100%' },
  ];
  timelineData.forEach(r => timeline.addRow(r));

  await wb.xlsx.writeFile(outPath);
  console.log('  XLSX gerado:', outPath);
}

async function generatePptx() {
  const outPath = path.join(FIXTURES_DIR, 'sample-presentation.pptx');
  if (existsSync(outPath)) { console.log('  PPTX já existe, pulando.'); return; }

  const pptxgen = (await import('pptxgenjs')).default;
  const prs = new pptxgen();

  // Slide 1: Capa
  const s1 = prs.addSlide();
  s1.background = { color: '1A1A2E' };
  s1.addText('Plataforma SaaS de Gestão Escolar', {
    x: 0.5, y: 1.5, w: 9, h: 1.2,
    fontSize: 32, color: 'FFFFFF', bold: true, align: 'center',
  });
  s1.addText('Pitch Deck — Série A | 2024', {
    x: 0.5, y: 3.0, w: 9, h: 0.6,
    fontSize: 18, color: 'A0A0C0', align: 'center',
  });
  s1.addText('Versão Confidencial', {
    x: 0.5, y: 6.5, w: 9, h: 0.4,
    fontSize: 12, color: '606080', align: 'center',
  });

  // Slide 2: Problema
  const s2 = prs.addSlide();
  s2.background = { color: 'F8F9FA' };
  s2.addText('O Problema', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28, color: '1A1A2E', bold: true,
  });
  const problemas = [
    '85% das escolas privadas usam planilhas Excel ou sistemas desatualizados',
    'Comunicação escola-família fragmentada (WhatsApp, email, agenda impressa)',
    'Secretaria gasta 40% do tempo em tarefas manuais e redundantes',
    'Inadimplência média de 18% por falta de régua de cobrança eficiente',
    'Dados pedagógicos e financeiros em silos, sem visão integrada',
  ];
  problemas.forEach((p, i) => {
    s2.addText(`• ${p}`, {
      x: 0.5, y: 1.4 + i * 0.8, w: 9, h: 0.7,
      fontSize: 14, color: '333333',
    });
  });

  // Slide 3: Solução
  const s3 = prs.addSlide();
  s3.background = { color: 'F8F9FA' };
  s3.addText('Nossa Solução', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28, color: '1A1A2E', bold: true,
  });
  s3.addText(
    'Uma plataforma integrada que unifica gestão acadêmica, financeira e ' +
    'comunicação em um único sistema cloud-native, acessível de qualquer dispositivo.',
    { x: 0.5, y: 1.2, w: 9, h: 1.2, fontSize: 16, color: '444444' }
  );
  const modulos = ['Matrículas e Rematrícula Digital', 'Diário Eletrônico e Notas', 'Portal do Aluno e Responsável', 'Financeiro e Cobrança Automática', 'Comunicados e Agenda Online'];
  modulos.forEach((m, i) => {
    s3.addText(`✓ ${m}`, { x: 0.5, y: 2.6 + i * 0.65, w: 9, h: 0.55, fontSize: 15, color: '0A6E3F', bold: true });
  });

  // Slide 4: Mercado
  const s4 = prs.addSlide();
  s4.background = { color: 'F8F9FA' };
  s4.addText('Tamanho do Mercado', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28, color: '1A1A2E', bold: true,
  });
  [
    ['TAM', 'R$ 4.2B', 'Total de escolas privadas no Brasil (42.000 unidades)'],
    ['SAM', 'R$ 980M', 'Escolas com 100–2.000 alunos e perfil digital (9.800)'],
    ['SOM', 'R$ 120M', 'Mercado endereçável nos primeiros 3 anos (1.200 escolas)'],
  ].forEach(([sigla, valor, desc], i) => {
    s4.addText(sigla, { x: 0.5, y: 1.5 + i * 1.3, w: 1.2, h: 0.7, fontSize: 22, color: '1A1A2E', bold: true });
    s4.addText(valor, { x: 1.8, y: 1.5 + i * 1.3, w: 2.5, h: 0.7, fontSize: 22, color: '0066CC', bold: true });
    s4.addText(desc, { x: 4.5, y: 1.5 + i * 1.3, w: 5.2, h: 0.7, fontSize: 13, color: '555555' });
  });

  // Slide 5: Roadmap
  const s5 = prs.addSlide();
  s5.background = { color: 'F8F9FA' };
  s5.addText('Roadmap de Produto', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28, color: '1A1A2E', bold: true,
  });
  [
    ['Q1 2024', 'MVP: Matrículas + Financeiro + Portal Básico', '0066CC'],
    ['Q2 2024', 'Diário Eletrônico + App Mobile + Comunicados', '008844'],
    ['Q3 2024', 'BI e Relatórios + Integração MEC + API Aberta', 'AA6600'],
    ['Q4 2024', 'IA Preditiva (inadimplência, evasão) + Multi-escola', '880044'],
  ].forEach(([trimestre, descricao, cor], i) => {
    s5.addText(trimestre, { x: 0.5, y: 1.3 + i * 1.1, w: 2, h: 0.8, fontSize: 16, color: cor as string, bold: true });
    s5.addText(descricao, { x: 2.7, y: 1.3 + i * 1.1, w: 7, h: 0.8, fontSize: 14, color: '333333' });
  });

  await prs.writeFile({ fileName: outPath });
  console.log('  PPTX gerado:', outPath);
}

async function main() {
  console.log('Gerando fixtures de arquivo para o seed...\n');
  await generatePdf();
  await generateDocx();
  await generateXlsx();
  await generatePptx();
  console.log('\nCSV já existe como arquivo estático.');
  console.log('\nFixtures geradas com sucesso!');
}

main().catch(console.error);
