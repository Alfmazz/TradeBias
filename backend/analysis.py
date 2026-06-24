import re
import yfinance as yf
import pandas as pd
import ta

TICKER_PATTERN = re.compile(r'^[A-Z0-9.\-]{1,10}$')

TEMPLATES = {
    "rsi_bull": {
        "en": "RSI ({rsi:.1f}) in healthy bullish zone (50–65)",
        "es": "RSI ({rsi:.1f}) en zona alcista saludable (50–65)",
    },
    "rsi_overbought": {
        "en": "RSI ({rsi:.1f}) is overbought (>70)",
        "es": "RSI ({rsi:.1f}) está sobrecomprado (>70)",
    },
    "rsi_oversold": {
        "en": "RSI ({rsi:.1f}) is oversold / weak (<40)",
        "es": "RSI ({rsi:.1f}) está sobrevendido / débil (<40)",
    },
    "rsi_weak": {
        "en": "RSI ({rsi:.1f}) is below 50, weak momentum",
        "es": "RSI ({rsi:.1f}) está por debajo de 50, momentum débil",
    },
    "rsi_neutral": {
        "en": "RSI ({rsi:.1f}) is in neutral territory (65–70)",
        "es": "RSI ({rsi:.1f}) está en territorio neutral (65–70)",
    },
    "macd_fresh_bull": {
        "en": "Fresh bullish MACD crossover",
        "es": "Cruce alcista reciente del MACD",
    },
    "macd_bull": {
        "en": "MACD histogram positive ({macd_h:.3f})",
        "es": "Histograma del MACD positivo ({macd_h:.3f})",
    },
    "macd_fresh_bear": {
        "en": "Fresh bearish MACD crossover",
        "es": "Cruce bajista reciente del MACD",
    },
    "macd_bear": {
        "en": "MACD histogram negative ({macd_h:.3f})",
        "es": "Histograma del MACD negativo ({macd_h:.3f})",
    },
    "volume_bull": {
        "en": "Volume {vol_ratio:.1f}× avg, confirming upward move",
        "es": "Volumen {vol_ratio:.1f}× el promedio, confirmando el movimiento al alza",
    },
    "volume_bear": {
        "en": "Volume {vol_ratio:.1f}× avg, confirming downward move",
        "es": "Volumen {vol_ratio:.1f}× el promedio, confirmando el movimiento a la baja",
    },
    "volume_neutral": {
        "en": "Volume is average ({vol_ratio:.1f}× avg)",
        "es": "El volumen es promedio ({vol_ratio:.1f}× el promedio)",
    },
    "vwap_bull": {
        "en": "Price ({price:.2f}) above 14-day VWAP ({vwap:.2f})",
        "es": "Precio ({price:.2f}) por encima del VWAP de 14 días ({vwap:.2f})",
    },
    "vwap_bear": {
        "en": "Price ({price:.2f}) below 14-day VWAP ({vwap:.2f})",
        "es": "Precio ({price:.2f}) por debajo del VWAP de 14 días ({vwap:.2f})",
    },
    "supertrend_bull": {
        "en": "Supertrend in an uptrend, line at {supertrend_val:.2f}",
        "es": "Supertrend en tendencia alcista, línea en {supertrend_val:.2f}",
    },
    "supertrend_bear": {
        "en": "Supertrend in a downtrend, line at {supertrend_val:.2f}",
        "es": "Supertrend en tendencia bajista, línea en {supertrend_val:.2f}",
    },
    "ad_bull": {
        "en": "A/D line rising over the last 10 days — accumulation (buying pressure)",
        "es": "La línea A/D sube en los últimos 10 días — acumulación (presión de compra)",
    },
    "ad_bear": {
        "en": "A/D line falling over the last 10 days — distribution (selling pressure)",
        "es": "La línea A/D baja en los últimos 10 días — distribución (presión de venta)",
    },
    "fi_bull": {
        "en": "Force Index is positive — buying pressure",
        "es": "El Force Index es positivo — presión de compra",
    },
    "fi_bear": {
        "en": "Force Index is negative — selling pressure",
        "es": "El Force Index es negativo — presión de venta",
    },
    "explain_bullish": {
        "en": "{ticker} is showing a bullish bias based on {n} confirming signal(s).",
        "es": "{ticker} muestra un sesgo alcista basado en {n} señal(es) que lo confirman.",
    },
    "explain_bearish": {
        "en": "{ticker} is showing a bearish bias based on {n} confirming signal(s).",
        "es": "{ticker} muestra un sesgo bajista basado en {n} señal(es) que lo confirman.",
    },
    "explain_neutral": {
        "en": "{ticker} has a neutral bias — signals are mixed.",
        "es": "{ticker} tiene un sesgo neutral — las señales están mixtas.",
    },
    "risk_rsi_high": {
        "en": "RSI is elevated — watch for short-term pullback or consolidation.",
        "es": "El RSI está elevado — atento a un posible retroceso o consolidación a corto plazo.",
    },
    "risk_rsi_low": {
        "en": "RSI is very low — possible continued weakness or oversold bounce setup.",
        "es": "El RSI está muy bajo — posible debilidad continua o configuración de rebote por sobreventa.",
    },
    "risk_below_vwap": {
        "en": "Price is below VWAP — short-term sellers are in control.",
        "es": "El precio está por debajo del VWAP — los vendedores de corto plazo están en control.",
    },
    "risk_low_volume": {
        "en": "Volume is well below average — move may lack conviction.",
        "es": "El volumen está muy por debajo del promedio — el movimiento podría carecer de convicción.",
    },
    "risk_none": {
        "en": "No major risk flags at this time. Always use your own stop-loss.",
        "es": "No hay señales de riesgo importantes por ahora. Siempre usa tu propio stop-loss.",
    },
}


