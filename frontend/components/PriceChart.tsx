'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
} from 'lightweight-charts';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  supertrend: number;
}

interface PriceChartProps {
  candles: Candle[];
}

export default function PriceChart({ candles }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7585',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e2229' },
        horzLines: { color: '#1e2229' },
      },
      timeScale: { borderColor: '#1e2229' },
      rightPriceScale: { borderColor: '#1e2229' },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e5a0',
      downColor: '#ff4d6d',
      borderVisible: false,
      wickUpColor: '#00e5a0',
      wickDownColor: '#ff4d6d',
    });
    candleSeries.setData(
      candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))
    );

    // VWAP (ámbar)
    const vwapSeries = chart.addSeries(LineSeries, {
      color: '#f5a623',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    vwapSeries.setData(candles.map((c) => ({ time: c.time, value: c.vwap })));

    // Supertrend (violeta)
    const supertrendSeries = chart.addSeries(LineSeries, {
      color: '#b48cf2',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    supertrendSeries.setData(candles.map((c) => ({ time: c.time, value: c.supertrend })));

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0, 229, 160, 0.4)' : 'rgba(255, 77, 109, 0.4)',
      }))
    );

    chart.timeScale().fitContent();

    function handleResize() {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles]);

  return <div ref={containerRef} style={{ width: '100%', height: 360 }} />;
}