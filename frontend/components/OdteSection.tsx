'use client';

import { useState } from 'react';

type Lang = 'en' | 'es';

interface PutCallRatio {
  ratio_oi: number | null;
  ratio_volume: number | null;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  note: string | null;
}

interface MaxPain {
  price: number | null;
  note: string | null;
}

interface GammaExposure {
  call_gex: number;
  put_gex: number;
  net_gex: number;
  note: string | null;
}

interface Atr {
  available: boolean;
  value?: number;
  pct_of_price?: number;
  note: string | null;
}

interface Vix {
  available: boolean;
  level?: number;
  category?: 'low' | 'normal' | 'elevated' | 'high';
  note: string | null;
}

interface OdteResult {
  ticker: string;
  expiration: string;
  spot_price: number;
  context_label: 'pinning' | 'volatility_expansion' | 'neutral';
  summary: string;
  disclaimer: string;
  put_call_ratio: PutCallRatio;
  max_pain: MaxPain;
  gamma_exposure: GammaExposure;
  atr: Atr;
  vix: Vix;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ODTE_TICKERS = ['SPY', 'QQQ', 'SPX'];

const TX = {
  en: {
    intro: '// SELECT AN UNDERLYING FOR SAME-DAY OPTIONS STRUCTURE',
    subtitle: 'Structural snapshot of 0DTE options positioning — not a directional call.',
    loading: 'Reading the options chain...',
    loadingNote: 'If the server has been inactive, this can take up to a minute.',
    errConnect: 'Couldn\'t connect to the backend. Make sure it\'s running.',
    errTimeout: 'The request took too long (more than 60 seconds). The backend might be busy — try again.',
    errBadJson: "The server's response wasn't valid.",
    errGeneric: 'Something went wrong loading 0DTE data.',
    contextDivider: 'Market Structure',
    contextPinning: 'Pinning',
    contextExpansion: 'Volatility Expansion',
    contextNeutral: 'Neutral',
    contextLabel: '// 0DTE Structure — ',
    spotLabel: 'Spot',
    expLabel: 'Expiration',
    metricsDivider: 'Positioning Metrics',
    metricsTitle: 'Options Positioning',
    metricsMeta: 'From today\'s 0DTE chain · Open interest & IV',
    pcrLabel: 'Put/Call Ratio',
    pcrSub: (oi: number | null, vol: number | null) =>
      `By OI: ${oi ?? '—'} · By volume: ${vol ?? '—'}`,
    maxPainLabel: 'Max Pain',
    gexLabel: 'Net Gamma (GEX)',
    atrLabel: 'Daily ATR (14)',
    vixLabel: 'VIX',
    contextDividerCtx: 'What This Means',
    contextTitle: 'Reading',
    contextMeta: 'Structure, not prediction',
    emptyTitle: 'No underlying selected',
    emptyText: 'Pick SPY, QQQ, or SPX above to load today\'s 0DTE options structure.',
    explanations: {
      pcr: 'Compares how much open interest sits on puts versus calls. A high ratio means heavy put positioning (often hedging); a low ratio means call-heavy. It describes positioning, not direction.',
      maxPain: 'The strike where the most options expire worthless. Price sometimes gravitates toward it into expiration, but it is a tendency, not a rule.',
      gex: 'Net dealer gamma. Positive gamma tends to dampen moves (price pinned near big strikes); negative gamma tends to amplify them (faster swings).',
      atr: 'The typical daily range over the last 14 days — a rough gauge of how far this underlying usually travels in a session.',
      vix: 'The market\'s expectation of near-term S&P 500 volatility. Higher means more uncertainty is priced in.',
    },
  },
  es: {
    intro: '// SELECCIONA UN SUBYACENTE PARA VER LA ESTRUCTURA DE OPCIONES DEL DÍA',
    subtitle: 'Instantánea estructural del posicionamiento de opciones 0DTE — no es una señal direccional.',
    loading: 'Leyendo la cadena de opciones...',
    loadingNote: 'Si el servidor ha estado inactivo, esto puede tardar hasta un minuto.',
    errConnect: 'No se pudo conectar con el backend. Asegúrate de que esté corriendo.',
    errTimeout: 'La solicitud tardó demasiado (más de 60 segundos). El backend podría estar ocupado — intenta de nuevo.',
    errBadJson: 'La respuesta del servidor no es válida.',
    errGeneric: 'Ocurrió un error al cargar los datos 0DTE.',
    contextDivider: 'Estructura del Mercado',
    contextPinning: 'Pinning',
    contextExpansion: 'Expansión de Volatilidad',
    contextNeutral: 'Neutral',
    contextLabel: '// Estructura 0DTE — ',
    spotLabel: 'Spot',
    expLabel: 'Vencimiento',
    metricsDivider: 'Métricas de Posicionamiento',
    metricsTitle: 'Posicionamiento de Opciones',
    metricsMeta: 'De la cadena 0DTE de hoy · Interés abierto e IV',
    pcrLabel: 'Ratio Put/Call',
    pcrSub: (oi: number | null, vol: number | null) =>
      `Por OI: ${oi ?? '—'} · Por volumen: ${vol ?? '—'}`,
    maxPainLabel: 'Max Pain',
    gexLabel: 'Gamma Neta (GEX)',
    atrLabel: 'ATR Diario (14)',
    vixLabel: 'VIX',
    contextDividerCtx: 'Qué Significa Esto',
    contextTitle: 'Lectura',
    contextMeta: 'Estructura, no predicción',
    emptyTitle: 'Ningún subyacente seleccionado',
    emptyText: 'Elige SPY, QQQ o SPX arriba para cargar la estructura de opciones 0DTE de hoy.',
    explanations: {
      pcr: 'Compara cuánto interés abierto hay en puts frente a calls. Un ratio alto indica fuerte posicionamiento en puts (a menudo cobertura); un ratio bajo indica predominio de calls. Describe posicionamiento, no dirección.',
      maxPain: 'El strike donde la mayor cantidad de opciones vence sin valor. El precio a veces gravita hacia ahí cerca del vencimiento, pero es una tendencia, no una regla.',
      gex: 'Gamma neta de los market makers. La gamma positiva tiende a amortiguar los movimientos (precio anclado cerca de strikes grandes); la negativa tiende a amplificarlos (oscilaciones más rápidas).',
      atr: 'El rango diario típico de los últimos 14 días — una referencia aproximada de cuánto suele moverse este subyacente en una sesión.',
      vix: 'La expectativa del mercado sobre la volatilidad del S&P 500 a corto plazo. Más alto significa que se descuenta más incertidumbre.',
    },
  },
};

export default function OdteSection({ lang }: { lang: Lang }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OdteResult | null>(null);

  const tx = TX[lang];

  async function loadOdte(ticker: string) {
    setSelected(ticker);
    setError(null);
    setResult(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/odte/${ticker}?lang=${lang}`, { signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setError(err.name === 'AbortError' ? tx.errTimeout : tx.errConnect);
      setLoading(false);
      return;
    }
    clearTimeout(timeoutId);

    let data: any;
    try {
      data = await res.json();
    } catch {
      setError(tx.errBadJson);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.detail || tx.errGeneric);
      setLoading(false);
      return;
    }

    setResult(data as OdteResult);
    setLoading(false);
  }

  const contextClassMap: Record<string, string> = {
    pinning: 'neutral',
    volatility_expansion: 'bearish',
    neutral: '',
  };
  const contextLabelMap: Record<string, string> = {
    pinning: tx.contextPinning,
    volatility_expansion: tx.contextExpansion,
    neutral: tx.contextNeutral,
  };
  const biasBoxClass = `bias-box ${result ? contextClassMap[result.context_label] : ''}`;

  return (
    <>
      <div className="hero" style={{ paddingBottom: 24 }}>
        <p style={{ marginBottom: 24 }}>{tx.intro}</p>
        <div className="input-row" style={{ maxWidth: 360 }}>
          {ODTE_TICKERS.map((t) => (
            <button
              key={t}
              className="analyze-btn"
              style={{
                flex: 1,
                background: selected === t ? 'var(--bull)' : 'var(--surface)',
                color: selected === t ? '#000' : 'var(--text)',
                border: selected === t ? 'none' : '1px solid var(--border2)',
              }}
              onClick={() => loadOdte(t)}
              disabled={loading}
            >
              {t}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 20, fontSize: '0.72rem' }}>{tx.subtitle}</p>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{tx.loading}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>{tx.loadingNote}</p>
        </div>
      )}

      {error && !loading && <div className="error-box">{error}</div>}

      {result && !loading && (
        <div className="results">

          <div className="section-divider">{tx.contextDivider}</div>
          <div className={biasBoxClass}>
            <div className="bias-left">
              <span className="bias-label">{tx.contextLabel}{result.ticker}</span>
              <span className="company-name">{tx.expLabel}: {result.expiration}</span>
              <div className="bias-value" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
                {contextLabelMap[result.context_label]}
              </div>
              <div className="bias-score">
                {tx.spotLabel} <span>${result.spot_price.toFixed(2)}</span>
              </div>
            </div>
            <div className="bias-right">
              <div className="confidence-pill">
                <div className="conf-dot"></div>
                <span>{tx.vixLabel} {result.vix.available ? result.vix.level : '—'}</span>
              </div>
            </div>
          </div>

          <div className="section-divider">{tx.metricsDivider}</div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><div className="icon">📊</div>{tx.metricsTitle}</div>
              <div className="card-meta">{tx.metricsMeta}</div>
            </div>
            <div className="indicators-grid">

              <div className="indicator-card">
                <div className="ind-label">{tx.pcrLabel}</div>
                <div className="ind-value">{result.put_call_ratio.ratio_oi ?? '—'}</div>
                <div className="ind-sub">{tx.pcrSub(result.put_call_ratio.ratio_oi, result.put_call_ratio.ratio_volume)}</div>
                <div className="ind-tooltip"><p>{tx.explanations.pcr}</p></div>
              </div>

              <div className="indicator-card">
                <div className="ind-label">{tx.maxPainLabel}</div>
                <div className="ind-value">{result.max_pain.price !== null ? `$${result.max_pain.price.toFixed(2)}` : '—'}</div>
                <div className="ind-sub">{result.max_pain.note ?? ''}</div>
                <div className="ind-tooltip"><p>{tx.explanations.maxPain}</p></div>
              </div>

              <div className="indicator-card">
                <div className="ind-label">{tx.gexLabel}</div>
                <div className="ind-value">{formatGex(result.gamma_exposure.net_gex)}</div>
                <div className="ind-sub">{result.gamma_exposure.note ?? ''}</div>
                <div className="ind-tooltip"><p>{tx.explanations.gex}</p></div>
              </div>

              <div className="indicator-card">
                <div className="ind-label">{tx.atrLabel}</div>
                <div className="ind-value">{result.atr.available ? result.atr.value!.toFixed(2) : '—'}</div>
                <div className="ind-sub">{result.atr.available ? `${result.atr.pct_of_price}% ${lang === 'es' ? 'del precio' : 'of price'}` : ''}</div>
                <div className="ind-tooltip"><p>{tx.explanations.atr}</p></div>
              </div>

              <div className="indicator-card">
                <div className="ind-label">{tx.vixLabel}</div>
                <div className="ind-value">{result.vix.available ? result.vix.level : '—'}</div>
                <div className="ind-sub">{result.vix.note ?? ''}</div>
                <div className="ind-tooltip"><p>{tx.explanations.vix}</p></div>
              </div>

            </div>
          </div>

          <div className="section-divider">{tx.contextDividerCtx}</div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><div className="icon">💬</div>{tx.contextTitle}</div>
              <div className="card-meta">{tx.contextMeta}</div>
            </div>
            <div className="explanation-box">
              <p className="explanation-text">{result.summary}</p>
              <div className="risk-tag">{result.disclaimer}</div>
            </div>
          </div>

        </div>
      )}

      {!result && !loading && !error && (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>{tx.emptyTitle}</h3>
          <p>{tx.emptyText}</p>
        </div>
      )}
    </>
  );
}

function formatGex(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
