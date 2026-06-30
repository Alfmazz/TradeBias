import math
from datetime import datetime
from zoneinfo import ZoneInfo

import yfinance as yf
import pandas as pd
import ta

# ── CONFIG ───────────────────────────────────────────────────────────
# Only liquid, daily-expiration underlyings are supported for 0DTE.
# "SPX" is mapped to the Yahoo Finance index symbol "^SPX". Index option
# chains are not always available through yfinance — if that happens,
# we return a clear "unavailable" response instead of guessing.
TICKER_MAP = {
    "SPY": "SPY",
    "QQQ": "QQQ",
    "SPX": "^SPX",
}

RISK_FREE_RATE = 0.05  # constant assumption; negligible impact at 0DTE horizons
ET = ZoneInfo("America/New_York")

ODTE_TEMPLATES = {
    "no_0dte_today": {
        "en": "No same-day (0DTE) expiration is currently listed for {ticker}. This can happen outside market hours or on days without a daily expiration.",
        "es": "No hay un vencimiento del mismo día (0DTE) disponible actualmente para {ticker}. Esto puede pasar fuera del horario de mercado o en días sin vencimiento diario.",
    },
    "no_chain": {
        "en": "Couldn't fetch the options chain for {ticker} right now. This is usually temporary — try again in a moment.",
        "es": "No se pudo obtener la cadena de opciones de {ticker} en este momento. Suele ser algo temporal — intenta de nuevo en un momento.",
    },
    "pc_put_heavy": {
        "en": "more open interest on puts than calls",
        "es": "más interés abierto en puts que en calls",
    },
    "pc_call_heavy": {
        "en": "more open interest on calls than puts",
        "es": "más interés abierto en calls que en puts",
    },
    "pc_balanced": {
        "en": "fairly balanced between puts and calls",
        "es": "relativamente equilibrado entre puts y calls",
    },
    "max_pain_above": {
        "en": "Max pain sits at {mp:.2f}, {pct:.2f}% above the current price ({price:.2f}).",
        "es": "El max pain está en {mp:.2f}, {pct:.2f}% por encima del precio actual ({price:.2f}).",
    },
    "max_pain_below": {
        "en": "Max pain sits at {mp:.2f}, {pct:.2f}% below the current price ({price:.2f}).",
        "es": "El max pain está en {mp:.2f}, {pct:.2f}% por debajo del precio actual ({price:.2f}).",
    },
    "max_pain_at": {
        "en": "Max pain sits right at the current price ({price:.2f}).",
        "es": "El max pain está prácticamente en el precio actual ({price:.2f}).",
    },
    "gex_pinning": {
        "en": "Positive net gamma exposure — dealer hedging tends to dampen volatility, so price may gravitate toward high-open-interest strikes.",
        "es": "Exposición neta de gamma positiva — la cobertura de los market makers tiende a reducir la volatilidad, por lo que el precio podría gravitar hacia strikes con mayor interés abierto.",
    },
    "gex_expansion": {
        "en": "Negative net gamma exposure — dealer hedging tends to amplify moves, so faster and larger intraday swings are more likely.",
        "es": "Exposición neta de gamma negativa — la cobertura de los market makers tiende a amplificar los movimientos, por lo que son más probables oscilaciones intradía más rápidas y amplias.",
    },
    "gex_neutral": {
        "en": "Net gamma exposure is roughly balanced — no strong structural pull in either direction today.",
        "es": "La exposición neta de gamma está relativamente equilibrada — no hay un sesgo estructural fuerte en ninguna dirección hoy.",
    },
    "atr_note": {
        "en": "Daily ATR(14) is {atr:.2f} ({pct:.2f}% of price) — a rough gauge of this ticker's typical daily range.",
        "es": "El ATR(14) diario es {atr:.2f} ({pct:.2f}% del precio) — una referencia aproximada del rango diario típico de este ticker.",
    },
    "vix_low": {"en": "low — implied volatility is subdued", "es": "bajo — la volatilidad implícita está contenida"},
    "vix_normal": {"en": "normal — typical market conditions", "es": "normal — condiciones de mercado típicas"},
    "vix_elevated": {"en": "elevated — increased uncertainty priced in", "es": "elevado — el mercado está descontando mayor incertidumbre"},
    "vix_high": {"en": "high — market pricing in significant stress", "es": "alto — el mercado está descontando estrés significativo"},
    "summary_pinning": {
        "en": "{ticker} 0DTE structure leans toward pinning, with positive gamma support near max pain ({mp:.2f}).",
        "es": "La estructura 0DTE de {ticker} se inclina hacia un comportamiento de \"pinning\", con soporte de gamma positiva cerca del max pain ({mp:.2f}).",
    },
    "summary_expansion": {
        "en": "{ticker} 0DTE structure shows potential for expansion — negative gamma raises the odds of larger intraday moves.",
        "es": "La estructura 0DTE de {ticker} muestra potencial de expansión — la gamma negativa aumenta la probabilidad de movimientos intradía más amplios.",
    },
    "summary_neutral": {
        "en": "{ticker} 0DTE structure is mixed today — no strong gamma-driven bias.",
        "es": "La estructura 0DTE de {ticker} está mixta hoy — no hay un sesgo fuerte impulsado por gamma.",
    },
    "disclaimer": {
        "en": "This is a structural snapshot of options positioning, not a price prediction. 0DTE options carry extreme risk, including rapid time decay — size your trades accordingly.",
        "es": "Esto es una instantánea estructural del posicionamiento de opciones, no una predicción de precio. Las opciones 0DTE conllevan riesgo extremo, incluyendo decaimiento de tiempo acelerado — ajusta el tamaño de tus operaciones en consecuencia.",
    },
}


