import re
from datetime import datetime, timezone

import yfinance as yf

TICKER_PATTERN = re.compile(r'^[A-Z0-9.\-]{1,10}$')

NEWS_TEMPLATES = {
    "unavailable": {
        "en": "No recent headlines are available for {ticker} right now.",
        "es": "No hay titulares recientes disponibles para {ticker} en este momento.",
    },
    "disclaimer": {
        "en": "Headlines are sourced from Yahoo Finance and shown for context only. TradeBias does not endorse or interpret them.",
        "es": "Los titulares provienen de Yahoo Finance y se muestran solo como contexto. TradeBias no los respalda ni los interpreta.",
    },
}


def _nt(lang: str, key: str, **kwargs) -> str:
    lang = lang if lang in ("en", "es") else "en"
    entry = NEWS_TEMPLATES.get(key, {})
    template = entry.get(lang) or entry.get("en", "")
    return template.format(**kwargs)


def _extract_article(raw: dict) -> dict | None:
    """Pull a flat {title, publisher, link, published} dict out of one news item.

    Handles both the newer nested format (fields under a 'content' key) and the
    older flat format, so the module keeps working across yfinance versions.
    Returns None if no usable title/link can be found.
    """
    # Newer yfinance: the article payload lives under "content".
    content = raw.get("content") if isinstance(raw.get("content"), dict) else raw

    title = content.get("title") or raw.get("title")
    if not title:
        return None

    # Publisher / provider
    publisher = None
    provider = content.get("provider")
    if isinstance(provider, dict):
        publisher = provider.get("displayName")
    publisher = publisher or content.get("publisher") or raw.get("publisher")

    # Link — several possible shapes depending on version
    link = None
    for key in ("canonicalUrl", "clickThroughUrl"):
        candidate = content.get(key)
        if isinstance(candidate, dict):
            link = candidate.get("url")
        elif isinstance(candidate, str):
            link = candidate
        if link:
            break
    link = link or raw.get("link")

    # Published timestamp — could be ISO string ("pubDate") or epoch seconds
    published = None
    pub_date = content.get("pubDate") or content.get("displayTime")
    if isinstance(pub_date, str) and pub_date:
        published = pub_date
    else:
        epoch = raw.get("providerPublishTime")
        if isinstance(epoch, (int, float)):
            try:
                published = datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
            except (ValueError, OSError, OverflowError):
                published = None

    return {
        "title": str(title).strip(),
        "publisher": str(publisher).strip() if publisher else None,
        "link": link,
        "published": published,
    }


def get_news(ticker: str, lang: str = "en", limit: int = 6) -> dict:
    ticker = ticker.strip().upper()
    lang = lang if lang in ("en", "es") else "en"

    if not TICKER_PATTERN.match(ticker):
        return {"available": False, "articles": [], "disclaimer": _nt(lang, "disclaimer")}

    try:
        raw_news = yf.Ticker(ticker).news
    except Exception:
        return {
            "available": False,
            "message": _nt(lang, "unavailable", ticker=ticker),
            "articles": [],
            "disclaimer": _nt(lang, "disclaimer"),
        }

    if not raw_news:
        return {
            "available": False,
            "message": _nt(lang, "unavailable", ticker=ticker),
            "articles": [],
            "disclaimer": _nt(lang, "disclaimer"),
        }

    articles = []
    for item in raw_news:
        if not isinstance(item, dict):
            continue
        parsed = _extract_article(item)
        if parsed and parsed["title"] and parsed["link"]:
            articles.append(parsed)
        if len(articles) >= limit:
            break

    if not articles:
        return {
            "available": False,
            "message": _nt(lang, "unavailable", ticker=ticker),
            "articles": [],
            "disclaimer": _nt(lang, "disclaimer"),
        }

    return {
        "available": True,
        "ticker": ticker,
        "articles": articles,
        "disclaimer": _nt(lang, "disclaimer"),
    }