def _t(lang: str, key: str, **kwargs) -> str:
    lang = lang if lang in ("en", "es") else "en"
    entry = TEMPLATES.get(key, {})
    template = entry.get(lang) or entry.get("en", "")
    return template.format(**kwargs)


def analyze_ticker(ticker: str, lang: str = "en") -> dict:
    ticker = ticker.strip().upper()
    lang = lang if lang in ("en", "es") else "en"

    if not TICKER_PATTERN.match(ticker):
        return {"error": f"'{ticker}' doesn't look like a valid ticker. Use only letters, numbers, dots, or hyphens (e.g. SPY, BRK.B, BTC-USD)."}

    try:
        raw = yf.download(ticker, period="6mo", interval="1d", progress=False, auto_adjust=True)
    except Exception:
        return {"error": f"Couldn't fetch data for '{ticker}' right now. This is usually a temporary issue with the data source — try again in a moment."}

    if raw is None or raw.empty:
        return {"error": f"No data found for ticker '{ticker}'. Check the symbol."}

    try:
        info = yf.Ticker(ticker).info
        company_name = info.get("longName") or info.get("shortName") or ticker.upper()
    except Exception:
        company_name = ticker.upper()

    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    df = raw[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.dropna(inplace=True)

    if len(df) < 60:
        return {"error": "Not enough data to calculate indicators. Try a different ticker."}

    high   = df["High"]
    low    = df["Low"]
    close  = df["Close"]
    volume = df["Volume"]

    df["rsi"] = ta.momentum.RSIIndicator(close, window=14).rsi()

    macd_obj = ta.trend.MACD(close)
    df["macd"]        = macd_obj.macd()
    df["macd_signal"] = macd_obj.macd_signal()
    df["macd_hist"]   = macd_obj.macd_diff()

    df["vol_avg20"] = volume.rolling(window=20).mean()

    df["vwap"] = ta.volume.VolumeWeightedAveragePrice(
        high, low, close, volume, window=14
    ).volume_weighted_average_price()

    df["ad"] = ta.volume.AccDistIndexIndicator(high, low, close, volume).acc_dist_index()
    df["fi"] = ta.volume.ForceIndexIndicator(close, volume, window=13).force_index()
    df["supertrend"], df["supertrend_up"] = _calculate_supertrend(df, period=10, multiplier=3)

    df.dropna(inplace=True)

    if df.empty or len(df) < 11:
        return {"error": "Indicator calculation failed. Not enough data."}

    latest = df.iloc[-1]
    prev   = df.iloc[-2]

    price    = float(latest["Close"])
    rsi      = float(latest["rsi"])
    macd     = float(latest["macd"])
    macd_sig = float(latest["macd_signal"])
    macd_h   = float(latest["macd_hist"])
    vol      = float(latest["Volume"])
    vol_avg  = float(latest["vol_avg20"])
    vwap     = float(latest["vwap"])
    ad_now   = float(latest["ad"])
    ad_prev10 = float(df["ad"].iloc[-11])
    fi       = float(latest["fi"])
    supertrend_val = float(latest["supertrend"])
    supertrend_up  = bool(latest["supertrend_up"])

    score       = 0
    bull_points = 0
    bear_points = 0
    signals     = []

    # RSI (±1 / ±2)
    if 50 <= rsi <= 65:
        score += 2; bull_points += 1
        signals.append({"label": "RSI", "result": "bull", "note": _t(lang, "rsi_bull", rsi=rsi)})
    elif rsi > 70:
        score -= 1; bear_points += 1
        signals.append({"label": "RSI", "result": "bear", "note": _t(lang, "rsi_overbought", rsi=rsi)})
    elif rsi < 40:
        score -= 2; bear_points += 1
        signals.append({"label": "RSI", "result": "bear", "note": _t(lang, "rsi_oversold", rsi=rsi)})
    elif 40 <= rsi < 50:
        score -= 1; bear_points += 1
        signals.append({"label": "RSI", "result": "bear", "note": _t(lang, "rsi_weak", rsi=rsi)})
    else:
        signals.append({"label": "RSI", "result": "neutral", "note": _t(lang, "rsi_neutral", rsi=rsi)})

    # MACD (±1 / ±3 crossover bonus)
    prev_macd_hist = float(prev["macd_hist"])
    if macd_h > 0 and prev_macd_hist <= 0:
        score += 3; bull_points += 1
        signals.append({"label": "MACD", "result": "bull", "note": _t(lang, "macd_fresh_bull")})
    elif macd_h > 0:
        score += 1; bull_points += 1
        signals.append({"label": "MACD", "result": "bull", "note": _t(lang, "macd_bull", macd_h=macd_h)})
    elif macd_h < 0 and prev_macd_hist >= 0:
        score -= 3; bear_points += 1
        signals.append({"label": "MACD", "result": "bear", "note": _t(lang, "macd_fresh_bear")})
    else:
        score -= 1; bear_points += 1
        signals.append({"label": "MACD", "result": "bear", "note": _t(lang, "macd_bear", macd_h=macd_h)})

    # Volume (±2)
    vol_ratio = vol / vol_avg if vol_avg > 0 else 1.0
    if vol_ratio >= 1.2 and price > vwap:
        score += 2; bull_points += 1
        signals.append({"label": "Volume", "result": "bull", "note": _t(lang, "volume_bull", vol_ratio=vol_ratio)})
    elif vol_ratio >= 1.2 and price < vwap:
        score -= 2; bear_points += 1
        signals.append({"label": "Volume", "result": "bear", "note": _t(lang, "volume_bear", vol_ratio=vol_ratio)})
    else:
        signals.append({"label": "Volume", "result": "neutral", "note": _t(lang, "volume_neutral", vol_ratio=vol_ratio)})

    # VWAP (±2)
    if price > vwap:
        score += 2; bull_points += 1
        signals.append({"label": "VWAP", "result": "bull", "note": _t(lang, "vwap_bull", price=price, vwap=vwap)})
    else:
        score -= 2; bear_points += 1
        signals.append({"label": "VWAP", "result": "bear", "note": _t(lang, "vwap_bear", price=price, vwap=vwap)})

    # Supertrend (±2)
    if supertrend_up:
        score += 2; bull_points += 1
        signals.append({"label": "Supertrend", "result": "bull", "note": _t(lang, "supertrend_bull", supertrend_val=supertrend_val)})
    else:
        score -= 2; bear_points += 1
        signals.append({"label": "Supertrend", "result": "bear", "note": _t(lang, "supertrend_bear", supertrend_val=supertrend_val)})

    # A/D (±1)
    if ad_now > ad_prev10:
        score += 1; bull_points += 1
        signals.append({"label": "A/D", "result": "bull", "note": _t(lang, "ad_bull")})
    else:
        score -= 1; bear_points += 1
        signals.append({"label": "A/D", "result": "bear", "note": _t(lang, "ad_bear")})

    # Force Index (±1)
    if fi > 0:
        score += 1; bull_points += 1
        signals.append({"label": "FI", "result": "bull", "note": _t(lang, "fi_bull")})
    else:
        score -= 1; bear_points += 1
        signals.append({"label": "FI", "result": "bear", "note": _t(lang, "fi_bear")})

    # ── BIAS & CONFIDENCE ─────────────────────────────────────────────
    # max_possible = 13 (MACD max=3, Volume=2, VWAP=2, Supertrend=2, RSI=2, A/D=1, FI=1)
    max_possible = 13
    pct = ((score + max_possible) / (2 * max_possible)) * 100
    pct = max(0, min(100, pct))

    if score >= 5:
        bias = "bullish"
    elif score <= -5:
        bias = "bearish"
    else:
        bias = "neutral"

    total_signals = bull_points + bear_points
    agreement = max(bull_points, bear_points) / total_signals if total_signals > 0 else 0.5

    if agreement >= 0.85:
        confidence = "high"
    elif agreement >= 0.65:
        confidence = "medium"
    else:
        confidence = "low"

    # ── CHART DATA ────────────────────────────────────────────────────
    candles = []
    for idx, row in df.iterrows():
        candles.append({
            "time":       idx.strftime("%Y-%m-%d"),
            "open":       round(float(row["Open"]), 2),
            "high":       round(float(row["High"]), 2),
            "low":        round(float(row["Low"]), 2),
            "close":      round(float(row["Close"]), 2),
            "volume":     int(row["Volume"]),
            "vwap":       round(float(row["vwap"]), 2),
            "supertrend": round(float(row["supertrend"]), 2),
        })

    # ── SVP ───────────────────────────────────────────────────────────
    NUM_BINS = 24
    price_min = float(df["Low"].min())
    price_max = float(df["High"].max())
    bin_size = (price_max - price_min) / NUM_BINS if price_max > price_min else 1.0
    bins_volume = [0.0] * NUM_BINS

    for _, row in df.iterrows():
        day_low    = float(row["Low"])
        day_high   = float(row["High"])
        day_volume = float(row["Volume"])
        day_range  = day_high - day_low
        if day_range <= 0:
            bin_idx = min(int((day_low - price_min) / bin_size), NUM_BINS - 1)
            bins_volume[bin_idx] += day_volume
            continue
        for i in range(NUM_BINS):
            bin_low  = price_min + i * bin_size
            bin_high = bin_low + bin_size
            overlap  = min(day_high, bin_high) - max(day_low, bin_low)
            if overlap > 0:
                bins_volume[i] += day_volume * (overlap / day_range)

    volume_profile = []
    for i in range(NUM_BINS):
        bin_low  = price_min + i * bin_size
        bin_high = bin_low + bin_size
        volume_profile.append({
            "price_low":  round(bin_low, 2),
            "price_high": round(bin_high, 2),
            "volume":     int(bins_volume[i]),
        })

    poc_index = max(range(NUM_BINS), key=lambda i: bins_volume[i])
    poc_price = round(price_min + (poc_index + 0.5) * bin_size, 2)

    # ── NEAR-TERM RANGE ───────────────────────────────────────────────
    try:
        near_term_range = _calculate_near_term_range(ticker, price)
    except Exception:
        near_term_range = {"available": False}

    explanation = _build_explanation(ticker, bias, signals, lang)
    risk_note   = _build_risk_note(rsi, price, vwap, vol_ratio, lang)

    return {
        "ticker":          ticker.upper(),
        "company_name":    company_name,
        "bias":            bias,
        "score_pct":       round(pct, 1),
        "confidence":      confidence,
        "signals":         signals,
        "explanation":     explanation,
        "risk":            risk_note,
        "candles":         candles,
        "volume_profile":  volume_profile,
        "poc_price":       poc_price,
        "near_term_range": near_term_range,
        "indicators": {
            "price":            round(price, 2),
            "rsi":              round(rsi, 1),
            "macd":             round(macd, 4),
            "macd_signal":      round(macd_sig, 4),
            "macd_hist":        round(macd_h, 4),
            "volume":           int(vol),
            "volume_avg":       int(vol_avg),
            "vol_ratio":        round(vol_ratio, 2),
            "vwap":             round(vwap, 2),
            "ad":               round(ad_now, 2),
            "fi":               round(fi, 2),
            "supertrend":       round(supertrend_val, 2),
            "supertrend_trend": "up" if supertrend_up else "down",
        }
    }


def _calculate_near_term_range(ticker: str, current_price: float) -> dict:
    try:
        intraday = yf.download(ticker, period="1d", interval="1m", progress=False, auto_adjust=True)
    except Exception:
        return {"available": False}

    if intraday is None or intraday.empty:
        return {"available": False}

    if isinstance(intraday.columns, pd.MultiIndex):
        intraday.columns = intraday.columns.get_level_values(0)

    closes = intraday["Close"].dropna()
    if len(closes) < 15:
        return {"available": False}

    recent_closes = closes.tail(61)
    returns_pct   = recent_closes.pct_change().dropna() * 100
    if len(returns_pct) < 10:
        return {"available": False}

    minute_vol_pct  = float(returns_pct.std())
    range_15_pct    = minute_vol_pct * (15 ** 0.5)
    range_30_pct    = minute_vol_pct * (30 ** 0.5)
    range_60_pct    = minute_vol_pct * (60 ** 0.5)
    range_15_dollar = round(current_price * range_15_pct / 100, 2)
    range_30_dollar = round(current_price * range_30_pct / 100, 2)
    range_60_dollar = round(current_price * range_60_pct / 100, 2)

    return {
        "available":          True,
        "minutes_of_data":    int(len(returns_pct)),
        "range_15min_pct":    round(range_15_pct, 2),
        "range_15min_dollar": range_15_dollar,
        "range_15min_low":    round(current_price - range_15_dollar, 2),
        "range_15min_high":   round(current_price + range_15_dollar, 2),
        "range_30min_pct":    round(range_30_pct, 2),
        "range_30min_dollar": range_30_dollar,
        "range_30min_low":    round(current_price - range_30_dollar, 2),
        "range_30min_high":   round(current_price + range_30_dollar, 2),
        "range_60min_pct":    round(range_60_pct, 2),
        "range_60min_dollar": range_60_dollar,
        "range_60min_low":    round(current_price - range_60_dollar, 2),
        "range_60min_high":   round(current_price + range_60_dollar, 2),
    }


def _calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: int = 3):
    high  = df["High"]
    low   = df["Low"]
    close = df["Close"]

    atr = ta.volatility.AverageTrueRange(high, low, close, window=period).average_true_range()
    hl2 = (high + low) / 2
    upperband = hl2 + multiplier * atr
    lowerband = hl2 - multiplier * atr

    final_upper = upperband.copy()
    final_lower = lowerband.copy()
    trend_up    = pd.Series(True, index=df.index)

    for i in range(1, len(df)):
        if close.iloc[i - 1] <= final_upper.iloc[i - 1]:
            final_upper.iloc[i] = min(upperband.iloc[i], final_upper.iloc[i - 1])
        else:
            final_upper.iloc[i] = upperband.iloc[i]

        if close.iloc[i - 1] >= final_lower.iloc[i - 1]:
            final_lower.iloc[i] = max(lowerband.iloc[i], final_lower.iloc[i - 1])
        else:
            final_lower.iloc[i] = lowerband.iloc[i]

        if close.iloc[i] > final_upper.iloc[i - 1]:
            trend_up.iloc[i] = True
        elif close.iloc[i] < final_lower.iloc[i - 1]:
            trend_up.iloc[i] = False
        else:
            trend_up.iloc[i] = trend_up.iloc[i - 1]

    supertrend_line = pd.Series(
        [final_lower.iloc[i] if trend_up.iloc[i] else final_upper.iloc[i] for i in range(len(df))],
        index=df.index
    )
    return supertrend_line, trend_up


def _build_explanation(ticker, bias, signals, lang="en") -> str:
    parts = []
    bull_sigs = [s for s in signals if s["result"] == "bull"]
    bear_sigs = [s for s in signals if s["result"] == "bear"]

    if bias == "bullish":
        parts.append(_t(lang, "explain_bullish", ticker=ticker.upper(), n=len(bull_sigs)))
    elif bias == "bearish":
        parts.append(_t(lang, "explain_bearish", ticker=ticker.upper(), n=len(bear_sigs)))
    else:
        parts.append(_t(lang, "explain_neutral", ticker=ticker.upper()))

    for s in signals:
        parts.append(s["note"] + ".")

    return " ".join(parts)


def _build_risk_note(rsi, price, vwap, vol_ratio, lang="en") -> str:
    if rsi > 68:
        return _t(lang, "risk_rsi_high")
    if rsi < 35:
        return _t(lang, "risk_rsi_low")
    if price < vwap:
        return _t(lang, "risk_below_vwap")
    if vol_ratio < 0.7:
        return _t(lang, "risk_low_volume")
    return _t(lang, "risk_none")