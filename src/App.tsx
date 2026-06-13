/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
  LabelList
} from 'recharts';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Link as LinkIcon, 
  Monitor,
  Clock,
  Zap,
  BarChart3,
  LayoutDashboard,
  Tv,
  FileText,
  Truck,
  Box,
  CheckCircle2,
  AlertCircle,
  Lock,
  TrendingDown,
  DollarSign,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  History,
  Package,
  Ticket,
  Activity,
  ClipboardList,
  Forklift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types for our logistics data
interface LogisticsData {
  date: string;
  fornecedor: string;
  ordem: string;
  tipo: string;
  chegadaDoca: string;
  saidaDoca: string;
  doca: string;
  inicioDescarga: string;
  fimDescarga: string;
  inicioConferencia: string;
  fimConferencia: string;
  conferente: string;
  status: string;
  tempoTotal: string;
  tipoArmazenagem: string;
  palete: string;
  mapaAlocacao: string;
}

const cleanSupplierName = (name: string): string => {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip accents
    .replace(/\s*-\s*$/, '') // Trim trailing dash
    .replace(/[^A-Z0-9\s]/g, '') // Strip punctuation/characters but keep space
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
};

const NOISE_WORDS = new Set([
  'LTDA', 'SA', 'S/A', 'S.A.', 'S.A', 'S A', 'LTD', 'EIRELI', 'ME', 'EPP', 'CNPJ',
  'DISTRIBUICAO', 'DISTRIBUIDORA', 'DIST', 'DISTRI', 'INDUSTRIA', 'ALIMENTOS', 
  'GRUPO', 'PRODUTOS', 'PRODUCT', 'LOGISTICA', 'TRANSPORTES', 'IMPORTACAO', 
  'EXPORTACAO', 'BRASIL', 'BR', 'COMERCIO', 'DISTRIB', 'ALIMENT'
]);

const getSignificantTokens = (name: string): string[] => {
  const clean = cleanSupplierName(name);
  const rawTokens = clean.split(/\s+/);
  return rawTokens.filter(t => t.length > 0 && !NOISE_WORDS.has(t));
};

const matchSupplierNames = (nameA: string, nameB: string): boolean => {
  const cleanA = cleanSupplierName(nameA);
  const cleanB = cleanSupplierName(nameB);
  if (!cleanA || !cleanB) return false;

  const noSpaceA = cleanA.replace(/\s+/g, '');
  const noSpaceB = cleanB.replace(/\s+/g, '');

  // Handle corporate synonym match for ASSAI and SENDAS
  if (((noSpaceA.includes('ASSAI') || noSpaceA.includes('SENDAS')) &&
       (noSpaceB.includes('ASSAI') || noSpaceB.includes('SENDAS')))) {
    return true;
  }

  // Handle corporate synonym match for M DIAS
  const isMDiasA = noSpaceA.includes('MDIAS') || noSpaceA.includes('M.DIAS') || noSpaceA.includes('M DIAS') || noSpaceA.startsWith('MDIAS');
  const isMDiasB = noSpaceB.includes('MDIAS') || noSpaceB.includes('M.DIAS') || noSpaceB.includes('M DIAS') || noSpaceB.startsWith('MDIAS');
  if (isMDiasA && isMDiasB) {
    return true;
  }

  if (cleanA === cleanB ||
      noSpaceA === noSpaceB ||
      cleanA.startsWith(cleanB) ||
      cleanB.startsWith(cleanA) ||
      (cleanA.length > 3 && cleanB.includes(cleanA)) ||
      (cleanB.length > 3 && cleanA.includes(cleanB)) ||
      (noSpaceA.length > 3 && noSpaceB.includes(noSpaceA)) ||
      (noSpaceB.length > 3 && noSpaceA.includes(noSpaceB))) {
    return true;
  }

  const tokensA = getSignificantTokens(nameA);
  const tokensB = getSignificantTokens(nameB);

  if (tokensA.length > 0 && tokensB.length > 0) {
    const firstA = tokensA[0];
    const firstB = tokensB[0];
    if (firstA === firstB && firstA.length >= 3) {
      return true;
    }
    if (firstA.length >= 4 && tokensB.includes(firstA)) return true;
    if (firstB.length >= 4 && tokensA.includes(firstB)) return true;
  }

  return false;
};

const isFinalizado = (d: LogisticsData) => {
  if (!d.status) return false;
  // Must have a valid supplier name
  const name = String(d.fornecedor || '').trim();
  if (!name || name === '0' || name === '-' || name === '---') return false;

  const s = String(d.status).toUpperCase().trim();
  
  // "se tiver Noshow ou recusado puxar da aba base time"
  const isBaseTimeAlert = s === 'NOSHOW' || s === 'NO SHOW' || s === 'NO-SHOW' || s === 'RECUSADO';
  if (isBaseTimeAlert) {
    return true;
  }

  // Se o status indica em trânsito ou planejado (NA/vazio), não pode ser considerado finalizado
  if (s === 'EM TRÂNSITO' || s === 'EM TRANSITO' || s === 'NA' || s === '') {
    return false;
  }

  // "o inicio da data de conferencia esta na coluna U e finaliza a carga na coluna W, preciso que traga todos os fornecedores do dia finalizado para area de finalizados"
  // Column W (finaliza a carga) maps to fimConferencia
  const fim = String(d.fimConferencia || '').trim();
  const hasFimValue = fim !== '' && fim !== '-' && fim !== '0' && fim !== '---';
  const hasMapa = d.mapaAlocacao && d.mapaAlocacao.trim() !== '' && d.mapaAlocacao.trim() !== '-' && d.mapaAlocacao.trim() !== '0';

  const saida = String(d.saidaDoca || '').toUpperCase().trim();
  const isAguardandoVeiculo = saida.includes('AGUARDANDO VEICULO') || saida.includes('AGUARDANDO VEÍCULO') || s.includes('AGUARDANDO VEICULO') || s.includes('AGUARDANDO VEÍCULO');

  if (hasFimValue || hasMapa || s.includes('FINALIZID') || s.includes('FINALIZAD') || s.includes('CONCLUID') || s.includes('CONCLUÍD') || s === 'OK' || isAguardandoVeiculo) {
    return true;
  }
  return false;
};

const isEmOperacao = (d: LogisticsData) => {
  if (isFinalizado(d)) return false;
  // Must have a valid supplier name
  const name = String(d.fornecedor || '').trim();
  if (!name || name === '0' || name === '-' || name === '---') return false;

  const s = String(d.status || '').toUpperCase().trim();
  const isBaseTimeAlert = s === 'NOSHOW' || s === 'NO SHOW' || s === 'NO-SHOW' || s === 'RECUSADO';
  if (isBaseTimeAlert) return false;

  // Se o status indica em trânsito ou planejado (NA/vazio), não pode estar em operação
  if (s === 'EM TRÂNSITO' || s === 'EM TRANSITO' || s === 'NA' || s === '') {
    return false;
  }

  // "se tiver com ordem de recebimento e não estiver finalizada contras em Doca/ Operação"
  const ordem = String(d.ordem || '').trim();
  const hasOrValue = ordem !== '' && ordem !== '-' && ordem !== '0' && ordem !== '---';

  return hasOrValue;
};

const isAguardando = (d: LogisticsData) => {
  if (isFinalizado(d) || isEmOperacao(d)) return false;

  // Must have a valid supplier name to be displayed in the card
  const name = String(d.fornecedor || '').trim();
  if (!name || name === '0' || name === '-' || name === '---') return false;

  // "se estiver sem Ordem de recebimento ficara em aguardando/patio"
  // Since we filtered out finalized and emOperacao, anything left with a valid supplier name goes to Waiting/Patio.
  return true;
};

const SHEET_ID = '1kgo_BrjuyPp5zxOGaJJfucd6t9fdufE8KF2Po-aCkGk';
const GID = '961088198'; // Monitoramento / Basetime
const BASETIME_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&range=A1:AZ`;
const MAPA_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=554302411`;
const MAPA_CONCLUIDO_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('mapa concluído')}`;
const TICKET_DIA_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=992823488`;
const TICKET_DIA_ANTERIOR_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Ticket dia anterior')}`;
const DEBITO_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('debito')}`;
const MAPA_PENDENTE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('mapa pendente')}`;
const GERENCIADOR_ORDEM_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Gerenciador de ordem')}`;

const ALLOWED_SECTORS = [
  'MERCEARIA SECA',
  'BEBIDAS',
  'LIMPEZA E LAVANDERIA',
  'HIGIENE, SAUDE E BELEZA',
  'AEROSOL'
];

