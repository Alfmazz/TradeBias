'use client';

import { useState, useEffect } from 'react';
import PriceChart, { type Candle } from '../components/PriceChart';
import VolumeProfile, { type VolumeBin } from '../components/VolumeProfile';

type Lang = 'en' | 'es';
type SignalResult = 'bull' | 'bear' | 'neutral';

interface Signal {
  label: string;
  result: SignalResult;
  note: string;
}

interface Indicators {
  price: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  volume: number;
  volume_avg: number;
  vol_ratio: number;
  vwap: number;
  ad: number;
  fi: number;
  supertrend: number;
  supertrend_trend: 'up' | 'down';
}

interface NearTermRange {
  available: boolean;
  minutes_of_data?: number;
  range_15min_pct?: number;
  range_15min_low?: number;
  range_15min_high?: number;
  range_30min_pct?: number;
  range_30min_low?: number;
  range_30min_high?: number;
  range_60min_pct?: number;
  range_60min_low?: number;
  range_60min_high?: number;
}

interface AnalysisResult {
  ticker: string;
  company_name: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  score_pct: number;
  confidence: 'high' | 'medium' | 'low';
  signals: Signal[];
  explanation: string;
  risk: string;
  candles: Candle[];
  volume_profile: VolumeBin[];
  poc_price: number;
  near_term_range: NearTermRange;
  indicators: Indicators;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TICKER_PATTERN = /^[A-Z0-9.\-]{1,10}$/;

const T = {
  en: {
    tagline: 'CLARITY OVER PREDICTION',
    heroLine1: 'Read the',
    heroLine2: "market's mood.",
    heroSubtitle: '// ENTER A TICKER TO BEGIN ANALYSIS',
    placeholder: 'SPY, NVDA, BTC-USD...',
    analyzeBtn: 'Analyze →',
    analyzing: 'Analyzing...',
    fetching: 'Fetching market data...',
    fetchingNote: 'If the server has been inactive, this can take up to a minute.',
    errEmpty: 'Enter a ticker before analyzing.',
    errInvalid: "That ticker doesn't look valid. Use only letters, numbers, dots, or hyphens (e.g. SPY, BRK.B, BTC-USD).",
    errTimeout: 'The request took too long (more than 60 seconds). The backend might be busy — try again.',
    errConnect: 'Couldn\'t connect to the backend. Is "uvicorn main:app --reload --port 8000" running?',
    errBadJson: "The server's response wasn't valid.",
    errGeneric: 'Something went wrong analyzing this ticker.',
    biasPrefix: '// Market Bias — ',
    biasBullish: 'Bullish',
    biasBearish: 'Bearish',
    biasNeutral: 'Neutral',
    scoreLabel: 'Score:',
    lastUpdated: '· Last updated just now',
    confHigh: 'High Confidence',
    confMedium: 'Medium Confidence',
    confLow: 'Low Confidence',
    nearTermDivider: 'Near-Term Range',
    expectedMove: 'Expected Move',
    expectedMoveMeta: 'Real intraday volatility · Not a prediction',
    next15: 'Next 15 min',
    next30: 'Next 30 min',
    next60: 'Next 60 min',
    rangeNote: (mins: number) =>
      `Based on the last ${mins} minutes of real trading — this is the range price could plausibly land within, in either direction, not a forecast of which way it will go.`,
    rangeUnavailable: (ticker: string) =>
      `Intraday data isn't available for ${ticker} right now — markets may be closed, or minute-level data isn't offered for this ticker. This section appears automatically once it's available.`,
    priceChartDivider: 'Price Chart',
    dailyChart: 'Daily Chart',
    chartMeta: 'VWAP (amber) · Supertrend (violet) · Volume',
    svpLabel: 'SVP · POC',
    indicatorsDivider: 'Technical Indicators',
    indicatorReadings: 'Indicator Readings',
    indicatorsMeta: 'Hover any card for a plain-English explanation',
    priceLabel: 'Price',
    lastClose: 'Last close',
    rsiLabel: 'RSI (14)',
    macdLabel: 'MACD',
    macdSub: (sig: string, hist: string) => `Signal: ${sig} · Hist: ${hist}`,
    volumeLabel: 'Volume',
    vsAvg: 'vs 20-day average',
    vwapLabel: 'VWAP (14d)',
    supertrendLabel: 'Supertrend',
    trendUp: 'Trend: Uptrend ↑',
    trendDown: 'Trend: Downtrend ↓',
    adLabel: 'A/D Line',
    fiLabel: 'Force Index',
    badgeBull: '✓ Bullish',
    badgeBear: '✗ Bearish',
    badgeNeutral: '→ Neutral',
    summaryDivider: 'Plain-English Summary',
    analysisTitle: 'Analysis',
    analysisMeta: 'Rule-based · No AI · No predictions',
    emptyTitle: 'No ticker analyzed yet',
    emptyText: 'Enter a stock or ETF ticker above to generate a market bias. Try these:',
    footerVersion: 'TradeBias · v0.9.1',
    footerDisclaimer: 'Not financial advice. For educational use only.',
    indicatorExplanations: {
      Price: "The most recent closing price — what the market thinks this asset is worth right now.",
      RSI: "Measures whether the price has moved up or down too fast recently. 50–65 is a healthy zone; above 70 often means it's overbought and due for a breather.",
      MACD: "Compares two moving averages to spot momentum shifts. When it crosses above zero, momentum is turning bullish — below zero, bearish.",
      Volume: "Compares today's trading activity to the 20-day average. Higher volume on a move means more traders are involved, adding conviction to it.",
      VWAP: "The average price, weighted by how much volume traded at each level. Price above VWAP suggests recent buyers are, on average, in profit.",
      Supertrend: "A trend-following line built from recent volatility. While price stays above the line, the trend is considered up — below it, down.",
      AD: "Tracks whether big money is quietly buying (accumulating) or selling (distributing) — even before the price itself shows it.",
      FI: "Combines price change and volume into one number, to gauge how much real \"force\" is behind a move.",
    },
  },
  es: {
    tagline: 'CLARIDAD SOBRE PREDICCIÓN',
    heroLine1: 'Lee el',
    heroLine2: 'ánimo del mercado.',
    heroSubtitle: '// INGRESA UN TICKER PARA COMENZAR EL ANÁLISIS',
    placeholder: 'SPY, NVDA, BTC-USD...',
    analyzeBtn: 'Analizar →',
    analyzing: 'Analizando...',
    fetching: 'Obteniendo datos del mercado...',
    fetchingNote: 'Si el servidor ha estado inactivo, esto puede tardar hasta un minuto.',
    errEmpty: 'Escribe un ticker antes de analizar.',
    errInvalid: 'Ese ticker no parece válido. Usa solo letras, números, puntos o guiones (ej. SPY, BRK.B, BTC-USD).',
    errTimeout: 'La solicitud tardó demasiado (más de 60 segundos). El backend podría estar ocupado — intenta de nuevo.',
    errConnect: 'No se pudo conectar con el backend. ¿Está corriendo "uvicorn main:app --reload --port 8000"?',
    errBadJson: 'La respuesta del servidor no es válida.',
    errGeneric: 'Ocurrió un error al analizar este ticker.',
    biasPrefix: '// Sesgo del Mercado — ',
    biasBullish: 'Alcista',
    biasBearish: 'Bajista',
    biasNeutral: 'Neutral',
    scoreLabel: 'Puntaje:',
    lastUpdated: '· Actualizado hace un momento',
    confHigh: 'Confianza Alta',
    confMedium: 'Confianza Media',
    confLow: 'Confianza Baja',
    nearTermDivider: 'Rango a Corto Plazo',
    expectedMove: 'Movimiento Esperado',
    expectedMoveMeta: 'Volatilidad intradía real · No es una predicción',
    next15: 'Próximos 15 min',
    next30: 'Próximos 30 min',
    next60: 'Próximos 60 min',
    rangeNote: (mins: number) =>
      `Basado en los últimos ${mins} minutos de operaciones reales — este es el rango en el que el precio podría situarse de forma plausible, en cualquier dirección, no un pronóstico de hacia dónde irá.`,
    rangeUnavailable: (ticker: string) =>
      `Los datos intradía no están disponibles para ${ticker} en este momento — los mercados podrían estar cerrados, o este ticker no ofrece datos de minuto. Esta sección aparece automáticamente cuando estén disponibles.`,
    priceChartDivider: 'Gráfico de Precio',
    dailyChart: 'Gráfico Diario',
    chartMeta: 'VWAP (ámbar) · Supertrend (violeta) · Volumen',
    svpLabel: 'SVP · POC',
    indicatorsDivider: 'Indicadores Técnicos',
    indicatorReadings: 'Lecturas de Indicadores',
    indicatorsMeta: 'Pasa el cursor sobre cualquier tarjeta para ver una explicación sencilla',
    priceLabel: 'Precio',
    lastClose: 'Último cierre',
    rsiLabel: 'RSI (14)',
    macdLabel: 'MACD',
    macdSub: (sig: string, hist: string) => `Señal: ${sig} · Hist: ${hist}`,
    volumeLabel: 'Volumen',
    vsAvg: 'vs promedio de 20 días',
    vwapLabel: 'VWAP (14d)',
    supertrendLabel: 'Supertrend',
    trendUp: 'Tendencia: Alcista ↑',
    trendDown: 'Tendencia: Bajista ↓',
    adLabel: 'Línea A/D',
    fiLabel: 'Force Index',
    badgeBull: '✓ Alcista',
    badgeBear: '✗ Bajista',
    badgeNeutral: '→ Neutral',
    summaryDivider: 'Resumen en Lenguaje Claro',
    analysisTitle: 'Análisis',
    analysisMeta: 'Basado en reglas · Sin IA · Sin predicciones',
    emptyTitle: 'Aún no se ha analizado ningún ticker',
    emptyText: 'Ingresa un ticker de acción o ETF arriba para generar un sesgo de mercado. Prueba estos:',
    footerVersion: 'TradeBias · v0.9.1',
    footerDisclaimer: 'No es asesoría financiera. Solo para uso educativo.',
    indicatorExplanations: {
      Price: "El precio de cierre más reciente — lo que el mercado considera que vale este activo en este momento.",
      RSI: "Mide si el precio ha subido o bajado demasiado rápido recientemente. 50–65 es una zona saludable; por encima de 70 suele significar que está sobrecomprado y necesita una pausa.",
      MACD: "Compara dos promedios móviles para detectar cambios de momentum. Cuando cruza por encima de cero, el momentum se vuelve alcista — por debajo de cero, bajista.",
      Volume: "Compara la actividad de hoy con el promedio de 20 días. Mayor volumen en un movimiento significa que más operadores están involucrados, dándole más convicción.",
      VWAP: "El precio promedio, ponderado por cuánto volumen se negoció en cada nivel. Precio por encima del VWAP sugiere que los compradores recientes están, en promedio, en ganancia.",
      Supertrend: "Una línea de seguimiento de tendencia construida a partir de la volatilidad reciente. Mientras el precio se mantenga por encima de la línea, se considera tendencia alcista — por debajo, bajista.",
      AD: "Rastrea si el dinero institucional está comprando silenciosamente (acumulación) o vendiendo (distribución) — incluso antes de que el precio mismo lo muestre.",
      FI: "Combina el cambio de precio y el volumen en un solo número, para medir cuánta \"fuerza\" real hay detrás de un movimiento.",
    },
  },
};

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('tradebias_lang');
    if (saved === 'en' || saved === 'es') setLang(saved);
  }, []);

  useEffect(() => {
    if (result) handleAnalyze(result.ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function toggleLang() {
    const next: Lang = lang === 'en' ? 'es' : 'en';
    setLang(next);
    localStorage.setItem('tradebias_lang', next);
  }

  function findSignal(label: string): Signal | undefined {
    return result?.signals.find((s) => s.label === label);
  }

  function badgeText(r: SignalResult): string {
    if (r === 'bull') return T[lang].badgeBull;
    if (r === 'bear') return T[lang].badgeBear;
    return T[lang].badgeNeutral;
  }

  async function handleAnalyze(overrideTicker?: string) {
    const trimmed = (overrideTicker ?? ticker).trim().toUpperCase();
    setError(null);
    setResult(null);

    if (!trimmed) { setError(T[lang].errEmpty); return; }
    if (!TICKER_PATTERN.test(trimmed)) { setError(T[lang].errInvalid); return; }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/analyze/${trimmed}?lang=${lang}`, { signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setError(err.name === 'AbortError' ? T[lang].errTimeout : T[lang].errConnect);
      setLoading(false);
      return;
    }
    clearTimeout(timeoutId);

    let data: any;
    try { data = await res.json(); } catch {
      setError(T[lang].errBadJson);
      setLoading(false);
      return;
    }

    if (!res.ok) { setError(data.detail || T[lang].errGeneric); setLoading(false); return; }
    setResult(data as AnalysisResult);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAnalyze();
  }

  const ind = result?.indicators;
  const biasBoxClass = `bias-box ${result?.bias === 'bearish' ? 'bearish' : result?.bias === 'neutral' ? 'neutral' : ''}`;

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-dot"></div>
          TradeBias
        </div>
        <div className="header-right">
          <span className="tagline">{T[lang].tagline}</span>
          <button className="lang-toggle" onClick={toggleLang}>{lang === 'en' ? 'ES' : 'EN'}</button>
        </div>
      </header>

      <main>
        <div className="hero">
          <h1>{T[lang].heroLine1}<br /><span>{T[lang].heroLine2}</span></h1>
          <p>{T[lang].heroSubtitle}</p>
          <div className="input-row">
            <input
              className="ticker-input"
              type="text"
              placeholder={T[lang].placeholder}
              maxLength={12}
              autoComplete="off"
              spellCheck={false}
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
            />
            <button className="analyze-btn" onClick={() => handleAnalyze()} disabled={loading}>
              {loading ? T[lang].analyzing : T[lang].analyzeBtn}
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{T[lang].fetching}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>{T[lang].fetchingNote}</p>
          </div>
        )}

        {error && !loading && <div className="error-box">{error}</div>}

        {result && ind && !loading && (
          <div className="results">

            <div className={biasBoxClass}>
              <div className="bias-left">
                <span className="bias-label">{T[lang].biasPrefix}{result.ticker}</span>
                <span className="company-name">{result.company_name}</span>
                <div className="bias-value">
                  {result.bias === 'bullish' ? T[lang].biasBullish : result.bias === 'bearish' ? T[lang].biasBearish : T[lang].biasNeutral}
                </div>
                <div className="bias-score">
                  {T[lang].scoreLabel} <span>{result.score_pct}%</span> {T[lang].lastUpdated}
                </div>
              </div>
              <div className="bias-right">
                <div className="confidence-pill">
                  <div className="conf-dot"></div>
                  <span>{result.confidence === 'high' ? T[lang].confHigh : result.confidence === 'medium' ? T[lang].confMedium : T[lang].confLow}</span>
                </div>
                <div className="signal-grid">
                  {result.signals.map((s) => (
                    <div key={s.label} className={`signal-chip ${s.result}`}>
                      {s.label} {s.result === 'bull' ? '↑' : s.result === 'bear' ? '↓' : '→'}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="section-divider">{T[lang].nearTermDivider}</div>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><div className="icon">⏱</div>{T[lang].expectedMove}</div>
                <div className="card-meta">{T[lang].expectedMoveMeta}</div>
              </div>
              {result.near_term_range.available ? (
                <>
                  <div className="indicators-grid">
                    <div className="indicator-card">
                      <div className="ind-label">{T[lang].next15}</div>
                      <div className="ind-value">±{result.near_term_range.range_15min_pct}%</div>
                      <div className="ind-sub">${result.near_term_range.range_15min_low} – ${result.near_term_range.range_15min_high}</div>
                    </div>
                    <div className="indicator-card">
                      <div className="ind-label">{T[lang].next30}</div>
                      <div className="ind-value">±{result.near_term_range.range_30min_pct}%</div>
                      <div className="ind-sub">${result.near_term_range.range_30min_low} – ${result.near_term_range.range_30min_high}</div>
                    </div>
                    <div className="indicator-card">
                      <div className="ind-label">{T[lang].next60}</div>
                      <div className="ind-value">±{result.near_term_range.range_60min_pct}%</div>
                      <div className="ind-sub">${result.near_term_range.range_60min_low} – ${result.near_term_range.range_60min_high}</div>
                    </div>
                  </div>
                  <div className="explanation-box" style={{ paddingTop: 0 }}>
                    <div className="risk-tag">{T[lang].rangeNote(result.near_term_range.minutes_of_data ?? 0)}</div>
                  </div>
                </>
              ) : (
                <div className="explanation-box">
                  <p className="explanation-text">{T[lang].rangeUnavailable(result.ticker)}</p>
                </div>
              )}
            </div>

            <div className="section-divider">{T[lang].priceChartDivider}</div>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><div className="icon">📈</div>{result.ticker} · {T[lang].dailyChart}</div>
                <div className="card-meta">{T[lang].chartMeta}</div>
              </div>
              <div style={{ padding: '16px 20px 20px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PriceChart candles={result.candles} />
                </div>
                <div style={{ width: 110, flexShrink: 0, height: 360, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: 6, textAlign: 'center' }}>
                    {T[lang].svpLabel} ${result.poc_price.toFixed(2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <VolumeProfile bins={result.volume_profile} pocPrice={result.poc_price} />
                  </div>
                </div>
              </div>
            </div>

            <div className="section-divider">{T[lang].indicatorsDivider}</div>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><div className="icon">⚡</div>{T[lang].indicatorReadings}</div>
                <div className="card-meta">{T[lang].indicatorsMeta}</div>
              </div>
              <div className="indicators-grid">

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].priceLabel}</div>
                  <div className="ind-value">{ind.price.toFixed(2)}</div>
                  <div className="ind-sub">{T[lang].lastClose}</div>
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.Price}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].rsiLabel}</div>
                  <div className="ind-value">{ind.rsi.toFixed(1)}</div>
                  <div className="ind-sub">{findSignal('RSI')?.note}</div>
                  {findSignal('RSI') && <div className={`ind-badge ${findSignal('RSI')!.result}`}>{badgeText(findSignal('RSI')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.RSI}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].macdLabel}</div>
                  <div className="ind-value">{ind.macd.toFixed(3)}</div>
                  <div className="ind-sub">{T[lang].macdSub(ind.macd_signal.toFixed(3), ind.macd_hist.toFixed(3))}</div>
                  {findSignal('MACD') && <div className={`ind-badge ${findSignal('MACD')!.result}`}>{badgeText(findSignal('MACD')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.MACD}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].volumeLabel}</div>
                  <div className="ind-value">{ind.vol_ratio.toFixed(2)}×</div>
                  <div className="ind-sub">{T[lang].vsAvg}</div>
                  {findSignal('Volume') && <div className={`ind-badge ${findSignal('Volume')!.result}`}>{badgeText(findSignal('Volume')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.Volume}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].vwapLabel}</div>
                  <div className="ind-value">{ind.vwap.toFixed(2)}</div>
                  <div className="ind-sub">{findSignal('VWAP')?.note}</div>
                  {findSignal('VWAP') && <div className={`ind-badge ${findSignal('VWAP')!.result}`}>{badgeText(findSignal('VWAP')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.VWAP}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].supertrendLabel}</div>
                  <div className="ind-value">{ind.supertrend.toFixed(2)}</div>
                  <div className="ind-sub">{ind.supertrend_trend === 'up' ? T[lang].trendUp : T[lang].trendDown}</div>
                  {findSignal('Supertrend') && <div className={`ind-badge ${findSignal('Supertrend')!.result}`}>{badgeText(findSignal('Supertrend')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.Supertrend}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].adLabel}</div>
                  <div className="ind-value">{formatLargeNumber(ind.ad)}</div>
                  <div className="ind-sub">{findSignal('A/D')?.note}</div>
                  {findSignal('A/D') && <div className={`ind-badge ${findSignal('A/D')!.result}`}>{badgeText(findSignal('A/D')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.AD}</p></div>
                </div>

                <div className="indicator-card">
                  <div className="ind-label">{T[lang].fiLabel}</div>
                  <div className="ind-value">{formatLargeNumber(ind.fi)}</div>
                  <div className="ind-sub">{findSignal('FI')?.note}</div>
                  {findSignal('FI') && <div className={`ind-badge ${findSignal('FI')!.result}`}>{badgeText(findSignal('FI')!.result)}</div>}
                  <div className="ind-tooltip"><p>{T[lang].indicatorExplanations.FI}</p></div>
                </div>

              </div>
            </div>

            <div className="section-divider">{T[lang].summaryDivider}</div>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><div className="icon">💬</div>{T[lang].analysisTitle}</div>
                <div className="card-meta">{T[lang].analysisMeta}</div>
              </div>
              <div className="explanation-box">
                <p className="explanation-text">{result.explanation}</p>
                <div className="risk-tag">{result.risk}</div>
              </div>
            </div>

          </div>
        )}

        {!result && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>{T[lang].emptyTitle}</h3>
            <p>{T[lang].emptyText}</p>
            <div className="example-tickers">
              {['SPY', 'QQQ', 'NVDA', 'AAPL', 'BTC-USD'].map((sym) => (
                <div key={sym} className="ex-chip" onClick={() => setTicker(sym)}>{sym}</div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer>
        <span>{T[lang].footerVersion}</span>
        <span>{T[lang].footerDisclaimer}</span>
      </footer>
    </>
  );
}

function formatLargeNumber(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}