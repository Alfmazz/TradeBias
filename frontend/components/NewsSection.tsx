'use client';

import { useState, useEffect } from 'react';

type Lang = 'en' | 'es';

interface Article {
  title: string;
  publisher: string | null;
  link: string;
  published: string | null;
}

interface NewsResult {
  available: boolean;
  ticker?: string;
  articles: Article[];
  message?: string;
  disclaimer: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NX = {
  en: {
    divider: 'Related News',
    title: 'Headlines',
    meta: 'Context only · Not interpreted',
    loadBtn: 'Show news',
    loading: 'Fetching headlines...',
    loadingNote: 'If the server has been inactive, this can take up to a minute.',
    errConnect: "Couldn't connect to the backend.",
    errTimeout: 'The request took too long (more than 60 seconds). Try again.',
    errBadJson: "The server's response wasn't valid.",
    errGeneric: 'Something went wrong fetching news.',
    none: 'No recent headlines are available for this ticker right now.',
    justNow: 'just now',
    minsAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
  },
  es: {
    divider: 'Noticias Relacionadas',
    title: 'Titulares',
    meta: 'Solo contexto · Sin interpretar',
    loadBtn: 'Ver noticias',
    loading: 'Obteniendo titulares...',
    loadingNote: 'Si el servidor ha estado inactivo, esto puede tardar hasta un minuto.',
    errConnect: 'No se pudo conectar con el backend.',
    errTimeout: 'La solicitud tardó demasiado (más de 60 segundos). Intenta de nuevo.',
    errBadJson: 'La respuesta del servidor no es válida.',
    errGeneric: 'Ocurrió un error al obtener las noticias.',
    none: 'No hay titulares recientes disponibles para este ticker en este momento.',
    justNow: 'recién',
    minsAgo: (n: number) => `hace ${n} min`,
    hoursAgo: (n: number) => `hace ${n} h`,
    daysAgo: (n: number) => `hace ${n} d`,
  },
};

function timeAgo(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const nx = NX[lang];
  if (mins < 1) return nx.justNow;
  if (mins < 60) return nx.minsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return nx.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return nx.daysAgo(days);
}

export default function NewsSection({ ticker, lang }: { ticker: string; lang: Lang }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewsResult | null>(null);

  const nx = NX[lang];

  // Reset whenever the analyzed ticker changes, so stale news never lingers.
  useEffect(() => {
    setLoaded(false);
    setResult(null);
    setError(null);
    setLoading(false);
  }, [ticker]);

  async function loadNews() {
    setLoaded(true);
    setError(null);
    setResult(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/news/${ticker}?lang=${lang}`, { signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setError(err.name === 'AbortError' ? nx.errTimeout : nx.errConnect);
      setLoading(false);
      return;
    }
    clearTimeout(timeoutId);

    let data: any;
    try {
      data = await res.json();
    } catch {
      setError(nx.errBadJson);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.detail || nx.errGeneric);
      setLoading(false);
      return;
    }

    setResult(data as NewsResult);
    setLoading(false);
  }

  return (
    <>
      <div className="section-divider">{nx.divider}</div>
      <div className="card">
        <div className="card-header">
          <div className="card-title"><div className="icon">📰</div>{nx.title}</div>
          <div className="card-meta">{nx.meta}</div>
        </div>

        {!loaded && (
          <div className="explanation-box" style={{ alignItems: 'center' }}>
            <button className="analyze-btn" onClick={loadNews}>{nx.loadBtn}</button>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{nx.loading}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>{nx.loadingNote}</p>
          </div>
        )}

        {error && !loading && (
          <div className="explanation-box">
            <div className="error-box">{error}</div>
          </div>
        )}

        {result && !loading && !result.available && (
          <div className="explanation-box">
            <p className="explanation-text">{result.message || nx.none}</p>
          </div>
        )}

        {result && !loading && result.available && (
          <div className="news-list">
            {result.articles.map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="news-item">
                <div className="news-item-title">{a.title}</div>
                <div className="news-item-meta">
                  {a.publisher && <span className="news-publisher">{a.publisher}</span>}
                  {a.publisher && a.published && <span className="news-dot">·</span>}
                  {a.published && <span>{timeAgo(a.published, lang)}</span>}
                  <span className="news-arrow">↗</span>
                </div>
              </a>
            ))}
            <div className="explanation-box" style={{ paddingTop: 4 }}>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                {result.disclaimer}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
