import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { 
  ChevronDown,
  ChevronUp,
  Truck,
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  Calendar,
  Building2,
  Box,
  Package,
  History,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ClipboardList,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SHEET_ID = '1kgo_BrjuyPp5zxOGaJJfucd6t9fdufE8KF2Po-aCkGk';

// Helper to format currency
const formatBRL = (value: number | string) => {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Precise date parser
function parseFlexibleDate(str: string): Date | null {
  if (!str) return null;
  const clean = str.trim();
  const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  }
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);
    if (p2 > 100) {
      if (p0 > 12) {
        return new Date(p2, p1 - 1, p0);
      }
      if (p1 > 12) {
        return new Date(p2, p0 - 1, p1);
      }
      return new Date(p2, p1 - 1, p0);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Calculate days CD helper
function calculateDaysInCD(arrivalStr: string, expStr?: string, ticketId?: string) {
  let arrivalDate: Date | null = null;
  if (ticketId && ticketId.startsWith('TKT-')) {
    const match = ticketId.match(/TKT-(\d{4})(\d{2})(\d{2})/);
    if (match) {
      arrivalDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
  }
  if (!arrivalDate) {
    arrivalDate = parseFlexibleDate(arrivalStr);
  }
  if (!arrivalDate) return 0;
  
  // Set default modern system date (June 22, 2026)
  let endDate = new Date(2026, 5, 22);
  if (expStr) {
    const expDate = parseFlexibleDate(expStr);
    if (expDate) {
      endDate = expDate;
    }
  }
  
  const diffTime = endDate.getTime() - arrivalDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
}

// Format Column V date helper
function formatColumnVDate(dateStr?: string): string {
  if (!dateStr) return 'Sem Data';
  const clean = dateStr.trim();
  if (!clean) return 'Sem Data';
  
  const parsed = parseFlexibleDate(clean);
  if (parsed) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${day}/${months[parsed.getMonth()]}`;
  }
  
  const parts = clean.split(/[-/]/);
  if (parts.length >= 2) {
    const dayVal = parts[0].padStart(2, '0');
    const monthVal = parseInt(parts[1]);
    if (monthVal >= 1 && monthVal <= 12) {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${dayVal}/${months[monthVal - 1]}`;
    }
  }
  
  return clean;
}

export interface ReentregaItem {
  id: string; // Ticket ID
  nf: string;
  date: string; // Data de criação
  cliente: string;
  codigoCliente: string;
  motivo: string;
  dataChegadaCD: string;
  dataExpedicao: string;
  volumes: number;
  transportadora: string;
  status: 'Aguardando Expedição' | 'Expedido' | 'Entregue' | 'Atrasado';
  responsavel: string;
  valor: string;
  prioridade: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'URGENTE';
  
  // New Fields matching user instructions
  mercadoriaDevolvidaCD?: string;
  statusExpedicao?: string;
  statusFinalReentrega?: string;
  novaTransportadora?: string;
  previsaoReentrega?: string;
  tratativa?: string;
  mes?: string;
  pedido?: string;
  motorista?: string;
  naoReentrega?: string;
  dataColunaV?: string;
}

export default function ReentregaDashboard() {
  const [data, setData] = useState<ReentregaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorObj, setErrorObj] = useState<string | null>(null);
  const [totalRenntregaaCount, setTotalRenntregaaCount] = useState<number>(0);

  // New Form states for the new dimensions
  const [formMercadoriaDevolvidaCD, setFormMercadoriaDevolvidaCD] = useState('Sim');
  const [formStatusExpedicao, setFormStatusExpedicao] = useState('Aguardando Programação');
  const [formNovaTransportadora, setFormNovaTransportadora] = useState('');
  const [formPrevisaoReentrega, setFormPrevisaoReentrega] = useState('');
  const [formTratativa, setFormTratativa] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('TODOS');
  const [clientFilter, setClientFilter] = useState('TODOS');
  const [motiveFilter, setMotiveFilter] = useState('TODOS');
  const [carrierFilter, setCarrierFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [ticketFilter, setTicketFilter] = useState('');
  const [nfFilter, setNfFilter] = useState('');

  // Expandable table rows
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedDetailingGroups, setExpandedDetailingGroups] = useState<Record<string, boolean>>({});

  // Critical cases expanded
  const [isCriticalExpanded, setIsCriticalExpanded] = useState(false);
  const [criticalSearchNf, setCriticalSearchNf] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [formNf, setFormNf] = useState('');
  const [formCliente, setFormCliente] = useState('');
  const [formCodigoCliente, setFormCodigoCliente] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [formDataChegadaCD, setFormDataChegadaCD] = useState('');
  const [formDataExpedicao, setFormDataExpedicao] = useState('');
  const [formVolumes, setFormVolumes] = useState(1);
  const [formTransportadora, setFormTransportadora] = useState('');
  const [formStatus, setFormStatus] = useState<'Aguardando Expedição' | 'Expedido' | 'Entregue' | 'Atrasado'>('Aguardando Expedição');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formPrioridade, setFormPrioridade] = useState<'BAIXA' | 'MÉDIA' | 'ALTA' | 'URGENTE'>('MÉDIA');
  const [formPedido, setFormPedido] = useState('');
  const [formMotorista, setFormMotorista] = useState('');
  const [formNaoReentrega, setFormNaoReentrega] = useState('');

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const robustParse = (csv: string) => {
    if (!csv) return [];
    const lines = csv.split(/\r?\n/);
    const sample = csv.slice(0, 1000);
    const sep = (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ';' : ',';
    const rows: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === sep && !inQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        currentLine.push(currentField.trim());
        if (currentLine.some(c => c !== '')) rows.push(currentLine);
        currentLine = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some(c => c !== '')) rows.push(currentLine);
    }
    return rows;
  };

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorObj(null);
      
      const sheetId = SHEET_ID;
      const url1 = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=480965236`;
      const url2 = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Renntregaa`;
      const cacheBuster = `&t=${new Date().getTime()}`;

      const [res1, res2] = await Promise.all([
        fetch(`${url1}${cacheBuster}`),
        fetch(`${url2}${cacheBuster}`)
      ]);

      if (!res1.ok || !res2.ok) {
        throw new Error("Não foi possível carregar os dados das abas do Google Sheets.");
      }

      const text1 = await res1.text();
      const text2 = await res2.text();

      const reRows = robustParse(text1);
      const renRows = robustParse(text2);

      if (reRows.length === 0) {
        throw new Error("Planilha de reentrega retornou vazia.");
      }

      const headers1 = reRows[0];
      const headers2 = renRows[0] || [];

      const colIndex = (headers: string[], name: string) => 
        headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());

      const colIndexMulti = (headers: string[], names: string[]) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const nf1Idx = colIndex(headers1, "Nota fiscal");
      const tktIdx = colIndex(headers1, "Ticket ID");
      const dateIdx = colIndex(headers1, "Data de criação");
      const mesIdx = colIndex(headers1, "Mês");
      const motiveIdx = colIndex(headers1, "Classificação da ocorrência/solicitação");
      const clientIdx = colIndex(headers1, "Cliente");
      const transIdx = colIndexMulti(headers1, [
        "TRANSPORTADORA",
        "CNPJ"
      ]);
      const dtExpIdx = colIndex(headers1, "DATA EXPEDIÇÃO");
      const dtEntIdx = colIndex(headers1, "DATA ENTREGA");
      const devCdIdx = colIndexMulti(headers1, [
        "Mercadoria devolvida no CD?",
        "Mercadoria devolvida no CD",
        "Devolvida no CD?",
        "Devolvida no CD",
        "Devolvida CD",
        "Devolvida CD?",
        "devolvida cd",
        "devolvida cd?",
        "mercadoria devolvida cd",
        "mercadoria devolvida cd?"
      ]);
      const tratativaIdx = colIndex(headers1, "Tratativa");
      const respIdx = colIndex(headers1, "Responsável pela reentrega");
      const cnpjIdx = colIndex(headers1, "CNPJ");
      const statusExpIdx = colIndexMulti(headers1, [
        "Status expedição Reentrega",
        "status expedição",
        "status expedicao",
        "status expedição reentrega",
        "Status Final Reentrega",
        "status final reentrega",
        "status final"
      ]);
      const statusFinalIdx = colIndexMulti(headers1, [
        "Status Final Reentrega",
        "status final reentrega",
        "status final",
        "status final reentrega?"
      ]);
      const novaTransIdx = colIndexMulti(headers1, [
        "Nova transportadora",
        "nova_transportadora"
      ]);
      const prevReenIdx = colIndexMulti(headers1, [
        "Previsão de Reentrega",
        "previsão reentrega",
        "previsao reentrega"
      ]);
      const pedidoIdx = colIndexMulti(headers1, [
        "Pedido",
        "Nº Pedido",
        "Numero Pedido",
        "No Pedido",
        "Pedido Venda",
        "Pedido de Venda"
      ]);
      const motoristaIdx = colIndexMulti(headers1, [
        "Motorista",
        "Nome do Motorista",
        "Nome Motorista",
        "Condutor"
      ]);
      const naoReentregaIdx = colIndexMulti(headers1, [
        "Não reentrega",
        "Não reentrega?",
        "Nao reentrega",
        "Nao reentrega?",
        "Não Re-entrega"
      ]);

      // Build lookup map for Renntregaa by NF to extract valor and peso (representing volumes)
      const nf2Idx = colIndex(headers2, "NF");
      const val2Idx = colIndex(headers2, "VALOR");
      const peso2Idx = colIndex(headers2, "PESO");
      let customTotalCount = 0;
      for (let i = 1; i < renRows.length; i++) {
        const row = renRows[i];
        if (row && row[0] && row[0].trim() !== '') {
          customTotalCount++;
        }
      }
      setTotalRenntregaaCount(customTotalCount);

      const valueMap = new Map();

      for (let i = 1; i < renRows.length; i++) {
        const row = renRows[i];
        const nfVal = row[nf2Idx]?.trim();
        const valVal = row[val2Idx]?.trim() || '';
        const pesoVal = row[peso2Idx]?.trim() || '';
        if (nfVal) {
          valueMap.set(nfVal, { valor: valVal, peso: pesoVal });
        }
      }

      const merged: ReentregaItem[] = [];
      const localOverrides = (() => {
        try {
          const saved = localStorage.getItem('giro_reentrega_overrides');
          return saved ? JSON.parse(saved) : {};
        } catch {
          return {};
        }
      })();

      const deletedIds = (() => {
        try {
          const saved = localStorage.getItem('giro_reentrega_deleted');
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();

      const newItems = (() => {
        try {
          const saved = localStorage.getItem('giro_reentrega_new_items');
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();

      for (let i = 1; i < reRows.length; i++) {
        const row = reRows[i];
        const nfVal = row[nf1Idx]?.trim();
        const tktId = row[tktIdx]?.trim() || `re-${i}`;
        const dateVal = row[dateIdx]?.trim() || '';
        const mesVal = mesIdx !== -1 ? (row[mesIdx]?.trim() || '') : '';
        const motiveJson = row[motiveIdx]?.trim() || 'OUTROS';
        const clientVal = row[clientIdx]?.trim();
        const transValRaw = transIdx !== -1 ? (row[transIdx]?.trim() || '') : '';
        const isNumeric = transValRaw ? /^\d+$/.test(transValRaw) : false;
        const transVal = (transValRaw && !isNumeric) ? transValRaw : 'PROPRIA GIRO';
        const respVal = respIdx !== -1 ? (row[respIdx]?.trim() || '') : '';
        const cnpjVal = cnpjIdx !== -1 ? (row[cnpjIdx]?.trim() || '') : '';

        if (!nfVal || !clientVal) continue;
        if (deletedIds.includes(tktId)) continue;

        // Code extraction rules
        let codCli = '';
        const clientNumMatch = clientVal.match(/^(\d+)/);
        if (clientNumMatch) {
          codCli = clientNumMatch[1];
        } else {
          codCli = cnpjVal ? cnpjVal.slice(0, 8) : 'S/C';
        }

        const dtExpVal = dtExpIdx !== -1 ? (row[dtExpIdx]?.trim() || '') : '';
        const dtEntVal = dtEntIdx !== -1 ? (row[dtEntIdx]?.trim() || '') : '';

        // Arrival date
        const arrivalCdDateStr = dateVal;

        // Volumes & values from lookup or defaults
        const extra = valueMap.get(nfVal);
        const cleanVal = extra ? extra.valor.replace('R$', '').trim() : '0,00';
        let parsedVolumes = 1;
        if (extra && extra.peso) {
          parsedVolumes = Math.max(1, Math.round(parseFloat(extra.peso.replace(',', '.')))) || 1;
        }

        // Days in CD
        const daysCalculated = calculateDaysInCD(arrivalCdDateStr, dtExpVal, tktId);

        // Status Determination
        let resolvedStatus: 'Aguardando Expedição' | 'Expedido' | 'Entregue' | 'Atrasado' = 'Aguardando Expedição';
        const tratText = tratativaIdx !== -1 ? row[tratativaIdx]?.toLowerCase() : '';
        if (dtEntVal || tratText.includes('entregue')) {
          resolvedStatus = 'Entregue';
        } else if (daysCalculated > 5) {
          resolvedStatus = 'Atrasado';
        } else if (dtExpVal || tratText.includes('expedido') || tratText.includes('tránsito') || tratText.includes('transito')) {
          resolvedStatus = 'Expedido';
        } else {
          resolvedStatus = 'Aguardando Expedição';
        }

        // New fields parsing & fallback derivation (Column O = index 14, Column U = index 20)
        const mercadoriaDevolvidaCDVal = devCdIdx !== -1
          ? (row[devCdIdx]?.trim() || '')
          : (row[14] !== undefined ? (row[14]?.trim() || '') : '');

        const statusExpedicaoVal = statusExpIdx !== -1
          ? (row[statusExpIdx]?.trim() || '')
          : (row[19] !== undefined ? (row[19]?.trim() || '') : '');

        const statusFinalReentregaVal = statusFinalIdx !== -1
          ? (row[statusFinalIdx]?.trim() || '')
          : (row[20] !== undefined ? (row[20]?.trim() || '') : '');

        const pedidoVal = pedidoIdx !== -1
          ? (row[pedidoIdx]?.trim() || '')
          : (row[19] !== undefined ? (row[19]?.trim() || '') : '');

        const motoristaVal = motoristaIdx !== -1
          ? (row[motoristaIdx]?.trim() || '')
          : (row[13] !== undefined ? (row[13]?.trim() || '') : '');

        const naoReentregaVal = naoReentregaIdx !== -1
          ? (row[naoReentregaIdx]?.trim() || '')
          : (row[26] !== undefined ? (row[26]?.trim() || '') : '');

        const dataColunaVVal = row[21] !== undefined
          ? (row[21]?.trim() || '')
          : '';

        let novaTransportadoraVal = novaTransIdx !== -1 ? (row[novaTransIdx]?.trim() || '') : '';
        if (!novaTransportadoraVal) {
          novaTransportadoraVal = transVal || 'Não Informada';
        }

        let previsaoReentregaVal = prevReenIdx !== -1 ? (row[prevReenIdx]?.trim() || '') : '';
        if (!previsaoReentregaVal) {
          previsaoReentregaVal = dtEntVal || dtExpVal || '';
        }

        const tratativaVal = tratativaIdx !== -1 ? (row[tratativaIdx]?.trim() || '') : '';

        const baseItem: ReentregaItem = {
          id: tktId,
          nf: nfVal,
          date: dateVal,
          cliente: clientVal,
          codigoCliente: codCli,
          motivo: motiveJson,
          dataChegadaCD: arrivalCdDateStr,
          dataExpedicao: dtExpVal,
          volumes: parsedVolumes,
          transportadora: transVal,
          status: resolvedStatus,
          responsavel: respVal || 'Não Definido',
          valor: cleanVal,
          prioridade: 'MÉDIA',
          
          // Set new fields
          mercadoriaDevolvidaCD: mercadoriaDevolvidaCDVal,
          statusExpedicao: statusExpedicaoVal,
          statusFinalReentrega: statusFinalReentregaVal,
          novaTransportadora: novaTransportadoraVal,
          previsaoReentrega: previsaoReentregaVal,
          tratativa: tratativaVal,
          mes: mesVal,
          pedido: pedidoVal,
          motorista: motoristaVal,
          naoReentrega: naoReentregaVal,
          dataColunaV: dataColunaVVal
        };

        // Apply local overrides
        if (localOverrides[tktId]) {
          Object.assign(baseItem, localOverrides[tktId]);
        }

        merged.push(baseItem);
      }

      // Combine newItems and sheet items
      setData([...newItems, ...merged]);
    } catch (err: any) {
      console.error(err);
      setErrorObj(err.message || 'Erro desconhecido ao carregar planilha.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const savePropOverride = (id: string, props: Partial<ReentregaItem>) => {
    let wasNewLocal = false;
    try {
      const saved = localStorage.getItem('giro_reentrega_new_items');
      if (saved) {
        const list = JSON.parse(saved);
        const index = list.findIndex((x: any) => x.id === id);
        if (index !== -1) {
          wasNewLocal = true;
          list[index] = { ...list[index], ...props };
          localStorage.setItem('giro_reentrega_new_items', JSON.stringify(list));
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (!wasNewLocal) {
      try {
        const saved = localStorage.getItem('giro_reentrega_overrides');
        const overrides = saved ? JSON.parse(saved) : {};
        overrides[id] = { ...(overrides[id] || {}), ...props };
        localStorage.setItem('giro_reentrega_overrides', JSON.stringify(overrides));
      } catch (e) {
        console.error(e);
      }
    }

    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, ...props };
      }
      return item;
    }));
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setEditId(null);
    setFormNf('');
    setFormCliente('');
    setFormCodigoCliente('');
    setFormMotivo('');
    setFormVolumes(1);
    setFormTransportadora('');
    setFormStatus('Aguardando Expedição');
    setFormResponsavel('');
    setFormValor('');
    setFormPrioridade('MÉDIA');
    
    // Set default new fields
    setFormMercadoriaDevolvidaCD('Sim');
    setFormStatusExpedicao('Aguardando Programação');
    setFormNovaTransportadora('');
    setFormPrevisaoReentrega('');
    setFormTratativa('');
    setFormPedido('');
    setFormMotorista('');
    setFormNaoReentrega('');
    
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    setFormDataChegadaCD(formattedDate);
    setFormDataExpedicao('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ReentregaItem) => {
    setModalMode('edit');
    setEditId(item.id);
    setFormNf(item.nf);
    setFormCliente(item.cliente);
    setFormCodigoCliente(item.codigoCliente);
    setFormMotivo(item.motivo);
    setFormVolumes(item.volumes);
    setFormTransportadora(item.transportadora);
    setFormStatus(item.status);
    setFormResponsavel(item.responsavel);
    setFormValor(item.valor);
    setFormPrioridade(item.prioridade || 'MÉDIA');
    setFormDataChegadaCD(item.dataChegadaCD);
    setFormDataExpedicao(item.dataExpedicao);
    
    // Set edit values
    setFormMercadoriaDevolvidaCD(item.mercadoriaDevolvidaCD || 'Sim');
    setFormStatusExpedicao(item.statusExpedicao || 'Aguardando Programação');
    setFormNovaTransportadora(item.novaTransportadora || item.transportadora || '');
    setFormPrevisaoReentrega(item.previsaoReentrega || '');
    setFormTratativa(item.tratativa || '');
    setFormPedido(item.pedido || '');
    setFormMotorista(item.motorista || '');
    setFormNaoReentrega(item.naoReentrega || '');
    
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja realmente remover permanentemente este monitoramento de reentrega?')) {
      try {
        const saved = localStorage.getItem('giro_reentrega_deleted');
        const list = saved ? JSON.parse(saved) : [];
        if (!list.includes(id)) {
          list.push(id);
          localStorage.setItem('giro_reentrega_deleted', JSON.stringify(list));
        }
      } catch (e) {
        console.error(e);
      }

      try {
        const saved = localStorage.getItem('giro_reentrega_new_items');
        if (saved) {
          const list = JSON.parse(saved);
          const filtered = list.filter((item: any) => item.id !== id);
          localStorage.setItem('giro_reentrega_new_items', JSON.stringify(filtered));
        }
      } catch (e) {
        console.error(e);
      }

      setData(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNf.trim() || !formCliente.trim() || !formTransportadora.trim()) {
      alert('Por favor, defina a NF, o Nome do Cliente e a Transportadora.');
      return;
    }

    const itemPayload: Partial<ReentregaItem> = {
      nf: formNf,
      date: formDataChegadaCD,
      cliente: formCliente,
      codigoCliente: formCodigoCliente || formCliente.slice(0, 6).replace(/[^0-9]/g, '') || '9999',
      motivo: formMotivo || 'OUTROS',
      dataChegadaCD: formDataChegadaCD,
      dataExpedicao: formDataExpedicao,
      volumes: Number(formVolumes) || 1,
      transportadora: formTransportadora,
      status: formStatus,
      responsavel: formResponsavel || 'Operação CD',
      valor: formValor || '0,00',
      prioridade: formPrioridade,
      mercadoriaDevolvidaCD: formMercadoriaDevolvidaCD,
      statusExpedicao: formStatusExpedicao,
      novaTransportadora: formNovaTransportadora || formTransportadora,
      previsaoReentrega: formPrevisaoReentrega || formDataExpedicao,
      tratativa: formTratativa,
      pedido: formPedido,
      motorista: formMotorista,
      naoReentrega: formNaoReentrega
    };

    if (modalMode === 'add') {
      const newItem: ReentregaItem = {
        id: 'TKT-' + new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
        nf: itemPayload.nf!,
        date: itemPayload.date!,
        cliente: itemPayload.cliente!,
        codigoCliente: itemPayload.codigoCliente!,
        motivo: itemPayload.motivo!,
        dataChegadaCD: itemPayload.dataChegadaCD!,
        dataExpedicao: itemPayload.dataExpedicao!,
        volumes: itemPayload.volumes!,
        transportadora: itemPayload.transportadora!,
        status: itemPayload.status!,
        responsavel: itemPayload.responsavel!,
        valor: itemPayload.valor!,
        prioridade: itemPayload.prioridade!,
        mercadoriaDevolvidaCD: itemPayload.mercadoriaDevolvidaCD!,
        statusExpedicao: itemPayload.statusExpedicao!,
        novaTransportadora: itemPayload.novaTransportadora!,
        previsaoReentrega: itemPayload.previsaoReentrega!,
        tratativa: itemPayload.tratativa!,
        pedido: itemPayload.pedido!,
        motorista: itemPayload.motorista!,
        naoReentrega: itemPayload.naoReentrega!
      };

      try {
        const saved = localStorage.getItem('giro_reentrega_new_items');
        const list = saved ? JSON.parse(saved) : [];
        list.unshift(newItem);
        localStorage.setItem('giro_reentrega_new_items', JSON.stringify(list));
      } catch (err) {
        console.error(err);
      }

      setData(prev => [newItem, ...prev]);
    } else if (editId) {
      let wasNewLocal = false;
      try {
        const saved = localStorage.getItem('giro_reentrega_new_items');
        if (saved) {
          const list = JSON.parse(saved);
          const index = list.findIndex((x: any) => x.id === editId);
          if (index !== -1) {
            wasNewLocal = true;
            list[index] = { ...list[index], ...itemPayload };
            localStorage.setItem('giro_reentrega_new_items', JSON.stringify(list));
          }
        }
      } catch (err) {
        console.error(err);
      }

      if (!wasNewLocal) {
        try {
          const saved = localStorage.getItem('giro_reentrega_overrides');
          const overrides = saved ? JSON.parse(saved) : {};
          overrides[editId] = { ...(overrides[editId] || {}), ...itemPayload };
          localStorage.setItem('giro_reentrega_overrides', JSON.stringify(overrides));
        } catch (err) {
          console.error(err);
        }
      }

      setData(prev => prev.map(item => {
        if (item.id === editId) {
          return { ...item, ...itemPayload } as ReentregaItem;
        }
        return item;
      }));
    }

    setIsModalOpen(false);
  };

  // Get dynamic Filter Options from currently available data
  const distinctMonths = useMemo(() => {
    const list = new Set<string>();
    data.forEach(item => {
      // we can try getting from "mes" or just parsing parts of ticket date
      const parts = item.date.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[1]);
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        list.add(months[m - 1] || 'Outro');
      } else {
        list.add('Sem Data');
      }
    });
    return Array.from(list);
  }, [data]);

  const distinctClients = useMemo(() => {
    const list = new Set<string>();
    data.forEach(item => { if (item.cliente) list.add(item.cliente.trim().toUpperCase()); });
    return Array.from(list).sort();
  }, [data]);

  const distinctMotives = useMemo(() => {
    const list = new Set<string>();
    data.forEach(item => { if (item.motivo) list.add(item.motivo.trim().toUpperCase()); });
    return Array.from(list).sort();
  }, [data]);

  const distinctCarriers = useMemo(() => {
    const list = new Set<string>();
    data.forEach(item => { if (item.transportadora) list.add(item.transportadora.trim().toUpperCase()); });
    return Array.from(list).sort();
  }, [data]);

  // Main filter engine
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Período
      if (periodFilter !== 'TODOS') {
        const parts = item.date.split('/');
        if (parts.length === 3) {
          const m = parseInt(parts[1]);
          const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          const itemMonth = months[m - 1] || 'Outro';
          if (itemMonth !== periodFilter) return false;
        } else return false;
      }

      // Cliente
      if (clientFilter !== 'TODOS' && item.cliente.trim().toUpperCase() !== clientFilter) return false;

      // Motivo
      if (motiveFilter !== 'TODOS' && item.motivo.trim().toUpperCase() !== motiveFilter) return false;

      // Transportadora
      if (carrierFilter !== 'TODOS' && item.transportadora.trim().toUpperCase() !== carrierFilter) return false;

      // Status
      if (statusFilter !== 'TODOS') {
        if (statusFilter === 'Aguardando Expedição') {
          const is1906 = item.date && (item.date.includes('19/06') || item.date.includes('19-06'));
          if (item.status !== 'Aguardando Expedição' || !is1906) return false;
        } else {
          if (item.status !== statusFilter) return false;
        }
      }

      // Ticket ID
      if (ticketFilter.trim() && !item.id.toLowerCase().includes(ticketFilter.toLowerCase())) return false;

      // NF
      if (nfFilter.trim() && !item.nf.toLowerCase().includes(nfFilter.toLowerCase())) return false;

      // Search term (General query)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTkt = item.id.toLowerCase().includes(q);
        const matchNf = item.nf.toLowerCase().includes(q);
        const matchCli = item.cliente.toLowerCase().includes(q);
        const matchMot = item.motivo.toLowerCase().includes(q);
        const matchTrans = item.transportadora.toLowerCase().includes(q);
        if (!matchTkt && !matchNf && !matchCli && !matchMot && !matchTrans) return false;
      }

      return true;
    });
  }, [data, periodFilter, clientFilter, motiveFilter, carrierFilter, statusFilter, ticketFilter, nfFilter, searchTerm]);

  // KPIs Calculations
  const kpis = useMemo(() => {
    const total = totalRenntregaaCount;
    // Aguardando Expedição count specifically for 19/06 as requested before
    const aguardando = filteredData.filter(item => 
      item.status === 'Aguardando Expedição' && 
      (item.date && (item.date.includes('19/06') || item.date.includes('19-06')))
    ).length;
    const transporte = filteredData.filter(item => item.status === 'Expedido').length;
    const concluidas = filteredData.filter(item => item.status === 'Entregue').length;
    const atrasadas = filteredData.filter(item => {
      const days = calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id);
      return days > 5 && item.status !== 'Entregue';
    }).length;
    return { total, aguardando, transporte, concluidas, atrasadas };
  }, [filteredData, totalRenntregaaCount]);

  // 1. Card 1 (Total Pendente no CD)
  const totalPendenteCD = useMemo(() => {
    const uniqueIds = new Set<string>();
    filteredData.forEach(item => {
      // Puxa da coluna Mercadoria devolvida no CD todos que estão com 'Sim' ou 'S'
      const dev = (item.mercadoriaDevolvidaCD || '').trim().toLowerCase();
      const isSim = dev === 'sim' || dev === 's' || dev.startsWith('sim') || dev.startsWith('s');
      if (!isSim) return;

      const statusFinal = (item.statusFinalReentrega || '').trim();
      const statusFinalLower = statusFinal.toLowerCase();

      // É pendente se a coluna Status Final estiver vazia, "Aguardando Programação", ou "Aguardando Roteirização"
      const isPending = 
        statusFinal === '' || 
        statusFinalLower.includes('aguardando') || 
        statusFinalLower.includes('program') || 
        statusFinalLower.includes('roteir') || 
        statusFinalLower.includes('roter');

      if (isPending) {
        if (item.id) {
          uniqueIds.add(item.id.trim());
        }
      }
    });
    return uniqueIds.size;
  }, [filteredData]);

  // 2. Card 2 (Aguardando Programação)
  const aguardandoProgramacaoCount = useMemo(() => {
    const uniqueIds = new Set<string>();
    filteredData.forEach(item => {
      // Puxa da coluna Mercadoria devolvida no CD todos que estão com 'Sim' ou 'S'
      const dev = (item.mercadoriaDevolvidaCD || '').trim().toLowerCase();
      const isSim = dev === 'sim' || dev === 's' || dev.startsWith('sim') || dev.startsWith('s');
      if (!isSim) return;

      const statusFinal = (item.statusFinalReentrega || '').trim();
      const statusFinalLower = statusFinal.toLowerCase();

      // É Aguardando Programação se for vazio ou "Aguardando Programação" na coluna U,
      // contanto que não seja "Aguardando Roteirização" ou "expedido"
      const isAguardando = 
        statusFinal === '' || 
        statusFinalLower.includes('aguardando programação') || 
        statusFinalLower.includes('aguardando programacao') || 
        statusFinalLower.includes('programação') || 
        statusFinalLower.includes('programacao');

      const isRoteirizacao = statusFinalLower.includes('roteir') || statusFinalLower.includes('roter');
      const isExpedido = statusFinalLower.includes('expedido');

      if (isAguardando && !isRoteirizacao && !isExpedido) {
        if (item.id) {
          uniqueIds.add(item.id.trim());
        }
      }
    });
    return uniqueIds.size;
  }, [filteredData]);

  // 3. Card 3 (Mercadorias Expedidas) - Calculado pelos itens com status 'expedido' na coluna U nos últimos 30 dias (data da coluna C)
  const mercadoriasExpedidasCount = useMemo(() => {
    let referenceDate = new Date();
    let maxFound: Date | null = null;
    filteredData.forEach(item => {
      if (item.date) {
        const d = parseFlexibleDate(item.date);
        if (d) {
          if (!maxFound || d.getTime() > maxFound.getTime()) {
            maxFound = d;
          }
        }
      }
    });
    if (maxFound) {
      referenceDate = maxFound;
    }

    const thirtyDaysAgo = new Date(referenceDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const uniqueIds = new Set<string>();
    filteredData.forEach(item => {
      const statusExp = (item.statusExpedicao || '').trim().toLowerCase();
      const statusFinal = (item.statusFinalReentrega || '').trim().toLowerCase();

      // Expedida se qualquer uma for 'expedido', contanto que a coluna principal de expedição não indique que está aguardando/pendente
      const isExpedido = (statusExp.includes('expedido') || statusFinal.includes('expedido')) && !(statusExp === '' || statusExp.includes('aguardando'));

      if (isExpedido) {
        if (item.date) {
          const parsedDate = parseFlexibleDate(item.date);
          if (parsedDate && parsedDate >= thirtyDaysAgo && parsedDate <= referenceDate) {
            if (item.id) {
              uniqueIds.add(item.id.trim());
            }
          }
        }
      }
    });

    return uniqueIds.size;
  }, [filteredData]);

  // Find the latest month name dynamically and display it
  const latestMonthLabel = useMemo(() => {
    const monthsOrder = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    
    const getItemMonth = (item: ReentregaItem): string => {
      if (item.mes) return item.mes.toLowerCase().trim();
      if (item.date) {
        const parsed = parseFlexibleDate(item.date);
        if (parsed) {
          return monthsOrder[parsed.getMonth()];
        }
      }
      return '';
    };

    const availableMonths = Array.from(
      new Set(
        filteredData
          .map(item => getItemMonth(item))
          .filter(Boolean)
      )
    ) as string[];

    availableMonths.sort((a, b) => {
      const idxA = monthsOrder.indexOf(a);
      const idxB = monthsOrder.indexOf(b);
      return idxB - idxA;
    });

    return availableMonths[0] ? availableMonths[0].toUpperCase() : 'JUNHO';
  }, [filteredData]);

  // Chart 1: Distribuição por Transportadora (Horizontal Bar Chart) - Last Month only, Column P
  const chartNovaTransportadora = useMemo(() => {
    const monthsOrder = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    
    const getItemMonth = (item: ReentregaItem): string => {
      if (item.mes) return item.mes.toLowerCase().trim();
      if (item.date) {
        const parsed = parseFlexibleDate(item.date);
        if (parsed) {
          return monthsOrder[parsed.getMonth()];
        }
      }
      return '';
    };

    const availableMonths = Array.from(
      new Set(
        filteredData
          .map(item => getItemMonth(item))
          .filter(Boolean)
      )
    ) as string[];

    availableMonths.sort((a, b) => {
      const idxA = monthsOrder.indexOf(a);
      const idxB = monthsOrder.indexOf(b);
      return idxB - idxA;
    });

    const latestMonth = availableMonths[0] || 'junho';

    const counts: Record<string, number> = {};
    
    filteredData.forEach(item => {
      const m = getItemMonth(item);
      if (m === latestMonth) {
        // Pull original transportadora (Column P)
        const transName = item.transportadora?.trim() || 'PROPRIA GIRO';
        counts[transName] = (counts[transName] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredData]);

  // Chart 2: Motoristas mais Reincidentes de Reentregas (Coluna N) - Last Month only
  const chartMotoristasReincidentes = useMemo(() => {
    const monthsOrder = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    
    const getItemMonth = (item: ReentregaItem): string => {
      if (item.mes) return item.mes.toLowerCase().trim();
      if (item.date) {
        const parsed = parseFlexibleDate(item.date);
        if (parsed) {
          return monthsOrder[parsed.getMonth()];
        }
      }
      return '';
    };

    const availableMonths = Array.from(
      new Set(
        filteredData
          .map(item => getItemMonth(item))
          .filter(Boolean)
      )
    ) as string[];

    availableMonths.sort((a, b) => {
      const idxA = monthsOrder.indexOf(a);
      const idxB = monthsOrder.indexOf(b);
      return idxB - idxA;
    });

    const latestMonth = availableMonths[0] || 'junho';

    const counts: Record<string, number> = {};
    
    filteredData.forEach(item => {
      const m = getItemMonth(item);
      if (m === latestMonth) {
        const name = item.motorista?.trim() || '';
        if (name && name !== '-' && name.toUpperCase() !== 'N/A' && name.toUpperCase() !== 'NÃO INFORMADO') {
          const key = name.toUpperCase();
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8); // Top 8 reoffending drivers for better spacing
  }, [filteredData]);

  // Chart 3: Distribuição por Motivo (Column D) - Last Month only
  const chartMotivosLastMonth = useMemo(() => {
    const monthsOrder = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    
    const getItemMonth = (item: ReentregaItem): string => {
      if (item.mes) return item.mes.toLowerCase().trim();
      if (item.date) {
        const parsed = parseFlexibleDate(item.date);
        if (parsed) {
          return monthsOrder[parsed.getMonth()];
        }
      }
      return '';
    };

    const availableMonths = Array.from(
      new Set(
        filteredData
          .map(item => getItemMonth(item))
          .filter(Boolean)
      )
    ) as string[];

    availableMonths.sort((a, b) => {
      const idxA = monthsOrder.indexOf(a);
      const idxB = monthsOrder.indexOf(b);
      return idxB - idxA;
    });

    const latestMonth = availableMonths[0] || 'junho';

    const counts: Record<string, number> = {};
    
    filteredData.forEach(item => {
      const m = getItemMonth(item);
      if (m === latestMonth) {
        const rawMotivo = item.motivo?.trim() || 'Outros / Não Especificado';
        const cleanedMotivo = rawMotivo
          .replace(/^(transporte|cliente|operação|operacao|loja)\s*[\u203a\u00bb\u2192>\-:|]+\s*/i, '')
          .trim();
        counts[cleanedMotivo] = (counts[cleanedMotivo] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredData]);

  // Cronograma: Previsão de Saídas (Line Chart)
  const chartPrevisaoReentrega = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const dateStr = item.previsaoReentrega || 'Sem Previsão';
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, quantidade]) => {
        const parsed = parseFlexibleDate(date);
        return { date, quantidade, timestamp: parsed ? parsed.getTime() : 0 };
      })
      .sort((a, b) => {
        if (a.date === 'Sem Previsão') return 1;
        if (b.date === 'Sem Previsão') return -1;
        return a.timestamp - b.timestamp;
      });
  }, [filteredData]);

  // Sorted main table data by Previsão de Reentrega (Ordem Crescente)
  const sortedTableData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const dateA = parseFlexibleDate(a.previsaoReentrega || '');
      const dateB = parseFlexibleDate(b.previsaoReentrega || '');
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredData]);

  // Tempo Médio de Reexpedição
  const avgReexpedicao = useMemo(() => {
    const dispatched = data.filter(item => item.status === 'Expedido' || item.status === 'Entregue');
    if (dispatched.length === 0) return '3,2 dias';
    const totalDays = dispatched.reduce((sum, item) => {
      const days = calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id);
      return sum + days;
    }, 0);
    return ((totalDays / dispatched.length)).toFixed(1).replace('.', ',') + ' dias';
  }, [data]);

  // SLA Geral (%)
  const slaGeral = useMemo(() => {
    const active = data.length;
    if (active === 0) return '100%';
    const insideSLA = data.filter(item => {
      const days = calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id);
      return days <= 5;
    }).length;
    return ((insideSLA / active) * 100).toFixed(1) + '%';
  }, [data]);

  // Sem Movimentação (>48h)
  const semMovimentacaoCount = useMemo(() => {
    return filteredData.filter(item => {
      if (item.status === 'Entregue') return false;
      const days = calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id);
      return days >= 2;
    }).length;
  }, [filteredData]);

  // Flow step counts
  const flowCounts = useMemo(() => {
    const total = filteredData.length;
    const pending = filteredData.filter(item => item.status === 'Aguardando Expedição');
    
    // Find latest month to filter retorno
    const monthsOrder = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const getItemMonth = (item: ReentregaItem): string => {
      if (item.mes) return item.mes.toLowerCase().trim();
      if (item.date) {
        const parsed = parseFlexibleDate(item.date);
        if (parsed) {
          return monthsOrder[parsed.getMonth()];
        }
      }
      return '';
    };

    const availableMonths = Array.from(
      new Set(
        filteredData
          .map(item => getItemMonth(item))
          .filter(Boolean)
      )
    ) as string[];

    availableMonths.sort((a, b) => {
      const idxA = monthsOrder.indexOf(a);
      const idxB = monthsOrder.indexOf(b);
      return idxB - idxA;
    });

    const latestMonth = availableMonths[0] || 'junho';
    const lastMonthData = filteredData.filter(item => getItemMonth(item) === latestMonth);

    // Retorno ao CD: count those where Column AA has "Não reentrega" and belongs to latestMonth
    const retorno = lastMonthData.filter(item => {
      const val = (item.naoReentrega || '').trim().toLowerCase();
      const normalized = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("nao reentrega");
    }).length;
    // Triagem: count those where Column U has "Sim" and belongs to latestMonth
    const triagem = lastMonthData.filter(item => {
      const val = (item.mercadoriaDevolvidaCD || '').trim().toLowerCase();
      const normalized = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized === "sim";
    }).length;
    // Separação: Days in CD > 2 and <= 4 and pending re-expedition
    const separacao = pending.filter(item => {
      const d = calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id);
      return d > 2 && d <= 4;
    }).length;
    // Expedição: Days in CD > 4 or with expedito trigger waiting
    const expedicao = pending.filter(item => calculateDaysInCD(item.dataChegadaCD, item.dataExpedicao, item.id) > 4).length;
    // Em Transporte: status === 'Expedido'
    const emTransporte = filteredData.filter(item => item.status === 'Expedido').length;
    // Entregue: status === 'Entregue'
    const entregue = filteredData.filter(item => item.status === 'Entregue').length;

    return { retorno, triagem, separacao, expedicao, emTransporte, entregue };
  }, [filteredData]);

  // Detalhamento de Reentrega using Date from Column V (only those filled)
  const detalhamentoReentrega = useMemo(() => {
    const groups: Record<string, { date: string, rawDate: string, status: string, total: number, items: ReentregaItem[] }> = {};

    filteredData.forEach(item => {
      const dateStr = item.dataColunaV?.trim() || '';
      if (!dateStr) return; // Only process items with a date in Column V

      const formattedDate = formatColumnVDate(dateStr);
      const statusStr = item.status || 'Aguardando Expedição';
      
      const key = `${formattedDate}_${statusStr}`;
      if (!groups[key]) {
        groups[key] = {
          date: formattedDate,
          rawDate: dateStr,
          status: statusStr,
          total: 0,
          items: []
        };
      }
      groups[key].total += 1;
      groups[key].items.push(item);
    });

    return Object.values(groups).sort((a, b) => {
      const parseDate = (d: string) => {
        const parsed = parseFlexibleDate(d);
        return parsed ? parsed.getTime() : 0;
      };
      return parseDate(b.rawDate) - parseDate(a.rawDate);
    });
  }, [filteredData]);

  // Chart: Reentregas por Motivo (Horizontal Bars sorted Descending)
  const chartMotivos = useMemo(() => {
    const counts = {
      "Fora do horário de recebimento": 0,
      "Endereço não localizado": 0,
      "Restrição de acesso": 0,
      "Loja fechada": 0,
      "Cliente em balanço": 0,
      "Recusa": 0,
      "Outros": 0
    };

    filteredData.forEach(item => {
      const text = item.motivo.toLowerCase();
      if (text.includes('horário') || text.includes('horario') || text.includes('agenda')) {
        counts["Fora do horário de recebimento"]++;
      } else if (text.includes('endereço') || text.includes('endereco') || text.includes('localizar') || text.includes('localizado')) {
        counts["Endereço não localizado"]++;
      } else if (text.includes('restrição') || text.includes('restricao') || text.includes('acesso') || text.includes('difícil')) {
        counts["Restrição de acesso"]++;
      } else if (text.includes('fechada') || text.includes('fechado')) {
        counts["Loja fechada"]++;
      } else if (text.includes('balanço') || text.includes('balanco')) {
        counts["Cliente em balanço"]++;
      } else if (text.includes('recusa') || text.includes('recusou') || text.includes('recusado')) {
        counts["Recusa"]++;
      } else {
        counts["Outros"]++;
      }
    });

    return Object.entries(counts)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredData]);

  // Reentregas por Transportadora Performance Data
  const carrierPerformance = useMemo(() => {
    const total = filteredData.length || 1;
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const transName = item.transportadora?.trim().toUpperCase() || 'PROPRIA GIRO';
      counts[transName] = (counts[transName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, quantidade]) => ({ 
        name, 
        quantidade,
        percent: ((quantidade / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredData]);

  // Critical occurrences - limited exactly to "Total Pendente no CD"
  const criticalCases = useMemo(() => {
    const list = filteredData.filter(item => {
      // Filter by custom Nota Fiscal search if provided
      if (criticalSearchNf.trim()) {
        const nfVal = (item.nf || '').trim().toLowerCase();
        if (!nfVal.includes(criticalSearchNf.trim().toLowerCase())) {
          return false;
        }
      }

      // Only use what is in "Total Pendente no CD"
      // Puxa da coluna Mercadoria devolvida no CD todos que estão com 'Sim' ou 'S'
      const dev = (item.mercadoriaDevolvidaCD || '').trim().toLowerCase();
      const isSim = dev === 'sim' || dev === 's' || dev.startsWith('sim') || dev.startsWith('s');
      if (!isSim) return false;

      // Ligação com a coluna status final reentrega (statusFinalReentrega)
      const statusFinal = (item.statusFinalReentrega || '').trim().toLowerCase();

      // O que estiver com o nome 'expedido' ou 'entregue'/'entrega' não mostra no total pendente
      const isExpedidoOrEntregue = statusFinal.includes('expedido') || statusFinal.includes('entregue') || statusFinal.includes('entrega');
      if (isExpedidoOrEntregue) return false;

      // Apenas o que está vazio, "Aguardando Programação" ou "Aguardando Roteirização"
      const isEmpty = statusFinal === '';
      const isAguardandoProgramacao = statusFinal.includes('aguardando programação') || statusFinal.includes('aguardando programacao') || statusFinal.includes('programação') || statusFinal.includes('programacao');
      const isAguardandoRoteirizacao = statusFinal.includes('aguardando roteirização') || statusFinal.includes('aguardando roteirizacao') || statusFinal.includes('roteirização') || statusFinal.includes('roteirizacao') || statusFinal.includes('roterização') || statusFinal.includes('roterizacao') || statusFinal.includes('roteiriz') || statusFinal.includes('roteriz');

      return isEmpty || isAguardandoProgramacao || isAguardandoRoteirizacao;
    });

    // Keep only the first occurrence for each unique item.id (Ticket ID)
    const seen = new Set<string>();
    return list.filter(item => {
      const tktId = (item.id || '').trim();
      if (!tktId) return true; // If no id, don't filter out
      if (seen.has(tktId)) {
        return false;
      }
      seen.add(tktId);
      return true;
    });
  }, [filteredData, criticalSearchNf]);

  // Chart 3: Reentregas por Status (Percentages)
  const chartStatus = useMemo(() => {
    const total = filteredData.length || 1;
    const noCD = filteredData.filter(item => item.status === 'Aguardando Expedição' || item.status === 'Atrasado').length;
    const expedido = filteredData.filter(item => item.status === 'Expedido' && !item.transportadora).length;
    const emTransporte = filteredData.filter(item => item.status === 'Expedido' && item.transportadora).length;
    const entregue = filteredData.filter(item => item.status === 'Entregue').length;

    return [
      { name: 'No CD', value: noCD, pct: ((noCD / total) * 100).toFixed(0) },
      { name: 'Expedido', value: expedido, pct: ((expedido / total) * 100).toFixed(0) },
      { name: 'Em Transporte', value: emTransporte, pct: ((emTransporte / total) * 100).toFixed(0) },
      { name: 'Entregue', value: entregue, pct: ((entregue / total) * 100).toFixed(0) }
    ].filter(x => x.value > 0);
  }, [filteredData]);

  const COLORS = ['#eab308', '#3b82f6', '#06b6d4', '#10b981'];

  const clearAllFilters = () => {
    setSearchTerm('');
    setPeriodFilter('TODOS');
    setClientFilter('TODOS');
    setMotiveFilter('TODOS');
    setCarrierFilter('TODOS');
    setStatusFilter('TODOS');
    setTicketFilter('');
    setNfFilter('');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#020617] rounded-3xl min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-[0.2em] animate-pulse">
          Sincronizando com as planilhas do Sheets...
        </span>
      </div>
    );
  }

  if (errorObj) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#020617] text-center border border-rose-500/15 rounded-3xl min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500 animate-pulse" />
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
            Falha na Sincronização Google Sheets
          </h3>
          <p className="text-[10px] text-slate-500 max-w-sm font-sans mt-1 leading-relaxed">
            {errorObj}
          </p>
        </div>
        <button 
          onClick={loadAllData}
          className="px-6 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1"
    >
      {/* CONTROL TOWER CORE HEADER */}
      <div className="bg-[#090d1c] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-xl mt-1 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black tracking-[0.2em] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase font-sans">
                Torre de Controle Logística
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1 font-sans">
              CONTROLE DE REENTREGA
            </h2>
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-0.5">
              Gestão operacional das reentregas, SLA, expedições e acompanhamento logístico em tempo real.
            </p>
          </div>
        </div>

        {/* Top Executive Metrics */}
        <div className="grid grid-cols-3 gap-2.5 bg-[#030612] p-3 rounded-xl border border-white/5 text-[10px] font-sans min-w-[280px]">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider">Última atualização</span>
            <span className="text-white font-extrabold mt-0.5 text-[10px] truncate">
              {new Date().toLocaleDateString('pt-BR')}
            </span>
            <span className="text-slate-500 text-[8px]">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} UTC</span>
          </div>
          <div className="flex flex-col border-l border-white/5 pl-3">
            <span className="text-[8px] text-amber-500 font-extrabold uppercase tracking-wider">TMR Médio</span>
            <span className="text-amber-400 font-black mt-0.5">{avgReexpedicao}</span>
            <span className="text-slate-500 text-[7px] uppercase font-bold">No CD</span>
          </div>
          <div className="flex flex-col border-l border-white/5 pl-3">
            <span className="text-[8px] text-emerald-500 font-extrabold uppercase tracking-wider">SLA Geral</span>
            <span className="text-emerald-400 font-black mt-0.5">{slaGeral}</span>
            <span className="text-slate-500 text-[7px] uppercase font-bold">Meta &gt;90%</span>
          </div>
        </div>
      </div>

      {/* FIRST LINE - GENERAL VOLUMES VISION (3 Scorecard Components) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Pendente no CD */}
        <div className="bg-[#05070e]/80 hover:bg-[#070b16]/90 border border-rose-500/15 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition duration-200 relative overflow-hidden group min-h-[120px] tech-border">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Total Pendente no CD
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-black text-white tracking-tight font-sans">
              {totalPendenteCD}
            </span>
            <span className="text-[9px] text-slate-400 font-bold">Tickets Únicos</span>
          </div>
          <div className="text-[8.5px] text-slate-500 mt-2 font-sans leading-relaxed border-t border-white/5 pt-2 flex justify-between items-center">
            <span>Devolvida CD = Sim | Status = Vazio, Prog. ou Rot.</span>
            <ClipboardList className="w-3.5 h-3.5 text-rose-500/60" />
          </div>
        </div>

        {/* Card 2: Aguardando Programação */}
        <div className="bg-[#05070e]/80 hover:bg-[#070b16]/90 border border-amber-500/15 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition duration-200 relative overflow-hidden group min-h-[120px] tech-border">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Aguardando Programação
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-black text-white tracking-tight font-sans">
              {aguardandoProgramacaoCount}
            </span>
            <span className="text-[9px] text-slate-400 font-bold">Tickets Únicos</span>
          </div>
          <div className="text-[8.5px] text-slate-500 mt-2 font-sans leading-relaxed border-t border-white/5 pt-2 flex justify-between items-center">
            <span>Status Final = Aguardando Programação</span>
            <Clock className="w-3.5 h-3.5 text-amber-500/60" />
          </div>
        </div>

        {/* Card 3: Mercadorias Expedidas */}
        <div className="bg-[#05070e]/80 hover:bg-[#070b16]/90 border border-blue-500/15 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition duration-200 relative overflow-hidden group min-h-[120px] tech-border">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Mercadorias Expedidas (Últimos 30 Dias)
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-black text-white tracking-tight font-sans">
              {mercadoriasExpedidasCount}
            </span>
            <span className="text-[9px] text-slate-400 font-bold">Tickets Únicos</span>
          </div>
          <div className="text-[8.5px] text-slate-500 mt-2 font-sans leading-relaxed border-t border-white/5 pt-2 flex justify-between items-center">
            <span>Total expedido nos últimos 30 dias</span>
            <Truck className="w-3.5 h-3.5 text-blue-500/60" />
          </div>
        </div>
      </div>

      {/* SECOND LINE - OPERATIONAL FLOW + DETAILING GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left block (Controle de Reentregas - First Two Cards) */}
        <div className="lg:col-span-2 bg-[#090d1c] border border-white/5 rounded-2xl p-6 shadow-md flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest font-sans">
              FLUXO OPERACIONAL LOGÍSTICO (CD)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 h-full">
            {/* STEP 1: REENTREGAS NÃO VOLTARAM AO CD */}
            <div className="bg-[#05070e] border border-white/5 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase leading-tight">REENTREGAS NÃO VOLTARAM AO CD</span>
                <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-sans font-black px-2.5 py-1 rounded leading-none">
                  [{flowCounts.retorno}]
                </span>
              </div>
              <div>
                <div className="h-1 w-full bg-indigo-500/20 rounded mt-4 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '100%' }} />
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block font-sans leading-tight">Mês atual - "Não reentrega" na Coluna AA</span>
              </div>
            </div>

            {/* STEP 2: REENTREGAS QUE VOLTARAM AO CD */}
            <div className="bg-[#05070e] border border-white/5 p-5 rounded-xl flex flex-col justify-between hover:border-yellow-500/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase leading-tight">REENTREGAS QUE VOLTARAM AO CD</span>
                <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-sans font-black px-2.5 py-1 rounded leading-none">
                  [{flowCounts.triagem}]
                </span>
              </div>
              <div>
                <div className="h-1 w-full bg-yellow-500/20 rounded mt-4 overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: '100%' }} />
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block font-sans leading-tight">Mês atual - "Sim" na Coluna U</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right block (Detalhamento - Placed on the right, more compact) */}
        <div className="lg:col-span-3 bg-[#090d1c] border border-white/5 rounded-2xl p-6 shadow-md flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider font-sans">
              DETALHAMENTO DE REENTREGAS (MÊS ATUAL)
            </h3>
          </div>

          <div className="grid grid-cols-3 px-4 mb-1 text-slate-500 font-sans">
            <span className="text-[9px] font-black uppercase tracking-widest">Data</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-center">Status</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-right">Total</span>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
            {detalhamentoReentrega.length === 0 ? (
              <div className="text-center py-8 text-[10px] text-slate-500 uppercase tracking-widest font-sans">
                Nenhuma reentrega registrada com data no mês atual.
              </div>
            ) : (
              detalhamentoReentrega.map((group, idx) => {
                const compositeKey = `${group.date}_${group.status}`;
                const isExpanded = !!expandedDetailingGroups[compositeKey];

                // Pick color classes based on group status
                let statusColorClasses = "text-amber-400 bg-amber-500/5 border border-amber-500/10";
                let statusIcon = <Clock className="w-3 h-3 text-amber-400" />;
                
                if (group.status === 'Entregue') {
                  statusColorClasses = "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10";
                  statusIcon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                } else if (group.status === 'Atrasado') {
                  statusColorClasses = "text-rose-400 bg-rose-500/5 border border-rose-500/10";
                  statusIcon = <AlertCircle className="w-3 h-3 text-rose-400" />;
                } else if (group.status === 'Expedido') {
                  statusColorClasses = "text-blue-400 bg-blue-500/5 border border-blue-500/10";
                  statusIcon = <Truck className="w-3 h-3 text-blue-400" />;
                }

                return (
                  <div key={idx} className="flex flex-col gap-2">
                    <div 
                      onClick={() => {
                        setExpandedDetailingGroups(prev => ({ ...prev, [compositeKey]: !prev[compositeKey] }));
                      }}
                      className={cn(
                        "bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center justify-between transition-all duration-200 group/row cursor-pointer hover:bg-slate-900/60",
                        isExpanded ? "border-blue-500/30 bg-blue-950/5" : ""
                      )}
                    >
                      <div className="w-1/3 flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-center text-slate-500 group-hover/row:text-blue-400"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                        <div className="text-[11px] font-black font-mono text-slate-300 group-hover/row:text-white">
                          {group.date}
                        </div>
                      </div>

                      <div className="w-1/3 flex justify-center">
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wide",
                          statusColorClasses
                        )}>
                          {statusIcon}
                          {group.status}
                        </div>
                      </div>

                      <div className="w-1/3 text-right text-base font-black text-white font-mono tracking-tighter flex justify-end items-center gap-1 pr-2">
                        {group.total}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-[#030612]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 ml-3">
                            <div className="text-[8px] font-black uppercase tracking-widest text-blue-400 border-b border-white/5 pb-1.5 mb-1">
                              Lista de Reentregas ({group.items.length})
                            </div>
                            
                            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                              {group.items.map((item, tIdx) => (
                                <div 
                                  key={tIdx} 
                                  className="bg-[#060a16] border border-white/5 hover:border-slate-800 hover:bg-slate-900/40 transition-colors p-2.5 rounded-xl flex flex-col gap-2 text-left text-[9px]"
                                >
                                  <div className="flex justify-between items-center gap-2 pb-1.5 border-b border-white/5">
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">Cliente</span>
                                      <span className="text-[10px] font-extrabold text-white tracking-wide font-sans uppercase truncate max-w-[140px] sm:max-w-[200px]">
                                        {item.cliente}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-[#0a0f24] px-1.5 py-0.5 rounded border border-white/5">
                                      <span className="text-[8px] font-extrabold text-indigo-400 font-mono">{item.id}</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Ocorrência</span>
                                      <p className="text-slate-300 italic">"{item.motivo}"</p>
                                    </div>
                                    {item.tratativa && (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Tratativa</span>
                                        <p className="text-amber-400/90 font-medium">
                                          {item.tratativa}
                                        </p>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-1.5 mt-0.5">
                                      <div>
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Motorista</span>
                                        <p className="text-white font-bold uppercase truncate">{item.motorista || 'N/I'}</p>
                                      </div>
                                      <div>
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Valor</span>
                                        <p className="text-emerald-400 font-mono font-bold">{formatBRL(item.valor)}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Deck */}
      <div className="glass-card tech-border rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-500" />
            Filtros Operacionais do CD
          </h4>
          <button 
            onClick={clearAllFilters}
            className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-wide flex items-center gap-1 cursor-pointer transition-colors"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-[10px]">
          {/* Ticket Field */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">TICKET ID</label>
            <input 
              type="text" 
              placeholder="Pesquisar Ticket"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2.5 font-sans uppercase focus:outline-none"
            />
          </div>

          {/* NF Field */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">NOTA FISCAL (NF)</label>
            <input 
              type="text" 
              placeholder="Pesquisar NF"
              value={nfFilter}
              onChange={(e) => setNfFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2.5 font-sans uppercase focus:outline-none"
            />
          </div>

          {/* Period Selection */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">MÊS/PERÍODO</label>
            <select 
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 font-sans uppercase focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS OS MESES</option>
              {distinctMonths.map(m => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Cliente option selection */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">CLIENTE DE DESTINO</label>
            <select 
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 font-sans uppercase truncate focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS OS CLIENTES</option>
              {distinctClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Motivo option selection */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">MOTIVO RETORNO</label>
            <select 
              value={motiveFilter}
              onChange={(e) => setMotiveFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 font-sans uppercase truncate focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS OS MOTIVOS</option>
              {distinctMotives.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Transportadora selection */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">TRANSPORTADORA</label>
            <select 
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 font-sans uppercase truncate focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODAS TRANSP.</option>
              {distinctCarriers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status filter dropdown */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">STATUS OPERACIONAL</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 font-sans uppercase focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS</option>
              <option value="Aguardando Expedição">🟡 AGUARDANDO EXP.</option>
              <option value="Expedido">🔵 EXPEDIDO</option>
              <option value="Entregue">🟢 ENTREGUE</option>
              <option value="Atrasado">🔴 ATRASADO</option>
            </select>
          </div>

          {/* Broad Search bar */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-slate-500 uppercase tracking-widest text-[8px]">BUSCA RÁPIDA</label>
            <input 
              type="text" 
              placeholder="Pesquisa Geral"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#040814] text-white border border-white/5 focus:border-emerald-500/30 rounded-xl py-2 px-2 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* PAINEL DE ANÁLISE GRÁFICA (3 EXCLUSIVE GRAPHS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Distribuição por Transportadora */}
        <div className="bg-[#090d1c] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-md min-h-[340px]">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                  <Truck className="w-4 h-4" />
                </span>
                <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-sans">DEVOLUÇÃO POR TRANSPORTADORA</h3>
              </div>
              <span className="text-[7.5px] font-sans text-amber-400 font-bold uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">MÊS: {latestMonthLabel}</span>
            </div>
 
            <div className="h-[260px] w-full text-[9px] font-sans">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartNovaTransportadora} 
                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff40" 
                    tick={{ fill: '#f8fafc', fontSize: 9, fontWeight: 700 }}
                    className="font-bold text-white" 
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={85}
                    tickFormatter={(val) => {
                      if (!val) return '';
                      let cleaned = val.replace(/\(.*\)/g, '').trim();
                      cleaned = cleaned.replace(/\b(LTDA|S\.A|SA|EIRELI|ME|EPP)\b/gi, '').trim();
                      cleaned = cleaned.replace(/\s+/g, ' ');
                      if (cleaned.length > 15) {
                        return cleaned.substring(0, 13) + '..';
                      }
                      return cleaned;
                    }}
                  />
                  <YAxis 
                    stroke="#ffffff40" 
                    tick={{ fill: '#cbd5e1', fontSize: 8 }}
                    className="text-[8px]" 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d1c', borderColor: '#ffffff10', color: '#fff', fontSize: '9px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  />
                  <Bar dataKey="quantidade" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {chartNovaTransportadora.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : index === 2 ? '#6366f1' : '#a855f7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
 
        {/* Gráfico 2: Motoristas mais Reincidentes */}
        <div className="bg-[#090d1c] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-md min-h-[340px]">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400">
                  <User className="w-4 h-4" />
                </span>
                <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-sans">MOTORISTAS MAIS REINCIDENTES</h3>
              </div>
              <span className="text-[7.5px] font-sans text-amber-400 font-bold uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">MÊS: {latestMonthLabel}</span>
            </div>

            <div className="h-[260px] w-full text-[9px] font-sans flex flex-col justify-center">
              {chartMotoristasReincidentes.length === 0 ? (
                <div className="text-slate-500 text-[9px] uppercase tracking-wider text-center py-8 font-sans">Sem dados de motoristas</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={chartMotoristasReincidentes} 
                    margin={{ top: 10, right: 15, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" horizontal={false} />
                    <XAxis 
                      type="number"
                      stroke="#ffffff40" 
                      tick={{ fill: '#cbd5e1', fontSize: 8 }}
                      className="text-[8px]" 
                      tickLine={false}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name" 
                      stroke="#ffffff40" 
                      tick={{ fill: '#f8fafc', fontSize: 9, fontWeight: 700 }}
                      className="font-bold text-white" 
                      width={100}
                      tickLine={false}
                      tickFormatter={(val) => {
                        if (!val) return '';
                        if (val.length > 15) {
                          return val.substring(0, 13) + '..';
                        }
                        return val;
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d1c', borderColor: '#ffffff10', color: '#fff', fontSize: '9px' }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                    />
                    <Bar dataKey="quantidade" fill="#fbbf24" radius={[0, 4, 4, 0]} maxBarSize={16}>
                      {chartMotoristasReincidentes.map((entry, index) => {
                        const colors = ['#f59e0b', '#fbbf24', '#fcd34d', '#fef08a', '#60a5fa', '#93c5fd', '#bae6fd', '#38bdf8'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico 3: Motivos da Reentrega */}
        <div className="bg-[#090d1c] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-md min-h-[340px]">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
                  <ClipboardList className="w-4 h-4" />
                </span>
                <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-sans">MOTIVOS DA REENTREGA</h3>
              </div>
              <span className="text-[7.5px] font-sans text-amber-400 font-bold uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">MÊS: {latestMonthLabel}</span>
            </div>

            <div className="h-[260px] w-full text-[9px] font-sans">
              {chartMotivosLastMonth.length === 0 ? (
                <div className="text-slate-500 text-[9px] uppercase tracking-wider text-center py-8 font-sans">Sem dados para exibir</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartMotivosLastMonth} 
                    margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#ffffff40" 
                      tick={{ fill: '#f8fafc', fontSize: 9, fontWeight: 700 }}
                      className="font-bold text-white" 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={85}
                      tickFormatter={(val) => {
                        if (!val) return '';
                        const cleaned = val
                          .replace(/^(transporte|cliente|operação|operacao|loja)\s*[\u203a\u00bb\u2192>\-:|]+\s*/i, '')
                          .trim();
                        if (cleaned.length > 15) {
                          return cleaned.substring(0, 13) + '..';
                        }
                        return cleaned;
                      }}
                    />
                    <YAxis 
                      stroke="#ffffff40" 
                      tick={{ fill: '#cbd5e1', fontSize: 8 }}
                      className="text-[8px]" 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d1c', borderColor: '#ffffff10', color: '#fff', fontSize: '9px' }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                    />
                    <Bar dataKey="quantidade" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {chartMotivosLastMonth.map((entry, index) => {
                        const colors = ['#a855f7', '#ec4899', '#f43f5e', '#e11d48', '#d946ef', '#8b5cf6', '#6366f1'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* FIFTH LINE - EXCLUSIVE CRITICAL CASES TABLE (SLA AT LIMIT OR EXCEEDED) */}
      <div className="bg-[#0c0606] border border-red-500/15 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-white/5 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <h3 className="text-[10px] font-black uppercase text-red-400 tracking-widest font-sans">
              ⚠️ ALERTA DA TORRE: REENTREGAS CRÍTICAS (STOLA EXCEDIDO / ATRASADOS)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Campo de Busca por Nota Fiscal */}
            <div className="relative">
              <input
                type="text"
                placeholder="BUSCAR NOTA FISCAL..."
                value={criticalSearchNf}
                onChange={(e) => setCriticalSearchNf(e.target.value)}
                className="bg-[#140b0b] text-white border border-red-500/20 focus:border-red-500/50 rounded-lg py-1 pl-7 pr-2.5 font-sans uppercase focus:outline-none text-[8px] font-bold w-40 placeholder-red-500/30"
              />
              <Search className="w-3 h-3 text-red-500/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-[7.5px] font-sans font-black text-rose-500 uppercase bg-rose-500/10 px-2 py-1 rounded border border-rose-500/15">
              Pendente no CD
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[9px] border-collapse">
            <thead>
              <tr className="bg-[#140b0b] text-[8px] text-slate-400 uppercase tracking-wider border-b border-red-500/10">
                <th className="py-2 px-3">Cliente</th>
                <th className="py-2 px-3">Motivo da Reentrega</th>
                <th className="py-2 px-3">Nota Fiscal</th>
                <th className="py-2 px-3">Pedido</th>
                <th className="py-2 px-3">Transportadora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-500/5">
              {criticalCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500 uppercase tracking-widest">
                    Nenhum registro pendente no CD!
                  </td>
                </tr>
              ) : (
                (isCriticalExpanded ? criticalCases : criticalCases.slice(0, 5)).map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-red-500/5 transition-colors">
                      <td className="py-2 px-3 font-extrabold text-white truncate max-w-[150px]">{item.cliente}</td>
                      <td className="py-2 px-3 text-slate-300 truncate max-w-[200px]">{item.motivo}</td>
                      <td className="py-2 px-3 text-amber-400 font-black font-mono">{item.nf || 'N/A'}</td>
                      <td className="py-2 px-3 text-blue-400 font-black font-mono">{item.pedido || 'N/A'}</td>
                      <td className="py-2 px-3 text-slate-400 font-semibold">{item.transportadora || 'NÃO DESIGNADA'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {criticalCases.length > 5 && (
          <div className="flex justify-center mt-3 pt-2 border-t border-red-500/10">
            <button
              onClick={() => setIsCriticalExpanded(!isCriticalExpanded)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-[8.5px] font-black tracking-widest uppercase text-red-400 transition-all duration-150 cursor-pointer shadow-sm"
            >
              <span>{isCriticalExpanded ? 'Ver Menos' : `Ver Mais (${criticalCases.length - 5} Ocultos)`}</span>
              {isCriticalExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* SIXTH LINE - COMPLETE OPERATION DETAILS TABLE PANEL */}
      <div className="glass-card tech-border rounded-3xl overflow-hidden mt-2">
        <div className="bg-[#050917]/90 px-4 py-3 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white uppercase">
            <Building2 className="w-4 h-4 text-emerald-500" />
            VISTA OPERACIONAL COMPLETA (PAINEL DE EXPEDIÇÃO TACH)
          </div>
          <span className="text-[8px] font-sans font-extrabold text-slate-500 bg-slate-900/60 border border-white/5 py-1 px-2.5 rounded-lg uppercase">
            Lotes Totais: {filteredData.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-sans text-left border-collapse">
            <thead>
              <tr className="bg-[#0a0f1d] border-b border-white/5 text-[8.5px] font-black text-slate-400 tracking-widest uppercase">
                <th className="py-3 px-4">Nota fiscal</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Mercadoria devolvida no CD</th>
                <th className="py-3 px-4">Status expedição Reentrega</th>
                <th className="py-3 px-4">Nova transportadora</th>
                <th className="py-3 px-4">Previsão de Reentrega</th>
                <th className="py-3 px-4">Tratativa</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedTableData.length > 0 ? (
                sortedTableData.map((item) => {
                  const isExpanded = !!expandedRows[item.id];
                  
                  // Status expedição Reentrega style conditions
                  let statusExpStyle = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                  const expStatus = (item.statusExpedicao || 'Aguardando Programação').trim();
                  if (expStatus === 'Aguardando Programação') {
                    statusExpStyle = 'text-amber-400 bg-amber-450/10 border-amber-500/20';
                  } else if (expStatus === 'Expedido') {
                    statusExpStyle = 'text-blue-400 bg-blue-400/10 border-blue-500/20';
                  } else if (expStatus === 'Entregue') {
                    statusExpStyle = 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
                  }

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={cn(
                        "hover:bg-slate-900/40 transition-colors duration-150 align-middle",
                        isExpanded && "bg-[#0b101f]/70"
                      )}>
                        {/* 1. Nota fiscal */}
                        <td className="py-3 px-4 font-bold text-white selection:bg-indigo-500/30">
                          {item.nf || 'S/NF'}
                        </td>

                        {/* 2. Cliente */}
                        <td className="py-3 px-4 max-w-[200px]">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-white uppercase truncate" title={item.cliente}>
                              {item.cliente}
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                              Cod: {item.codigoCliente || '---'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Mercadoria devolvida no CD */}
                        <td className="py-3 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-extrabold border leading-none uppercase",
                            (item.mercadoriaDevolvidaCD === 'Sim' || item.mercadoriaDevolvidaCD === 'S') 
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/15" 
                              : "text-slate-400 bg-slate-500/5 border-slate-550/15"
                          )}>
                            {item.mercadoriaDevolvidaCD || 'Sim'}
                          </span>
                        </td>

                        {/* 4. Status expedição Reentrega */}
                        <td className="py-3 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 text-[8px] font-black rounded-full border leading-none tracking-widest uppercase",
                            statusExpStyle
                          )}>
                            <span>
                              {expStatus === 'Entregue' && '🟢'}
                              {expStatus === 'Expedido' && '🔵'}
                              {expStatus === 'Aguardando Programação' && '🟡'}
                            </span>
                            {expStatus}
                          </span>
                        </td>

                        {/* 5. Nova transportadora */}
                        <td className="py-3 px-4 text-slate-300 uppercase font-semibold">
                          {item.novaTransportadora || item.transportadora || 'Propria Giro'}
                        </td>

                        {/* 6. Previsão de Reentrega */}
                        <td className="py-3 px-4 text-center font-bold text-indigo-300">
                          {item.previsaoReentrega || 'Não Informada'}
                        </td>

                        {/* 7. Tratativa */}
                        <td className="py-3 px-4 max-w-[250px] truncate text-slate-400 italic" title={item.tratativa}>
                          {item.tratativa || <span className="text-slate-600 font-normal">Nenhuma tratativa registrada</span>}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => toggleRow(item.id)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 hover:text-white border border-white/5 rounded-lg text-[9px] font-bold flex items-center gap-1 duration-150 transition-colors"
                              title="Visualizar fluxo e histórico"
                            >
                              Fluxo
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 rounded-lg transition-colors border border-blue-500/10"
                              title="Editar registro"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 rounded-lg transition-colors border border-rose-500/10"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Flow details timeline drawer row/cell */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-[#0b101f]/70 border-t border-b border-white/5 p-4">
                              <div className="flex flex-col gap-4 text-[10px]">
                                {/* 3-Column operational statistics dashboard in expanded layout */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/5 pb-4">
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">Informações Gerais do Cliente</span>
                                    <p className="font-extrabold text-[11px] text-white uppercase">{item.cliente}</p>
                                    <p className="text-slate-400 font-sans">Código Cliente: <span className="font-bold text-slate-200">{item.codigoCliente || 'Não Cadastrado'}</span></p>
                                    <p className="text-slate-400 font-sans">Valor Total Nota: <span className="font-bold text-emerald-400">{formatBRL(item.valor)}</span></p>
                                    <p className="text-slate-400 font-sans">Status Coluna AA: <span className="font-bold text-indigo-400">{item.naoReentrega || 'N/A'}</span></p>
                                  </div>

                                  <div className="flex flex-col gap-1.5 border-l border-white/5 pl-4">
                                    <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">Ocorrência Operacional</span>
                                    <p className="text-slate-300 italic font-medium leading-relaxed">"{item.motivo}"</p>
                                    <p className="text-slate-400 font-sans">NF Associada: <span className="font-bold text-white">#{item.nf}</span></p>
                                    <p className="text-slate-400 font-sans">Responsável Reentrega: <span className="font-bold text-indigo-300">{item.responsavel || 'Operação Geral'}</span></p>
                                  </div>

                                  <div className="flex flex-col gap-1.5 border-l border-white/5 pl-4">
                                    <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">Cronologia Logística</span>
                                    <p className="text-slate-400">Data Chegada ao CD: <span className="font-bold text-slate-200 font-sans">{item.dataChegadaCD || '---'}</span></p>
                                    <p className="text-slate-400 font-sans">Data Expedição: <span className="font-bold text-blue-300 font-sans">{item.dataExpedicao || 'Aguardando Expedição'}</span></p>
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <span className="p-1 rounded bg-[#101426] border border-white/5 font-bold text-[8.5px] text-slate-300 uppercase tracking-wider font-sans">
                                        Prioridade do Lote: {item.prioridade || 'MÉDIA'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Flow Timeline Progression Track */}
                                <div className="pt-2">
                                  <h5 className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Fluxo de Passagem Operational (Milestones Reentrega)</h5>
                                  
                                  {/* Stepper progress line renderer */}
                                  <div className="flex items-center justify-between max-w-4xl mx-auto py-2 relative">
                                    {/* background linking bar line */}
                                    <div className="absolute left-[3%] right-[3%] top-[45%] h-[2px] bg-slate-800 z-0" />
                                    
                                    {/* dynamic active progression highlight index */}
                                    {/* 
                                      Steps:
                                      - step 0: CD Arrival (always done)
                                      - step 1: Separation (done)
                                      - step 2: Expedited (done if status Expedido or Entregue)
                                      - step 3: In Transit (done if status Expedido/Entregue and has transportadora)
                                      - step 4: Delivered (done if status Entregue)
                                    */}

                                    {/* Step 1: Chegada CD */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black flex items-center justify-center text-[9px] shadow-[0_0_8px_rgba(16,185,129,0.5)] border border-emerald-400">
                                        ✓
                                      </div>
                                      <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wide">Chegada CD</span>
                                      <span className="text-[7px] text-slate-500">{item.dataChegadaCD}</span>
                                    </div>

                                    {/* Step 2: Separação */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full font-black flex items-center justify-center text-[9px] border",
                                        item.status !== 'Aguardando Expedição' 
                                          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                          : "bg-yellow-500/20 text-yellow-500 border-yellow-500/40 animate-pulse"
                                      )}>
                                        {item.status !== 'Aguardando Expedição' ? '✓' : '...'}
                                      </div>
                                      <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wide",
                                        item.status !== 'Aguardando Expedição' ? "text-emerald-400" : "text-yellow-500"
                                      )}>Separação</span>
                                      <span className="text-[7px] text-slate-500">Concluída</span>
                                    </div>

                                    {/* Step 3: Expedição */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full font-black flex items-center justify-center text-[9px] border",
                                        (item.status === 'Expedido' || item.status === 'Entregue')
                                          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                          : "bg-slate-900 text-slate-500 border-slate-700"
                                      )}>
                                        {(item.status === 'Expedido' || item.status === 'Entregue') ? '✓' : '3'}
                                      </div>
                                      <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wide",
                                        (item.status === 'Expedido' || item.status === 'Entregue') ? "text-emerald-400 font-black" : "text-slate-500"
                                      )}>Expedição</span>
                                      <span className="text-[7px] text-slate-500">
                                        {item.dataExpedicao ? item.dataExpedicao : 'Pendente'}
                                      </span>
                                    </div>

                                    {/* Step 4: Em Transporte */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full font-black flex items-center justify-center text-[9px] border",
                                        item.status === 'Entregue'
                                          ? "bg-emerald-500 text-white border-emerald-400"
                                          : item.status === 'Expedido'
                                            ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                            : "bg-slate-900 text-slate-500 border-slate-700"
                                      )}>
                                        {item.status === 'Entregue' ? '✓' : item.status === 'Expedido' ? '🚚' : '4'}
                                      </div>
                                      <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wide",
                                        item.status === 'Entregue' ? "text-emerald-400" : item.status === 'Expedido' ? "text-blue-400" : "text-slate-500"
                                      )}>Em Transporte</span>
                                      <span className="text-[7px] text-slate-500">
                                        {item.transportadora || 'Aguardando'}
                                      </span>
                                    </div>

                                    {/* Step 5: Entregue */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full font-black flex items-center justify-center text-[9px] border",
                                        item.status === 'Entregue'
                                          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] text-[10px]"
                                          : "bg-slate-900 text-slate-600 border-slate-700"
                                      )}>
                                        {item.status === 'Entregue' ? '✓' : '5'}
                                      </div>
                                      <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wide",
                                        item.status === 'Entregue' ? "text-emerald-400 font-extrabold animate-pulse" : "text-slate-600"
                                      )}>Entregue</span>
                                      <span className="text-[7px] text-slate-500">
                                        {item.status === 'Entregue' ? 'Destinatário' : 'Aguardando'}
                                      </span>
                                    </div>

                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <Truck className="w-12 h-12 mx-auto text-slate-700 animate-bounce mb-2" />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nenhum registro de reentrega para os filtros selecionados.</p>
                    <span className="text-[8px] text-slate-500">Experimente alterar as opções de filtros ou limpar a pesquisa operacional.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Request creation and Editing Overlay Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/85 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card tech-border rounded-3xl p-6 w-full max-w-xl relative bg-[#090D1C]/95 shadow-[0_0_40px_rgba(0,0,0,0.8)]"
          >
            <div className="corner-accent corner-tl" />
            <div className="corner-accent corner-tr" />
            <div className="corner-accent corner-bl" />
            <div className="corner-accent corner-br" />

            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" />
                {modalMode === 'add' ? 'SOLICITAR NOVA REENTREGA OPERACIONAL' : 'EDITAR MONITORAMENTO DE REENTREGA'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3 text-[10px] font-sans">
              <div className="grid grid-cols-3 gap-3">
                {/* NF Input */}
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Número da NF *</label>
                  <input 
                    type="text" 
                    value={formNf} 
                    onChange={(e) => setFormNf(e.target.value)} 
                    placeholder="Ex: 38294"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                    required
                  />
                </div>

                {/* Pedido Input */}
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Pedido (Coluna T)</label>
                  <input 
                    type="text" 
                    value={formPedido} 
                    onChange={(e) => setFormPedido(e.target.value)} 
                    placeholder="Ex: 1048293"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>

                {/* Cliente Code */}
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Código do Cliente</label>
                  <input 
                    type="text" 
                    value={formCodigoCliente} 
                    onChange={(e) => setFormCodigoCliente(e.target.value)} 
                    placeholder="Ex: 581648"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cliente Name */}
              <div className="flex flex-col gap-1">
                <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Nome fantasia / Razão Social do Cliente *</label>
                <input 
                  type="text" 
                  value={formCliente} 
                  onChange={(e) => setFormCliente(e.target.value)} 
                  placeholder="EX: MERCADO CENTRAL DE ALIMENTOS LTDA"
                  className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold uppercase focus:border-emerald-500/30 focus:outline-none"
                  required
                />
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Data de Chegada ao CD</label>
                  <input 
                    type="text" 
                    value={formDataChegadaCD} 
                    onChange={(e) => setFormDataChegadaCD(e.target.value)} 
                    placeholder="Ex: 19/06/2026"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Data de Nova Expedição</label>
                  <input 
                    type="text" 
                    value={formDataExpedicao} 
                    onChange={(e) => setFormDataExpedicao(e.target.value)} 
                    placeholder="Ex: 22/06/2026 (ou em branco)"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Numbers or volumes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Quantidade de Volumes</label>
                  <input 
                    type="number" 
                    value={formVolumes} 
                    onChange={(e) => setFormVolumes(Number(e.target.value) || 1)} 
                    min={1}
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Valor Mercadoria (R$)</label>
                  <input 
                    type="text" 
                    value={formValor} 
                    onChange={(e) => setFormValor(e.target.value)} 
                    placeholder="Ex: 1.250,50"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Prioridade Lote</label>
                  <select 
                    value={formPrioridade} 
                    onChange={(e) => setFormPrioridade(e.target.value as any)} 
                    className="bg-[#040814] text-slate-300 border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none cursor-pointer"
                  >
                    <option value="BAIXA">BAIXA</option>
                    <option value="MÉDIA">MÉDIA</option>
                    <option value="ALTA">ALTA</option>
                    <option value="URGENTE">URGENTE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Transportadora */}
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Transportadora Responsável *</label>
                  <input 
                    type="text" 
                    value={formTransportadora} 
                    onChange={(e) => setFormTransportadora(e.target.value)} 
                    placeholder="Ex: PROPRIA GIRO, JAMEF etc."
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold uppercase focus:border-emerald-500/30 focus:outline-none"
                    required
                  />
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Status de Processamento</label>
                  <select 
                    value={formStatus} 
                    onChange={(e) => setFormStatus(e.target.value as any)} 
                    className="bg-[#040814] text-slate-300 border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none cursor-pointer"
                  >
                    <option value="Aguardando Expedição">🟡 AGUARDANDO EXPEDIÇÃO</option>
                    <option value="Expedido">🔵 EXPEDIDO</option>
                    <option value="Entregue">🟢 ENTREGUE</option>
                    <option value="Atrasado">🔴 ATRASADO</option>
                  </select>
                </div>
              </div>

              {/* Responsavel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Responsável no CD</label>
                  <input 
                    type="text" 
                    value={formResponsavel} 
                    onChange={(e) => setFormResponsavel(e.target.value)} 
                    placeholder="Ex: João Silva (Supervisor)"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Motivo do Retorno / Reentrega</label>
                  <input 
                    type="text" 
                    value={formMotivo} 
                    onChange={(e) => setFormMotivo(e.target.value)} 
                    placeholder="Ex: FORA DO HORÁRIO DE RECEBIMENTO"
                    className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold uppercase focus:border-emerald-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* SEÇÃO ESPECIAL - CONTROLE DE REENTREGA PROPRIEDADES */}
              <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-3">
                <span className="text-[8px] font-black uppercase text-emerald-400 tracking-wider">DADOS ESPECÍFICOS DO CONTROLE DE REENTREGA</span>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Mercadoria devolvida no CD */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Mercadoria devolvida no CD</label>
                    <select
                      value={formMercadoriaDevolvidaCD}
                      onChange={(e) => setFormMercadoriaDevolvidaCD(e.target.value)}
                      className="bg-[#040814] text-slate-300 border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none cursor-pointer"
                    >
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </div>

                  {/* Status expedição Reentrega */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Status expedição Reentrega</label>
                    <select
                      value={formStatusExpedicao}
                      onChange={(e) => setFormStatusExpedicao(e.target.value)}
                      className="bg-[#040814] text-slate-300 border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none cursor-pointer"
                    >
                      <option value="Aguardando Programação">Aguardando Programação</option>
                      <option value="Expedido">Expedido</option>
                      <option value="Entregue">Entregue</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Nova transportadora */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Nova transportadora</label>
                    <input 
                      type="text" 
                      value={formNovaTransportadora} 
                      onChange={(e) => setFormNovaTransportadora(e.target.value)} 
                      placeholder="Ex: JAMEF ou PROPRIA GIRO"
                      className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold uppercase focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>

                  {/* Previsão de Reentrega */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Previsão de Reentrega</label>
                    <input 
                      type="text" 
                      value={formPrevisaoReentrega} 
                      onChange={(e) => setFormPrevisaoReentrega(e.target.value)} 
                      placeholder="Ex: 24/06/2026"
                      className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Motorista Input */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Motorista (Coluna N)</label>
                    <input 
                      type="text" 
                      value={formMotorista} 
                      onChange={(e) => setFormMotorista(e.target.value)} 
                      placeholder="Ex: José Carlos"
                      className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>

                  {/* Tratativa */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Tratativa / Observações da Reentrega</label>
                    <input 
                      type="text" 
                      value={formTratativa} 
                      onChange={(e) => setFormTratativa(e.target.value)} 
                      placeholder="Ex: Mercadoria recebida no CD, aguardando agendamento."
                      className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Não reentrega (Coluna AA) Input */}
                  <div className="flex flex-col gap-1">
                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Não reentrega (Coluna AA)</label>
                    <input 
                      type="text" 
                      value={formNaoReentrega} 
                      onChange={(e) => setFormNaoReentrega(e.target.value)} 
                      placeholder="Ex: Não reentrega"
                      className="bg-[#040814] text-white border border-white/5 rounded-xl p-2 font-bold focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-4 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors uppercase tracking-wider text-[9px]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl duration-200 transition-all uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
