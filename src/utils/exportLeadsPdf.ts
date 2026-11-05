import { jsPDF } from 'jspdf';
import { Lead, ProductView, LeadStatus } from '../types';

const STATUS_LABELS_PDF: Record<LeadStatus, string> = {
  novo: 'Novo Acesso',
  em_atendimento: 'Em Atendimento',
  proposta: 'Proposta Enviada',
  convertido: 'Venda Concluída',
};

interface LogoPngData {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads the company logo (SVG, PNG, JPEG, WebP, or Data URL) into a high-DPI canvas
 * and converts it to a PNG data URL so jsPDF can embed any logo format cleanly.
 */
async function rasterizeLogoToPng(logoUrl: string, fallbackUrl: string): Promise<LogoPngData | null> {
  const tryLoad = (src: string): Promise<LogoPngData | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          const natW = img.naturalWidth || img.width || 340;
          const natH = img.naturalHeight || img.height || 100;
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = natW * scale;
          canvas.height = natH * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({
            dataUrl,
            width: natW,
            height: natH,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const primary = await tryLoad(logoUrl);
  if (primary) return primary;
  if (fallbackUrl && fallbackUrl !== logoUrl) {
    return tryLoad(fallbackUrl);
  }
  return null;
}

function formatBrlCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
}

export interface ExportLeadsPdfOptions {
  leadsToExport: Lead[];
  viewsByLead: Record<string, ProductView[]>;
  companyLogoUrl: string;
  defaultLogoUrl: string;
  periodLabel: string;
  sellerLabel: string;
  formatDateTime: (ts: unknown) => string;
  fileNamePrefix?: string;
}

export async function exportLeadsAndViewsToPdf({
  leadsToExport,
  viewsByLead,
  companyLogoUrl,
  defaultLogoUrl,
  periodLabel,
  sellerLabel,
  formatDateTime,
  fileNamePrefix = 'relatorio-leads-visualizacoes',
}: ExportLeadsPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // Load company logo
  const logoData = await rasterizeLogoToPng(companyLogoUrl, defaultLogoUrl);

  // Compute summary metrics
  const totalLeads = leadsToExport.length;
  const totalViewsCount = leadsToExport.reduce((acc, l) => acc + (l.totalViews || 0), 0);
  const totalDistinctItems = leadsToExport.reduce(
    (acc, l) => acc + (viewsByLead[l.id]?.length || 0),
    0
  );

  const nowStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  // Helper to draw top brand header on the first page (or continuation header)
  const drawDocumentHeader = (isFirstPage: boolean): number => {
    // Top red accent bar
    doc.setFillColor(209, 23, 24); // #D11718
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    let headerBottomY = 28;

    // Company Logo on the left
    if (logoData) {
      const maxLogoW = 46;
      const maxLogoH = 15;
      const ratio = Math.min(maxLogoW / logoData.width, maxLogoH / logoData.height);
      const drawW = Math.max(12, logoData.width * ratio);
      const drawH = Math.max(6, logoData.height * ratio);
      doc.addImage(logoData.dataUrl, 'PNG', marginX, 8, drawW, drawH);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('CAMPOS EQUIPAMENTOS', marginX, 16);
    }

    // Report Title & Metadata on the right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 12 : 10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      'RELATÓRIO DE LEADS & EQUIPAMENTOS VISUALIZADOS',
      pageWidth - marginX,
      12,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emitido em: ${nowStr}`, pageWidth - marginX, 17, { align: 'right' });
    doc.text(
      `Vendedor: ${sellerLabel}  |  Período: ${periodLabel}`,
      pageWidth - marginX,
      21.5,
      { align: 'right' }
    );

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, 25.5, pageWidth - marginX, 25.5);

    if (isFirstPage) {
      // Summary KPI Box
      const boxY = 29;
      const boxH = 16;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, boxY, contentWidth, boxH, 2, 2, 'FD');

      const colW = contentWidth / 3;

      // KPI 1: Leads Selecionados
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('LEADS EXPORTADOS', marginX + 5, boxY + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${totalLeads} ${totalLeads === 1 ? 'cliente' : 'clientes'}`,
        marginX + 5,
        boxY + 12
      );

      // KPI 2: Equipamentos Distintos Consultados
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('EQUIPAMENTOS VISTOS', marginX + colW + 5, boxY + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${totalDistinctItems} ${totalDistinctItems === 1 ? 'item' : 'itens'}`,
        marginX + colW + 5,
        boxY + 12
      );

      // KPI 3: Total de Aberturas / Cliques
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL DE VISUALIZAÇÕES', marginX + colW * 2 + 5, boxY + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(209, 23, 24);
      doc.text(
        `${totalViewsCount} ${totalViewsCount === 1 ? 'abertura' : 'aberturas'}`,
        marginX + colW * 2 + 5,
        boxY + 12
      );

      headerBottomY = boxY + boxH + 6;
    } else {
      headerBottomY = 30;
    }

    return headerBottomY;
  };

  let cursorY = drawDocumentHeader(true);
  const bottomLimitY = pageHeight - 18;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > bottomLimitY) {
      doc.addPage();
      cursorY = drawDocumentHeader(false);
    }
  };

  leadsToExport.forEach((lead, index) => {
    const leadViews = viewsByLead[lead.id] || [];
    const baseBlockHeight = leadViews.length === 0 ? 28 : 26 + Math.min(leadViews.length, 2) * 8;
    ensureSpace(baseBlockHeight);

    // Lead Header Card
    doc.setFillColor(15, 23, 42); // Slate-900 header bar
    doc.roundedRect(marginX, cursorY, contentWidth, 8.5, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    const clientTitle = `${index + 1}. ${lead.clientName || 'Cliente'}  —  Tel/WhatsApp: ${
      lead.clientPhone || 'Não informado'
    }`;
    doc.text(clientTitle.slice(0, 85), marginX + 3.5, cursorY + 5.7);

    const statusText = STATUS_LABELS_PDF[lead.status] || lead.status;
    doc.setFontSize(8);
    doc.text(statusText.toUpperCase(), pageWidth - marginX - 3.5, cursorY + 5.7, {
      align: 'right',
    });

    cursorY += 8.5;

    // Lead Subheader Metadata Bar
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, cursorY, contentWidth, 7, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const capturedAtStr = formatDateTime(lead.createdAt || lead.updatedAt);
    doc.text(
      `Vendedor Responsável: ${lead.sellerName || 'Equipe Comercial'}   |   Capturado em: ${capturedAtStr}`,
      marginX + 3.5,
      cursorY + 4.8
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `${leadViews.length} equip. (${lead.totalViews || 0} cliques)`,
      pageWidth - marginX - 3.5,
      cursorY + 4.8,
      { align: 'right' }
    );

    cursorY += 7;

    if (leadViews.length === 0) {
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, cursorY, contentWidth, 8, 'S');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Nenhum equipamento específico aberto por este lead até o momento.',
        marginX + 3.5,
        cursorY + 5.3
      );
      cursorY += 13;
    } else {
      // Viewed Products Table Header
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, cursorY, contentWidth, 6.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('EQUIPAMENTO VISUALIZADO', marginX + 3.5, cursorY + 4.5);
      doc.text('SEGMENTO / LINHA', marginX + 94, cursorY + 4.5);
      doc.text('PREÇO PB-10X', marginX + 137, cursorY + 4.5);
      doc.text('VISITAS', pageWidth - marginX - 3.5, cursorY + 4.5, { align: 'right' });

      cursorY += 6.5;

      // Viewed Product Rows
      leadViews.forEach((view, vIdx) => {
        ensureSpace(8);

        if (vIdx % 2 === 1) {
          doc.setFillColor(252, 253, 254);
          doc.rect(marginX, cursorY, contentWidth, 7, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, cursorY, contentWidth, 7, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const prodName = (view.productName || 'Equipamento').slice(0, 48);
        doc.text(prodName, marginX + 3.5, cursorY + 4.7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const catName = (view.productCategory || 'Geral').slice(0, 24);
        doc.text(catName, marginX + 94, cursorY + 4.7);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatBrlCurrency(view.productPrice), marginX + 137, cursorY + 4.7);

        doc.setTextColor(209, 23, 24);
        const visitsLabel = `${view.viewCount}x (${formatDateTime(view.updatedAt).split(' ')[0]})`;
        doc.text(visitsLabel, pageWidth - marginX - 3.5, cursorY + 4.7, { align: 'right' });

        cursorY += 7;
      });

      cursorY += 5.5;
    }
  });

  // Add footer with page numbers and LGPD notice on all pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Catálogo Digital de Equipamentos · Relatório Comercial Confidencial (LGPD — Lei nº 13.709/2018)',
      marginX,
      pageHeight - 7.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${pageCount}`, pageWidth - marginX, pageHeight - 7.5, {
      align: 'right',
    });
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`${fileNamePrefix}-${dateSlug}.pdf`);
}