// Reports View Component
function ReportsView({ 
  operadoresData, 
  loading,
  selectedDate,
  setSelectedDate,
  pendingLots,
  pendingLoading
}: { 
  operadoresData: Record<string, Record<string, number>>,
  loading: boolean,
  selectedDate: string,
  setSelectedDate: (date: string) => void,
  pendingLots: number,
  pendingLoading: boolean
}) {
  const shiftNames = useMemo(() => {
    // Priority for Turno 1 and Turno 2
    const names = Object.keys(operadoresData);
    const result: string[] = [];
    if (names.includes('TURNO 1')) result.push('TURNO 1');
    if (names.includes('TURNO 2')) result.push('TURNO 2');
    names.forEach(n => {
      if (!result.includes(n)) result.push(n);
    });
    return result;
  }, [operadoresData]);

  const renderTurnoTable = (turno: Record<string, number> = {}, turnoName: string) => {
    const operators = Object.entries(turno).sort((a, b) => b[1] - a[1]);
    const totalPallets = operators.reduce((acc, [_, val]) => acc + val, 0);

    return (
      <div className="glass-card tech-border rounded-xl flex flex-col overflow-hidden shadow-2xl h-full">
        {/* Total Header Section */}
        <div className="bg-emerald-900/20 border-b border-emerald-500/30 p-4 flex flex-col items-center justify-center">
          <span className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-2">TOTAL {turnoName}</span>
          <div className="relative">
            <span className="text-5xl font-black text-white font-mono drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              {totalPallets}
            </span>
            <div className="absolute -inset-2 bg-emerald-500/10 blur-xl rounded-full -z-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-emerald-500/30 bg-emerald-500/10">
                <th className="px-4 py-3 border-r border-white/5 w-1/2">OPERADORES</th>
                <th className="px-4 py-3 text-center w-1/2">QTD PALETES ALOCADOS</th>
              </tr>
            </thead>
            <tbody>
              {operators.length > 0 ? (
                operators.map(([nome, qtd], idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-emerald-500/5 transition-colors group">
                    <td className="px-4 py-[2px] border-r border-white/5">
                      <span className="text-[11px] font-bold text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors truncate block max-w-[150px]">{nome}</span>
                    </td>
                    <td className="px-4 py-[2px] text-center">
                      <span className="text-lg font-black text-emerald-400 font-mono">{qtd}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-10 text-slate-600 italic uppercase tracking-[0.3em] text-[10px]">
                    Aguardando dados...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      key="reports"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-2 relative z-10"
    >
      {/* Background Logo Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] opacity-[0.05] pointer-events-none -z-10">
        <svg viewBox="0 0 48 32" className="w-full h-full overflow-visible">
          <path 
            d="M12 16 A8 8 0 1 1 28 16" 
            fill="none" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinecap="round"
          />
          <path 
            d="M36 16 A8 8 0 1 1 20 16" 
            fill="none" 
            stroke="#10b981" 
            strokeWidth="1.5" 
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex justify-between items-center mb-0">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <FileText className="w-6 h-6 text-emerald-500" />
            Relatório de Armazenagem
          </h2>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] ml-9">Operadores e Alocação</span>
        </div>
        
        <div className="flex items-center gap-4">
          {loading && <Zap className="w-5 h-5 text-emerald-500 animate-spin" />}
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 mb-2">
        {shiftNames.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{shiftNames[0]}</span>
          </div>
        )}

        {/* Pending Lots Card */}
        <div className="glass-card tech-border px-6 py-2 rounded-xl flex items-center gap-4 bg-rose-500/10 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-[0.3em] mb-1">Lotes Pendentes</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white font-mono leading-none">
                {pendingLoading ? '...' : pendingLots}
              </span>
              <Package className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>

        {shiftNames.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{shiftNames[1]}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {shiftNames.length > 0 ? (
          shiftNames.map(name => (
            <div key={name} className="flex flex-col h-full">
              {renderTurnoTable(operadoresData[name], name)}
            </div>
          ))
        ) : (
          <div className="lg:col-span-2 glass-card tech-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
            <h3 className="text-xl font-black text-white uppercase mb-2">Dados não encontrados</h3>
            <p className="text-slate-400 text-sm max-w-md">
              Não foi possível carregar os dados da aba <span className="text-emerald-400 font-bold">"mapa concluído"</span>. 
              Certifique-se de que o nome da aba está correto e que ela contém as colunas de <span className="text-emerald-400 font-bold">Operador</span> e <span className="text-emerald-400 font-bold">Lote</span>.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'vermelho@2020') {
      localStorage.setItem('giro_auth', 'true');
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Watermark */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 48 32" className="w-[800px] h-[600px]">
          <path d="M12 16 A8 8 0 1 1 28 16" fill="none" stroke="white" strokeWidth="1" />
          <path d="M36 16 A8 8 0 1 1 20 16" fill="none" stroke="#10b981" strokeWidth="1" />
        </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card tech-border p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden z-10"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 tech-border">
            <Lock className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Acesso Restrito</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Giro Trade Logística</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "w-full bg-black/40 border-2 rounded-xl px-4 py-3 text-white font-mono outline-none transition-all",
                error ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-white/5 focus:border-emerald-500/50"
              )}
              placeholder="••••••••"
              autoFocus
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98]"
          >
            Entrar no Sistema
          </button>
        </form>

        {error && (
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center mt-6"
          >
            Senha Incorreta. Tente novamente.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

// BI View Component
function AnalyticsView({ selectedDate }: { selectedDate: string }) {
  const [biData, setBiData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    year: 'Todos',
    month: 'Todos',
    day: 'Todos',
    status: 'Todos',
    supplier: 'Todos'
  });

  useEffect(() => {
    const fetchBIData = async () => {
      try {
        setLoading(true);
        const cacheBuster = `&t=${new Date().getTime()}`;
        
        // 1. Fetch basetime data
        const response = await fetch(`${BASETIME_CSV_URL}${cacheBuster}`);
        if (!response.ok) throw new Error('Falha ao buscar dados do basetime');
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return;

        const parseRow = (row: string) => {
          const cols: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
              cols.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim().replace(/^"|"$/g, ''));
          return cols;
        };

        const headers = parseRow(rows[0]).map(h => h.toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
        const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('situação') || h.includes('situacao'));
        const supplierIdx = headers.findIndex(h => h.includes('fornecedor') || h.includes('cliente') || h.includes('empresa'));
        const keyIdx = 4; // Column E as requested

        const parsed = rows.slice(1).map(row => {
          const cols = parseRow(row);
          const dateStr = cols[dateIdx] || '';
          const keyVal = cols[keyIdx]?.trim();

          let day = '', month = '', year = '';
          
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            day = parts[0];
            month = parts[1];
            year = parts[2] ? (parts[2].trim().length === 2 ? `20${parts[2].trim()}` : parts[2].trim()) : '2026';
          } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) {
              year = parts[0]; month = parts[1]; day = parts[2];
            } else {
              day = parts[0]; month = parts[1]; year = parts[2];
            }
          }

          return {
            date: dateStr,
            day: day.trim().padStart(2, '0'),
            month: month.trim().padStart(2, '0'),
            year: year.trim(),
            status: (cols[statusIdx] || '').toUpperCase(),
            fornecedor: (cols[supplierIdx] || '').toUpperCase(),
            senha: keyVal || '',
            ordem: cols[6] || '',
            inicioConferencia: cols[7] || '',
            fimConferencia: cols[8] || ''
          };
        });

        setBiData(parsed);
      } catch (err) {
        console.error('Erro Analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBIData();
  }, []);

  const filteredData = useMemo(() => {
    return biData.filter(item => {
      const supplier = (item.fornecedor || '') as string;
      if (!supplier || supplier.trim() === '') return false;
      if (filters.year !== 'Todos' && item.year !== filters.year) return false;
      if (filters.month !== 'Todos' && item.month !== filters.month) return false;
      if (filters.day !== 'Todos' && item.day !== filters.day) return false;
      if (filters.status !== 'Todos' && item.status !== filters.status) return false;
      if (filters.supplier !== 'Todos' && item.fornecedor !== filters.supplier) return false;
      return true;
    });
  }, [biData, filters]);

  const supplierStats = useMemo(() => {
    const stats: Record<string, { name: string, displayName: string, agendamentos: number, noshow: number }> = {};
    filteredData.forEach(item => {
      const name = item.fornecedor || 'DESCONHECIDO';
      if (!stats[name]) {
        stats[name] = { 
          name, 
          displayName: name.split(/\s+/).slice(0, 2).join(' '),
          agendamentos: 0, 
          noshow: 0 
        };
      }
      stats[name].agendamentos++;
      if (item.status.includes('NOSHOW')) {
        stats[name].noshow++;
      }
    });
    return Object.values(stats).sort((a, b) => b.agendamentos - a.agendamentos).slice(0, 15);
  }, [filteredData]);

  const serviceLevelStats = useMemo(() => {
    const stats = supplierStats.map(s => ({
      name: s.displayName,
      percentage: s.agendamentos > 0 ? Math.round(((s.agendamentos - s.noshow) / s.agendamentos) * 100) : 0,
      count: s.agendamentos
    }));
    const best = [...stats].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    const worst = [...stats].sort((a, b) => a.percentage - b.percentage).slice(0, 5);
    return { best, worst };
  }, [supplierStats]);

  const dailyStats = useMemo(() => {
    const rawStats: Record<string, { date: string, total: number, noshowCount: number }> = {};
    filteredData.forEach(item => {
      const date = item.date;
      if (!rawStats[date]) rawStats[date] = { date, total: 0, noshowCount: 0 };
      rawStats[date].total++;
      if (item.status.toUpperCase().includes('NOSHOW')) {
        rawStats[date].noshowCount++;
      }
    });

    return Object.values(rawStats).map(s => {
      const extras = Math.max(0, s.total - 15);
      const remaining = s.total - extras; // capped at 15
      const noshow = Math.min(remaining, s.noshowCount);
      const agendamentos = remaining - noshow;

      return {
        date: s.date,
        agendamentos,
        noshow,
        extras
      };
    }).sort((a, b) => {
      const parse = (d: string) => {
        const p = d.split('/');
        return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0])).getTime();
      };
      return parse(a.date) - parse(b.date);
    });
  }, [filteredData]);

  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho',
    '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  const suppliers = useMemo(() => {
    return Array.from(new Set(biData.map(d => d.fornecedor as string)))
      .filter((name: string) => name && name.trim() !== '')
      .sort();
  }, [biData]);

  const statuses = useMemo(() => {
    return Array.from(new Set(biData.map(d => d.status))).sort();
  }, [biData]);

  const totals = useMemo(() => {
    let agendamentos = 0;
    let noshow = 0;
    filteredData.forEach(item => {
      agendamentos++;
      if (item.status.includes('NOSHOW')) noshow++;
    });
    return { agendamentos, noshow };
  }, [filteredData]);

  const noshowReportData = useMemo(() => {
    const monthlyData: Record<string, { 
      month: string, 
      count: number, 
      total: number, 
      index: number, 
      suppliers: Record<string, { count: number, details: { date: string, senha: string }[] }> 
    }> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    filteredData.forEach(item => {
      const status = (item.status || '').toLowerCase();
      if (status.includes('noshow')) {
        const monthIdx = parseInt(item.month) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          const monthName = monthNames[monthIdx];
          if (!monthlyData[monthName]) {
            monthlyData[monthName] = { month: monthName, count: 0, total: 0, index: monthIdx, suppliers: {} };
          }
          monthlyData[monthName].count += 1;
          monthlyData[monthName].total += 1000;

          const supplier = (item.fornecedor || 'NÃO IDENTIFICADO').trim().toUpperCase();
          const displaySupplier = supplier.split(/\s+/).slice(0, 2).join(' ');
          
          if (!monthlyData[monthName].suppliers[displaySupplier]) {
            monthlyData[monthName].suppliers[displaySupplier] = { count: 0, details: [] };
          }
          monthlyData[monthName].suppliers[displaySupplier].count += 1;
          monthlyData[monthName].suppliers[displaySupplier].details.push({ date: item.date, senha: item.senha });
        }
      }
    });

    return Object.values(monthlyData).sort((a, b) => a.index - b.index);
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RotateCcw className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
      <div className="grid grid-cols-12 gap-4">
        {/* Filters Panel */}
        <div className="col-span-2 glass-card tech-border p-4 flex flex-col gap-4">
          <h3 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2">FILTROS</h3>
          
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Ano</label>
            <select 
              value={filters.year}
              onChange={(e) => setFilters({...filters, year: e.target.value})}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Mês</label>
            <select 
              value={filters.month}
              onChange={(e) => setFilters({...filters, month: e.target.value})}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos</option>
              {months.map(m => <option key={m} value={m}>{monthNames[m]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Dia</label>
            <select 
              value={filters.day}
              onChange={(e) => setFilters({...filters, day: e.target.value})}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos</option>
              {Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor</label>
            <select 
              value={filters.supplier}
              onChange={(e) => setFilters({...filters, supplier: e.target.value})}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Charts Panel */}
        <div className="col-span-10 flex flex-col gap-4">
          {/* Totals Highlight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card tech-border p-4 flex flex-col items-center justify-center bg-blue-500/10">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em]">TOTAL DE AGENDAMENTOS</span>
              <span className="text-4xl font-black text-white font-mono">{totals.agendamentos}</span>
            </div>
            <div className="glass-card tech-border p-4 flex flex-col items-center justify-center bg-rose-500/10">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.4em]">TOTAL NO-SHOW</span>
              <span className="text-4xl font-black text-white font-mono">{totals.noshow}</span>
            </div>
          </div>

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 gap-6">
            {/* Agendamentos x No-Show */}
            {/* Daily Agendamentos */}
            <div className="glass-card tech-border p-6 h-[450px]">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6 underline decoration-emerald-500/30 underline-offset-4">Quant. de Agendamentos por Dia</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyStats} margin={{ bottom: 30, left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                    dy={10}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ fontSize: 11, fontWeight: 900 }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '30px', fontSize: 12, fontWeight: 800 }}
                    formatter={(value) => <span className="text-slate-200 uppercase tracking-widest">{value}</span>}
                  />
                  <Bar dataKey="agendamentos" name="Agendamentos" stackId="a" fill="#3b82f6" isAnimationActive={false}>
                    <LabelList dataKey="agendamentos" position="center" fill="white" fontSize={9} fontWeight="bold" formatter={(val: any) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="noshow" name="No-show" stackId="a" fill="#ef4444" isAnimationActive={false}>
                    <LabelList dataKey="noshow" position="center" fill="white" fontSize={9} fontWeight="bold" formatter={(val: any) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="extras" name="Extras" stackId="a" fill="#10b981" isAnimationActive={false}>
                    <LabelList dataKey="extras" position="center" fill="white" fontSize={9} fontWeight="bold" formatter={(val: any) => val > 0 ? val : ''} />
                  </Bar>
                  <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Capacidade (15)', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Supplier Stats */}
            <div className="glass-card tech-border p-6 h-[500px]">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6">Quantidade agendamento x No-show</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierStats} margin={{ bottom: 150 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="displayName" 
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} 
                    angle={-45} 
                    textAnchor="end" 
                    interval={0}
                    height={150}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ fontSize: 11, fontWeight: 900 }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, fontWeight: 800 }} 
                    formatter={(value) => <span className="text-slate-200 uppercase tracking-widest">{value}</span>}
                  />
                  <Bar dataKey="agendamentos" name="Agendamentos" stackId="a" fill="#3b82f6" isAnimationActive={false}>
                    <LabelList dataKey="agendamentos" position="center" fill="white" fontSize={10} fontWeight="bold" />
                  </Bar>
                  <Bar dataKey="noshow" name="No-shows" stackId="a" fill="#ef4444" isAnimationActive={false}>
                    <LabelList dataKey="noshow" position="center" fill="white" fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* No-Show Charts Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Quantity Chart */}
            <div className="glass-card tech-border rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Quant. Mensal de No-Show</span>
                <BarChart3 className="w-4 h-4 text-rose-500" />
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={noshowReportData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#f43f5e', fontSize: 12, fontWeight: 900 }}
                    />
                    <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
                      <LabelList dataKey="count" position="top" fill="#f43f5e" fontSize={10} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost Chart */}
            <div className="glass-card tech-border rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Lucro Estimado No-Show</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={noshowReportData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => `R$ ${value/1000}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                      isAnimationActive={false}
                    >
                      <LabelList 
                        dataKey="total" 
                        position="top" 
                        fill="#10b981" 
                        fontSize={10} 
                        fontWeight="bold"
                        formatter={(value: number) => `R$ ${value/1000}k`}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* No-Show Report Table (Integrated) */}
          <div className="glass-card tech-border rounded-2xl overflow-hidden mb-6">
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">DETALHAMENTO MENSAL DE NO-SHOW</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Total: {totals.noshow}</span>
                </div>
              </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-white uppercase tracking-widest border-b border-white/10 bg-black/40">
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4">MÊS DE REFERÊNCIA</th>
                  <th className="px-6 py-4 text-center">QUANTIDADE NO-SHOW</th>
                  <th className="px-6 py-4 text-right">VALOR ESTIMADO</th>
                </tr>
              </thead>
              <tbody>
                {noshowReportData.map((d, i) => {
                  const isExpanded = expandedMonth === d.month;
                  return (
                    <React.Fragment key={i}>
                      <tr 
                        className={cn(
                          "border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer",
                          isExpanded && "bg-emerald-500/5"
                        )}
                        onClick={() => setExpandedMonth(isExpanded ? null : d.month)}
                      >
                        <td className="px-6 py-4 text-center">
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <ChevronDown className={cn("w-4 h-4", isExpanded ? "text-emerald-500" : "text-slate-500")} />
                          </motion.div>
                        </td>
                        <td className="px-6 py-4 font-bold text-white uppercase tracking-tighter">{d.month}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full font-mono font-black text-sm">
                            {d.count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-emerald-400">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.total)}
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-black/20"
                              >
                                <div className="px-16 py-6 border-b border-white/5">
                                  <div className="flex items-center gap-3 mb-4">
                                    <Truck className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Fornecedores com NO-SHOW em {d.month}</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(Object.entries(d.suppliers) as [string, { count: number, details: { date: string, senha: string }[] }][])
                                      .sort((a, b) => b[1].count - a[1].count)
                                      .map(([supplier, info], sIdx) => {
                                        const isSupplierExpanded = expandedSupplier === `${d.month}-${supplier}`;
                                        return (
                                          <div key={sIdx} className="flex flex-col gap-2">
                                            <div 
                                              onClick={() => setExpandedSupplier(isSupplierExpanded ? null : `${d.month}-${supplier}`)}
                                              className={cn(
                                                "flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors",
                                                isSupplierExpanded && "border-emerald-500/50 bg-emerald-500/5"
                                              )}
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                                                  {isSupplierExpanded ? <ChevronUp className="w-3 h-3 text-emerald-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase truncate pr-4">{supplier}</span>
                                              </div>
                                              <span className="text-[10px] font-black text-white font-mono bg-rose-500/20 px-2 py-0.5 rounded">{info.count}</span>
                                            </div>
                                            <AnimatePresence>
                                              {isSupplierExpanded && (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  className="overflow-hidden bg-black/40 rounded-lg border border-white/5"
                                                >
                                                  <div className="p-3 flex flex-col gap-1">
                                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Datas e Senhas:</span>
                                                    <div className="flex flex-col gap-1">
                                                      {info.details.map((detail, dIdx) => (
                                                        <div key={dIdx} className="flex justify-between items-center text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/5">
                                                          <span>{detail.date}</span>
                                                          <span className="text-emerald-400 font-bold">{detail.senha}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const formatSupplierName = (name: string) => {
  if (!name) return '';
  // Remove quotes if any
  const cleanName = name.replace(/^"|"$/g, '').trim();
  const words = cleanName.split(/\s+/);
  // Return only first two names as requested
  return words.slice(0, 2).join(' ');
};

function DailyReportView({ 
  stats, 
  mapaData, 
  mapaLoading,
  operadoresData,
  operadoresLoading,
  pendingLots,
  pendingLoading 
}: { 
  stats: any, 
  mapaData: Record<string, { pallets: number, empty: number, total: number }>, 
  mapaLoading: boolean,
  operadoresData: Record<string, Record<string, number>>,
  operadoresLoading: boolean,
  pendingLots: number,
  pendingLoading: boolean
}) {
  const [ticketDiaData, setTicketDiaData] = useState<{ colA: string, date: string, delay: string }[]>([]);
  const [ticketDiaAnteriorData, setTicketDiaAnteriorData] = useState<{ colA: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const shiftNames = useMemo(() => {
    const names = Object.keys(operadoresData);
    const result: string[] = [];
    if (names.includes('TURNO 1')) result.push('TURNO 1');
    if (names.includes('TURNO 2')) result.push('TURNO 2');
    names.forEach(n => {
      if (!result.includes(n)) result.push(n);
    });
    return result;
  }, [operadoresData]);

  const totalPalletsByShift = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(operadoresData).forEach(([shift, operators]) => {
      totals[shift] = Object.values(operators).reduce((acc, val) => acc + val, 0);
    });
    return totals;
  }, [operadoresData]);

  const renderTurnoTable = (turno: Record<string, number> = {}, turnoName: string) => {
    const operators = Object.entries(turno).sort((a, b) => b[1] - a[1]);
    const totalPallets = operators.reduce((acc, [_, val]) => acc + val, 0);

    return (
      <div className="glass-card tech-border rounded-xl flex flex-col overflow-hidden shadow-2xl h-full">
        <div className="bg-emerald-900/20 border-b border-emerald-500/30 p-3 flex flex-col items-center justify-center">
          <span className="text-[9px] font-black text-white uppercase tracking-[0.4em] mb-1">TOTAL {turnoName}</span>
          <div className="relative">
            <span className="text-3xl font-black text-white font-mono drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              {totalPallets}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-emerald-500/30 bg-emerald-500/10">
                <th className="px-3 py-2 border-r border-white/5">OPERADOR</th>
                <th className="px-3 py-2 text-center text-white/50">QTD</th>
              </tr>
            </thead>
            <tbody>
              {operators.length > 0 ? (
                operators.map(([nome, qtd], idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-emerald-500/5 transition-colors group">
                    <td className="px-3 py-1 border-r border-white/5">
                      <span className="text-[10px] font-bold text-white uppercase truncate block max-w-[120px]">{nome}</span>
                    </td>
                    <td className="px-3 py-1 text-center font-black text-emerald-400 font-mono text-sm">
                      {qtd}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-6 text-slate-600 italic uppercase tracking-[0.3em] text-[9px]">
                    ...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getBusinessDaysCount = (dateStr: string) => {
    if (!dateStr) return 0;
    try {
      let d: Date;
      // Handle DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY? 
      // The normalizeDate helper should be used if available
      const pureDate = dateStr.split(/\s+/)[0].replace(/-/g, '/');
      const parts = pureDate.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY/MM/DD
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else { // DD/MM/YYYY
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        d = new Date(pureDate);
      }
      
      if (isNaN(d.getTime())) return 0;
      let today = new Date();
      if (today.getFullYear() < 2026) {
        today = new Date('2026-06-03T14:20:00Z');
      }
      today.setHours(0, 0, 0, 0);
      const current = new Date(d);
      current.setHours(0, 0, 0, 0);
      let count = 0;
      const tempDate = new Date(current);
      while (tempDate < today) {
        tempDate.setDate(tempDate.getDate() + 1);
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) count++;
      }
      return count;
    } catch (e) { return 0; }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cacheBuster = `&t=${new Date().getTime()}`;
        
        const parseCSV = (csv: string) => {
          if (!csv) return [];
          const lines = csv.split(/\r?\n/);
          const firstLine = lines.find(l => l.trim() !== '') || '';
          const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

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
              if (currentLine.join('').trim() !== '') rows.push(currentLine);
              currentLine = []; currentField = '';
              if (char === '\r' && nextChar === '\n') i++;
            } else { currentField += char; }
          }
          if (currentLine.length > 0 || currentField !== '') {
            currentLine.push(currentField.trim());
            if (currentLine.join('').trim() !== '') rows.push(currentLine);
          }
          return rows;
        };

        const fetchCSV = async (url: string) => {
          const res = await fetch(`${url}${cacheBuster}`);
          if (!res.ok) return null;
          const text = await res.text();
          if (text.includes('<!DOCTYPE html>') || text.includes('<html')) return null;
          return parseCSV(text);
        };

        // Try GID first, then fallback to sheet name for "Ticket do dia"
        let ticketDiaRows = await fetchCSV(TICKET_DIA_CSV_URL);
        if (!ticketDiaRows || ticketDiaRows.length < 2) {
          const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=992823488`;
          ticketDiaRows = await fetchCSV(fallbackUrl);
        }
        
        const ticketDiaAnteriorRows = await fetchCSV(TICKET_DIA_ANTERIOR_CSV_URL);

        if (ticketDiaRows && ticketDiaRows.length >= 2) {
          const headers = ticketDiaRows[0].map(h => h.toLowerCase().trim());
          let dateIdx = headers.findIndex(h => h === 'data de atualização' || h === 'data_atualizacao' || (h.includes('atualização') && h.includes('data')) || (h.includes('atualizacao') && h.includes('data')));
          if (dateIdx === -1) {
            dateIdx = headers.findIndex(h => h.includes('atualiza') || h.includes('update'));
          }
          if (dateIdx === -1) {
            dateIdx = headers.findIndex(h => h === 'data de criação' || h === 'data_criacao' || h.includes('criação') || h.includes('criacao'));
          }
          if (dateIdx === -1) dateIdx = 26; // Column AA (Data de atualização)
          let delayIdx = headers.findIndex(h => h.includes('delay') || h.includes('atraso'));
          if (delayIdx === -1) delayIdx = 16;
          const rIdx = headers.findIndex(h => h === 'data de resolução' || h === 'data_resolucao' || (h.includes('resolução') && h.includes('data')) || (h.includes('resolucao') && h.includes('data')));

          const parsed = ticketDiaRows.slice(1).map(cols => ({
            colA: cols[0] || '',
            date: cols[dateIdx] || '',
            delay: cols[delayIdx] || '0',
            resolvedDate: rIdx >= 0 ? (cols[rIdx] || '') : ''
          })).filter(x => x.colA.trim().length >= 3 && !x.colA.includes('#') && !['false', 'true', 'id'].includes(x.colA.toLowerCase()));
          setTicketDiaData(parsed);
        }
        
        if (ticketDiaAnteriorRows && ticketDiaAnteriorRows.length >= 2) {
          const parsed = ticketDiaAnteriorRows.slice(1).map(cols => ({ colA: cols[0] || '' }))
            .filter(x => x.colA.trim().length >= 3);
          setTicketDiaAnteriorData(parsed);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const normalizeDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      let pure = dStr.split(/\s+/)[0].replace(/-/g, '/');
      const parts = pure.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
      return pure;
    } catch (e) { return dStr; }
  };

  const totalEntradas = useMemo(() => {
    return ticketDiaData.filter(t => 
      !ticketDiaAnteriorData.some(ant => ant.colA.trim().toUpperCase() === t.colA.trim().toUpperCase())
    ).length;
  }, [ticketDiaData, ticketDiaAnteriorData]);

  const totalSaidas = useMemo(() => {
    return ticketDiaAnteriorData.filter(ant => 
      !ticketDiaData.some(t => t.colA.trim().toUpperCase() === ant.colA.trim().toUpperCase())
    ).length;
  }, [ticketDiaData, ticketDiaAnteriorData]);

  const saldo = useMemo(() => {
    const uniqueIds = new Set(ticketDiaData.map(t => t.colA.trim().toUpperCase()));
    return uniqueIds.size;
  }, [ticketDiaData]);

  const totalDelayed = useMemo(() => {
    return ticketDiaData.filter(t => {
      const dateKey = normalizeDate(t.date);
      if (!dateKey) return false;
      // Exclude resolved tickets to match the active delay list
      const isResolved = (t as any).resolvedDate && (t as any).resolvedDate.trim() !== '';
      if (isResolved) return false;
      return getBusinessDaysCount(t.date) >= 6;
    }).length;
  }, [ticketDiaData]);

  const saldoYesterday = useMemo(() => {
    return new Set(ticketDiaAnteriorData.map(ant => ant.colA.trim().toUpperCase())).size;
  }, [ticketDiaAnteriorData]);

  const saldoTrend = useMemo(() => {
    return saldoYesterday > 0 ? (saldo > saldoYesterday ? `+${(((saldo / saldoYesterday) - 1) * 100).toFixed(0)}%` : `-${(((1 - saldo / saldoYesterday)) * 100).toFixed(0)}%`) : '0%';
  }, [saldo, saldoYesterday]);

  const fechadosTrend = useMemo(() => {
    return saldoYesterday > 0 ? `+${((totalSaidas / saldoYesterday) * 100).toFixed(0)}%` : '0%';
  }, [totalSaidas, saldoYesterday]);

  const novosTrend = useMemo(() => {
    return saldoYesterday > 0 ? `+${((totalEntradas / saldoYesterday) * 100).toFixed(0)}%` : '0%';
  }, [totalEntradas, saldoYesterday]);

  const delayedTrend = useMemo(() => {
    return saldoYesterday > 0 ? `+${((totalDelayed / (saldo || 1)) * 100).toFixed(0)}%` : '0%';
  }, [totalDelayed, saldo]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-1 overflow-y-auto custom-scrollbar pr-2 p-2"
    >
      <div className="glass-card tech-border rounded-[2rem] p-6 flex flex-col gap-6 relative overflow-hidden bg-transparent shadow-none">
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />

        {/* Master Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              Reporte Diário Operacional
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.5em]">Dashboard Logístico • Giro Trade</span>
              <div className="h-1 w-1 bg-white/20 rounded-full" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Data do Relatório</span>
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Devolução Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest italic">Devolução</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'TOTAL DE TICKETS', val: saldo, icon: Ticket, color: 'bg-blue-500/10 text-blue-500', trend: saldoTrend, trendColor: 'text-blue-400' },
              { label: 'TICKETS FECHADOS', val: totalSaidas, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500', trend: fechadosTrend, trendColor: 'text-emerald-500' },
              { label: 'TICKETS NOVOS', val: totalEntradas, icon: ArrowUpRight, color: 'bg-orange-500/10 text-orange-500', trend: novosTrend, trendColor: 'text-orange-500' },
              { label: 'TICKETS EM ATRASO', val: totalDelayed, icon: AlertCircle, color: 'bg-rose-500/10 text-rose-500', trend: delayedTrend, trendColor: 'text-rose-500' }
            ].map((kpi, i) => (
              <div 
                key={i} 
                className="glass-card tech-border p-4 lg:p-6 rounded-3xl relative group min-h-[140px] lg:min-h-[160px] flex flex-col justify-center transition-all duration-300 hover:bg-white/5 overflow-hidden"
              >
                <div className="flex justify-between items-start mb-2 lg:mb-4">
                  <div className={cn("p-2 rounded-lg", kpi.color)}>
                    <kpi.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <div className={cn("flex items-center gap-1 text-[10px] font-black", kpi.trendColor)}>
                    <ArrowUpRight className="w-3 h-3" />
                    {kpi.trend}
                  </div>
                </div>
                <span className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{kpi.label}</span>
                <div className="text-3xl lg:text-4xl font-black mt-1 text-white font-mono tracking-tighter flex items-center gap-2">
                  {kpi.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recebimento Section Header */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-2 -mb-4">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <Forklift className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-widest italic">Recebimento</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Inbound Summary Finalizados */}
          <div className="xl:col-span-2 flex flex-col gap-8">
            {/* Aguardando Chegada */}
            <div className="bg-white/0 border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-[12px] font-black text-white uppercase tracking-[0.2em] italic">Inbound - Aguardando Chegada do Veículo</h2>
                  <span className="bg-emerald-500/20 px-3 py-1 rounded-full text-[11px] font-black text-emerald-400 font-mono">{stats.aguardando.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 bg-white/5 sticky top-0 z-10 font-mono">
                      <th className="px-6 py-4">FORNECEDOR</th>
                      <th className="px-2 py-4 text-center">TIPO</th>
                      <th className="px-2 py-4 text-center">PALETES</th>
                      <th className="px-2 py-4 text-center">SETOR</th>
                      <th className="px-2 py-4 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.aguardando.length > 0 ? stats.aguardando.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-[2px]">
                          <div className="text-[11px] font-black text-white uppercase truncate max-w-[300px]">{formatSupplierName(item.fornecedor)}</div>
                          <div className="text-[10px] font-bold text-slate-500 font-mono">OR: {item.ordem}</div>
                        </td>
                        <td className="px-2 py-[2px] text-center text-[11px] font-black text-blue-400 font-mono">{item.tipo.includes('NÃO') ? 'CIF' : 'FOB'}</td>
                        <td className="px-2 py-[2px] text-center text-[12px] font-black text-white font-mono">{item.palete}</td>
                        <td className="px-2 py-[2px] text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.tipoArmazenagem}</td>
                        <td className="px-2 py-[2px] text-center">
                          <span className="text-[10px] font-black text-orange-400 uppercase bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 italic animate-pulse">
                            Aguardando
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[11px] font-black text-slate-600 uppercase tracking-widest italic opacity-50">Sem veículos aguardando</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cargas Finalizadas */}
            <div className="bg-white/0 border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-[12px] font-black text-white uppercase tracking-[0.2em] italic">Inbound - Cargas Finalizadas</h2>
                  <span className="bg-emerald-500 px-3 py-1 rounded-full text-[11px] font-black text-white font-mono shadow-[0_0_15px_rgba(16,185,129,0.5)]">{stats.finalizados.length}</span>
                </div>
                <div className="flex gap-6 text-[11px] font-black text-slate-400 font-mono">
                  <span className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">CIF: <span className="text-white">{stats.finalizadosBreakdown.cif}</span></span>
                  <span className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">FOB: <span className="text-white">{stats.finalizadosBreakdown.fob}</span></span>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 bg-white/5 font-mono">
                      <th className="px-6 py-4">FORNECEDOR</th>
                      <th className="px-2 py-4 text-center">TIPO</th>
                      <th className="px-2 py-4 text-center">STATUS</th>
                      <th className="px-2 py-4 text-center">PALETES</th>
                      <th className="px-2 py-4 text-center">SETOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.finalizados.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-emerald-500/5 transition-colors group">
                        <td className="px-6 py-[2px]">
                          <div className="text-[10px] font-black text-white uppercase group-hover:text-emerald-400 transition-colors truncate max-w-[250px]">{formatSupplierName(item.fornecedor)}</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">OR: {item.ordem}</div>
                        </td>
                        <td className="px-2 py-[2px] text-center text-[10px] font-black text-blue-400 font-mono">{item.tipo.includes('NÃO') ? 'CIF' : 'FOB'}</td>
                        <td className="px-2 py-[2px] text-center">
                          <span className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono border",
                            item.status.toLowerCase().includes('noshow') ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            item.status.toLowerCase().includes('recusado') ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {item.status.toLowerCase().includes('noshow') ? 'NO SHOW' : 
                             item.status.toLowerCase().includes('recusado') ? 'RECUSADO' : 
                             'FINALIZADO'}
                          </span>
                        </td>
                        <td className="px-2 py-[2px] text-center text-[10px] font-black text-white font-mono">{item.palete}</td>
                        <td className="px-2 py-[2px] text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.tipoArmazenagem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Side: Storage Summary */}
          <div className="flex flex-col">
            <div className="bg-white/0 border border-white/10 rounded-[1.5rem] px-5 py-4 flex flex-col group hover:bg-white/5 transition-all relative h-full shadow-2xl">
              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                    <Zap className={cn("w-4 h-4 text-emerald-400", mapaLoading && "animate-spin")} />
                  </div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                    Armazenagem e Posições
                  </h3>
                </div>
              </div>

              <div className="flex-1">
                <table className="w-full text-left border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">
                      <th className="pb-1">SETOR</th>
                      <th className="pb-1 text-center">PLT</th>
                      <th className="pb-1 text-center">VAZ</th>
                      <th className="pb-1 text-right">SALDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALLOWED_SECTORS.map((sector) => {
                      const storage = mapaData[sector] || { pallets: 0, empty: 0, total: 0 };
                      const pallets = storage.pallets;
                      const empty = storage.empty;
                      const total = storage.total;
                      return (
                        <tr key={sector} className="group/row">
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-emerald-500/30 rounded-full group-hover/row:bg-emerald-500 transition-all" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter group-hover/row:text-white transition-colors">{sector}</span>
                            </div>
                          </td>
                          <td className="py-1 text-center">
                            <span className="text-white font-mono text-[11px] font-black">{pallets}</span>
                          </td>
                          <td className="py-1 text-center">
                            <span className="text-blue-400 font-mono text-[11px] font-black">{empty}</span>
                          </td>
                          <td className="py-1 text-right">
                            <span className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[11px] font-black font-mono px-2 py-0.5 rounded border">
                              {total}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stats Section */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest italic">Produção por Turno</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {shiftNames.map(shift => (
              <div key={shift} className="bg-white/0 border border-white/10 p-3 lg:p-5 rounded-2xl flex flex-col items-center justify-center group hover:bg-white/5 transition-all shadow-2xl">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">{shift}</span>
                <span className="text-3xl lg:text-4xl font-black text-white font-mono leading-none drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                  {totalPalletsByShift[shift] || 0}
                </span>
                <div className="text-[9px] font-bold text-slate-500 uppercase mt-2 tracking-widest">Paletes Alocados</div>
              </div>
            ))}
            {pendingLots > 0 && (
              <div key="pending" className="bg-rose-500/0 border border-rose-500/30 p-3 lg:p-5 rounded-2xl flex flex-col items-center justify-center shadow-lg animate-pulse">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-2">PENDÊNCIAS</span>
                <span className="text-3xl lg:text-4xl font-black text-white font-mono leading-none text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]">
                  {pendingLoading ? '...' : pendingLots}
                </span>
                <div className="text-[9px] font-bold text-rose-500/60 uppercase mt-2 tracking-widest">Aguardando Alocação</div>
              </div>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center opacity-30 italic">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Gerado por Antigravity OS v4.0.2</span>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">© 2026 Giro Trade Logística LTDA</span>
        </div>
      </div>
    </motion.div>
  );
}
function DevolucaoView() {
  const [biData, setBiData] = useState<LogisticsData[]>([]);
  const [ticketDiaData, setTicketDiaData] = useState<{ colA: string, date: string, delay: string, title?: string, desc?: string }[]>([]);
  const [ticketDiaAnteriorData, setTicketDiaAnteriorData] = useState<{ colA: string }[]>([]);
  const [debitoData, setDebitoData] = useState<{ date: string, value: number, carrier: string }[]>([]);
  const [gerenciadorData, setGerenciadorData] = useState<Record<string, any>>({});
  const [isFinancialExpanded, setIsFinancialExpanded] = useState(false);
  const [isDelayedExpanded, setIsDelayedExpanded] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const parseCSV = (csv: string) => {
    if (!csv) return [];
    const lines = csv.split(/\r?\n/);
    const firstLine = lines.find(l => l.trim() !== '') || '';
    const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

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
        if (currentLine.join('').trim() !== '') rows.push(currentLine);
        currentLine = []; currentField = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else { currentField += char; }
    }
    if (currentLine.length > 0 || currentField !== '') {
      currentLine.push(currentField.trim());
      if (currentLine.join('').trim() !== '') rows.push(currentLine);
    }
    return rows;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cacheBuster = `&t=${new Date().getTime()}`;
        const fetchCSV = async (url: string) => {
          try {
            const res = await fetch(`${url}${cacheBuster}`);
            if (!res.ok) return null;
            const text = await res.text();
            if (text.includes('<!DOCTYPE html>') || text.includes('<html')) return null;
            return parseCSV(text);
          } catch (e) { return null; }
        };

        const ticketDiaUrl = TICKET_DIA_CSV_URL;
        const ticketDiaAnteriorUrl = TICKET_DIA_ANTERIOR_CSV_URL;
        const basetimeUrl = BASETIME_CSV_URL;
        const debitoUrl = DEBITO_CSV_URL;
        const gerenciadorUrl = GERENCIADOR_ORDEM_CSV_URL;

        const [tRowsRaw, taRows, bRows, dRows, gRows] = await Promise.all([
          fetchCSV(ticketDiaUrl), fetchCSV(ticketDiaAnteriorUrl), fetchCSV(basetimeUrl), fetchCSV(debitoUrl), fetchCSV(gerenciadorUrl)
        ]);

        let tRows = tRowsRaw;
        if (!tRows || tRows.length < 2) {
          const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=992823488`;
          tRows = await fetchCSV(fallbackUrl);
        }

        if (bRows && bRows.length >= 2) {
          const h = bRows[0].map(s => s.toLowerCase().trim());
          const dIdx = h.findIndex(s => s.includes('data'));
          const sIdx = h.findIndex(s => s.includes('status') || s.includes('situação'));
          const fIdx = h.findIndex(s => s.includes('fornecedor'));
          const oIdx = h.findIndex(s => s.includes('ordem') || s.includes('pedido'));
          const dcIdx = h.findIndex(s => s === 'doca' || s === 'ag' || (s.includes('doca') && !s.includes('chegada') && !s.includes('saída') && !s.includes('saida')));
          const cIdx = h.findIndex(s => s.includes('conferente'));
          
          setBiData(bRows.slice(1).map(c => {
            const currentDoca = c[dcIdx] || '';
            let derivedStatus = c[sIdx] || '';
            if (currentDoca && currentDoca.trim() !== '' && currentDoca !== '0' && currentDoca !== '-') {
              derivedStatus = 'DESCARREGANDO';
            }
            
            return {
              date: c[dIdx] || '', 
              status: derivedStatus, 
              fornecedor: c[fIdx] || '', 
              ordem: c[oIdx] || '', 
              tipo: '',
              chegadaDoca: '', saidaDoca: '', 
              doca: currentDoca, 
              inicioDescarga: '', fimDescarga: '', inicioConferencia: '', 
              fimConferencia: '', 
              conferente: c[cIdx] || '', 
              tempoTotal: '', tipoArmazenagem: '', palete: ''
            };
          }).filter(x => x.date !== ''));
        }

        if (tRows && tRows.length >= 2) {
          const h = tRows[0].map(s => s.toLowerCase().trim());
          let dIdx = h.findIndex(s => s === 'data de atualização' || s === 'data_atualizacao' || (s.includes('atualização') && s.includes('data')) || (s.includes('atualizacao') && s.includes('data')));
          if (dIdx === -1) {
            dIdx = h.findIndex(s => s.includes('atualiza') || s.includes('update'));
          }
          if (dIdx === -1) {
            dIdx = h.findIndex(s => s === 'data de criação' || s === 'data_criacao' || s.includes('criação') || s.includes('criacao'));
          }
          if (dIdx === -1) dIdx = 26; // Column AA (Data de atualização)
          const lIdx = h.findIndex(s => s.includes('delay') || s.includes('atraso'));
          const rIdx = h.findIndex(s => s === 'data de resolução' || s === 'data_resolucao' || (s.includes('resolução') && s.includes('data')) || (s.includes('resolucao') && s.includes('data')));
          setTicketDiaData(tRows.slice(1).map(c => ({
            colA: c[0] || '', 
            date: c[dIdx] || '', 
            delay: c[lIdx >= 0 ? lIdx : 16] || '0',
            title: c[2] || '',
            desc: c[3] || '',
            resolvedDate: rIdx >= 0 ? (c[rIdx] || '') : ''
          })).filter(x => x.colA.trim().length >= 3 && !x.colA.includes('#') && !['false', 'true', 'id'].includes(x.colA.toLowerCase())));
        }

        if (gRows && gRows.length >= 2) {
          const hG = gRows[0].map(s => s.toLowerCase().trim());
          const findColListLocal = (searchTerms: string[], defaultIdx: number) => {
            let idx = hG.findIndex(h => searchTerms.includes(h));
            if (idx !== -1) return idx;
            idx = hG.findIndex(h => searchTerms.some(term => h.includes(term)));
            return idx !== -1 ? idx : defaultIdx;
          };

          const colIdxG = {
            or: findColListLocal(['ordem de recebimento', 'nº or', 'ordem', 'or'], 0),
            fornecedor: findColListLocal(['remetente', 'fornecedor', 'cliente'], 12),
            chegada: findColListLocal(['data de cadastro', 'cadastro or', 'cadastro'], 6),
            inicio: findColListLocal(['inicio da data de conferencia', 'início da data de conferência', 'horário que iniciou a conferencia', 'horário inicio', 'início conferência', 'inicio conferencia', 'início da conferência'], 20),
            fim: findColListLocal(['finaliza a carga', 'finalizar carga', 'finaliza a conferencia', 'horário fim', 'fim conferência', 'fim conferencia', 'fim da conferência'], 22),
            total: findColListLocal(['tempo total', 'tempo médio'], 18),
            mapa: findColListLocal(['finaliza o recebimento', 'mapa de alocação', 'alocação', 'geração do mapa'], 24),
            conferente: findColListLocal(['usuário da conferência', 'conferente', 'usuário conferencia'], 21),
            doca: findColListLocal(['veiculo', 'doca'], 32),
            conferida: findColListLocal(['conferida'], 14)
          };

          const mappingG: Record<string, any> = {};
          gRows.slice(1).forEach(cols => {
            const rawValue = (cols[colIdxG.or] || '').replace(/"/g, '').trim();
            const rawOr = rawValue.replace(/^OR[:\s]*/i, '').trim();
            if (rawOr && rawOr !== '-' && rawOr !== '0') {
              mappingG[rawOr] = {
                or: rawOr,
                fornecedor: (cols[colIdxG.fornecedor] || '').replace(/"/g, '').trim(),
                chegada: (cols[colIdxG.chegada] || '').replace(/"/g, '').trim(),
                inicio: (cols[colIdxG.inicio] || '').replace(/"/g, '').trim(),
                fim: (cols[colIdxG.fim] || '').replace(/"/g, '').trim(),
                total: (cols[colIdxG.total] || '').replace(/"/g, '').trim(),
                mapaAlocacao: (cols[colIdxG.mapa] || '').replace(/"/g, '').trim(),
                conferente: (cols[colIdxG.conferente] || '').replace(/"/g, '').trim(),
                doca: (cols[colIdxG.doca] || '').replace(/"/g, '').trim(),
                conferida: (cols[colIdxG.conferida] || '').replace(/"/g, '').trim().toUpperCase()
              };
            }
          });
          setGerenciadorData(mappingG);
        }

        if (taRows && taRows.length >= 2) {
          setTicketDiaAnteriorData(taRows.slice(1).map(c => ({ colA: c[0] || '' })).filter(x => x.colA.trim().length >= 3));
        }

        if (dRows && dRows.length >= 2) {
          const h = dRows[0].map(s => s.toLowerCase());
          const dIdx = h.findIndex(s => s.includes('data'));
          const vIdx = h.findIndex(s => s.includes('valor'));
          const cIdx = h.findIndex(s => s.includes('transportadora') || s.includes('nome fantasia'));
          setDebitoData(dRows.slice(1).map(c => {
            const v = parseFloat((c[vIdx >= 0 ? vIdx : 8] || '0').replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
            return { date: c[dIdx >= 0 ? dIdx : 5] || '', value: v, carrier: c[cIdx >= 0 ? cIdx : 3] || 'N/A' };
          }).filter(x => x.date !== ''));
        }
      } catch (err) { console.error('Error:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const normalizeDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      // Remove time part if exists and replace dashes with slashes
      let pure = dStr.split(/\s+/)[0].replace(/-/g, '/');
      const parts = pure.split('/');
      if (parts.length === 3) {
        // Handle YYYY/MM/DD
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        // Handle DD/MM/YYYY
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
      return pure;
    } catch (e) { return dStr; }
  };

  const getBusinessDaysCount = (dateStr: string) => {
    if (!dateStr) return 0;
    try {
      let d: Date;
      const pureDate = dateStr.split(/\s+/)[0].replace(/-/g, '/');
      const parts = pureDate.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY/MM/DD
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else { // DD/MM/YYYY
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        d = new Date(pureDate);
      }
      
      if (isNaN(d.getTime())) return 0;
      
      let today = new Date();
      if (today.getFullYear() < 2026) {
        today = new Date('2026-06-03T14:20:00Z');
      }
      today.setHours(0, 0, 0, 0);
      const current = new Date(d);
      current.setHours(0, 0, 0, 0);
      
      let count = 0;
      const tempDate = new Date(current);
      while (tempDate < today) {
        tempDate.setDate(tempDate.getDate() + 1);
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) {
          count++;
        }
      }
      return count;
    } catch (e) {
      return 0;
    }
  };

  const dashboardData = useMemo(() => {
    const recusados = biData.filter(item => item.status.toLowerCase().includes('recusado'));
    
    const dailyEntradas: Record<string, { qtd: number, withinTerm: number, delayed: number }> = {};
    const dailySaidas: Record<string, number> = {};
    
    const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const delayedTickets: any[] = [];
    ticketDiaData.forEach(t => {
      const dateKey = normalizeDate(t.date);
      if (!dateKey) return;

      if (!dailyEntradas[dateKey]) {
        dailyEntradas[dateKey] = { qtd: 0, withinTerm: 0, delayed: 0 };
      }
      dailyEntradas[dateKey].qtd += 1;
      
      const businessDaysDelay = getBusinessDaysCount(t.date);
      
      if (businessDaysDelay < 6) {
        dailyEntradas[dateKey].withinTerm += 1;
      } else {
        // Exclude resolved tickets to match the active delay list
        const isResolved = (t as any).resolvedDate && (t as any).resolvedDate.trim() !== '';
        if (isResolved) return;

        const combinedText = `${t.title || ''} ${t.desc || ''} ${t.colA}`.toUpperCase();

        // Find active match in biData (Basetime sheet)
        let activeMatch = biData.find(d => {
          if (!d.ordem || d.ordem === '-' || d.ordem === '0') return false;
          const ord = d.ordem.trim().toUpperCase();
          if (ord.length < 4) return false;
          return combinedText.includes(ord);
        });

        // Find historical match in gerenciadorData (Gerenciador de ordem sheet)
        let historicalMatch: any = null;
        if (!activeMatch && gerenciadorData) {
          historicalMatch = Object.values(gerenciadorData).find((g: any) => {
            const ord = String(g.or || '').toUpperCase().trim();
            const nf = String(g.NF || g.nf || '').toUpperCase().trim();
            const ordMatch = ord.length >= 4 && combinedText.includes(ord);
            const nfMatch = nf.length >= 4 && combinedText.includes(nf);
            return ordMatch || nfMatch;
          });
        }

        const match = activeMatch || historicalMatch;

        let derivedStatus = 'ATRASADO';
        let isFinished = false;

        if (match) {
          isFinished = activeMatch 
            ? (activeMatch.status.toLowerCase().includes('finalizad') || 
               activeMatch.status.toLowerCase().includes('concluid') || 
               activeMatch.status === 'OK' || 
               (activeMatch.fimConferencia && activeMatch.fimConferencia.trim() !== '' && activeMatch.fimConferencia !== '-' && activeMatch.fimConferencia !== '0'))
            : (match.conferida === 'S' || 
               (match.fim && match.fim.trim() !== '' && match.fim !== '-' && match.fim !== '0') || 
               (match.mapaAlocacao && match.mapaAlocacao.trim() !== '' && match.mapaAlocacao !== '-' && match.mapaAlocacao !== '0'));

          if (isFinished) {
            derivedStatus = 'CONCLUÍDO PLANILHA';
          } else {
            derivedStatus = activeMatch ? (activeMatch.status || 'EM ANDAMENTO') : 'EM ANDAMENTO';
          }
        } else {
          derivedStatus = 'SEM VÍNCULO';
        }

        dailyEntradas[dateKey].delayed += 1;
        delayedTickets.push({ 
          ...t, 
          businessDaysDelay,
          formattedDate: dateKey,
          doca: match?.doca || '---',
          conferente: match?.conferente || '---',
          status: derivedStatus,
          isFinishedOnWarehouse: isFinished
        });
      }
    });

    recusados.forEach(item => {
      const dateKey = normalizeDate(item.date);
      if (!dateKey) return;
      dailySaidas[dateKey] = (dailySaidas[dateKey] || 0) + 1;
    });

    const allDates = Array.from(new Set([...Object.keys(dailyEntradas), ...Object.keys(dailySaidas)]))
      .sort((a, b) => {
        const parseDate = (d: string) => {
          const parts = d.split('/');
          if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          return 0;
        };
        return parseDate(a) - parseDate(b);
      });

    const chartData = allDates.slice(-15).map(date => {
      const parts = date.split('/');
      const formattedDate = parts.length === 3 ? `${parts[0]}/${monthNamesShort[parseInt(parts[1]) - 1]}` : date;
      
      return {
        date: formattedDate,
        withinTerm: dailyEntradas[date]?.withinTerm || 0,
        delayed: dailyEntradas[date]?.delayed || 0,
        saidas: dailySaidas[date] || 0,
        total: (dailyEntradas[date]?.qtd || 0)
      };
    });

    const totalEntradas = ticketDiaData.filter(t => 
      !ticketDiaAnteriorData.some(ant => ant.colA.trim().toUpperCase() === t.colA.trim().toUpperCase())
    ).length;

    const totalSaidasInv = ticketDiaAnteriorData.filter(ant => 
      !ticketDiaData.some(t => t.colA.trim().toUpperCase() === ant.colA.trim().toUpperCase())
    ).length;

    // Current backlog are unique IDs in today's sheet
    const uniqueIdsToday = new Set(ticketDiaData.map(t => t.colA.trim().toUpperCase()));
    const saldo = uniqueIdsToday.size;
    const saldoYesterday = new Set(ticketDiaAnteriorData.map(ant => ant.colA.trim().toUpperCase())).size;

    const monthlyStats: Record<string, { 
      month: string, 
      total: number, 
      count: number, 
      index: number,
      topCarrier?: { name: string, value: number }
    }> = {};
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const carrierExpenses: Record<string, Record<string, number>> = {};

    debitoData.forEach(item => {
      let monthIdx = -1;
      if (item.date.includes('/')) monthIdx = parseInt(item.date.split('/')[1]) - 1;
      else if (item.date.includes('-')) monthIdx = parseInt(item.date.split('-')[1]) - 1;

      if (monthIdx >= 0 && monthIdx < 12) {
        const monthName = monthNames[monthIdx];
        if (!monthlyStats[monthName]) {
          monthlyStats[monthName] = { month: monthName, total: 0, count: 0, index: monthIdx };
          carrierExpenses[monthName] = {};
        }
        monthlyStats[monthName].count += 1;
        monthlyStats[monthName].total += item.value;
        
        carrierExpenses[monthName][item.carrier] = (carrierExpenses[monthName][item.carrier] || 0) + item.value;
      }
    });

    // Find top carrier for each month
    Object.keys(monthlyStats).forEach(monthName => {
      const carriers = carrierExpenses[monthName];
      let topCarrierName = 'N/A';
      let topCarrierValue = 0;
      
      Object.entries(carriers).forEach(([name, value]) => {
        if (value > topCarrierValue) {
          topCarrierValue = value;
          topCarrierName = name;
        }
      });
      
      monthlyStats[monthName].topCarrier = { name: topCarrierName, value: topCarrierValue };
    });

    const detailedList: { date: string, status: string, total: number, rawDate: string }[] = [];
    allDates.forEach(date => {
      const parts = date.split('/');
      const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const formattedDate = parts.length === 3 ? `${parts[0]}/${monthNamesShort[parseInt(parts[1]) - 1]}` : date;
      
      if (dailyEntradas[date]?.withinTerm > 0) {
        detailedList.push({
          date: formattedDate,
          status: 'DENTRO DO PRAZO',
          total: dailyEntradas[date].withinTerm,
          rawDate: date
        });
      }
      if (dailyEntradas[date]?.delayed > 0) {
        detailedList.push({
          date: formattedDate,
          status: 'ATRASADO',
          total: dailyEntradas[date].delayed,
          rawDate: date
        });
      }
    });

    const saldoTrend = saldoYesterday > 0 ? (saldo > saldoYesterday ? `+${(((saldo / saldoYesterday) - 1) * 100).toFixed(0)}%` : `-${(((1 - saldo / saldoYesterday)) * 100).toFixed(0)}%`) : '0%';
    const fechadosTrend = saldoYesterday > 0 ? `+${((totalSaidasInv / saldoYesterday) * 100).toFixed(0)}%` : '0%';
    const novosTrend = saldoYesterday > 0 ? `+${((totalEntradas / saldoYesterday) * 100).toFixed(0)}%` : '0%';
    const delayedTrend = saldoYesterday > 0 ? `+${((delayedTickets.length / saldo) * 100).toFixed(0)}%` : '0%';

    return {
      chartData,
      monthlyTable: Object.values(monthlyStats).sort((a, b) => a.index - b.index),
      totalEntradas,
      totalSaidasInv,
      saldo,
      saldoYesterday,
      saldoTrend,
      fechadosTrend,
      novosTrend,
      delayedTrend,
      totalDelayed: Object.values(dailyEntradas).reduce((acc, curr) => acc + curr.delayed, 0),
      delayedTickets: delayedTickets.sort((a, b) => b.businessDaysDelay - a.businessDaysDelay),
      eficiencia: totalEntradas > 0 ? ((totalSaidasInv / totalEntradas) * 100).toFixed(1) : '0.0',
      detalhamento: detailedList.sort((a, b) => {
        const parseDate = (d: string) => {
          const parts = d.split('/');
          if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          return 0;
        };
        return parseDate(b.rawDate) - parseDate(a.rawDate);
      })
    };
  }, [biData, ticketDiaData, debitoData, gerenciadorData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RotateCcw className="w-12 h-12 text-blue-500 animate-spin" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Carregando Painel de Monitoramento...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1"
    >
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              Monitoramento devolução
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ANÁLISE DE FILA DE CARGAS EM TEMPO REAL • {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">STATUS DO SISTEMA</span>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-md">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500 uppercase">OPERACIONAL</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-500 uppercase">ÚLTIMA ATUALIZAÇÃO</span>
              <span className="text-[11px] font-black text-white font-mono">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Truck Animation Area - Ultra Visibility */}
      <div className="w-full h-24 relative z-[100] overflow-hidden mb-2 pointer-events-none">
        <motion.div
          animate={{ x: ["-20vw", "120vw"] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 top-0 h-full flex items-center"
        >
          <div className="relative flex items-center">
            {/* Pulsing glow for maximum visibility */}
            <motion.div 
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-blue-400/30 blur-3xl rounded-full scale-[2]" 
            />
            
            <div className="relative">
              <Truck className="w-16 h-16 text-blue-300 drop-shadow-[0_0_20px_rgba(59,130,246,1)]" />
              {/* Ground glow */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-14 h-3 bg-blue-400/50 blur-lg rounded-full" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* KPI Row (Full Width) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'TOTAL DE TICKETS', val: dashboardData.saldo, icon: Ticket, color: 'bg-blue-500/10 text-blue-500', trend: dashboardData.saldoTrend, trendColor: 'text-blue-400' },
          { label: 'TICKETS FECHADOS', val: dashboardData.totalSaidasInv, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500', trend: dashboardData.fechadosTrend, trendColor: 'text-emerald-500' },
          { label: 'TICKETS NOVOS', val: dashboardData.totalEntradas, icon: ArrowUpRight, color: 'bg-orange-500/10 text-orange-500', trend: dashboardData.novosTrend, trendColor: 'text-orange-500' },
          { label: 'TICKETS EM ATRASO', val: dashboardData.totalDelayed, icon: AlertCircle, color: 'bg-rose-500/10 text-rose-500', trend: dashboardData.delayedTrend, trendColor: 'text-rose-500' }
        ].map((kpi, i) => {
          const isAtraso = kpi.label === 'TICKETS EM ATRASO';
          return (
            <div 
              key={i} 
              onClick={() => isAtraso && setIsDelayedExpanded(!isDelayedExpanded)}
              className={cn(
                "glass-card tech-border p-4 lg:p-6 rounded-3xl relative group min-h-[140px] lg:min-h-[160px] flex flex-col justify-center transition-all duration-300",
                !isDelayedExpanded && "overflow-hidden",
                isAtraso && "cursor-pointer hover:bg-white/5 active:scale-95",
                isAtraso && isDelayedExpanded && "z-[200] shadow-[0_0_50px_rgba(244,63,94,0.3)] border-rose-500/50"
              )}
            >
              <div className="flex justify-between items-start mb-2 lg:mb-4">
                <div className={cn("p-2 rounded-lg", kpi.color)}>
                  <kpi.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-black", kpi.trendColor)}>
                  <ArrowUpRight className="w-3 h-3" />
                  {kpi.trend}
                </div>
              </div>
              <span className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{kpi.label}</span>
              <div className="text-3xl lg:text-4xl font-black mt-1 text-white font-mono tracking-tighter flex items-center gap-2">
                {kpi.val}
                {isAtraso && (
                  <motion.div
                    animate={{ rotate: isDelayedExpanded ? 180 : 0 }}
                    className="text-slate-500"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                )}
              </div>

              {isAtraso && (
                <AnimatePresence>
                  {isDelayedExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-[105%] left-0 right-0 bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[300] max-h-[450px] overflow-y-auto custom-scrollbar tech-border"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-1">
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Lista de Tickets em Atraso</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Total: {dashboardData.delayedTickets.length}</span>
                        </div>
                        
                        {dashboardData.delayedTickets.length > 0 ? (
                          <div className="flex flex-col gap-2">
                             {dashboardData.delayedTickets.map((ticket: any, tIdx: number) => (
                              <div key={tIdx} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col gap-2 hover:bg-white/10 transition-colors">
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-black text-white font-mono">{ticket.colA}</span>
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                                        ticket.status === 'DESCARREGANDO' ? 'bg-blue-500/20 text-blue-400' : 
                                        ticket.status === 'RECUSADO' ? 'bg-orange-500/20 text-orange-400' :
                                        ticket.status === 'NO SHOW' ? 'bg-rose-500/20 text-rose-400' :
                                        ticket.status === 'CONCLUÍDO PLANILHA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' :
                                        ticket.status === 'SEM VÍNCULO' ? 'bg-slate-500/10 text-slate-500/80 italic font-medium' :
                                        'bg-slate-500/20 text-slate-400'
                                      )}>
                                        {ticket.status}
                                      </div>
                                      {ticket.doca && ticket.doca !== '---' && ticket.doca !== '0' && ticket.doca !== '-' && (
                                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                          <Truck className="w-2.5 h-2.5 text-slate-500" />
                                          <span className="text-[8px] font-black text-slate-300 uppercase font-mono">Doca {ticket.doca}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-black text-rose-500 font-mono leading-none">
                                      {ticket.businessDaysDelay}d
                                    </div>
                                    <div className="text-[8px] font-black text-slate-500 uppercase mt-0.5">atraso</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span className="text-[9px] text-slate-400 font-mono">Entrada: {ticket.formattedDate}</span>
                                  </div>
                                  <div className="flex items-center gap-2 justify-end">
                                    <div className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">
                                      {ticket.conferente && ticket.conferente !== '---' ? `Conf: ${ticket.conferente}` : 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-[10px] font-bold text-slate-600 uppercase italic opacity-50">
                            Nenhum ticket em atraso encontrado
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Side: Chart + Financial */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Chart Area */}
          <div className="glass-card tech-border rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Volume de Tickets por Data</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Distribuição temporal e status de entrega</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  <span className="text-[9px] font-black text-slate-400 uppercase">Dentro do Prazo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  <span className="text-[9px] font-black text-slate-400 uppercase">Em Atraso</span>
                </div>
              </div>
            </div>
            
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.chartData} barGap={16}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    dx={-10}
                  />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="withinTerm" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                  <Bar dataKey="delayed" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Financial Impact (Moved and Horizontal) */}
          <div className="glass-card tech-border rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex justify-between items-end">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Débitos por Mês</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Impacto Financeiro Estimado</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Geral</span>
                <div className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    dashboardData.monthlyTable.reduce((acc, curr) => acc + curr.total, 0)
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dashboardData.monthlyTable.map((m, i) => (
                <div 
                  key={i} 
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group/month hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setIsFinancialExpanded(!isFinancialExpanded)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider group-hover/month:text-emerald-400 transition-colors">{m.month}/26</span>
                    <span className="text-[11px] font-black text-emerald-400 font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.total)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.count / Math.max(...dashboardData.monthlyTable.map(x => x.count))) * 100}%` }}
                      className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                    />
                  </div>

                  <AnimatePresence>
                    {isFinancialExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-slate-900/60 rounded-xl p-3 mt-1 border border-white/5 flex flex-col gap-1.5">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Principal Transportadora</span>
                            <span className="text-[9px] font-black text-white uppercase truncate">{m.topCarrier?.name}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Gasto</span>
                            <span className="text-[9px] font-black text-emerald-400 font-mono">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.topCarrier?.value || 0)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Detalhamento */}
        <div className="flex flex-col gap-6">
          {/* Detalhamento Section */}
          <div className="glass-card tech-border rounded-3xl p-8 flex flex-col gap-8 h-full">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Detalhamento</h3>
            </div>
            
            <div className="grid grid-cols-3 px-4 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Data</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Total</span>
            </div>
            
            <div className="max-h-[680px] overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
              {dashboardData.detalhamento.map((item, idx) => {
                const isDelayed = item.status === 'ATRASADO';
                const isExpanded = isDelayed && !!expandedDates[item.rawDate];
                const ticketsForThisDate = isDelayed ? dashboardData.delayedTickets.filter(t => t.formattedDate === item.rawDate) : [];

                return (
                  <div key={idx} className="flex flex-col gap-2">
                    <div 
                      onClick={() => {
                        if (isDelayed) {
                          setExpandedDates(prev => ({ ...prev, [item.rawDate]: !prev[item.rawDate] }));
                        }
                      }}
                      className={cn(
                        "bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all duration-200 group/row",
                        isDelayed ? "cursor-pointer hover:bg-slate-800/40" : "",
                        isExpanded ? "border-rose-500/30 bg-rose-950/10" : ""
                      )}
                    >
                      <div className="w-1/3 flex items-center gap-2">
                        {isDelayed && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-center text-slate-400 group-hover/row:text-rose-400"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        )}
                        <div className={cn(
                          "text-[14px] font-black font-mono transition-colors", 
                          isDelayed ? "text-rose-200 group-hover/row:text-white" : "text-slate-300 group-hover/row:text-white"
                        )}>
                          {item.date}
                        </div>
                      </div>
                      
                      <div className="w-1/3 flex justify-center">
                        <div className={cn(
                          "flex items-center gap-2 px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight",
                          isDelayed ? 'text-rose-500 bg-rose-500/5' : 'text-emerald-500 bg-emerald-500/5'
                        )}>
                          {isDelayed ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          {item.status}
                        </div>
                      </div>
                      
                      <div className="w-1/3 text-right text-2xl font-black text-white font-mono tracking-tighter flex justify-end items-center gap-1">
                        <span>{item.total}</span>
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
                          <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 ml-4">
                            <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-1">
                              Lista de Ocorrências Atrasadas ({ticketsForThisDate.length})
                            </div>
                            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                              {ticketsForThisDate.length > 0 ? (
                                ticketsForThisDate.map((t, tIdx) => (
                                  <div key={tIdx} className="bg-white/5 border border-white/5 hover:border-slate-700/50 hover:bg-white/10 transition-colors p-3 rounded-xl flex flex-col gap-2 text-left">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-[11px] font-mono font-black text-slate-200 uppercase tracking-wider">{t.colA}</span>
                                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <span className="text-[9px] font-black text-rose-400 bg-rose-400/5 px-2 py-0.5 rounded-full font-mono uppercase">
                                          {t.businessDaysDelay}d atraso
                                        </span>
                                        <span className={cn(
                                          "text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                                          t.status.includes('CONCLUÍDO') ? "text-emerald-400 bg-emerald-400/10" : "text-yellow-400 bg-yellow-400/15"
                                        )}>
                                          {t.status}
                                        </span>
                                      </div>
                                    </div>
                                    {t.title && (
                                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tight line-clamp-1 leading-snug">{t.title}</div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-600">Doca</span>
                                        <span className="font-mono text-slate-300">{t.doca}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-600">Conferente</span>
                                        <span className="font-mono text-slate-300 truncate">{t.conferente}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-slate-500 italic text-center py-4 uppercase">Sem ocorrências ativas ou pendentes encontradas</div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Total Geral Footer for Detalhamento */}
            <div className="mt-2 pt-6 border-t border-white/10 flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Geral</span>
                <span className="text-3xl font-black text-white font-mono tracking-tighter">
                  {dashboardData.detalhamento.reduce((acc, curr) => acc + curr.total, 0)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('giro_auth') === 'true';
  });
  const [data, setData] = useState<LogisticsData[]>([]);
  const [gerenciadorData, setGerenciadorData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mapaLoading, setMapaLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [view, setView] = useState<'dashboard' | 'reports' | 'bi' | 'devolucao' | 'analytics' | 'daily_report' | 'cross_reference'>('dashboard');
  const [tvMode, setTvMode] = useState(false);
  const [mapaData, setMapaData] = useState<Record<string, { pallets: number, empty: number, total: number }>>({});
  const [operadoresData, setOperadoresData] = useState<Record<string, Record<string, number>>>({});
  const [operadoresLoading, setOperadoresLoading] = useState(false);
  const [pendingLots, setPendingLots] = useState<number>(0);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const today = new Date();
  const todayFormatted = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchData(selectedDate),
        fetchMapaData(),
        fetchMapaPendenteData(),
        fetchOperadoresData(selectedDate)
      ]);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    const [d, m] = selectedDate.split('/').map(Number);
    const date = new Date(2026, m - 1, d);
    date.setDate(date.getDate() - 1);
    const newDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedDate(newDate);
    fetchData(newDate);
  };

  const handleNextDay = () => {
    const [d, m] = selectedDate.split('/').map(Number);
    const date = new Date(2026, m - 1, d);
    date.setDate(date.getDate() + 1);
    const newDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedDate(newDate);
    fetchData(newDate);
  };

  useEffect(() => {
    let interval: any;
    if (tvMode) {
      interval = setInterval(() => {
        setView(prev => {
          if (prev === 'dashboard') return 'reports';
          if (prev === 'reports') return 'bi';
          if (prev === 'bi') return 'devolucao';
          return 'dashboard';
        });
      }, 15000); // Cycle every 15 seconds for TV mode
    }
    return () => clearInterval(interval);
  }, [tvMode]);

  const formatDate = (dateStr: string) => {
    if (!isEmpty(dateStr)) {
      const parts = dateStr.trim().split(' ')[0].split(/[\/\-]/);
      let day = '', month = '';
      
      if (parts.length >= 2) {
        if (parts[0].length === 4) { // YYYY-MM-DD
          day = parts[2]; month = parts[1];
        } else {
          const p0 = parseInt(parts[0]);
          const p1 = parseInt(parts[1]);
          if (p0 > 12) { day = parts[0]; month = parts[1]; }
          else if (p1 > 12) { day = parts[1]; month = parts[0]; }
          else { day = parts[0]; month = parts[1]; } // Default DD/MM
        }
      }
      
      if (day && month) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const isEmpty = (val: any) => {
    if (val === null || val === undefined) return true;
    const s = String(val).trim().toLowerCase();
    return s === '' || s === '0' || s === '-' || s === 'false' || s === 'n/a' || s === 'null' || s === 'undefined';
  };

  const fetchMapaData = async () => {
    try {
      setMapaLoading(true);
      const cacheBuster = `&t=${new Date().getTime()}`;
      let response = await fetch(`${MAPA_CSV_URL}${cacheBuster}`);
      
      if (!response.ok) {
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=mapa`;
        response = await fetch(`${fallbackUrl}${cacheBuster}`);
      }

      if (!response.ok) {
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('mapa de posições')}`;
        response = await fetch(`${fallbackUrl}${cacheBuster}`);
      }

      if (!response.ok) throw new Error('Falha ao buscar mapa de posições');
      
      const csvText = await response.text();
      const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 2) return;

      const parseRow = (row: string) => {
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim().replace(/^"|"$/g, ''));
        return cols;
      };

      const headers = parseRow(rows[0]).map(h => h.toLowerCase());
      
      // Column D is Sector (index 3), Column L is Empty Position (index 11)
      // We'll use findCol to be safe
      const findCol = (exactNames: string[], partialNames: string[], defaultIdx: number) => {
        // Try exact match first
        let idx = headers.findIndex(h => exactNames.some(n => h === n));
        if (idx !== -1) return idx;
        
        // Try partial match
        idx = headers.findIndex(h => partialNames.some(n => h.includes(n)));
        return idx !== -1 ? idx : defaultIdx;
      };

      const colSetor = findCol(['setor', 'área', 'area', 'tipo armazenagem'], ['setor', 'áre', 'area'], 3);
      const colVazio = findCol(
        ['situação', 'situacao', 'situaã§ã£o', 'situa', 'situao', 'situaçao', 'status', 'vazio', 'vazia'],
        ['situa', 'situao', 'situaã§', 'vazio', 'vazia', 'status'],
        11
      );

      const counts: Record<string, { pallets: number, empty: number, total: number }> = {};
      
      const normalizeSector = (s: string) => {
        const n = s.toUpperCase().trim();
        if (n.includes('MERCEARIA')) return 'MERCEARIA SECA';
        if (n.includes('BEBIDA')) return 'BEBIDAS';
        if (n.includes('LIMPEZA') || n.includes('LAVANDERIA')) return 'LIMPEZA E LAVANDERIA';
        if (n.includes('HIGIENE') || n.includes('SAUDE') || n.includes('BELEZA')) return 'HIGIENE, SAUDE E BELEZA';
        if (n.includes('AEROSOL')) return 'AEROSOL';
        return n;
      };
      
      rows.slice(1).forEach(row => {
        const cols = parseRow(row);
        const rawSetor = (cols[colSetor] || 'SEM SETOR').toUpperCase().trim();
        const setor = normalizeSector(rawSetor);
        const status = (cols[colVazio] || '').toUpperCase().trim();
        
        if (!counts[setor]) {
          counts[setor] = { pallets: 0, empty: 0, total: 0 };
        }
        
        counts[setor].total += 1;
        
        const isVazio = status === 'VAZIO' || status === 'SIM' || status === 'V' || status === 'EMPTY' || status === 'LIVRE' || status === 'DISPONÍVEL';
        
        if (isVazio) {
          counts[setor].empty += 1;
        } else if (status && status !== '' && status !== '-' && status !== '0') {
          counts[setor].pallets += 1;
        }
      });

      setMapaData(counts);
    } catch (error) {
      console.error('Erro ao buscar mapa:', error);
    } finally {
      setMapaLoading(false);
    }
  };

  const fetchMapaPendenteData = async () => {
    try {
      setPendingLoading(true);
      const cacheBuster = `&t=${new Date().getTime()}`;
      
      // Fetch Pendente
      let resPendente = await fetch(`${MAPA_PENDENTE_CSV_URL}${cacheBuster}`);
      if (!resPendente.ok) {
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=mapa%20pendente`;
        resPendente = await fetch(`${fallbackUrl}${cacheBuster}`);
      }
      if (!resPendente.ok) throw new Error('Falha ao buscar mapa pendente');
      const csvPendente = await resPendente.text();
      
      // Fetch Concluido (all of it, to filter out any lot ever allocated)
      let resConcluido = await fetch(`${MAPA_CONCLUIDO_CSV_URL}${cacheBuster}`);
      if (!resConcluido.ok) {
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=mapa%20concluido`;
        resConcluido = await fetch(`${fallbackUrl}${cacheBuster}`);
      }
      if (!resConcluido.ok) throw new Error('Falha ao buscar mapa concluído');
      const csvConcluido = await resConcluido.text();

      const parseRow = (row: string) => {
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            cols.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else current += char;
        }
        cols.push(current.trim().replace(/^"|"$/g, ''));
        return cols;
      };

      const rowsPendente = csvPendente.split(/\r?\n/).filter(row => row.trim() !== '');
      const rowsConcluido = csvConcluido.split(/\r?\n/).filter(row => row.trim() !== '');

      if (rowsPendente.length < 2) {
        setPendingLots(0);
        return;
      }

      const headersPendente = parseRow(rowsPendente[0]).map(h => h.toLowerCase());
      const headersConcluido = parseRow(rowsConcluido[0]).map(h => h.toLowerCase());

      const loteIdxPendente = headersPendente.findIndex(h => h.includes('lote') && !h.includes('indústria') && !h.includes('industria'));
      const loteIdxConcluido = headersConcluido.findIndex(h => h.includes('lote') && !h.includes('indústria') && !h.includes('industria'));

      // If we can't find lote column in either, we just count rows as before
      if (loteIdxPendente === -1 || loteIdxConcluido === -1) {
        setPendingLots(rowsPendente.length - 1);
        return;
      }

      const findTipoRecIdx = (headersList: string[]) => {
        return headersList.findIndex(h => h.includes('recebi') && (h.includes('descri') || h.includes('descra') || h.includes('descr') || h.includes('ã§ã£') || h.includes('cã§ã£')));
      };
      
      const tipoRecIdxPendente = findTipoRecIdx(headersPendente);
      const tipoRecIdxConcluido = findTipoRecIdx(headersConcluido);

      const concluidoLots = new Set(
        rowsConcluido.slice(1).map(row => {
          const cols = parseRow(row);
          const tIdx = tipoRecIdxConcluido !== -1 ? tipoRecIdxConcluido : 10;
          const tipoRecebimento = cols[tIdx]?.trim().toUpperCase() || '';
          
          // Count only receipt general, ignore devolução
          const isRecebimentoValido = (tipoRecebimento.includes('GERAL') || tipoRecebimento.includes('NORMAL')) && !tipoRecebimento.includes('DEVOLU');
          if (!isRecebimentoValido) return null;
          
          return cols[loteIdxConcluido]?.trim();
        }).filter(l => l && l !== '' && l !== '0')
      );

      const pendingLotsFiltered = rowsPendente.slice(1).filter(row => {
        const cols = parseRow(row);
        const tIdx = tipoRecIdxPendente !== -1 ? tipoRecIdxPendente : 10;
        const tipoRecebimento = cols[tIdx]?.trim().toUpperCase() || '';
        
        // Count only receipt general, ignore devolução
        const isRecebimentoValido = (tipoRecebimento.includes('GERAL') || tipoRecebimento.includes('NORMAL')) && !tipoRecebimento.includes('DEVOLU');
        if (!isRecebimentoValido) return false;

        const lote = cols[loteIdxPendente]?.trim();
        return lote && lote !== '' && lote !== '0' && !concluidoLots.has(lote);
      });

      setPendingLots(pendingLotsFiltered.length);
    } catch (error) {
      console.error('Erro ao buscar mapa pendente:', error);
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchOperadoresData = async (targetDate?: string) => {
    try {
      setOperadoresLoading(true);
      const cacheBuster = `&t=${new Date().getTime()}`;
      
      // Try with accent first
      let response = await fetch(`${MAPA_CONCLUIDO_CSV_URL}${cacheBuster}`);
      
      // Fallback to without accent if failed
      if (!response.ok) {
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=mapa%20concluido`;
        response = await fetch(`${fallbackUrl}${cacheBuster}`);
      }

      if (!response.ok) throw new Error('Falha ao buscar dados de operadores. Verifique o nome da aba na planilha.');
      
      const csvText = await response.text();
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error('A resposta da planilha não é um CSV válido. Verifique se a aba "mapa concluído" existe e está compartilhada.');
      }
      const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 2) {
        console.warn('Nenhum dado encontrado na aba "mapa concluído" além do cabeçalho.');
        return;
      }

      const parseRow = (row: string) => {
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim().replace(/^"|"$/g, ''));
        return cols;
      };

      const headers = parseRow(rows[0]).map(h => h.toLowerCase());
      console.log('Headers Mapa Concluido:', headers);
      
      const filterDate = targetDate || todayFormatted;
      console.log('Filtrando por data:', filterDate);
      
      // Coluna AD is index 29 (0-indexed), AC is 28, C is 2
      // Let's try to find them by name first for better robustness, fallback to indices
      let opIdx = headers.findIndex(h => h.includes('usuário de alocação') || h.includes('usuario de alocacao') || h.includes('operador'));
      if (opIdx === -1) opIdx = 29;

      let dateIdx = headers.findIndex(h => h.includes('data de alocação') || h.includes('data de alocacao'));
      if (dateIdx === -1) dateIdx = 28;

      let loteIdx = headers.findIndex(h => h.includes('lote') && !h.includes('indústria') && !h.includes('industria'));
      if (loteIdx === -1) loteIdx = 2; // Column C
      
      let turnoIdx = headers.findIndex(h => h.includes('turno'));
      
      let tipoRecIdx = headers.findIndex(h => h.includes('recebi') && (h.includes('descri') || h.includes('descra') || h.includes('descr') || h.includes('ã§ã£') || h.includes('cã§ã£')));
      if (tipoRecIdx === -1) {
        tipoRecIdx = headers.findIndex(h => h.includes('descrição do tipo de recebimento') || h.includes('descricao do tipo de recebimento'));
      }
      if (tipoRecIdx === -1) tipoRecIdx = 10; // Column K
      
      console.log(`Indices: Op=${opIdx}, Date=${dateIdx}, Lote=${loteIdx}, Turno=${turnoIdx}, TipoRec=${tipoRecIdx}`);

      const shifts: Record<string, Record<string, number>> = {
        'TURNO 1': {},
        'TURNO 2': {}
      };

      // Operator to Shift Mapping based on user image
      const operatorShiftMap: Record<string, string> = {
        'SANTOS.JOSE': 'TURNO 1',
        'FLAVIO.MONTEIRO': 'TURNO 1',
        'MAURICIO.SANTOS': 'TURNO 2',
        'CICERO.SILVA': 'TURNO 2',
        'HUGO.CONCEICAO': 'TURNO 2',
        'ADENILSON': 'TURNO 2'
      };

      let count = 0;
      rows.slice(1).forEach((row, rowIndex) => {
        const cols = parseRow(row);
        
        // Filter by column K (index 10) - Descrição do Tipo de Recebimento
        const tipoRecebimento = cols[tipoRecIdx]?.trim().toUpperCase() || '';
        // Count only general receipts, ignore devolução
        const isRecebimentoValido = (tipoRecebimento.includes('GERAL') || tipoRecebimento.includes('NORMAL')) && !tipoRecebimento.includes('DEVOLU');
        
        if (!isRecebimentoValido) return;

        // Filter by date if date column exists
        if (dateIdx !== -1 && cols[dateIdx]) {
          const rawDate = cols[dateIdx];
          const rowDate = formatDate(rawDate);
          
          // If it's ######## we assume it's today (common display issue in sheets export)
          // But only if we are filtering for today
          const isToday = rawDate.includes('##') && filterDate === todayFormatted;
          const matchesDate = rowDate === filterDate || isToday;
          
          if (!matchesDate) return;
        }

        const op = cols[opIdx]?.trim().toUpperCase();
        if (!op || op === '-' || op === '0' || op === '') return;

        let turno = '';
        
        // Prioritize manual mapping first to override spreadsheet errors
        const mappedShift = Object.entries(operatorShiftMap).find(([name]) => op.includes(name))?.[1];
        if (mappedShift) {
          turno = mappedShift;
        } else if (turnoIdx !== -1) {
          const turnoRaw = cols[turnoIdx]?.trim() || '';
          if (turnoRaw === '1') turno = 'TURNO 1';
          else if (turnoRaw === '2') turno = 'TURNO 2';
          else if (turnoRaw) turno = turnoRaw.toUpperCase();
        }

        if (!turno) turno = 'TURNO 1'; // Default to Turno 1 if unknown but has operator
        
        // Count each line as 1 unit (lote) as requested
        const rawLote = cols[loteIdx]?.trim();
        // Even if lote is empty, if there's an operator, we might want to count the action
        // but the user said "lote alocados", so we check if there's something there
        if (!rawLote || rawLote === '0' || rawLote === '-') return;
        
        if (!shifts[turno]) shifts[turno] = {};
        shifts[turno][op] = (shifts[turno][op] || 0) + 1;
        count++;
      });

      console.log(`Total de registros processados: ${count}`);
      setOperadoresData(shifts);
    } catch (error) {
      console.error('Erro ao buscar dados de operadores:', error);
    } finally {
      setOperadoresLoading(false);
    }
  };

  const fetchGerenciadorData = async () => {
    try {
      const cacheBuster = `&t=${new Date().getTime()}`;
      const response = await fetch(`${GERENCIADOR_ORDEM_CSV_URL}${cacheBuster}`);
      if (!response.ok) return;
      const csv = await response.text();
      
      const robustParse = (csvText: string) => {
        const rows: string[][] = [];
        let currentLine: string[] = [];
        let currentField = '';
        let inQuotes = false;
        const sep = (csvText.slice(0, 1000).match(/;/g) || []).length > (csvText.slice(0, 1000).match(/,/g) || []).length ? ';' : ',';
        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === sep && !inQuotes) { currentLine.push(currentField.trim()); currentField = ''; }
          else if ((char === '\r' || char === '\n') && !inQuotes) {
            currentLine.push(currentField.trim());
            if (currentLine.some(c => c !== '')) rows.push(currentLine);
            currentLine = []; currentField = '';
            if (char === '\r' && csvText[i + 1] === '\n') i++;
          } else { currentField += char; }
        }
        return rows;
      };

      const rows = robustParse(csv);
      if (rows.length < 1) return;

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const findColList = (searchTerms: string[], defaultIdx: number) => {
        let idx = headers.findIndex(h => searchTerms.includes(h));
        if (idx !== -1) return idx;
        idx = headers.findIndex(h => searchTerms.some(term => h.includes(term)));
        return idx !== -1 ? idx : defaultIdx;
      };

      const colIdx = {
        or: findColList(['ordem de recebimento', 'nº or', 'ordem', 'or'], 0),
        fornecedor: findColList(['remetente', 'fornecedor', 'cliente'], 12),
        chegada: findColList(['data de cadastro', 'cadastro or', 'cadastro'], 6),
        inicio: findColList(['inicio da data de conferencia', 'início da data de conferência', 'horário que iniciou a conferencia', 'horário inicio', 'início conferência', 'inicio conferencia', 'início da conferência'], 20),
        fim: findColList(['finaliza a carga', 'finalizar carga', 'finaliza a conferencia', 'horário fim', 'fim conferência', 'fim conferencia', 'fim da conferência'], 22),
        total: findColList(['tempo total', 'tempo médio'], 18),
        mapa: findColList(['finaliza o recebimento', 'mapa de alocação', 'alocação', 'geração do mapa'], 24),
        conferente: findColList(['usuário da conferência', 'conferente', 'usuário conferencia'], 21),
        doca: findColList(['veiculo', 'doca'], 32),
        conferida: findColList(['conferida'], 14)
      };

      const mapping: Record<string, any> = {};
      rows.slice(1).forEach(cols => {
        const rawValue = (cols[colIdx.or] || '').replace(/"/g, '').trim();
        const rawOr = rawValue.replace(/^OR[:\s]*/i, '').trim();
        if (rawOr && rawOr !== '-' && rawOr !== '0') {
          mapping[rawOr] = {
            or: rawOr,
            fornecedor: (cols[colIdx.fornecedor] || '').replace(/"/g, '').trim(),
            chegada: (cols[colIdx.chegada] || '').replace(/"/g, '').trim(),
            inicio: (cols[colIdx.inicio] || '').replace(/"/g, '').trim(),
            fim: (cols[colIdx.fim] || '').replace(/"/g, '').trim(),
            total: (cols[colIdx.total] || '').replace(/"/g, '').trim(),
            mapaAlocacao: (cols[colIdx.mapa] || '').replace(/"/g, '').trim(),
            conferente: (cols[colIdx.conferente] || '').replace(/"/g, '').trim(),
            doca: (cols[colIdx.doca] || '').replace(/"/g, '').trim(),
            conferida: (cols[colIdx.conferida] || '').replace(/"/g, '').trim().toUpperCase()
          };
        }
      });
      setGerenciadorData(mapping);
    } catch (err) {
      console.error('Error fetching gerenciador:', err);
    }
  };

  const fetchData = async (targetDate?: string) => {
    try {
      setLoading(true);
      const cacheBuster = `&t=${new Date().getTime()}`;
      
      const robustParse = (csv: string) => {
        if (!csv) return [];
        const lines = csv.split(/\r?\n/);
        const firstLine = lines.find(l => l.trim() !== '') || '';
        // More robust separator detection: count which occurs most in the first 1000 chars
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
            currentLine = []; currentField = '';
            if (char === '\r' && nextChar === '\n') i++;
          } else { currentField += char; }
        }
        if (currentLine.length > 0 || currentField !== '') {
          currentLine.push(currentField.trim());
          if (currentLine.some(c => c !== '')) rows.push(currentLine);
        }
        return rows;
      };

      const response = await fetch(`${BASETIME_CSV_URL}${cacheBuster}`);
      if (!response.ok) throw new Error('Falha ao buscar dados');
      
      const csvText = await response.text();
      const rows = robustParse(csvText);
      if (rows.length < 2) return;

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const findIndex = (searchTerms: string[], defaultIdx: number) => {
        let idx = headers.findIndex(h => searchTerms.includes(h));
        if (idx !== -1) return idx;
        
        idx = headers.findIndex(h => searchTerms.some(term => {
          if (term === 'or') return h === 'or' || h === 'ordem' || h === 'nº or' || h === 'n or';
          if (term === 'doca') return h === 'doca';
          return h.includes(term);
        }));
        return idx >= 0 ? idx : defaultIdx;
      };

      const colMap = {
        date: findIndex(['data'], 0),
        fornecedor: findIndex(['fornecedor'], 1),
        senha: findIndex(['senha', 'contagem'], 4),
        tipo: findIndex(['tipo', 'tipo d'], 3),
        doca: headers.findIndex(h => h === 'doca' || (h === 'box' || (h.includes('doca') && !h.includes('chegada') && !h.includes('saída')))),
        status: findIndex(['status', 'situação', 'situacao'], 17),
        setor: findIndex(['setor', 'tipo armazenagem'], 19),
        palete: findIndex(['palete', 'paletes'], 20),
        ordem: findIndex(['ordem de recebimento', 'nº or', 'n or', 'recebimento', 'ordem', 'or'], 0),
        inicio: findIndex(['inicio conferencia', 'inicio conferência', 'início da conferência'], 21),
        fim: findIndex(['fim conferencia', 'fim conferência', 'fim da conferência'], 22),
        tempoTotal: findIndex(['tempo total', 'tempo médio'], 18),
        chegada: findIndex(['data de cadastro', 'cadastro or', 'chegada em pátio', 'chegada patio', 'chegada portaria', 'chegada (pátio)', 'chegada'], 6),
        saida: findIndex(['saída da doca', 'saida da doca', 'saída'], 7),
        mapaAlocacao: findIndex(['finaliza o recebimento', 'mapa de alocação', 'mapa alocação', 'alocação', 'geração do mapa'], 24)
      };

      const parsedData: LogisticsData[] = rows.slice(1).map(cols => {
        const rawStatus = (cols[colMap.status] || '').trim();
        const dateRaw = cols[colMap.date] || '';
        const dayFormatted = formatDate(dateRaw);
        const rawOrNum = (cols[colMap.ordem] || '').replace(/"/g, '').trim();
        const cleanOrdem = rawOrNum.replace(/^OR[:\s]*/i, '').trim();

        return {
          date: dayFormatted,
          fornecedor: cols[colMap.fornecedor] || '',
          ordem: cleanOrdem,
          tipo: cols[colMap.tipo] || '',
          chegadaDoca: cols[colMap.chegada] || '',
          saidaDoca: cols[colMap.saida] || '',
          doca: cols[colMap.doca] || '',
          inicioDescarga: '',
          fimDescarga: '',
          inicioConferencia: cols[colMap.inicio] || '',
          fimConferencia: cols[colMap.fim] || '',
          conferente: cols[findIndex(['conferente'], 14)] || '',
          status: rawStatus.toUpperCase(),
          tempoTotal: cols[colMap.tempoTotal] || '',
          tipoArmazenagem: cols[colMap.setor] || '',
          palete: cols[colMap.palete] || '',
          mapaAlocacao: cols[colMap.mapaAlocacao] || ''
        };
      }).filter(d => {
        const hasFornecedor = d.fornecedor && d.fornecedor.trim() !== '' && d.fornecedor.trim() !== '0' && d.fornecedor.trim() !== '-';
        const hasStatus = d.status && d.status.trim() !== '';
        // Allow rows with status even if provider is missing temporarily
        return hasFornecedor || hasStatus;
      });

      setData(parsedData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
    fetchMapaData();
    fetchMapaPendenteData();
    fetchOperadoresData(selectedDate);
    fetchGerenciadorData();
    
    const interval = setInterval(() => {
      fetchData(selectedDate);
      fetchMapaData();
      fetchMapaPendenteData();
      fetchOperadoresData(selectedDate);
      fetchGerenciadorData();
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      fetchOperadoresData(selectedDate);
    }
  }, [selectedDate]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (!d.date) return false;
      return d.date.trim() === selectedDate.trim();
    });
  }, [data, selectedDate]);


  const formatTempoMedio = (tempo: string) => {
    if (!tempo || !tempo.includes(':')) return '0H 00M';
    const parts = tempo.split(':');
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    
    // If it's not a valid number or looks like a date error (very large/negative)
    if (isNaN(h) || isNaN(m) || h < -24 || h > 48) {
      return '---';
    }
    
    return `${Math.abs(h)}H ${Math.abs(m).toString().padStart(2, '0')}M`;
  };

  const calculateTimeDiff = (start: string, end: string) => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return '---';
    
    try {
      const parseTime = (str: string) => {
        const parts = str.trim().split(' ');
        const timePart = parts.length > 1 ? parts[1] : parts[0];
        const timeOnly = timePart.split(':');
        const h = parseInt(timeOnly[0]);
        const m = parseInt(timeOnly[1]);
        return { h, m };
      };

      const s = parseTime(start);
      const e = parseTime(end);
      
      if (isNaN(s.h) || isNaN(s.m) || isNaN(e.h) || isNaN(e.m)) return '---';
      
      let diffMinutes = (e.h * 60 + e.m) - (s.h * 60 + s.m);
      
      // Handle overnight
      if (diffMinutes < 0) diffMinutes += 1440; 
      
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      
      return `${h}H ${m.toString().padStart(2, '0')}M`;
    } catch (err) {
      return '---';
    }
  };

  const stats = useMemo(() => {
    // Resolve base time data with real-time updates from "Gerenciador de Ordem"
    // To prevent multiple name-based matches mapping to the exact same order in Gerenciador,
    // we track which order keys from Gerenciador have already been assigned/matched.
    const usedGerenciadorOrs = new Set<string>();

    // Pass 1: Handle entries with an exact order number (OR) match
    const preMatched = filteredData.map(d => {
      const origStatus = String(d.status || '').toUpperCase().trim();
      const isAlertStatus = origStatus === 'NOSHOW' || origStatus === 'NO SHOW' || origStatus === 'NO-SHOW' || origStatus === 'RECUSADO';

      const orKey = String(d.ordem).replace(/^OR[:\s]*/i, '').trim();
      if (!isAlertStatus && orKey && orKey !== '-' && orKey !== '0' && gerenciadorData[orKey]) {
        usedGerenciadorOrs.add(orKey);
      }
      return { d, isAlertStatus };
    });

    // Pass 2: Match by name and date statefully (prioritizing finished orders if Base Time status is finished)
    const resolvedData = preMatched.map(({ d, isAlertStatus }) => {
      const orKey = String(d.ordem).replace(/^OR[:\s]*/i, '').trim();
      let extra = null;

      if (!isAlertStatus) {
        if (orKey && orKey !== '-' && orKey !== '0' && gerenciadorData[orKey]) {
          extra = gerenciadorData[orKey];
        } else if (d.fornecedor) {
          // Helper to find match based on requirement of being finalized
          const findMatch = (requireFinished: boolean) => {
            return Object.values(gerenciadorData).find((x: any) => {
              if (usedGerenciadorOrs.has(x.or)) return false;

              const nameMatches = matchSupplierNames(x.fornecedor || '', d.fornecedor || '');
              if (!nameMatches) return false;
              
              // Must match the same date to avoid pairing with historical orders of the same supplier
              const extraDateChegada = formatDate(x.chegada);
              const extraDateInicio = formatDate(x.inicio);
              const extraDateFim = formatDate(x.fim);
              
              const dateMatches = (extraDateChegada === d.date) || 
                                  (extraDateInicio === d.date) || 
                                  (extraDateFim === d.date);
              
              if (!dateMatches) return false;

              const xFinished = (x.mapaAlocacao && x.mapaAlocacao.trim() !== '' && x.mapaAlocacao.trim() !== '-' && x.mapaAlocacao.trim() !== '0') ||
                                (x.fim && x.fim.trim() !== '' && x.fim.trim() !== '-' && x.fim.trim() !== '0');

              if (requireFinished) {
                return xFinished;
              }
              return true;
            });
          };

          // Always prefer finding a finalized match in Gerenciador first to resolve correct completion status
          extra = findMatch(true); 
          
          // Fallback to any matching order if no finalized match is found
          if (!extra) {
            extra = findMatch(false);
          }

          if (extra) {
            usedGerenciadorOrs.add(extra.or);
          }
        }
      }

      if (extra) {
        const dIsFinalized = isFinalizado(d);
        const hasFinished = dIsFinalized ||
                            (extra.mapaAlocacao && extra.mapaAlocacao.trim() !== '' && extra.mapaAlocacao.trim() !== '-' && extra.mapaAlocacao.trim() !== '0') ||
                            (extra.fim && extra.fim.trim() !== '' && extra.fim.trim() !== '-' && extra.fim.trim() !== '0') ||
                            (extra.conferida === 'S');
        
        return {
          ...d,
          ordem: (extra.or && extra.or !== '-' && extra.or !== '0') ? extra.or : d.ordem,
          inicioConferencia: (extra.inicio && extra.inicio !== '-' && extra.inicio !== '0') ? extra.inicio : d.inicioConferencia,
          fimConferencia: (extra.fim && extra.fim !== '-' && extra.fim !== '0') ? extra.fim : d.fimConferencia,
          mapaAlocacao: (extra.mapaAlocacao && extra.mapaAlocacao !== '-' && extra.mapaAlocacao !== '0') ? extra.mapaAlocacao : d.mapaAlocacao,
          conferente: (extra.conferente && extra.conferente !== '-' && extra.conferente !== '0') ? extra.conferente : d.conferente,
          status: isAlertStatus ? d.status : (hasFinished ? 'FINALIZADO' : d.status),
          doca: (extra.doca && extra.doca !== '-' && extra.doca !== '0') ? extra.doca : d.doca
        };
      }
      return d;
    });

    const isFinalizadoLocal = (d: LogisticsData) => isFinalizado(d);
    const isEmOperacaoLocal = (d: LogisticsData) => isEmOperacao(d);
    const isAguardandoLocal = (d: LogisticsData) => isAguardando(d);

    const deduplicateLogistics = (list: LogisticsData[]) => {
      const seen = new Set<string>();
      return list.filter(item => {
        const orKey = String(item.ordem || '').replace(/^OR[:\s]*/i, '').trim();
        const hasOrdem = orKey && orKey !== '-' && orKey !== '0' && orKey !== '';
        if (hasOrdem) {
          const supplierKey = String(item.fornecedor || '').trim().toUpperCase();
          const key = `${orKey}_${supplierKey}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        }
        return true;
      });
    };

    // 1. Finalizados
    const finalizadosRaw = resolvedData.filter(isFinalizadoLocal);
    const finalizados = deduplicateLogistics(finalizadosRaw);
    
    const finalizadosBreakdown = {
      cif: finalizados.filter(d => (d.tipo || '').toUpperCase().includes('CIF')).length,
      fob: finalizados.filter(d => (d.tipo || '').toUpperCase().includes('FOB')).length,
      naoAparece: finalizados.filter(d => {
        const s = (d.status || '').toUpperCase();
        return s.includes('APARECE');
      }).length,
      recusado: finalizados.filter(d => (d.status || '').toUpperCase().includes('RECUSADO')).length,
      noshow: finalizados.filter(d => {
        const s = (d.status || '').toUpperCase();
        return s.includes('NOSHOW') || s.includes('NO SHOW') || s.includes('NO-SHOW');
      }).length
    };
    
    // 2. Em Operação
    const emOperacaoRaw = resolvedData.filter(isEmOperacaoLocal);
    const emOperacao = deduplicateLogistics(emOperacaoRaw);
    
    // 3. Aguardando - only show items from the selected date (matching the page's day exactly)
    const aguardandoRaw = resolvedData.filter(isAguardandoLocal);
    const aguardando = deduplicateLogistics(aguardandoRaw);

    const total = finalizados.length + emOperacao.length + aguardando.length;

    // Storage types summary - Summing pallets per category
    const storageSummary: Record<string, number> = {
      'MERCEARIA SECA': 0,
      'BEBIDAS': 0,
      'LIMPEZA E LAVANDERIA': 0,
      'HIGIENE, SAUDE E BELEZA': 0,
      'AEROSOL': 0
    };

    const normalizeSector = (s: string) => {
      const n = s.toUpperCase().trim();
      if (n.includes('MERCEARIA')) return 'MERCEARIA SECA';
      if (n.includes('BEBIDA')) return 'BEBIDAS';
      if (n.includes('LIMPEZA') || n.includes('LAVANDERIA')) return 'LIMPEZA E LAVANDERIA';
      if (n.includes('HIGIENE') || n.includes('SAUDE') || n.includes('BELEZA')) return 'HIGIENE, SAUDE E BELEZA';
      if (n.includes('AEROSOL')) return 'AEROSOL';
      return n;
    };

    resolvedData.forEach(item => {
      const rawType = (item.tipoArmazenagem || '').toUpperCase().trim();
      const type = normalizeSector(rawType);
      // Clean the pallet string and parse it
      const palletStr = (item.palete || '').toString().replace(/[^\d]/g, '');
      const pallets = parseInt(palletStr) || 0;
      
      if (type && type !== 'NA' && type !== 'N/A') {
        storageSummary[type] = (storageSummary[type] || 0) + pallets;
      }
    });

    return { 
      total, 
      finalizados, 
      finalizadosBreakdown,
      emOperacao, 
      aguardando, 
      storageSummary
    };
  }, [filteredData, gerenciadorData]);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 font-sans p-4 flex gap-6 relative overflow-hidden">
      {/* Background Grid Decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col gap-8 relative z-20 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)] hover:scale-110 transition-transform z-30"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>

        {/* Logo and Text */}
        <div className={cn("flex items-center gap-3 px-2", isSidebarCollapsed && "justify-center")}>
          <div className="relative w-14 h-10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 48 32" className="w-full h-full">
              <path 
                d="M12 16 A8 8 0 1 1 28 16" 
                fill="none" 
                stroke="white" 
                strokeWidth="5" 
                strokeLinecap="round"
              />
              <path 
                d="M36 16 A8 8 0 1 1 20 16" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="5" 
                strokeLinecap="round"
              />
            </svg>
          </div>
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("flex flex-col -space-y-1", isSidebarCollapsed && "hidden")}
          >
            <span className="text-3xl font-black text-white leading-none tracking-tight">giro</span>
            <span className="text-3xl font-black text-white leading-none tracking-tight">trade</span>
          </motion.div>
          {isSidebarCollapsed && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center -space-y-1">
              <span className="text-[10px] font-black text-white uppercase tracking-tighter">giro</span>
              <span className="text-[10px] font-black text-white uppercase tracking-tighter">trade</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col gap-2 bg-slate-900/50 p-2 rounded-3xl border border-white/5">
          <button 
            onClick={() => setView('dashboard')}
            className={cn(
              "w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden text-left",
              view === 'dashboard' ? "text-white" : "text-slate-500 hover:text-slate-300",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            {view === 'dashboard' && (
              <motion.div 
                layoutId="navTab" 
                className="absolute inset-0 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              <Truck className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Recebimento do Dia</span>}
            </span>
          </button>
          <button 
            onClick={() => setView('reports')}
            className={cn(
              "w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden text-left",
              view === 'reports' ? "text-white" : "text-slate-500 hover:text-slate-300",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            {view === 'reports' && (
              <motion.div 
                layoutId="navTab" 
                className="absolute inset-0 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              <Forklift className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Relatório de Armazenagem</span>}
            </span>
          </button>
          <button 
            onClick={() => setView('analytics')}
            className={cn(
              "w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden text-left",
              view === 'analytics' ? "text-white" : "text-slate-500 hover:text-slate-300",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            {view === 'analytics' && (
              <motion.div 
                layoutId="navTab" 
                className="absolute inset-0 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              <BarChart3 className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>BI Analítico</span>}
            </span>
          </button>
          <button 
            onClick={() => setView('devolucao')}
            className={cn(
              "w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden text-left flex items-center gap-3",
              view === 'devolucao' ? "text-white" : "text-slate-500 hover:text-slate-300",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            {view === 'devolucao' && (
              <motion.div 
                layoutId="navTab" 
                className="absolute inset-0 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Truck className={cn("w-4 h-4 relative z-10 shrink-0", view === 'devolucao' ? "text-white" : "text-slate-500")} />
            {!isSidebarCollapsed && <span className="relative z-10">DEVOLUÇÃO</span>}
          </button>
          <button 
            onClick={() => setView('daily_report')}
            className={cn(
              "w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden text-left flex items-center gap-3",
              view === 'daily_report' ? "text-white" : "text-slate-500 hover:text-slate-300",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            {view === 'daily_report' && (
              <motion.div 
                layoutId="navTab" 
                className="absolute inset-0 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <ClipboardList className={cn("w-4 h-4 relative z-10 shrink-0", view === 'daily_report' ? "text-white" : "text-slate-500")} />
            {!isSidebarCollapsed && <span className="relative z-10">REPORTE DIÁRIO</span>}
          </button>
        </div>

        <div className="mt-auto">
          <button 
            onClick={() => setTvMode(!tvMode)}
            className={cn(
              "w-full px-6 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-2xl active:scale-95 border text-[10px] font-black uppercase tracking-widest",
              tvMode 
                ? "bg-orange-500/20 border-orange-500/50 text-orange-500 animate-pulse" 
                : "bg-[#0f172a] border-slate-800/40 text-[#64748b] hover:bg-slate-800",
              isSidebarCollapsed && "px-0 flex justify-center"
            )}
          >
            <Tv className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>MODO TV</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
        {/* Header */}
        <header className="flex items-center justify-between relative z-20 min-h-[150px]">
          <div className="flex flex-col gap-2 self-start pt-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button 
                  onClick={handlePrevDay}
                  className="glass-card border-white/10 p-1 rounded hover:bg-white/5 transition-colors"
                  title="Dia anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <div className="glass-card border-emerald-500/30 px-3 py-1 rounded-md flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-emerald-400 min-w-[120px] justify-center">
                  <Clock className="w-4 h-4 animate-pulse" />
                  {selectedDate === todayFormatted ? `HOJE: ${selectedDate}` : selectedDate}
                </div>
                <button 
                  onClick={handleNextDay}
                  className="glass-card border-white/10 p-1 rounded hover:bg-white/5 transition-colors"
                  title="Próximo dia"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="glass-card border-white/5 px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                ATUALIZADO: {lastUpdate.toLocaleTimeString('pt-BR')}
                <button 
                  onClick={handleRefresh}
                  disabled={loading}
                  className="ml-1 hover:text-emerald-400 transition-colors disabled:opacity-50"
                  title="Atualizar agora"
                >
                  <Zap className={cn("w-3 h-3", loading && "animate-spin text-emerald-500")} />
                </button>
              </div>
            </div>
          </div>

          {view === 'dashboard' && (
            <motion.div 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none"
            >
              <div className="relative w-full h-12 flex items-center justify-center">
                <h1 className="text-2xl font-black text-white uppercase tracking-[0.4em] drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] relative select-none">
                  RECEBIMENTO DO DIA
                </h1>
              </div>
              <div className="glass-card tech-border rounded-xl px-12 py-2 flex flex-col items-center glow-emerald group hover:scale-105 transition-transform cursor-default pointer-events-auto">
                <div className="corner-accent corner-tl" />
                <div className="corner-accent corner-tr" />
                <div className="corner-accent corner-bl" />
                <div className="corner-accent corner-br" />
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.4em] opacity-70">TOTAL DE CARGAS</span>
                <span className="text-6xl font-black text-white leading-none font-mono tracking-tighter text-glow-emerald">{stats.total}</span>
              </div>
            </motion.div>
          )}
        </header>

        <AnimatePresence mode="wait">
        {view === 'dashboard' ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-4 flex-1 min-h-0 relative"
          >
            {/* Background Logo Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1000px] opacity-[0.25] pointer-events-none z-0">
              <svg viewBox="0 0 48 32" className="w-full h-full overflow-visible">
                <path 
                  d="M12 16 A8 8 0 1 1 28 16" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                />
                <path 
                  d="M36 16 A8 8 0 1 1 20 16" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                />
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-3 min-h-[145px] relative z-10 shrink-0">
        {/* Combined Storage & Empty Positions */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card tech-border rounded-xl p-3 flex flex-col group hover:glow-emerald transition-all"
        >
          <div className="corner-accent corner-tl opacity-40" />
          <div className="corner-accent corner-br opacity-40" />
          <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1.5">
            <h3 className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-[0.3em]">
              RESUMO DE ARMAZENAGEM E POSIÇÕES
            </h3>
            <div className="flex items-center gap-2">
              <Zap className={cn("w-3 h-3", (loading || mapaLoading) && "animate-spin text-emerald-400")} />
            </div>
          </div>
          
          <div className="flex-1 overflow-visible flex justify-center">
            <table className="w-full text-[11px] font-bold border-separate border-spacing-y-0.5">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-widest text-left">
                  <th className="pb-1 pl-2">TIPO ARMAZENAGEM</th>
                  <th className="pb-1 text-center">PALETES</th>
                  <th className="pb-1 text-center font-black">VAZIOS</th>
                  <th className="pb-1 text-right pr-2">SALDO</th>
                </tr>
              </thead>
              <tbody>
                {ALLOWED_SECTORS.map((sector) => {
                  const pallets = stats.storageSummary[sector] || 0;
                  const empty = (mapaData[sector] || { empty: 0 }).empty;
                  const saldo = empty - pallets;
                  return (
                    <tr key={sector} className="group/row hover:bg-white/5 transition-colors">
                      <td className="py-0.5 pl-2 text-slate-400 uppercase flex items-center gap-2">
                        <div className="w-1 h-1 bg-emerald-500/30 rounded-full" />
                        {sector}
                      </td>
                      <td className="py-0.5 text-center">
                        <span className="text-white font-mono bg-emerald-500/5 px-1 rounded">{pallets}</span>
                      </td>
                      <td className="py-0.5 text-center">
                        <span className="text-blue-400 font-mono bg-blue-500/5 px-1 rounded">{empty}</span>
                      </td>
                      <td className="py-0.5 text-right pr-2">
                        <span className="text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {saldo}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* In Operation */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card tech-border rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:glow-orange transition-all"
        >
          <div className="corner-accent corner-tr border-orange-500/40" />
          <div className="corner-accent corner-bl border-orange-500/40" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse" />
          <div className="flex flex-col items-center gap-1 relative z-10">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.4em] flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
              EM OPERAÇÃO
            </span>
            <span className="text-6xl font-black text-white leading-none font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(255,165,0,0.5)]">
              {stats.emOperacao.length}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-mono">CARGAS EM DOCA</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent h-1/2 w-full animate-scan pointer-events-none" />
        </motion.div>

        {/* Finalizados Summary */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card tech-border rounded-xl p-3 flex flex-col group hover:glow-emerald transition-all"
        >
          <div className="corner-accent corner-tl opacity-20" />
          <div className="corner-accent corner-tr opacity-20" />
          
          <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
            <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em]">
              FINALIZADOS
            </h3>
          </div>

          <div className="flex-1 flex flex-col gap-0.5 px-2">
            {[
              { label: 'NÃO (CIF)', value: stats.finalizadosBreakdown.cif, color: 'text-slate-300' },
              { label: 'SIM (FOB)', value: stats.finalizadosBreakdown.fob, color: 'text-slate-300' },
              { label: 'RECUSADO', value: stats.finalizadosBreakdown.recusado, color: 'text-red-500' },
              { label: 'NOSHOW', value: stats.finalizadosBreakdown.noshow, color: 'text-orange-500' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center group/item">
                <span className={cn("text-[10px] font-black uppercase tracking-tight", item.color)}>
                  {item.label}
                </span>
                <div className="w-7 h-5 bg-white/5 border border-white/10 rounded flex items-center justify-center">
                  <span className="text-[11px] font-black text-white font-mono">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-1 border-t border-white/5 flex justify-between items-center">
            <span className="text-[12px] font-black text-emerald-500 uppercase tracking-[0.2em]">TOTAL</span>
            <span className="text-3xl font-black text-emerald-400 font-mono text-glow-emerald leading-none">
              {stats.finalizados.length}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Main Content Columns */}
      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0 relative z-10 overflow-hidden">
        {/* Column 1: Waiting */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card tech-border rounded-3xl flex flex-col overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-600/80 to-blue-500/80 px-4 py-1.5 flex justify-between items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 animate-pulse" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic relative z-10">AGUARDANDO / PÁTIO</h2>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black text-white font-mono relative z-10">{stats.aguardando.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                  <th className="px-3 py-1.5">FORNECEDOR</th>
                  <th className="px-3 py-1.5 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {stats.aguardando.length > 0 ? (
                  stats.aguardando.map((item, idx) => {
                    const hasArrived = item.chegadaDoca && item.chegadaDoca !== '-' && item.chegadaDoca !== '0';
                    const displayStatus = hasArrived ? (item.status || "PÁTIO") : "AGUARDANDO CHEGADA";
                    
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-3 py-[3px]">
                          <div className="text-[9px] font-black text-blue-400 uppercase leading-tight">
                            {formatSupplierName(item.fornecedor)}
                          </div>
                          {item.ordem && item.ordem !== '-' && item.ordem !== '0' && (
                            <div className="text-[9px] text-blue-400/50 font-mono font-bold mt-0.5">OR: {item.ordem}</div>
                          )}
                        </td>
                        <td className="px-3 py-[2px] text-center">
                          <span className={cn(
                            "border text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest whitespace-nowrap inline-block",
                            hasArrived
                              ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-400/60 animate-pulse"
                          )}>
                            {displayStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={2} className="py-20 text-center opacity-20 grayscale">
                      <Truck className="w-12 h-12 mb-2 mx-auto" />
                      <div className="text-[10px] font-black uppercase tracking-widest text-white">Sem cargas aguardando</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Column 2: In Operation */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card tech-border rounded-3xl flex flex-col overflow-hidden"
        >
          <div className="bg-gradient-to-r from-orange-600/80 to-orange-500/80 px-4 py-1.5 flex justify-between items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 animate-pulse" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic relative z-10">EM DOCA / OPERAÇÃO</h2>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black text-white font-mono relative z-10">{stats.emOperacao.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {stats.emOperacao.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                    <th className="px-3 py-1.5">FORNECEDOR</th>
                    <th className="px-3 py-1.5 text-center">DOCA</th>
                    <th className="px-3 py-1 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.emOperacao.map((item, idx) => {
                    const statusLower = item.status.toLowerCase();
                    
                    const extra = (() => {
                      const orKey = String(item.ordem).replace(/^OR[:\s]*/i, '').trim();
                      if (orKey && orKey !== '-' && orKey !== '0' && gerenciadorData[orKey]) {
                        return gerenciadorData[orKey];
                      }
                      return null;
                    })();

                    const displayStatus = (() => {
                      if (statusLower === 'na' || !item.status) {
                        const start = extra?.inicio || item.inicioConferencia;
                        if (!start || !start.includes(':')) {
                          return "AGUARDANDO CONFERÊNCIA";
                        }
                      }
                      return item.status;
                    })();

                    const finalStatusLower = displayStatus.toLowerCase();
                    let nameColor = "text-orange-400"; // Default
                    if (finalStatusLower.includes('descarga') && !finalStatusLower.includes('aguardando')) {
                      nameColor = "text-emerald-400";
                    } else if (finalStatusLower.includes('conferência') || finalStatusLower.includes('conferencia')) {
                      nameColor = "text-blue-400";
                    }

                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-3 py-[1px]">
                      <div className={cn("text-[9px] font-black uppercase leading-tight transition-colors", nameColor)}>
                        {formatSupplierName(item.fornecedor)}
                      </div>
                      {item.ordem && item.ordem !== '-' && item.ordem !== '0' && (
                        <div className="text-[9px] text-emerald-400 font-mono font-bold mt-0.5">OR: {item.ordem}</div>
                      )}
                    </td>
                    <td className="px-3 py-[2px] text-center">
                      <span className="text-xl font-black text-orange-400 leading-none font-mono drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">{item.doca}</span>
                    </td>
                    <td className="px-3 py-[2px] text-center">
                          <span className={cn(
                            "border text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest whitespace-nowrap",
                            finalStatusLower.includes('descarga') && !finalStatusLower.includes('aguardando') 
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : (finalStatusLower.includes('conferência') || finalStatusLower.includes('conferencia'))
                                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                                : "bg-orange-500/20 border-orange-500/40 text-orange-400 animate-pulse"
                          )}>
                            {displayStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
                <Box className="w-8 h-8 mb-2" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Sem operações no momento</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Column 3: Finalizados */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-card tech-border rounded-3xl flex flex-col overflow-hidden"
        >
          <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 px-4 py-1.5 flex justify-between items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 animate-pulse" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic relative z-10">FINALIZADOS</h2>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black text-white font-mono relative z-10">{stats.finalizados.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {stats.finalizados.length > 0 ? (
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 bg-slate-900/50 sticky top-0 z-10 font-mono">
                    <th className="px-3 py-2 text-left">FORNECEDOR / OR</th>
                    <th className="px-3 py-2 text-center">DOCA</th>
                    <th className="px-3 py-2 text-center">SAÍDAS</th>
                    <th className="px-3 py-2 text-center text-white">HORA</th>
                    <th className="px-3 py-2 text-center text-white">CONFERÊNCIA</th>
                    <th className="px-3 py-2 text-center text-white">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.finalizados.map((item, idx) => {
                    const isAlert = item.status.toLowerCase().includes('noshow') || item.status.toLowerCase().includes('recusado');
                    
                    // Improved matching logic
                    const findExtraData = () => {
                      if (isAlert) return null;

                      const orKey = String(item.ordem).replace(/^OR[:s]*/i, '').trim();
                      if (orKey && orKey !== '-' && orKey !== '0' && gerenciadorData[orKey]) {
                        return gerenciadorData[orKey];
                      }
                      
                      if (item.fornecedor) {
                        const match = Object.values(gerenciadorData).find((d: any) => {
                          return matchSupplierNames(d.fornecedor || '', item.fornecedor || '');
                        });
                        if (match) return match;
                      }
                      return null;
                    };
                    const extra = findExtraData();
                    
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-3 py-[1px]">
                          <div className={cn(
                            "text-[9px] font-black uppercase transition-colors shrink-0 leading-tight",
                            isAlert ? "text-rose-500" : "text-white group-hover:text-emerald-400"
                          )}>
                            {formatSupplierName(item.fornecedor)}
                          </div>
                          {item.ordem && item.ordem !== '-' && item.ordem !== '0' ? (
                            <div className="text-[9px] text-emerald-400/70 font-mono font-bold mt-0.5">OR: {item.ordem}</div>
                          ) : extra?.or && (
                            <div className="text-[9px] text-emerald-400/30 font-mono font-bold mt-0.5">OR: {extra.or}</div>
                          )}
                        </td>
                        <td className="px-3 py-[1px] text-center font-bold text-emerald-400 font-mono italic text-[10px]">{item.doca || '---'}</td>
                        <td className="px-3 py-[1px] text-center">
                          <div className="flex justify-center">
                            <span className="bg-emerald-900/50 text-emerald-400 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-black border border-emerald-500/30">
                              1
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-[1px] text-center font-black text-white font-mono text-[9px]">
                          {(() => {
                            const dateStr = extra?.chegada || item.chegadaDoca;
                            if (!dateStr || !dateStr.includes(':')) return '--:--';
                            const parts = dateStr.trim().split(' ');
                            const timePart = parts.length > 1 ? parts[1] : parts[0];
                            const timeOnly = timePart.split(':');
                            if (timeOnly.length < 2) return '--:--';
                            return `${timeOnly[0].padStart(2, '0')}:${timeOnly[1].padStart(2, '0')}`;
                          })()}
                        </td>
                        <td className="px-3 py-[1px] text-center font-black text-blue-400 font-mono text-[9px] italic">
                          {(() => {
                            // Tempo de Conferência: Fim (W) - Início (V)
                            const start = extra?.inicio || item.inicioConferencia;
                            const end = extra?.fim || item.fimConferencia;
                            return calculateTimeDiff(start, end);
                          })()}
                        </td>
                        <td className="px-3 py-[1px] text-center font-black text-emerald-400 font-mono text-[9px] italic">
                          {(() => {
                            // Tempo Total: Da Chegada (G) até Alocação (Y)
                            const arrival = extra?.chegada || item.chegadaDoca;
                            const mapTime = extra?.mapaAlocacao || item.mapaAlocacao;
                            
                            // Gatilho final é o mapa de alocação (Y), mas se não tiver, usamos o fim da conferência (W) como fallback
                            const endTime = (mapTime && mapTime !== '-' && mapTime !== '0') ? mapTime : (extra?.fim || item.fimConferencia);
                            
                            const manualTotal = calculateTimeDiff(arrival, endTime);
                            
                            if (manualTotal !== '---' && manualTotal !== '0H 00M') {
                              return manualTotal;
                            }

                            // Fallback para valor formatado da planilha se disponível
                            const spreadsheetVal = extra?.total || item.tempoTotal;
                            const formattedSpreadsheet = formatTempoMedio(spreadsheetVal);
                            
                            if (formattedSpreadsheet !== '---' && formattedSpreadsheet !== '0H 00M') {
                              return formattedSpreadsheet;
                            }
                            
                            return manualTotal;
                          })()}
                        </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
                <CheckCircle2 className="w-8 h-8 mb-2" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Sem cargas finalizadas hoje</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
        ) : view === 'reports' ? (
          <ReportsView 
            operadoresData={operadoresData} 
            loading={operadoresLoading}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            pendingLots={pendingLots}
            pendingLoading={pendingLoading}
          />
        ) : view === 'analytics' ? (
          <AnalyticsView selectedDate={selectedDate} />
        ) : view === 'daily_report' ? (
          <DailyReportView 
            stats={stats} 
            mapaData={mapaData} 
            mapaLoading={mapaLoading}
            operadoresData={operadoresData}
            operadoresLoading={operadoresLoading}
            pendingLots={pendingLots}
            pendingLoading={pendingLoading}
          />
        ) : (
          <DevolucaoView />
        )}
      </AnimatePresence>
    </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}} />
    </div>
  );
}