def _t0(lang: str, key: str, **kwargs) -> str:
    lang = lang if lang in ("en", "es") else "en"
    entry = ODTE_TEMPLATES.get(key, {})
    template = entry.get(lang) or entry.get("en", "")
    return template.format(**kwargs)


def _bs_gamma(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes gamma. Returns 0 for degenerate inputs instead of raising."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        return 0.0
    try:
        d1 = (math.log(S / K) + (r + (sigma ** 2) / 2) * T) / (sigma * math.sqrt(T))
        phi_d1 = math.exp(-(d1 ** 2) / 2) / math.sqrt(2 * math.pi)
        return phi_d1 / (S * sigma * math.sqrt(T))
    except (ValueError, ZeroDivisionError):
        return 0.0


def _time_to_expiry_years() -> float:
    """Time remaining until today's 4:00 PM ET close, in years. Floored to avoid
    division-by-zero issues right at/after the close."""
    now_et = datetime.now(ET)
    close_et = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    seconds_remaining = (close_et - now_et).total_seconds()
    seconds_remaining = max(seconds_remaining, 60)  # floor at 1 minute
    return seconds_remaining / (3600 * 24 * 365)


def _get_spot_price(symbol: str) -> float:
    t = yf.Ticker(symbol)
    try:
        price = t.fast_info.get("last_price")
        if price:
            return float(price)
    except Exception:
        pass
    hist = t.history(period="1d", interval="1m")
    if hist is None or hist.empty:
        raise ValueError("no spot price available")
    return float(hist["Close"].dropna().iloc[-1])


def _put_call_ratio(calls: pd.DataFrame, puts: pd.DataFrame) -> dict:
    call_oi = float(calls["openInterest"].fillna(0).sum())
    put_oi = float(puts["openInterest"].fillna(0).sum())
    call_vol = float(calls["volume"].fillna(0).sum())
    put_vol = float(puts["volume"].fillna(0).sum())

    ratio_oi = (put_oi / call_oi) if call_oi > 0 else None
    ratio_vol = (put_vol / call_vol) if call_vol > 0 else None

    return {
        "ratio_oi": round(ratio_oi, 2) if ratio_oi is not None else None,
        "ratio_volume": round(ratio_vol, 2) if ratio_vol is not None else None,
        "call_oi": int(call_oi),
        "put_oi": int(put_oi),
        "call_volume": int(call_vol),
        "put_volume": int(put_vol),
    }


def _max_pain(calls: pd.DataFrame, puts: pd.DataFrame) -> float:
    strikes = sorted(set(calls["strike"]).union(set(puts["strike"])))
    if not strikes:
        raise ValueError("no strikes available")

    call_oi_by_strike = calls.groupby("strike")["openInterest"].sum().fillna(0)
    put_oi_by_strike = puts.groupby("strike")["openInterest"].sum().fillna(0)

    best_strike = strikes[0]
    best_pain = None

    for k in strikes:
        call_pain = sum(
            max(k - strike, 0) * oi for strike, oi in call_oi_by_strike.items()
        )
        put_pain = sum(
            max(strike - k, 0) * oi for strike, oi in put_oi_by_strike.items()
        )
        total_pain = call_pain + put_pain
        if best_pain is None or total_pain < best_pain:
            best_pain = total_pain
            best_strike = k

    return float(best_strike)


def _gamma_exposure(calls: pd.DataFrame, puts: pd.DataFrame, S: float, T: float) -> dict:
    def chain_gex(df: pd.DataFrame) -> float:
        total = 0.0
        for _, row in df.iterrows():
            oi = row.get("openInterest") or 0
            iv = row.get("impliedVolatility") or 0
            strike = row.get("strike") or 0
            if oi <= 0 or iv <= 0 or strike <= 0:
                continue
            gamma = _bs_gamma(S, strike, T, RISK_FREE_RATE, iv)
            total += gamma * oi * 100 * S
        return total

    call_gex = chain_gex(calls)
    put_gex = chain_gex(puts)
    net_gex = call_gex - put_gex

    return {
        "call_gex": round(call_gex, 2),
        "put_gex": round(put_gex, 2),
        "net_gex": round(net_gex, 2),
    }


def _atr_context(symbol: str, price: float) -> dict:
    raw = yf.download(symbol, period="2mo", interval="1d", progress=False, auto_adjust=True)
    if raw is None or raw.empty:
        return {"available": False}

    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    high, low, close = raw["High"], raw["Low"], raw["Close"]
    atr_series = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()
    atr_series = atr_series.dropna()
    if atr_series.empty:
        return {"available": False}

    atr_val = float(atr_series.iloc[-1])
    pct = (atr_val / price) * 100 if price > 0 else 0.0
    return {"available": True, "value": round(atr_val, 2), "pct_of_price": round(pct, 2)}


def _vix_context() -> dict:
    try:
        vix_hist = yf.Ticker("^VIX").history(period="5d", interval="1d")
        vix_hist = vix_hist.dropna()
        if vix_hist.empty:
            return {"available": False}
        level = float(vix_hist["Close"].iloc[-1])
    except Exception:
        return {"available": False}

    if level < 15:
        category = "low"
    elif level < 20:
        category = "normal"
    elif level < 30:
        category = "elevated"
    else:
        category = "high"

    return {"available": True, "level": round(level, 2), "category": category}


def analyze_0dte(ticker: str, lang: str = "en") -> dict:
    ticker = ticker.strip().upper()
    lang = lang if lang in ("en", "es") else "en"

    if ticker not in TICKER_MAP:
        return {"error": f"0DTE analysis is only available for {', '.join(TICKER_MAP.keys())}."}

    symbol = TICKER_MAP[ticker]
    yf_ticker = yf.Ticker(symbol)

    try:
        expirations = yf_ticker.options
    except Exception:
        return {"error": _t0(lang, "no_chain", ticker=ticker)}

    if not expirations:
        return {"error": _t0(lang, "no_0dte_today", ticker=ticker)}

    today_str = datetime.now(ET).strftime("%Y-%m-%d")
    if today_str not in expirations:
        return {"error": _t0(lang, "no_0dte_today", ticker=ticker)}

    try:
        chain = yf_ticker.option_chain(today_str)
        calls, puts = chain.calls, chain.puts
    except Exception:
        return {"error": _t0(lang, "no_chain", ticker=ticker)}

    if calls.empty and puts.empty:
        return {"error": _t0(lang, "no_chain", ticker=ticker)}

    try:
        price = _get_spot_price(symbol)
    except Exception:
        return {"error": _t0(lang, "no_chain", ticker=ticker)}

    T = _time_to_expiry_years()

    pcr = _put_call_ratio(calls, puts)

    try:
        max_pain_price = _max_pain(calls, puts)
        mp_pct = ((max_pain_price - price) / price) * 100 if price > 0 else 0.0
        if abs(mp_pct) < 0.05:
            max_pain_note = _t0(lang, "max_pain_at", price=price)
        elif mp_pct > 0:
            max_pain_note = _t0(lang, "max_pain_above", mp=max_pain_price, pct=mp_pct, price=price)
        else:
            max_pain_note = _t0(lang, "max_pain_below", mp=max_pain_price, pct=abs(mp_pct), price=price)
    except Exception:
        max_pain_price = None
        max_pain_note = None

    gex = _gamma_exposure(calls, puts, price, T)

    if gex["net_gex"] > 0:
        gex_note = _t0(lang, "gex_pinning")
        context_label = "pinning"
    elif gex["net_gex"] < 0:
        gex_note = _t0(lang, "gex_expansion")
        context_label = "volatility_expansion"
    else:
        gex_note = _t0(lang, "gex_neutral")
        context_label = "neutral"

    atr = _atr_context(symbol, price)
    vix = _vix_context()
    if vix.get("available"):
        vix_label_key = f"vix_{vix['category']}"
        vix_note = _t0(lang, vix_label_key)
    else:
        vix_note = None

    if pcr["ratio_oi"] is not None:
        if pcr["ratio_oi"] > 1.15:
            pc_note = _t0(lang, "pc_put_heavy")
        elif pcr["ratio_oi"] < 0.85:
            pc_note = _t0(lang, "pc_call_heavy")
        else:
            pc_note = _t0(lang, "pc_balanced")
    else:
        pc_note = None

    if context_label == "pinning" and max_pain_price is not None:
        summary = _t0(lang, "summary_pinning", ticker=ticker, mp=max_pain_price)
    elif context_label == "volatility_expansion":
        summary = _t0(lang, "summary_expansion", ticker=ticker)
    else:
        summary = _t0(lang, "summary_neutral", ticker=ticker)

    return {
        "ticker": ticker,
        "expiration": today_str,
        "spot_price": round(price, 2),
        "context_label": context_label,
        "summary": summary,
        "disclaimer": _t0(lang, "disclaimer"),
        "put_call_ratio": {
            **pcr,
            "note": pc_note,
        },
        "max_pain": {
            "price": round(max_pain_price, 2) if max_pain_price is not None else None,
            "note": max_pain_note,
        },
        "gamma_exposure": {
            **gex,
            "note": gex_note,
        },
        "atr": {
            **atr,
            "note": _t0(lang, "atr_note", atr=atr["value"], pct=atr["pct_of_price"]) if atr.get("available") else None,
        },
        "vix": {
            **vix,
            "note": vix_note,
        },
    }
